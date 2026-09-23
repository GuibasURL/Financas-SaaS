/**
 * Filtros da tela de Transações (busca, categoria, mês e tipo). Tudo roda no
 * navegador: as transações do extrato selecionado já estão carregadas.
 */
import type { Transaction } from "../types/transaction";

export type CategoryFilter = "all" | "none" | number;
export type KindFilter = "all" | "in" | "out";

export interface TransactionFilters {
  search: string;
  category: CategoryFilter;
  // "2025-03" ou "all"
  month: string;
  kind: KindFilter;
}

export const NO_FILTERS: TransactionFilters = {
  search: "",
  category: "all",
  month: "all",
  kind: "all",
};

export function hasActiveFilters(filters: TransactionFilters): boolean {
  return (
    filters.search.trim() !== "" ||
    filters.category !== "all" ||
    filters.month !== "all" ||
    filters.kind !== "all"
  );
}

/** "Farmácia São João" -> "farmacia sao joao" (busca sem acento e sem caixa) */
export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function filterTransactions(
  transactions: Transaction[],
  filters: TransactionFilters
): Transaction[] {
  const search = normalizeText(filters.search.trim());
  return transactions.filter(
    (t) =>
      (search === "" || normalizeText(t.description).includes(search)) &&
      (filters.category === "all" ||
        (filters.category === "none"
          ? t.category_id === null
          : t.category_id === filters.category)) &&
      (filters.month === "all" || t.date.startsWith(filters.month)) &&
      (filters.kind === "all" || (filters.kind === "in" ? t.amount > 0 : t.amount < 0))
  );
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Meses que têm transação, do mais recente para o mais antigo: [{ value: "2025-03", label: "mar/2025" }] */
export function monthOptions(transactions: Transaction[]): { value: string; label: string }[] {
  const months = [...new Set(transactions.map((t) => t.date.slice(0, 7)))].sort().reverse();
  return months.map((value) => {
    const [year, month] = value.split("-");
    return { value, label: `${MONTHS[Number(month) - 1]}/${year}` };
  });
}

export interface ResultTotals {
  income: number;
  expense: number;
  // Transações de categorias ignoradas: aparecem na lista, fora dos totais
  ignored: number;
}

/** Entradas e saídas do resultado, sem as categorias ignoradas (igual aos cards da Visão geral) */
export function resultTotals(
  transactions: Transaction[],
  ignoredCategoryIds: Set<number>
): ResultTotals {
  const totals: ResultTotals = { income: 0, expense: 0, ignored: 0 };
  for (const t of transactions) {
    if (t.category_id !== null && ignoredCategoryIds.has(t.category_id)) {
      totals.ignored += 1;
    } else if (t.amount > 0) {
      totals.income += t.amount;
    } else {
      totals.expense += t.amount;
    }
  }
  // Arredonda para não mostrar erro de ponto flutuante
  totals.income = Math.round(totals.income * 100) / 100;
  totals.expense = Math.round(totals.expense * 100) / 100;
  return totals;
}
