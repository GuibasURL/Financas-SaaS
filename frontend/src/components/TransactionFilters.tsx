import type { Category } from "../types/transaction";
import {
  hasActiveFilters,
  NO_FILTERS,
  type CategoryFilter,
  type KindFilter,
  type TransactionFilters as Filters,
} from "../utils/transactionFilters";
import styles from "./TransactionFilters.module.css";

interface Props {
  filters: Filters;
  onChange: (filters: Filters) => void;
  categories: Category[];
  months: { value: string; label: string }[];
  // No celular os filtros ficam recolhidos atrás do botão "Filtros"
  open: boolean;
}

const KINDS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "in", label: "Entradas" },
  { value: "out", label: "Saídas" },
];

export const FILTERS_ID = "transaction-filters";

export default function TransactionFilters({ filters, onChange, categories, months, open }: Props) {
  const set = (changes: Partial<Filters>) => onChange({ ...filters, ...changes });

  return (
    <div id={FILTERS_ID} className={`${styles.bar} ${open ? styles.open : ""}`}>
      <div className={styles.search}>
        <label className="label" htmlFor="filter-search">
          Buscar por descrição
        </label>
        <input
          id="filter-search"
          className="field"
          type="search"
          value={filters.search}
          onChange={(e) => set({ search: e.target.value })}
          placeholder="Ex.: IFOOD, PIX, UBER"
        />
      </div>

      <div>
        <label className="label" htmlFor="filter-category">
          Categoria
        </label>
        <select
          id="filter-category"
          className="field"
          value={filters.category}
          onChange={(e) => {
            const value = e.target.value;
            const category: CategoryFilter =
              value === "all" || value === "none" ? value : Number(value);
            set({ category });
          }}
        >
          <option value="all">Todas</option>
          <option value="none">Sem categoria</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="filter-month">
          Mês
        </label>
        <select
          id="filter-month"
          className="field"
          value={filters.month}
          onChange={(e) => set({ month: e.target.value })}
        >
          <option value="all">Todos</option>
          {months.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <span className="label" id="filter-kind-label">
          Tipo
        </span>
        <div className={styles.segmented} role="group" aria-labelledby="filter-kind-label">
          {KINDS.map((k) => (
            <button
              key={k.value}
              type="button"
              aria-pressed={filters.kind === k.value}
              onClick={() => set({ kind: k.value })}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>

      {hasActiveFilters(filters) && (
        <button className="btn btn-ghost" type="button" onClick={() => onChange(NO_FILTERS)}>
          Limpar filtros
        </button>
      )}
    </div>
  );
}
