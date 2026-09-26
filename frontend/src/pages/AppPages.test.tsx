import { screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addCategory, addStatement, API, db, server } from "../test/fakeApi";
import { renderLoggedIn } from "../test/renderApp";

function nav() {
  return screen.getByRole("complementary", { name: "Navegação principal" });
}

// Linha (da tabela ou da lista) com esse texto (o nome do extrato também aparece na etiqueta de filtro)
function rowOf(text: string) {
  return screen.getAllByText(text).map((e) => e.closest("tr, li")).find(Boolean)! as HTMLElement;
}

async function findRow(text: string) {
  await screen.findAllByText(text);
  return rowOf(text);
}

describe("navegação", () => {
  it("o menu marca a página atual e troca de página", async () => {
    const user = await renderLoggedIn();
    expect(within(nav()).getByText("Vexira")).toBeInTheDocument();
    expect(within(nav()).getByRole("link", { name: "Visão geral" })).toHaveAttribute("aria-current", "page");

    await user.click(within(nav()).getByRole("link", { name: "Categorias" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Categorias" })).toBeInTheDocument();
    expect(within(nav()).getByRole("link", { name: "Categorias" })).toHaveAttribute("aria-current", "page");
    expect(within(nav()).getByRole("link", { name: "Visão geral" })).not.toHaveAttribute("aria-current");
  });

  it("abrir direto numa página funciona (F5 numa rota)", async () => {
    await renderLoggedIn("/extratos");

    expect(await screen.findByRole("heading", { level: 1, name: "Extratos" })).toBeInTheDocument();
  });

  it("rota desconhecida volta para a Visão geral", async () => {
    await renderLoggedIn("/nao-existe");

    expect(await screen.findByRole("heading", { level: 1, name: "Visão geral" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
  });

  it("Sair no celular também desloga", async () => {
    const user = await renderLoggedIn();

    await user.click(screen.getByRole("button", { name: "Sair (ana@teste.com)" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Sair" }));

    expect(await screen.findByRole("heading", { name: "Bem-vindo de volta" })).toBeInTheDocument();
  });
});

describe("Extratos", () => {
  beforeEach(() => {
    addStatement("marco.csv", [
      { date: "2025-03-01", description: "IFOOD", amount: -30 },
      { date: "2025-03-05", description: "UBER", amount: -20 },
    ]);
    addStatement("abril.csv", [{ date: "2025-04-02", description: "MERCADO", amount: -50 }]);
  });

  it("filtrar um extrato vale para as outras páginas até clicar em Ver todos", async () => {
    const user = await renderLoggedIn("/extratos");
    expect(await screen.findByText("2 arquivos · 3 transações")).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Filtrar por abril.csv" }));

    const chip = await screen.findByRole("status");
    expect(chip).toHaveTextContent("Filtrando por abril.csv");
    expect(screen.getByRole("button", { name: "Filtrar por abril.csv" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    await user.click(within(nav()).getByRole("link", { name: "Transações" }));
    await screen.findByRole("heading", { level: 1, name: "Transações" });
    expect(await screen.findByText("MERCADO")).toBeInTheDocument();
    expect(screen.queryByText("IFOOD")).not.toBeInTheDocument();

    await user.click(within(screen.getByRole("status")).getByRole("button", { name: "Ver todos" }));
    expect(await screen.findByText("IFOOD")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("excluir pede confirmação na janela e cancelar não apaga", async () => {
    const user = await renderLoggedIn("/extratos");

    await user.click(await screen.findByRole("button", { name: "Excluir abril.csv" }));

    const dialog = screen.getByRole("dialog", { name: "Excluir extrato?" });
    expect(dialog).toHaveTextContent(
      'O extrato "abril.csv" e a transação dele serão apagados. Isso não pode ser desfeito.'
    );
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(db.statements).toHaveLength(2);
  });

  it("confirmar exclui o extrato, ele some da lista e aparece o aviso", async () => {
    const user = await renderLoggedIn("/extratos");

    await user.click(await screen.findByRole("button", { name: "Excluir marco.csv" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("e as 2 transações dele serão apagados");
    await user.click(screen.getByRole("button", { name: "Excluir extrato" }));

    await vi.waitFor(() => expect(screen.queryByText("marco.csv")).not.toBeInTheDocument());
    expect(screen.getByText("abril.csv")).toBeInTheDocument();
    expect(screen.getByText("Extrato excluído.")).toBeInTheDocument();
  });

  it("excluir o extrato filtrado volta a mostrar todos", async () => {
    const user = await renderLoggedIn("/extratos");
    await user.click(await screen.findByRole("button", { name: "Filtrar por abril.csv" }));
    await screen.findByRole("status");

    await user.click(screen.getByRole("button", { name: "Excluir abril.csv" }));
    await user.click(screen.getByRole("button", { name: "Excluir extrato" }));

    await vi.waitFor(() => expect(screen.queryByText("abril.csv")).not.toBeInTheDocument());
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(db.statements.map((s) => s.filename)).toEqual(["marco.csv"]);
  });

  it("avisa quando não consegue excluir", async () => {
    server.use(http.delete(`${API}/statements/:id`, () => HttpResponse.error()));
    const user = await renderLoggedIn("/extratos");

    await user.click(await screen.findByRole("button", { name: "Excluir abril.csv" }));
    await user.click(screen.getByRole("button", { name: "Excluir extrato" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível excluir o extrato.");
    expect(db.statements).toHaveLength(2);
  });
});

describe("Extratos vazio", () => {
  it("o botão do estado vazio abre a escolha de arquivo", async () => {
    const pick = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
    const user = await renderLoggedIn("/extratos");

    await user.click(await screen.findByRole("button", { name: "Importar primeiro extrato" }));

    expect(pick).toHaveBeenCalledOnce();
    expect(pick.mock.contexts[0]).toBe(screen.getByLabelText("Arquivo do extrato (CSV ou OFX)"));
  });
});

describe("Transações", () => {
  it("lista com contagem e troca de categoria salva na API", async () => {
    const alimentacao = addCategory({ name: "Alimentação" });
    addStatement("marco.csv", [
      { date: "2025-03-01", description: "IFOOD", amount: -30 },
      { date: "2025-03-05", description: "SALARIO", amount: 4000 },
    ]);
    const user = await renderLoggedIn("/transacoes");

    expect(await screen.findByText("2 transações · 2 sem categoria")).toBeInTheDocument();
    expect(within(rowOf("SALARIO")).getByText("+ R$ 4.000,00")).toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox", { name: "Categoria de IFOOD" }), "Alimentação");

    await vi.waitFor(() =>
      expect(db.transactions.find((t) => t.description === "IFOOD")?.category_id).toBe(alimentacao.id)
    );
  });

  it("avisa quando não consegue trocar a categoria", async () => {
    addCategory({ name: "Alimentação" });
    addStatement("marco.csv", [{ date: "2025-03-01", description: "IFOOD", amount: -30 }]);
    server.use(http.patch(`${API}/transactions/:id`, () => HttpResponse.error()));
    const user = await renderLoggedIn("/transacoes");

    await user.selectOptions(await screen.findByRole("combobox", { name: "Categoria de IFOOD" }), "Alimentação");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível atualizar a categoria."
    );
  });
});

describe("Categorias", () => {
  it("mostra a cor de cada categoria, a mesma dos gráficos", async () => {
    addCategory({ name: "Alimentação" });
    addCategory({ name: "Transporte" });
    await renderLoggedIn("/categorias");

    const name = await screen.findByText("Transporte", { selector: "span" });
    // Cor pela ordem de criação: Transporte é a 2ª
    expect(name.closest("li")!.querySelector("i")).toHaveStyle({ background: "var(--cat-2)" });
  });

  it("conta as transações e soma os valores de cada categoria", async () => {
    const alimentacao = addCategory({ name: "Alimentação" });
    addCategory({ name: "Lazer" });
    addStatement("marco.csv", [
      { date: "2025-03-01", description: "IFOOD", amount: -30.1, category_id: alimentacao.id },
      { date: "2025-03-02", description: "IFOOD", amount: -20.2, category_id: alimentacao.id },
      { date: "2025-03-03", description: "UBER", amount: -15 },
    ]);
    await renderLoggedIn("/categorias");

    const food = (await screen.findByText("Alimentação", { selector: "span" })).closest("li")!;
    expect(within(food).getByText("2 transações")).toBeInTheDocument();
    expect(within(food).getByText("− R$ 50,30")).toBeInTheDocument();
    expect(screen.getByText("2 categorias · 2 transações categorizadas")).toBeInTheDocument();
  });
});

describe("Carregando", () => {
  // A lista de transações nunca responde: a tela fica no estado de carregando
  const hang = () => server.use(http.get(`${API}/transactions`, () => new Promise<never>(() => {})));

  it("Visão geral: esqueleto no lugar de 'nenhum extrato' e R$ 0,00", async () => {
    addStatement("marco.csv", [{ date: "2025-03-01", description: "SALARIO", amount: 4000 }]);
    hang();
    await renderLoggedIn();

    // No topo da página e embaixo de cada card de resumo
    expect(screen.getAllByText("Carregando…")).toHaveLength(4);
    expect(screen.queryByText("Nenhum extrato importado ainda")).not.toBeInTheDocument();
    expect(screen.queryByText("R$ 0,00")).not.toBeInTheDocument();
    for (const name of ["gastos por categoria", "evolução mensal", "últimas transações"]) {
      expect(screen.getByRole("status", { name: `Carregando ${name}` })).toBeInTheDocument();
    }
    expect(screen.getByRole("region", { name: "Entradas" })).toHaveAttribute("aria-busy", "true");
  });

  it.each([
    ["/categorias", "Carregando categorias"],
    ["/extratos", "Carregando extratos"],
  ])("%s: esqueleto em vez da lista vazia", async (path, label) => {
    hang();
    await renderLoggedIn(path);

    expect(screen.getByRole("status", { name: label })).toBeInTheDocument();
  });

  it("Transações: o topo não diz '0 transações'", async () => {
    hang();
    await renderLoggedIn("/transacoes");

    expect(screen.getByText("Carregando…")).toBeInTheDocument();
    expect(screen.queryByText(/0 transações/)).not.toBeInTheDocument();
  });
});

describe("Navegação", () => {
  it.each([
    ["/", "Visão geral · Vexira"],
    ["/transacoes", "Transações · Vexira"],
    ["/categorias", "Categorias · Vexira"],
    ["/extratos", "Extratos · Vexira"],
    ["/perfil", "Perfil · Vexira"],
  ])("título da aba em %s", async (path, title) => {
    await renderLoggedIn(path);

    expect(document.title).toBe(title);
  });

  it("'Pular para o conteúdo' leva ao conteúdo da página", async () => {
    const user = await renderLoggedIn();

    await user.tab();
    const skip = screen.getByRole("link", { name: "Pular para o conteúdo" });
    expect(skip).toHaveFocus();
    expect(skip).toHaveAttribute("href", "#conteudo");
    expect(document.getElementById("conteudo")).toContainElement(
      screen.getByRole("heading", { level: 1, name: "Visão geral" })
    );
  });
});
