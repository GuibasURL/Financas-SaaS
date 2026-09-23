import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { Blob as NodeBlob, File as NodeFile } from "node:buffer";
import { cloneElement, type ReactElement } from "react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { resetDb, server } from "./fakeApi";

// O FormData/File/Blob do jsdom não são reconhecidos pelo MSW: um upload
// chegaria como texto ("[object FormData]") em vez de multipart, e o Blob do
// jsdom nem tem .text(). Usa as versões nativas do Node, que o MSW entende.
// (Só afeta os testes; no navegador de verdade o upload usa as do browser.)
// O FormData do Node não é exportado por nenhum módulo, então vem de uma Response.
//
// O Vitest 5 troca o Request global por um que converte FormData do jsdom,
// mas nessa conversão o File vira Blob e perde o nome ("maio.csv" chega como
// "blob"). Como aqui tudo já é do Node, volta o Request original do Node
// (a classe da qual o do Vitest herda).
const nodeFormData = await new Response("", {
  headers: { "content-type": "application/x-www-form-urlencoded" },
}).formData();
Object.assign(globalThis, {
  FormData: nodeFormData.constructor,
  File: NodeFile,
  Blob: NodeBlob,
  Request: Object.getPrototypeOf(globalThis.Request),
});

// O ResponsiveContainer do Recharts mede o elemento pai, que no jsdom tem
// tamanho 0 (e não existe ResizeObserver). Nos testes ele vira um
// container de tamanho fixo, o suficiente para os gráficos renderizarem.
vi.mock("recharts", async (importOriginal) => {
  const recharts = await importOriginal<typeof import("recharts")>();
  return {
    ...recharts,
    ResponsiveContainer: ({ children }: { children: ReactElement }) => (
      <div style={{ width: 800, height: 300 }}>
        {cloneElement(children, { width: 800, height: 300 } as object)}
      </div>
    ),
  };
});

// Requisição sem handler na API falsa é erro de teste, não deve passar calada
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetDb();
  localStorage.clear();
  vi.restoreAllMocks();
});

afterAll(() => server.close());
