from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS
from app.services.client_ip import is_https
from app.routers import (
    auth,
    categories,
    dashboard,
    profile,
    reports,
    statements,
    transactions,
    upload,
)

# O schema do banco é gerenciado pelo Alembic: rode `alembic upgrade head`
# (dentro de backend/) antes de subir a API e sempre que houver migration nova.

app = FastAPI(
    title="Vexira API",
    description="Vexira — Controle financeiro inteligente.",
)

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

# Páginas de documentação (/docs, /redoc) carregam scripts de CDN: ficam
# fora da CSP restrita, que vale para as respostas da API
DOCS_PATHS = ("/docs", "/redoc", "/openapi.json")


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    # Dados financeiros: nada de guardar resposta em cache (navegador, proxy)
    response.headers.setdefault("Cache-Control", "no-store")
    # Não "adivinhar" o tipo do conteúdo (ex: tratar JSON como HTML)
    response.headers["X-Content-Type-Options"] = "nosniff"
    # Ninguém embute a API em outro site
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    if not request.url.path.startswith(DOCS_PATHS):
        response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
    # HTTPS obrigatório nas próximas visitas (só faz sentido já estando em HTTPS;
    # atrás do proxy do deploy, quem diz se era HTTPS é o proxy)
    if is_https(request):
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


app.include_router(auth.router)
app.include_router(profile.router)
app.include_router(upload.router)
app.include_router(transactions.router)
app.include_router(categories.router)
app.include_router(dashboard.router)
app.include_router(statements.router)
app.include_router(reports.router)


@app.get("/")
def root():
    return {"status": "ok"}
