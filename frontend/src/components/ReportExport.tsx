import { useState } from "react";
import { apiErrorMessage, downloadReport } from "../services/api";
import type { Statement } from "../types/transaction";

interface Props {
  // Extrato filtrado no Dashboard (null = todos): o relatório segue o mesmo filtro
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
      <div style={{ display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
        <label style={{ display: "grid", gap: 4 }}>
          De
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          Até
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </label>
        <button type="submit" disabled={downloading}>
          {downloading ? "Gerando..." : "Baixar Excel"}
        </button>
      </div>
      <p style={{ margin: "8px 0 0", color: "#555" }}>
        {startDate || endDate ? "Período escolhido" : "Todo o período"} ·{" "}
        {statement ? `extrato ${statement.filename}` : "todos os extratos"}
        {" "}(o filtro de extrato é o mesmo da seção Extratos)
      </p>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </form>
  );
}
