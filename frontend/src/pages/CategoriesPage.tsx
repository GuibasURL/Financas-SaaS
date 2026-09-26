import { useMemo } from "react";
import CategoryManager, { type CategoryStats } from "../components/CategoryManager";
import PageHeader from "../components/PageHeader";
import Skeleton from "../components/Skeleton";
import { useFinanceData } from "../data/FinanceData";

export default function CategoriesPage() {
  const { categories, transactions, reload, categoryColor, loaded } = useFinanceData();

  // Quantidade e soma por categoria (respeita o filtro de extrato, como as outras páginas)
  const stats = useMemo(() => {
    const byCategory = new Map<number, CategoryStats>();
    for (const t of transactions) {
      if (t.category_id === null) continue;
      const current = byCategory.get(t.category_id) ?? { count: 0, total: 0 };
      byCategory.set(t.category_id, {
        count: current.count + 1,
        // Arredonda a cada soma para não acumular erro de ponto flutuante
        total: Math.round((current.total + t.amount) * 100) / 100,
      });
    }
    return byCategory;
  }, [transactions]);

  return (
    <>
      <PageHeader
        title="Categorias"
        eyebrow="Regras por palavra-chave para categorizar os extratos"
      />
      {loaded ? (
        <CategoryManager
          categories={categories}
          onChanged={reload}
          categoryColor={categoryColor}
          stats={stats}
        />
      ) : (
        <section className="card">
          <Skeleton label="Carregando categorias" rows={5} rowHeight="4.5rem" />
        </section>
      )}
    </>
  );
}
