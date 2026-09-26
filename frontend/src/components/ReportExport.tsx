import { useState } from "react";
import { apiErrorMessage, downloadReport } from "../services/api";
import type { Statement } from "../types/transaction";
import Icon from "./Icon";
import styles from "./ReportExport.module.css";

interface Props {
  // Extrato filtrado no app (null = todos): o relatório segue o mesmo filtro
  statement: Statement | null;
}

// Faz o navegador baixar o arquivo recebido da API
function saveFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ReportExport({ statement }: Props) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDownloading(true);
    try {
      const { blob, filename } = await downloadReport({
        startDate,
        endDate,
        statementId: statement?.id ?? null,
      });
      saveFile(blob, filename);
    } catch (err) {
      setError(apiErrorMessage(err, "Não foi possível gerar o relatório."));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className={styles.fields}>
        <div>
          <label className="label" htmlFor="report-start">
            De
          </label>
          <input
            id="report-start"
            className="field"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="report-end">
            Até
          </label>
          <input
            id="report-end"
            className="field"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>
      <p className={styles.scope}>
        Será exportado:{" "}
        <b>
          {startDate || endDate ? "Período escolhido" : "Todo o período"} ·{" "}
          {statement ? `extrato ${statement.filename}` : "todos os extratos"}
        </b>
      </p>
      <button className="btn btn-primary btn-block" type="submit" disabled={downloading}>
        {downloading ? (
          <>
            <span className="spinner" aria-hidden="true" />
            Gerando...
          </>
        ) : (
          <>
            <Icon name="download" />
            Baixar Excel
          </>
        )}
      </button>
      {error && (
        <p className={`notice ${styles.error}`} role="alert">
          <Icon name="alert" />
          {error}
        </p>
      )}
    </form>
  );
}
