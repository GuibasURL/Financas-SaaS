import { render, screen, within } from "@testing-library/react";
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
    expect(screen.getByText("Vexira")).toBeInTheDocument();
  });

  it("clicar na aba Criar conta mostra o formulário de cadastro", async () => {
    const { user } = renderAuth();

    await user.click(screen.getByRole("tab", { name: "Criar conta" }));

    expect(screen.getByRole("tab", { name: "Criar conta" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Crie sua conta" })).toBeInTheDocument();
    expect(screen.getByLabelText("Repetir senha")).toBeInTheDocument();
    // A força e os requisitos ficam ligados ao campo de senha (leitores de tela)
    expect(screen.getByLabelText("Senha")).toHaveAccessibleDescription(
      /Força da senha: digite uma senha.*Pelo menos 8 caracteres \(falta\)/
    );
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

  describe("mostrar senha (olhinho)", () => {
    it("o olhinho mostra e esconde a senha digitada", async () => {
      const { user } = renderAuth();
      const password = screen.getByLabelText("Senha");
      const eye = screen.getByRole("button", { name: "Mostrar senha" });
      await user.type(password, "minha-senha");

      expect(password).toHaveAttribute("type", "password");
      expect(eye).toHaveAttribute("aria-pressed", "false");
      expect(eye).toHaveAttribute("title", "Mostrar senha");

      await user.click(eye);
      expect(password).toHaveAttribute("type", "text");
      expect(password).toHaveValue("minha-senha");
      expect(eye).toHaveAttribute("aria-pressed", "true");
      expect(eye).toHaveAttribute("title", "Ocultar senha");

      await user.click(eye);
      expect(password).toHaveAttribute("type", "password");
    });

    it("no cadastro, cada campo de senha tem o próprio olhinho", async () => {
      const { user } = renderAuth();
      await user.click(screen.getByRole("tab", { name: "Criar conta" }));

      await user.click(screen.getByRole("button", { name: "Mostrar a senha repetida" }));

      expect(screen.getByLabelText("Repetir senha")).toHaveAttribute("type", "text");
      expect(screen.getByLabelText("Senha")).toHaveAttribute("type", "password");
      // Mostrar a senha não pode quebrar a descrição ligada ao campo
      expect(screen.getByLabelText("Senha")).toHaveAccessibleDescription(/Força da senha/);
    });

    it("volta a esconder ao trocar de aba", async () => {
      const { user } = renderAuth();
      await user.click(screen.getByRole("button", { name: "Mostrar senha" }));

      await user.click(screen.getByRole("tab", { name: "Criar conta" }));

      expect(screen.getByLabelText("Senha")).toHaveAttribute("type", "password");
      expect(screen.getByRole("button", { name: "Mostrar senha" })).toHaveAttribute(
        "aria-pressed",
        "false"
      );
    });

    it("volta a esconder ao enviar (para o gerenciador de senhas reconhecer)", async () => {
      addUser("ana@teste.com", "senha-forte-123");
      const { user } = renderAuth();
      await user.type(screen.getByLabelText("E-mail"), "ana@teste.com");
      await user.type(screen.getByLabelText("Senha"), "senha-errada");
      await user.click(screen.getByRole("button", { name: "Mostrar senha" }));

      await user.click(screen.getByRole("button", { name: "Entrar" }));

      expect(await screen.findByText("E-mail ou senha incorretos")).toBeInTheDocument();
      expect(screen.getByLabelText("Senha")).toHaveAttribute("type", "password");
    });

    it("o olhinho não envia o formulário", async () => {
      const { user, onAuthenticated } = renderAuth();

      await user.click(screen.getByRole("button", { name: "Mostrar senha" }));

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(onAuthenticated).not.toHaveBeenCalled();
    });
  });

  describe("força da senha (cadastro)", () => {
    async function openRegister() {
      const ctx = renderAuth();
      await ctx.user.click(screen.getByRole("tab", { name: "Criar conta" }));
      return ctx;
    }
    const strengthText = () => document.getElementById("password-strength")!;
    const requirement = (label: string) =>
      within(screen.getByRole("list", { name: "Requisitos da senha" })).getByText(label, {
        exact: false,
      });

    it("só aparece no cadastro", async () => {
      renderAuth();
      expect(screen.queryByRole("list", { name: "Requisitos da senha" })).not.toBeInTheDocument();
    });

    it.each([
      ["abc", "Fraca"],
      ["girassol", "Fraca"],
      ["girassol1!", "Mediana"],
      ["Senha-forte-123", "Forte"],
    ])("\"%s\" é %s", async (password, label) => {
      const { user } = await openRegister();

      await user.type(screen.getByLabelText("Senha"), password);

      expect(strengthText()).toHaveTextContent(`Força da senha: ${label}`);
    });

    it("a checklist marca o que a senha já tem e diz o que falta", async () => {
      const { user } = await openRegister();
      expect(strengthText()).toHaveTextContent("Força da senha: digite uma senha");

      await user.type(screen.getByLabelText("Senha"), "girassol1");

      expect(requirement("Pelo menos 8 caracteres")).toHaveTextContent("(ok)");
      expect(requirement("Letra minúscula")).toHaveTextContent("(ok)");
      expect(requirement("Número")).toHaveTextContent("(ok)");
      expect(requirement("Letra maiúscula")).toHaveTextContent("(falta)");
      expect(requirement("Caractere especial")).toHaveTextContent("(falta)");
    });

    it("senha fraca não envia e diz o que falta", async () => {
      const { user, onAuthenticated } = await openRegister();
      await user.type(screen.getByLabelText("E-mail"), "nova@teste.com");
      await user.type(screen.getByLabelText("Senha"), "girassol");
      await user.type(screen.getByLabelText("Repetir senha"), "girassol");

      await user.click(screen.getByRole("button", { name: "Criar conta" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "A senha está fraca. Falta: letra maiúscula, número, caractere especial (!@#$...)."
      );
      expect(onAuthenticated).not.toHaveBeenCalled();
    });

    it("senha mediana cria a conta", async () => {
      const { user, onAuthenticated } = await openRegister();
      await user.type(screen.getByLabelText("E-mail"), "nova@teste.com");
      await user.type(screen.getByLabelText("Senha"), "girassol1!");
      await user.type(screen.getByLabelText("Repetir senha"), "girassol1!");

      await user.click(screen.getByRole("button", { name: "Criar conta" }));

      await vi.waitFor(() => expect(onAuthenticated).toHaveBeenCalled());
    });
  
    it("senha comum aparece na checklist como fácil de adivinhar e não envia", async () => {
      const { user, onAuthenticated } = await openRegister();
      await user.type(screen.getByLabelText("E-mail"), "nova@teste.com");
      await user.type(screen.getByLabelText("Senha"), "Senha123!");

      expect(requirement("Fácil de adivinhar: é uma senha muito comum")).toHaveTextContent("(falta)");
      expect(strengthText()).toHaveTextContent("Força da senha: Fraca");

      await user.type(screen.getByLabelText("Repetir senha"), "Senha123!");
      await user.click(screen.getByRole("button", { name: "Criar conta" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "A senha é fácil de adivinhar: é uma senha muito comum. Escolha outra."
      );
      expect(onAuthenticated).not.toHaveBeenCalled();
    });

    it("senha que contém o e-mail é fraca", async () => {
      const { user } = await openRegister();
      await user.type(screen.getByLabelText("E-mail"), "joao.silva@teste.com");

      await user.type(screen.getByLabelText("Senha"), "Joaosilva2024!");

      expect(requirement("Fácil de adivinhar: contém o seu e-mail")).toBeInTheDocument();
      expect(strengthText()).toHaveTextContent("Força da senha: Fraca");
    });

    it("senha boa marca o item como ok", async () => {
      const { user } = await openRegister();
      expect(requirement("Não é fácil de adivinhar")).toHaveTextContent("(falta)");

      await user.type(screen.getByLabelText("Senha"), "Girassol1!");

      expect(requirement("Não é fácil de adivinhar")).toHaveTextContent("(ok)");
    });
  });

  describe("as senhas conferem (cadastro)", () => {
    it("avisa enquanto digita a repetição e confirma quando bate", async () => {
      const { user } = renderAuth();
      await user.click(screen.getByRole("tab", { name: "Criar conta" }));
      const match = document.getElementById("password-match")!;
      const confirm = screen.getByLabelText("Repetir senha");
      expect(match).toHaveAttribute("aria-live", "polite");
      expect(match).toBeEmptyDOMElement();

      await user.type(screen.getByLabelText("Senha"), "Girassol1!");
      await user.type(confirm, "Girassol");
      expect(match).toHaveTextContent("As senhas ainda não conferem");
      expect(confirm).toHaveAccessibleDescription("As senhas ainda não conferem");

      await user.type(confirm, "1!");
      expect(match).toHaveTextContent("As senhas conferem");

      await user.clear(confirm);
      expect(match).toBeEmptyDOMElement();
    });
  });
});
