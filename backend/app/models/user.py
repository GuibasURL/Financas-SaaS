from base64 import b64encode
from datetime import datetime, timedelta, timezone

from sqlalchemy import Column, Date, DateTime, Integer, LargeBinary, String
from sqlalchemy.orm import deferred
from sqlalchemy.sql import func

from app.db import Base

# Diferença tolerada entre o relógio do banco e o da API
CLOCK_SKEW = timedelta(minutes=5)


def _utc(value: datetime) -> datetime:
    # O SQLite devolve a data sem fuso; ela foi gravada em UTC
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, nullable=False, unique=True, index=True)  # sempre minúsculo
    hashed_password = Column(String, nullable=False)  # hash bcrypt, nunca a senha
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    # Última troca de senha: tokens emitidos antes dela deixam de valer
    password_changed_at = Column(DateTime(timezone=True), nullable=True)

    # Perfil (opcionais: contas antigas e recém-criadas começam sem)
    name = Column(String(100), nullable=True)
    birth_date = Column(Date, nullable=True)
    # Foto do perfil guardada no próprio banco (o navegador já manda reduzida).
    # deferred: só é lida quando usada, não em toda requisição autenticada.
    avatar = deferred(Column(LargeBinary, nullable=True))
    avatar_type = Column(String(20), nullable=True)  # "image/png", "image/jpeg"...

    def token_is_current(self, issued_at: datetime | None) -> bool:
        """O token foi emitido para esta conta, e depois da última troca de senha (se houve alguma)?"""
        # Token de antes de a conta existir era de uma conta excluída com o
        # mesmo id (o SQLite reaproveita o id): não abre a conta nova. Com
        # folga, porque o created_at vem do relógio do banco, e o "iat" do da API.
        if issued_at is not None and self.created_at is not None:
            if issued_at < _utc(self.created_at) - CLOCK_SKEW:
                return False
        if self.password_changed_at is None:
            return True
        if issued_at is None:
            return False
        # O "iat" do token só tem segundos inteiros
        return issued_at >= _utc(self.password_changed_at).replace(microsecond=0)

    @property
    def avatar_url(self) -> str | None:
        """A foto como data URL, pronta para o <img src> do frontend."""
        if not self.avatar_type:
            return None
        return f"data:{self.avatar_type};base64,{b64encode(self.avatar).decode()}"
