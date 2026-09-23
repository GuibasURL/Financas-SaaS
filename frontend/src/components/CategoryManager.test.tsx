import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CategoryManager from "./CategoryManager";
import { getCategories } from "../services/api";
import { addCategory, addStatement, addUser, db, loginAs } from "../test/fakeApi";
import type { Category } from "../types/transaction";

// Faz o papel do Dashboard: carrega as categorias da API e recarrega a cada mudança
function Harness() {
  const [categories, setCategories] = useState<Category[]>([]);
  const load = () => getCategories().then(setCategories);
  useEffect(() => {
    load();
  }, []);
  return <CategoryManager categories={categories} onChanged={load} />;
}

function renderManager() {
  const user = userEvent.setup();
  render(<Harness />);
  return user;
}

function categoryRow(name: string) {
  return screen.getByRole("cell", { name }).closest("tr")!;
}

describe("CategoryManager", () => {
  beforeEach(() => {
    loginAs(addUser());
  });

  it("sem categorias, convida a criar uma", async () => {
    renderManager();

    expect(
      await screen.findByText("Nenhuma categoria ainda. Crie uma abaixo ou adicione as sugeridas.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Aplicar regras às transações sem categoria" })
    ).toBeDisabled();
  });

  it("cria categoria e limpa o formulário", async () => {
    const user = renderManager();

    await user.type(await screen.findByLabelText("Nome da nova categoria"), "Lazer");
    await user.type(screen.getByLabelText("Palavras-chave da nova categoria"), "cinema,netflix");
    await user.click(screen.getByRole("button", { name: "Adicionar" }));

    expect(await screen.findByRole("cell", { name: "Lazer" })).toBeInTheDocument();
    expect(within(categoryRow("Lazer")).getByText("cinema, netflix")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome da nova categoria")).toHaveValue("");
    expect(db.categories[0].ignore_in_reports).toBe(false);
  });

  it("cria categoria ignorada nos gráficos", async () => {
    const user = renderManager();

    await user.type(await screen.findByLabelText("Nome da nova categoria"), "Pagamento de fatura");
    await user.click(screen.getByLabelText(/Ignorar nos gráficos/));
    await user.click(screen.getByRole("button", { name: "Adicionar" }));

    await screen.findByRole("cell", { name: "Pagamento de fatura" });
    expect(within(categoryRow("Pagamento de fatura")).getByText("ignorada")).toBeInTheDocument();
    expect(db.categories[0].ignore_in_reports).toBe(true);
    expect(screen.getByLabelText(/Ignorar nos gráficos/)).not.toBeChecked();
  });

  it("mostra o erro da API ao criar nome repetido", async () => {
    addCategory({ name: "Lazer" });
    const user = renderManager();

    await user.type(await screen.findByLabelText("Nome da nova categoria"), "Lazer");
    await user.click(screen.getByRole("button", { name: "Adicionar" }));

    expect(await screen.findByText("Categoria já existe")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome da nova categoria")).toHaveValue("Lazer");
  });

  it("edita nome, palavras-chave e a opção de ignorar", async () => {
    addCategory({ name: "Alimentação", keywords: "ifood" });
    const user = renderManager();
    await screen.findByRole("cell", { name: "Alimentação" });

    await user.click(within(categoryRow("Alimentação")).getByRole("button", { name: "Editar" }));
    const name = screen.getByLabelText("Nome");
    await user.clear(name);
    await user.type(name, "Comida");
    await user.type(screen.getByLabelText("Palavras-chave"), ", padaria");
    await user.click(screen.getByLabelText("ignorar"));
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByRole("cell", { name: "Comida" })).toBeInTheDocument();
    expect(db.categories[0]).toMatchObject({
      name: "Comida",
      keywords: "ifood, padaria",
      ignore_in_reports: true,
    });
  });

  it("cancelar a edição não salva nada", async () => {
    addCategory({ name: "Alimentação" });
    const user = renderManager();
    await screen.findByRole("cell", { name: "Alimentação" });

    await user.click(within(categoryRow("Alimentação")).getByRole("button", { name: "Editar" }));
    await user.type(screen.getByLabelText("Nome"), " editada");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.getByRole("cell", { name: "Alimentação" })).toBeInTheDocument();
    expect(db.categories[0].name).toBe("Alimentação");
  });

  it("excluir pede confirmação", async () => {
    addCategory({ name: "Lazer" });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = renderManager();
    await screen.findByRole("cell", { name: "Lazer" });

    await user.click(within(categoryRow("Lazer")).getByRole("button", { name: "Excluir" }));

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("ficam sem categoria"));
    expect(
      await screen.findByText("Nenhuma categoria ainda. Crie uma abaixo ou adicione as sugeridas.")
    ).toBeInTheDocument();
  });

  it.each([
    [["IFOOD LANCHE"], "1 transação foi categorizada."],
    [["IFOOD LANCHE", "IFOOD JANTAR"], "2 transações foram categorizadas."],
    [["FARMACIA"], "Nenhuma transação sem categoria bateu com as palavras-chave."],
  ])("aplicar regras em %j mostra \"%s\"", async (descriptions, message) => {
    addCategory({ name: "Alimentação", keywords: "ifood" });
    addStatement(
      "extrato.csv",
      descriptions.map((description) => ({ date: "2025-03-01", description, amount: -10 }))
    );
    const user = renderManager();
    await screen.findByRole("cell", { name: "Alimentação" });

    await user.click(
      screen.getByRole("button", { name: "Aplicar regras às transações sem categoria" })
    );

    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it("adiciona as categorias sugeridas e avisa para aplicar as regras", async () => {
    const user = renderManager();
    await screen.findByText(/Nenhuma categoria ainda/);

    await user.click(screen.getByRole("button", { name: "Adicionar categorias sugeridas" }));

    expect(
      await screen.findByText(/3 categorias sugeridas adicionadas\. Use "Aplicar regras"/)
    ).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Saúde" })).toBeInTheDocument();
  });

  it("não duplica e avisa quando já tem todas as sugeridas", async () => {
    addCategory({ name: "Alimentação" });
    addCategory({ name: "Transporte" });
    addCategory({ name: "Saúde" });
    const user = renderManager();
    await screen.findByRole("cell", { name: "Saúde" });

    await user.click(screen.getByRole("button", { name: "Adicionar categorias sugeridas" }));

    expect(await screen.findByText("Você já tem todas as categorias sugeridas.")).toBeInTheDocument();
    expect(db.categories).toHaveLength(3);
  });

  it("singular quando só falta uma sugerida", async () => {
    addCategory({ name: "Alimentação" });
    addCategory({ name: "Transporte" });
    const user = renderManager();
    await screen.findByRole("cell", { name: "Transporte" });

    await user.click(screen.getByRole("button", { name: "Adicionar categorias sugeridas" }));

    expect(await screen.findByText(/^1 categoria sugerida adicionada\./)).toBeInTheDocument();
  });
});
