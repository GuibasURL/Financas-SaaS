import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "../App";
import { addUser } from "../test/fakeApi";

// Alguns navegadores (modo privado restrito, storage bloqueado por política)
// lançam erro em qualquer acesso ao localStorage
function blockLocalStorage() {
  const blocked = () => {
    throw new DOMException("Acesso ao storage bloqueado", "SecurityError");
  };
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(blocked);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(blocked);
  vi.spyOn(Storage.prototype, "removeItem").mockImplementation(blocked);
}

describe("localStorage bloqueado", () => {
  it("login funciona (só não sobrevive a um F5) e Sair desloga", async () => {
    addUser("ana@teste.com", "senha-forte-123");
    blockLocalStorage();
    const user = userEvent.setup();
    render(<App />);

    await user.type(await screen.findByLabelText("E-mail"), "ana@teste.com");
    await user.type(screen.getByLabelText("Senha"), "senha-forte-123");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("ana@teste.com")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sair" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Sair" }));
    expect(await screen.findByRole("heading", { name: "Bem-vindo de volta" })).toBeInTheDocument();
  });
});
