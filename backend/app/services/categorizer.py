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
from app.services.text import normalize_for_matching


def parse_keywords(keywords: str) -> tuple[list[str], list[str]]:
    """
    "ifood, Restaurante, -mercado pago" -> (["ifood", "restaurante"], ["mercado pago"])

    Palavras-chave começando com "-" são de exclusão: se aparecerem na
    descrição, a categoria não é usada, mesmo que outra palavra-chave bata.
    """
    include, exclude = [], []
    for keyword in keywords.split(","):
        keyword = keyword.strip()
        target = exclude if keyword.startswith("-") else include
        normalized = normalize_for_matching(keyword.lstrip("-"))
        if normalized:
            target.append(normalized)
    return include, exclude


def _contains(description: str, keyword: str) -> bool:
    # A palavra-chave tem que começar no início de uma palavra da descrição:
    # "farmacia" pega "FARMACIAS", mas "posto" não pega "IMPOSTO"
    return f" {keyword}" in f" {description}"


def categorize(description: str, categories: list[Category]) -> int | None:
    """
    Retorna o id da primeira categoria (na ordem da lista) com alguma
    palavra-chave na descrição e nenhuma de exclusão, ou None se nenhuma
    bater (fica para categorização manual).

    A comparação ignora maiúsculas, acentos e pontuação ("farmácia" pega
    "FARMACIA SAO JOAO"; "uber eats" pega "UBER *EATS"), e a palavra-chave
    precisa estar no começo de uma palavra da descrição.
    """
    return match(description, build_rules(categories))


# Regra já processada: (id da categoria, palavras-chave, exclusões)
Rule = tuple[int, list[str], list[str]]


def build_rules(categories: list[Category]) -> list[Rule]:
    """
    Processa as palavras-chave uma vez só. Para muitas transações (upload,
    aplicar regras), use build_rules + match em vez de categorize, que
    reprocessaria as palavras-chave a cada transação.
    """
    return [(c.id, *parse_keywords(c.keywords or "")) for c in categories]


def match(description: str, rules: list[Rule]) -> int | None:
    description = normalize_for_matching(description)
    for category_id, include, exclude in rules:
        if any(_contains(description, k) for k in exclude):
            continue
        if any(_contains(description, k) for k in include):
            return category_id
    return None


def user_categories(db: Session, user_id: int) -> list[Category]:
    # Ordem fixa (por id): quando duas categorias batem, vence a mais antiga
    return db.query(Category).filter(Category.user_id == user_id).order_by(Category.id).all()


def categorize_all(db: Session, transactions_data: list[dict], user_id: int) -> list[dict]:
    """Aplica categorize() com as categorias do usuário às transações recém-parseadas do CSV."""
    rules = build_rules(user_categories(db, user_id))
    for t in transactions_data:
        t["category_id"] = match(t["description"], rules)
    return transactions_data


def categorize_uncategorized(db: Session, transactions: list[Transaction], user_id: int) -> int:
    """
    Aplica as regras atuais às transações já importadas que estão sem
    categoria. As que já têm categoria (automática ou escolhida à mão) não
    são tocadas. Retorna quantas ganharam categoria; não faz commit.
    """
    rules = build_rules(user_categories(db, user_id))
    categorized = 0
    for transaction in transactions:
        category_id = match(transaction.description, rules)
        if category_id is not None:
            transaction.category_id = category_id
            categorized += 1
    return categorized
