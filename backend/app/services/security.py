"""
Hash de senha (bcrypt) e tokens de acesso (JWT).

O token só carrega o id do usuário ("sub"), quando foi emitido ("iat") e a
validade ("exp"); é assinado com SECRET_KEY, então o backend consegue confiar
nele sem guardar sessão. O "iat" serve para derrubar os tokens emitidos antes
de uma troca de senha (ver dependencies.get_current_user).
"""
from datetime import datetime, timedelta, timezone
from typing import NamedTuple, Optional

import bcrypt
import jwt

from app.config import ACCESS_TOKEN_EXPIRE_MINUTES, SECRET_KEY

ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed_password.encode("utf-8"))


class AccessToken(NamedTuple):
    user_id: int
    # None nos tokens emitidos antes de o "iat" existir
    issued_at: Optional[datetime]


def create_access_token(
    user_id: int,
    expires_delta: Optional[timedelta] = None,
    issued_at: Optional[datetime] = None,
) -> str:
    now = issued_at or datetime.now(timezone.utc)
    expires_at = now + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    return jwt.encode(
        {"sub": str(user_id), "iat": now, "exp": expires_at}, SECRET_KEY, algorithm=ALGORITHM
    )


def decode_access_token(token: str) -> Optional[AccessToken]:
    """Retorna o dono e a emissão do token, ou None se for inválido/expirado."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        issued_at = payload.get("iat")
        return AccessToken(
            user_id=int(payload["sub"]),
            issued_at=datetime.fromtimestamp(issued_at, timezone.utc) if issued_at else None,
        )
    except (jwt.InvalidTokenError, KeyError, ValueError):
        return None
