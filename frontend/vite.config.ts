/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
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
});
