import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FinanceDataProvider, useFinanceData } from "./FinanceData";
import { FeedbackProvider } from "../feedback/Feedback";
import { addCategory, addUser, loginAs } from "../test/fakeApi";

function Colors() {
  const { categoryColor, loaded } = useFinanceData();
  if (!loaded) return null;
  return (
    <ul>
      <li>{categoryColor("Transporte")}</li>
      <li>{categoryColor("Categoria que não existe")}</li>
    </ul>
  );
}

describe("FinanceData", () => {
  it("cor por nome e cor padrão para categoria desconhecida", async () => {
    loginAs(addUser());
    addCategory({ name: "Alimentação" });
    addCategory({ name: "Transporte" });

    render(
      <FeedbackProvider>
        <FinanceDataProvider>
          <Colors />
        </FinanceDataProvider>
      </FeedbackProvider>
    );

    expect(await screen.findByText("var(--cat-2)")).toBeInTheDocument();
    expect(screen.getByText("var(--cat-11)")).toBeInTheDocument();
  });

  it("usar fora do provider é erro de programação", () => {
    // O React loga o erro que o teste provoca de propósito; não polui a saída
    vi.spyOn(console, "error").mockImplementation(() => {});
    const Broken = () => {
      useFinanceData();
      return null;
    };
    expect(() => render(<Broken />)).toThrow("useFinanceData precisa estar dentro de <FinanceDataProvider>");
  });
});
