from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import extract, func, or_
from sqlalchemy.orm import Session

from app.db import get_db
from app.dependencies import get_current_user
from app.models.category import Category
from app.models.statement import Statement
from app.models.transaction import Transaction
from app.models.user import User

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/by-category")
def by_category(
    statement_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Soma de gastos (valores negativos) agrupada por categoria.

    Categorias marcadas com ignore_in_reports ficam de fora.
    """
    query = (
        db.query(
            Category.name,
            func.sum(Transaction.amount).label("total"),
        )
        .join(Category, Transaction.category_id == Category.id)
        .join(Transaction.statement)
        .filter(
            Statement.user_id == user.id,
            Transaction.amount < 0,
            Category.ignore_in_reports.is_(False),
        )
    )
    if statement_id:
        query = query.filter(Transaction.statement_id == statement_id)

    results = query.group_by(Category.name).all()
    return [{"category": name, "total": float(total)} for name, total in results]


@router.get("/monthly")
def monthly(
    statement_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Evolução de gastos por mês/ano.

    Transações sem categoria entram; as de categorias com
    ignore_in_reports ficam de fora.
    """
    query = (
        db.query(
            extract("year", Transaction.date).label("year"),
            extract("month", Transaction.date).label("month"),
            func.sum(Transaction.amount).label("total"),
        )
        .join(Transaction.statement)
        .outerjoin(Category, Transaction.category_id == Category.id)
        .filter(
            Statement.user_id == user.id,
            Transaction.amount < 0,
            or_(Category.id.is_(None), Category.ignore_in_reports.is_(False)),
        )
    )
    if statement_id:
        query = query.filter(Transaction.statement_id == statement_id)

    results = query.group_by("year", "month").order_by("year", "month").all()
    return [
        {"year": int(year), "month": int(month), "total": float(total)}
        for year, month, total in results
    ]
