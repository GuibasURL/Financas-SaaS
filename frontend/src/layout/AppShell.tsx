import { NavLink, Outlet } from "react-router";
import Icon, { type IconName } from "../components/Icon";
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
    <div className={styles.brand}>
      <b aria-hidden="true">F</b>Finanças SaaS
    </div>
  );
}

export default function AppShell({ user, onLogout }: Props) {
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
          </ul>
        </nav>
        <div className={styles.sideFoot}>
          <span>Conectado como</span>
          <span className={styles.user} title={user.email}>
            {user.email}
          </span>
          <button className="btn" type="button" onClick={onLogout}>
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
            onClick={onLogout}
            aria-label={`Sair (${user.email})`}
          >
            <Icon name="logout" />
            Sair
          </button>
        </div>
        <Outlet />
        <p className="demo-note">Projeto de demonstração: não envie extratos reais.</p>
      </main>
    </div>
  );
}
