interface Props {
  // Lido pelo leitor de tela (ex: "Carregando transações")
  label: string;
  rows?: number;
  // Altura de cada faixa (padrão: a de uma linha de tabela)
  rowHeight?: string;
}

/**
 * Faixas piscando no lugar do conteúdo enquanto os dados carregam: sem isso,
 * a tela mostraria "nenhum extrato" e R$ 0,00 por um instante, como se a conta
 * estivesse vazia.
 */
export default function Skeleton({ label, rows = 3, rowHeight }: Props) {
  return (
    <div className="skeleton" role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <i key={i} style={rowHeight ? { height: rowHeight } : undefined} />
      ))}
    </div>
  );
}
