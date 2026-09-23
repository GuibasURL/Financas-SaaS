import { describe, expect, it, vi } from "vitest";
import { addUser, expireAllTokens, loginAs } from "../test/fakeApi";
import {
  apiErrorMessage,
  getMe,
  getStatements,
  getToken,
  login,
  setUnauthorizedHandler,
} from "./api";

describe("apiErrorMessage", () => {
  const withDetail = (detail: unknown) => ({ response: { data: { detail } } });

  it("usa o detail quando é texto", () => {
    expect(apiErrorMessage(withDetail("E-mail já cadastrado"), "x")).toBe("E-mail já cadastrado");
  });

  it("junta as mensagens de validação (422) e tira o prefixo do Pydantic", () => {
    const detail = [
      { msg: "Value error, A senha precisa ter pelo menos 8 caracteres" },
      { msg: "E-mail inválido" },
    ];

    expect(apiErrorMessage(withDetail(detail), "x")).toBe(
      "A senha precisa ter pelo menos 8 caracteres. E-mail inválido"
    );
  });

  it("usa a mensagem padrão quando não há resposta da API", () => {
    expect(apiErrorMessage(new Error("Network Error"), "Falhou")).toBe("Falhou");
  });
});

describe("token de login", () => {
  it("login salva o token e as próximas chamadas o enviam", async () => {
    addUser("ana@teste.com", "senha-forte-123");

    await login("ana@teste.com", "senha-forte-123");

    expect(getToken()).toMatch(/^token-/);
    expect((await getMe()).email).toBe("ana@teste.com");
  });

  it("401 com usuário logado apaga o token e avisa o app", async () => {
    loginAs(addUser());
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    expireAllTokens();

    await expect(getStatements()).rejects.toThrow();

    expect(getToken()).toBeNull();
    expect(onUnauthorized).toHaveBeenCalledOnce();
    setUnauthorizedHandler(null);
  });

  it("senha errada no login (401 sem token salvo) não dispara o aviso de sessão", async () => {
    addUser("ana@teste.com", "senha-forte-123");
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);

    await expect(login("ana@teste.com", "errada")).rejects.toThrow();

    expect(onUnauthorized).not.toHaveBeenCalled();
    setUnauthorizedHandler(null);
  });
});
