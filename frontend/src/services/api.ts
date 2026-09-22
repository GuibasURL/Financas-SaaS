import axios from "axios";
import type {
  Transaction,
  Category,
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

export async function getTransactions(): Promise<Transaction[]> {
  const { data } = await api.get<Transaction[]>("/transactions");
  return data;
}

export async function updateTransactionCategory(
  id: number,
  categoryId: number
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

export async function getByCategoryTotals(): Promise<CategoryTotal[]> {
  const { data } = await api.get<CategoryTotal[]>("/dashboard/by-category");
  return data;
}

export async function getMonthlyTotals(): Promise<MonthlyTotal[]> {
  const { data } = await api.get<MonthlyTotal[]>("/dashboard/monthly");
  return data;
}
