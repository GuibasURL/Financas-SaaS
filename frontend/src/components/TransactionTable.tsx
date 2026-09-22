import type { Transaction } from "../types/transaction";

interface Props {
  transactions: Transaction[];
}

export default function TransactionTable({ transactions }: Props) {
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
            <td>{t.category_id ?? "-- sem categoria --"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
