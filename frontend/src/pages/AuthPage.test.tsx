import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse, delay } from "msw";
import { describe, expect, it, vi } from "vitest";
import AuthPage from "./AuthPage";
import { addUser, API, server } from "../test/fakeApi";

function renderAuth(notice?: string) {
  const onAuthenticated = vi.fn();
  const user = userEvent.setup();
  render(<AuthPage onAuthenticated={onAuthenticated} notice={notice} />);
  return { user, onAuthenticated };
}

describe("AuthPage", () => {
  it("começa na aba Entrar", () => {
    renderAuth();

    expect(screen.getByRole("tab", { name: "Entrar" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Criar conta" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("heading", { name: "Bem-vindo de volta" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Repetir senha")).not.toBeInTheDocument();
  });

  it("clicar na aba Criar conta mostra o formulário de cadastro", async () => {
    const { user } = renderAuth();

    await user.click(screen.getByRole("tab", { name: "Criar conta" }));

    expect(screen.getByRole("tab", { name: "Criar conta" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Crie sua conta" })).toBeInTheDocument();
    expect(screen.getByLabelText("Repetir senha")).toBeInTheDocument();
    // A dica de tamanho mínimo fica ligada ao campo de senha (leitores de tela)
    expect(screen.getByLabelText("Senha")).toHaveAccessibleDescription("Mínimo 8 caracteres");
  });

  it("setas do teclado trocam de aba e levam o foco junto", async () => {
    const { user } = renderAuth();
    screen.getByRole("tab", { name: "Entrar" }).focus();

    await user.keyboard("{ArrowRight}");

    const register = screen.getByRole("tab", { name: "Criar conta" });
    expect(register).toHaveAttribute("aria-selected", "true");
    expect(register).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Entrar" })).toHaveFocus();
  });

  it("trocar de aba limpa a senha e o erro", async () => {
    const { user } = renderAuth();
    await user.type(screen.getByLabelText("E-mail"), "ana@teste.com");
    await user.type(screen.getByLabelText("Senha"), "senha-errada");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    await screen.findByRole("alert");

    await user.click(screen.getByRole("tab", { name: "Criar conta" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toHaveValue("");
    expect(screen.getByLabelText("E-mail")).toHaveValue("ana@teste.com"); // e-mail fica
  });

  it("erro aparece como alerta e aviso de sessão como status", async () => {
    const { user } = renderAuth("Sua sessão expirou. Entre novamente.");

    expect(screen.getByRole("status")).toHaveTextContent("Sua sessão expirou. Entre novamente.");

    await user.type(screen.getByLabelText("E-mail"), "ninguem@teste.com");
    await user.type(screen.getByLabelText("Senha"), "qualquer-senha");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("E-mail ou senha incorretos");
  });

  it("enquanto envia, botões ficam desabilitados e mostram Aguarde", async () => {
    addUser("ana@teste.com", "senha-forte-123");
    server.use(
      http.post(`${API}/auth/login`, async () => {
        await delay("infinite");
        return HttpResponse.json({});
      })
    );
    const { user } = renderAuth();

    await user.type(screen.getByLabelText("E-mail"), "ana@teste.com");
    await user.type(screen.getByLabelText("Senha"), "senha-forte-123");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("button", { name: "Aguarde..." })).toBeDisabled();
    expect(screen.getByRole("tab", { name: "Criar conta" })).toBeDisabled();
  });

  it("login certo avisa o App com o usuário", async () => {
    addUser("ana@teste.com", "senha-forte-123");
    const { user, onAuthenticated } = renderAuth();

    await user.type(screen.getByLabelText("E-mail"), "ana@teste.com");
    await user.type(screen.getByLabelText("Senha"), "senha-forte-123");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    await vi.waitFor(() =>
      expect(onAuthenticated).toHaveBeenCalledWith(expect.objectContaining({ email: "ana@teste.com" }))
    );
  });

  it("mostra o aviso de projeto de demonstração", () => {
    renderAuth();

    expect(screen.getByText("Projeto de demonstração: não envie extratos reais.")).toBeInTheDocument();
  });
});
