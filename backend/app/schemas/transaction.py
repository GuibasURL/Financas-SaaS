from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict


class TransactionBase(BaseModel):
    date: date
    description: str
    amount: Decimal
    category_id: Optional[int] = None


class TransactionUpdate(BaseModel):
    category_id: Optional[int] = None


class TransactionOut(TransactionBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source_file: Optional[str] = None
    created_at: datetime
