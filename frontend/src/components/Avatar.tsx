import { initials } from "../utils/avatar";
import styles from "./Avatar.module.css";

interface Props {
  name: string | null;
  email: string;
  // data URL da foto; sem ela, mostra as iniciais
  src: string | null;
  size?: "sm" | "lg";
  className?: string;
}

/** Foto redonda do usuário, ou as iniciais do nome quando não há foto. */
export default function Avatar({ name, email, src, size = "sm", className = "" }: Props) {
  return (
    <span className={`${styles.avatar} ${styles[size]} ${className}`} aria-hidden="true">
      {src ? <img src={src} alt="" /> : initials(name, email)}
    </span>
  );
}
