import axios from "axios";
import type {
  Transaction,
  Category,
  Statement,
  CategoryTotal,
  MonthlyTotal,
} from "../types/transaction";

const api = axios.create({
  baseURL: "http://localhost:8000",
});

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
