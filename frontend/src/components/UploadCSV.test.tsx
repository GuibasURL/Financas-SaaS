import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import UploadCSV from "./UploadCSV";
import { addStatement, addUser, db, loginAs } from "../test/fakeApi";

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

describe("extrato repetido", () => {
  const JANEIRO = "data,descricao,valor\n2025-01-05,IFOOD,-45.9\n2025-01-06,SALARIO,5000\n";
  const JANEIRO_E_MAIS_UMA = JANEIRO + "2025-01-20,PADARIA,-12\n";
  const input = () => screen.getByLabelText("Arquivo do extrato (CSV ou OFX)");
  const csv = (content: string, name = "janeiro.csv") => new File([content], name, { type: "text/csv" });

  beforeEach(() => {
    loginAs(addUser());
    addStatement("janeiro.csv", [
      { date: "2025-01-05", description: "IFOOD", amount: -45.9 },
      { date: "2025-01-06", description: "SALARIO", amount: 5000 },
    ]);
  });

  it("extrato inteiro repetido: avisa e não importa até a pessoa decidir", async () => {
    const onUploaded = vi.fn();
    render(<UploadCSV onUploaded={onUploaded} />);

    await userEvent.upload(input(), csv(JANEIRO, "janeiro (1).csv"));

    const prompt = await screen.findByRole("alert");
    expect(prompt).toHaveTextContent("Extrato já importado");
    expect(prompt).toHaveTextContent("2 de 2 transações deste extrato já foram importadas.");
    expect(prompt).toHaveTextContent("Importar de novo duplica essas transações");
    // Nada novo para importar: sem a opção "só as novas"
    expect(within(prompt).queryByRole("button", { name: /só a/ })).not.toBeInTheDocument();
    expect(within(prompt).getByRole("button", { name: "Importar mesmo assim" })).toBeInTheDocument();
    expect(db.statements).toHaveLength(1);
    expect(onUploaded).not.toHaveBeenCalled();
  });

  it("Cancelar fecha o aviso sem importar", async () => {
    const user = userEvent.setup();
    render(<UploadCSV onUploaded={vi.fn()} />);
    await user.upload(input(), csv(JANEIRO));

    await user.click(await screen.findByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(db.statements).toHaveLength(1);
  });

  it("Importar mesmo assim duplica as transações", async () => {
    const user = userEvent.setup();
    const onUploaded = vi.fn();
    render(<UploadCSV onUploaded={onUploaded} />);
    await user.upload(input(), csv(JANEIRO, "de-novo.csv"));

    await user.click(await screen.findByRole("button", { name: "Importar mesmo assim" }));

    await vi.waitFor(() => expect(onUploaded).toHaveBeenCalledOnce());
    expect(db.statements.map((s) => s.filename)).toEqual(["janeiro.csv", "de-novo.csv"]);
    expect(db.transactions).toHaveLength(4);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("parte repetida: importa só as novas e conta quantas entraram", async () => {
    const user = userEvent.setup();
    const onUploaded = vi.fn();
    render(<UploadCSV onUploaded={onUploaded} />);
    await user.upload(input(), csv(JANEIRO_E_MAIS_UMA, "janeiro-completo.csv"));

    const prompt = await screen.findByRole("alert");
    expect(prompt).toHaveTextContent("Parte deste extrato já foi importada");
    expect(within(prompt).getByRole("button", { name: "Importar tudo mesmo assim" })).toBeInTheDocument();
    await user.click(within(prompt).getByRole("button", { name: "Importar só a nova" }));

    await vi.waitFor(() => expect(onUploaded).toHaveBeenCalledOnce());
    expect(db.transactions.map((t) => t.description)).toEqual(["IFOOD", "SALARIO", "PADARIA"]);
    expect(await screen.findByText("1 transação nova importada; as repetidas ficaram de fora.")).toBeInTheDocument();
  });

  it("várias novas: o botão diz quantas", async () => {
    render(<UploadCSV onUploaded={vi.fn()} />);

    await userEvent.upload(
      input(),
      csv(JANEIRO + "2025-01-20,PADARIA,-12\n2025-01-21,UBER,-15\n", "janeiro-completo.csv")
    );

    expect(await screen.findByRole("button", { name: "Importar só as 2 novas" })).toBeInTheDocument();
  });

  it("um envio novo fecha o aviso anterior", async () => {
    const user = userEvent.setup();
    render(<UploadCSV onUploaded={vi.fn()} />);
    await user.upload(input(), csv(JANEIRO));
    await screen.findByRole("alert");

    await user.upload(input(), csv("data,descricao,valor\n2025-02-01,UBER,-15\n", "fevereiro.csv"));

    await vi.waitFor(() => expect(db.statements).toHaveLength(2));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
