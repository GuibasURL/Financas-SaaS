import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useState } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import CategoryManager, { type CategoryStats } from "./CategoryManager";
import { FeedbackProvider } from "../feedback/Feedback";
import { getCategories } from "../services/api";
import { http, HttpResponse } from "msw";
import { addCategory, addStatement, addUser, API, db, loginAs, server } from "../test/fakeApi";
import type { Category } from "../types/transaction";

// Faz o papel da página: carrega as categorias da API e recarrega a cada mudança
function Harness({ stats }: { stats?: Map<number, CategoryStats> }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const load = () => getCategories().then(setCategories);
  useEffect(() => {
    load();
  }, []);
  return <CategoryManager categories={categories} onChanged={load} stats={stats} />;
}

function renderManager(stats?: Map<number, CategoryStats>) {
  const user = userEvent.setup();
  render(
    <FeedbackProvider>
      <Harness stats={stats} />
    </FeedbackProvider>
  );
  return user;
}

// Linha (item da lista) da categoria com esse nome
function categoryRow(name: string) {
  return screen.getByText(name, { selector: "span" }).closest("li")!;
}

async function findCategoryRow(name: string) {
  await screen.findByText(name, { selector: "span" });
  return categoryRow(name);
}

function newForm() {
  return screen.getByRole("region", { name: "Nova categoria" });
}

