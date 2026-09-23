"""adiciona categories.ignore_in_reports

Permite marcar categorias cujas transações não entram nos gráficos (ex:
pagamento de fatura do cartão, que contaria o gasto duas vezes junto com
as compras da fatura). Categorias existentes ficam com false.

Revision ID: 0004
Revises: 0003
Create Date: 2026-09-23

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("categories") as batch:
        batch.add_column(
            sa.Column(
                "ignore_in_reports",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("categories") as batch:
        batch.drop_column("ignore_in_reports")
