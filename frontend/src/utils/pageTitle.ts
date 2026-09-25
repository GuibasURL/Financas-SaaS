import { useEffect } from "react";

// O mesmo do index.html
export const APP_TITLE = "Vexira — Controle financeiro inteligente";

/**
 * Título da aba do navegador: "Transações · Vexira". Ajuda a achar a aba
 * certa e é a primeira coisa que o leitor de tela lê ao trocar de página.
 * Sem título (tela de login), volta ao nome completo do app.
 */
export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · Vexira` : APP_TITLE;
  }, [title]);
}
