import { act, render, screen } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getStatements, SLOW_REQUEST_MS } from "../services/api";
import { API, server } from "../test/fakeApi";
import ServerWakeNotice from "./ServerWakeNotice";

const NOTICE = "Acordando o servidor…";

// Resposta da API que só chega quando o teste mandar
function holdStatements() {
  let release!: () => void;
  const released = new Promise<void>((resolve) => (release = resolve));
  server.use(
    http.get(`${API}/statements`, async () => {
      await released;
      return HttpResponse.json([]);
    })
  );
  return release;
}

describe("Servidor acordando", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("pedido demorado mostra o aviso, que some quando a resposta chega", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const release = holdStatements();
    render(<ServerWakeNotice />);

    const request = getStatements();
    await act(() => vi.advanceTimersByTimeAsync(SLOW_REQUEST_MS - 500));
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(screen.getByText(NOTICE)).toBeInTheDocument();

    release();
    await act(() => request);
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
  });

  it("pedido rápido não mostra nada", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    server.use(
      http.get(`${API}/statements`, async () => {
        await delay(100);
        return HttpResponse.json([]);
      })
    );
    render(<ServerWakeNotice />);

    await act(async () => {
      await getStatements();
      await vi.advanceTimersByTimeAsync(SLOW_REQUEST_MS * 2);
    });

    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
  });

  it("erro também encerra o aviso", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let release!: () => void;
    const released = new Promise<void>((resolve) => (release = resolve));
    server.use(
      http.get(`${API}/statements`, async () => {
        await released;
        return HttpResponse.error();
      })
    );
    render(<ServerWakeNotice />);

    const request = getStatements().catch(() => {});
    await act(() => vi.advanceTimersByTimeAsync(SLOW_REQUEST_MS + 100));
    expect(screen.getByText(NOTICE)).toBeInTheDocument();

    release();
    await act(() => request);
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
  });
});
