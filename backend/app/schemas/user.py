import re
from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

from app.services.password_policy import weak_password_message

# Validação simples de propósito: só garante o formato "algo@algo.algo".
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def normalize_email(email: str) -> str:
    return email.strip().lower()


class UserCreate(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        value = normalize_email(value)
        if not EMAIL_PATTERN.match(value):
            raise ValueError("E-mail inválido")
        return value

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
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
