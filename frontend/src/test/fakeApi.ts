/**
 * API falsa em memória para os testes, usando MSW.
 *
 * O MSW intercepta as requisições HTTP de verdade que o axios faz, então o
 * api.ts roda sem mock nenhum (token no header, interceptor de 401 etc.).
 * As regras imitam o backend só no que o frontend depende: autenticação,
 * 404, nome de categoria repetido, aplicar regras...
 */
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { Category, Statement, Transaction } from "../types/transaction";

export const API = "http://localhost:8000";

interface FakeUser {
  id: number;
  email: string;
  password: string;
}

interface FakeDb {
  users: FakeUser[];
  categories: Category[];
  statements: Statement[];
  transactions: Transaction[];
  nextId: number;
  // Tokens aceitos -> id do usuário (apagar um token simula expiração)
  tokens: Map<string, number>;
}

export let db: FakeDb;
// Último pedido de relatório recebido, para os testes conferirem os filtros
export let lastReportQuery: URLSearchParams | null = null;

export function resetDb() {
  lastReportQuery = null;
  db = { users: [], categories: [], statements: [], transactions: [], nextId: 1, tokens: new Map() };
}
resetDb();

function nextId() {
  return db.nextId++;
}

// ---------- Helpers para montar o cenário dos testes ----------

export function addUser(email = "ana@teste.com", password = "senha-forte-123"): FakeUser {
  const user = { id: nextId(), email, password };
  db.users.push(user);
  return user;
}

/** Cria um token válido para o usuário e já salva no localStorage (usuário logado). */
export function loginAs(user: FakeUser): string {
  const token = `token-${user.id}-${nextId()}`;
  db.tokens.set(token, user.id);
  localStorage.setItem("financas.token", token);
  return token;
}

/** Invalida todos os tokens, como se tivessem expirado. */
export function expireAllTokens() {
  db.tokens.clear();
}

export function addCategory(fields: Partial<Category> & { name: string }): Category {
  const category: Category = {
    id: nextId(),
    keywords: "",
    ignore_in_reports: false,
    direction: "all",
    ...fields,
  };
  db.categories.push(category);
  return category;
}

export function addStatement(
  filename: string,
  rows: { date: string; description: string; amount: number; category_id?: number | null }[]
): Statement {
  const statement: Statement = {
    id: nextId(),
    filename,
    uploaded_at: "2026-09-23T13:30:00",
    transaction_count: rows.length,
    start_date: rows.length ? rows.map((r) => r.date).sort()[0] : null,
    end_date: rows.length ? rows.map((r) => r.date).sort()[rows.length - 1] : null,
  };
  db.statements.push(statement);
  for (const row of rows) {
    db.transactions.push({
      id: nextId(),
      statement_id: statement.id,
      created_at: "2026-09-23T13:30:00",
      category_id: null,
      ...row,
    });
  }
  return statement;
}

// ---------- Regras ----------

function unauthorized() {
  return HttpResponse.json({ detail: "Não autenticado" }, { status: 401 });
}

function notFound(detail: string) {
  return HttpResponse.json({ detail }, { status: 404 });
}

function currentUser(request: Request): FakeUser | null {
  const token = request.headers.get("Authorization")?.replace(/^Bearer /, "") ?? "";
  const userId = db.tokens.get(token);
  return db.users.find((u) => u.id === userId) ?? null;
}

interface HandlerInfo {
  request: Request;
  params: Record<string, string | readonly string[] | undefined>;
}

// Envolve um handler exigindo token válido
function authed(handler: (info: HandlerInfo) => Response | Promise<Response>) {
  return (info: HandlerInfo) => (currentUser(info.request) ? handler(info) : unauthorized());
}

function statementFilter(request: Request) {
  const id = new URL(request.url).searchParams.get("statement_id");
  return (t: Transaction) => !id || t.statement_id === Number(id);
}

