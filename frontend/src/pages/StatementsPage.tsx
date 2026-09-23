import PageHeader from "../components/PageHeader";
import StatementList from "../components/StatementList";
import UploadCSV from "../components/UploadCSV";
import { useFinanceData } from "../data/FinanceData";
import styles from "./pages.module.css";

export default function StatementsPage() {
  const { statements, selectedStatementId, selectStatement, deleteStatement, reload } =
    useFinanceData();

  return (
    <>
      <PageHeader
        title="Extratos"
        eyebrow="Filtrar um extrato vale para todas as páginas"
      />
      <div className={styles.grid}>
        <section className={`card ${styles.span8}`} aria-labelledby="statements-title">
          <div className="card-head">
            <div>
              <h2 className="card-title" id="statements-title">
                Extratos importados
              </h2>
              <p>Cada upload de CSV vira um extrato</p>
            </div>
          </div>
          <StatementList
            statements={statements}
            selectedId={selectedStatementId}
            onSelect={selectStatement}
            onDelete={deleteStatement}
          />
        </section>

        <section className={`card ${styles.span4}`} aria-labelledby="import-title">
          <div className="card-head">
            <div>
              <h2 className="card-title" id="import-title">
                Importar extrato
              </h2>
              <p>Arquivo .csv exportado do seu banco</p>
            </div>
          </div>
          <UploadCSV onUploaded={reload} />
        </section>
      </div>
    </>
  );
}
