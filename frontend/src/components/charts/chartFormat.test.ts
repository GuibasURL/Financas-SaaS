import { describe, expect, it } from "vitest";
import { compactThousands, moneyTooltip, monthlyTooltip } from "./chartFormat";

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
});
