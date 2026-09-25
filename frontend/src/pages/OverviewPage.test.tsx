import { screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { addCategory, addStatement, API, server } from "../test/fakeApi";
import { renderLoggedIn } from "../test/renderApp";

function card(title: string) {
  return screen.getByRole("heading", { name: title }).closest("section")!;
}

function kpi(label: string) {
  return screen.getByRole("region", { name: label });
}

describe("Visão geral", () => {
  it("sem dados mostra os estados vazios", async () => {
    await renderLoggedIn();

    expect(await screen.findByText("Nenhum extrato importado ainda")).toBeInTheDocument();
    expect(within(kpi("Entradas")).getByText("R$ 0,00")).toBeInTheDocument();
    expect(within(card("Gastos por categoria")).getByText("Nenhum gasto categorizado no período.")).toBeInTheDocument();
    expect(within(card("Evolução mensal")).getByText("Nenhum gasto no período.")).toBeInTheDocument();
    expect(
      within(card("Últimas transações")).getByText("Nenhuma transação ainda. Importe um extrato para começar.")
    ).toBeInTheDocument();
  });

  it("resumo, período e últimas transações", async () => {
    const alimentacao = addCategory({ name: "Alimentação" });
    addStatement("marco.csv", [
      { date: "2025-03-01", description: "SALARIO", amount: 4000 },
      { date: "2025-03-05", description: "IFOOD", amount: -30, category_id: alimentacao.id },
      { date: "2025-03-12", description: "MERCADO", amount: -50 },
    ]);

    await renderLoggedIn();

    expect(await screen.findByText("01/03/2025 a 12/03/2025")).toBeInTheDocument();
    expect(within(kpi("Entradas")).getByText("+ R$ 4.000,00")).toBeInTheDocument();
    expect(within(kpi("Entradas")).getByText("1 transação")).toBeInTheDocument();
    expect(within(kpi("Saídas")).getByText("− R$ 80,00")).toBeInTheDocument();
    expect(within(kpi("Saídas")).getByText("2 transações")).toBeInTheDocument();
    expect(within(kpi("Saldo do período")).getByText("R$ 3.920,00")).toBeInTheDocument();

    const recent = within(card("Últimas transações"));
    const rows = recent.getAllByRole("row").slice(1);
    expect(rows.map((r) => within(r).getAllByRole("cell")[1].textContent)).toEqual([
      "MERCADO",
      "IFOOD",
      "SALARIO",
    ]);
    expect(recent.getByText("Alimentação")).toBeInTheDocument();
    expect(recent.getAllByText("— sem categoria —")).toHaveLength(2);
  });

  it("categorias ignoradas ficam fora do resumo", async () => {
    const fatura = addCategory({ name: "Pagamento de fatura", ignore_in_reports: true });
    addStatement("conta.csv", [
      { date: "2025-03-01", description: "MERCADO", amount: -50 },
      { date: "2025-03-10", description: "PAGAMENTO DE FATURA", amount: -80, category_id: fatura.id },
    ]);

    await renderLoggedIn();

    expect(await within(kpi("Saídas")).findByText("− R$ 50,00")).toBeInTheDocument();
    expect(within(kpi("Saldo do período")).getByText("1 transação fora dos totais")).toBeInTheDocument();
  });

  it("saldo negativo aparece com sinal", async () => {
    addStatement("conta.csv", [{ date: "2025-03-01", description: "ALUGUEL", amount: -1500 }]);

    await renderLoggedIn();

    expect(await within(kpi("Saldo do período")).findByText("−R$ 1.500,00")).toBeInTheDocument();
  });

  it("gráfico de categorias junta da 6ª em diante em Outras", async () => {
    const names = ["A", "B", "C", "D", "E", "F", "G"];
    const categories = names.map((name) => addCategory({ name }));
    addStatement(
      "x.csv",
      categories.map((c, i) => ({
        date: "2025-03-01",
        description: c.name,
        amount: -(70 - i * 10), // A é o maior gasto
        category_id: c.id,
      }))
    );

    await renderLoggedIn();

    const legend = await screen.findByRole("list", { name: "Gastos por categoria" });
    const items = within(legend).getAllByRole("listitem").map((li) => li.textContent);
    expect(items).toHaveLength(6);
    expect(items[0]).toBe("AR$ 70,0025%");
    expect(items[5]).toBe("Outras (2)R$ 30,0011%"); // F (20) + G (10)
    expect(within(card("Gastos por categoria")).getByText("R$ 280,00")).toBeInTheDocument();
  });

  it("Ver todas leva para a página de transações", async () => {
    const user = await renderLoggedIn();

    await user.click(screen.getByRole("link", { name: /Ver todas/ }));

    expect(await screen.findByRole("heading", { level: 1, name: "Transações" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/transacoes");
  });

  it("erro ao carregar mostra aviso e Tentar de novo recupera", async () => {
    server.use(http.get(`${API}/statements`, () => HttpResponse.error(), { once: true }));
    addStatement("marco.csv", [{ date: "2025-03-01", description: "IFOOD", amount: -30 }]);

    const user = await renderLoggedIn();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Não foi possível carregar os dados.");

    await user.click(within(alert).getByRole("button", { name: "Tentar de novo" }));

    await vi.waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.getByText("01/03/2025 a 01/03/2025")).toBeInTheDocument();
  });

  it("saídas sem categoria viram uma fatia, e o total da rosca bate com o card de Saídas", async () => {
    const alimentacao = addCategory({ name: "Alimentação" });
    addStatement("marco.csv", [
      { date: "2025-03-05", description: "IFOOD", amount: -30, category_id: alimentacao.id },
      { date: "2025-03-06", description: "PIX JOAO", amount: -70 },
    ]);

    await renderLoggedIn();

    const legend = await screen.findByRole("list", { name: "Gastos por categoria" });
    expect(within(legend).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Sem categoriaR$ 70,0070%",
      "AlimentaçãoR$ 30,0030%",
    ]);
    expect(within(card("Gastos por categoria")).getByText("R$ 100,00")).toBeInTheDocument();
    expect(within(kpi("Saídas")).getByText("− R$ 100,00")).toBeInTheDocument();
  });
});
