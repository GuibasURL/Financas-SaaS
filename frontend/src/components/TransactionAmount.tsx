import { formatSignedMoney } from "../utils/format";
import styles from "./TransactionAmount.module.css";

interface Props {
  amount: number;
  // Categoria ignorada nos gráficos (pagamento de fatura, investimentos...)
  ignored?: boolean;
}

export const IGNORED_AMOUNT_HINT =
  "Não soma nas entradas nem nas saídas: é dinheiro que só muda de lugar " +
  "(ex: pagamento da fatura, aplicação). O gasto de verdade já está nas compras.";

/**
 * Valor de uma transação: verde se entrou, vermelho se saiu. Fora dos totais,
 * fica cinza e com "não soma" embaixo, para um "+" de pagamento de fatura não
 * parecer dinheiro entrando.
 */
export default function TransactionAmount({ amount, ignored = false }: Props) {
  if (ignored) {
    return (
      <span className={`amount ${styles.ignored}`} title={IGNORED_AMOUNT_HINT}>
        {formatSignedMoney(amount)}
        <small className={styles.note}>não soma</small>
      </span>
    );
  }
  return <span className={`amount ${amount > 0 ? "in" : "out"}`}>{formatSignedMoney(amount)}</span>;
}
