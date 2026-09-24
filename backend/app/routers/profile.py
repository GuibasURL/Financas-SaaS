"""Tela "Editar perfil": nome, e-mail, data de nascimento, foto, senha e exclusão da conta."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.dependencies import get_current_user
from app.models.category import Category
from app.models.statement import Statement
from app.models.transaction import Transaction
from app.models.user import User
from app.routers.auth import login_limiter
from app.schemas.user import AccountDelete, PasswordChange, ProfileUpdate, Token, UserOut
from app.services.password_policy import weak_password_message
from app.services.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth/me", tags=["perfil"])

# O navegador já reduz a foto antes de enviar (fica com poucos KB); o limite
# só barra arquivos enviados direto para a API
AVATAR_MAX_BYTES = 1024 * 1024

# O tipo vem dos primeiros bytes do arquivo, não do nome nem do Content-Type
# (que o cliente escolhe como quiser)
AVATAR_SIGNATURES = {
    "image/png": lambda b: b.startswith(b"\x89PNG\r\n\x1a\n"),
    "image/jpeg": lambda b: b.startswith(b"\xff\xd8\xff"),
    "image/webp": lambda b: b[:4] == b"RIFF" and b[8:12] == b"WEBP",
}


def _check_current_password(request: Request, user: User, password: str | None, missing: str):
    """
    Confere a senha atual antes de mudar o login (e-mail ou senha), para quem
    pegou o computador com a conta aberta não conseguir tomar a conta.
    Conta como tentativa de login: mesmo limite contra adivinhação.
    Erro 400, e não 401: o frontend desloga em qualquer 401.
    """
    ip = request.client.host if request.client else "desconhecido"
    if login_limiter.retry_after(user.email, ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Muitas tentativas com a senha errada. Tente de novo mais tarde.",
        )
    if not password:
        raise HTTPException(status_code=400, detail=missing)
    if not verify_password(password, user.hashed_password):
        login_limiter.record_failure(user.email, ip)
        raise HTTPException(status_code=400, detail="Senha atual incorreta")


@router.patch("", response_model=UserOut)
def update_profile(
    payload: ProfileUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if payload.email != user.email:
        _check_current_password(
            request, user, payload.current_password, "Digite sua senha atual para trocar o e-mail"
        )
        if db.query(User).filter(User.email == payload.email).first():
            raise HTTPException(status_code=400, detail="E-mail já cadastrado")
        user.email = payload.email

    user.name = payload.name
    user.birth_date = payload.birth_date
    db.commit()
    db.refresh(user)
    return user


@router.put("/avatar", response_model=UserOut)
def upload_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    content = file.file.read(AVATAR_MAX_BYTES + 1)
    if len(content) > AVATAR_MAX_BYTES:
        raise HTTPException(status_code=400, detail="A foto pode ter no máximo 1 MB")

    content_type = next((t for t, matches in AVATAR_SIGNATURES.items() if matches(content)), None)
    if not content_type:
        raise HTTPException(status_code=400, detail="Envie uma foto em JPG, PNG ou WebP")

    user.avatar = content
    user.avatar_type = content_type
    db.commit()
    db.refresh(user)
    return user


@router.delete("/avatar", response_model=UserOut)
def delete_avatar(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    user.avatar = None
    user.avatar_type = None
    db.commit()
    db.refresh(user)
    return user


@router.post("/password", response_model=Token)
def change_password(
    payload: PasswordChange,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Troca a senha e devolve um token novo para esta sessão continuar logada.
    Os tokens emitidos antes (outros aparelhos) deixam de valer.
    """
    _check_current_password(request, user, payload.current_password, "Digite sua senha atual")
    if payload.new_password == payload.current_password:
        raise HTTPException(status_code=400, detail="A nova senha precisa ser diferente da atual")
    # Mesma regra do cadastro: mediana ou forte, nada óbvio, sem o e-mail
    message = weak_password_message(payload.new_password, user.email)
    if message:
        raise HTTPException(status_code=400, detail=message)

    now = datetime.now(timezone.utc)
    user.hashed_password = hash_password(payload.new_password)
    user.password_changed_at = now
    db.commit()
    return Token(access_token=create_access_token(user.id, issued_at=now))


@router.delete("", status_code=204, response_class=Response)
def delete_account(
    payload: AccountDelete,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Exclui a conta e todos os dados dela (extratos, transações, categorias e
    foto). Não tem volta. Pede a senha atual, como a troca de e-mail e senha.
    """
    _check_current_password(request, user, payload.password, "Digite sua senha para excluir a conta")

    # Apaga explicitamente, filhos antes dos pais: o SQLite não aplica o
    # ON DELETE CASCADE das chaves estrangeiras sem ligar o PRAGMA foreign_keys
    statement_ids = db.query(Statement.id).filter(Statement.user_id == user.id)
    db.query(Transaction).filter(Transaction.statement_id.in_(statement_ids.scalar_subquery())).delete(
        synchronize_session=False
    )
    db.query(Statement).filter(Statement.user_id == user.id).delete(synchronize_session=False)
    db.query(Category).filter(Category.user_id == user.id).delete(synchronize_session=False)
    db.delete(user)
    db.commit()
    return Response(status_code=204)
