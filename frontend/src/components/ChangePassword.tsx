import { useState, type FormEvent } from "react";
import { useFeedback } from "../feedback/Feedback";
import { apiErrorMessage, changePassword } from "../services/api";
import { weakPasswordMessage } from "../utils/passwordStrength";
import Icon from "./Icon";
import { PasswordField, PasswordMatch, PasswordStrengthMeter } from "./PasswordInputs";
import styles from "./ChangePassword.module.css";

interface Props {
  // A senha não pode conter o e-mail (mesma regra do cadastro)
  email: string;
}

/** Cartão "Alterar senha" da tela de perfil: formulário à parte do perfil. */
export default function ChangePassword({ email }: Props) {
  const { toast } = useFeedback();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState({ current: false, next: false, confirm: false });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggle(field: keyof typeof visible) {
    setVisible({ ...visible, [field]: !visible[field] });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // Os mesmos avisos do cadastro, antes de ir para a API
    const weakMessage = weakPasswordMessage(next, email);
    if (weakMessage) {
      setError(weakMessage);
      return;
    }
    if (next !== confirm) {
      setError("As senhas não conferem.");
      return;
    }
    if (next === current) {
      setError("A nova senha precisa ser diferente da atual.");
      return;
    }

    setSaving(true);
    try {
      await changePassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      setVisible({ current: false, next: false, confirm: false });
      toast.success("Senha alterada. Os outros aparelhos precisarão entrar de novo.");
    } catch (err) {
      setError(apiErrorMessage(err, "Não foi possível alterar a senha. Tente de novo."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={`card ${styles.card}`} onSubmit={handleSubmit} aria-labelledby="senha-titulo">
      <div className={styles.intro}>
        <h2 id="senha-titulo" className="card-title">
          Alterar senha
        </h2>
        <p>Ao trocar, as sessões abertas em outros aparelhos são encerradas.</p>
      </div>

      <div className={styles.fields}>
        <div>
          <label className="label" htmlFor="senha-atual">
            Senha atual
          </label>
          <PasswordField
            id="senha-atual"
            inputClassName="field"
            value={current}
            onChange={setCurrent}
            toggleLabel="Mostrar a senha atual"
            visible={visible.current}
            onToggle={() => toggle("current")}
            autoComplete="current-password"
          />
        </div>

        <div>
          <label className="label" htmlFor="senha-nova">
            Nova senha
          </label>
          <PasswordField
            id="senha-nova"
            inputClassName="field"
            value={next}
            onChange={setNext}
            toggleLabel="Mostrar a nova senha"
            visible={visible.next}
            onToggle={() => toggle("next")}
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
            minLength={8}
            describedBy="senha-nova-strength senha-nova-requirements"
          />
          <PasswordStrengthMeter password={next} email={email} idPrefix="senha-nova" />
        </div>

        <div>
          <label className="label" htmlFor="senha-repetir">
            Repetir nova senha
          </label>
          <PasswordField
            id="senha-repetir"
            inputClassName="field"
            value={confirm}
            onChange={setConfirm}
            toggleLabel="Mostrar a nova senha repetida"
            visible={visible.confirm}
            onToggle={() => toggle("confirm")}
            autoComplete="new-password"
            describedBy="senha-repetir-match"
          />
          <PasswordMatch password={next} confirm={confirm} id="senha-repetir-match" />
        </div>

        {error && (
          <div className="notice" role="alert">
            <Icon name="alert" />
            <span>{error}</span>
          </div>
        )}

        <div className={styles.actions}>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving && <span className="spinner" aria-hidden="true" />}
            {saving ? "Alterando..." : "Alterar senha"}
          </button>
        </div>
      </div>
    </form>
  );
}
