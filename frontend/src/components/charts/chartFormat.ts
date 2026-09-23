import { formatMoney } from "../../utils/format";

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
