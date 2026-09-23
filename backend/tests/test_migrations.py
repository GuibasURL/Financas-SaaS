"""Garante que as migrations do Alembic batem com os models."""
from pathlib import Path

from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import create_engine

import app.models  # noqa: F401  (registra os models no Base.metadata)
from app.db import Base

BACKEND_DIR = Path(__file__).resolve().parent.parent


def _alembic_config(db_url: str) -> Config:
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    config.set_main_option("sqlalchemy.url", db_url)
    return config


def test_migrations_geram_o_mesmo_schema_dos_models(tmp_path):
    db_url = f"sqlite:///{tmp_path / 'test.db'}"
    command.upgrade(_alembic_config(db_url), "head")

    engine = create_engine(db_url)
    with engine.connect() as connection:
        diff = compare_metadata(MigrationContext.configure(connection), Base.metadata)
    engine.dispose()

    assert diff == [], f"Models e migrations divergem: {diff}"


def test_migrations_podem_ser_desfeitas(tmp_path):
    config = _alembic_config(f"sqlite:///{tmp_path / 'test.db'}")

    command.upgrade(config, "head")
    command.downgrade(config, "base")
    command.upgrade(config, "head")
