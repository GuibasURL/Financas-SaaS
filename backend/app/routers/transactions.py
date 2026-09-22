from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import extract
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.transaction import Transaction
from app.schemas.transaction import TransactionOut, TransactionUpdate

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.get("", response_model=list[TransactionOut])
def list_transactions(
    month: Optional[int] = None,
    year: Optional[int] = None,
    category_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Transaction)

    if month:
        query = query.filter(extract("month", Transaction.date) == month)
    if year:
        query = query.filter(extract("year", Transaction.date) == year)
    if category_id:
        query = query.filter(Transaction.category_id == category_id)

    return query.order_by(Transaction.date.desc()).all()


@router.patch("/{transaction_id}", response_model=TransactionOut)
def update_transaction(
    transaction_id: int, payload: TransactionUpdate, db: Session = Depends(get_db)
):
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transação não encontrada")

    if payload.category_id is not None:
        transaction.category_id = payload.category_id

    db.commit()
    db.refresh(transaction)
    return transaction
