from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.config import (
    LOGIN_MAX_FAILURES_PER_ACCOUNT,
    LOGIN_MAX_FAILURES_PER_IP,
    LOGIN_WINDOW_MINUTES,
)
from app.db import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.user import Token, UserCreate, UserOut, normalize_email
from app.services.default_categories import add_default_categories
from app.services.login_limiter import LoginLimiter
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


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)):
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
    # Atrás de um proxy (deploy), o IP real só chega aqui se o uvicorn rodar
    # com --proxy-headers; sem isso, todos pareceriam vir do mesmo IP
    ip = request.client.host if request.client else "desconhecido"

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
