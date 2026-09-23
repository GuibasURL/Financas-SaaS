import CategoryManager from "../components/CategoryManager";
import PageHeader from "../components/PageHeader";
import { useFinanceData } from "../data/FinanceData";
import styles from "./pages.module.css";

export default function CategoriesPage() {
  const { categories, reload, categoryColor } = useFinanceData();

  return (
    <>
      <PageHeader
        title="Categorias"
        eyebrow="Regras por palavra-chave para categorizar os extratos"
      />
      <div className={styles.stack}>
        <section className="card" aria-label="Gerenciar categorias">
          <CategoryManager
            categories={categories}
            onChanged={reload}
            categoryColor={categoryColor}
          />
        </section>
      </div>
    </>
  );
}
