import { describe, expect, it } from "vitest";
import { contentSecurityPolicy } from "../vite.config";

function directives(apiUrl = "https://api.vexira.com.br") {
  return Object.fromEntries(
    contentSecurityPolicy(apiUrl)
      .split("; ")
      .map((d) => {
        const [name, ...values] = d.split(" ");
        return [name, values];
      })
  );
}

describe("Content-Security-Policy do site publicado", () => {
  it("scripts só do próprio site: nada de fora nem embutido", () => {
    expect(directives()["script-src"]).toEqual(["'self'"]);
  });

  it("dados só vão para o próprio site e para a API", () => {
    expect(directives()["connect-src"]).toEqual(["'self'", "https://api.vexira.com.br"]);
  });

  it("usa só a origem da API, mesmo com caminho ou barra no fim", () => {
    expect(directives("https://api.vexira.com.br/v1/")["connect-src"]).toEqual([
      "'self'",
      "https://api.vexira.com.br",
    ]);
  });

  it("bloqueia plugins, troca de <base> e envio de formulário para fora", () => {
    const policy = directives();
    expect(policy["object-src"]).toEqual(["'none'"]);
    expect(policy["base-uri"]).toEqual(["'self'"]);
    expect(policy["form-action"]).toEqual(["'self'"]);
    expect(policy["default-src"]).toEqual(["'self'"]);
  });
});
