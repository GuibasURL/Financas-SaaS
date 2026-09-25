from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.config import DATABASE_URL

# connect_args é necessário apenas para SQLite (permite uso em múltiplas threads)
connect_args = {"check_same_thread": False} if "sqlite" in DATABASE_URL else {}

# pool_pre_ping: testa a conexão antes de usar. O Postgres do deploy (Neon)
# "dorme" sem uso e derruba as conexões abertas; sem o teste, o primeiro
# pedido depois disso usaria uma conexão morta e daria erro 500.
engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependency do FastAPI: abre uma sessão de banco e garante que ela é fechada depois."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
