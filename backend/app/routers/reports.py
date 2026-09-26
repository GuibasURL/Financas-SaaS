from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session, joinedload

from app.config import APP_TIMEZONE
from app.db import get_db
from app.dependencies import get_current_user
from app.models.statement import Statement
from app.models.transaction import Transaction
from app.models.user import User
from app.routers.transactions import user_transactions
from app.services.report import ReportFilters, build_report

router = APIRouter(prefix="/reports", tags=["reports"])

XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@router.get(
    "/export",
    response_class=Response,
    responses={200: {"content": {XLSX_MEDIA_TYPE: {}}, "description": "Planilha .xlsx"}},
)
def export_report(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    statement_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Relatório em Excel com resumo, totais por mês e por categoria e a lista
    de transações. Todos os filtros são opcionais (datas no formato AAAA-MM-DD,
    inclusivas).
    """
    if start_date and end_date and start_date > end_date:
        raise HTTPException(status_code=400, detail="A data inicial é depois da data final")

    statement = None
    if statement_id is not None:
        statement = db.get(Statement, statement_id)
        # Extrato de outro usuário responde igual a inexistente
        if not statement or statement.user_id != user.id:
            raise HTTPException(status_code=404, detail="Extrato não encontrado")

    query = user_transactions(db, user).options(
        joinedload(Transaction.category), joinedload(Transaction.statement)
    )
    if start_date:
        query = query.filter(Transaction.date >= start_date)
    if end_date:
        query = query.filter(Transaction.date <= end_date)
    if statement:
        query = query.filter(Transaction.statement_id == statement.id)

    filters = ReportFilters(
        start_date=start_date,
        end_date=end_date,
        statement_name=statement.filename if statement else None,
    )
    content = build_report(query.all(), filters, generated_at=datetime.now(APP_TIMEZONE))

    return Response(
        content=content,
        media_type=XLSX_MEDIA_TYPE,
        headers={"Content-Disposition": f'attachment; filename="{_filename(filters)}"'},
    )


def _filename(filters: ReportFilters) -> str:
    """vexira-relatorio_2025-03-01_a_2025-03-31.xlsx (ou _completo, sem datas)"""
    parts = ["vexira-relatorio"]
    if filters.start_date or filters.end_date:
        start = filters.start_date.isoformat() if filters.start_date else "inicio"
        end = filters.end_date.isoformat() if filters.end_date else "hoje"
        parts.append(f"{start}_a_{end}")
    else:
        parts.append("completo")
    return "_".join(parts) + ".xlsx"
