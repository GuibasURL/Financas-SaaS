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
  },
});
