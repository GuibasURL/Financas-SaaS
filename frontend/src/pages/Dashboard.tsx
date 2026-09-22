import { useEffect, useState } from "react";
import UploadCSV from "../components/UploadCSV";
import TransactionTable from "../components/TransactionTable";
import CategoryPieChart from "../components/charts/CategoryPieChart";
import MonthlyTrendChart from "../components/charts/MonthlyTrendChart";
import {
  getTransactions,
  getByCategoryTotals,
  getMonthlyTotals,
} from "../services/api";
import type { Transaction, CategoryTotal, MonthlyTotal } from "../types/transaction";

export default function Dashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [byCategory, setByCategory] = useState<CategoryTotal[]>([]);
  const [monthly, setMonthly] = useState<MonthlyTotal[]>([]);

  async function loadAll() {
    const [t, c, m] = await Promise.all([
      getTransactions(),
      getByCategoryTotals(),
      getMonthlyTotals(),
    ]);
    setTransactions(t);
    setByCategory(c);
    setMonthly(m);
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
        <TransactionTable transactions={transactions} />
      </section>
    </div>
  );
}
