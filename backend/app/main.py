from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS
from app.routers import auth, upload, transactions, categories, dashboard, statements, reports

# O schema do banco é gerenciado pelo Alembic: rode `alembic upgrade head`
# (dentro de backend/) antes de subir a API e sempre que houver migration nova.

app = FastAPI(title="Finanças SaaS API")

# Libera o frontend a chamar a API (padrão: Vite local na 5173; ver CORS_ORIGINS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
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
