import { useFinanceData } from "../data/FinanceData";
import { formatMoney, formatSignedMoney } from "../utils/format";
import styles from "./SummaryCards.module.css";

function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/**
 * Entradas, saídas e saldo das transações carregadas (já filtradas pelo
 * extrato selecionado). Categorias marcadas como "fora dos totais" não
 * entram, como nos gráficos e no relatório.
 */
export default function SummaryCards() {
  const { transactions, categories, loaded } = useFinanceData();

  const ignoredIds = new Set(categories.filter((c) => c.ignore_in_reports).map((c) => c.id));
  const counted = transactions.filter((t) => t.category_id === null || !ignoredIds.has(t.category_id));
  const incomes = counted.filter((t) => t.amount > 0);
  const expenses = counted.filter((t) => t.amount < 0);
  const income = incomes.reduce((sum, t) => sum + t.amount, 0);
  const expense = expenses.reduce((sum, t) => sum + t.amount, 0);
  const balance = income + expense;
  const ignored = transactions.length - counted.length;

  // Carregando: faixa no lugar do valor, para não mostrar R$ 0,00 como se a conta estivesse vazia
  const value = (text: string) =>
    loaded ? text : <span className="skeleton-bar" aria-hidden="true" />;
  const sub = (text: string) => (loaded ? text : "Carregando…");

  return (
    <>
      <section className={styles.kpi} aria-label="Entradas" aria-busy={!loaded}>
        <div className={styles.label}>Entradas</div>
        <div className={`${styles.value} ${styles.in}`}>{value(formatSignedMoney(income))}</div>
        <div className={styles.sub}>{sub(plural(incomes.length, "transação", "transações"))}</div>
      </section>
      <section className={styles.kpi} aria-label="Saídas" aria-busy={!loaded}>
        <div className={styles.label}>Saídas</div>
        <div className={`${styles.value} ${styles.out}`}>{value(formatSignedMoney(expense))}</div>
        <div className={styles.sub}>{sub(plural(expenses.length, "transação", "transações"))}</div>
      </section>
      <section className={styles.kpi} aria-label="Saldo do período" aria-busy={!loaded}>
        <div className={styles.label}>Saldo do período</div>
        <div className={styles.value}>
          {value(`${balance < 0 ? "−" : ""}${formatMoney(balance)}`)}
        </div>
        <div className={styles.sub}>
          {sub(
            ignored > 0
              ? `${plural(ignored, "transação", "transações")} fora dos totais`
              : "Entradas menos saídas"
          )}
        </div>
      </section>
    </>
  );
}
