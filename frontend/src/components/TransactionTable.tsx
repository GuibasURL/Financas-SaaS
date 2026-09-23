import type { Transaction, Category } from "../types/transaction";
import { formatDate, formatSignedMoney } from "../utils/format";

interface Props {
  transactions: Transaction[];
  categories: Category[];
  onCategoryChange: (transactionId: number, categoryId: number | null) => void;
}

export default function TransactionTable({ transactions, categories, onCategoryChange }: Props) {
  if (transactions.length === 0) {
    return <p className="empty">Nenhuma transação ainda. Importe um extrato para começar.</p>;
  }

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Descrição</th>
            <th className="num">Valor</th>
            <th>Categoria</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => (
            <tr key={t.id}>
              <td className="mono muted">{formatDate(t.date)}</td>
              <td>{t.description}</td>
              <td className={`num amount ${t.amount > 0 ? "in" : ""}`}>
                {formatSignedMoney(t.amount)}
              </td>
              <td>
                <select
                  className="field"
                  style={{ height: "2.1rem", minWidth: "11rem" }}
                  aria-label={`Categoria de ${t.description}`}
                  value={t.category_id ?? ""}
                  onChange={(e) =>
                    onCategoryChange(t.id, e.target.value === "" ? null : Number(e.target.value))
                  }
                >
                  <option value="">-- sem categoria --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
