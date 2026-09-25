const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

// Abreviação dos meses, como aparece nos filtros e nos gráficos ("mar/2025", "mar/25")
export const MONTH_NAMES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** 1234.5 -> "R$ 1.234,50" (sem sinal; use formatSignedMoney para mostrar + / −) */
export function formatMoney(value: number): string {
  return money.format(Math.abs(value)).replace(/ /g, " ");
}

/** -30 -> "− R$ 30,00", 4000 -> "+ R$ 4.000,00", 0 -> "R$ 0,00" */
export function formatSignedMoney(value: number): string {
  if (value === 0) return formatMoney(0);
  return `${value < 0 ? "−" : "+"} ${formatMoney(value)}`;
}

/** "2025-03-01" -> "01/03/2025" (sem passar por Date, para não sofrer com fuso) */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

/**
 * "2026-09-23T13:30:00" -> "23/09/2026 às 10:30" (no fuso de quem vê).
 * O SQLite devolve o horário em UTC sem indicar o fuso; trata como UTC.
 */
export function formatDateTime(isoDateTime: string): string {
  const hasTimezone = /Z|[+-]\d{2}:\d{2}$/.test(isoDateTime);
  const date = new Date(hasTimezone ? isoDateTime : `${isoDateTime}Z`);
  const day = date.toLocaleDateString("pt-BR");
  const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${day} às ${time}`;
}

/** (1, "transação", "transações") -> "1 transação"; (3, ...) -> "3 transações" */
export function formatCount(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Número de 1 a 12 da cor de categoria (--cat-N), estável pela ordem de criação. */
export function categoryColorVar(index: number): string {
  return `var(--cat-${(index % 12) + 1})`;
}
