import { useState } from "react";
import { apiErrorMessage, getMe, login, register } from "../services/api";
import type { User } from "../types/user";
import Icon from "../components/Icon";
import Logo from "../components/Logo";
import {
  passwordRequirements,
  passwordStrength,
  STRENGTH_LABELS,
} from "../utils/passwordStrength";
import styles from "./AuthPage.module.css";

interface Props {
  onAuthenticated: (user: User) => void;
  // Mensagem mostrada acima do formulário (ex: sessão expirada)
  notice?: string | null;
}

type Mode = "login" | "register";

const MODES: { mode: Mode; label: string }[] = [
  { mode: "login", label: "Entrar" },
  { mode: "register", label: "Criar conta" },
];

const HEADINGS: Record<Mode, { eyebrow: string; title: string; subtitle: string }> = {
  login: {
    eyebrow: "Acesse sua conta",
    title: "Bem-vindo de volta",
    subtitle: "Entre para continuar organizando suas finanças.",
  },
  register: {
    eyebrow: "Comece por aqui",
    title: "Crie sua conta",
    subtitle: "Use um e-mail válido e escolha uma senha segura.",
  },
};

interface PasswordFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  // Nome acessível do botão do olhinho ("Mostrar senha")
  toggleLabel: string;
  visible: boolean;
  onToggle: () => void;
  placeholder: string;
  autoComplete: string;
  minLength?: number;
  describedBy?: string;
}

