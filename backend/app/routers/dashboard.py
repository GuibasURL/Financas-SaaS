from fastapi import APIRouter, Depends
from sqlalchemy import func, extract
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.transaction import Transaction
from app.models.category import Category

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/by-category")
def by_category(db: Session = Depends(get_db)):
    """Soma de gastos (valores negativos) agrupada por categoria."""
    results = (
        db.query(
            Category.name,
            func.sum(Transaction.amount).label("total"),
        )
        .join(Category, Transaction.category_id == Category.id)
        .filter(Transaction.amount < 0)
        .group_by(Category.name)
        .all()
    )
    return [{"category": name, "total": float(total)} for name, total in results]


@router.get("/monthly")
def monthly(db: Session = Depends(get_db)):
    """Evolução de gastos por mês/ano."""
    results = (
        db.query(
            extract("year", Transaction.date).label("year"),
            extract("month", Transaction.date).label("month"),
            func.sum(Transaction.amount).label("total"),
        )
        .filter(Transaction.amount < 0)
        .group_by("year", "month")
        .order_by("year", "month")
        .all()
    )
    return [
        {"year": int(year), "month": int(month), "total": float(total)}
        for year, month, total in results
    ]
