import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { FeedbackProvider, TOAST_DURATION_MS, useFeedback, type ConfirmOptions } from "./Feedback";

const OPTIONS: Omit<ConfirmOptions, "action"> = {
  title: "Excluir extrato?",
  message: 'O extrato "marco.csv" e as 42 transações dele serão apagados.',
  confirmLabel: "Excluir extrato",
};

// Botão que abre a janela e mostra o resultado do confirm()
function ConfirmTrigger({ action }: { action: () => Promise<unknown> }) {
  const { confirm } = useFeedback();
  const [result, setResult] = useState("");
  return (
    <>
      <button
        onClick={() =>
          confirm({ ...OPTIONS, action }).then(
            (done) => setResult(done ? "confirmado" : "cancelado"),
            (err: Error) => setResult(`erro: ${err.message}`)
          )
        }
      >
        Abrir
      </button>
      <output>{result}</output>
    </>
  );
}

function renderConfirm(action: () => Promise<unknown> = () => Promise.resolve()) {
  const user = userEvent.setup();
  render(
    <FeedbackProvider>
      <ConfirmTrigger action={action} />
    </FeedbackProvider>
  );
  return user;
}

function ToastTrigger() {
  const { toast } = useFeedback();
  return (
    <>
      <button onClick={() => toast.success("Extrato excluído.")}>Sucesso</button>
      <button onClick={() => toast.error("Não foi possível excluir o extrato.")}>Erro</button>
    </>
  );
}

describe("janela de confirmação", () => {
  it("abre com o foco em Cancelar e mostra título e texto", async () => {
    const user = renderConfirm();

    await user.click(screen.getByRole("button", { name: "Abrir" }));

    const dialog = screen.getByRole("dialog", { name: "Excluir extrato?" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription(OPTIONS.message);
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();
  });

  it("confirmar roda a ação, fecha e devolve o foco para quem abriu", async () => {
    const action = vi.fn().mockResolvedValue(undefined);
    const user = renderConfirm(action);

    await user.click(screen.getByRole("button", { name: "Abrir" }));
    await user.click(screen.getByRole("button", { name: "Excluir extrato" }));

    expect(await screen.findByText("confirmado")).toBeInTheDocument();
    expect(action).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir" })).toHaveFocus();
  });

  it.each([
    ["Cancelar", (user: ReturnType<typeof userEvent.setup>) =>
      user.click(screen.getByRole("button", { name: "Cancelar" }))],
    ["Esc", (user: ReturnType<typeof userEvent.setup>) => user.keyboard("{Escape}")],
    ["clique fora", async () => {
      // O fundo escurecido é o pai da janela
      fireEvent.mouseDown(screen.getByRole("dialog").parentElement!);
    }],
  ])("%s fecha sem rodar a ação", async (_, close) => {
    const action = vi.fn();
    const user = renderConfirm(action);
    await user.click(screen.getByRole("button", { name: "Abrir" }));

    await close(user);

    expect(await screen.findByText("cancelado")).toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("clique dentro do cartão não fecha", async () => {
    const user = renderConfirm();
    await user.click(screen.getByRole("button", { name: "Abrir" }));

    fireEvent.mouseDown(screen.getByRole("dialog"));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("Tab e Shift+Tab ficam presos dentro da janela", async () => {
    const user = renderConfirm();
    await user.click(screen.getByRole("button", { name: "Abrir" }));
    const cancel = screen.getByRole("button", { name: "Cancelar" });
    const confirm = screen.getByRole("button", { name: "Excluir extrato" });

    await user.tab();
    expect(confirm).toHaveFocus();
    await user.tab();
    expect(cancel).toHaveFocus();
    await user.tab({ shift: true });
    expect(confirm).toHaveFocus();
  });

  it("enquanto a ação roda: botão ocupado e Esc não fecha", async () => {
    let finish!: () => void;
    const user = renderConfirm(() => new Promise<void>((resolve) => (finish = resolve)));
    await user.click(screen.getByRole("button", { name: "Abrir" }));

    await user.click(screen.getByRole("button", { name: "Excluir extrato" }));

    expect(screen.getByRole("button", { name: "Excluindo..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    await user.keyboard("{Escape}");
    fireEvent.mouseDown(screen.getByRole("dialog").parentElement!);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    // Com os dois botões desabilitados, Tab não leva o foco para fora da janela
    await user.tab();
    expect(screen.getByRole("button", { name: "Abrir" })).not.toHaveFocus();

    await act(async () => finish());
    expect(await screen.findByText("confirmado")).toBeInTheDocument();
  });

  it("se a ação falha, fecha e o confirm() rejeita com o erro", async () => {
    const user = renderConfirm(() => Promise.reject(new Error("falhou")));
    await user.click(screen.getByRole("button", { name: "Abrir" }));

    await user.click(screen.getByRole("button", { name: "Excluir extrato" }));

    expect(await screen.findByText("erro: falhou")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("avisos flutuantes", () => {
  it("sucesso some sozinho depois de alguns segundos", () => {
    vi.useFakeTimers();
    try {
      render(
        <FeedbackProvider>
          <ToastTrigger />
        </FeedbackProvider>
      );

      fireEvent.click(screen.getByRole("button", { name: "Sucesso" }));
      expect(screen.getByText("Extrato excluído.")).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(TOAST_DURATION_MS - 1));
      expect(screen.getByText("Extrato excluído.")).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(1));
      expect(screen.queryByText("Extrato excluído.")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("erro é anunciado como alerta e fica até fechar", async () => {
    vi.useFakeTimers();
    try {
      render(
        <FeedbackProvider>
          <ToastTrigger />
        </FeedbackProvider>
      );

      fireEvent.click(screen.getByRole("button", { name: "Erro" }));
      act(() => vi.advanceTimersByTime(TOAST_DURATION_MS * 3));

      expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível excluir o extrato.");
      fireEvent.click(screen.getByRole("button", { name: "Fechar aviso" }));
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("vários avisos empilham e fechar um mantém os outros", async () => {
    const user = userEvent.setup();
    render(
      <FeedbackProvider>
        <ToastTrigger />
      </FeedbackProvider>
    );

    await user.click(screen.getByRole("button", { name: "Sucesso" }));
    await user.click(screen.getByRole("button", { name: "Erro" }));

    const closeButtons = screen.getAllByRole("button", { name: "Fechar aviso" });
    expect(closeButtons).toHaveLength(2);
    await user.click(closeButtons[0]);
    expect(screen.queryByText("Extrato excluído.")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("ficam numa região que o leitor de tela acompanha", () => {
    render(
      <FeedbackProvider>
        <ToastTrigger />
      </FeedbackProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Sucesso" }));

    expect(screen.getByText("Extrato excluído.").closest("[aria-live]")).toHaveAttribute(
      "aria-live",
      "polite"
    );
  });
});

it("usar fora do provider é erro de programação", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const Broken = () => {
    useFeedback();
    return null;
  };
  expect(() => render(<Broken />)).toThrow("useFeedback precisa estar dentro de <FeedbackProvider>");
});
