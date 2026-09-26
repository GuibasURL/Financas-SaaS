"""adiciona categories.direction

Permite que a regra de uma categoria valha só para entradas ("in") ou só
para saídas ("out"): o mesmo texto ("PIX TRANSF MARIA") aparece nos dois
sentidos, e é o sinal do valor que diz se o dinheiro entrou ou saiu.
Categorias existentes ficam com "all" (como antes: vale para as duas).

Revision ID: 0005
Revises: 0004
Create Date: 2026-09-23

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("categories") as batch:
        batch.add_column(
            sa.Column("direction", sa.String(length=3), nullable=False, server_default="all")
        )


def downgrade() -> None:
    with op.batch_alter_table("categories") as batch:
        batch.drop_column("direction")
