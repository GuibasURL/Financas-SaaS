<picture>
  <source media="(prefers-color-scheme: dark)" srcset="Docs/marca/vexira-logo.png">
  <img alt="Vexira — Controle financeiro inteligente" src="Docs/marca/vexira-logo-claro.png" width="420">
</picture>

# Vexira

**Controle financeiro inteligente.**

[![CI](https://github.com/GuibasURL/financas-saas/actions/workflows/ci.yml/badge.svg?branch=dev)](https://github.com/GuibasURL/financas-saas/actions/workflows/ci.yml)

Vexira é um app de gestão financeira pessoal: importa extrato em CSV, categoriza gastos automaticamente por regras de palavra-chave, e mostra dashboard com gráficos.

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

- `POST /auth/register` com `{"email": "...", "password": "..."}`. A senha precisa ser **mediana ou forte**: pelo menos 8 caracteres e 3 dos 4 tipos (letra minúscula, letra maiúscula, número, caractere especial); com os 4 é forte. Senhas óbvias também contam como fracas: palavra comum com números e símbolos em volta ("Senha123!", "P@ssword2024"), sequência ou repetição de letras ("Abcdefg1!") e senha que contém o próprio e-mail. Senha fraca volta `422` dizendo o que falta. Na tela de cadastro, uma barra (vermelha, laranja, verde) e uma checklist mostram isso enquanto a pessoa digita, e o campo "Repetir senha" avisa quando as senhas conferem. Contas antigas com senha fraca continuam entrando normalmente.
- `POST /auth/login` com form-data `username` (o e-mail) e `password`: devolve um token JWT
- Mande o token nas outras chamadas no header `Authorization: Bearer <token>`
- `GET /auth/me` devolve o usuário logado (com nome, data de nascimento e foto, se preenchidos)

### Perfil

A tela **Editar perfil** (cartão com a foto no rodapé do menu, ou "Perfil" na barra do celular) usa:

- `PATCH /auth/me` com `{"name", "email", "birth_date"}`: nome obrigatório (2 a 100 caracteres), data de nascimento opcional (não pode ser no futuro). **Trocar o e-mail pede `current_password`**: senha errada volta `400` e conta no limite de tentativas de login.
- `PUT /auth/me/avatar` (form-data `file`): foto em JPG, PNG ou WebP, até 1 MB. O tipo é conferido pelos bytes do arquivo, não pelo nome. O navegador já recorta o centro e reduz para 256×256 antes de enviar (uma foto de celular vira poucos KB).
- `DELETE /auth/me/avatar` remove a foto.

A foto fica no próprio banco e volta em `avatar_url` como data URL, então o deploy não precisa de um disco para arquivos.

No Swagger (`/docs`), o botão **Authorize** faz o login e passa o token automaticamente.

Para criar um usuário pelo terminal (de dentro de `backend/`, com o venv ativado):

```bash
python -m app.create_user voce@email.com
```

A senha é pedida no terminal. Extratos e categorias que já existiam antes da autenticação ficam sem dono (invisíveis na API) até esse comando atribuí-los ao usuário criado.

Configuração (variáveis de ambiente ou `backend/.env`):

- `SECRET_KEY`: chave que assina os tokens (mínimo 32 bytes). Gere uma com `python -c "import secrets; print(secrets.token_urlsafe(32))"`. Sem ela, a API sobe com uma chave de desenvolvimento que está no código (e avisa no log): serve para rodar local, mas **nunca publique a API assim**, porque qualquer um conseguiria forjar tokens. Uma chave com menos de 32 bytes faz a API recusar subir.
- `ACCESS_TOKEN_EXPIRE_MINUTES`: validade do token (padrão: 1440, ou seja, 1 dia)
- `CORS_ORIGINS`: endereços do frontend que podem chamar a API, separados por vírgula (padrão: `http://localhost:5173`). Em produção, o endereço público do frontend.
- `APP_TIMEZONE`: fuso dos horários gerados pela API, como o "Gerado em" do relatório (padrão: `America/Sao_Paulo`). Servidores costumam rodar em UTC; sem isso, o horário sairia 3h adiantado. Um nome inválido faz a API recusar subir.
- `LOGIN_MAX_FAILURES_PER_ACCOUNT` (padrão: 5), `LOGIN_MAX_FAILURES_PER_IP` (padrão: 30) e `LOGIN_WINDOW_MINUTES` (padrão: 15): limite de tentativas de login erradas (veja abaixo).

### Limite de tentativas de login

Para dificultar quem tenta adivinhar senhas, o login conta as tentativas erradas nos últimos 15 minutos:

- **5 erros no mesmo e-mail, a partir do mesmo IP**, ou **30 erros de um mesmo IP** (em qualquer e-mail) bloqueiam o login por um tempo: a API responde `429` com a mensagem "Muitas tentativas de login. Tente de novo em N minutos." e o header `Retry-After` (em segundos). Enquanto durar, nem a senha certa entra.
- Um login certo zera os erros daquele e-mail naquele IP.
- A contagem fica na memória da API: zera quando ela reinicia e vale só para uma instância (o suficiente para este projeto; com várias instâncias, ela precisaria ir para um lugar compartilhado, como o Redis).

> ⚠️ **No deploy, atrás de um proxy** (Render, Railway, Nginx...), a API só enxerga o IP real de quem acessa se o uvicorn rodar com `--proxy-headers --forwarded-allow-ips="*"` (ou o IP do proxy). Sem isso, todo mundo parece vir do IP do proxy e 30 erros de pessoas diferentes bloqueariam o login de todos.

## Testes do backend

Instale as dependências de desenvolvimento (uma vez) e rode o pytest de dentro de `backend/`:

```bash
pip install -r backend/requirements-dev.txt
cd backend
pytest
```

Cada teste usa um banco SQLite em memória, então o `financas.db` não é tocado. Há também um teste que roda as migrations do Alembic e confere se batem com os models.

Para ver quais linhas nenhum teste executa (o CI exige pelo menos 95%):

```bash
pytest --cov=app --cov-report=term-missing
```

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
npm run test:coverage  # com relatório de cobertura (texto + frontend/coverage/index.html)
```

Vitest + Testing Library, com os componentes renderizados no jsdom. As chamadas HTTP vão para uma API falsa em memória (`src/test/fakeApi.ts`, feita com [MSW](https://mswjs.io/)), então o `api.ts` roda de verdade, incluindo o envio do token e a volta para o login quando a sessão expira. Cada teste começa com a API falsa vazia; os helpers `addUser`, `loginAs`, `addCategory` e `addStatement` montam o cenário.

## Integração contínua (GitHub Actions)

A cada push e pull request para `dev` ou `main`, o workflow `.github/workflows/ci.yml` roda em paralelo:

- **Backend:** instala `requirements-dev.txt` e roda o `pytest` com cobertura (falha abaixo de 95%)
- **Frontend:** `npm ci`, testes com cobertura (mínimos em `vite.config.ts`) e `npm run build` (que também faz o typecheck)

O resultado aparece no PR (✓ ou ✗) e na aba **Actions** do repositório.

## Formatos de extrato aceitos

O upload aceita **OFX** (de qualquer banco) e **CSV** (dos bancos abaixo), e reconhece o formato sozinho.

### OFX: qualquer banco

OFX é o formato padrão de extrato bancário, igual em todos os bancos. Muitos oferecem a opção de baixar o extrato (ou a fatura do cartão) em OFX, então ele funciona mesmo para bancos que não têm um CSV conhecido pelo app.

- Aceita OFX 1.x (SGML, o mais comum nos bancos brasileiros, geralmente em Windows-1252) e 2.x (XML).
- De cada lançamento usa a data (`DTPOSTED`), o valor com sinal (`TRNAMT`) e a descrição (`NAME` e `MEMO`).
- Tolera o que costuma aparecer fora do padrão: valor com vírgula (`-55,90`), débito com valor positivo (vira saída), `</STMTTRN>` faltando e lançamento repetido no mesmo arquivo (mesmo `FITID`, entra uma vez só).
- O código fica em `backend/app/services/ofx_parser.py`; os exemplos (dados fictícios) em `backend/tests/fixtures/extratos/*.ofx`.

### CSV: bancos conhecidos

O banco é reconhecido pelo cabeçalho do CSV:

| Banco | Particularidades tratadas |
|---|---|
| Nubank (conta) | `Data,Valor,Identificador,Descrição` |
| Nubank (fatura do cartão) | `date,title,amount`; compra vem positiva e é convertida em saída |
| Itaú | `;`, valores `1.234,56`, linhas de cabeçalho antes da tabela |
| Banco Inter | `;`, descrição = Histórico + Descrição |
| Bradesco | `;`, crédito e débito em colunas separadas |
| Banco do Brasil | tudo entre aspas, coluna "Dependência Origem" |
| PicPay | descrição = Tipo + Origem/Destino ("Pix enviado - IFOOD..."); valor `−R$ 3,30` / `+R$ 4,00`, com o sinal de menos tipográfico (−) |
| Genérico | `data,descricao,valor` (abaixo) |

Em todos: linhas de saldo (`SALDO ANTERIOR`, `SALDO DO DIA`, `S A L D O`...) e linhas em branco são ignoradas, e arquivos em UTF-8 (com ou sem BOM) ou Windows-1252 são aceitos. Datas em `dd/mm/aaaa` ou `aaaa-mm-dd`.

> ⚠️ O formato do **PicPay** foi conferido com um extrato real (o exemplo em `backend/tests/fixtures/extratos/picpay.csv` tem a mesma estrutura, com dados fictícios). Os dos outros bancos foram montados a partir de exemplos gerados por IA (`backend/tests/fixtures/extratos/`), não de extratos reais. Se o extrato do seu banco não for reconhecido ou vier com valores errados, ajuste o formato dele em `FORMATS` (`backend/app/services/csv_parser.py`) e troque o arquivo de exemplo por um real, com os dados anonimizados.

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

Toda vez que uma transação for importada, o sistema verifica se alguma palavra-chave aparece na descrição e categoriza automaticamente. A comparação:

- ignora maiúsculas, acentos e pontuação: "farmácia" pega "FARMACIA SAO JOAO", e "uber eats" pega "UBER *EATS";
- exige que a palavra-chave esteja no **começo de uma palavra** da descrição: "farmacia" pega "FARMACIAS", mas "posto" não pega "IMPOSTO";
- aceita **exclusões** com `-` na frente: `mercado, -mercado pago` pega "MERCADO EXTRA", mas não "MERCADO PAGO".

 Se mais de uma categoria bater, vale a criada primeiro. O que não bater fica sem categoria para você escolher na tabela de transações.

### Vale para: entradas, saídas ou as duas

Cada categoria diz para que transações a regra vale (`direction`): **entradas e saídas** (`all`, o padrão), **só saídas** (`out`, valor negativo) ou **só entradas** (`in`, valor positivo).

Isso resolve o texto que aparece nos dois sentidos: no Itaú, por exemplo, "PIX TRANSF MARIA" tanto pode ser um Pix enviado quanto recebido; quem diz é o sinal do valor. Com "pix" em "Transferências enviadas" (só saídas) e em "Transferências recebidas" (só entradas), cada Pix cai na certa. Também evita que um "estorno" vire gasto ou que "salário" pegue um pagamento que você fez.

As categorias são gerenciadas na seção **Categorias** do app (ou pela API):

- `GET /categories`, `POST /categories`: listar e criar
- `PATCH /categories/{id}`: renomear e/ou trocar as palavras-chave (só os campos enviados mudam)
- `DELETE /categories/{id}`: excluir; as transações dela ficam sem categoria (não são apagadas)
- `POST /categories/defaults`: cria as categorias sugeridas que você ainda não tem (botão "Adicionar categorias sugeridas")
- `POST /categories/apply-rules`: aplica as palavras-chave atuais às transações **já importadas que estão sem categoria**. Transações que já têm categoria, inclusive as escolhidas à mão, não são alteradas.

O nome e as palavras-chave são normalizados ao salvar (espaços nas pontas removidos, palavras-chave em minúsculo e sem repetição).

### Categorias sugeridas

Contas novas já nascem com 17 categorias prontas, então o primeiro extrato já sai categorizado:

| Categoria | Vale para | Nos gráficos |
|---|---|---|
| Pagamento de fatura | entradas e saídas | ignorada |
| Estornos e reembolsos | só entradas | conta |
| Salário | só entradas | conta |
| Investimentos (aplicação, resgate, CDB, tesouro, poupança, cofrinho) | entradas e saídas | ignorada |
| Assinaturas, Compras, Alimentação, Mercado, Transporte, Saúde, Moradia, Educação, Lazer, Tarifas bancárias | entradas e saídas | conta |
| Saques | só saídas | conta |
| Transferências enviadas (pix, transf, ted) | só saídas | conta |
| Transferências recebidas (pix, transf, ted) | só entradas | conta |

As transferências ficam por último de propósito: "pix" é genérico, então uma categoria mais específica vence ("PIX ALUGUEL" vai para Moradia, "PIX RECEBIDO SALARIO" vai para Salário). Elas contam nos totais porque um Pix para outra pessoa costuma ser gasto (ou renda) de verdade; para as transferências **entre as suas próprias contas**, que não são gasto nem renda, crie uma categoria com o seu nome como palavra-chave e marque "Ignorar nos gráficos". Como vence a categoria mais antiga, ela precisa ser criada **antes** das de transferência: exclua "Transferências enviadas" e "Transferências recebidas", crie a sua e clique em "Adicionar categorias sugeridas", que recria as duas depois dela. Contas antigas podem adicioná-las pelo botão; as que você já tem (pelo nome) não são alteradas.

A lista fica em `backend/app/services/default_categories.py`. Ao mexer nela, lembre que:

- **A ordem importa:** quando duas categorias batem, vence a que vem primeiro (por isso "Compras", com "mercado livre", vem antes de "Mercado").
- **Palavras curtas ou genéricas pegam demais:** mesmo valendo só no começo das palavras, "bar" pegaria "BARBEARIA" e "99" pegaria "LOJA 99 CENTAVOS". Use exclusões (`-`) ou palavras mais específicas. Os testes em `tests/test_default_categories.py` cobrem esses casos.

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

## Identidade visual

A marca é a letra V que vira uma seta para cima (dinheiro subindo), no degradê ciano `#22d3ee` → azul `#38bdf8`, as mesmas cores do app. Os arquivos ficam em [`Docs/marca`](Docs/marca):

- `vexira-marca.svg` / `.png`: só o símbolo (também é o favicon, em `frontend/public/`)
- `vexira-logo.svg` / `.png`: símbolo + nome, para fundo escuro
- `vexira-logo-claro.svg` / `.png`: símbolo + nome, para fundo claro

No app, a marca é desenhada pelo componente `Logo` (`frontend/src/components/Logo.tsx`), com as cores vindas do tema.
