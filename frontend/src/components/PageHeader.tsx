import type { ReactNode } from "react";
import { useFinanceData } from "../data/FinanceData";
import Icon from "./Icon";
import styles from "./PageHeader.module.css";

interface Props {
  title: string;
  eyebrow?: ReactNode;
}

/**
 * Título da página + etiqueta do filtro de extrato (que vale para todas as
 * páginas) + aviso de erro de carregamento com "Tentar de novo".
 */
export default function PageHeader({ title, eyebrow }: Props) {
  const { selectedStatement, selectStatement, loadError, reload } = useFinanceData();

  return (
    <>
      <header className={styles.top}>
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1 className="page-title">{title}</h1>
        </div>
        {selectedStatement && (
          <div className={styles.filterChip} role="status">
            <Icon name="filter" />
            <span>
              Filtrando por <b className="mono">{selectedStatement.filename}</b>
            </span>
            <button type="button" onClick={() => selectStatement(null)}>
              Ver todos
            </button>
          </div>
        )}
      </header>

      {loadError && (
        <div className="notice" role="alert">
          <Icon name="alert" />
          <span>
            <strong>Não foi possível carregar os dados.</strong> Verifique se a API está rodando e
            tente de novo.
          </span>
          <button className="btn btn-sm" type="button" onClick={() => reload()}>
            Tentar de novo
          </button>
        </div>
      )}
    </>
  );
}
