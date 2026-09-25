import { useEffect, useState } from "react";
import { onSlowRequests } from "../services/api";
import styles from "./ServerWakeNotice.module.css";

/**
 * Aviso de "servidor acordando": aparece quando um pedido à API passa de
 * alguns segundos (a hospedagem grátis desliga a API sem uso) e some quando
 * todos terminam. Sem ele, a primeira visita parece um site travado.
 */
export default function ServerWakeNotice() {
  const [slow, setSlow] = useState(false);

  useEffect(() => onSlowRequests(setSlow), []);

  // A região fica sempre na página: o leitor de tela lê o texto quando ele aparece
  return (
    <div className={styles.wrap} aria-live="polite">
      {slow && (
        <div className={styles.notice}>
          <span className="spinner" aria-hidden="true" />
          <p>
            <strong>Acordando o servidor…</strong> Depois de um tempo sem uso, a primeira resposta
            pode levar até um minuto. É só aguardar.
          </p>
        </div>
      )}
    </div>
  );
}
