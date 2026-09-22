from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship

from app.db import Base


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    # Palavras-chave separadas por vírgula, ex: "ifood,restaurante,lanchonete"
    # Simples de começar; se quiser evoluir, migra para uma tabela separada depois.
    keywords = Column(String, default="")

    transactions = relationship("Transaction", back_populates="category")
