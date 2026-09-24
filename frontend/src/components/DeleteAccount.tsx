import { useState, type FormEvent } from "react";
import { apiErrorMessage, deleteAccount } from "../services/api";
import Icon from "./Icon";
import { PasswordField } from "./PasswordInputs";
import styles from "./DeleteAccount.module.css";

interface Props {
  // Chamado depois que a API excluiu a conta (o token já foi apagado)
  onDeleted: () => void;
}

/**
 * Cartão "Excluir conta" do perfil. Em duas etapas, para ninguém excluir
 * sem querer: primeiro o botão, depois a senha e o "entendo que não tem volta".
 */
export default function DeleteAccount({ onDeleted }: Props) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  function close() {
    setOpen(false);
    setPassword("");
    setVisible(false);
    setUnderstood(false);
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setDeleting(true);
    try {
      await deleteAccount(password);
      onDeleted();
    } catch (err) {
      setError(apiErrorMessage(err, "Não foi possível excluir a conta. Tente de novo."));
      setDeleting(false);
    }
  }

  return (
    <section className={`card ${styles.card}`} aria-labelledby="excluir-titulo">
      <div className={styles.intro}>
        <h2 id="excluir-titulo" className="card-title">
          Excluir conta
        </h2>
        <p>Apaga sua conta e todos os seus dados da Vexira. Não dá para desfazer.</p>
      </div>

      <div className={styles.body}>
        {!open ? (
          <div>
            <p className={styles.lead}>
              Seus extratos, transações, categorias e foto serão apagados para sempre. Se quiser
              guardar alguma coisa, baixe o relatório em Excel antes.
            </p>
            <button className="btn btn-danger" type="button" onClick={() => setOpen(true)}>
              <Icon name="trash" />
              Excluir minha conta
            </button>
          </div>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit}>
            <div>
              <label className="label" htmlFor="excluir-senha">
                Sua senha
              </label>
              <PasswordField
                id="excluir-senha"
                inputClassName="field"
                value={password}
                onChange={setPassword}
                toggleLabel="Mostrar a senha"
                visible={visible}
                onToggle={() => setVisible(!visible)}
                autoComplete="current-password"
              />
            </div>

            <label className="checkbox">
              <input
                type="checkbox"
                checked={understood}
                onChange={(e) => setUnderstood(e.target.checked)}
              />
              Entendo que meus extratos, transações, categorias e foto serão apagados para sempre.
            </label>

            {error && (
              <div className="notice" role="alert">
                <Icon name="alert" />
                <span>{error}</span>
              </div>
            )}

            <div className={styles.actions}>
              <button className="btn btn-ghost" type="button" onClick={close} disabled={deleting}>
                Cancelar
              </button>
              <button
                className="btn btn-danger"
                type="submit"
                disabled={!understood || !password || deleting}
              >
                {deleting && <span className="spinner" aria-hidden="true" />}
                {deleting ? "Excluindo..." : "Excluir conta definitivamente"}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
