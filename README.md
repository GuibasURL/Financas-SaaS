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

## Roadmap sugerido

- [x] Fase 1: upload CSV, categorização por regra, dashboard básico
- [ ] Fase 2: autenticação, edição manual de categoria no frontend, múltiplos extratos
- [ ] Fase 3: suporte a formatos de CSV de bancos diferentes, exportar relatórios, deploy

## Stack

- Backend: FastAPI + SQLAlchemy + pandas + SQLite (trocar para Postgres depois é só mudar `DATABASE_URL`)
- Frontend: React + TypeScript + Vite + Recharts
