import os
from dotenv import load_dotenv

load_dotenv()

# Por padrão usa SQLite (arquivo local) para facilitar o começo.
# Quando quiser migrar para Postgres, basta trocar essa variável de ambiente:
# DATABASE_URL=postgresql://usuario:senha@localhost:5432/financas
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./financas.db")
