import { screen, within } from "@testing-library/react";
import { http } from "msw";
import { describe, expect, it } from "vitest";
import { addCategory, addStatement, API, server } from "../test/fakeApi";
import { renderLoggedIn } from "../test/renderApp";

// Selects de categoria das linhas (os filtros se chamam só "Categoria")
const rowSelects = () => screen.queryAllByRole("combobox", { name: /^Categoria de / });
const descriptions = () => rowSelects().map((s) => s.getAttribute("aria-label")!.slice(13));
const summary = () => screen.getByText(/transaç(ão|ões)( encontradas?)?$/).closest("p")!;

function seed() {
  const alimentacao = addCategory({ name: "Alimentação" });
  const fatura = addCategory({ name: "Pagamento de fatura", ignore_in_reports: true });
  addStatement("marco.csv", [
    { date: "2025-03-01", description: "IFOOD LANCHE", amount: -30, category_id: alimentacao.id },
    { date: "2025-03-10", description: "FARMÁCIA SÃO JOÃO", amount: -45.5 },
    { date: "2025-04-05", description: "SALARIO EMPRESA", amount: 4000 },
    { date: "2025-04-10", description: "PAGAMENTO DE FATURA", amount: -900, category_id: fatura.id },
  ]);
  return { alimentacao };
}

