import { useEffect, useState } from "react";
import Dashboard from "./pages/Dashboard";
import AuthPage from "./pages/AuthPage";
import { clearToken, getMe, getToken, setUnauthorizedHandler } from "./services/api";
import type { User } from "./types/user";

type AuthState =
  | { status: "loading" }
  | { status: "anonymous"; notice?: string }
  | { status: "authenticated"; user: User };

export default function App() {
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
    return <p style={{ padding: 24 }}>Carregando...</p>;
  }

  if (auth.status === "anonymous") {
    return (
      <AuthPage
        notice={auth.notice}
        onAuthenticated={(user) => setAuth({ status: "authenticated", user })}
      />
    );
  }

  // key: trocar de usuário recria o Dashboard do zero, sem dados do anterior
  return <Dashboard key={auth.user.id} user={auth.user} onLogout={handleLogout} />;
}
