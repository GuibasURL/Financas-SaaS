"""
Categorização automática por regras simples (palavra-chave na descrição).

Isso é a v1 de propósito: fácil de entender e debugar. Se depois você
quiser evoluir para algo mais "de dados" (ex: um classificador treinado
com as correções manuais do usuário como labels), essa função é o ponto
de entrada que você vai substituir/complementar.
"""
from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.transaction import Transaction
from app.services.text import normalize_text


def categorize(description: str, categories: list[Category]) -> int | None:
    """
    Retorna o id da primeira categoria cuja keyword aparece na descrição,
    ou None se nenhuma bater (fica para categorização manual).

    A comparação ignora maiúsculas e acentos: a keyword "farmácia" pega
    "FARMACIA SAO JOAO" (a maioria dos bancos escreve sem acento).
    """
    description = normalize_text(description)

    for category in categories:
        if not category.keywords:
            continue
        keywords = [normalize_text(k.strip()) for k in category.keywords.split(",") if k.strip()]
        if any(keyword in description for keyword in keywords):
            return category.id

    return None


def user_categories(db: Session, user_id: int) -> list[Category]:
    # Ordem fixa (por id): quando duas categorias batem, vence a mais antiga
    return db.query(Category).filter(Category.user_id == user_id).order_by(Category.id).all()


def categorize_all(db: Session, transactions_data: list[dict], user_id: int) -> list[dict]:
    """Aplica categorize() com as categorias do usuário às transações recém-parseadas do CSV."""
    categories = user_categories(db, user_id)
    for t in transactions_data:
        t["category_id"] = categorize(t["description"], categories)
    return transactions_data


def categorize_uncategorized(db: Session, transactions: list[Transaction], user_id: int) -> int:
    """
    Aplica as regras atuais às transações já importadas que estão sem
    categoria. As que já têm categoria (automática ou escolhida à mão) não
    são tocadas. Retorna quantas ganharam categoria; não faz commit.
    """
    categories = user_categories(db, user_id)
    categorized = 0
    for transaction in transactions:
        category_id = categorize(transaction.description, categories)
        if category_id is not None:
            transaction.category_id = category_id
            categorized += 1
    return categorized
