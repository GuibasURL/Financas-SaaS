# Deploy da Vexira (plano grátis)

| Peça | Serviço | Arquivo no repositório |
|---|---|---|
| Banco (Postgres) | [Neon](https://neon.tech) | — |
| API (FastAPI) | [Render](https://render.com) | `render.yaml` |
| Site (React) | [Vercel](https://vercel.com) | `frontend/vercel.json` |
| E-mail ("Esqueceu a senha?") | [Brevo](https://www.brevo.com) | — |

Custo: R$ 0. Limitações do plano grátis:

- A API **dorme depois de ~15 minutos sem uso**, e a primeira visita depois disso leva de 30 a 50 segundos. O site mostra "Acordando o servidor…" nesse tempo.
- O banco do Neon também dorme; a primeira consulta leva cerca de 1 segundo a mais.
- Os limites dos planos mudam: confira nos sites.

Siga na ordem: cada passo usa um endereço ou uma senha do anterior. **Senhas e chaves vão só nos painéis dos serviços, nunca no GitHub nem em mensagens.**

## 0. Código na `main`

O Render e a Vercel publicam a partir da branch `main`. Abra um PR de `dev` para `main`, espere o CI ficar verde e faça o merge.

## 1. Banco no Neon

1. Crie a conta (dá para entrar com o GitHub).
2. **New Project**: nome `vexira`, Postgres 17, região **AWS US East (N. Virginia)**, a mesma da API no Render.
3. Em **Connect**, copie a *connection string* (começa com `postgresql://`). Deixe **Connection pooling desligado** (conexão direta): as migrations precisam dela.
4. Guarde essa string: ela é o `DATABASE_URL` do passo 3. Ela contém a senha do banco.

A API cria as tabelas sozinha ao subir (`alembic upgrade head`); não precisa rodar nada no Neon.

## 2. E-mail no Brevo

1. Crie a conta.
2. **Senders, Domains & Dedicated IPs → Senders → Add a sender**: use um e-mail seu (ex: o seu Gmail) e confirme pelo link que chega nele. É o remetente dos e-mails de "Esqueceu a senha?".
3. **SMTP & API → SMTP**: anote o **Login** (algo como `xxxx@smtp-brevo.com`) e clique em **Generate a new SMTP key**. A chave aparece uma vez só: guarde.

Sem domínio próprio, os e-mails podem cair no spam no começo; avise quem for testar.

## 3. API no Render

1. Crie a conta com o GitHub e autorize o acesso ao repositório `financas-saas`.
2. **New → Blueprint**, escolha o repositório: o Render lê o `render.yaml` e mostra o serviço `vexira-api`.
3. Ele pede os valores marcados como secretos:

   | Variável | Valor |
   |---|---|
   | `DATABASE_URL` | a connection string do Neon (passo 1) |
   | `CORS_ORIGINS` | o endereço que o site vai ter na Vercel, ex: `https://vexira.vercel.app` (dá para corrigir depois do passo 4) |
   | `FRONTEND_URL` | o mesmo endereço |
   | `SMTP_USER` | o Login SMTP do Brevo |
   | `SMTP_PASSWORD` | a SMTP key do Brevo |
   | `SMTP_FROM` | `Vexira <o-email-que-voce-verificou@...>` |

   O `SECRET_KEY` é gerado pelo próprio Render (aleatório); não precisa criar nem ver.
4. **Apply**. O primeiro deploy leva alguns minutos. No fim, o painel mostra o endereço da API, como `https://vexira-api.onrender.com`. Abra ele: deve aparecer `{"status":"ok"}`.

## 4. Site na Vercel

1. Crie a conta com o GitHub.
2. **Add New → Project**, importe o `financas-saas`.
3. **Root Directory: `frontend`** (o resto a Vercel lê do `vercel.json`).
4. Em **Environment Variables**: `VITE_API_URL` = o endereço da API do passo 3 (sem `/` no fim). Sem ela o build falha de propósito.
5. **Deploy**. O endereço final aparece no painel (ex: `https://vexira.vercel.app`).
6. Se o endereço for diferente do que você pôs no Render, corrija `CORS_ORIGINS` e `FRONTEND_URL` lá (**Environment** do serviço) e salve: o Render reinicia a API.

## 5. Conferir

No site publicado:

- [ ] Criar conta, sair e entrar de novo.
- [ ] Importar um extrato de exemplo (`backend/tests/fixtures/extratos/`), ver os gráficos e baixar o Excel.
- [ ] "Esqueceu a senha?" com o seu e-mail: o link chega (olhe o spam) e troca a senha.
- [ ] Dar F5 em `/transacoes`: a página abre normalmente (não dá 404).
- [ ] Headers: em [securityheaders.com](https://securityheaders.com), o site e a API devem tirar nota A ou A+.

**IP de quem acessa** (limite de tentativas de login): no Render, **Environment**, adicione `LOG_CLIENT_IP` = `1`. Faça um login errado no site e abra **Logs**. A linha `X-Forwarded-For=[...] -> IP usado=...` precisa mostrar o **seu** IP (veja em [meuip.com.br](https://meuip.com.br)). Se o IP usado for de outra rede (do Render ou de uma CDN), aumente `TRUSTED_PROXY_HOPS` para `2` e confira de novo. No fim, **apague `LOG_CLIENT_IP`**: IP é dado pessoal e não deve ficar no log.

## Depois

- Cada merge na `main` publica sozinho: a API (se algo em `backend/` mudou) e o site.
- Migrations novas rodam sozinhas ao subir a API.
- Backup: o Neon grátis guarda um histórico curto para restaurar o banco; para dados importantes, faça um `pg_dump` de vez em quando.
