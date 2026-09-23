import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import TransactionTable from "./TransactionTable";
import type { Category, Transaction } from "../types/transaction";

const categories: Category[] = [
  { id: 1, name: "Alimentação", keywords: "ifood", ignore_in_reports: false },
  { id: 2, name: "Transporte", keywords: "uber", ignore_in_reports: false },
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

describe("TransactionTable", () => {
  it("mostra a categoria atual e o valor com duas casas", () => {
    render(<TransactionTable transactions={[transaction]} categories={categories} onCategoryChange={vi.fn()} />);

    expect(screen.getByRole("combobox")).toHaveDisplayValue("Alimentação");
    expect(screen.getByText("-30.00")).toBeInTheDocument();
  });

  it("escolher outra categoria avisa com o id dela", async () => {
    const onCategoryChange = vi.fn();
    render(<TransactionTable transactions={[transaction]} categories={categories} onCategoryChange={onCategoryChange} />);

    await userEvent.selectOptions(screen.getByRole("combobox"), "Transporte");

    expect(onCategoryChange).toHaveBeenCalledWith(10, 2);
  });

  it("escolher 'sem categoria' avisa com null", async () => {
    const onCategoryChange = vi.fn();
    render(<TransactionTable transactions={[transaction]} categories={categories} onCategoryChange={onCategoryChange} />);

    await userEvent.selectOptions(screen.getByRole("combobox"), "-- sem categoria --");

    expect(onCategoryChange).toHaveBeenCalledWith(10, null);
  });
});
