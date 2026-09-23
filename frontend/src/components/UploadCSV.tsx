import { useState } from "react";
import { apiErrorMessage, uploadCSV } from "../services/api";
import Icon from "./Icon";
import styles from "./UploadCSV.module.css";

interface Props {
  onUploaded: () => void;
}

// id do campo de arquivo, para outros botões abrirem a escolha de arquivo
export const CSV_INPUT_ID = "csv-upload";

const BANKS = [
  "Nubank conta",
  "Nubank cartão",
  "Itaú",
  "Inter",
  "Bradesco",
  "Banco do Brasil",
  "PicPay",
  "Genérico",
];

export default function UploadCSV({ onUploaded }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  async function upload(file: File) {
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

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Limpa o input para o mesmo arquivo poder ser escolhido de novo
    e.target.value = "";
    if (file) upload(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && !loading) upload(file);
  }

  return (
    <div>
      <label
        className={`${styles.drop} ${dragging ? styles.dragging : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <Icon name="upload" />
        <strong>Selecionar arquivo .csv</strong>
        <span>ou arraste o arquivo para cá</span>
        <input
          id={CSV_INPUT_ID}
          className={styles.fileInput}
          type="file"
          accept=".csv"
          aria-label="Arquivo CSV do extrato"
          onChange={handleChange}
          disabled={loading}
        />
      </label>

      {loading && (
        <div className={styles.uploading} role="status">
          <span className="spinner" aria-hidden="true" />
          Enviando...
          <span className={styles.bar} aria-hidden="true">
            <i />
          </span>
        </div>
      )}
      {error && (
        <p className={`notice ${styles.error}`} role="alert">
          <Icon name="alert" />
          {error}
        </p>
      )}

      <div className={styles.banks} aria-label="Bancos aceitos">
        {BANKS.map((bank) => (
          <span key={bank}>{bank}</span>
        ))}
      </div>
    </div>
  );
}
