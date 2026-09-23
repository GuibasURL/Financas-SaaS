from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db import get_db
from app.dependencies import get_current_user
from app.models.statement import Statement
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.statement import StatementOut

router = APIRouter(prefix="/statements", tags=["statements"])


@router.get("", response_model=list[StatementOut])
def list_statements(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    results = (
        db.query(
            Statement,
            func.count(Transaction.id),
            func.min(Transaction.date),
            func.max(Transaction.date),
        )
        .outerjoin(Transaction, Transaction.statement_id == Statement.id)
        .filter(Statement.user_id == user.id)
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
def delete_statement(
    statement_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Exclui o extrato e todas as transações importadas dele."""
    statement = db.get(Statement, statement_id)
    # Extrato de outro usuário responde igual a inexistente
    if not statement or statement.user_id != user.id:
        raise HTTPException(status_code=404, detail="Extrato não encontrado")

    db.delete(statement)
    db.commit()
    return Response(status_code=204)
