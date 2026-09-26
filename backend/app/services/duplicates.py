"""
Detecta transações de um extrato novo que já foram importadas antes.

Uma transação é "repetida" quando já existe outra do mesmo usuário com a
mesma data, o mesmo valor e a mesma descrição (comparada sem acentos,
maiúsculas ou pontuação). É o que acontece ao reenviar o mesmo arquivo ou
um extrato de período que se sobrepõe a outro.

A contagem respeita repetições legítimas: duas corridas de R$ 15,90 no mesmo
dia são duas transações. Se já existe uma e o arquivo novo traz duas, só uma
é repetida.
"""
from collections import defaultdict
from dataclasses import dataclass, field
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.statement import Statement
from app.models.transaction import Transaction
from app.services.text import normalize_for_matching


@dataclass
class DuplicateCheck:
    # Posições (no arquivo novo) das transações que já existem
    indexes: set[int] = field(default_factory=set)
    # Arquivos onde as repetidas já estão, na ordem de importação
    statements: list[str] = field(default_factory=list)

    @property
    def count(self) -> int:
        return len(self.indexes)


def _key(date, amount, description: str) -> tuple:
    return (date, Decimal(amount).quantize(Decimal("0.01")), normalize_for_matching(description))


def find_duplicates(db: Session, user_id: int, parsed: list[dict]) -> DuplicateCheck:
    check = DuplicateCheck()
    if not parsed:
        return check

    dates = [t["date"] for t in parsed]
    existing = (
        db.query(Transaction, Statement)
        .join(Statement, Transaction.statement_id == Statement.id)
        .filter(
            Statement.user_id == user_id,
            Transaction.date >= min(dates),
            Transaction.date <= max(dates),
        )
        .order_by(Statement.id)
        .all()
    )

    # Chave -> arquivos de cada ocorrência já importada (uma entrada por transação)
    existing_files: dict[tuple, list[str]] = defaultdict(list)
    for transaction, statement in existing:
        key = _key(transaction.date, transaction.amount, transaction.description)
        existing_files[key].append(statement.filename)

    for index, item in enumerate(parsed):
        files = existing_files.get(_key(item["date"], item["amount"], item["description"]))
        if files:
            # Cada transação que já existe "cobre" só uma do arquivo novo
            filename = files.pop(0)
            check.indexes.add(index)
            if filename not in check.statements:
                check.statements.append(filename)
    return check
