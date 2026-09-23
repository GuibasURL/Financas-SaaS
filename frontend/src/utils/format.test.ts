import { describe, expect, it } from "vitest";
import { categoryColorVar, formatDate, formatMoney, formatSignedMoney } from "./format";

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

  it("cores de categoria dão a volta depois da 12ª", () => {
    expect(categoryColorVar(0)).toBe("var(--cat-1)");
    expect(categoryColorVar(11)).toBe("var(--cat-12)");
    expect(categoryColorVar(12)).toBe("var(--cat-1)");
  });
});
