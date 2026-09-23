/**
 * Força da senha no cadastro: a mesma regra de
 * backend/app/services/password_policy.py (lá ela é obrigatória; aqui
 * serve para mostrar a checklist enquanto a pessoa digita).
 *
 * - Forte: 8+ caracteres e os 4 tipos (minúscula, maiúscula, número, especial)
 * - Mediana: 8+ caracteres e 3 dos 4 tipos
 * - Fraca: o resto (não é aceita no cadastro)
 */
export const MIN_PASSWORD_LENGTH = 8;

export type PasswordStrength = "weak" | "medium" | "strong";

export interface PasswordRequirement {
  key: "length" | "lower" | "upper" | "digit" | "special";
  label: string;
  met: boolean;
}

export function passwordRequirements(password: string): PasswordRequirement[] {
  return [
    {
      key: "length",
      label: `Pelo menos ${MIN_PASSWORD_LENGTH} caracteres`,
      met: [...password].length >= MIN_PASSWORD_LENGTH,
    },
    // \p{Ll}/\p{Lu}: letras acentuadas também contam ("ç", "Á")
    { key: "lower", label: "Letra minúscula", met: /\p{Ll}/u.test(password) },
    { key: "upper", label: "Letra maiúscula", met: /\p{Lu}/u.test(password) },
    { key: "digit", label: "Número", met: /\p{Nd}/u.test(password) },
    // Qualquer coisa que não seja letra, número ou espaço: !@#$%&*-_.,;?...
    { key: "special", label: "Caractere especial (!@#$...)", met: /[^\p{L}\p{N}\s]/u.test(password) },
  ];
}

export function passwordStrength(password: string): PasswordStrength {
  const [length, ...types] = passwordRequirements(password);
  const typeCount = types.filter((r) => r.met).length;
  if (!length.met || typeCount < 3) return "weak";
  return typeCount === 4 ? "strong" : "medium";
}

export const STRENGTH_LABELS: Record<PasswordStrength, string> = {
  weak: "Fraca",
  medium: "Mediana",
  strong: "Forte",
};
