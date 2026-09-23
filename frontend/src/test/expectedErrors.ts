import { onTestFinished, vi } from "vitest";

/**
 * Para testes que provocam um erro de render de propósito: o React loga no
 * console.error e o jsdom imprime o erro "não tratado" com a pilha inteira.
 * Cancelar o evento "error" da janela faz o jsdom não imprimir; só vale até
 * o fim do teste, para não esconder erros de verdade nos outros.
 */
export function silenceExpectedRenderErrors() {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const cancel = (event: ErrorEvent) => event.preventDefault();
  window.addEventListener("error", cancel);
  onTestFinished(() => window.removeEventListener("error", cancel));
}
