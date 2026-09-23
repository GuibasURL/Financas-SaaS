"""cria tabela users e liga extratos e categorias a um usuário

Extratos e categorias ganham user_id (as transações pertencem ao usuário
através do extrato). Os dados que já existiam ficam com user_id NULL, sem
dono e invisíveis na API, até serem atribuídos ao primeiro usuário com
`python -m app.create_user <email>`.

O nome da categoria deixa de ser único no sistema todo e passa a ser único
por usuário.

Revision ID: 0003
Revises: 0002
Create Date: 2026-09-23

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# A constraint UNIQUE(name) da 0001 foi criada sem nome. No SQLite o batch
# mode precisa de um nome para achá-la, e esta convenção dá esse nome na
# hora de ler a tabela. No Postgres ela recebe o nome padrão do banco.
SQLITE_NAMING = {"uq": "uq_%(table_name)s_%(column_0_name)s"}
OLD_UNIQUE_NAME = {"sqlite": "uq_categories_name", "postgresql": "categories_name_key"}


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("hashed_password", sa.String(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_id", "users", ["id"])
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    with op.batch_alter_table("statements") as batch:
        batch.add_column(sa.Column("user_id", sa.Integer(), nullable=True))
        batch.create_foreign_key(
            "fk_statements_user_id_users", "users", ["user_id"], ["id"], ondelete="CASCADE"
        )
        batch.create_index("ix_statements_user_id", ["user_id"])

    dialect = op.get_bind().dialect.name
    with op.batch_alter_table("categories", naming_convention=SQLITE_NAMING) as batch:
        batch.add_column(sa.Column("user_id", sa.Integer(), nullable=True))
        batch.create_foreign_key(
            "fk_categories_user_id_users", "users", ["user_id"], ["id"], ondelete="CASCADE"
        )
        batch.create_index("ix_categories_user_id", ["user_id"])
        batch.drop_constraint(OLD_UNIQUE_NAME.get(dialect, "uq_categories_name"), type_="unique")
        batch.create_unique_constraint("uq_categories_user_id_name", ["user_id", "name"])


def downgrade() -> None:
    # Atenção: falha se dois usuários tiverem categorias com o mesmo nome,
    # porque o nome volta a ser único no sistema todo.
    with op.batch_alter_table("categories") as batch:
        batch.drop_constraint("uq_categories_user_id_name", type_="unique")
        batch.create_unique_constraint("uq_categories_name", ["name"])
        batch.drop_index("ix_categories_user_id")
        batch.drop_constraint("fk_categories_user_id_users", type_="foreignkey")
        batch.drop_column("user_id")

    with op.batch_alter_table("statements") as batch:
        batch.drop_index("ix_statements_user_id")
        batch.drop_constraint("fk_statements_user_id_users", type_="foreignkey")
        batch.drop_column("user_id")

    op.drop_index("ix_users_email", table_name="users")
    op.drop_index("ix_users_id", table_name="users")
    op.drop_table("users")
