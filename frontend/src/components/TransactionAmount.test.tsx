import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TransactionAmount from "./TransactionAmount";

describe("TransactionAmount", () => {
  it.each([
    [4000, "+ R$ 4.000,00", "in"],
    [-30, "− R$ 30,00", "out"],
  ])("%d: verde se entrou, vermelho se saiu", (amount, text, className) => {
    render(<TransactionAmount amount={amount} />);

    expect(screen.getByText(text)).toHaveClass("amount", className);
    expect(screen.queryByText("não soma")).not.toBeInTheDocument();
  });

  it.each([385.58, -385.58])("%d fora dos totais: sem cor de entrada ou saída", (amount) => {
    render(<TransactionAmount amount={amount} ignored />);

    const value = screen.getByText("não soma").parentElement!;
    expect(value).not.toHaveClass("in");
    expect(value).not.toHaveClass("out");
    expect(value).toHaveAttribute("title", expect.stringContaining("só muda de lugar"));
  });
});
