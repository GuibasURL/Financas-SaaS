import type { Statement } from "../types/transaction";

interface Props {
  statements: Statement[];
  selectedId: number | null;
  onSelect: (statementId: number | null) => void;
  onDelete: (statement: Statement) => void;
}

// "2025-03-01" -> "01/03/2025" (sem passar por Date, para não sofrer com fuso)
function formatDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

// O SQLite devolve o horário em UTC sem indicar o fuso; trata como UTC.
function formatDateTime(isoDateTime: string) {
  const hasTimezone = /Z|[+-]\d{2}:\d{2}$/.test(isoDateTime);
  const date = new Date(hasTimezone ? isoDateTime : `${isoDateTime}Z`);
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default function StatementList({
  statements,
  selectedId,
  onSelect,
  onDelete,
}: Props) {
  if (statements.length === 0) {
    return <p>Nenhum extrato importado ainda.</p>;
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Arquivo</th>
          <th>Importado em</th>
          <th>Período</th>
          <th>Transações</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {statements.map((s) => {
          const selected = s.id === selectedId;
          return (
            <tr key={s.id} style={selected ? { fontWeight: "bold" } : undefined}>
              <td>{s.filename}</td>
              <td>{formatDateTime(s.uploaded_at)}</td>
              <td>
                {s.start_date && s.end_date
                  ? `${formatDate(s.start_date)} a ${formatDate(s.end_date)}`
                  : "-"}
              </td>
              <td>{s.transaction_count}</td>
              <td>
                <button onClick={() => onSelect(selected ? null : s.id)}>
                  {selected ? "Ver todos" : "Filtrar"}
                </button>{" "}
                <button onClick={() => onDelete(s)}>Excluir</button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
