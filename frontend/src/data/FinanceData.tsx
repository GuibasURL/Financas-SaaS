/**
 * Dados financeiros compartilhados entre as páginas (Visão geral,
 * Transações, Categorias, Extratos): carregados uma vez e atualizados
 * depois de cada mudança. O filtro de extrato vale para todas as páginas.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  deleteStatement as apiDeleteStatement,
  getByCategoryTotals,
  getCategories,
  getMonthlyTotals,
  getStatements,
  getTransactions,
  updateTransactionCategory,
} from "../services/api";
import type {
  Category,
  CategoryTotal,
  MonthlyTotal,
  Statement,
  Transaction,
} from "../types/transaction";
import { useFeedback } from "../feedback/Feedback";
import { categoryColorVar } from "../utils/format";

interface FinanceData {
  transactions: Transaction[];
  byCategory: CategoryTotal[];
  monthly: MonthlyTotal[];
  categories: Category[];
  statements: Statement[];
  // null = todos os extratos
  selectedStatementId: number | null;
  selectedStatement: Statement | null;
  selectStatement: (id: number | null) => void;
  loaded: boolean;
  loadError: string | null;
  reload: () => Promise<void>;
  changeTransactionCategory: (transactionId: number, categoryId: number | null) => Promise<void>;
  deleteStatement: (statement: Statement) => Promise<void>;
  /** Cor (var(--cat-N)) de uma categoria, pelo id ou pelo nome */
  categoryColor: (idOrName: number | string) => string;
}

function deleteStatementMessage({ filename, transaction_count: count }: Statement) {
  if (count === 0) return `O extrato "${filename}" será apagado. Isso não pode ser desfeito.`;
  const transactions = count === 1 ? "a transação dele" : `as ${count} transações dele`;
  return `O extrato "${filename}" e ${transactions} serão apagados. Isso não pode ser desfeito.`;
}

const FinanceDataContext = createContext<FinanceData | null>(null);

export function useFinanceData(): FinanceData {
  const data = useContext(FinanceDataContext);
  if (!data) throw new Error("useFinanceData precisa estar dentro de <FinanceDataProvider>");
  return data;
}

export function FinanceDataProvider({ children }: { children: ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [byCategory, setByCategory] = useState<CategoryTotal[]>([]);
  const [monthly, setMonthly] = useState<MonthlyTotal[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [selectedStatementId, setSelectedStatementId] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { confirm, toast } = useFeedback();

  const reload = useCallback(async () => {
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
        setLoadError("Não foi possível carregar os dados. Verifique sua conexão e tente de novo.");
      }
    } finally {
      setLoaded(true);
    }
  }, [selectedStatementId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const changeTransactionCategory = useCallback(
    async (transactionId: number, categoryId: number | null) => {
      try {
        const updated = await updateTransactionCategory(transactionId, categoryId);
        setTransactions((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        // Recategorizar muda os totais do gráfico de categorias
        setByCategory(await getByCategoryTotals(selectedStatementId));
      } catch {
        toast.error("Não foi possível atualizar a categoria.");
      }
    },
    [selectedStatementId, toast]
  );

  const deleteStatement = useCallback(
    async (statement: Statement) => {
      try {
        const deleted = await confirm({
          title: "Excluir extrato?",
          message: deleteStatementMessage(statement),
          confirmLabel: "Excluir extrato",
          action: () => apiDeleteStatement(statement.id),
        });
        if (!deleted) return;
      } catch {
        toast.error("Não foi possível excluir o extrato.");
        return;
      }
      toast.success("Extrato excluído.");

      if (statement.id === selectedStatementId) {
        // Trocar o filtro já dispara o recarregamento
        setSelectedStatementId(null);
      } else {
        await reload();
      }
    },
    [selectedStatementId, reload, confirm, toast]
  );

  // Cor estável por categoria: segue a ordem de criação (id), não a do gráfico
  const categoryColor = useMemo(() => {
    const byId = new Map<number | string, string>();
    [...categories]
      .sort((a, b) => a.id - b.id)
      .forEach((c, index) => {
        byId.set(c.id, categoryColorVar(index));
        byId.set(c.name, categoryColorVar(index));
      });
    return (idOrName: number | string) => byId.get(idOrName) ?? "var(--cat-11)";
  }, [categories]);

  const value: FinanceData = {
    transactions,
    byCategory,
    monthly,
    categories,
    statements,
    selectedStatementId,
    selectedStatement: statements.find((s) => s.id === selectedStatementId) ?? null,
    selectStatement: setSelectedStatementId,
    loaded,
    loadError,
    reload,
    changeTransactionCategory,
    deleteStatement,
    categoryColor,
  };

  return <FinanceDataContext.Provider value={value}>{children}</FinanceDataContext.Provider>;
}
