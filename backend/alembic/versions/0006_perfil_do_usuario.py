"""adiciona o perfil do usuário: nome, data de nascimento e foto

Tudo opcional: as contas que já existem continuam iguais até o usuário
preencher a tela "Editar perfil". A foto fica no próprio banco (bytes +
tipo), para o deploy não depender de um disco para arquivos.

Revision ID: 0006
Revises: 0005
Create Date: 2026-09-23

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.add_column(sa.Column("name", sa.String(length=100), nullable=True))
        batch.add_column(sa.Column("birth_date", sa.Date(), nullable=True))
        batch.add_column(sa.Column("avatar", sa.LargeBinary(), nullable=True))
        batch.add_column(sa.Column("avatar_type", sa.String(length=20), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.drop_column("avatar_type")
        batch.drop_column("avatar")
        batch.drop_column("birth_date")
        batch.drop_column("name")
