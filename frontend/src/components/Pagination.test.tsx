import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Pagination from "./Pagination";

describe("Pagination", () => {
  it("some quando tudo cabe numa página", () => {
    const { container } = render(<Pagination page={1} pageSize={25} total={25} onChange={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("primeira página: Anterior desabilitado", async () => {
    const onChange = vi.fn();
    render(<Pagination page={1} pageSize={25} total={60} onChange={onChange} />);

    expect(screen.getByRole("navigation", { name: "Paginação" })).toHaveTextContent("1–25 de 60");
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Próxima" }));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("última página: mostra até o total e Próxima desabilitado", async () => {
    const onChange = vi.fn();
    render(<Pagination page={3} pageSize={25} total={60} onChange={onChange} />);

    expect(screen.getByText("51–60 de 60")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Próxima" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Anterior" }));
    expect(onChange).toHaveBeenCalledWith(2);
  });
});
