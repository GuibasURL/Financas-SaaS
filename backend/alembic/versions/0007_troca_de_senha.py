"""adiciona users.password_changed_at

Guarda quando a senha foi trocada pela última vez: tokens emitidos antes
disso deixam de valer, então trocar a senha encerra as sessões abertas em
outros aparelhos. Contas existentes ficam com NULL (nenhuma troca ainda).

Revision ID: 0007
Revises: 0006
Create Date: 2026-09-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.add_column(sa.Column("password_changed_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.drop_column("password_changed_at")
