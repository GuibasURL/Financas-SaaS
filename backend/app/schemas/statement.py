from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


class StatementOut(BaseModel):
    id: int
    filename: str
    uploaded_at: datetime
    transaction_count: int
    # Período coberto pelas transações do extrato (None se estiver vazio)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
