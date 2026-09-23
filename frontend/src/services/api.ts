import axios from "axios";
import type {
  Transaction,
  Category,
  Statement,
  CategoryTotal,
  MonthlyTotal,
} from "../types/transaction";
import type { TokenResponse, User } from "../types/user";

// Endereço da API: configurável por VITE_API_URL (ex: no deploy), com o
// backend local como padrão
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000",
});

// ---------- Token de login ----------
// Fica no localStorage para o login sobreviver a um F5. Os acessos ficam
// dentro de try/catch porque o navegador pode bloquear o storage.

const TOKEN_KEY = "financas.token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // sem storage o login só dura até recarregar a página
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // nada a limpar
  }
}

// Chamado quando a API responde 401 com um token salvo (ex: token expirado)
let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Sem token salvo, o 401 é só "senha errada" no login: não desloga ninguém
    if (error.response?.status === 401 && getToken()) {
      clearToken();
      unauthorizedHandler?.();
    }
    return Promise.reject(error);
  }
);

/**
 * Mensagem legível a partir de um erro da API. O FastAPI devolve `detail`
 * como texto (erros nossos) ou como lista (erros de validação, 422).
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  const detail = (error as any)?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) => String(d?.msg ?? "").replace(/^Value error, /, ""))
      .filter(Boolean)
      .join(". ");
  }
  return fallback;
}

// ---------- Autenticação ----------

export async function login(email: string, password: string): Promise<void> {
  // O endpoint segue o padrão OAuth2: form-data com "username" (o e-mail)
  const form = new URLSearchParams({ username: email, password });
  const { data } = await api.post<TokenResponse>("/auth/login", form);
  setToken(data.access_token);
}

export async function register(email: string, password: string): Promise<User> {
  const { data } = await api.post<User>("/auth/register", { email, password });
  return data;
}

export async function getMe(): Promise<User> {
  const { data } = await api.get<User>("/auth/me");
  return data;
}

// ---------- Dados ----------

export async function uploadCSV(file: File): Promise<Transaction[]> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post<Transaction[]>("/upload", formData);
  return data;
}

// statementId opcional: sem ele, considera todos os extratos
function statementParams(statementId?: number | null) {
  return statementId ? { params: { statement_id: statementId } } : undefined;
}

export async function getTransactions(
  statementId?: number | null
): Promise<Transaction[]> {
  const { data } = await api.get<Transaction[]>(
    "/transactions",
    statementParams(statementId)
  );
  return data;
}

export async function updateTransactionCategory(
  id: number,
  categoryId: number | null
): Promise<Transaction> {
  const { data } = await api.patch<Transaction>(`/transactions/${id}`, {
    category_id: categoryId,
  });
  return data;
}

export async function getCategories(): Promise<Category[]> {
  const { data } = await api.get<Category[]>("/categories");
  return data;
}

export async function getStatements(): Promise<Statement[]> {
  const { data } = await api.get<Statement[]>("/statements");
  return data;
}

export async function deleteStatement(id: number): Promise<void> {
  await api.delete(`/statements/${id}`);
}

export async function getByCategoryTotals(
  statementId?: number | null
): Promise<CategoryTotal[]> {
  const { data } = await api.get<CategoryTotal[]>(
    "/dashboard/by-category",
    statementParams(statementId)
  );
  return data;
}

export async function getMonthlyTotals(
  statementId?: number | null
): Promise<MonthlyTotal[]> {
  const { data } = await api.get<MonthlyTotal[]>(
    "/dashboard/monthly",
    statementParams(statementId)
  );
  return data;
}
