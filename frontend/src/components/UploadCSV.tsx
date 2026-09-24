import { useState } from "react";
import {
  apiErrorMessage,
  duplicatesInfo,
  uploadCSV,
  type DuplicatesInfo,
  type DuplicatesMode,
} from "../services/api";
import { formatCount } from "../utils/format";
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
  "OFX de qualquer banco",
  "Genérico",
];

// Extrato com transações já importadas, esperando a pessoa decidir
interface PendingDuplicates {
  file: File;
  info: DuplicatesInfo;
}

export default function UploadCSV({ onUploaded }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingDuplicates | null>(null);
  const [dragging, setDragging] = useState(false);

  async function upload(file: File, duplicates?: DuplicatesMode) {
    setLoading(true);
    setError(null);
    setNotice(null);
    setPending(null);
    try {
      const created = await uploadCSV(file, duplicates);
      if (duplicates === "skip") {
        setNotice(
          `${formatCount(created.length, "transação nova importada", "transações novas importadas")}; ` +
            "as repetidas ficaram de fora."
        );
      }
      onUploaded();
    } catch (err) {
      const info = duplicatesInfo(err);
      if (info) {
        setPending({ file, info });
      } else {
        setError(apiErrorMessage(err, "Erro ao enviar arquivo"));
      }
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
        <strong>Selecionar arquivo .csv ou .ofx</strong>
        <span>ou arraste o arquivo para cá</span>
        <input
          id={CSV_INPUT_ID}
          className={styles.fileInput}
          type="file"
          // .ofx: formato padrão, serve para qualquer banco
          accept=".csv,.ofx"
          aria-label="Arquivo do extrato (CSV ou OFX)"
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
      {notice && (
        <p className={`notice notice-success ${styles.error}`} role="status">
          <Icon name="check" />
          {notice}
        </p>
      )}
      {pending && <DuplicatesPrompt pending={pending} onChoose={upload} onCancel={() => setPending(null)} />}

      <div className={styles.banks} aria-label="Bancos aceitos">
        {BANKS.map((bank) => (
          <span key={bank}>{bank}</span>
        ))}
      </div>
    </div>
  );
}

interface PromptProps {
  pending: PendingDuplicates;
  onChoose: (file: File, duplicates: DuplicatesMode) => void;
  onCancel: () => void;
}

/** "Esse extrato já foi importado": importar só as novas, tudo, ou cancelar. */
function DuplicatesPrompt({ pending, onChoose, onCancel }: PromptProps) {
  const { file, info } = pending;
  const fresh = info.total - info.duplicates;

  return (
    <div className={`notice ${styles.duplicates}`} role="alert" aria-labelledby="duplicados-titulo">
      <Icon name="alert" />
      <div>
        <strong id="duplicados-titulo">
          {fresh === 0 ? "Extrato já importado" : "Parte deste extrato já foi importada"}
        </strong>
        <p>{info.message}</p>
        <p className={styles.duplicatesHint}>
          Importar de novo duplica essas transações e infla os totais.
        </p>
        <div className={styles.duplicatesActions}>
          {fresh > 0 && (
            <button className="btn btn-sm btn-primary" type="button" onClick={() => onChoose(file, "skip")}>
              {fresh === 1 ? "Importar só a nova" : `Importar só as ${fresh} novas`}
            </button>
          )}
          <button className="btn btn-sm" type="button" onClick={() => onChoose(file, "keep")}>
            {fresh === 0 ? "Importar mesmo assim" : "Importar tudo mesmo assim"}
          </button>
          <button className="btn btn-sm btn-ghost" type="button" onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
