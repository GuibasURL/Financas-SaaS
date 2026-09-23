import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "./App";
import { addStatement, addUser, db, expireAllTokens, loginAs } from "./test/fakeApi";

function renderApp() {
  const user = userEvent.setup();
  render(<App />);
  return user;
}

async function fillLogin(user: ReturnType<typeof userEvent.setup>, email: string, password: string) {
  await user.type(await screen.findByLabelText("E-mail"), email);
  await user.type(screen.getByLabelText("Senha"), password);
  await user.click(screen.getByRole("button", { name: "Entrar" }));
}

describe("login", () => {
  it("sem token salvo, mostra a tela de entrar", async () => {
    renderApp();

    expect(await screen.findByRole("heading", { name: "Bem-vindo de volta" })).toBeInTheDocument();
  });

  it("senha errada mostra o erro e continua na tela de login", async () => {
    addUser("ana@teste.com", "senha-forte-123");
    const user = renderApp();

    await fillLogin(user, "ana@teste.com", "senha-errada");

    expect(await screen.findByText("E-mail ou senha incorretos")).toBeInTheDocument();
    expect(localStorage.getItem("financas.token")).toBeNull();
  });

  it("login certo entra no app e mostra o e-mail", async () => {
    addUser("ana@teste.com", "senha-forte-123");
    const user = renderApp();

    await fillLogin(user, "ana@teste.com", "senha-forte-123");

    expect(await screen.findByText("ana@teste.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sair" })).toBeInTheDocument();
    expect(localStorage.getItem("financas.token")).not.toBeNull();
  });
});

describe("cadastro", () => {
  async function openRegister(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole("button", { name: "Criar conta" }));
  }

  it("senhas diferentes não chegam a chamar a API", async () => {
    const user = renderApp();
    await openRegister(user);

    await user.type(screen.getByLabelText("E-mail"), "nova@teste.com");
    await user.type(screen.getByLabelText("Senha"), "senha-forte-123");
    await user.type(screen.getByLabelText("Repetir senha"), "outra-senha-123");
    await user.click(screen.getByRole("button", { name: "Criar conta" }));

    expect(await screen.findByText("As senhas não conferem.")).toBeInTheDocument();
    expect(db.users).toHaveLength(0);
  });

  it("cadastro válido já entra no app", async () => {
    const user = renderApp();
    await openRegister(user);

    await user.type(screen.getByLabelText("E-mail"), "Nova@Teste.com");
    await user.type(screen.getByLabelText("Senha"), "senha-forte-123");
    await user.type(screen.getByLabelText("Repetir senha"), "senha-forte-123");
    await user.click(screen.getByRole("button", { name: "Criar conta" }));

    expect(await screen.findByText("nova@teste.com")).toBeInTheDocument();
  });

  it("e-mail já cadastrado mostra a mensagem da API", async () => {
    addUser("ana@teste.com");
    const user = renderApp();
    await openRegister(user);

    await user.type(screen.getByLabelText("E-mail"), "ana@teste.com");
    await user.type(screen.getByLabelText("Senha"), "senha-forte-123");
    await user.type(screen.getByLabelText("Repetir senha"), "senha-forte-123");
    await user.click(screen.getByRole("button", { name: "Criar conta" }));

    expect(await screen.findByText("E-mail já cadastrado")).toBeInTheDocument();
  });
});

describe("sessão", () => {
  it("com token válido salvo, abre direto o app (login sobrevive ao F5)", async () => {
    loginAs(addUser("ana@teste.com"));

    renderApp();

    expect(await screen.findByText("ana@teste.com")).toBeInTheDocument();
  });

  it("com token inválido salvo, volta para o login e apaga o token", async () => {
    localStorage.setItem("financas.token", "token-que-nao-vale");

    renderApp();

    expect(await screen.findByRole("heading", { name: "Bem-vindo de volta" })).toBeInTheDocument();
    expect(localStorage.getItem("financas.token")).toBeNull();
  });

  it("Sair apaga o token e volta para o login sem aviso de sessão", async () => {
    loginAs(addUser());
    const user = renderApp();

    await user.click(await screen.findByRole("button", { name: "Sair" }));

    expect(await screen.findByRole("heading", { name: "Bem-vindo de volta" })).toBeInTheDocument();
    expect(screen.queryByText(/sessão expirou/)).not.toBeInTheDocument();
    expect(localStorage.getItem("financas.token")).toBeNull();
  });

  it("token que expira durante o uso volta para o login com aviso", async () => {
    loginAs(addUser());
    addStatement("marco.csv", [{ date: "2025-03-01", description: "IFOOD", amount: -30 }]);
    window.history.pushState({}, "", "/extratos");
    const user = renderApp();
    await user.click(await screen.findByRole("button", { name: "Filtrar por marco.csv" }));
    expireAllTokens();

    await user.click(within(await screen.findByRole("status")).getByRole("button", { name: "Ver todos" }));

    expect(await screen.findByText("Sua sessão expirou. Entre novamente.")).toBeInTheDocument();
    expect(localStorage.getItem("financas.token")).toBeNull();
  });

  it("dá para voltar do cadastro para o login", async () => {
    const user = renderApp();
    await user.click(await screen.findByRole("button", { name: "Criar conta" }));

    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(screen.getByRole("heading", { name: "Bem-vindo de volta" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Repetir senha")).not.toBeInTheDocument();
  });
});
