import { describe, expect, it } from "vitest";
import vercel from "../vercel.json";

// Configuração da hospedagem do site: se algo daqui sumir, o site publicado
// perde proteção (ou o F5 numa página interna dá 404) sem nenhum outro aviso
describe("vercel.json", () => {
  const headers = Object.fromEntries(
    vercel.headers.find((h) => h.source === "/(.*)")!.headers.map((h) => [h.key, h.value])
  );

  it("headers de segurança em todas as páginas", () => {
    // frame-ancestors não funciona pela <meta> da CSP: precisa vir no header
    expect(headers["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    // O link de "Esqueceu a senha?" leva o código na URL: não pode ir para outros sites
    expect(headers["Referrer-Policy"]).toBe("no-referrer");
  });

  it("qualquer caminho abre o app (F5 em /transacoes não dá 404)", () => {
    expect(vercel.rewrites).toContainEqual({ source: "/(.*)", destination: "/index.html" });
  });
});
