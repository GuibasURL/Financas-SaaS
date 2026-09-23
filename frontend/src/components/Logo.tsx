import { useId } from "react";

/**
 * Marca da Vexira: a letra V que vira uma seta para cima (dinheiro subindo),
 * no degradê ciano -> azul do próprio app. Mesmo desenho de
 * Docs/marca/vexira-marca.svg, aqui inline para usar as cores do tema.
 */
export function LogoMark({ className }: { className?: string }) {
  // Id único por instância: duas marcas na mesma página não disputam o degradê.
  // (O useId gera ":r0:"; os dois-pontos atrapalham o url(#...) em alguns navegadores.)
  const gradient = `vexira-${useId().replace(/:/g, "")}`;

  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gradient} x1="6" y1="58" x2="58" y2="6" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: "var(--cyan)" }} />
          <stop offset="1" style={{ stopColor: "var(--sky)" }} />
        </linearGradient>
      </defs>
      <g
        fill="none"
        stroke={`url(#${gradient})`}
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10 12 L31 50" />
        <path d="M31 50 L48 22" />
        <path d="M41.3 18.6 L52 16 L54.6 26.7" />
      </g>
    </svg>
  );
}

interface LogoProps {
  // Classes do container, da marca e do nome (tamanhos ficam no CSS de quem usa)
  className?: string;
  markClassName?: string;
  nameClassName?: string;
}

/** Marca + nome "Vexira" */
export default function Logo({ className, markClassName, nameClassName }: LogoProps) {
  return (
    <div className={className}>
      <LogoMark className={markClassName} />
      <span className={nameClassName}>Vexira</span>
    </div>
  );
}
