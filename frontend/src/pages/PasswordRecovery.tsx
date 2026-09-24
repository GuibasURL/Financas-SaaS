/**
 * "Esqueceu a senha?": pedir o link por e-mail e criar a senha nova pelo
 * link. Aparecem no cartão da tela de acesso, no lugar do login.
 */
import { useState, type FormEvent } from "react";
import { PasswordField, PasswordMatch, PasswordStrengthMeter } from "../components/PasswordInputs";
import { apiErrorMessage, forgotPassword, resetPassword } from "../services/api";
import { weakPasswordMessage } from "../utils/passwordStrength";
import styles from "./AuthPage.module.css";

function Heading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <div className={styles.heading}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h2>{title}</h2>
      <p>{subtitle}</p>
    </div>
  );
}

interface ForgotProps {
  // E-mail já digitado no login, para não digitar de novo
  initialEmail: string;
  onBack: () => void;
}

export function ForgotPasswordForm({ initialEmail, onBack }: ForgotProps) {
  const [email, setEmail] = useState(initialEmail);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      setSent(await forgotPassword(email));
    } catch (err) {
      setError(apiErrorMessage(err, "Não foi possível enviar o link. Tente de novo."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Heading
        eyebrow="Recuperar acesso"
        title="Esqueceu a senha?"
        subtitle="Informe o e-mail da sua conta e enviaremos um link para criar uma senha nova."
      />

      {sent ? (
        <>
          <p className={`${styles.notice} ${styles.success}`} role="status">
            {sent} O link vale por 30 minutos.
          </p>
          <button className={styles.submit} type="button" onClick={onBack}>
            Voltar para o login
          </button>
        </>
      ) : (
        <>
          {error && (
            <p className={`${styles.notice} ${styles.error}`} role="alert">
              {error}
            </p>
          )}
          <form onSubmit={handleSubmit}>
            <label className={styles.label} htmlFor="forgot-email">
              E-mail
            </label>
            <input
              id="forgot-email"
              className={styles.field}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
              autoComplete="email"
              required
            />
            <button className={styles.submit} type="submit" disabled={submitting}>
              {submitting ? "Enviando..." : "Enviar link"}
            </button>
          </form>
          <p className={styles.switch}>
            Lembrou a senha?{" "}
            <button type="button" onClick={onBack} disabled={submitting}>
              Voltar para o login
            </button>
          </p>
        </>
      )}
    </div>
  );
}

interface ResetProps {
  token: string;
  onDone: () => void;
  onRequestNewLink: () => void;
  onBack: () => void;
}

export function ResetPasswordForm({ token, onDone, onRequestNewLink, onBack }: ResetProps) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState({ password: false, confirm: false });
  const [error, setError] = useState<string | null>(null);
  const [invalidLink, setInvalidLink] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setVisible({ password: false, confirm: false });

    // O e-mail não é conhecido aqui: a regra "não conter o e-mail" o backend confere
    const weakMessage = weakPasswordMessage(password);
    if (weakMessage) {
      setError(weakMessage);
      return;
    }
    if (password !== confirm) {
      setError("As senhas não conferem.");
      return;
    }

    setSubmitting(true);
    try {
      await resetPassword(token, password);
      onDone();
    } catch (err) {
      const message = apiErrorMessage(err, "Não foi possível redefinir a senha. Tente de novo.");
      setInvalidLink(message.startsWith("Este link é inválido"));
      setError(message);
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Heading
        eyebrow="Recuperar acesso"
        title="Criar senha nova"
        subtitle="Escolha uma senha segura. Ao salvar, os aparelhos conectados à sua conta saem dela."
      />

      {error && (
        <p className={`${styles.notice} ${styles.error}`} role="alert">
          {error}
        </p>
      )}

      {invalidLink ? (
        <button className={styles.submit} type="button" onClick={onRequestNewLink}>
          Pedir um novo link
        </button>
      ) : (
        <form onSubmit={handleSubmit}>
          <label className={styles.label} htmlFor="reset-password">
            Senha nova
          </label>
          <PasswordField
            id="reset-password"
            inputClassName={styles.field}
            value={password}
            onChange={setPassword}
            toggleLabel="Mostrar a senha nova"
            visible={visible.password}
            onToggle={() => setVisible({ ...visible, password: !visible.password })}
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
            minLength={8}
            describedBy="reset-strength reset-requirements"
          />
          <PasswordStrengthMeter password={password} email="" idPrefix="reset" />

          <label className={styles.label} htmlFor="reset-password-confirm">
            Repetir senha nova
          </label>
          <PasswordField
            id="reset-password-confirm"
            inputClassName={styles.field}
            value={confirm}
            onChange={setConfirm}
            toggleLabel="Mostrar a senha repetida"
            visible={visible.confirm}
            onToggle={() => setVisible({ ...visible, confirm: !visible.confirm })}
            placeholder="Digite a senha novamente"
            autoComplete="new-password"
            describedBy="reset-match"
          />
          <PasswordMatch password={password} confirm={confirm} id="reset-match" />

          <button className={styles.submit} type="submit" disabled={submitting}>
            {submitting ? "Salvando..." : "Salvar senha nova"}
          </button>
        </form>
      )}

      <p className={styles.switch}>
        <button type="button" onClick={onBack} disabled={submitting}>
          Voltar para o login
        </button>
      </p>
    </div>
  );
}
