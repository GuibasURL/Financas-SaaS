/**
 * Força da senha no cadastro: a mesma regra de
 * backend/app/services/password_policy.py (lá ela é obrigatória; aqui
 * serve para mostrar a checklist enquanto a pessoa digita).
 *
 * - Forte: 8+ caracteres e os 4 tipos (minúscula, maiúscula, número, especial)
 * - Mediana: 8+ caracteres e 3 dos 4 tipos
 * - Fraca: o resto, ou uma senha óbvia (não é aceita no cadastro)
 */
export const MIN_PASSWORD_LENGTH = 8;

export type PasswordStrength = "weak" | "medium" | "strong";

// Palavras de senhas comuns, comparadas com as LETRAS da senha. Tem que ser
// igual à COMMON_PASSWORDS do backend (um teste de lá confere).
const COMMON_PASSWORDS = new Set([
  "admin", "administrador", "amor", "asdf", "asdfgh", "asdfghjkl", "bemvindo",
  "brasil", "corinthians", "deus", "dragon", "financas", "flamengo", "football",
  "futebol", "gremio", "iloveyou", "jesus", "letmein", "login", "master", "minhasenha",
  "monkey", "mudar", "mudarsenha", "palmeiras", "pass", "passw", "passwd", "password",
  "princesa", "qwerty", "qwertyuiop", "root", "santos", "saopaulo", "senha", "senhas",
  "sunshine", "teamo", "test", "teste", "trocar", "user", "usuario", "vasco", "vexira",
  "welcome", "zxcv", "zxcvbn",
]);

// Parte do e-mail (antes do @) menor que isso não é checada: "ana" pegaria "Banana"
const MIN_EMAIL_PART = 4;

export interface PasswordRequirement {
  key: "length" | "lower" | "upper" | "digit" | "special" | "notObvious";
  label: string;
  met: boolean;
}

/** Só as letras, sem acento e em minúsculas; "@" e "$" contam como "a" e "s" */
function letters(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/@/g, "a")
    .replace(/\$/g, "s")
    .replace(/[^\p{L}]/gu, "");
}

function isSequenceOrRepeat(text: string): boolean {
  const chars = [...text];
  if (chars.length < 4) return false;
  const steps = new Set(
    chars.slice(1).map((c, i) => c.codePointAt(0)! - chars[i].codePointAt(0)!)
  );
  return steps.size === 1 && [0, 1, -1].includes([...steps][0]);
}

/** Por que a senha é fácil de adivinhar, ou null se não é */
export function obviousReason(password: string, email = ""): string | null {
  const core = letters(password);
  if (COMMON_PASSWORDS.has(core)) return "é uma senha muito comum";
  if (isSequenceOrRepeat(core)) return "é uma sequência ou repetição de letras";
  const emailPart = letters(email.split("@")[0]);
  if (emailPart.length >= MIN_EMAIL_PART && core.includes(emailPart)) {
    return "contém o seu e-mail";
  }
  return null;
}

export function passwordRequirements(password: string, email = ""): PasswordRequirement[] {
  const reason = password ? obviousReason(password, email) : null;
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
    {
      key: "notObvious",
      label: reason ? `Fácil de adivinhar: ${reason}` : "Não é fácil de adivinhar",
      met: password !== "" && reason === null,
    },
  ];
}

const TYPE_KEYS = ["lower", "upper", "digit", "special"];

export function passwordStrength(password: string, email = ""): PasswordStrength {
  const requirements = passwordRequirements(password, email);
  const met = (key: string) => requirements.find((r) => r.key === key)!.met;
  const typeCount = TYPE_KEYS.filter(met).length;
  if (!met("length") || typeCount < 3 || !met("notObvious")) return "weak";
  return typeCount === 4 ? "strong" : "medium";
}

/** Mensagem do que impede o cadastro (a mesma ordem do backend), ou null se a senha serve */
export function weakPasswordMessage(password: string, email = ""): string | null {
  const requirements = passwordRequirements(password, email);
  const missingTypes = requirements.filter((r) => TYPE_KEYS.includes(r.key) && !r.met);
  if (!requirements[0].met) {
    return `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (missingTypes.length > 1) {
    return `A senha está fraca. Falta: ${missingTypes.map((r) => r.label.toLowerCase()).join(", ")}.`;
  }
  const reason = obviousReason(password, email);
  if (reason) return `A senha é fácil de adivinhar: ${reason}. Escolha outra.`;
  return null;
}

export const STRENGTH_LABELS: Record<PasswordStrength, string> = {
  weak: "Fraca",
  medium: "Mediana",
  strong: "Forte",
};
