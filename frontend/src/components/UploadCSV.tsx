import { useState } from "react";
import { apiErrorMessage, uploadCSV } from "../services/api";

interface Props {
  onUploaded: () => void;
}

export default function UploadCSV({ onUploaded }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    try {
      await uploadCSV(file);
      onUploaded();
    } catch (err) {
      setError(apiErrorMessage(err, "Erro ao enviar arquivo"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <input
        type="file"
        accept=".csv"
        aria-label="Arquivo CSV do extrato"
        onChange={handleChange}
        disabled={loading}
      />
      {loading && <p>Enviando...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}
