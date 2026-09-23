import os
from dotenv import load_dotenv

load_dotenv()

# Por padrão usa SQLite (arquivo local) para facilitar o começo.
# Quando quiser migrar para Postgres, basta trocar essa variável de ambiente:
# DATABASE_URL=postgresql://usuario:senha@localhost:5432/financas
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./financas.db")

# Chave usada para assinar os tokens JWT. O valor padrão serve só para
# desenvolvimento local: em produção defina SECRET_KEY com um valor longo e
# aleatório (ex: `python -c "import secrets; print(secrets.token_urlsafe(32))"`).
SECRET_KEY = os.getenv("SECRET_KEY", "dev-inseguro-troque-em-producao")

# Por quanto tempo o token de login vale (padrão: 1 dia)
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60 * 24))
