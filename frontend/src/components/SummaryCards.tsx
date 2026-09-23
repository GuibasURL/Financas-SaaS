import { useFinanceData } from "../data/FinanceData";
import { formatMoney, formatSignedMoney } from "../utils/format";
import styles from "./SummaryCards.module.css";

function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/**
 * Entradas, saídas e saldo das transações carregadas (já filtradas pelo
 * extrato selecionado). Categorias marcadas como "ignorar nos gráficos"
 * ficam de fora, como no dashboard e no relatório.
 */
export default function SummaryCards() {
  const { transactions, categories } = useFinanceData();

  const ignoredIds = new Set(categories.filter((c) => c.ignore_in_reports).map((c) => c.id));
  const counted = transactions.filter((t) => t.category_id === null || !ignoredIds.has(t.category_id));
  const incomes = counted.filter((t) => t.amount > 0);
  const expenses = counted.filter((t) => t.amount < 0);
  const income = incomes.reduce((sum, t) => sum + t.amount, 0);
  const expense = expenses.reduce((sum, t) => sum + t.amount, 0);
  const balance = income + expense;
  const ignored = transactions.length - counted.length;

  return (
    <>
      <section className={styles.kpi} aria-label="Entradas">
        <div className={styles.label}>Entradas</div>
        <div className={`${styles.value} ${styles.in}`}>{formatSignedMoney(income)}</div>
        <div className={styles.sub}>{plural(incomes.length, "transação", "transações")}</div>
      </section>
      <section className={styles.kpi} aria-label="Saídas">
        <div className={styles.label}>Saídas</div>
        <div className={`${styles.value} ${styles.out}`}>{formatSignedMoney(expense)}</div>
        <div className={styles.sub}>{plural(expenses.length, "transação", "transações")}</div>
      </section>
      <section className={styles.kpi} aria-label="Saldo do período">
        <div className={styles.label}>Saldo do período</div>
        <div className={styles.value}>
          {balance < 0 ? "−" : ""}
          {formatMoney(balance)}
        </div>
        <div className={styles.sub}>
          {ignored > 0
            ? `${plural(ignored, "transação ignorada", "transações ignoradas")} nos totais`
            : "Entradas menos saídas"}
        </div>
      </section>
    </>
  );
}
