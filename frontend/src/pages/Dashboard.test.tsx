import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Dashboard from "./Dashboard";
import { addCategory, addStatement, addUser, API, db, loginAs, server } from "../test/fakeApi";

function renderDashboard() {
  const account = addUser("ana@teste.com");
  loginAs(account);
  const user = userEvent.setup();
  render(
    <Dashboard
      user={{ id: account.id, email: account.email, created_at: "" }}
      onLogout={vi.fn()}
    />
  );
  return user;
}

function section(title: string) {
  return screen.getByRole("heading", { name: title }).closest("section")!;
}

function transactionRows() {
  return within(section("Transações")).getAllByRole("row").slice(1); // sem o cabeçalho
}

describe("Dashboard", () => {
  beforeEach(() => {
    addStatement("marco.csv", [
      { date: "2025-03-01", description: "IFOOD", amount: -30 },
      { date: "2025-03-05", description: "UBER", amount: -20 },
    ]);
    addStatement("abril.csv", [{ date: "2025-04-02", description: "MERCADO", amount: -50 }]);
  });

  it("mostra extratos e transações", async () => {
    renderDashboard();

    expect(await screen.findByText("marco.csv")).toBeInTheDocument();
    expect(screen.getByText("abril.csv")).toBeInTheDocument();
    expect(transactionRows()).toHaveLength(3);
  });

  it("filtrar por extrato mostra só as transações dele e Ver todos volta", async () => {
    const user = renderDashboard();
    const marco = (await screen.findByText("marco.csv")).closest("tr")!;

    await user.click(within(marco).getByRole("button", { name: "Filtrar" }));
    await within(section("Transações")).findByText("UBER");
    expect(transactionRows()).toHaveLength(2);
    expect(within(section("Transações")).queryByText("MERCADO")).not.toBeInTheDocument();

    await user.click(within(marco).getByRole("button", { name: "Ver todos" }));
    expect(await within(section("Transações")).findByText("MERCADO")).toBeInTheDocument();
  });

  it("excluir extrato pede confirmação e cancelar não apaga", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = renderDashboard();
    const abril = (await screen.findByText("abril.csv")).closest("tr")!;

    await user.click(within(abril).getByRole("button", { name: "Excluir" }));

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('"abril.csv"'));
    expect(db.statements).toHaveLength(2);
    expect(screen.getByText("abril.csv")).toBeInTheDocument();
  });

  it("confirmar exclui o extrato e as transações dele somem da tela", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = renderDashboard();
    const abril = (await screen.findByText("abril.csv")).closest("tr")!;

    await user.click(within(abril).getByRole("button", { name: "Excluir" }));

    await screen.findByText("marco.csv");
    expect(screen.queryByText("abril.csv")).not.toBeInTheDocument();
    expect(transactionRows()).toHaveLength(2);
  });

  it("trocar a categoria de uma transação salva na API", async () => {
    const alimentacao = addCategory({ name: "Alimentação" });
    const user = renderDashboard();
    const ifood = (await within(section("Transações")).findByText("IFOOD")).closest("tr")!;

    await user.selectOptions(within(ifood).getByRole("combobox"), "Alimentação");

    await vi.waitFor(() =>
      expect(db.transactions.find((t) => t.description === "IFOOD")?.category_id).toBe(alimentacao.id)
    );
  });

  it("avisa quando não consegue carregar os dados", async () => {
    server.use(http.get(`${API}/statements`, () => HttpResponse.error()));

    renderDashboard();

    expect(
      await screen.findByText("Não foi possível carregar os dados. Verifique se a API está rodando.")
    ).toBeInTheDocument();
  });

  it("excluir o extrato que está filtrado volta a mostrar todos", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = renderDashboard();
    const abril = (await screen.findByText("abril.csv")).closest("tr")!;
    await user.click(within(abril).getByRole("button", { name: "Filtrar" }));
    await within(section("Transações")).findByText("MERCADO");
    expect(transactionRows()).toHaveLength(1);

    await user.click(within(abril).getByRole("button", { name: "Excluir" }));

    await vi.waitFor(() => expect(transactionRows()).toHaveLength(2)); // as 2 de março
    expect(screen.queryByText("abril.csv")).not.toBeInTheDocument();
  });

  it("avisa quando não consegue excluir o extrato", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
    server.use(http.delete(`${API}/statements/:id`, () => HttpResponse.error()));
    const user = renderDashboard();
    const abril = (await screen.findByText("abril.csv")).closest("tr")!;

    await user.click(within(abril).getByRole("button", { name: "Excluir" }));

    await vi.waitFor(() => expect(alert).toHaveBeenCalledWith("Não foi possível excluir o extrato."));
    expect(screen.getByText("abril.csv")).toBeInTheDocument();
  });

  it("avisa quando não consegue trocar a categoria", async () => {
    addCategory({ name: "Alimentação" });
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
    server.use(http.patch(`${API}/transactions/:id`, () => HttpResponse.error()));
    const user = renderDashboard();
    const ifood = (await within(section("Transações")).findByText("IFOOD")).closest("tr")!;

    await user.selectOptions(within(ifood).getByRole("combobox"), "Alimentação");

    await vi.waitFor(() =>
      expect(alert).toHaveBeenCalledWith("Não foi possível atualizar a categoria.")
    );
  });
});
