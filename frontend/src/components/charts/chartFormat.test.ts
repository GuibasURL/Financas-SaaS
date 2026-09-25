import { describe, expect, it } from "vitest";
import { compactThousands, moneyTooltip, monthlySeries, monthlyTooltip } from "./chartFormat";

describe("formatação dos gráficos", () => {
  it.each([
    [800, "800"],
    [1000, "1 mil"],
    [1500, "1,5 mil"],
    [6000, "6 mil"],
  ])("eixo Y: %d -> %s", (value, expected) => {
    expect(compactThousands(value)).toBe(expected);
  });

  it("tooltips em reais", () => {
    expect(moneyTooltip(1234.5)).toBe("R$ 1.234,50");
    expect(monthlyTooltip(5310.2)).toEqual(["R$ 5.310,20", "Gastos"]);
  });

  it("gráfico mensal: meses sem gasto entram com 0, mesmo virando o ano", () => {
    const series = monthlySeries([
      { year: 2026, month: 2, total: -300 },
      { year: 2025, month: 11, total: -120.5 },
    ]);

    expect(series).toEqual([
      { label: "nov/25", total: 120.5 },
      { label: "dez/25", total: 0 },
      { label: "jan/26", total: 0 },
      { label: "fev/26", total: 300 },
    ]);
  });

  it("gráfico mensal: sem dados, sem pontos", () => {
    expect(monthlySeries([])).toEqual([]);
  });
});
