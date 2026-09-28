import styles from "./DownloadGuide.module.css";

interface Props {
  open: boolean;
  onToggle: (open: boolean) => void;
}

// Onde cada banco costuma deixar exportar o extrato. Os menus mudam de vez
// em quando, por isso o texto diz o que procurar, sem prometer o caminho exato.
const BANK_TIPS = [
  {
    bank: "Nubank (conta)",
    tip: 'No app, abra o extrato e procure "Exportar extrato". Escolha o período e o formato OFX ou CSV: o arquivo chega por e-mail.',
  },
  {
    bank: "Nubank (fatura do cartão)",
    tip: 'Abra a fatura e procure "Exportar" (pelo site do Nubank no computador costuma ser mais fácil). Escolha CSV.',
  },
  {
    bank: "Itaú",
    tip: 'No internet banking pelo computador, abra o extrato e use "Salvar em" ou "Exportar". Escolha OFX (às vezes aparece como "Money").',
  },
  {
    bank: "Bradesco",
    tip: 'No internet banking pelo computador, abra o extrato e procure "Salvar como" ou "Exportar". Escolha OFX (ou "Money").',
  },
  {
    bank: "Banco do Brasil",
    tip: 'No internet banking pelo computador, abra o extrato da conta corrente e procure "Salvar". Escolha OFX ou CSV.',
  },
  {
    bank: "Inter",
    tip: 'No app, abra o extrato e toque em "Exportar" (ou no ícone de compartilhar). Escolha OFX ou CSV.',
  },
  {
    bank: "PicPay",
    tip: 'No app, abra o extrato e procure "Exportar extrato". Escolha CSV (planilha): o arquivo chega por e-mail.',
  },
];

/** "Como baixar o extrato do seu banco": para quem só acha o PDF no app do banco. */
export default function DownloadGuide({ open, onToggle }: Props) {
  return (
    <details
      className={styles.guide}
      open={open}
      onToggle={(e) => onToggle((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary>Como baixar o extrato do seu banco?</summary>

      <div className={styles.body}>
        <p>
          O Vexira lê arquivos <strong>OFX</strong> e <strong>CSV</strong>. PDF e planilha do Excel (.xls)
          ainda não são lidos.
        </p>
        <ul className={styles.tips}>
          <li>
            <strong>Prefira OFX:</strong> é o formato padrão dos bancos e funciona com qualquer um. Às vezes
            aparece como "Money" ou "Quicken".
          </li>
          <li>
            <strong>O app do banco só oferece PDF?</strong> Tente pelo internet banking no computador (ou no
            navegador do celular, em "versão para computador"): lá costuma haver mais formatos.
          </li>
          <li>
            <strong>Conta e cartão são arquivos separados:</strong> importe o extrato da conta e a fatura do
            cartão. O pagamento da fatura já fica fora dos totais, para nada contar em dobro.
          </li>
        </ul>

        <h3 className={styles.title}>Onde procurar em cada banco</h3>
        <dl className={styles.banks}>
          {BANK_TIPS.map(({ bank, tip }) => (
            <div key={bank}>
              <dt>{bank}</dt>
              <dd>{tip}</dd>
            </div>
          ))}
        </dl>
        <p className={styles.note}>
          Outro banco? Procure no extrato por "Exportar", "Salvar como" ou "Baixar" e escolha OFX. Os menus
          dos bancos mudam de vez em quando: se não achar, busque por "exportar extrato" no app.
        </p>
      </div>
    </details>
  );
}