describe("Transações: filtros", () => {
  it("resumo do resultado deixa categorias ignoradas fora dos totais", async () => {
    seed();
    await renderLoggedIn("/transacoes");

    expect(await screen.findByText("4 transações · 2 sem categoria")).toBeInTheDocument();
    expect(summary()).toHaveTextContent(
      "4 transações·Entradas + R$ 4.000,00·Saídas − R$ 75,50·1 fora dos totais"
    );
  });

  it("busca sem acento, categoria, mês e tipo filtram a lista", async () => {
    seed();
    const user = await renderLoggedIn("/transacoes");
    await screen.findByText("4 transações · 2 sem categoria");

    await user.type(screen.getByLabelText("Buscar por descrição"), "farmacia");
    expect(descriptions()).toEqual(["FARMÁCIA SÃO JOÃO"]);
    expect(summary()).toHaveTextContent("1 transação encontrada");

    await user.clear(screen.getByLabelText("Buscar por descrição"));
    await user.selectOptions(screen.getByLabelText("Categoria"), "Alimentação");
    expect(descriptions()).toEqual(["IFOOD LANCHE"]);

    await user.selectOptions(screen.getByLabelText("Categoria"), "Todas");
    await user.selectOptions(screen.getByLabelText("Mês"), "abr/2025");
    expect(descriptions()).toEqual(["PAGAMENTO DE FATURA", "SALARIO EMPRESA"]);

    const kind = screen.getByRole("group", { name: "Tipo" });
    await user.click(within(kind).getByRole("button", { name: "Entradas" }));
    expect(within(kind).getByRole("button", { name: "Entradas" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(descriptions()).toEqual(["SALARIO EMPRESA"]);
  });

  it("Limpar filtros só aparece com filtro ativo e volta tudo", async () => {
    seed();
    const user = await renderLoggedIn("/transacoes");
    await screen.findByText("4 transações · 2 sem categoria");
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Saídas" }));
    expect(descriptions()).toHaveLength(3);
    await user.click(screen.getByRole("button", { name: "Limpar filtros" }));

    expect(descriptions()).toHaveLength(4);
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).not.toBeInTheDocument();
  });

  it("filtro sem resultado mostra aviso com Limpar filtros", async () => {
    seed();
    const user = await renderLoggedIn("/transacoes");
    await screen.findByText("4 transações · 2 sem categoria");

    await user.type(screen.getByLabelText("Buscar por descrição"), "nada disso");

    expect(screen.getByText("Nenhuma transação encontrada")).toBeInTheDocument();
    expect(rowSelects()).toHaveLength(0);
    // Um na barra de filtros e outro no aviso
    const clear = screen.getAllByRole("button", { name: "Limpar filtros" });
    await user.click(clear[clear.length - 1]);
    expect(descriptions()).toHaveLength(4);
  });

  it("botão Filtros (celular) abre a barra e mostra quantos filtros estão ativos", async () => {
    seed();
    const user = await renderLoggedIn("/transacoes");
    const toggle = await screen.findByRole("button", { name: "Filtros" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", "transaction-filters");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    await user.click(screen.getByRole("button", { name: "Saídas" }));
    await user.selectOptions(screen.getByLabelText("Mês"), "mar/2025");
    expect(screen.getByRole("button", { name: "Filtros (2)" })).toBeInTheDocument();
  });
});

describe("Transações: sem categoria", () => {
  it("Revisar mostra só as sem categoria e a faixa some", async () => {
    seed();
    const user = await renderLoggedIn("/transacoes");

    await user.click(await screen.findByRole("button", { name: "Revisar" }));

    expect(descriptions()).toEqual(["SALARIO EMPRESA", "FARMÁCIA SÃO JOÃO"]);
    expect(screen.getByLabelText("Categoria")).toHaveDisplayValue("Sem categoria");
    expect(screen.queryByRole("button", { name: "Revisar" })).not.toBeInTheDocument();
  });

  it("sem transações sem categoria, não mostra a faixa", async () => {
    const alimentacao = addCategory({ name: "Alimentação" });
    addStatement("marco.csv", [
      { date: "2025-03-01", description: "IFOOD", amount: -30, category_id: alimentacao.id },
    ]);
    await renderLoggedIn("/transacoes");

    await screen.findByText("1 transação · 0 sem categoria");
    expect(screen.queryByRole("button", { name: "Revisar" })).not.toBeInTheDocument();
  });

  it("categorizar com o filtro 'Sem categoria' tira a transação da lista", async () => {
    seed();
    const user = await renderLoggedIn("/transacoes");
    await user.click(await screen.findByRole("button", { name: "Revisar" }));

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Categoria de FARMÁCIA SÃO JOÃO" }),
      "Alimentação"
    );

    await screen.findByText("4 transações · 1 sem categoria");
    expect(descriptions()).toEqual(["SALARIO EMPRESA"]);
  });
});

describe("Transações: paginação", () => {
  function seedMany(count: number) {
    addCategory({ name: "Alimentação" });
    addStatement(
      "marco.csv",
      Array.from({ length: count }, (_, i) => ({
        date: `2025-03-${String(1 + (i % 28)).padStart(2, "0")}`,
        description: `COMPRA ${String(i + 1).padStart(2, "0")}`,
        amount: -10,
      }))
    );
  }

  it("25 por página; Próxima mostra o resto e filtrar volta para a primeira", async () => {
    seedMany(30);
    const user = await renderLoggedIn("/transacoes");
    await screen.findByText("30 transações · 30 sem categoria");

    expect(rowSelects()).toHaveLength(25);
    expect(screen.getByRole("navigation", { name: "Paginação" })).toHaveTextContent("1–25 de 30");

    await user.click(screen.getByRole("button", { name: "Próxima" }));
    expect(rowSelects()).toHaveLength(5);
    expect(screen.getByText("26–30 de 30")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Buscar por descrição"), "compra");
    expect(screen.getByText("1–25 de 30")).toBeInTheDocument();
  });

  it("se a última página esvazia, mostra a anterior", async () => {
    seedMany(26);
    const user = await renderLoggedIn("/transacoes");
    await user.click(await screen.findByRole("button", { name: "Revisar" }));
    await user.click(screen.getByRole("button", { name: "Próxima" }));
    const [last] = rowSelects();

    await user.selectOptions(last, "Alimentação");

    await screen.findByText("26 transações · 25 sem categoria");
    expect(rowSelects()).toHaveLength(25);
    expect(screen.queryByRole("navigation", { name: "Paginação" })).not.toBeInTheDocument();
  });
});

describe("Transações: estados", () => {
  it("sem transações convida a importar e leva para Extratos", async () => {
    const user = await renderLoggedIn("/transacoes");

    expect(await screen.findByText("Nenhuma transação ainda")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Filtros" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Importar extrato" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Extratos" })).toBeInTheDocument();
  });

  it("enquanto carrega, mostra o esqueleto", async () => {
    // A lista de transações nunca responde
    server.use(http.get(`${API}/transactions`, () => new Promise<never>(() => {})));
    await renderLoggedIn("/transacoes");

    expect(screen.getByRole("status", { name: "Carregando transações" })).toBeInTheDocument();
  });
});
