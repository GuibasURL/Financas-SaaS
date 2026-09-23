from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, upload, transactions, categories, dashboard, statements, reports

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
    # Sem isso o navegador esconde do frontend o nome do arquivo do relatório
    expose_headers=["Content-Disposition"],
)

app.include_router(auth.router)
app.include_router(upload.router)
app.include_router(transactions.router)
app.include_router(categories.router)
app.include_router(dashboard.router)
app.include_router(statements.router)
app.include_router(reports.router)


@app.get("/")
def root():
    return {"status": "ok"}
