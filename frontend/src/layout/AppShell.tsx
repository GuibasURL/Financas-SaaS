import { NavLink, Outlet } from "react-router";
import Avatar from "../components/Avatar";
import Icon, { type IconName } from "../components/Icon";
import Logo from "../components/Logo";
import { useFeedback } from "../feedback/Feedback";
import type { User } from "../types/user";
import styles from "./AppShell.module.css";

export const NAV_ITEMS: { to: string; label: string; icon: IconName }[] = [
  { to: "/", label: "Visão geral", icon: "overview" },
  { to: "/transacoes", label: "Transações", icon: "list" },
  { to: "/categorias", label: "Categorias", icon: "tag" },
  { to: "/extratos", label: "Extratos", icon: "file" },
];

interface Props {
  user: User;
  onLogout: () => void;
}

function Brand() {
  return (
    <Logo className={styles.brand} markClassName={styles.brandMark} nameClassName={styles.brandName} />
  );
}

export default function AppShell({ user, onLogout }: Props) {
  const { confirm } = useFeedback();

  async function confirmLogout() {
    const confirmed = await confirm({
      title: "Sair da conta?",
      message: "Para voltar, você vai precisar entrar de novo com seu e-mail e senha.",
      confirmLabel: "Sair",
      busyLabel: "Saindo...",
      // Sair não chama a API: só apaga o token depois de confirmar
      action: async () => {},
    });
    if (confirmed) onLogout();
  }

  return (
    <div className={styles.app}>
      <aside className={styles.side} aria-label="Navegação principal">
        <Brand />
        <nav>
          <ul className={styles.nav}>
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                {/* end: "/" só fica ativo na própria Visão geral */}
                <NavLink to={item.to} end>
                  <Icon name={item.icon} />
                  {item.label}
                </NavLink>
              </li>
            ))}
            {/* No celular o rodapé do menu some: o perfil vira mais um item da barra */}
            <li className={styles.mobileOnly}>
              <NavLink to="/perfil">
                <Icon name="user" />
                Perfil
              </NavLink>
            </li>
          </ul>
        </nav>
        <div className={styles.sideFoot}>
          <NavLink to="/perfil" className={styles.profile} title={user.email}>
            <Avatar name={user.name} email={user.email} src={user.avatar_url} />
            <span className={styles.profileText}>
              <span className={styles.user}>{user.name ?? user.email}</span>
              <span>Meu perfil</span>
            </span>
          </NavLink>
          <button className="btn" type="button" onClick={confirmLogout}>
            <Icon name="logout" />
            Sair
          </button>
        </div>
      </aside>

      <main className={styles.main}>
        <div className={styles.mobileTop}>
          <Brand />
          <button
            className="btn btn-ghost"
            type="button"
            onClick={confirmLogout}
            aria-label={`Sair (${user.email})`}
          >
            <Icon name="logout" />
            Sair
          </button>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
