from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, UniqueConstraint, false
from sqlalchemy.orm import relationship

from app.db import Base


class Category(Base):
    __tablename__ = "categories"
    # Cada usuário tem as próprias categorias: o nome só não pode repetir
    # dentro do mesmo usuário.
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_categories_user_id_name"),)

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    # Palavras-chave separadas por vírgula, ex: "ifood,restaurante,lanchonete"
    # Simples de começar; se quiser evoluir, migra para uma tabela separada depois.
    keywords = Column(String, default="")
    # Transações desta categoria não entram nos gráficos: serve para
    # movimentações que não são gasto nem renda de verdade, como pagamento
    # da fatura do cartão (as compras da fatura já são os gastos) ou
    # transferência entre contas do próprio usuário.
    ignore_in_reports = Column(Boolean, nullable=False, default=False, server_default=false())
    # NULL só para categorias criadas antes da autenticação, que ainda não
    # foram atribuídas a ninguém (ver app/create_user.py).
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)

    transactions = relationship("Transaction", back_populates="category")
