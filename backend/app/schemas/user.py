import re
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

from app.config import APP_TIMEZONE
from app.services.password_policy import weak_password_message

# Validação simples de propósito: só garante o formato "algo@algo.algo".
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

NAME_MAX_LENGTH = 100


def normalize_email(email: str) -> str:
    return email.strip().lower()


def _validate_email(value: str) -> str:
    value = normalize_email(value)
    if not EMAIL_PATTERN.match(value):
        raise ValueError("E-mail inválido")
    return value


def today() -> date:
    # No fuso do app: com o servidor em UTC, às 21h já seria o dia seguinte
    return datetime.now(APP_TIMEZONE).date()


class UserCreate(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return _validate_email(value)

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        # O bcrypt só aceita até 72 bytes
        if len(value.encode("utf-8")) > 72:
            raise ValueError("A senha pode ter no máximo 72 bytes")
        return value

    @model_validator(mode="after")
    def validate_password_strength(self) -> "UserCreate":
        # Depois dos campos, porque precisa do e-mail: a senha não pode contê-lo.
        # Mediana ou forte: 8+ caracteres, 3 dos 4 tipos e nada óbvio.
        message = weak_password_message(self.password, self.email)
        if message:
            raise ValueError(message)
        return self


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    name: str | None = None
    birth_date: date | None = None
    # Foto como data URL ("data:image/png;base64,..."), ou None sem foto
    avatar_url: str | None = None
    created_at: datetime


class ProfileUpdate(BaseModel):
    """Dados da tela "Editar perfil" (a foto tem rota própria)."""

    name: str
    email: str
    birth_date: date | None = None
    # Só é exigida para trocar o e-mail
    current_password: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        value = " ".join(value.split())
        if len(value) < 2:
            raise ValueError("Informe seu nome")
        if len(value) > NAME_MAX_LENGTH:
            raise ValueError(f"O nome pode ter no máximo {NAME_MAX_LENGTH} caracteres")
        return value

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return _validate_email(value)

    @field_validator("birth_date")
    @classmethod
    def validate_birth_date(cls, value: date | None) -> date | None:
        if value is None:
            return None
        if value > today():
            raise ValueError("A data de nascimento não pode ser no futuro")
        if value.year < 1900:
            raise ValueError("Data de nascimento inválida")
        return value


class PasswordChange(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, value: str) -> str:
        # O bcrypt só aceita até 72 bytes. A força é conferida na rota,
        # que precisa do e-mail do usuário (a senha não pode contê-lo).
        if len(value.encode("utf-8")) > 72:
            raise ValueError("A senha pode ter no máximo 72 bytes")
        return value


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
