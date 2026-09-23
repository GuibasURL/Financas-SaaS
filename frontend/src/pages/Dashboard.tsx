import { useEffect, useState } from "react";
import UploadCSV from "../components/UploadCSV";
import StatementList from "../components/StatementList";
import CategoryManager from "../components/CategoryManager";
import TransactionTable from "../components/TransactionTable";
import CategoryPieChart from "../components/charts/CategoryPieChart";
import MonthlyTrendChart from "../components/charts/MonthlyTrendChart";
import {
  getTransactions,
  getByCategoryTotals,
  getMonthlyTotals,
  getCategories,
  getStatements,
  deleteStatement,
  updateTransactionCategory,
} from "../services/api";
import type {
  Transaction,
  Category,
  Statement,
  CategoryTotal,
  MonthlyTotal,
} from "../types/transaction";
import type { User } from "../types/user";

interface Props {
  user: User;
  onLogout: () => void;
}

export default function Dashboard({ user, onLogout }: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [byCategory, setByCategory] = useState<CategoryTotal[]>([]);
  const [monthly, setMonthly] = useState<MonthlyTotal[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [statements, setStatements] = useState<Statement[]>([]);
  // null = todos os extratos
  const [selectedStatementId, setSelectedStatementId] = useState<number | null>(
    null
  );
  const [loadError, setLoadError] = useState<string | null>(null);

  async function loadAll() {
    try {
      const [t, c, m, cats, s] = await Promise.all([
        getTransactions(selectedStatementId),
        getByCategoryTotals(selectedStatementId),
        getMonthlyTotals(selectedStatementId),
        getCategories(),
        getStatements(),
      ]);
      setTransactions(t);
      setByCategory(c);
      setMonthly(m);
      setCategories(cats);
      setStatements(s);
      setLoadError(null);
    } catch (err) {
      // 401 já é tratado no api.ts (volta para o login); o resto vira aviso
      if ((err as any)?.response?.status !== 401) {
        setLoadError("Não foi possível carregar os dados. Verifique se a API está rodando.");
      }
    }
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
      setByCategory(await getByCategoryTotals(selectedStatementId));
    } catch {
      alert("Não foi possível atualizar a categoria.");
    }
  }

  async function handleDeleteStatement(statement: Statement) {
    const confirmed = confirm(
      `Excluir o extrato "${statement.filename}" e suas ` +
        `${statement.transaction_count} transações? Isso não pode ser desfeito.`
    );
    if (!confirmed) return;

    try {
      await deleteStatement(statement.id);
    } catch {
      alert("Não foi possível excluir o extrato.");
      return;
    }

    if (statement.id === selectedStatementId) {
      // Trocar o filtro já dispara o recarregamento pelo useEffect
      setSelectedStatementId(null);
    } else {
      loadAll();
    }
  }

  useEffect(() => {
    loadAll();
  }, [selectedStatementId]);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <header
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        <h1>Finanças SaaS</h1>
        <div>
          <span>{user.email}</span>{" "}
          <button onClick={onLogout}>Sair</button>
        </div>
      </header>

      {loadError && <p style={{ color: "red" }}>{loadError}</p>}

      <section>
        <h2>Importar extrato</h2>
        <UploadCSV onUploaded={loadAll} />
      </section>

      <section>
        <h2>Extratos</h2>
        <StatementList
          statements={statements}
          selectedId={selectedStatementId}
          onSelect={setSelectedStatementId}
          onDelete={handleDeleteStatement}
        />
      </section>

      <section>
        <h2>Categorias</h2>
        <CategoryManager categories={categories} onChanged={loadAll} />
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
