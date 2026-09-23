import { describe, expect, it } from "vitest";
import {
  obviousReason,
  passwordRequirements,
  passwordStrength,
  weakPasswordMessage,
} from "./passwordStrength";

// Mesmos casos de backend/tests/test_password_policy.py: as duas regras precisam bater
describe("força da senha", () => {
  it.each([
    ["", "weak"],
    ["Ab1!", "weak"],
    ["girassol", "weak"],
    ["girassol1", "weak"],
    ["girassol1!", "medium"],
    ["Girassol1", "medium"],
    ["senha-forte-123", "medium"],
    ["Senha-forte-123", "strong"],
    ["Çãoçãoç1", "medium"],
    ["Açaí com granola 1!", "strong"],
  ])('"%s" é %s', (password, strength) => {
    expect(passwordStrength(password)).toBe(strength);
  });

  it("espaço não conta como caractere especial", () => {
    const special = passwordRequirements("abc def").find((r) => r.key === "special");
    expect(special?.met).toBe(false);
  });

  it("emoji conta como 1 caractere no tamanho", () => {
    const length = passwordRequirements("abcdef😀").find((r) => r.key === "length");
    expect(length?.met).toBe(false);
  });

  // Mesmos casos de test_senhas_obvias no backend
  it.each([
    ["Senha123!", "é uma senha muito comum"],
    ["S3nh@...", null],
    ["P@ssword2024", "é uma senha muito comum"],
    ["Qwerty123!", "é uma senha muito comum"],
    ["Flamengo10!", "é uma senha muito comum"],
    ["Vexira2026!", "é uma senha muito comum"],
    ["Abcdefg1!", "é uma sequência ou repetição de letras"],
    ["Zyxwvu99!", "é uma sequência ou repetição de letras"],
    ["Aaaaaaa1!", "é uma sequência ou repetição de letras"],
    ["Abc12345!", null],
    ["senha-forte-123", null],
    ["Girassol1!", null],
  ])('"%s" óbvia: %s', (password, reason) => {
    expect(obviousReason(password)).toBe(reason);
  });

  it.each([
    ["Joaosilva2024!", "joao.silva@teste.com", true],
    ["JOÃOSILVA#99", "joaosilva@teste.com", true],
    ["Banana#2024", "ana@teste.com", false],
    ["Girassol1!", "joao.silva@teste.com", false],
  ])('"%s" com o e-mail %s: bloqueia = %s', (password, email, blocked) => {
    expect(obviousReason(password, email) === "contém o seu e-mail").toBe(blocked);
  });

  it("óbvia é fraca mesmo com os 4 tipos, e a mensagem diz por quê", () => {
    expect(passwordStrength("Senha123!")).toBe("weak");
    expect(weakPasswordMessage("Senha123!")).toBe(
      "A senha é fácil de adivinhar: é uma senha muito comum. Escolha outra."
    );
    expect(weakPasswordMessage("Girassol1!")).toBeNull();
    expect(weakPasswordMessage("Ab1!")).toBe("A senha precisa ter pelo menos 8 caracteres.");
    expect(weakPasswordMessage("girassol")).toBe(
      "A senha está fraca. Falta: letra maiúscula, número, caractere especial (!@#$...)."
    );
  });
});
