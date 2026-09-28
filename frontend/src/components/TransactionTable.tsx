import type { Transaction, Category } from "../types/transaction";
import { formatDate } from "../utils/format";
import Icon from "./Icon";
import TransactionAmount, { IGNORED_AMOUNT_HINT } from "./TransactionAmount";
import styles from "./TransactionTable.module.css";

interface Props {
  transactions: Transaction[];
  categories: Category[];
  onCategoryChange: (transactionId: number, categoryId: number | null) => void;
  // Sem ele, a tabela não mostra o botão de excluir
  onDelete?: (transaction: Transaction) => void;
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
  onDelete,
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
            {onDelete && (
              <th>
                <span className="sr-only">Ações</span>
              </th>
            )}
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
                    <span className={`badge ${styles.badge}`} title={IGNORED_AMOUNT_HINT}>
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
                <td className={`num ${styles.value}`}>
                  <TransactionAmount amount={t.amount} ignored={ignored} />
                </td>
                {onDelete && (
                  <td className={styles.actions}>
                    <button
                      className={`btn btn-sm btn-ghost ${styles.delete}`}
                      type="button"
                      onClick={() => onDelete(t)}
                      aria-label={`Excluir ${t.description} de ${formatDate(t.date)}`}
                      title="Excluir transação"
                    >
                      <Icon name="trash" />
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
