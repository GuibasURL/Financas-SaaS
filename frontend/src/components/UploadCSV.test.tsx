import { render, screen } from "@testing-library/react";
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
});
