import logging
import os
from typing import Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

def normalize_database_url(url: str) -> str:
    """
    Os provedores de Postgres (Neon, Render, Railway...) entregam o endereço
    como "postgres://" ou "postgresql://". O SQLAlchemy lê os dois como o driver
    antigo (psycopg2, que nem está instalado): aqui vira o psycopg 3.
        "postgres://u:s@host/db" -> "postgresql+psycopg://u:s@host/db"
    Endereços com o driver escolhido (ou SQLite) ficam como estão.
    """
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


# Por padrão usa SQLite (arquivo local) para facilitar o começo. No deploy,
# DATABASE_URL aponta para o Postgres, no formato que o provedor entregar:
# DATABASE_URL=postgresql://usuario:senha@host:5432/vexira
DATABASE_URL = normalize_database_url(os.getenv("DATABASE_URL", "sqlite:///./financas.db"))

# Chave usada para assinar os tokens JWT. Quem a conhece consegue forjar um
# token de qualquer usuário, então em produção ela precisa ser secreta e
# aleatória: python -c "import secrets; print(secrets.token_urlsafe(32))"
DEV_SECRET_KEY = "dev-inseguro-nao-use-em-producao-troque-a-secret-key"
MIN_SECRET_KEY_BYTES = 32  # mínimo recomendado para HS256 (RFC 7518)


LOCAL_HOSTS = {"localhost", "127.0.0.1", "[::1]"}


def is_public_origin(origin: str) -> bool:
    """ "https://vexira.com.br" -> True; "http://localhost:5173" -> False"""
    host = origin.split("://", 1)[-1].split("/", 1)[0]
    # Tira a porta: "[::1]:5173" -> "[::1]" (IPv6), "localhost:5173" -> "localhost"
    host = host[: host.find("]") + 1] if host.startswith("[") else host.split(":", 1)[0]
    return host.lower() not in LOCAL_HOSTS


def load_secret_key(value: Optional[str], cors_origins: Optional[list[str]] = None) -> str:
    """
    Sem SECRET_KEY definida, usa a chave de desenvolvimento (pública, no
    código) e avisa no log. Com uma chave curta demais, recusa subir.

    Se o frontend liberado no CORS for público (não localhost), a API está
    publicada: aí a chave de desenvolvimento deixaria qualquer um forjar o
    login de qualquer usuário, então a API se recusa a subir.
    """
    public = [o for o in cors_origins or [] if is_public_origin(o)]
    if public and (not value or value == DEV_SECRET_KEY):
        raise ValueError(
            f"SECRET_KEY é obrigatória com o frontend público ({public[0]}): com a chave de "
            "desenvolvimento, qualquer um conseguiria forjar o login de qualquer usuário. "
            'Gere uma com: python -c "import secrets; print(secrets.token_urlsafe(32))"'
        )
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



# Por quanto tempo o token de login vale (padrão: 1 dia)
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60 * 24))


def parse_cors_origins(value: Optional[str]) -> list[str]:
    """ "https://a.com, https://b.com" -> ["https://a.com", "https://b.com"] """
    origins = [o.strip().rstrip("/") for o in (value or "").split(",") if o.strip()]
    return origins or ["http://localhost:5173"]


# Endereços do frontend que podem chamar a API (separados por vírgula).
# Padrão: o Vite local. Em produção, o endereço público do frontend.
CORS_ORIGINS = parse_cors_origins(os.getenv("CORS_ORIGINS"))

# Depois do CORS: com frontend público, a chave de desenvolvimento é recusada
SECRET_KEY = load_secret_key(os.getenv("SECRET_KEY"), CORS_ORIGINS)


def load_timezone(value: Optional[str]) -> ZoneInfo:
    """Fuso usado nos horários mostrados ao usuário. Nome inválido impede a API de subir."""
    name = value or "America/Sao_Paulo"
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError) as err:
        raise ValueError(
            f'APP_TIMEZONE "{name}" não é um fuso válido. Use um nome como "America/Sao_Paulo".'
        ) from err


# Fuso dos horários gerados pela API (ex: "Gerado em" do relatório). O
# servidor em produção costuma rodar em UTC, 3h à frente do horário de Brasília.
APP_TIMEZONE = load_timezone(os.getenv("APP_TIMEZONE"))

# Limite de tentativas de login erradas, contra quem tenta adivinhar senhas.
# Por e-mail + IP (quem erra a própria senha) e por IP (quem testa vários e-mails).
LOGIN_WINDOW_MINUTES = int(os.getenv("LOGIN_WINDOW_MINUTES", 15))
LOGIN_MAX_FAILURES_PER_ACCOUNT = int(os.getenv("LOGIN_MAX_FAILURES_PER_ACCOUNT", 5))
LOGIN_MAX_FAILURES_PER_IP = int(os.getenv("LOGIN_MAX_FAILURES_PER_IP", 30))

# ---------- "Esqueceu a senha?" ----------

# Endereço do site, para montar o link do e-mail (padrão: o primeiro do CORS)
FRONTEND_URL = (os.getenv("FRONTEND_URL") or CORS_ORIGINS[0]).rstrip("/")
# Validade do link de redefinição
PASSWORD_RESET_MINUTES = int(os.getenv("PASSWORD_RESET_MINUTES", 30))
# Pedidos de link por e-mail e por IP, na janela do login (contra quem
# tenta encher a caixa de alguém ou usar a API para mandar spam)
PASSWORD_RESET_MAX_PER_ACCOUNT = int(os.getenv("PASSWORD_RESET_MAX_PER_ACCOUNT", 3))
PASSWORD_RESET_MAX_PER_IP = int(os.getenv("PASSWORD_RESET_MAX_PER_IP", 10))

# Envio de e-mail por SMTP (funciona com qualquer provedor: Gmail, Brevo,
# Resend, SendGrid...). Sem SMTP_HOST, nenhum e-mail sai: em ambiente local,
# o link aparece no log da API, para testar.
SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", "Vexira <nao-responda@vexira.local>")
# "starttls" (porta 587, o comum), "ssl" (porta 465) ou "none" (servidor local de teste)
SMTP_SECURITY = os.getenv("SMTP_SECURITY", "starttls")
