from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import Base, engine
from app.routers import upload, transactions, categories, dashboard

# Cria as tabelas no banco se ainda não existirem.
# Para um projeto solo isso é suficiente no começo; se quiser versionar
# mudanças de schema depois, migre para Alembic (pasta backend/alembic já criada).
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Finanças SaaS API")

# Libera o frontend local (Vite roda por padrão na porta 5173) a chamar a API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router)
app.include_router(transactions.router)
app.include_router(categories.router)
app.include_router(dashboard.router)


@app.get("/")
def root():
    return {"status": "ok"}
