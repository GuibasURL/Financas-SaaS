import { Link } from "react-router";
import { useFinanceData } from "../data/FinanceData";
import { formatDate } from "../utils/format";
import Icon from "./Icon";
import Skeleton from "./Skeleton";
import TransactionAmount from "./TransactionAmount";
import styles from "./RecentTransactions.module.css";

const LIMIT = 5;

export default function RecentTransactions() {
  const { transactions, categories, categoryColor, loaded } = useFinanceData();
  // A API já devolve da mais recente para a mais antiga
  const recent = transactions.slice(0, LIMIT);
  const names = new Map(categories.map((c) => [c.id, c.name]));
  const ignoredIds = new Set(categories.filter((c) => c.ignore_in_reports).map((c) => c.id));

  return (
    <section className="card" aria-labelledby="recent-title">
      <div className="card-head">
        <div>
          <h2 className="card-title" id="recent-title">
            Últimas transações
          </h2>
          <p>As {LIMIT} mais recentes</p>
        </div>
        <Link className="btn btn-ghost" to="/transacoes">
          Ver todas <Icon name="arrowRight" />
        </Link>
      </div>

      {!loaded ? (
        <Skeleton label="Carregando últimas transações" rows={LIMIT} />
      ) : recent.length === 0 ? (
        <p className="empty">Nenhuma transação ainda. Importe um extrato para começar.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Descrição</th>
                <th className={styles.hideSm}>Categoria</th>
                <th className="num">Valor</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((t) => (
                <tr key={t.id}>
                  <td className="mono muted">{formatDate(t.date)}</td>
                  <td>{t.description}</td>
                  <td className={styles.hideSm}>
                    {t.category_id !== null && names.has(t.category_id) ? (
                      <span className="cat">
                        <i style={{ background: categoryColor(t.category_id) }} />
                        {names.get(t.category_id)}
                      </span>
                    ) : (
                      <span className="cat">— sem categoria —</span>
                    )}
                  </td>
                  <td className="num">
                    <TransactionAmount
                      amount={t.amount}
                      ignored={t.category_id !== null && ignoredIds.has(t.category_id)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
