"""
Fixtures compartilhadas pelos testes.

Cada teste roda num banco SQLite em memória novinho, então os testes não
dependem uns dos outros nem encostam no financas.db de verdade.

- `client`: autenticado como `user` (o padrão da maioria dos testes)
- `other_client`: autenticado como `other_user` (testes de isolamento)
- `anon_client`: sem token
"""
import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401  (registra os models no Base.metadata)
from app.db import Base, get_db
from app.main import app
from app.models.category import Category
from app.models.user import User
from app.routers.auth import login_limiter, reset_limiter
from app.services.security import create_access_token, hash_password

PASSWORD = "senha-forte-123"
# bcrypt é lento de propósito; calcula o hash uma vez só para todos os testes
PASSWORD_HASH = hash_password(PASSWORD)

CSV_JANEIRO = """data,descricao,valor
2025-01-05,IFOOD *RESTAURANTE XYZ,-45.90
2025-01-06,SALARIO EMPRESA,5000.00
2025-01-10,UBER TRIP,-20.00
2025-01-15,FARMACIA,-30.10
"""

CSV_FEVEREIRO = """data,descricao,valor
2025-02-03,IFOOD *PIZZARIA,-60.00
2025-02-20,UBER TRIP,-15.50
"""


def upload_csv(client: TestClient, content: str, filename: str = "extrato.csv"):
    """Faz upload de um CSV (conteúdo em texto) e devolve a resposta."""
    return client.post(
        "/upload",
        files={"file": (filename, content.encode("utf-8"), "text/csv")},
    )


@pytest.fixture(autouse=True)
def reset_login_limiter():
    # O limite de tentativas de login fica em memória: não passa de um teste para outro
    login_limiter.reset()
    reset_limiter.reset()
    yield
    login_limiter.reset()
    reset_limiter.reset()


# Com TEST_DATABASE_URL (ex: postgresql+psycopg://usuario@localhost/vexira_test),
# os testes rodam nesse banco em vez do SQLite em memória: o CI usa isso para
# rodar tudo também no Postgres, o banco do deploy. O banco é apagado e
# recriado a cada teste, então use um banco só para isso.
TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")


def _test_engine():
    if TEST_DATABASE_URL:
        engine = create_engine(TEST_DATABASE_URL)
        Base.metadata.drop_all(engine)
        return engine
    # StaticPool: todas as conexões usam o mesmo banco em memória
    # (sem ele, cada conexão nova veria um banco vazio).
    return create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )


@pytest.fixture
def db_session():
    engine = _test_engine()
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    session = TestingSession()
    app.dependency_overrides[get_db] = lambda: session
    yield session
    app.dependency_overrides.clear()
    session.close()
    if TEST_DATABASE_URL:
        Base.metadata.drop_all(engine)
    engine.dispose()


def _create_user(db_session, email: str) -> User:
    user = User(email=email, hashed_password=PASSWORD_HASH)
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def user(db_session):
    return _create_user(db_session, "ana@teste.com")


@pytest.fixture
def other_user(db_session):
    return _create_user(db_session, "bruno@teste.com")


def _client(token: str | None = None):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    with TestClient(app, headers=headers) as test_client:
        yield test_client


@pytest.fixture
def anon_client(db_session):
    yield from _client()


@pytest.fixture
def client(user):
    yield from _client(create_access_token(user.id))


@pytest.fixture
def other_client(other_user):
    yield from _client(create_access_token(other_user.id))


@pytest.fixture
def categories(db_session, user):
    """Duas categorias de `user` com keywords, para testar a categorização automática."""
    alimentacao = Category(name="Alimentação", keywords="ifood,restaurante", user_id=user.id)
    transporte = Category(name="Transporte", keywords="uber,99", user_id=user.id)
    db_session.add_all([alimentacao, transporte])
    db_session.commit()
    return {"alimentacao": alimentacao, "transporte": transporte}


@pytest.fixture
def upload(client):
    """upload_csv já ligado ao `client` (usuário padrão)."""

    def _upload(content: str, filename: str = "extrato.csv"):
        return upload_csv(client, content, filename)

    return _upload
