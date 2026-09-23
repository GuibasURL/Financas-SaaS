import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Logo, { LogoMark } from "./Logo";

describe("Logo", () => {
  it("mostra o nome; a marca é decorativa para o leitor de tela", () => {
    const { container } = render(<Logo className="brand" />);

    expect(screen.getByText("Vexira")).toBeInTheDocument();
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("cada marca usa o próprio degradê (o menu e a barra do celular mostram duas)", () => {
    const { container } = render(
      <>
        <LogoMark />
        <LogoMark />
      </>
    );

    const ids = [...container.querySelectorAll("linearGradient")].map((g) => g.id);
    expect(new Set(ids).size).toBe(2);
    ids.forEach((id) => expect(id).not.toMatch(/:/));
    const strokes = [...container.querySelectorAll("g[stroke]")].map((g) => g.getAttribute("stroke"));
    expect(strokes).toEqual(ids.map((id) => `url(#${id})`));
  });
});
