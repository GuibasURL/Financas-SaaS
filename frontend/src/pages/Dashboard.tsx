import { useEffect, useState } from "react";
import UploadCSV from "../components/UploadCSV";
import TransactionTable from "../components/TransactionTable";
import CategoryPieChart from "../components/charts/CategoryPieChart";
import MonthlyTrendChart from "../components/charts/MonthlyTrendChart";
import {
  getTransactions,
  getByCategoryTotals,
  getMonthlyTotals,
  getCategories,
  updateTransactionCategory,
} from "../services/api";
import type {
  Transaction,
  Category,
  CategoryTotal,
  MonthlyTotal,
} from "../types/transaction";

export default function Dashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [byCategory, setByCategory] = useState<CategoryTotal[]>([]);
  const [monthly, setMonthly] = useState<MonthlyTotal[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  async function loadAll() {
    const [t, c, m, cats] = await Promise.all([
      getTransactions(),
      getByCategoryTotals(),
      getMonthlyTotals(),
      getCategories(),
    ]);
    setTransactions(t);
    setByCategory(c);
    setMonthly(m);
    setCategories(cats);
  }

  async function handleCategoryChange(
    transactionId: number,
    categoryId: number | null
  ) {
    try {
      const updated = await updateTransactionCategory(transactionId, categoryId);
      setTransactions((prev) =>
        prev.map((t) => (t.id === updated.id ? updated : t))
      );
      // Recategorizar muda os totais do gráfico de pizza
      setByCategory(await getByCategoryTotals());
    } catch {
      alert("Não foi possível atualizar a categoria.");
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <h1>Finanças SaaS</h1>

      <section>
        <h2>Importar extrato</h2>
        <UploadCSV onUploaded={loadAll} />
      </section>

      <section>
        <h2>Gastos por categoria</h2>
        <CategoryPieChart data={byCategory} />
      </section>

      <section>
        <h2>Evolução mensal</h2>
        <MonthlyTrendChart data={monthly} />
      </section>

      <section>
        <h2>Transações</h2>
        <TransactionTable
          transactions={transactions}
          categories={categories}
          onCategoryChange={handleCategoryChange}
        />
      </section>
    </div>
  );
}