function reportable(t: Transaction) {
  const category = db.categories.find((c) => c.id === t.category_id);
  return t.amount < 0 && !category?.ignore_in_reports;
}

export const handlers = [
  http.post(`${API}/auth/register`, async ({ request }) => {
    const { email, password } = (await request.json()) as { email: string; password: string };
    if (password.length < 8) {
      return HttpResponse.json(
        { detail: [{ msg: "Value error, A senha precisa ter pelo menos 8 caracteres" }] },
        { status: 422 }
      );
    }
    const normalized = email.trim().toLowerCase();
    if (db.users.some((u) => u.email === normalized)) {
      return HttpResponse.json({ detail: "E-mail já cadastrado" }, { status: 400 });
    }
    const user = addUser(normalized, password);
    return HttpResponse.json({ id: user.id, email: user.email, created_at: "2026-09-23T13:00:00" }, { status: 201 });
  }),

  http.post(`${API}/auth/login`, async ({ request }) => {
    const form = new URLSearchParams(await request.text());
    const email = (form.get("username") ?? "").trim().toLowerCase();
    const user = db.users.find((u) => u.email === email && u.password === form.get("password"));
    if (!user) {
      return HttpResponse.json({ detail: "E-mail ou senha incorretos" }, { status: 401 });
    }
    const token = `token-${user.id}-${nextId()}`;
    db.tokens.set(token, user.id);
    return HttpResponse.json({ access_token: token, token_type: "bearer" });
  }),

  http.get(`${API}/auth/me`, ({ request }) => {
    const user = currentUser(request);
    return user
      ? HttpResponse.json({ id: user.id, email: user.email, created_at: "2026-09-23T13:00:00" })
      : unauthorized();
  }),

  http.get(
    `${API}/statements`,
    authed(() => HttpResponse.json(db.statements))
  ),

  http.delete(
    `${API}/statements/:id`,
    authed(({ params }) => {
      const id = Number(params.id);
      if (!db.statements.some((s) => s.id === id)) return notFound("Extrato não encontrado");
      db.statements = db.statements.filter((s) => s.id !== id);
      db.transactions = db.transactions.filter((t) => t.statement_id !== id);
      return new HttpResponse(null, { status: 204 });
    })
  ),

  http.get(
    `${API}/transactions`,
    authed(({ request }) =>
      HttpResponse.json(
        db.transactions
          .filter(statementFilter(request))
          .sort((a, b) => b.date.localeCompare(a.date))
      )
    )
  ),

  http.patch(
    `${API}/transactions/:id`,
    authed(async ({ request, params }) => {
      const transaction = db.transactions.find((t) => t.id === Number(params.id));
      if (!transaction) return notFound("Transação não encontrada");
      const body = (await request.json()) as { category_id: number | null };
      transaction.category_id = body.category_id;
      return HttpResponse.json(transaction);
    })
  ),

  http.get(
    `${API}/categories`,
    authed(() => HttpResponse.json([...db.categories].sort((a, b) => a.name.localeCompare(b.name))))
  ),

  http.post(
    `${API}/categories/defaults`,
    authed(() => {
      // A lista de verdade fica no backend; aqui bastam algumas para o teste
      const suggested = [
        { name: "Alimentação", keywords: "ifood,padaria" },
        { name: "Transporte", keywords: "uber" },
        { name: "Saúde", keywords: "farmácia,academia" },
      ];
      const existing = new Set(db.categories.map((c) => c.name.toLowerCase()));
      const missing = suggested.filter((c) => !existing.has(c.name.toLowerCase()));
      missing.forEach((c) => addCategory(c));
      return HttpResponse.json({ created: missing.length });
    })
  ),

  http.post(
    `${API}/categories/apply-rules`,
    authed(() => {
      let categorized = 0;
      for (const t of db.transactions.filter((t) => t.category_id === null)) {
        // Como no backend: "só entradas"/"só saídas" dependem do sinal do valor
        const match = db.categories.find(
          (c) =>
            (c.direction === "all" || (c.direction === "in" ? t.amount > 0 : t.amount < 0)) &&
            c.keywords.split(",").some((k) => k && t.description.toLowerCase().includes(k))
        );
        if (match) {
          t.category_id = match.id;
          categorized++;
        }
      }
      return HttpResponse.json({ categorized });
    })
  ),

  http.post(
    `${API}/categories`,
    authed(async ({ request }) => {
      const body = (await request.json()) as Omit<Category, "id">;
      if (db.categories.some((c) => c.name === body.name.trim())) {
        return HttpResponse.json({ detail: "Categoria já existe" }, { status: 400 });
      }
      return HttpResponse.json(addCategory({ ...body, name: body.name.trim() }));
    })
  ),

  http.patch(
    `${API}/categories/:id`,
    authed(async ({ request, params }) => {
      const category = db.categories.find((c) => c.id === Number(params.id));
      if (!category) return notFound("Categoria não encontrada");
      const changes = (await request.json()) as Partial<Category>;
      if (changes.name && db.categories.some((c) => c.name === changes.name && c.id !== category.id)) {
        return HttpResponse.json({ detail: "Categoria já existe" }, { status: 400 });
      }
      Object.assign(category, changes);
      return HttpResponse.json(category);
    })
  ),

  http.delete(
    `${API}/categories/:id`,
    authed(({ params }) => {
      const id = Number(params.id);
      if (!db.categories.some((c) => c.id === id)) return notFound("Categoria não encontrada");
      db.categories = db.categories.filter((c) => c.id !== id);
      db.transactions.forEach((t) => {
        if (t.category_id === id) t.category_id = null;
      });
      return new HttpResponse(null, { status: 204 });
    })
  ),

  http.get(
    `${API}/dashboard/by-category`,
    authed(({ request }) => {
      const totals = new Map<string, number>();
      for (const t of db.transactions.filter(statementFilter(request)).filter(reportable)) {
        const category = db.categories.find((c) => c.id === t.category_id);
        if (category) totals.set(category.name, (totals.get(category.name) ?? 0) + t.amount);
      }
      return HttpResponse.json([...totals].map(([category, total]) => ({ category, total })));
    })
  ),

  http.get(
    `${API}/dashboard/monthly`,
    authed(({ request }) => {
      const totals = new Map<string, number>();
      for (const t of db.transactions.filter(statementFilter(request)).filter(reportable)) {
        const key = t.date.slice(0, 7);
        totals.set(key, (totals.get(key) ?? 0) + t.amount);
      }
      return HttpResponse.json(
        [...totals].sort().map(([key, total]) => ({
          year: Number(key.slice(0, 4)),
          month: Number(key.slice(5, 7)),
          total,
        }))
      );
    })
  ),

  http.post(
    `${API}/upload`,
    authed(async ({ request }) => {
      const file = (await request.formData()).get("file") as File;
      if (!/\.(csv|ofx)$/i.test(file.name)) {
        return HttpResponse.json({ detail: "Envie um arquivo .csv ou .ofx" }, { status: 400 });
      }
      const statement = addStatement(file.name, [
        { date: "2025-05-01", description: "IMPORTADO", amount: -10 },
      ]);
      return HttpResponse.json(db.transactions.filter((t) => t.statement_id === statement.id));
    })
  ),
];

handlers.push(
  http.get(
    `${API}/reports/export`,
    authed(({ request }) => {
      const query = new URL(request.url).searchParams;
      lastReportQuery = query;
      const start = query.get("start_date");
      const end = query.get("end_date");
      if (start && end && start > end) {
        return HttpResponse.json(
          { detail: "A data inicial é depois da data final" },
          { status: 400 }
        );
      }
      return new HttpResponse("conteudo-xlsx", {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="vexira-relatorio_${start ?? "inicio"}_a_${end ?? "hoje"}.xlsx"`,
        },
      });
    })
  )
);

export const server = setupServer(...handlers);
