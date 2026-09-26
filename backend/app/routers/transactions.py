from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import extract
from sqlalchemy.orm import Session

from app.db import get_db
from app.dependencies import get_current_user
from app.models.category import Category
from app.models.statement import Statement
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.transaction import TransactionOut, TransactionUpdate

router = APIRouter(prefix="/transactions", tags=["transactions"])


def user_transactions(db: Session, user: User):
    """Transações do usuário (a posse vem do extrato de onde elas foram importadas)."""
    return db.query(Transaction).join(Transaction.statement).filter(Statement.user_id == user.id)


@router.get("", response_model=list[TransactionOut])
def list_transactions(
    month: Optional[int] = None,
    year: Optional[int] = None,
    category_id: Optional[int] = None,
    statement_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = user_transactions(db, user)

    if month:
        query = query.filter(extract("month", Transaction.date) == month)
    if year:
        query = query.filter(extract("year", Transaction.date) == year)
    if category_id:
        query = query.filter(Transaction.category_id == category_id)
    if statement_id:
        query = query.filter(Transaction.statement_id == statement_id)

    return query.order_by(Transaction.date.desc()).all()


@router.patch("/{transaction_id}", response_model=TransactionOut)
def update_transaction(
    transaction_id: int,
    payload: TransactionUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    transaction = user_transactions(db, user).filter(Transaction.id == transaction_id).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transação não encontrada")

    # Checa se o campo foi enviado (e não só se é None) para permitir
    # remover a categoria mandando {"category_id": null}.
    if "category_id" in payload.model_fields_set:
        if payload.category_id is not None and not _user_owns_category(
            db, user, payload.category_id
        ):
            raise HTTPException(status_code=404, detail="Categoria não encontrada")
        transaction.category_id = payload.category_id

    db.commit()
    db.refresh(transaction)
    return transaction


def _user_owns_category(db: Session, user: User, category_id: int) -> bool:
    return (
        db.query(Category)
        .filter(Category.id == category_id, Category.user_id == user.id)
        .first()
        is not None
    )
