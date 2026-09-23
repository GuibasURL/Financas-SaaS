import { describe, expect, it } from "vitest";
import {
  categoryColorVar,
  formatCount,
  formatDate,
  formatDateTime,
  formatMoney,
  formatSignedMoney,
} from "./format";

describe("format", () => {
  it("dinheiro", () => {
    expect(formatMoney(-1234.5)).toBe("R$ 1.234,50");
    expect(formatSignedMoney(-30)).toBe("− R$ 30,00");
    expect(formatSignedMoney(4000)).toBe("+ R$ 4.000,00");
    expect(formatSignedMoney(0)).toBe("R$ 0,00");
  });

  it("data sem passar por fuso", () => {
    expect(formatDate("2025-03-01")).toBe("01/03/2025");
  });

  it("data e hora no fuso local, com \"às\"", () => {
    // 13:30 UTC = 10:30 em São Paulo (fuso fixado na config de testes)
    expect(formatDateTime("2026-09-23T13:30:00")).toBe("23/09/2026 às 10:30");
    expect(formatDateTime("2026-09-23T13:30:00Z")).toBe("23/09/2026 às 10:30");
  });

  it("contagem no singular e no plural", () => {
    expect(formatCount(0, "transação", "transações")).toBe("0 transações");
    expect(formatCount(1, "transação", "transações")).toBe("1 transação");
    expect(formatCount(2, "arquivo", "arquivos")).toBe("2 arquivos");
  });

  it("cores de categoria dão a volta depois da 12ª", () => {
    expect(categoryColorVar(0)).toBe("var(--cat-1)");
    expect(categoryColorVar(11)).toBe("var(--cat-12)");
    expect(categoryColorVar(12)).toBe("var(--cat-1)");
  });
});
