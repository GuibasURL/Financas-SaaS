import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import TransactionTable from "./TransactionTable";
import type { Category, Transaction } from "../types/transaction";

const categories: Category[] = [
  { id: 1, name: "Alimentação", keywords: "ifood", ignore_in_reports: false },
  { id: 2, name: "Transporte", keywords: "uber", ignore_in_reports: false },
  { id: 3, name: "Pagamento de fatura", keywords: "fatura", ignore_in_reports: true },
];

const transaction: Transaction = {
  id: 10,
  date: "2025-03-01",
  description: "IFOOD",
  amount: -30,
  category_id: 1,
  statement_id: 1,
  created_at: "",
};

function renderTable(
  transactions: Transaction[] = [transaction],
  props: Partial<React.ComponentProps<typeof TransactionTable>> = {}
) {
  const onCategoryChange = vi.fn();
  render(
    <TransactionTable
      transactions={transactions}
      categories={categories}
      onCategoryChange={onCategoryChange}
      {...props}
    />
  );
  return onCategoryChange;
}

const rowOf = (text: string) => screen.getByText(text).closest("tr")!;
const dotOf = (text: string) => rowOf(text).querySelector("i")!;

describe("TransactionTable", () => {
  it("mostra a categoria atual, a data e o valor em reais", () => {
    renderTable();

    expect(screen.getByRole("combobox", { name: "Categoria de IFOOD" })).toHaveDisplayValue(
      "Alimentação"
    );
    expect(screen.getByText("− R$ 30,00")).toHaveClass("out");
    expect(screen.getByText("01/03/2025")).toBeInTheDocument();
  });

  it("entrada aparece com + e na cor de entrada", () => {
    renderTable([{ ...transaction, description: "SALARIO", amount: 4000, category_id: null }]);

    expect(screen.getByText("+ R$ 4.000,00")).toHaveClass("in");
  });

  it("escolher outra categoria avisa com o id dela", async () => {
    const onCategoryChange = renderTable();

    await userEvent.selectOptions(screen.getByRole("combobox"), "Transporte");

    expect(onCategoryChange).toHaveBeenCalledWith(10, 2);
  });

  it("escolher 'Sem categoria' avisa com null", async () => {
    const onCategoryChange = renderTable();

    await userEvent.selectOptions(screen.getByRole("combobox"), "Sem categoria");

    expect(onCategoryChange).toHaveBeenCalledWith(10, null);
  });

  it("linha sem categoria fica destacada e com a bolinha neutra", () => {
    renderTable([
      transaction,
      { ...transaction, id: 11, description: "DROGARIA", category_id: null },
    ]);

    expect(rowOf("DROGARIA").className).not.toBe("");
    expect(rowOf("IFOOD").className).toBe("");
    expect(dotOf("DROGARIA")).toHaveStyle({ background: "var(--muted)" });
  });

  it("bolinha usa a cor da categoria, ou a padrão sem categoryColor", () => {
    renderTable([transaction], { categoryColor: (id) => `var(--cat-${id})` });
    expect(dotOf("IFOOD")).toHaveStyle({ background: "var(--cat-1)" });
  });

  it("sem categoryColor, usa a cor padrão", () => {
    renderTable();
    expect(dotOf("IFOOD")).toHaveStyle({ background: "var(--cat-11)" });
  });

  it("categoria ignorada nos gráficos mostra 'fora dos totais'", () => {
    renderTable([
      transaction,
      { ...transaction, id: 12, description: "PAGAMENTO DE FATURA", category_id: 3 },
    ]);

    expect(within(rowOf("PAGAMENTO DE FATURA")).getByText("fora dos totais")).toBeInTheDocument();
    expect(within(rowOf("IFOOD")).queryByText("fora dos totais")).not.toBeInTheDocument();
  });
});
