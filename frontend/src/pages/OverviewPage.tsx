import PageHeader from "../components/PageHeader";
import RecentTransactions from "../components/RecentTransactions";
import ReportExport from "../components/ReportExport";
import SummaryCards from "../components/SummaryCards";
import UploadCSV from "../components/UploadCSV";
import CategoryPieChart from "../components/charts/CategoryPieChart";
import MonthlyTrendChart from "../components/charts/MonthlyTrendChart";
import { useFinanceData } from "../data/FinanceData";
import { formatDate } from "../utils/format";
import styles from "./pages.module.css";

const UNCATEGORIZED = "Sem categoria";

export default function OverviewPage() {
  const { transactions, byCategory, monthly, selectedStatement, reload, categoryColor } =
    useFinanceData();

  // O gráfico por categoria da API só traz saídas categorizadas; as sem
  // categoria entram como uma fatia própria, para o total da rosca bater
  // com o card de Saídas
  const uncategorized = transactions
    .filter((t) => t.category_id === null && t.amount < 0)
    .reduce((sum, t) => sum + t.amount, 0);
  const spending =
    uncategorized < 0
      ? [...byCategory, { category: UNCATEGORIZED, total: uncategorized }]
      : byCategory;
  const sliceColor = (name: string) =>
    name === UNCATEGORIZED ? "var(--muted)" : categoryColor(name);

  // Período coberto pelas transações carregadas (já vêm da mais recente para a mais antiga)
  const period =
    transactions.length > 0
      ? `${formatDate(transactions[transactions.length - 1].date)} a ${formatDate(transactions[0].date)}`
      : "Nenhum extrato importado ainda";

  return (
    <>
      <PageHeader title="Visão geral" eyebrow={period} />

      <div className={styles.grid}>
        <SummaryCards />

        <section className={`card ${styles.span7}`} aria-labelledby="pie-title">
          <div className="card-head">
            <div>
              <h2 className="card-title" id="pie-title">
                Gastos por categoria
              </h2>
              <p>Somente saídas · categorias ignoradas não entram</p>
            </div>
          </div>
          <CategoryPieChart data={spending} categoryColor={sliceColor} />
        </section>

        <section className={`card ${styles.span5}`} aria-labelledby="import-title">
          <div className="card-head">
            <div>
              <h2 className="card-title" id="import-title">
                Importar extrato
              </h2>
              <p>Arquivo .csv ou .ofx exportado do seu banco</p>
            </div>
          </div>
          <UploadCSV onUploaded={reload} />
        </section>

        <section className={`card ${styles.span8}`} aria-labelledby="line-title">
          <div className="card-head">
            <div>
              <h2 className="card-title" id="line-title">
                Evolução mensal
              </h2>
              <p>Gastos por mês</p>
            </div>
          </div>
          <MonthlyTrendChart data={monthly} />
        </section>

        <section className={`card ${styles.span4}`} aria-labelledby="export-title">
          <div className="card-head">
            <div>
              <h2 className="card-title" id="export-title">
                Exportar relatório
              </h2>
              <p>Datas opcionais</p>
            </div>
          </div>
          <ReportExport statement={selectedStatement} />
        </section>

        <div className={styles.span12}>
          <RecentTransactions />
        </div>
      </div>
    </>
  );
}
