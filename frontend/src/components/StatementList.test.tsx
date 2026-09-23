import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import StatementList from "./StatementList";
import type { Statement } from "../types/transaction";

const statement: Statement = {
  id: 7,
  filename: "marco.csv",
  // O backend (SQLite) manda o horário em UTC sem indicar o fuso
  uploaded_at: "2026-09-23T13:30:00",
  transaction_count: 12,
  start_date: "2025-03-01",
  end_date: "2025-04-15",
};

function renderList(props: Partial<React.ComponentProps<typeof StatementList>> = {}) {
  const handlers = { onSelect: vi.fn(), onDelete: vi.fn() };
  render(<StatementList statements={[statement]} selectedId={null} {...handlers} {...props} />);
  return handlers;
}

describe("StatementList", () => {
  it("sem extratos mostra aviso", () => {
    render(<StatementList statements={[]} selectedId={null} onSelect={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByText("Nenhum extrato importado ainda.")).toBeInTheDocument();
  });

  it("formata período em dd/mm/aaaa e o horário de UTC para o fuso local", () => {
    renderList();

    expect(screen.getByText("01/03/2025 a 15/04/2025")).toBeInTheDocument();
    // 13:30 UTC = 10:30 em São Paulo (fuso fixado na config de testes)
    expect(screen.getByText("23/09/2026, 10:30")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("extrato vazio mostra traço no período", () => {
    render(
      <StatementList
        statements={[{ ...statement, start_date: null, end_date: null }]}
        selectedId={null}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText("-")).toBeInTheDocument();
  });

  it("Filtrar seleciona o extrato", async () => {
    const { onSelect } = renderList();

    await userEvent.click(screen.getByRole("button", { name: "Filtrar" }));

    expect(onSelect).toHaveBeenCalledWith(7);
  });

  it("no extrato selecionado o botão vira Ver todos e limpa o filtro", async () => {
    const { onSelect } = renderList({ selectedId: 7 });

    await userEvent.click(screen.getByRole("button", { name: "Ver todos" }));

    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("Excluir repassa o extrato", async () => {
    const { onDelete } = renderList();

    await userEvent.click(screen.getByRole("button", { name: "Excluir" }));

    expect(onDelete).toHaveBeenCalledWith(statement);
  });
});
