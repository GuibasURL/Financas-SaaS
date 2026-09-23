import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import UploadCSV from "./UploadCSV";
import { addUser, db, loginAs } from "../test/fakeApi";

describe("UploadCSV", () => {
  beforeEach(() => {
    loginAs(addUser());
  });

  it("envia o arquivo e avisa quando termina", async () => {
    const onUploaded = vi.fn();
    render(<UploadCSV onUploaded={onUploaded} />);

    await userEvent.upload(
      screen.getByLabelText("Arquivo CSV do extrato"),
      new File(["data,descricao,valor\n"], "maio.csv", { type: "text/csv" })
    );

    await vi.waitFor(() => expect(onUploaded).toHaveBeenCalledOnce());
    expect(db.statements.map((s) => s.filename)).toEqual(["maio.csv"]);
  });

  it("mostra o erro da API e não avisa o Dashboard", async () => {
    const onUploaded = vi.fn();
    render(<UploadCSV onUploaded={onUploaded} />);

    // applyAccept: false deixa passar um arquivo que o accept=".csv" barraria,
    // para testar a validação do backend
    await userEvent.setup({ applyAccept: false }).upload(
      screen.getByLabelText("Arquivo CSV do extrato"),
      new File(["x"], "extrato.txt", { type: "text/plain" })
    );

    expect(await screen.findByText("Envie um arquivo .csv")).toBeInTheDocument();
    expect(onUploaded).not.toHaveBeenCalled();
  });

  it("fechar a janela sem escolher arquivo não envia nada", async () => {
    const onUploaded = vi.fn();
    render(<UploadCSV onUploaded={onUploaded} />);

    fireEvent.change(screen.getByLabelText("Arquivo CSV do extrato"), { target: { files: [] } });

    expect(onUploaded).not.toHaveBeenCalled();
    expect(db.statements).toHaveLength(0);
  });

  it("arrastar e soltar o arquivo também envia", async () => {
    const onUploaded = vi.fn();
    render(<UploadCSV onUploaded={onUploaded} />);
    const dropZone = screen.getByText("Selecionar arquivo .csv").closest("label")!;
    const file = new File(["data,descricao,valor\n"], "solto.csv", { type: "text/csv" });

    fireEvent.dragOver(dropZone);
    expect(dropZone.className).toMatch(/dragging/);
    fireEvent.dragLeave(dropZone);
    expect(dropZone.className).not.toMatch(/dragging/);

    fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });

    await vi.waitFor(() => expect(onUploaded).toHaveBeenCalledOnce());
    expect(db.statements.map((s) => s.filename)).toEqual(["solto.csv"]);
  });

  it("soltar sem arquivo não faz nada", () => {
    const onUploaded = vi.fn();
    render(<UploadCSV onUploaded={onUploaded} />);

    fireEvent.drop(screen.getByText("Selecionar arquivo .csv").closest("label")!, {
      dataTransfer: { files: [] },
    });

    expect(db.statements).toHaveLength(0);
  });

  it("mostra os bancos aceitos", () => {
    render(<UploadCSV onUploaded={vi.fn()} />);

    const banks = screen.getByLabelText("Bancos aceitos");
    expect(banks).toHaveTextContent("Nubank conta");
    expect(banks).toHaveTextContent("Banco do Brasil");
    expect(banks).toHaveTextContent("PicPay");
  });
});
