import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { addStatement, db } from "../test/fakeApi";
import { renderLoggedIn } from "../test/renderApp";

function card() {
  return screen.getByRole("region", { name: "Excluir conta" });
}

async function openForm() {
  const user = await renderLoggedIn("/perfil");
  await user.click(within(card()).getByRole("button", { name: "Excluir minha conta" }));
  return user;
}

const confirmButton = () =>
  within(card()).getByRole("button", { name: "Excluir conta definitivamente" });

describe("Excluir conta", () => {
  it("começa fechado: só explica e mostra o botão", async () => {
    await renderLoggedIn("/perfil");

    expect(card()).toHaveTextContent("Não dá para desfazer");
    expect(card()).toHaveTextContent("baixe o relatório em Excel antes");
    expect(within(card()).queryByLabelText("Sua senha")).not.toBeInTheDocument();
  });

  it("só libera o botão final com a senha e o 'entendo'", async () => {
    const user = await openForm();

    expect(confirmButton()).toBeDisabled();
    await user.type(within(card()).getByLabelText("Sua senha"), "senha-forte-123");
    expect(confirmButton()).toBeDisabled();
    await user.click(within(card()).getByRole("checkbox", { name: /Entendo que/ }));

    expect(confirmButton()).toBeEnabled();
  });

  it("exclui a conta e volta para a tela de entrada com o aviso", async () => {
    addStatement("marco.csv", [{ date: "2025-03-01", description: "IFOOD", amount: -30 }]);
    const user = await openForm();

    await user.type(within(card()).getByLabelText("Sua senha"), "senha-forte-123");
    await user.click(within(card()).getByRole("checkbox", { name: /Entendo que/ }));
    await user.click(confirmButton());

    expect(await screen.findByText("Sua conta foi excluída, junto com todos os seus dados.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bem-vindo de volta" })).toBeInTheDocument();
    expect(db.users).toHaveLength(0);
    expect(db.statements).toHaveLength(0);
    expect(db.transactions).toHaveLength(0);
    expect(localStorage.getItem("financas.token")).toBeNull();
  });

  it("senha errada: mostra o erro, não exclui e não desloga", async () => {
    const user = await openForm();

    await user.type(within(card()).getByLabelText("Sua senha"), "errada");
    await user.click(within(card()).getByRole("checkbox", { name: /Entendo que/ }));
    await user.click(confirmButton());

    expect(await within(card()).findByRole("alert")).toHaveTextContent("Senha atual incorreta");
    expect(db.users).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Editar perfil" })).toBeInTheDocument();
    // Dá para tentar de novo
    expect(confirmButton()).toBeEnabled();
  });

  it("Cancelar fecha e limpa o que foi digitado", async () => {
    const user = await openForm();
    await user.type(within(card()).getByLabelText("Sua senha"), "senha-forte-123");
    await user.click(within(card()).getByRole("checkbox", { name: /Entendo que/ }));

    await user.click(within(card()).getByRole("button", { name: "Cancelar" }));
    await user.click(within(card()).getByRole("button", { name: "Excluir minha conta" }));

    expect(within(card()).getByLabelText("Sua senha")).toHaveValue("");
    expect(within(card()).getByRole("checkbox", { name: /Entendo que/ })).not.toBeChecked();
    expect(db.users).toHaveLength(1);
  });

  it("o olhinho mostra a senha", async () => {
    const user = await openForm();

    await user.click(within(card()).getByRole("button", { name: "Mostrar a senha" }));

    expect(within(card()).getByLabelText("Sua senha")).toHaveAttribute("type", "text");
  });
});
