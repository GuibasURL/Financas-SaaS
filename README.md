# Finanças SaaS

SaaS simples de gestão financeira: importa extrato em CSV, categoriza gastos automaticamente por regras de palavra-chave, e mostra dashboard com gráficos.

## Rodando o backend

O ambiente virtual (`venv`) fica na raiz do projeto e o servidor roda de dentro de `backend/`.

Primeira vez (a partir da raiz do projeto):

```bash
python -m venv venv
source venv/bin/activate          # Windows (PowerShell): venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
```

Criar/atualizar as tabelas do banco (de dentro de `backend/`, com o venv ativado):

```bash
cd backend
alembic upgrade head
```

O schema do banco é versionado com Alembic (`backend/alembic/versions`). Sempre que puxar uma migration nova, rode `alembic upgrade head` de novo. Para criar uma migration depois de mudar um model:

```bash
alembic revision --autogenerate -m "descricao da mudanca"
```

> Bancos criados antes do Alembic (pelo antigo `create_all`) precisam ser marcados uma vez com `alembic stamp 0001` antes do `alembic upgrade head`.

Para subir a API (a partir da raiz, com o venv ativado):

```bash
cd backend
uvicorn app.main:app --reload
```

Atalho no Windows (PowerShell), sem precisar ativar o venv:

```powershell
cd backend
..\venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

O `--reload` reinicia o servidor automaticamente a cada alteração no código. Para parar, use `Ctrl+C`.

A API sobe em `http://localhost:8000`. Documentação automática (Swagger) em `http://localhost:8000/docs` — útil para testar os endpoints sem precisar do frontend pronto.

## Testes do backend

Instale as dependências de desenvolvimento (uma vez) e rode o pytest de dentro de `backend/`:

```bash
pip install -r backend/requirements-dev.txt
cd backend
pytest
```

Cada teste usa um banco SQLite em memória, então o `financas.db` não é tocado. Há também um teste que roda as migrations do Alembic e confere se batem com os models.

## Rodando o frontend

```bash
cd frontend
npm install
npm run dev
```

O app sobe em `http://localhost:5173`.

## Formato de CSV esperado (v1)

```csv
data,descricao,valor
2025-01-05,IFOOD *RESTAURANTE XYZ,-45.90
2025-01-06,SALARIO EMPRESA,5000.00
```

- `data`: qualquer formato que o pandas reconheça (ex: `2025-01-05`, `05/01/2025`)
- `descricao`: texto livre
- `valor`: negativo para saída, positivo para entrada

## Categorização automática

Crie categorias via `POST /categories` com uma lista de `keywords` separadas por vírgula, ex:

```json
{ "name": "Alimentação", "keywords": "ifood,restaurante,lanchonete" }
```

Toda vez que uma transação for importada, o sistema verifica se alguma keyword aparece na descrição (case-insensitive) e categoriza automaticamente. O que não bater fica sem categoria (`category_id: null`) para você categorizar manualmente via `PATCH /transactions/{id}`.

## Extratos

Cada upload de CSV vira um extrato (`GET /statements`), com o período coberto e a quantidade de transações. Dá para filtrar transações e dashboard por extrato com `?statement_id=` e excluir um extrato inteiro (junto com as transações dele) via `DELETE /statements/{id}`.

## Roadmap sugerido

- [x] Fase 1: upload CSV, categorização por regra, dashboard básico
- [ ] Fase 2: autenticação, ~~edição manual de categoria no frontend~~, ~~múltiplos extratos~~
- [ ] Fase 3: suporte a formatos de CSV de bancos diferentes, exportar relatórios, deploy

## Stack

- Backend: FastAPI + SQLAlchemy + pandas + SQLite (trocar para Postgres depois é só mudar `DATABASE_URL`)
- Frontend: React + TypeScript + Vite + Recharts
