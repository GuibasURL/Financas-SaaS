import logging
import os
from typing import Optional

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Por padrão usa SQLite (arquivo local) para facilitar o começo.
# Quando quiser migrar para Postgres, basta trocar essa variável de ambiente:
# DATABASE_URL=postgresql://usuario:senha@localhost:5432/financas
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./financas.db")

# Chave usada para assinar os tokens JWT. Quem a conhece consegue forjar um
# token de qualquer usuário, então em produção ela precisa ser secreta e
# aleatória: python -c "import secrets; print(secrets.token_urlsafe(32))"
DEV_SECRET_KEY = "dev-inseguro-nao-use-em-producao-troque-a-secret-key"
MIN_SECRET_KEY_BYTES = 32  # mínimo recomendado para HS256 (RFC 7518)


def load_secret_key(value: Optional[str]) -> str:
    """
    Sem SECRET_KEY definida, usa a chave de desenvolvimento (pública, no
    código) e avisa no log. Com uma chave curta demais, recusa subir.
    """
    if not value:
        logger.warning(
            "SECRET_KEY não definida: usando a chave de desenvolvimento. "
            "Qualquer um pode forjar tokens com ela; defina SECRET_KEY antes de publicar a API."
        )
        return DEV_SECRET_KEY
    if len(value.encode("utf-8")) < MIN_SECRET_KEY_BYTES:
        raise ValueError(
            f"SECRET_KEY precisa ter pelo menos {MIN_SECRET_KEY_BYTES} bytes. "
            'Gere uma com: python -c "import secrets; print(secrets.token_urlsafe(32))"'
        )
    return value


SECRET_KEY = load_secret_key(os.getenv("SECRET_KEY"))

# Por quanto tempo o token de login vale (padrão: 1 dia)
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60 * 24))


def parse_cors_origins(value: Optional[str]) -> list[str]:
    """ "https://a.com, https://b.com" -> ["https://a.com", "https://b.com"] """
    origins = [o.strip().rstrip("/") for o in (value or "").split(",") if o.strip()]
    return origins or ["http://localhost:5173"]


# Endereços do frontend que podem chamar a API (separados por vírgula).
# Padrão: o Vite local. Em produção, o endereço público do frontend.
CORS_ORIGINS = parse_cors_origins(os.getenv("CORS_ORIGINS"))
