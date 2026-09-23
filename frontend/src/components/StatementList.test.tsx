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
  it("sem extratos mostra aviso, sem botão se não houver onde importar", () => {
    render(<StatementList statements={[]} selectedId={null} onSelect={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByText("Nenhum extrato ainda")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("no estado vazio, o botão chama onImport", async () => {
    const onImport = vi.fn();
    render(
      <StatementList
        statements={[]}
        selectedId={null}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
        onImport={onImport}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Importar primeiro extrato" }));

    expect(onImport).toHaveBeenCalledOnce();
  });

  it("formata período em dd/mm/aaaa e o horário de UTC para o fuso local", () => {
    renderList();

    expect(screen.getByText("01/03/2025 a 15/04/2025")).toBeInTheDocument();
    // 13:30 UTC = 10:30 em São Paulo (fuso fixado na config de testes)
    expect(screen.getByText("importado em 23/09/2026 às 10:30")).toBeInTheDocument();
    expect(screen.getByText("12 transações")).toBeInTheDocument();
  });

  it("extrato sem transações mostra que não tem período", () => {
    render(
      <StatementList
        statements={[{ ...statement, start_date: null, end_date: null, transaction_count: 1 }]}
        selectedId={null}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText("Sem período")).toBeInTheDocument();
    expect(screen.getByText("1 transação")).toBeInTheDocument();
  });

  it("Filtrar seleciona o extrato", async () => {
    const { onSelect } = renderList();

    const filter = screen.getByRole("button", { name: "Filtrar por marco.csv" });
    expect(filter).toHaveTextContent("Filtrar");
    expect(filter).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(filter);

    expect(onSelect).toHaveBeenCalledWith(7);
  });

  it("no extrato selecionado o botão fica pressionado e clicar de novo limpa o filtro", async () => {
    const { onSelect } = renderList({ selectedId: 7 });

    const filter = screen.getByRole("button", { name: "Filtrar por marco.csv" });
    expect(filter).toHaveTextContent("Filtrando");
    expect(filter).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(filter);

    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("Excluir repassa o extrato", async () => {
    const { onDelete } = renderList();

    await userEvent.click(screen.getByRole("button", { name: "Excluir marco.csv" }));

    expect(onDelete).toHaveBeenCalledWith(statement);
  });

  it("horário que já vem com fuso (Postgres) não é convertido duas vezes", () => {
    render(
      <StatementList
        statements={[{ ...statement, uploaded_at: "2026-09-23T13:30:00+00:00" }]}
        selectedId={null}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText("importado em 23/09/2026 às 10:30")).toBeInTheDocument();
  });
});
