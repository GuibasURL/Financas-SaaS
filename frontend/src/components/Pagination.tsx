import styles from "./Pagination.module.css";

interface Props {
  // Página atual, começando em 1
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}

/** "Anterior · 26–50 de 248 · Próxima" (some quando tudo cabe numa página) */
export default function Pagination({ page, pageSize, total, onChange }: Props) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <nav className={styles.pagination} aria-label="Paginação">
      <button
        className="btn btn-sm"
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
      >
        Anterior
      </button>
      <span aria-live="polite">
        {first}–{last} de {total}
      </span>
      <button
        className="btn btn-sm"
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page === pages}
      >
        Próxima
      </button>
    </nav>
  );
}
