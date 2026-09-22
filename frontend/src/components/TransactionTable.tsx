import type { Transaction, Category } from "../types/transaction";

interface Props {
  transactions: Transaction[];
  categories: Category[];
  onCategoryChange: (transactionId: number, categoryId: number | null) => void;
}

export default function TransactionTable({
  transactions,
  categories,
  onCategoryChange,
}: Props) {
  return (
    <table>
      <thead>
        <tr>
          <th>Data</th>
          <th>Descrição</th>
          <th>Valor</th>
          <th>Categoria</th>
        </tr>
      </thead>
      <tbody>
        {transactions.map((t) => (
          <tr key={t.id}>
            <td>{t.date}</td>
            <td>{t.description}</td>
            <td>{t.amount.toFixed(2)}</td>
            <td>
              <select
                value={t.category_id ?? ""}
                onChange={(e) =>
                  onCategoryChange(
                    t.id,
                    e.target.value === "" ? null : Number(e.target.value)
                  )
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
  );
}
