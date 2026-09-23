import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
import { addUser, loginAs } from "./fakeApi";

/**
 * Abre o app inteiro (rotas, menu, dados) já logado, na rota pedida.
 * Espera o carregamento inicial terminar antes de devolver.
 */
export async function renderLoggedIn(path = "/") {
  loginAs(addUser("ana@teste.com"));
  window.history.pushState({}, "", path);
  const user = userEvent.setup();
  render(<App />);
  await screen.findByText("ana@teste.com");
  return user;
}
