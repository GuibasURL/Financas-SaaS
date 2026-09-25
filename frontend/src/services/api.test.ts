import { describe, expect, it, vi } from "vitest";
import { AxiosError } from "axios";
import { addUser, API, expireAllTokens, loginAs } from "../test/fakeApi";
import {
  apiErrorMessage,
  getMe,
  getStatements,
  getToken,
  login,
  setUnauthorizedHandler,
  wakeUpServer,
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

  it("usa o message quando o detail é um objeto (ex: extrato repetido)", () => {
    const detail = { code: "duplicates", message: "Este extrato já foi importado.", duplicates: 2 };

    expect(apiErrorMessage(withDetail(detail), "x")).toBe("Este extrato já foi importado.");
  });

  it("usa a mensagem padrão quando não há resposta da API", () => {
    expect(apiErrorMessage(new Error("Network Error"), "Falhou")).toBe("Falhou");
  });

  it("sem conexão com o servidor: diz o motivo", () => {
    const offline = new AxiosError("Network Error", AxiosError.ERR_NETWORK);

    expect(apiErrorMessage(offline, "Não foi possível entrar.")).toBe(
      "Não foi possível entrar. Sem conexão com o servidor: verifique sua internet e tente de novo."
    );
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

describe("wakeUpServer", () => {
  it("chama a raiz da API, que responde sem tocar no banco", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));

    wakeUpServer();

    expect(fetchSpy).toHaveBeenCalledWith(`${API}/`);
    fetchSpy.mockRestore();
  });

  it("erro de rede é ignorado (é só para acordar)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("offline"));

    expect(() => wakeUpServer()).not.toThrow();
    await Promise.resolve();
    fetchSpy.mockRestore();
  });
});
