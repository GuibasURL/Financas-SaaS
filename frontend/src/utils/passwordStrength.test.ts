import { describe, expect, it } from "vitest";
import { passwordRequirements, passwordStrength } from "./passwordStrength";

// Mesmos casos de backend/tests/test_password_policy.py: as duas regras precisam bater
describe("força da senha", () => {
  it.each([
    ["", "weak"],
    ["Ab1!", "weak"],
    ["abcdefgh", "weak"],
    ["abcdefg1", "weak"],
    ["abcdef1!", "medium"],
    ["Abcdefg1", "medium"],
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
});
