"""
Fixtures compartilhadas pelos testes.

Cada teste roda num banco SQLite em memória novinho, então os testes não
dependem uns dos outros nem encostam no financas.db de verdade.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401  (registra os models no Base.metadata)
from app.db import Base, get_db
from app.main import app
from app.models.category import Category

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


@pytest.fixture
def db_session():
    # StaticPool: todas as conexões usam o mesmo banco em memória
    # (sem ele, cada conexão nova veria um banco vazio).
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    session = TestingSession()
    yield session
    session.close()
    engine.dispose()


@pytest.fixture
def client(db_session):
    app.dependency_overrides[get_db] = lambda: db_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def categories(db_session):
    """Duas categorias com keywords, para testar a categorização automática."""
    alimentacao = Category(name="Alimentação", keywords="ifood,restaurante")
    transporte = Category(name="Transporte", keywords="uber,99")
    db_session.add_all([alimentacao, transporte])
    db_session.commit()
    return {"alimentacao": alimentacao, "transporte": transporte}


@pytest.fixture
def upload(client):
    """Faz upload de um CSV (conteúdo em texto) e devolve a resposta."""

    def _upload(content: str, filename: str = "extrato.csv"):
        return client.post(
            "/upload",
            files={"file": (filename, content.encode("utf-8"), "text/csv")},
        )

    return _upload
