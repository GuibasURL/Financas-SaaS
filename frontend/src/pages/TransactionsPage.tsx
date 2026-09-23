import { useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import Icon from "../components/Icon";
import PageHeader from "../components/PageHeader";
import Pagination from "../components/Pagination";
import TransactionFilters, { FILTERS_ID } from "../components/TransactionFilters";
import TransactionTable from "../components/TransactionTable";
import { useFinanceData } from "../data/FinanceData";
import { formatCount, formatSignedMoney } from "../utils/format";
import {
  filterTransactions,
  hasActiveFilters,
  monthOptions,
  NO_FILTERS,
  resultTotals,
  type TransactionFilters as Filters,
} from "../utils/transactionFilters";
import styles from "./TransactionsPage.module.css";

export const PAGE_SIZE = 25;

export default function TransactionsPage() {
  const { transactions, categories, changeTransactionCategory, categoryColor, loaded } =
    useFinanceData();
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const cardRef = useRef<HTMLElement>(null);

  const uncategorized = transactions.filter((t) => t.category_id === null).length;
  const months = useMemo(() => monthOptions(transactions), [transactions]);
  const filtered = useMemo(() => filterTransactions(transactions, filters), [transactions, filters]);
  const ignoredIds = useMemo(
    () => new Set(categories.filter((c) => c.ignore_in_reports).map((c) => c.id)),
    [categories]
  );
  const totals = resultTotals(filtered, ignoredIds);

  // Se a lista encolher (ex: recategorizou com o filtro "Sem categoria"), não fica numa página vazia
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const active = hasActiveFilters(filters);
  const activeCount = [
    filters.search.trim() !== "",
    filters.category !== "all",
    filters.month !== "all",
    filters.kind !== "all",
  ].filter(Boolean).length;

  function changeFilters(next: Filters) {
    setFilters(next);
    setPage(1);
  }

  function changePage(next: number) {
    setPage(next);
    // Volta para o começo da lista (os botões ficam no fim dela)
    cardRef.current?.scrollIntoView?.({ block: "start", behavior: "smooth" });
  }

  function content() {
    if (!loaded) {
      return (
        <div className={styles.skeleton} role="status" aria-label="Carregando transações">
          <i />
          <i />
          <i />
        </div>
      );
    }
    if (transactions.length === 0) {
      return (
        <div className="empty">
          <strong>Nenhuma transação ainda</strong>
          <p>Importe um extrato para ver e categorizar suas transações.</p>
          <Link className="btn btn-primary" to="/extratos">
            Importar extrato
          </Link>
        </div>
      );
    }
    if (filtered.length === 0) {
      return (
        <div className="empty">
          <strong>Nenhuma transação encontrada</strong>
          <p>Tente mudar a busca ou os filtros.</p>
          <button className="btn" type="button" onClick={() => changeFilters(NO_FILTERS)}>
            Limpar filtros
          </button>
        </div>
      );
    }
    return (
      <>
        <TransactionTable
          transactions={visible}
          categories={categories}
          onCategoryChange={changeTransactionCategory}
          categoryColor={categoryColor}
        />
        <Pagination
          page={currentPage}
          pageSize={PAGE_SIZE}
          total={filtered.length}
          onChange={changePage}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Transações"
        eyebrow={`${formatCount(transactions.length, "transação", "transações")} · ${uncategorized} sem categoria`}
      />

      <section ref={cardRef} className={`card ${styles.card}`} aria-label="Filtros e transações">
        {transactions.length > 0 && (
          <>
            <button
              className={`btn ${styles.filterToggle}`}
              type="button"
              aria-expanded={filtersOpen}
              aria-controls={FILTERS_ID}
              onClick={() => setFiltersOpen(!filtersOpen)}
            >
              <Icon name="filter" />
              Filtros{activeCount > 0 && ` (${activeCount})`}
            </button>

            <TransactionFilters
              filters={filters}
              onChange={changeFilters}
              categories={categories}
              months={months}
              open={filtersOpen}
            />

            {uncategorized > 0 && filters.category !== "none" && (
              <div className={styles.review}>
                <Icon name="alert" />
                <span>
                  <strong>{formatCount(uncategorized, "transação", "transações")} sem categoria</strong>
                  <span className="muted">Revise para manter seus totais organizados.</span>
                </span>
                <button
                  className="btn btn-sm"
                  type="button"
                  onClick={() => changeFilters({ ...NO_FILTERS, category: "none" })}
                >
                  Revisar
                </button>
              </div>
            )}

            {filtered.length > 0 && (
              <p className={styles.summary} aria-live="polite">
                <strong>
                  {active
                    ? formatCount(filtered.length, "transação encontrada", "transações encontradas")
                    : formatCount(filtered.length, "transação", "transações")}
                </strong>
                <span aria-hidden="true">·</span>
                <span>
                  Entradas <strong className="amount in">{formatSignedMoney(totals.income)}</strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Saídas <strong className="amount out">{formatSignedMoney(totals.expense)}</strong>
                </span>
                {totals.ignored > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{totals.ignored} fora dos totais</span>
                  </>
                )}
              </p>
            )}
          </>
        )}

        {content()}
      </section>
    </>
  );
}
