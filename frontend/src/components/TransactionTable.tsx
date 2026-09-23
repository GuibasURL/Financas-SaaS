import type { Transaction, Category } from "../types/transaction";
import { formatDate, formatSignedMoney } from "../utils/format";
import styles from "./TransactionTable.module.css";

interface Props {
  transactions: Transaction[];
  categories: Category[];
  onCategoryChange: (transactionId: number, categoryId: number | null) => void;
  // Cor da categoria (a mesma dos gráficos); opcional
  categoryColor?: (id: number) => string;
}

/**
 * Tabela no desktop; no celular cada linha vira um cartão (só CSS, a
 * marcação é a mesma, então não há lista duplicada na página).
 */
export default function TransactionTable({
  transactions,
  categories,
  onCategoryChange,
  categoryColor,
}: Props) {
  const ignoredIds = new Set(categories.filter((c) => c.ignore_in_reports).map((c) => c.id));

  return (
    <div className="table-wrap">
      <table className={`table ${styles.table}`}>
        <thead>
          <tr>
            <th>Data</th>
            <th>Descrição</th>
            <th>Categoria</th>
            <th className="num">Valor</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => {
            const uncategorized = t.category_id === null;
            const ignored = !uncategorized && ignoredIds.has(t.category_id!);
            const dot = uncategorized
              ? "var(--muted)"
              : (categoryColor?.(t.category_id!) ?? "var(--cat-11)");
            return (
              <tr key={t.id} className={uncategorized ? styles.uncategorized : undefined}>
                <td className={`mono muted ${styles.date}`}>{formatDate(t.date)}</td>
                <td className={styles.description}>
                  {t.description}
                  {ignored && (
                    <span
                      className={`badge badge-warning ${styles.badge}`}
                      title="Categoria ignorada nos gráficos: não entra nos totais"
                    >
                      fora dos totais
                    </span>
                  )}
                </td>
                <td className={styles.category}>
                  <span className={styles.select}>
                    <i style={{ background: dot }} aria-hidden="true" />
                    <select
                      className="field"
                      aria-label={`Categoria de ${t.description}`}
                      value={t.category_id ?? ""}
                      onChange={(e) =>
                        onCategoryChange(
                          t.id,
                          e.target.value === "" ? null : Number(e.target.value)
                        )
                      }
                    >
                      <option value="">Sem categoria</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </span>
                </td>
                <td className={`num amount ${t.amount > 0 ? "in" : "out"} ${styles.value}`}>
                  {formatSignedMoney(t.amount)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
