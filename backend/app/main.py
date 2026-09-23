from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import upload, transactions, categories, dashboard, statements

# O schema do banco é gerenciado pelo Alembic: rode `alembic upgrade head`
# (dentro de backend/) antes de subir a API e sempre que houver migration nova.

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
app.include_router(statements.router)


@app.get("/")
def root():
    return {"status": "ok"}
