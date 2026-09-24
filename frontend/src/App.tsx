import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router";
import { FinanceDataProvider } from "./data/FinanceData";
import { FeedbackProvider } from "./feedback/Feedback";
import AppShell from "./layout/AppShell";
import CategoriesPage from "./pages/CategoriesPage";
import OverviewPage from "./pages/OverviewPage";
import ProfilePage from "./pages/ProfilePage";
import StatementsPage from "./pages/StatementsPage";
import TransactionsPage from "./pages/TransactionsPage";
import AuthPage from "./pages/AuthPage";
import { clearToken, getMe, getToken, setUnauthorizedHandler } from "./services/api";
import type { User } from "./types/user";

type AuthState =
  | { status: "loading" }
  | { status: "anonymous"; notice?: string }
  | { status: "authenticated"; user: User };

// Caminho do link do e-mail de "Esqueceu a senha?"
export const RESET_PASSWORD_PATH = "/redefinir-senha";

/** Código do link /redefinir-senha?token=... (só lê: quem limpa a URL é o efeito abaixo) */
function readResetToken(): string | null {
  if (window.location.pathname !== RESET_PASSWORD_PATH) return null;
  return new URLSearchParams(window.location.search).get("token") || null;
}

function AuthenticatedApp() {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });
  const [resetToken, setResetToken] = useState<string | null>(readResetToken);
  const navigate = useNavigate();

  // Tira o código da barra de endereço e do histórico: quem olhar a tela ou o
  // histórico depois não o vê. (Num efeito, e não ao ler: o StrictMode do
  // React lê o estado inicial duas vezes, e a segunda já não acharia o código.)
  useEffect(() => {
    if (resetToken && window.location.search) {
      window.history.replaceState(null, "", RESET_PASSWORD_PATH);
    }
  }, [resetToken]);

  useEffect(() => {
    // Qualquer 401 da API com o usuário logado (ex: token expirou) volta pro login
    setUnauthorizedHandler(() =>
      setAuth({ status: "anonymous", notice: "Sua sessão expirou. Entre novamente." })
    );

    // Se já existe um token salvo, confere se ainda vale antes de mostrar o app
    if (!getToken()) {
      setAuth({ status: "anonymous" });
    } else {
      getMe()
        .then((user) => setAuth({ status: "authenticated", user }))
        .catch(() => {
          clearToken();
          setAuth({ status: "anonymous" });
        });
    }

    return () => setUnauthorizedHandler(null);
  }, []);

  function authenticate(user: User) {
    setAuth({ status: "authenticated", user });
  }

  function handleLogout() {
    clearToken();
    setAuth({ status: "anonymous" });
  }

  // Link de senha nova: aparece mesmo com alguém logado neste navegador
  if (resetToken) {
    return (
      <AuthPage
        resetToken={resetToken}
        onAuthenticated={authenticate}
        onResetDone={() => {
          // As sessões antigas caíram na API; esta também
          clearToken();
          setResetToken(null);
          navigate("/", { replace: true });
          setAuth({ status: "anonymous", notice: "Senha redefinida. Entre com a senha nova." });
        }}
        onResetClosed={() => {
          setResetToken(null);
          navigate("/", { replace: true });
        }}
      />
    );
  }

  if (auth.status === "loading") {
    return (
      <p className="muted" style={{ padding: 24 }} role="status">
        Carregando...
      </p>
    );
  }

  if (auth.status === "anonymous") {
    return (
      <AuthPage
        notice={auth.notice}
        onAuthenticated={authenticate}
      />
    );
  }

  // key: trocar de usuário recria os dados (e avisos) do zero, sem nada do anterior
  return (
    <FeedbackProvider key={auth.user.id}>
      <FinanceDataProvider>
        <Routes>
          <Route element={<AppShell user={auth.user} onLogout={handleLogout} />}>
            <Route index element={<OverviewPage />} />
            <Route path="transacoes" element={<TransactionsPage />} />
            <Route path="categorias" element={<CategoriesPage />} />
            <Route path="extratos" element={<StatementsPage />} />
            <Route
              path="perfil"
              element={
                <ProfilePage
                  user={auth.user}
                  onUserChange={(user) => setAuth({ status: "authenticated", user })}
                  onAccountDeleted={() =>
                    setAuth({
                      status: "anonymous",
                      notice: "Sua conta foi excluída, junto com todos os seus dados.",
                    })
                  }
                />
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </FinanceDataProvider>
    </FeedbackProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthenticatedApp />
    </BrowserRouter>
  );
}
