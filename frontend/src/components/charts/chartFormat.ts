import type { MonthlyTotal } from "../../types/transaction";
import { formatMoney, MONTH_NAMES } from "../../utils/format";

/**
 * Pontos do gráfico mensal, um por mês do primeiro ao último, com os meses
 * sem gasto valendo 0: sem isso, a linha ligaria março direto a fevereiro do
 * ano seguinte, como se os meses do meio não existissem.
 * [{ year: 2025, month: 3, total: -120 }] -> [{ label: "mar/25", total: 120 }]
 */
export function monthlySeries(data: MonthlyTotal[]): { label: string; total: number }[] {
  if (data.length === 0) return [];
  const indexOf = (d: { year: number; month: number }) => d.year * 12 + (d.month - 1);
  const totals = new Map(data.map((d) => [indexOf(d), Math.abs(d.total)]));
  const indexes = [...totals.keys()];
  const series = [];
  for (let i = Math.min(...indexes); i <= Math.max(...indexes); i++) {
    const year = Math.floor(i / 12);
    series.push({
      label: `${MONTH_NAMES[i % 12]}/${String(year).slice(-2)}`,
      total: totals.get(i) ?? 0,
    });
  }
  return series;
}

/** Eixo Y: 6000 -> "6 mil", 1500 -> "1,5 mil", 800 -> "800" */
export function compactThousands(value: number): string {
  if (value < 1000) return String(value);
  return `${(value / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
}

/** Tooltip da rosca: só o valor em reais */
export function moneyTooltip(value: number): string {
  return formatMoney(value);
}

/** Tooltip da evolução mensal: [valor, rótulo] */
export function monthlyTooltip(value: number): [string, string] {
  return [formatMoney(value), "Gastos"];
}

export const TOOLTIP_STYLE = {
  border: "1px solid var(--line)",
  borderRadius: 6,
  background: "#0e1b2e",
  color: "var(--text)",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
};
