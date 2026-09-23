import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ReportExport from "./ReportExport";
import { addUser, lastReportQuery, loginAs } from "../test/fakeApi";
import type { Statement } from "../types/transaction";

const statement: Statement = {
  id: 7,
  filename: "marco.csv",
  uploaded_at: "2026-09-23T13:30:00",
  transaction_count: 3,
  start_date: "2025-03-01",
  end_date: "2025-03-31",
};

// O jsdom não implementa download de arquivo: captura o que seria baixado
function captureDownloads() {
  const downloads: { filename: string; blob: Blob }[] = [];
  let lastBlob: Blob | null = null;
  URL.createObjectURL = vi.fn((blob: Blob) => {
    lastBlob = blob;
    return "blob:relatorio";
  });
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    downloads.push({ filename: this.download, blob: lastBlob! });
  });
  return downloads;
}

describe("ReportExport", () => {
  beforeEach(() => {
    loginAs(addUser());
  });

  it("sem filtros baixa o relatório completo", async () => {
    const downloads = captureDownloads();
    render(<ReportExport statement={null} />);

    expect(screen.getByText(/Todo o período · todos os extratos/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Baixar Excel" }));

    await vi.waitFor(() => expect(downloads).toHaveLength(1));
    expect(downloads[0].filename).toBe("relatorio-financas_inicio_a_hoje.xlsx");
    expect(await downloads[0].blob.text()).toBe("conteudo-xlsx");
    expect([...lastReportQuery!.keys()]).toEqual([]);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:relatorio");
  });

  it("envia o período e o extrato filtrado", async () => {
    const downloads = captureDownloads();
    const user = userEvent.setup();
    render(<ReportExport statement={statement} />);

    await user.type(screen.getByLabelText("De"), "2025-03-01");
    await user.type(screen.getByLabelText("Até"), "2025-03-31");
    expect(screen.getByText(/Período escolhido · extrato marco.csv/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Baixar Excel" }));

    await vi.waitFor(() => expect(downloads).toHaveLength(1));
    expect(Object.fromEntries(lastReportQuery!)).toEqual({
      start_date: "2025-03-01",
      end_date: "2025-03-31",
      statement_id: "7",
    });
    expect(downloads[0].filename).toBe("relatorio-financas_2025-03-01_a_2025-03-31.xlsx");
  });

  it("mostra o erro da API (mesmo com a resposta vindo como arquivo)", async () => {
    const downloads = captureDownloads();
    const user = userEvent.setup();
    render(<ReportExport statement={null} />);

    await user.type(screen.getByLabelText("De"), "2025-04-01");
    await user.type(screen.getByLabelText("Até"), "2025-03-01");
    await user.click(screen.getByRole("button", { name: "Baixar Excel" }));

    expect(await screen.findByText("A data inicial é depois da data final")).toBeInTheDocument();
    expect(downloads).toHaveLength(0);
  });
});
