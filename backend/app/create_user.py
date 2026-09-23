"""
Cria um usuário pela linha de comando e atribui a ele os dados sem dono.

Uso (de dentro de backend/, com o venv ativado):

    python -m app.create_user voce@email.com

A senha é pedida no terminal (sem aparecer na tela e sem ficar no
histórico do shell). Extratos e categorias criados antes da autenticação
(user_id NULL) passam a ser desse usuário.
"""
import argparse
import getpass
import sys

from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models.category import Category
from app.models.statement import Statement
from app.models.user import User
from app.schemas.user import UserCreate
from app.services.security import hash_password


class CreateUserError(Exception):
    pass


def create_user_and_claim_orphans(db: Session, email: str, password: str) -> tuple[User, int, int]:
    """Cria o usuário e devolve (usuário, nº de extratos atribuídos, nº de categorias atribuídas)."""
    try:
        payload = UserCreate(email=email, password=password)
    except ValidationError as e:
        raise CreateUserError(
            "; ".join(err["msg"].removeprefix("Value error, ") for err in e.errors())
        )

    if db.query(User).filter(User.email == payload.email).first():
        raise CreateUserError(f"Já existe um usuário com o e-mail {payload.email}")

    user = User(email=payload.email, hashed_password=hash_password(payload.password))
    db.add(user)
    db.flush()  # gera o user.id sem commitar ainda

    statements = (
        db.query(Statement)
        .filter(Statement.user_id.is_(None))
        .update({Statement.user_id: user.id}, synchronize_session=False)
    )
    categories = (
        db.query(Category)
        .filter(Category.user_id.is_(None))
        .update({Category.user_id: user.id}, synchronize_session=False)
    )

    db.commit()
    db.refresh(user)
    return user, statements, categories


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("email")
    args = parser.parse_args()

    password = getpass.getpass("Senha: ")
    if password != getpass.getpass("Repita a senha: "):
        sys.exit("As senhas não conferem.")

    db = SessionLocal()
    try:
        user, statements, categories = create_user_and_claim_orphans(db, args.email, password)
    except CreateUserError as e:
        sys.exit(str(e))
    finally:
        db.close()

    print(f"Usuário {user.email} criado (id {user.id}).")
    print(f"Atribuídos a ele: {statements} extrato(s) e {categories} categoria(s) sem dono.")


if __name__ == "__main__":
    main()
