import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { FinanceDataProvider } from "./data/FinanceData";
import AppShell from "./layout/AppShell";
import CategoriesPage from "./pages/CategoriesPage";
import OverviewPage from "./pages/OverviewPage";
import StatementsPage from "./pages/StatementsPage";
import TransactionsPage from "./pages/TransactionsPage";
import AuthPage from "./pages/AuthPage";
import { clearToken, getMe, getToken, setUnauthorizedHandler } from "./services/api";
import type { User } from "./types/user";

type AuthState =
  | { status: "loading" }
  | { status: "anonymous"; notice?: string }
  | { status: "authenticated"; user: User };

function AuthenticatedApp() {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });

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

  function handleLogout() {
    clearToken();
    setAuth({ status: "anonymous" });
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
        onAuthenticated={(user) => setAuth({ status: "authenticated", user })}
      />
    );
  }

  // key: trocar de usuário recria os dados do zero, sem nada do anterior
  return (
    <FinanceDataProvider key={auth.user.id}>
      <Routes>
        <Route element={<AppShell user={auth.user} onLogout={handleLogout} />}>
          <Route index element={<OverviewPage />} />
          <Route path="transacoes" element={<TransactionsPage />} />
          <Route path="categorias" element={<CategoriesPage />} />
          <Route path="extratos" element={<StatementsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </FinanceDataProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthenticatedApp />
    </BrowserRouter>
  );
}
