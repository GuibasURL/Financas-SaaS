from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.config import (
    LOGIN_MAX_FAILURES_PER_ACCOUNT,
    LOGIN_MAX_FAILURES_PER_IP,
    LOGIN_WINDOW_MINUTES,
    PASSWORD_RESET_MAX_PER_ACCOUNT,
    PASSWORD_RESET_MAX_PER_IP,
    REGISTER_MAX_PER_IP,
    REGISTER_WINDOW_MINUTES,
)
from app.db import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.user import (
    ForgotPassword,
    MessageOut,
    PasswordReset,
    Token,
    UserCreate,
    UserOut,
    normalize_email,
)
from app.services.client_ip import client_ip
from app.services.default_categories import add_default_categories
from app.services.email import send_email
from app.services.login_limiter import LoginLimiter
from app.services.password_policy import weak_password_message
from app.services.password_reset import (
    create_reset_token,
    delete_reset_tokens,
    find_valid_token,
    reset_email,
)
from app.services.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])

# Hash de uma senha qualquer, para conferir quando o e-mail não existe: o
# bcrypt é lento de propósito, e responder rápido só nesse caso revelaria
# pelo tempo de resposta quais e-mails têm conta
_DUMMY_HASH = hash_password("senha-que-nao-e-de-ninguem")

login_limiter = LoginLimiter(
    max_per_account=LOGIN_MAX_FAILURES_PER_ACCOUNT,
    max_per_ip=LOGIN_MAX_FAILURES_PER_IP,
    window_seconds=LOGIN_WINDOW_MINUTES * 60,
)

# Pedidos de "Esqueceu a senha?": cada pedido conta, com ou sem conta no e-mail
reset_limiter = LoginLimiter(
    max_per_account=PASSWORD_RESET_MAX_PER_ACCOUNT,
    max_per_ip=PASSWORD_RESET_MAX_PER_IP,
    window_seconds=LOGIN_WINDOW_MINUTES * 60,
)

# Cadastros: só o IP importa (cada tentativa costuma ser com um e-mail
# diferente), então o limite "por conta" é o mesmo do IP e nunca estoura antes
register_limiter = LoginLimiter(
    max_per_account=REGISTER_MAX_PER_IP,
    max_per_ip=REGISTER_MAX_PER_IP,
    window_seconds=REGISTER_WINDOW_MINUTES * 60,
)

FORGOT_PASSWORD_MESSAGE = (
    "Se houver uma conta com esse e-mail, enviamos um link para criar uma senha nova. "
    "Confira também a caixa de spam."
)
INVALID_RESET_LINK = 'Este link é inválido ou já expirou. Peça um novo em "Esqueceu a senha?".'


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, request: Request, db: Session = Depends(get_db)):
    """
    Cria a conta. Depois de REGISTER_MAX_PER_IP tentativas do mesmo IP na
    janela, responde 429 por um tempo (header `Retry-After`, em segundos).
    """
    ip = client_ip(request)
    wait = register_limiter.retry_after("", ip)
    if wait:
        minutes = max(1, round(wait / 60))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                "Muitos cadastros a partir desta conexão. "
                f"Tente de novo em {minutes} minuto{'s' if minutes > 1 else ''}."
            ),
            headers={"Retry-After": str(wait)},
        )
    # Conta com ou sem sucesso: quem testa e-mails recebe "já cadastrado", e
    # quem cria contas em massa recebe 201; os dois precisam parar
    register_limiter.record_failure("", ip)

    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="E-mail já cadastrado")

    user = User(email=payload.email, hashed_password=hash_password(payload.password))
    db.add(user)
    db.flush()  # gera o user.id
    # Conta nova já nasce com as categorias sugeridas: o primeiro extrato
    # enviado já sai categorizado, sem precisar configurar nada
    add_default_categories(db, user.id)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(
    request: Request,
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """
    Recebe e-mail (no campo `username`, padrão do OAuth2) e senha como
    form-data e devolve um token JWT para mandar no header
    `Authorization: Bearer <token>`.

    Depois de várias tentativas erradas, responde 429 por um tempo (header
    `Retry-After`, em segundos), mesmo que a senha certa seja enviada.
    """
    email = normalize_email(form.username)
    ip = client_ip(request)

    wait = login_limiter.retry_after(email, ip)
    if wait:
        minutes = max(1, round(wait / 60))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                "Muitas tentativas de login. "
                f"Tente de novo em {minutes} minuto{'s' if minutes > 1 else ''}."
            ),
            headers={"Retry-After": str(wait)},
        )

    user = db.query(User).filter(User.email == email).first()
    # Mesma mensagem (e mesmo tempo) para e-mail inexistente e senha errada,
    # para não revelar quais e-mails têm cadastro.
    password_ok = verify_password(form.password, user.hashed_password if user else _DUMMY_HASH)
    if not user or not password_ok:
        login_limiter.record_failure(email, ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha incorretos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    login_limiter.record_success(email, ip)
    return Token(access_token=create_access_token(user.id))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.post("/forgot-password", response_model=MessageOut)
def forgot_password(
    payload: ForgotPassword,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Manda por e-mail um link para criar uma senha nova. A resposta é sempre
    a mesma, com ou sem conta no e-mail, para não revelar quem tem cadastro;
    o e-mail sai em segundo plano, então o tempo de resposta também não revela.
    """
    email = normalize_email(payload.email)
    ip = client_ip(request)
    wait = reset_limiter.retry_after(email, ip)
    if wait:
        minutes = max(1, round(wait / 60))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                "Muitos pedidos de redefinição de senha. "
                f"Tente de novo em {minutes} minuto{'s' if minutes > 1 else ''}."
            ),
            headers={"Retry-After": str(wait)},
        )
    reset_limiter.record_failure(email, ip)

    user = db.query(User).filter(User.email == email).first()
    if user:
        raw_token = create_reset_token(db, user)
        db.commit()
        subject, text = reset_email(raw_token)
        background_tasks.add_task(send_email, user.email, subject, text)
    return MessageOut(message=FORGOT_PASSWORD_MESSAGE)


@router.post("/reset-password", response_model=MessageOut)
def reset_password(payload: PasswordReset, db: Session = Depends(get_db)):
    """
    Troca a senha pelo link do e-mail. O link deixa de valer, e todas as
    sessões abertas caem (como na troca de senha pelo perfil).
    """
    reset = find_valid_token(db, payload.token)
    if not reset:
        raise HTTPException(status_code=400, detail=INVALID_RESET_LINK)
    user = db.get(User, reset.user_id)

    # Mesma regra do cadastro: mediana ou forte, nada óbvio, sem o e-mail
    message = weak_password_message(payload.new_password, user.email)
    if message:
        raise HTTPException(status_code=400, detail=message)

    user.hashed_password = hash_password(payload.new_password)
    user.password_changed_at = datetime.now(timezone.utc)
    delete_reset_tokens(db, user.id)
    db.commit()
    return MessageOut(message="Senha redefinida. Entre com a senha nova.")
