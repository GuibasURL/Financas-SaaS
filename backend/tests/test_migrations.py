"""Garante que as migrations do Alembic batem com os models."""
from pathlib import Path

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import create_engine, text

import app.models  # noqa: F401  (registra os models no Base.metadata)
from app.db import Base
from tests.conftest import TEST_DATABASE_URL

BACKEND_DIR = Path(__file__).resolve().parent.parent


def _reset_postgres(db_url: str):
    engine = create_engine(db_url)
    with engine.begin() as connection:
        connection.execute(text("DROP SCHEMA public CASCADE"))
        connection.execute(text("CREATE SCHEMA public"))
    engine.dispose()


@pytest.fixture(params=["sqlite", "postgres"])
def db_url(request, tmp_path):
    """Banco vazio: SQLite sempre; Postgres quando há TEST_DATABASE_URL (no CI)."""
    if request.param == "sqlite":
        yield f"sqlite:///{tmp_path / 'test.db'}"
        return
    if not TEST_DATABASE_URL:
        pytest.skip("sem TEST_DATABASE_URL: migrations testadas só no SQLite")
    _reset_postgres(TEST_DATABASE_URL)
    yield TEST_DATABASE_URL
    _reset_postgres(TEST_DATABASE_URL)


def _alembic_config(db_url: str) -> Config:
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    config.set_main_option("sqlalchemy.url", db_url)
    return config


def test_migrations_geram_o_mesmo_schema_dos_models(db_url):
    command.upgrade(_alembic_config(db_url), "head")

    engine = create_engine(db_url)
    with engine.connect() as connection:
        # compare_type: também acusa coluna com tipo diferente (ex: Numeric x Float)
        context = MigrationContext.configure(connection, opts={"compare_type": True})
        diff = compare_metadata(context, Base.metadata)
    engine.dispose()

    assert diff == [], f"Models e migrations divergem: {diff}"


def test_migration_de_usuarios_preserva_dados_existentes(db_url):
    config = _alembic_config(db_url)
    command.upgrade(config, "0002")

    engine = create_engine(db_url)
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO categories (name, keywords) VALUES ('Mercado', '')"))
        connection.execute(text("INSERT INTO statements (filename) VALUES ('antigo.csv')"))
        connection.execute(
            text(
                "INSERT INTO transactions (date, description, amount, statement_id) "
                "VALUES ('2025-01-05', 'PADARIA', -10, 1)"
            )
        )

    command.upgrade(config, "head")

    with engine.connect() as connection:
        assert connection.execute(text("SELECT name, user_id FROM categories")).all() == [
            ("Mercado", None)
        ]
        assert connection.execute(text("SELECT filename, user_id FROM statements")).all() == [
            ("antigo.csv", None)
        ]
        assert connection.execute(text("SELECT COUNT(*) FROM transactions")).scalar() == 1
    engine.dispose()


def test_migrations_podem_ser_desfeitas(db_url):
    config = _alembic_config(db_url)

    command.upgrade(config, "head")
    command.downgrade(config, "base")
    command.upgrade(config, "head")
