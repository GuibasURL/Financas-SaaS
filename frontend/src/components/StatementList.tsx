import type { Statement } from "../types/transaction";
import { formatCount, formatDate, formatDateTime } from "../utils/format";
import styles from "./StatementList.module.css";

interface Props {
  statements: Statement[];
  selectedId: number | null;
  onSelect: (statementId: number | null) => void;
  onDelete: (statement: Statement) => void;
  // Botão do estado vazio ("Importar primeiro extrato"); sem ele, só o texto
  onImport?: () => void;
}

export default function StatementList({
  statements,
  selectedId,
  onSelect,
  onDelete,
  onImport,
}: Props) {
  if (statements.length === 0) {
    return (
      <div className="empty">
        <strong>Nenhum extrato ainda</strong>
        <p>Importe seu primeiro extrato (CSV ou OFX) para ver as transações.</p>
        {onImport && (
          <button className="btn btn-primary" type="button" onClick={onImport}>
            Importar primeiro extrato
          </button>
        )}
      </div>
    );
  }

  return (
    <ul className={styles.list} aria-label="Extratos importados">
      {statements.map((s) => {
        const selected = s.id === selectedId;
        return (
          <li key={s.id} className={`${styles.row} ${selected ? styles.selected : ""}`}>
            <div className={styles.file}>
              <span className={styles.name}>{s.filename}</span>
              <span className={styles.meta}>importado em {formatDateTime(s.uploaded_at)}</span>
            </div>
            <div>
              <strong className={styles.period}>
                {s.start_date && s.end_date
                  ? `${formatDate(s.start_date)} a ${formatDate(s.end_date)}`
                  : "Sem período"}
              </strong>
              <span className={styles.meta}>
                {formatCount(s.transaction_count, "transação", "transações")}
              </span>
            </div>
            <div className={styles.actions}>
              {/* Clicar de novo no selecionado volta a mostrar todos */}
              <button
                className={`btn btn-sm ${styles.filter} ${selected ? styles.pressed : ""}`}
                type="button"
                onClick={() => onSelect(selected ? null : s.id)}
                aria-pressed={selected}
                aria-label={`Filtrar por ${s.filename}`}
              >
                {selected ? "Filtrando" : "Filtrar"}
              </button>
              <button
                className="btn btn-sm btn-danger"
                type="button"
                onClick={() => onDelete(s)}
                aria-label={`Excluir ${s.filename}`}
              >
                Excluir
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
