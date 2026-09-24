/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Content-Security-Policy do site publicado: o navegador só roda scripts do
 * próprio site e só conversa com a API da Vexira. Se algum texto malicioso
 * chegasse à página, não conseguiria carregar código de fora nem mandar o
 * token de login para outro endereço.
 *
 * Só no build: o servidor de desenvolvimento do Vite injeta scripts que a
 * política bloquearia. (frame-ancestors não funciona em <meta>; no deploy,
 * mande também o header Content-Security-Policy pela hospedagem.)
 */
export function contentSecurityPolicy(apiUrl: string): string {
  return [
    "default-src 'self'",
    "script-src 'self'",
    // 'unsafe-inline' em estilos: o React e os gráficos usam style="..."
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    // data: e blob: para a foto do perfil (prévia e a salva)
    "img-src 'self' data: blob:",
    `connect-src 'self' ${new URL(apiUrl).origin}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

function cspPlugin(apiUrl: string): Plugin {
  return {
    name: "vexira-csp",
    apply: "build",
    transformIndexHtml: () => [
      {
        tag: "meta",
        attrs: { "http-equiv": "Content-Security-Policy", content: contentSecurityPolicy(apiUrl) },
        injectTo: "head-prepend",
      },
    ],
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Mesmo padrão do services/api.ts
  const apiUrl = env.VITE_API_URL || "http://localhost:8000";

  return {
    plugins: [react(), cspPlugin(apiUrl)],
    // O CORS do backend só libera a 5173; falhar é melhor que cair em outra porta.
    server: {
      port: 5173,
      strictPort: true,
    },
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test/setup.tsx"],
      // Fuso fixo para os testes de data/hora não dependerem da máquina
      env: { TZ: "America/Sao_Paulo" },
      coverage: {
        include: ["src/**"],
        // types/ só tem declarações de tipo (nada roda); main.tsx só monta o App
        exclude: ["src/test/**", "src/**/*.test.*", "src/types/**", "src/main.tsx", "src/vite-env.d.ts"],
        reporter: ["text", "html"],
        // O CI falha se a cobertura cair abaixo disso
        thresholds: { lines: 95, statements: 95, functions: 95, branches: 90 },
      },
    },
  };
});
