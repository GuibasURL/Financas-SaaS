"""Tela "Editar perfil": nome, e-mail, data de nascimento e foto do usuário logado."""
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.routers.auth import login_limiter
from app.schemas.user import ProfileUpdate, UserOut
from app.services.security import verify_password

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


@router.patch("", response_model=UserOut)
def update_profile(
    payload: ProfileUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if payload.email != user.email:
        # Trocar o e-mail muda o login: pede a senha, para quem pegou o
        # computador com a conta aberta não conseguir tomar a conta.
        # Conta como tentativa de login (mesmo limite contra adivinhação).
        # 400, e não 401: o frontend desloga em qualquer 401.
        ip = request.client.host if request.client else "desconhecido"
        if login_limiter.retry_after(user.email, ip):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Muitas tentativas com a senha errada. Tente de novo mais tarde.",
            )
        if not payload.current_password:
            raise HTTPException(status_code=400, detail="Digite sua senha atual para trocar o e-mail")
        if not verify_password(payload.current_password, user.hashed_password):
            login_limiter.record_failure(user.email, ip)
            raise HTTPException(status_code=400, detail="Senha atual incorreta")
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
