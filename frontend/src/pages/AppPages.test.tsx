import { screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addCategory, addStatement, API, db, server } from "../test/fakeApi";
import { renderLoggedIn } from "../test/renderApp";

function nav() {
  return screen.getByRole("complementary", { name: "Navegação principal" });
}

// Linha da tabela com esse texto (o nome do extrato também aparece na etiqueta de filtro)
function rowOf(text: string) {
  return screen.getAllByText(text).map((e) => e.closest("tr")).find(Boolean)!;
}

async function findRow(text: string) {
  await screen.findAllByText(text);
  return rowOf(text);
}

describe("navegação", () => {
  it("o menu marca a página atual e troca de página", async () => {
    const user = await renderLoggedIn();
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
    await user.click(within(await findRow("abril.csv")).getByRole("button", { name: "Filtrar" }));

    const chip = await screen.findByRole("status");
    expect(chip).toHaveTextContent("Filtrando por abril.csv");

    await user.click(within(nav()).getByRole("link", { name: "Transações" }));
    await screen.findByRole("heading", { level: 1, name: "Transações" });
    expect(await screen.findByText("MERCADO")).toBeInTheDocument();
    expect(screen.queryByText("IFOOD")).not.toBeInTheDocument();

    await user.click(within(screen.getByRole("status")).getByRole("button", { name: "Ver todos" }));
    expect(await screen.findByText("IFOOD")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("excluir pede confirmação e cancelar não apaga", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = await renderLoggedIn("/extratos");

    await user.click(within(await findRow("abril.csv")).getByRole("button", { name: "Excluir" }));

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('"abril.csv"'));
    expect(db.statements).toHaveLength(2);
  });

  it("confirmar exclui o extrato e ele some da lista", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = await renderLoggedIn("/extratos");

    await user.click(within(await findRow("abril.csv")).getByRole("button", { name: "Excluir" }));

    await vi.waitFor(() => expect(screen.queryByText("abril.csv")).not.toBeInTheDocument());
    expect(screen.getByText("marco.csv")).toBeInTheDocument();
  });

  it("excluir o extrato filtrado volta a mostrar todos", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = await renderLoggedIn("/extratos");
    await user.click(within(await findRow("abril.csv")).getByRole("button", { name: "Filtrar" }));
    await screen.findByRole("status");

    await user.click(within(rowOf("abril.csv")).getByRole("button", { name: "Excluir" }));

    await vi.waitFor(() => expect(screen.queryByText("abril.csv")).not.toBeInTheDocument());
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(db.statements.map((s) => s.filename)).toEqual(["marco.csv"]);
  });

  it("avisa quando não consegue excluir", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
    server.use(http.delete(`${API}/statements/:id`, () => HttpResponse.error()));
    const user = await renderLoggedIn("/extratos");

    await user.click(within(await findRow("abril.csv")).getByRole("button", { name: "Excluir" }));

    await vi.waitFor(() => expect(alert).toHaveBeenCalledWith("Não foi possível excluir o extrato."));
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
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
    server.use(http.patch(`${API}/transactions/:id`, () => HttpResponse.error()));
    const user = await renderLoggedIn("/transacoes");

    await user.selectOptions(await screen.findByRole("combobox", { name: "Categoria de IFOOD" }), "Alimentação");

    await vi.waitFor(() => expect(alert).toHaveBeenCalledWith("Não foi possível atualizar a categoria."));
  });
});

describe("Categorias", () => {
  it("mostra a cor de cada categoria, a mesma dos gráficos", async () => {
    addCategory({ name: "Alimentação" });
    addCategory({ name: "Transporte" });
    await renderLoggedIn("/categorias");

    const dot = (await screen.findByRole("cell", { name: "Transporte" })).querySelector("i");
    // Cor pela ordem de criação: Transporte é a 2ª
    expect(dot).toHaveStyle({ background: "var(--cat-2)" });
  });
});
