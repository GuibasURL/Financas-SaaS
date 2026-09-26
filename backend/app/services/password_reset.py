"""
Links de "Esqueceu a senha?".

O código do link é aleatório (256 bits) e só o SHA-256 dele vai para o
banco. Um link vale PASSWORD_RESET_MINUTES e uma vez só; pedir outro
cancela os anteriores, e redefinir a senha apaga todos.
"""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.config import FRONTEND_URL, PASSWORD_RESET_MINUTES
from app.models.password_reset import PasswordResetToken
from app.models.user import User


def _hash(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def _utc(value: datetime) -> datetime:
    # O SQLite devolve a data sem fuso; ela foi gravada em UTC
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def create_reset_token(db: Session, user: User) -> str:
    """Cria um link novo (cancelando os anteriores) e devolve o código, que só vai no e-mail."""
    delete_reset_tokens(db, user.id)
    raw_token = secrets.token_urlsafe(32)
    db.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=_hash(raw_token),
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=PASSWORD_RESET_MINUTES),
        )
    )
    return raw_token


def find_valid_token(db: Session, raw_token: str) -> PasswordResetToken | None:
    """O link existe, não foi usado e não venceu? Senão, None (o motivo não importa para quem pede)."""
    row = db.query(PasswordResetToken).filter(PasswordResetToken.token_hash == _hash(raw_token)).first()
    if not row or row.used_at is not None:
        return None
    if _utc(row.expires_at) <= datetime.now(timezone.utc):
        return None
    return row


def delete_reset_tokens(db: Session, user_id: int) -> None:
    db.query(PasswordResetToken).filter(PasswordResetToken.user_id == user_id).delete(
        synchronize_session=False
    )


def reset_link(raw_token: str) -> str:
    return f"{FRONTEND_URL}/redefinir-senha?token={raw_token}"


def reset_email(raw_token: str) -> tuple[str, str]:
    """(assunto, texto) do e-mail de redefinição."""
    return (
        "Vexira: redefinir sua senha",
        "Olá!\n\n"
        "Recebemos um pedido para redefinir a senha da sua conta na Vexira. "
        "Para criar uma senha nova, abra o link abaixo:\n\n"
        f"{reset_link(raw_token)}\n\n"
        f"O link vale por {PASSWORD_RESET_MINUTES} minutos e só pode ser usado uma vez.\n\n"
        "Se não foi você que pediu, ignore este e-mail: sua senha continua a mesma.\n\n"
        "Vexira — Controle financeiro inteligente",
    )
