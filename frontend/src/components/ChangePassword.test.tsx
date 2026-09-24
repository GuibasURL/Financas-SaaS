import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { db } from "../test/fakeApi";
import { renderLoggedIn } from "../test/renderApp";

const NEW_PASSWORD = "Girassol#Azul91";

function card() {
  return screen.getByRole("form", { name: "Alterar senha" });
}

const field = (label: string) => within(card()).getByLabelText(label);

async function openCard() {
  const user = await renderLoggedIn("/perfil");
  await screen.findByRole("form", { name: "Alterar senha" });
  return user;
}

async function fill(
  user: Awaited<ReturnType<typeof openCard>>,
  current: string,
  next: string,
  confirm = next
) {
  if (current) await user.type(field("Senha atual"), current);
  if (next) await user.type(field("Nova senha"), next);
  if (confirm) await user.type(field("Repetir nova senha"), confirm);
  await user.click(within(card()).getByRole("button", { name: "Alterar senha" }));
}

describe("Alterar senha", () => {
  it("troca a senha, limpa os campos e continua logado com o token novo", async () => {
    const user = await openCard();
    const oldToken = localStorage.getItem("financas.token");

    await fill(user, "senha-forte-123", NEW_PASSWORD);

    expect(
      await screen.findByText("Senha alterada. Os outros aparelhos precisarão entrar de novo.")
    ).toBeInTheDocument();
    expect(db.users[0].password).toBe(NEW_PASSWORD);
    expect(field("Senha atual")).toHaveValue("");
    expect(field("Nova senha")).toHaveValue("");
    expect(field("Repetir nova senha")).toHaveValue("");
    // O token antigo caiu na API; o app já guardou o novo
    const newToken = localStorage.getItem("financas.token")!;
    expect(newToken).not.toBe(oldToken);
    expect(db.tokens.has(oldToken!)).toBe(false);
    expect(db.tokens.has(newToken)).toBe(true);

    // Continua navegando normalmente, sem cair no login
    await user.click(screen.getAllByRole("link", { name: "Categorias" })[0]);
    expect(await screen.findByRole("heading", { level: 1, name: "Categorias" })).toBeInTheDocument();
  });

  it("mostra a força e se as senhas conferem, como no cadastro", async () => {
    const user = await openCard();

    await user.type(field("Nova senha"), "fraca");
    expect(document.getElementById("senha-nova-strength")).toHaveTextContent("Força da senha: Fraca");
    expect(field("Nova senha")).toHaveAccessibleDescription(/Força da senha: Fraca/);

    await user.clear(field("Nova senha"));
    await user.type(field("Nova senha"), NEW_PASSWORD);
    await user.type(field("Repetir nova senha"), NEW_PASSWORD);

    expect(document.getElementById("senha-nova-strength")).toHaveTextContent("Forte");
    expect(document.getElementById("senha-repetir-match")).toHaveTextContent("As senhas conferem");
  });

  it("o olhinho mostra e esconde cada senha", async () => {
    const user = await openCard();
    const toggle = within(card()).getByRole("button", { name: "Mostrar a senha atual" });

    await user.click(toggle);
    expect(field("Senha atual")).toHaveAttribute("type", "text");
    expect(field("Nova senha")).toHaveAttribute("type", "password");

    await user.click(toggle);
    expect(field("Senha atual")).toHaveAttribute("type", "password");

    await user.click(within(card()).getByRole("button", { name: "Mostrar a nova senha" }));
    await user.click(within(card()).getByRole("button", { name: "Mostrar a nova senha repetida" }));
    expect(field("Nova senha")).toHaveAttribute("type", "text");
    expect(field("Repetir nova senha")).toHaveAttribute("type", "text");
  });

  it.each([
    ["senha fraca", "senha-forte-123", "senhafraca", "senhafraca", "A senha está fraca"],
    ["senha óbvia", "senha-forte-123", "Senha123!", "Senha123!", "fácil de adivinhar"],
    ["repetição diferente", "senha-forte-123", NEW_PASSWORD, "Outra#Senha91", "As senhas não conferem."],
    ["igual à atual", NEW_PASSWORD, NEW_PASSWORD, NEW_PASSWORD, "precisa ser diferente da atual"],
  ])("recusa antes de enviar: %s", async (_case, current, next, confirm, message) => {
    const user = await openCard();

    await fill(user, current, next, confirm);

    expect(await within(card()).findByRole("alert")).toHaveTextContent(message);
    expect(db.users[0].password).toBe("senha-forte-123");
  });

  it("senha atual errada: mostra o erro e não desloga", async () => {
    const user = await openCard();

    await fill(user, "errada", NEW_PASSWORD);

    expect(await within(card()).findByRole("alert")).toHaveTextContent("Senha atual incorreta");
    expect(db.users[0].password).toBe("senha-forte-123");
    expect(screen.getByRole("heading", { level: 1, name: "Editar perfil" })).toBeInTheDocument();
    // Dá para corrigir sem digitar tudo de novo
    expect(field("Nova senha")).toHaveValue(NEW_PASSWORD);
  });
});
