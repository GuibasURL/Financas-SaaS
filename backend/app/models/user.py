from base64 import b64encode
from datetime import datetime, timezone

from sqlalchemy import Column, Date, DateTime, Integer, LargeBinary, String
from sqlalchemy.orm import deferred
from sqlalchemy.sql import func

from app.db import Base


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
        """O token foi emitido depois da última troca de senha (se houve alguma)?"""
        if self.password_changed_at is None:
            return True
        if issued_at is None:
            return False
        changed = self.password_changed_at
        # O SQLite devolve a data sem fuso; ela foi gravada em UTC
        if changed.tzinfo is None:
            changed = changed.replace(tzinfo=timezone.utc)
        # O "iat" do token só tem segundos inteiros
        return issued_at >= changed.replace(microsecond=0)

    @property
    def avatar_url(self) -> str | None:
        """A foto como data URL, pronta para o <img src> do frontend."""
        if not self.avatar_type:
            return None
        return f"data:{self.avatar_type};base64,{b64encode(self.avatar).decode()}"
