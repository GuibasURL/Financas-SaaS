import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { db } from "../test/fakeApi";
import { renderLoggedIn } from "../test/renderApp";

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

function nav() {
  return screen.getByRole("complementary", { name: "Navegação principal" });
}

function photo(name = "eu.png", type = "image/png", bytes: BlobPart = PNG_BYTES) {
  return new File([bytes], name, { type });
}

const nameField = () => screen.getByLabelText("Nome completo");
const emailField = () => screen.getByLabelText("E-mail");
const saveButton = () => screen.getByRole("button", { name: "Salvar alterações" });
const photoInput = () => screen.getByLabelText("Escolher foto do perfil");

async function openProfile() {
  const user = await renderLoggedIn("/perfil");
  await screen.findByRole("heading", { level: 1, name: "Editar perfil" });
  return user;
}

describe("Editar perfil", () => {
  it("abre pelo cartão do perfil no menu", async () => {
    const user = await renderLoggedIn();

    await user.click(within(nav()).getByRole("link", { name: /Meu perfil/ }));

    expect(await screen.findByRole("heading", { level: 1, name: "Editar perfil" })).toBeInTheDocument();
    expect(within(nav()).getByRole("link", { name: /Meu perfil/ })).toHaveAttribute("aria-current", "page");
    // No celular, o perfil é um item da barra de baixo
    expect(within(nav()).getByRole("link", { name: "Perfil" })).toHaveAttribute("href", "/perfil");
  });

  it("conta nova: sem nome, mostra a inicial do e-mail e nada para salvar", async () => {
    await openProfile();

    expect(nameField()).toHaveValue("");
    expect(emailField()).toHaveValue("ana@teste.com");
    expect(screen.getByLabelText(/Data de nascimento/)).toHaveValue("");
    expect(within(screen.getByRole("main")).getByText("A", { selector: "span" })).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remover" })).toBeDisabled();
    // Senha só aparece ao trocar o e-mail
    expect(screen.queryByLabelText("Senha atual")).not.toBeInTheDocument();
  });

  it("salva nome e data de nascimento e atualiza o menu", async () => {
    const user = await openProfile();

    await user.type(nameField(), "Ana Souza");
    fireEvent.change(screen.getByLabelText(/Data de nascimento/), { target: { value: "1992-08-17" } });
    expect(within(screen.getByRole("main")).getByText("AS", { selector: "span" })).toBeInTheDocument(); // prévia das iniciais
    await user.click(saveButton());

    expect(await screen.findByText("Perfil atualizado.")).toBeInTheDocument();
    expect(db.users[0]).toMatchObject({ name: "Ana Souza", birth_date: "1992-08-17" });
    expect(within(nav()).getByRole("link", { name: /Ana Souza/ })).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });

  it("apagar a data de nascimento manda null", async () => {
    const user = await openProfile();
    const birthDate = screen.getByLabelText(/Data de nascimento/);
    await user.type(nameField(), "Ana");
    fireEvent.change(birthDate, { target: { value: "1992-08-17" } });
    await user.click(saveButton());
    await waitFor(() => expect(db.users[0].birth_date).toBe("1992-08-17"));

    fireEvent.change(birthDate, { target: { value: "" } });
    await user.click(saveButton());

    await waitFor(() => expect(db.users[0].birth_date).toBeNull());
  });

  it("Cancelar desfaz o que não foi salvo", async () => {
    const user = await openProfile();
    await user.type(nameField(), "Outro Nome");
    await user.upload(photoInput(), photo());
    expect(await screen.findByText("A foto nova entra quando você salvar.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(nameField()).toHaveValue("");
    expect(screen.queryByText("A foto nova entra quando você salvar.")).not.toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
    expect(db.users[0].name).toBeNull();
  });

  it("nome curto demais: mostra o erro da API", async () => {
    const user = await openProfile();

    await user.type(nameField(), "  x  ");
    await user.click(saveButton());

    expect(await screen.findByRole("alert")).toHaveTextContent("Informe seu nome");
    expect(db.users[0].name).toBeNull();
  });
});

describe("trocar o e-mail", () => {
  it("pede a senha atual e não troca com a senha errada", async () => {
    const user = await openProfile();
    await user.type(nameField(), "Ana");

    await user.clear(emailField());
    await user.type(emailField(), "nova@teste.com");
    await user.type(screen.getByLabelText("Senha atual"), "errada");
    await user.click(saveButton());

    expect(await screen.findByRole("alert")).toHaveTextContent("Senha atual incorreta");
    expect(db.users[0].email).toBe("ana@teste.com");
    expect(screen.getByLabelText("Senha atual")).toHaveValue("errada"); // dá para corrigir
  });

  it("com a senha certa, troca o e-mail", async () => {
    const user = await openProfile();
    await user.type(nameField(), "Ana");
    await user.clear(emailField());
    await user.type(emailField(), "Nova@Teste.com");

    await user.type(screen.getByLabelText("Senha atual"), "senha-forte-123");
    await user.click(saveButton());

    expect(await screen.findByText("Perfil atualizado.")).toBeInTheDocument();
    expect(db.users[0].email).toBe("nova@teste.com");
    expect(emailField()).toHaveValue("nova@teste.com");
    expect(screen.queryByLabelText("Senha atual")).not.toBeInTheDocument();
  });

  it("mesmo e-mail em maiúsculas não pede senha", async () => {
    const user = await openProfile();
    await user.clear(emailField());
    await user.type(emailField(), "ANA@teste.com");

    expect(screen.queryByLabelText("Senha atual")).not.toBeInTheDocument();
  });
});

describe("foto do perfil", () => {
  it("sem nome, o formulário não envia (campo obrigatório)", async () => {
    const user = await openProfile();
    await user.upload(photoInput(), photo());
    await screen.findByText("A foto nova entra quando você salvar.");

    await user.click(saveButton());

    expect(nameField()).toBeInvalid();
    expect(db.users[0].avatar_url).toBeNull();
  });

  it("escolhe, mostra a prévia e salva", async () => {
    const user = await openProfile();
    await user.type(nameField(), "Ana"); // nome é obrigatório no formulário

    await user.upload(photoInput(), photo());
    expect(await screen.findByText("A foto nova entra quando você salvar.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Trocar foto" })).toBeInTheDocument();
    await user.click(saveButton());

    expect(await screen.findByText("Perfil atualizado.")).toBeInTheDocument();
    expect(db.users[0].avatar_url).toMatch(/^data:image\/png;base64,/);
    // O menu mostra a foto salva
    expect(nav().querySelector("img")).toHaveAttribute("src", db.users[0].avatar_url);
  });

  it("o botão Escolher foto abre o seletor de arquivo", async () => {
    const user = await openProfile();
    let opened = false;
    photoInput().addEventListener("click", () => (opened = true));

    await user.click(screen.getByRole("button", { name: "Escolher foto" }));

    expect(opened).toBe(true);
  });

  it("remove a foto salva", async () => {
    const user = await openProfile();
    await user.type(nameField(), "Ana");
    await user.upload(photoInput(), photo());
    await user.click(saveButton());
    await screen.findByText("Perfil atualizado.");

    await user.click(screen.getByRole("button", { name: "Remover" }));
    expect(screen.getByText("A foto sai quando você salvar.")).toBeInTheDocument();
    await user.click(saveButton());

    await waitFor(() => expect(db.users[0].avatar_url).toBeNull());
    expect(nav().querySelector("img")).toBeNull();
  });

  it("remover uma foto ainda não salva só descarta a escolha", async () => {
    const user = await openProfile();
    await user.upload(photoInput(), photo());
    await screen.findByText("A foto nova entra quando você salvar.");

    await user.click(screen.getByRole("button", { name: "Remover" }));

    expect(saveButton()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Escolher foto" })).toBeInTheDocument();
  });

  it("recusa arquivo que não é foto", async () => {
    await openProfile();

    fireEvent.change(photoInput(), { target: { files: [photo("extrato.pdf", "application/pdf")] } });

    expect(await screen.findByRole("alert")).toHaveTextContent("Escolha uma foto em JPG, PNG ou WebP.");
    expect(saveButton()).toBeDisabled();
  });

  it("recusa foto grande demais que o navegador não conseguiu reduzir", async () => {
    await openProfile();

    fireEvent.change(photoInput(), {
      target: { files: [photo("enorme.png", "image/png", new Uint8Array(1024 * 1024 + 1))] },
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("A foto pode ter no máximo 1 MB.");
  });

  it("seletor fechado sem escolher nada não muda nada", async () => {
    await openProfile();

    fireEvent.change(photoInput(), { target: { files: [] } });

    expect(saveButton()).toBeDisabled();
  });

  it("se a API recusa a foto, os dados já salvos continuam valendo", async () => {
    const user = await openProfile();
    await user.type(nameField(), "Ana Souza");
    // JPEG: a API falsa só aceita PNG, então recusa
    await user.upload(photoInput(), photo("eu.jpg", "image/jpeg", new Uint8Array([0xff, 0xd8, 0xff])));
    await screen.findByText("A foto nova entra quando você salvar.");

    await user.click(saveButton());

    expect(await screen.findByRole("alert")).toHaveTextContent("Envie uma foto em JPG, PNG ou WebP");
    expect(db.users[0].name).toBe("Ana Souza");
    expect(within(nav()).getByRole("link", { name: /Ana Souza/ })).toBeInTheDocument();
    // Falta só a foto: dá para tentar de novo
    expect(saveButton()).toBeEnabled();
  });
});
