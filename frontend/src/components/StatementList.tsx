import type { Statement } from "../types/transaction";
import { formatDate, formatDateTime } from "../utils/format";

interface Props {
  statements: Statement[];
  selectedId: number | null;
  onSelect: (statementId: number | null) => void;
  onDelete: (statement: Statement) => void;
}

export default function StatementList({ statements, selectedId, onSelect, onDelete }: Props) {
  if (statements.length === 0) {
    return <p className="empty">Nenhum extrato importado ainda.</p>;
  }

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Arquivo</th>
            <th>Importado em</th>
            <th>Período</th>
            <th className="num">Transações</th>
            <th className="num">Ações</th>
          </tr>
        </thead>
        <tbody>
          {statements.map((s) => {
            const selected = s.id === selectedId;
            return (
              <tr key={s.id} className={selected ? "selected" : undefined}>
                <td className="mono">{s.filename}</td>
                <td className="muted">{formatDateTime(s.uploaded_at)}</td>
                <td className="muted">
                  {s.start_date && s.end_date
                    ? `${formatDate(s.start_date)} a ${formatDate(s.end_date)}`
                    : "-"}
                </td>
                <td className="num mono">{s.transaction_count}</td>
                <td className="num">
                  <span style={{ display: "inline-flex", gap: "0.4rem" }}>
                    <button
                      className={`btn btn-sm ${selected ? "btn-primary" : ""}`}
                      onClick={() => onSelect(selected ? null : s.id)}
                      aria-pressed={selected}
                    >
                      {selected ? "Ver todos" : "Filtrar"}
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => onDelete(s)}>
                      Excluir
                    </button>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
