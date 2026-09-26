import { render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import App from "../App";
import { addUser, API, db, issueResetToken, loginAs, server } from "../test/fakeApi";

const NEW_PASSWORD = "Girassol#Azul91";

function openApp(path = "/") {
  window.history.pushState({}, "", path);
  const user = userEvent.setup();
  render(<App />);
  return user;
}

describe("Esqueceu a senha?", () => {
  it("o link aparece no login e leva o e-mail já digitado", async () => {
    addUser("ana@teste.com");
    const user = openApp();

    await user.type(await screen.findByLabelText("E-mail"), "ana@teste.com");
    await user.click(screen.getByRole("button", { name: "Esqueceu a senha?" }));

    expect(screen.getByRole("heading", { name: "Esqueceu a senha?" })).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toHaveValue("ana@teste.com");
  });

  it("no cadastro o link não aparece", async () => {
    const user = openApp();

    await user.click(await screen.findByRole("tab", { name: "Criar conta" }));

    expect(screen.queryByRole("button", { name: "Esqueceu a senha?" })).not.toBeInTheDocument();
  });

  it("pede o link e mostra a mesma resposta com ou sem conta", async () => {
    addUser("ana@teste.com");
    const user = openApp();
    await user.click(await screen.findByRole("button", { name: "Esqueceu a senha?" }));

    await user.type(screen.getByLabelText("E-mail"), "ninguem@teste.com");
    await user.click(screen.getByRole("button", { name: "Enviar link" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Se houver uma conta com esse e-mail, enviamos um link"
    );
    expect(screen.getByRole("status")).toHaveTextContent("O link vale por 30 minutos.");
    expect(db.resetRequests).toEqual(["ninguem@teste.com"]);

    await user.click(screen.getByRole("button", { name: "Voltar para o login" }));
    expect(screen.getByRole("heading", { name: "Bem-vindo de volta" })).toBeInTheDocument();
  });

  it("Voltar para o login sem pedir nada", async () => {
    const user = openApp();
    await user.click(await screen.findByRole("button", { name: "Esqueceu a senha?" }));

    await user.click(screen.getByRole("button", { name: "Voltar para o login" }));

    expect(screen.getByRole("heading", { name: "Bem-vindo de volta" })).toBeInTheDocument();
    expect(db.resetRequests).toEqual([]);
  });

  it("mostra o erro de muitos pedidos", async () => {
    server.use(
      http.post(`${API}/auth/forgot-password`, () =>
        HttpResponse.json(
          { detail: "Muitos pedidos de redefinição de senha. Tente de novo em 15 minutos." },
          { status: 429 }
        )
      )
    );
    const user = openApp();
    await user.click(await screen.findByRole("button", { name: "Esqueceu a senha?" }));

    await user.type(screen.getByLabelText("E-mail"), "ana@teste.com");
    await user.click(screen.getByRole("button", { name: "Enviar link" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Muitos pedidos de redefinição");
  });
});

describe("Criar senha nova pelo link", () => {
  it("tira o código da barra de endereço assim que abre", async () => {
    const token = issueResetToken(addUser("ana@teste.com"));

    openApp(`/redefinir-senha?token=${token}`);

    expect(await screen.findByRole("heading", { name: "Criar senha nova" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/redefinir-senha");
    expect(window.location.search).toBe("");
  });

  it("funciona com o StrictMode do React (como no main.tsx)", async () => {
    const token = issueResetToken(addUser("ana@teste.com"));
    window.history.pushState({}, "", `/redefinir-senha?token=${token}`);

    render(
      <StrictMode>
        <App />
      </StrictMode>
    );

    expect(await screen.findByRole("heading", { name: "Criar senha nova" })).toBeInTheDocument();
    expect(window.location.search).toBe("");
  });

  it("redefine a senha e volta para o login com o aviso", async () => {
    const ana = addUser("ana@teste.com");
    const token = issueResetToken(ana);
    const user = openApp(`/redefinir-senha?token=${token}`);

    await user.type(await screen.findByLabelText("Senha nova"), NEW_PASSWORD);
    expect(document.getElementById("reset-strength")).toHaveTextContent("Forte");
    await user.type(screen.getByLabelText("Repetir senha nova"), NEW_PASSWORD);
    expect(document.getElementById("reset-match")).toHaveTextContent("As senhas conferem");
    await user.click(screen.getByRole("button", { name: "Salvar senha nova" }));

    expect(await screen.findByText("Senha redefinida. Entre com a senha nova.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bem-vindo de volta" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
    expect(ana.password).toBe(NEW_PASSWORD);
  });

  it("aberto com alguém logado neste navegador: redefine e sai da conta", async () => {
    const ana = addUser("ana@teste.com");
    loginAs(ana);
    const token = issueResetToken(ana);
    const user = openApp(`/redefinir-senha?token=${token}`);

    await user.type(await screen.findByLabelText("Senha nova"), NEW_PASSWORD);
    await user.type(screen.getByLabelText("Repetir senha nova"), NEW_PASSWORD);
    await user.click(screen.getByRole("button", { name: "Salvar senha nova" }));

    expect(await screen.findByText("Senha redefinida. Entre com a senha nova.")).toBeInTheDocument();
    expect(localStorage.getItem("financas.token")).toBeNull();
  });

  it.each([
    ["senha fraca", "fraquinha", "fraquinha", "A senha está fraca"],
    ["repetição diferente", NEW_PASSWORD, "Outra#Senha91", "As senhas não conferem."],
  ])("recusa antes de enviar: %s", async (_case, password, confirm, message) => {
    const ana = addUser("ana@teste.com");
    const token = issueResetToken(ana);
    const user = openApp(`/redefinir-senha?token=${token}`);

    await user.type(await screen.findByLabelText("Senha nova"), password);
    await user.type(screen.getByLabelText("Repetir senha nova"), confirm);
    await user.click(screen.getByRole("button", { name: "Salvar senha nova" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(ana.password).toBe("senha-forte-123");
  });

  it("link inválido ou vencido: oferece pedir outro", async () => {
    addUser("ana@teste.com");
    const user = openApp("/redefinir-senha?token=vencido");

    await user.type(await screen.findByLabelText("Senha nova"), NEW_PASSWORD);
    await user.type(screen.getByLabelText("Repetir senha nova"), NEW_PASSWORD);
    await user.click(screen.getByRole("button", { name: "Salvar senha nova" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Este link é inválido ou já expirou");
    await user.click(screen.getByRole("button", { name: "Pedir um novo link" }));

    expect(screen.getByRole("heading", { name: "Esqueceu a senha?" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
  });

  it("erro que não é do link: deixa tentar de novo", async () => {
    server.use(
      http.post(`${API}/auth/reset-password`, () => HttpResponse.json({ detail: "Falhou" }, { status: 500 }))
    );
    const token = issueResetToken(addUser("ana@teste.com"));
    const user = openApp(`/redefinir-senha?token=${token}`);

    await user.type(await screen.findByLabelText("Senha nova"), NEW_PASSWORD);
    await user.type(screen.getByLabelText("Repetir senha nova"), NEW_PASSWORD);
    await user.click(screen.getByRole("button", { name: "Salvar senha nova" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Falhou");
    expect(screen.getByRole("button", { name: "Salvar senha nova" })).toBeEnabled();
  });

  it("Voltar para o login sem redefinir", async () => {
    const token = issueResetToken(addUser("ana@teste.com"));
    const user = openApp(`/redefinir-senha?token=${token}`);

    await user.click(await screen.findByRole("button", { name: "Voltar para o login" }));

    expect(await screen.findByRole("heading", { name: "Bem-vindo de volta" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
  });

  it("o olhinho mostra cada senha", async () => {
    const token = issueResetToken(addUser("ana@teste.com"));
    const user = openApp(`/redefinir-senha?token=${token}`);

    await user.click(await screen.findByRole("button", { name: "Mostrar a senha nova" }));
    await user.click(screen.getByRole("button", { name: "Mostrar a senha repetida" }));

    expect(screen.getByLabelText("Senha nova")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Repetir senha nova")).toHaveAttribute("type", "text");
  });

  it("/redefinir-senha sem código: segue o app normal", async () => {
    addUser("ana@teste.com");

    openApp("/redefinir-senha");

    expect(await screen.findByRole("heading", { name: "Bem-vindo de volta" })).toBeInTheDocument();
  });
});
