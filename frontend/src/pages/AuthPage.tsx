import { useState } from "react";
import { apiErrorMessage, getMe, login, register } from "../services/api";
import type { User } from "../types/user";

interface Props {
  onAuthenticated: (user: User) => void;
  // Mensagem mostrada acima do formulário (ex: sessão expirada)
  notice?: string | null;
}

type Mode = "login" | "register";

export default function AuthPage({ onAuthenticated, notice }: Props) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isRegister = mode === "register";

  function switchMode() {
    setMode(isRegister ? "login" : "register");
    setError(null);
    setPassword("");
    setPasswordConfirm("");
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
    <div style={{ maxWidth: 360, margin: "80px auto", padding: 24 }}>
      <h1>Finanças SaaS</h1>
      <h2>{isRegister ? "Criar conta" : "Entrar"}</h2>

      {notice && <p style={{ color: "#b45309" }}>{notice}</p>}

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 4 }}>
          E-mail
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>

        <label style={{ display: "grid", gap: 4 }}>
          Senha
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isRegister ? "new-password" : "current-password"}
            minLength={isRegister ? 8 : undefined}
            required
          />
        </label>

        {isRegister && (
          <label style={{ display: "grid", gap: 4 }}>
            Repita a senha
            <input
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              autoComplete="new-password"
              required
            />
          </label>
        )}

        {error && <p style={{ color: "red", margin: 0 }}>{error}</p>}

        <button type="submit" disabled={submitting}>
          {submitting ? "Aguarde..." : isRegister ? "Criar conta" : "Entrar"}
        </button>
      </form>

      <p>
        {isRegister ? "Já tem conta?" : "Ainda não tem conta?"}{" "}
        <button type="button" onClick={switchMode} disabled={submitting}>
          {isRegister ? "Entrar" : "Criar conta"}
        </button>
      </p>
    </div>
  );
}
