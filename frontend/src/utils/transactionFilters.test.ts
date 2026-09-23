import { describe, expect, it } from "vitest";
import type { Transaction } from "../types/transaction";
import {
  filterTransactions,
  hasActiveFilters,
  monthOptions,
  NO_FILTERS,
  normalizeText,
  resultTotals,
} from "./transactionFilters";

let id = 0;
function tx(date: string, description: string, amount: number, category_id: number | null = null) {
  return { id: ++id, date, description, amount, category_id, statement_id: 1, created_at: "" } as Transaction;
}

const ifood = tx("2025-03-01", "IFOOD *RESTAURANTE", -30, 1);
const farmacia = tx("2025-03-10", "FARMÁCIA SÃO JOÃO", -45.5);
const salario = tx("2025-04-05", "SALARIO EMPRESA", 4000, 2);
const fatura = tx("2025-04-10", "PAGAMENTO DE FATURA", -900, 3);
const all = [fatura, salario, farmacia, ifood];

const ids = (list: Transaction[]) => list.map((t) => t.description);

describe("filtros de transações", () => {
  it("sem filtro devolve tudo", () => {
    expect(filterTransactions(all, NO_FILTERS)).toEqual(all);
    expect(hasActiveFilters(NO_FILTERS)).toBe(false);
  });

  it("busca ignora maiúsculas, acentos e espaços nas pontas", () => {
    expect(ids(filterTransactions(all, { ...NO_FILTERS, search: "  farmacia sao " }))).toEqual([
      "FARMÁCIA SÃO JOÃO",
    ]);
    expect(ids(filterTransactions(all, { ...NO_FILTERS, search: "Ifood" }))).toEqual([
      "IFOOD *RESTAURANTE",
    ]);
    expect(normalizeText("Ação")).toBe("acao");
  });

  it("busca só com espaços não conta como filtro", () => {
    expect(hasActiveFilters({ ...NO_FILTERS, search: "   " })).toBe(false);
  });

  it("categoria: uma específica ou só as sem categoria", () => {
    expect(ids(filterTransactions(all, { ...NO_FILTERS, category: 1 }))).toEqual([
      "IFOOD *RESTAURANTE",
    ]);
    expect(ids(filterTransactions(all, { ...NO_FILTERS, category: "none" }))).toEqual([
      "FARMÁCIA SÃO JOÃO",
    ]);
  });

  it("mês e tipo", () => {
    expect(ids(filterTransactions(all, { ...NO_FILTERS, month: "2025-03" }))).toEqual([
      "FARMÁCIA SÃO JOÃO",
      "IFOOD *RESTAURANTE",
    ]);
    expect(ids(filterTransactions(all, { ...NO_FILTERS, kind: "in" }))).toEqual(["SALARIO EMPRESA"]);
    expect(filterTransactions(all, { ...NO_FILTERS, kind: "out" })).toHaveLength(3);
  });

  it("filtros se combinam", () => {
    const filters = { ...NO_FILTERS, month: "2025-04", kind: "out" as const };
    expect(ids(filterTransactions(all, filters))).toEqual(["PAGAMENTO DE FATURA"]);
    expect(hasActiveFilters(filters)).toBe(true);
  });

  it("meses do mais recente para o mais antigo, sem repetir", () => {
    expect(monthOptions([...all, tx("2024-12-31", "X", -1)])).toEqual([
      { value: "2025-04", label: "abr/2025" },
      { value: "2025-03", label: "mar/2025" },
      { value: "2024-12", label: "dez/2024" },
    ]);
  });

  it("totais deixam de fora as categorias ignoradas e arredondam", () => {
    const totals = resultTotals(
      [...all, tx("2025-03-02", "A", -0.1), tx("2025-03-02", "B", -0.2)],
      new Set([3])
    );
    expect(totals).toEqual({ income: 4000, expense: -75.8, ignored: 1 });
  });
});
