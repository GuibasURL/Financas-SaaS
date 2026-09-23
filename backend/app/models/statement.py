from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db import Base


class Statement(Base):
    """Um extrato importado (um upload de CSV)."""

    __tablename__ = "statements"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Excluir o extrato exclui as transações dele.
    transactions = relationship(
        "Transaction", back_populates="statement", cascade="all, delete-orphan"
    )
