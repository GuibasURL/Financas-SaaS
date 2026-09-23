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
      screen.getByLabelText("Arquivo do extrato (CSV ou OFX)"),
      new File(["data,descricao,valor\n"], "maio.csv", { type: "text/csv" })
    );

    await vi.waitFor(() => expect(onUploaded).toHaveBeenCalledOnce());
    expect(db.statements.map((s) => s.filename)).toEqual(["maio.csv"]);
  });

  it("mostra o erro da API e não avisa o Dashboard", async () => {
    const onUploaded = vi.fn();
    render(<UploadCSV onUploaded={onUploaded} />);

    // applyAccept: false deixa passar um arquivo que o accept=".csv,.ofx" barraria,
    // para testar a validação do backend
    await userEvent.setup({ applyAccept: false }).upload(
      screen.getByLabelText("Arquivo do extrato (CSV ou OFX)"),
      new File(["x"], "extrato.txt", { type: "text/plain" })
    );

    expect(await screen.findByText("Envie um arquivo .csv ou .ofx")).toBeInTheDocument();
    expect(onUploaded).not.toHaveBeenCalled();
  });

  it("fechar a janela sem escolher arquivo não envia nada", async () => {
    const onUploaded = vi.fn();
    render(<UploadCSV onUploaded={onUploaded} />);

    fireEvent.change(screen.getByLabelText("Arquivo do extrato (CSV ou OFX)"), { target: { files: [] } });

    expect(onUploaded).not.toHaveBeenCalled();
    expect(db.statements).toHaveLength(0);
  });

  it("arrastar e soltar o arquivo também envia", async () => {
    const onUploaded = vi.fn();
    render(<UploadCSV onUploaded={onUploaded} />);
    const dropZone = screen.getByText("Selecionar arquivo .csv ou .ofx").closest("label")!;
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

    fireEvent.drop(screen.getByText("Selecionar arquivo .csv ou .ofx").closest("label")!, {
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
    expect(banks).toHaveTextContent("OFX de qualquer banco");
  });

  it("o campo aceita .csv e .ofx", () => {
    render(<UploadCSV onUploaded={vi.fn()} />);

    expect(screen.getByLabelText("Arquivo do extrato (CSV ou OFX)")).toHaveAttribute(
      "accept",
      ".csv,.ofx"
    );
  });

  it("envia um extrato .ofx", async () => {
    const onUploaded = vi.fn();
    render(<UploadCSV onUploaded={onUploaded} />);

    await userEvent.upload(
      screen.getByLabelText("Arquivo do extrato (CSV ou OFX)"),
      new File(["OFXHEADER:100"], "extrato.ofx", { type: "application/x-ofx" })
    );

    await vi.waitFor(() => expect(onUploaded).toHaveBeenCalledOnce());
    expect(db.statements.map((s) => s.filename)).toEqual(["extrato.ofx"]);
  });
});
