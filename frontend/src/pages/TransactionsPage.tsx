import PageHeader from "../components/PageHeader";
import TransactionTable from "../components/TransactionTable";
import { useFinanceData } from "../data/FinanceData";
import styles from "./pages.module.css";

export default function TransactionsPage() {
  const { transactions, categories, changeTransactionCategory } = useFinanceData();
  const uncategorized = transactions.filter((t) => t.category_id === null).length;

  return (
    <>
      <PageHeader
        title="Transações"
        eyebrow={`${transactions.length} transações · ${uncategorized} sem categoria`}
      />
      <div className={styles.stack}>
        <section className="card" aria-label="Lista de transações">
          <TransactionTable
            transactions={transactions}
            categories={categories}
            onCategoryChange={changeTransactionCategory}
          />
        </section>
      </div>
    </>
  );
}
