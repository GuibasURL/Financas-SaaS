/**
 * Campos de senha usados no cadastro e na troca de senha do perfil: o campo
 * com o "olhinho", a barra de força com a checklist e o "as senhas conferem".
 */
import Icon from "./Icon";
import {
  passwordRequirements,
  passwordStrength,
  STRENGTH_LABELS,
} from "../utils/passwordStrength";
import styles from "./PasswordInputs.module.css";

export interface PasswordFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  // Nome acessível do botão do olhinho ("Mostrar senha")
  toggleLabel: string;
  visible: boolean;
  onToggle: () => void;
  placeholder?: string;
  autoComplete: string;
  // Classe do <input> (cada tela tem o seu estilo de campo)
  inputClassName: string;
  minLength?: number;
  describedBy?: string;
}

// Campo de senha com o botão de mostrar/ocultar (o "olhinho")
export function PasswordField({
  id,
  value,
  onChange,
  toggleLabel,
  visible,
  onToggle,
  placeholder,
  autoComplete,
  inputClassName,
  minLength,
  describedBy,
}: PasswordFieldProps) {
  return (
    <div className={styles.passwordWrap}>
      <input
        id={id}
        className={`${inputClassName} ${styles.passwordField}`}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        minLength={minLength}
        aria-describedby={describedBy}
        // Com a senha à mostra, nada de corretor ou maiúscula automática no celular
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        required
      />
      <button
        type="button"
        className={styles.eye}
        onClick={onToggle}
        aria-label={toggleLabel}
        aria-pressed={visible}
        aria-controls={id}
        title={visible ? "Ocultar senha" : "Mostrar senha"}
      >
        <Icon name={visible ? "eyeOff" : "eye"} />
      </button>
    </div>
  );
}

// "As senhas conferem" enquanto a pessoa digita a repetição
export function PasswordMatch({
  password,
  confirm,
  id = "password-match",
}: {
  password: string;
  confirm: string;
  id?: string;
}) {
  const matches = confirm !== "" && confirm === password;
  return (
    // Sempre presente (vazio antes de digitar), para o leitor de tela anunciar a mudança
    <p
      id={id}
      className={`${styles.match} ${matches ? styles.met : ""}`}
      aria-live="polite"
    >
      {confirm !== "" && (
        <>
          <Icon name={matches ? "check" : "circle"} />
          {matches ? "As senhas conferem" : "As senhas ainda não conferem"}
        </>
      )}
    </p>
  );
}

// Barra fraca/mediana/forte + checklist do que a senha já tem
export function PasswordStrengthMeter({
  password,
  email,
  idPrefix = "password",
}: {
  password: string;
  email: string;
  // ids "<prefixo>-strength" e "<prefixo>-requirements", para o aria-describedby do campo
  idPrefix?: string;
}) {
  const strength = passwordStrength(password, email);
  const requirements = passwordRequirements(password, email);
  const empty = password === "";

  return (
    <div className={styles.strength}>
      <div
        className={`${styles.meter} ${empty ? "" : styles[strength]}`}
        aria-hidden="true"
      >
        <i />
      </div>
      {/* aria-live: o leitor de tela avisa quando a força muda, não a cada tecla */}
      <p id={`${idPrefix}-strength`} className={styles.strengthLabel} aria-live="polite">
        Força da senha:{" "}
        <strong className={empty ? undefined : styles[strength]}>
          {empty ? "digite uma senha" : STRENGTH_LABELS[strength]}
        </strong>
      </p>
      <ul id={`${idPrefix}-requirements`} className={styles.requirements} aria-label="Requisitos da senha">
        {requirements.map((r) => (
          <li key={r.key} className={r.met ? styles.met : undefined}>
            <Icon name={r.met ? "check" : "circle"} />
            {r.label}
            <span className={styles.srOnly}>{r.met ? " (ok)" : " (falta)"}</span>
          </li>
        ))}
      </ul>
      <p className={styles.hint}>Precisa ser mediana ou forte: 3 dos 4 tipos de caractere.</p>
    </div>
  );
}