// Campo de senha com o botão de mostrar/ocultar (o "olhinho")
function PasswordField({
  id,
  value,
  onChange,
  toggleLabel,
  visible,
  onToggle,
  placeholder,
  autoComplete,
  minLength,
  describedBy,
}: PasswordFieldProps) {
  return (
    <div className={styles.passwordWrap}>
      <input
        id={id}
        className={`${styles.field} ${styles.passwordField}`}
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

// Barra fraca/mediana/forte + checklist do que a senha já tem
function PasswordStrengthMeter({ password }: { password: string }) {
  const strength = passwordStrength(password);
  const requirements = passwordRequirements(password);
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
      <p id="password-strength" className={styles.strengthLabel} aria-live="polite">
        Força da senha:{" "}
        <strong className={empty ? undefined : styles[strength]}>
          {empty ? "digite uma senha" : STRENGTH_LABELS[strength]}
        </strong>
      </p>
      <ul id="password-requirements" className={styles.requirements} aria-label="Requisitos da senha">
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

export default function AuthPage({ onAuthenticated, notice }: Props) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isRegister = mode === "register";
  const heading = HEADINGS[mode];

  function changeMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    setError(null);
    setPassword("");
    setPasswordConfirm("");
    hidePasswords();
  }

  // Volta a esconder: ao trocar de aba e ao enviar (o gerenciador de senhas
  // do navegador só reconhece a senha num campo do tipo "password")
  function hidePasswords() {
    setShowPassword(false);
    setShowPasswordConfirm(false);
  }

  // Setas esquerda/direita trocam de aba, como em qualquer lista de abas
  function handleTabKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const next = isRegister ? "login" : "register";
      changeMode(next);
      document.getElementById(`auth-tab-${next}`)?.focus();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    hidePasswords();

    // Fraca não passa (o backend recusa do mesmo jeito; aqui a pessoa já vê o que falta)
    if (isRegister && passwordStrength(password) === "weak") {
      const missing = passwordRequirements(password)
        .filter((r) => !r.met)
        .map((r) => r.label.toLowerCase());
      setError(`A senha está fraca. Falta: ${missing.join(", ")}.`);
      return;
    }

    if (isRegister && password !== passwordConfirm) {
      setError("As senhas não conferem.");
      return;
    }

    setSubmitting(true);
    try {
      if (isRegister) {
        await register(email, password);
      }
      // Depois do cadastro já entra direto, sem pedir o login de novo
      await login(email, password);
      onAuthenticated(await getMe());
    } catch (err) {
      setError(
        apiErrorMessage(
          err,
          isRegister ? "Não foi possível criar a conta." : "Não foi possível entrar."
        )
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.layout}>
        <section className={styles.story}>
          <Logo className={styles.brand} markClassName={styles.mark} nameClassName={styles.brandName} />

          <div className={styles.storyCopy}>
            <p className={styles.eyebrow}>Clareza para as suas escolhas</p>
            <h1 className={styles.title}>
              O seu extrato, <span>claro</span>.
            </h1>
            <p className={styles.intro}>
              Importe seus extratos em CSV, categorize os gastos automaticamente e acompanhe o
              mês inteiro. Preciso, confiável e sem ruído.
            </p>
          </div>

          <dl className={styles.statement} aria-label="Resumo ilustrativo">
            <div>
              <dt>Entradas</dt>
              <dd className={styles.income}>+ R$ 8.420,00</dd>
            </div>
            <div>
              <dt>Saídas</dt>
              <dd className={styles.expense}>− R$ 5.130,00</dd>
            </div>
            <div>
              <dt>Saldo</dt>
              <dd>R$ 3.290,00</dd>
            </div>
          </dl>
        </section>

        <section className={styles.card}>
          <div className={styles.tabs} role="tablist" aria-label="Acesso">
            {MODES.map(({ mode: tabMode, label }) => (
              <button
                key={tabMode}
                id={`auth-tab-${tabMode}`}
                type="button"
                role="tab"
                aria-selected={mode === tabMode}
                aria-controls="auth-panel"
                tabIndex={mode === tabMode ? 0 : -1}
                className={`${styles.tab} ${mode === tabMode ? styles.tabActive : ""}`}
                onClick={() => changeMode(tabMode)}
                onKeyDown={handleTabKeyDown}
                disabled={submitting}
              >
                {label}
              </button>
            ))}
          </div>

          <div id="auth-panel" role="tabpanel" aria-labelledby={`auth-tab-${mode}`}>
            <div className={styles.heading}>
              <p className={styles.eyebrow}>{heading.eyebrow}</p>
              <h2>{heading.title}</h2>
              <p>{heading.subtitle}</p>
            </div>

            {notice && (
              <p className={styles.notice} role="status">
                {notice}
              </p>
            )}
            {error && (
              <p className={`${styles.notice} ${styles.error}`} role="alert">
                {error}
              </p>
            )}

            <form onSubmit={handleSubmit}>
              <label className={styles.label} htmlFor="auth-email">
                E-mail
              </label>
              <input
                id="auth-email"
                className={styles.field}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@email.com"
                autoComplete="email"
                required
              />

              <label className={styles.label} htmlFor="auth-password">
                Senha
              </label>
              <PasswordField
                id="auth-password"
                value={password}
                onChange={setPassword}
                toggleLabel="Mostrar senha"
                visible={showPassword}
                onToggle={() => setShowPassword(!showPassword)}
                placeholder={isRegister ? "Mínimo 8 caracteres" : "Digite sua senha"}
                autoComplete={isRegister ? "new-password" : "current-password"}
                minLength={isRegister ? 8 : undefined}
                describedBy={isRegister ? "password-strength password-requirements" : undefined}
              />
              {isRegister && <PasswordStrengthMeter password={password} />}

              {isRegister && (
                <>
                  <label className={styles.label} htmlFor="auth-password-confirm">
                    Repetir senha
                  </label>
                  <PasswordField
                    id="auth-password-confirm"
                    value={passwordConfirm}
                    onChange={setPasswordConfirm}
                    toggleLabel="Mostrar a senha repetida"
                    visible={showPasswordConfirm}
                    onToggle={() => setShowPasswordConfirm(!showPasswordConfirm)}
                    placeholder="Digite a senha novamente"
                    autoComplete="new-password"
                  />
                </>
              )}

              <button className={styles.submit} type="submit" disabled={submitting}>
                {submitting ? "Aguarde..." : isRegister ? "Criar conta" : "Entrar"}
              </button>
            </form>

            <p className={styles.switch}>
              {isRegister ? "Já tem uma conta?" : "Ainda não tem conta?"}{" "}
              <button
                type="button"
                onClick={() => changeMode(isRegister ? "login" : "register")}
                disabled={submitting}
              >
                {isRegister ? "Entrar" : "Criar conta"}
              </button>
            </p>
          </div>

          <p className={styles.demo}>Projeto de demonstração: não envie extratos reais.</p>
        </section>
      </div>
    </main>
  );
}
