"""
Categorização automática por regras simples (palavra-chave na descrição).

Isso é a v1 de propósito: fácil de entender e debugar. Se depois você
quiser evoluir para algo mais "de dados" (ex: um classificador treinado
com as correções manuais do usuário como labels), essa função é o ponto
de entrada que você vai substituir/complementar.
"""
from sqlalchemy.orm import Session

from app.models.category import Category


def categorize(description: str, categories: list[Category]) -> int | None:
    """
    Retorna o id da primeira categoria cuja keyword aparece na descrição,
    ou None se nenhuma bater (fica para categorização manual).
    """
    description_lower = description.lower()

    for category in categories:
        if not category.keywords:
            continue
        keywords = [k.strip().lower() for k in category.keywords.split(",") if k.strip()]
        if any(keyword in description_lower for keyword in keywords):
            return category.id

    return None


def categorize_all(db: Session, transactions_data: list[dict], user_id: int) -> list[dict]:
    """Aplica categorize() com as categorias do usuário às transações recém-parseadas do CSV."""
    categories = db.query(Category).filter(Category.user_id == user_id).all()
    for t in transactions_data:
        t["category_id"] = categorize(t["description"], categories)
    return transactions_data
