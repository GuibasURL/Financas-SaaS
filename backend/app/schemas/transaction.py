from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_serializer


class TransactionBase(BaseModel):
    date: date
    description: str
    amount: Decimal
    category_id: Optional[int] = None

    @field_serializer("amount")
    def serialize_amount(self, amount: Decimal) -> float:
        return float(amount)


class TransactionUpdate(BaseModel):
    category_id: Optional[int] = None


class TransactionOut(TransactionBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    statement_id: int
    created_at: datetime
