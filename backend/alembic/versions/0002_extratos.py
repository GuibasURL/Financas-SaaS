"""cria tabela statements (extratos) e liga as transações a ela

Cada upload de CSV vira um registro em statements. As transações
existentes são agrupadas pelo antigo source_file: um extrato por nome
de arquivo, com uploaded_at = created_at mais antigo do grupo.
Depois disso a coluna source_file é removida.

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-23

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

FK_NAME = "fk_transactions_statement_id_statements"


def upgrade() -> None:
    op.create_table(
        "statements",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("filename", sa.String(), nullable=False),
        sa.Column(
            "uploaded_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_statements_id", "statements", ["id"])

    with op.batch_alter_table("transactions") as batch:
        batch.add_column(sa.Column("statement_id", sa.Integer(), nullable=True))

    # Migra os dados: um extrato para cada source_file distinto.
    conn = op.get_bind()
    groups = conn.execute(
        sa.text(
            "SELECT source_file, MIN(created_at) FROM transactions GROUP BY source_file"
        )
    ).fetchall()
    for source_file, first_created_at in groups:
        statement_id = conn.execute(
            sa.text(
                "INSERT INTO statements (filename, uploaded_at) "
                "VALUES (:filename, COALESCE(:uploaded_at, CURRENT_TIMESTAMP)) "
                "RETURNING id"
            ),
            {"filename": source_file or "sem arquivo", "uploaded_at": first_created_at},
        ).scalar_one()
        if source_file is None:
            where, params = "source_file IS NULL", {}
        else:
            where, params = "source_file = :source_file", {"source_file": source_file}
        conn.execute(
            sa.text(f"UPDATE transactions SET statement_id = :sid WHERE {where}"),
            {"sid": statement_id, **params},
        )

    with op.batch_alter_table("transactions") as batch:
        batch.alter_column("statement_id", existing_type=sa.Integer(), nullable=False)
        batch.create_foreign_key(
            FK_NAME, "statements", ["statement_id"], ["id"], ondelete="CASCADE"
        )
        batch.create_index("ix_transactions_statement_id", ["statement_id"])
        batch.drop_column("source_file")


def downgrade() -> None:
    with op.batch_alter_table("transactions") as batch:
        batch.add_column(sa.Column("source_file", sa.String(), nullable=True))

    op.execute(
        "UPDATE transactions SET source_file = "
        "(SELECT filename FROM statements WHERE statements.id = transactions.statement_id)"
    )

    with op.batch_alter_table("transactions") as batch:
        batch.drop_index("ix_transactions_statement_id")
        batch.drop_constraint(FK_NAME, type_="foreignkey")
        batch.drop_column("statement_id")

    op.drop_index("ix_statements_id", table_name="statements")
    op.drop_table("statements")
