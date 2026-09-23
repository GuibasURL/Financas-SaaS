# Finanças SaaS

[![CI](https://github.com/GuibasURL/financas-saas/actions/workflows/ci.yml/badge.svg?branch=dev)](https://github.com/GuibasURL/financas-saas/actions/workflows/ci.yml)

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

## Autenticação

Todas as rotas (menos `/auth/register` e `/auth/login`) exigem login, e cada usuário só vê os próprios extratos, transações e categorias.

- `POST /auth/register` com `{"email": "...", "password": "..."}` (senha com pelo menos 8 caracteres)
- `POST /auth/login` com form-data `username` (o e-mail) e `password`: devolve um token JWT
- Mande o token nas outras chamadas no header `Authorization: Bearer <token>`
- `GET /auth/me` devolve o usuário logado

No Swagger (`/docs`), o botão **Authorize** faz o login e passa o token automaticamente.

Para criar um usuário pelo terminal (de dentro de `backend/`, com o venv ativado):

```bash
python -m app.create_user voce@email.com
```

A senha é pedida no terminal. Extratos e categorias que já existiam antes da autenticação ficam sem dono (invisíveis na API) até esse comando atribuí-los ao usuário criado.

Configuração (variáveis de ambiente ou `backend/.env`):

- `SECRET_KEY`: chave que assina os tokens (mínimo 32 bytes). Gere uma com `python -c "import secrets; print(secrets.token_urlsafe(32))"`. Sem ela, a API sobe com uma chave de desenvolvimento que está no código (e avisa no log): serve para rodar local, mas **nunca publique a API assim**, porque qualquer um conseguiria forjar tokens. Uma chave com menos de 32 bytes faz a API recusar subir.
- `ACCESS_TOKEN_EXPIRE_MINUTES`: validade do token (padrão: 1440, ou seja, 1 dia)

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

## Testes do frontend

```bash
cd frontend
npm test            # roda uma vez
npm run test:watch  # fica rodando e repete a cada alteração
```

Vitest + Testing Library, com os componentes renderizados no jsdom. As chamadas HTTP vão para uma API falsa em memória (`src/test/fakeApi.ts`, feita com [MSW](https://mswjs.io/)), então o `api.ts` roda de verdade, incluindo o envio do token e a volta para o login quando a sessão expira. Cada teste começa com a API falsa vazia; os helpers `addUser`, `loginAs`, `addCategory` e `addStatement` montam o cenário.

## Integração contínua (GitHub Actions)

A cada push e pull request para `dev` ou `main`, o workflow `.github/workflows/ci.yml` roda em paralelo:

- **Backend:** instala `requirements-dev.txt` e roda o `pytest`
- **Frontend:** `npm ci`, `npm test` e `npm run build` (que também faz o typecheck)

O resultado aparece no PR (✓ ou ✗) e na aba **Actions** do repositório.

## Formatos de extrato aceitos

O upload reconhece o banco sozinho pelo cabeçalho do CSV:

| Banco | Particularidades tratadas |
|---|---|
| Nubank (conta) | `Data,Valor,Identificador,Descrição` |
| Nubank (fatura do cartão) | `date,title,amount`; compra vem positiva e é convertida em saída |
| Itaú | `;`, valores `1.234,56`, linhas de cabeçalho antes da tabela |
| Banco Inter | `;`, descrição = Histórico + Descrição |
| Bradesco | `;`, crédito e débito em colunas separadas |
| Banco do Brasil | tudo entre aspas, coluna "Dependência Origem" |
| Genérico | `data,descricao,valor` (abaixo) |

Em todos: linhas de saldo (`SALDO ANTERIOR`, `SALDO DO DIA`, `S A L D O`...) e linhas em branco são ignoradas, e arquivos em UTF-8 (com ou sem BOM) ou Windows-1252 são aceitos. Datas em `dd/mm/aaaa` ou `aaaa-mm-dd`.

> ⚠️ Os formatos dos bancos foram montados a partir de exemplos gerados por IA (`backend/tests/fixtures/extratos/`), não de extratos reais. Se o extrato do seu banco não for reconhecido ou vier com valores errados, ajuste o formato dele em `FORMATS` (`backend/app/services/csv_parser.py`) e troque o arquivo de exemplo por um real, com os dados anonimizados.

Formato genérico, para montar um CSV à mão:

```csv
data,descricao,valor
2025-01-05,IFOOD *RESTAURANTE XYZ,-45.90
2025-01-06,SALARIO EMPRESA,5000.00
```

- `valor`: negativo para saída, positivo para entrada

## Categorização automática

Cada categoria tem uma lista de palavras-chave separadas por vírgula, ex:

```json
{ "name": "Alimentação", "keywords": "ifood,restaurante,lanchonete" }
```

Toda vez que uma transação for importada, o sistema verifica se alguma palavra-chave aparece na descrição (sem diferenciar maiúsculas nem acentos: "farmácia" pega "FARMACIA SAO JOAO") e categoriza automaticamente. Se mais de uma categoria bater, vale a criada primeiro. O que não bater fica sem categoria para você escolher na tabela de transações.

As categorias são gerenciadas na seção **Categorias** do app (ou pela API):

- `GET /categories`, `POST /categories`: listar e criar
- `PATCH /categories/{id}`: renomear e/ou trocar as palavras-chave (só os campos enviados mudam)
- `DELETE /categories/{id}`: excluir; as transações dela ficam sem categoria (não são apagadas)
- `POST /categories/defaults`: cria as categorias sugeridas que você ainda não tem (botão "Adicionar categorias sugeridas")
- `POST /categories/apply-rules`: aplica as palavras-chave atuais às transações **já importadas que estão sem categoria**. Transações que já têm categoria, inclusive as escolhidas à mão, não são alteradas.

O nome e as palavras-chave são normalizados ao salvar (espaços nas pontas removidos, palavras-chave em minúsculo e sem repetição).

### Categorias sugeridas

Contas novas já nascem com 12 categorias prontas (Alimentação, Mercado, Transporte, Saúde, Moradia, Assinaturas, Compras, Educação, Lazer, Tarifas bancárias, Salário e Pagamento de fatura), então o primeiro extrato já sai categorizado. Contas antigas podem adicioná-las pelo botão; as que você já tem (pelo nome) não são alteradas.

A lista fica em `backend/app/services/default_categories.py`. Ao mexer nela, lembre que:

- **A ordem importa:** quando duas categorias batem, vence a que vem primeiro (por isso "Compras", com "mercado livre", vem antes de "Mercado").
- **Palavras curtas pegam demais:** a busca é por "contém", então "posto" pegaria "IMPOSTO" e "curso" pegaria "RECURSOS". Os testes em `tests/test_default_categories.py` cobrem esses casos.

### Ignorar nos gráficos (pagamento de fatura, transferências)

Uma categoria pode ser marcada como **ignorar nos gráficos** (`ignore_in_reports`): as transações dela continuam na lista, mas não entram em "Gastos por categoria" nem em "Evolução mensal".

Isso resolve a contagem dupla quando você importa a conta **e** a fatura do cartão: as compras da fatura já são os gastos, e o pagamento da fatura na conta é só o dinheiro indo da conta para o cartão. Exemplo:

```json
{ "name": "Pagamento de fatura", "keywords": "pagamento de fatura,pagamento recebido", "ignore_in_reports": true }
```

O mesmo vale para transferências entre suas próprias contas ou aplicações em investimento. Ajuste as palavras-chave para o texto que o seu banco usa.

## Extratos

Cada upload de CSV vira um extrato (`GET /statements`), com o período coberto e a quantidade de transações. Dá para filtrar transações e dashboard por extrato com `?statement_id=` e excluir um extrato inteiro (junto com as transações dele) via `DELETE /statements/{id}`.

## Relatório em Excel

A seção **Exportar relatório** do app (ou `GET /reports/export`) baixa uma planilha `.xlsx` com quatro abas:

- **Resumo:** período, extrato, entradas, saídas, saldo e quantidade de transações
- **Por mês:** entradas, saídas e saldo de cada mês
- **Por categoria:** gastos por categoria (inclusive "Sem categoria"), com % do total
- **Transações:** a lista completa, com filtro do Excel e cabeçalho fixo

Filtros opcionais: `start_date` e `end_date` (`AAAA-MM-DD`, inclusivas) e `statement_id`. No app, o extrato é o mesmo selecionado na seção Extratos. Categorias marcadas como "ignorar nos gráficos" ficam fora dos totais, mas aparecem na aba Transações (coluna "Nos totais"). As linhas de total usam fórmulas (`SUM`), então continuam certas se você editar a planilha.

## Roadmap sugerido

- [x] Fase 1: upload CSV, categorização por regra, dashboard básico
- [x] Fase 2: autenticação, edição manual de categoria no frontend, múltiplos extratos, gerenciamento de categorias
- [ ] Fase 3: ~~suporte a formatos de CSV de bancos diferentes~~ (falta validar com extratos reais), ~~exportar relatórios~~, deploy

## Stack

- Backend: FastAPI + SQLAlchemy + Alembic + SQLite (trocar para Postgres depois é só mudar `DATABASE_URL`)
- Frontend: React + TypeScript + Vite + Recharts