describe("CategoryManager", () => {
  beforeEach(() => {
    loginAs(addUser());
  });

  it("sem categorias, convida a criar uma", async () => {
    renderManager();

    expect(await screen.findByText("Nenhuma categoria ainda")).toBeInTheDocument();
    expect(screen.getByText("0 categorias")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aplicar regras" })).toBeDisabled();
  });

  it("cria categoria, limpa o formulário e avisa", async () => {
    const user = renderManager();

    await user.type(await within(newForm()).findByLabelText("Nome"), "Lazer");
    await user.type(within(newForm()).getByLabelText("Palavras-chave"), "cinema,netflix");
    await user.click(screen.getByRole("button", { name: "Criar categoria" }));

    const row = await findCategoryRow("Lazer");
    const keywords = within(row).getByRole("list", { name: "Palavras-chave de Lazer" });
    expect(within(keywords).getAllByRole("listitem").map((k) => k.textContent)).toEqual([
      "cinema",
      "netflix",
    ]);
    expect(within(newForm()).getByLabelText("Nome")).toHaveValue("");
    expect(screen.getByText("Categoria criada.")).toBeInTheDocument();
    expect(db.categories[0].ignore_in_reports).toBe(false);
  });

  it("cria categoria fora dos totais", async () => {
    const user = renderManager();

    await user.type(await within(newForm()).findByLabelText("Nome"), "Pagamento de fatura");
    await user.click(within(newForm()).getByLabelText("Deixar fora dos totais"));
    await user.click(screen.getByRole("button", { name: "Criar categoria" }));

    const row = await findCategoryRow("Pagamento de fatura");
    expect(within(row).getByText("fora dos totais")).toBeInTheDocument();
    expect(db.categories[0].ignore_in_reports).toBe(true);
    expect(within(newForm()).getByLabelText("Deixar fora dos totais")).not.toBeChecked();
  });

  it("cria categoria que vale só para entradas e mostra isso na linha", async () => {
    const user = renderManager();

    await user.type(await within(newForm()).findByLabelText("Nome"), "Transferências recebidas");
    await user.type(within(newForm()).getByLabelText("Palavras-chave"), "pix");
    const direction = within(newForm()).getByLabelText("Vale para");
    expect(direction).toHaveDisplayValue("Entradas e saídas");
    expect(direction).toHaveAccessibleDescription(/o sinal do valor/);
    await user.selectOptions(direction, "Só entradas");
    await user.click(screen.getByRole("button", { name: "Criar categoria" }));

    const row = await findCategoryRow("Transferências recebidas");
    expect(within(row).getByText("só entradas")).toBeInTheDocument();
    expect(db.categories[0].direction).toBe("in");
    expect(within(newForm()).getByLabelText("Vale para")).toHaveDisplayValue("Entradas e saídas");
  });

  it("categoria que vale para os dois sentidos não mostra etiqueta de sentido", async () => {
    addCategory({ name: "Lazer" });
    addCategory({ name: "Saques", direction: "out" });
    renderManager();

    const lazer = await findCategoryRow("Lazer");
    expect(within(lazer).queryByText(/^só /)).not.toBeInTheDocument();
    expect(within(categoryRow("Saques")).getByText("só saídas")).toBeInTheDocument();
  });

  it("edição mostra e salva o sentido", async () => {
    addCategory({ name: "Salário", keywords: "salario", direction: "in" });
    const user = renderManager();

    await user.click(
      within(await findCategoryRow("Salário")).getByRole("button", { name: "Editar Salário" })
    );
    const form = screen.getByRole("form", { name: "Editar Salário" });
    expect(within(form).getByLabelText("Vale para")).toHaveDisplayValue("Só entradas");
    await user.selectOptions(within(form).getByLabelText("Vale para"), "Entradas e saídas");
    await user.click(within(form).getByRole("button", { name: "Salvar" }));

    await screen.findByText("Categoria atualizada.");
    expect(db.categories[0].direction).toBe("all");
  });

  it("aplicar regras respeita o sentido da categoria", async () => {
    addCategory({ name: "Transferências recebidas", keywords: "pix", direction: "in" });
    addStatement("extrato.csv", [
      { date: "2025-03-01", description: "PIX TRANSF MARIA", amount: -80 },
      { date: "2025-03-02", description: "PIX TRANSF JOAO", amount: 150 },
    ]);
    const user = renderManager();
    await findCategoryRow("Transferências recebidas");

    await user.click(screen.getByRole("button", { name: "Aplicar regras" }));

    expect(await screen.findByRole("status")).toHaveTextContent("1 transação foi categorizada.");
    const byDescription = Object.fromEntries(db.transactions.map((t) => [t.description, t.category_id]));
    expect(byDescription).toEqual({ "PIX TRANSF MARIA": null, "PIX TRANSF JOAO": db.categories[0].id });
  });

  it("palavra-chave de exclusão aparece marcada e sem palavras mostra aviso", async () => {
    addCategory({ name: "Mercado", keywords: "mercado,-mercado pago" });
    addCategory({ name: "Outros", keywords: "" });
    renderManager();

    const exclusion = within(await findCategoryRow("Mercado")).getByText("-mercado pago");
    expect(exclusion).toHaveAttribute("title", 'Exclui descrições com "mercado pago"');
    expect(within(categoryRow("Mercado")).getByText("mercado")).not.toHaveAttribute("title");
    expect(within(categoryRow("Outros")).getByText("nenhuma palavra-chave")).toBeInTheDocument();
  });

  it("muitas palavras-chave: mostra as 6 primeiras e \"+N\" expande o resto", async () => {
    addCategory({ name: "Alimentação", keywords: "a1,a2,a3,a4,a5,a6,a7,a8" });
    const user = renderManager();
    const row = await findCategoryRow("Alimentação");
    const chips = () =>
      within(within(row).getByRole("list", { name: "Palavras-chave de Alimentação" })).getAllByRole(
        "listitem"
      );
    expect(chips()).toHaveLength(6);

    const more = within(row).getByRole("button", {
      name: "Mostrar mais 2 palavras-chave de Alimentação",
    });
    expect(more).toHaveTextContent("+2");
    expect(more).toHaveAttribute("aria-expanded", "false");
    await user.click(more);

    expect(chips()).toHaveLength(8);
    const less = within(row).getByRole("button", {
      name: "Mostrar menos palavras-chave de Alimentação",
    });
    expect(less).toHaveAttribute("aria-expanded", "true");
    await user.click(less);
    expect(chips()).toHaveLength(6);
  });

  it("mostra o erro da API ao criar nome repetido, dentro do formulário", async () => {
    addCategory({ name: "Lazer" });
    const user = renderManager();

    await user.type(await within(newForm()).findByLabelText("Nome"), "Lazer");
    await user.click(screen.getByRole("button", { name: "Criar categoria" }));

    expect(await within(newForm()).findByRole("alert")).toHaveTextContent("Categoria já existe");
    expect(within(newForm()).getByLabelText("Nome")).toHaveValue("Lazer");
  });

  it("edita nome, palavras-chave e a opção de ignorar", async () => {
    addCategory({ name: "Alimentação", keywords: "ifood" });
    const user = renderManager();

    await user.click(
      within(await findCategoryRow("Alimentação")).getByRole("button", { name: "Editar Alimentação" })
    );
    const form = screen.getByRole("form", { name: "Editar Alimentação" });
    const name = within(form).getByLabelText("Nome");
    await user.clear(name);
    await user.type(name, "Comida");
    await user.type(within(form).getByLabelText("Palavras-chave"), ", padaria");
    await user.click(within(form).getByLabelText("Deixar fora dos totais"));
    await user.click(within(form).getByRole("button", { name: "Salvar" }));

    expect(await findCategoryRow("Comida")).toBeInTheDocument();
    expect(screen.getByText("Categoria atualizada.")).toBeInTheDocument();
    expect(db.categories[0]).toMatchObject({
      name: "Comida",
      keywords: "ifood, padaria",
      ignore_in_reports: true,
    });
  });

  it("nas palavras-chave, Enter salva e quebra de linha colada vira vírgula", async () => {
    addCategory({ name: "Alimentação", keywords: "ifood" });
    const user = renderManager();

    await user.click(
      within(await findCategoryRow("Alimentação")).getByRole("button", { name: "Editar Alimentação" })
    );
    const keywords = within(screen.getByRole("form", { name: "Editar Alimentação" })).getByLabelText(
      "Palavras-chave"
    );
    fireEvent.change(keywords, { target: { value: "ifood\n padaria \nlanche" } });
    expect(keywords).toHaveValue("ifood, padaria, lanche");

    await user.type(keywords, "{Enter}");

    expect(await screen.findByText("Categoria atualizada.")).toBeInTheDocument();
    expect(db.categories[0].keywords).toBe("ifood, padaria, lanche");
  });

  it("cancelar a edição não salva nada", async () => {
    addCategory({ name: "Alimentação" });
    const user = renderManager();

    await user.click(
      within(await findCategoryRow("Alimentação")).getByRole("button", { name: "Editar Alimentação" })
    );
    const form = screen.getByRole("form", { name: "Editar Alimentação" });
    await user.type(within(form).getByLabelText("Nome"), " editada");
    await user.click(within(form).getByRole("button", { name: "Cancelar" }));

    expect(categoryRow("Alimentação")).toBeInTheDocument();
    expect(db.categories[0].name).toBe("Alimentação");
  });

  it("excluir pede confirmação na janela e avisa quando termina", async () => {
    addCategory({ name: "Lazer" });
    const user = renderManager();

    await user.click(
      within(await findCategoryRow("Lazer")).getByRole("button", { name: "Excluir Lazer" })
    );
    const dialog = screen.getByRole("dialog", { name: "Excluir categoria?" });
    expect(dialog).toHaveTextContent('A categoria "Lazer" será excluída.');
    expect(dialog).toHaveTextContent("nenhuma transação é apagada");

    await user.click(within(dialog).getByRole("button", { name: "Excluir categoria" }));

    expect(await screen.findByText("Nenhuma categoria ainda")).toBeInTheDocument();
    expect(screen.getByText("Categoria excluída.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("cancelar a confirmação de exclusão não apaga", async () => {
    addCategory({ name: "Lazer" });
    const user = renderManager();

    await user.click(
      within(await findCategoryRow("Lazer")).getByRole("button", { name: "Excluir Lazer" })
    );
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(db.categories).toHaveLength(1);
  });

  it("erro ao excluir fecha a janela e mostra aviso de erro", async () => {
    addCategory({ name: "Lazer" });
    server.use(http.delete(`${API}/categories/:id`, () => HttpResponse.error()));
    const user = renderManager();

    await user.click(
      within(await findCategoryRow("Lazer")).getByRole("button", { name: "Excluir Lazer" })
    );
    await user.click(screen.getByRole("button", { name: "Excluir categoria" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível excluir a categoria."
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(db.categories).toHaveLength(1);
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
    await findCategoryRow("Alimentação");

    await user.click(screen.getByRole("button", { name: "Aplicar regras" }));

    expect(await screen.findByRole("status")).toHaveTextContent(message);
  });

  it("erro ao aplicar regras aparece no topo", async () => {
    addCategory({ name: "Alimentação", keywords: "ifood" });
    server.use(http.post(`${API}/categories/apply-rules`, () => HttpResponse.error()));
    const user = renderManager();
    await findCategoryRow("Alimentação");

    await user.click(screen.getByRole("button", { name: "Aplicar regras" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível aplicar as regras.");
    expect(within(newForm()).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("adiciona as categorias sugeridas e avisa para aplicar as regras", async () => {
    const user = renderManager();
    await screen.findByText("Nenhuma categoria ainda");

    await user.click(screen.getByRole("button", { name: "Adicionar categorias sugeridas" }));

    expect(
      await screen.findByText(/3 categorias sugeridas adicionadas\. Use "Aplicar regras"/)
    ).toBeInTheDocument();
    expect(await findCategoryRow("Saúde")).toBeInTheDocument();
  });

  it("não duplica e avisa quando já tem todas as sugeridas", async () => {
    addCategory({ name: "Alimentação" });
    addCategory({ name: "Transporte" });
    addCategory({ name: "Saúde" });
    const user = renderManager();
    await findCategoryRow("Saúde");

    await user.click(screen.getByRole("button", { name: "Adicionar categorias sugeridas" }));

    expect(await screen.findByText("Você já tem todas as categorias sugeridas.")).toBeInTheDocument();
    expect(db.categories).toHaveLength(3);
  });

  it("singular quando só falta uma sugerida", async () => {
    addCategory({ name: "Alimentação" });
    addCategory({ name: "Transporte" });
    const user = renderManager();
    await findCategoryRow("Transporte");

    await user.click(screen.getByRole("button", { name: "Adicionar categorias sugeridas" }));

    expect(await screen.findByText(/^1 categoria sugerida adicionada\./)).toBeInTheDocument();
  });

  it("erro ao salvar a edição aparece na própria linha e mantém o formulário aberto", async () => {
    addCategory({ name: "Alimentação" });
    addCategory({ name: "Transporte" });
    const user = renderManager();

    await user.click(
      within(await findCategoryRow("Alimentação")).getByRole("button", { name: "Editar Alimentação" })
    );
    const form = screen.getByRole("form", { name: "Editar Alimentação" });
    await user.clear(within(form).getByLabelText("Nome"));
    await user.type(within(form).getByLabelText("Nome"), "Transporte");
    await user.click(within(form).getByRole("button", { name: "Salvar" }));

    expect(await within(form).findByRole("alert")).toHaveTextContent("Categoria já existe");
    expect(within(form).getByLabelText("Nome")).toHaveValue("Transporte");
  });

  it("com estatísticas, mostra quantidade e total de cada categoria", async () => {
    const alimentacao = addCategory({ name: "Alimentação" });
    const salario = addCategory({ name: "Salário" });
    addCategory({ name: "Lazer" });
    renderManager(
      new Map([
        [alimentacao.id, { count: 3, total: -120.5 }],
        [salario.id, { count: 1, total: 4000 }],
      ])
    );

    const food = await findCategoryRow("Alimentação");
    expect(within(food).getByText("3 transações")).toBeInTheDocument();
    expect(within(food).getByText("− R$ 120,50")).toBeInTheDocument();
    expect(within(categoryRow("Salário")).getByText("+ R$ 4.000,00")).toHaveClass("in");
    expect(within(categoryRow("Salário")).getByText("1 transação")).toBeInTheDocument();
    expect(within(categoryRow("Lazer")).getByText("0 transações")).toBeInTheDocument();
    expect(screen.getByText("3 categorias · 4 transações categorizadas")).toBeInTheDocument();
  });
});
