import { useState } from "react";
import { apiErrorMessage, getMe, login, register } from "../services/api";
import type { User } from "../types/user";
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

export default function AuthPage({ onAuthenticated, notice }: Props) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
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
          <div className={styles.brand}>
            <span className={styles.mark} aria-hidden="true">
              V
            </span>
            <span>Vexira</span>
          </div>

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
              <input
                id="auth-password"
                className={styles.field}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isRegister ? "Mínimo 8 caracteres" : "Digite sua senha"}
                autoComplete={isRegister ? "new-password" : "current-password"}
                minLength={isRegister ? 8 : undefined}
                aria-describedby={isRegister ? "auth-password-hint" : undefined}
                required
              />
              {isRegister && (
                <p id="auth-password-hint" className={styles.hint}>
                  Mínimo 8 caracteres
                </p>
              )}

              {isRegister && (
                <>
                  <label className={styles.label} htmlFor="auth-password-confirm">
                    Repetir senha
                  </label>
                  <input
                    id="auth-password-confirm"
                    className={styles.field}
                    type="password"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    placeholder="Digite a senha novamente"
                    autoComplete="new-password"
                    required
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
