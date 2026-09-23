from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.statement import Statement
from app.models.transaction import Transaction
from app.schemas.statement import StatementOut

router = APIRouter(prefix="/statements", tags=["statements"])


@router.get("", response_model=list[StatementOut])
def list_statements(db: Session = Depends(get_db)):
    results = (
        db.query(
            Statement,
            func.count(Transaction.id),
            func.min(Transaction.date),
            func.max(Transaction.date),
        )
        .outerjoin(Transaction, Transaction.statement_id == Statement.id)
        .group_by(Statement.id)
        .order_by(Statement.uploaded_at.desc(), Statement.id.desc())
        .all()
    )
    return [
        StatementOut(
            id=statement.id,
            filename=statement.filename,
            uploaded_at=statement.uploaded_at,
            transaction_count=count,
            start_date=start_date,
            end_date=end_date,
        )
        for statement, count, start_date, end_date in results
    ]


@router.delete("/{statement_id}", status_code=204)
def delete_statement(statement_id: int, db: Session = Depends(get_db)):
    """Exclui o extrato e todas as transações importadas dele."""
    statement = db.get(Statement, statement_id)
    if not statement:
        raise HTTPException(status_code=404, detail="Extrato não encontrado")

    db.delete(statement)
    db.commit()
    return Response(status_code=204)
