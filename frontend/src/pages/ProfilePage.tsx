import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Avatar from "../components/Avatar";
import ChangePassword from "../components/ChangePassword";
import DeleteAccount from "../components/DeleteAccount";
import Icon from "../components/Icon";
import { useFeedback } from "../feedback/Feedback";
import { apiErrorMessage, deleteAvatar, updateProfile, uploadAvatar } from "../services/api";
import type { User } from "../types/user";
import { usePageTitle } from "../utils/pageTitle";
import {
  AVATAR_MAX_BYTES,
  AVATAR_TYPES,
  readAsDataURL,
  shrinkImage,
} from "../utils/avatar";
import styles from "./ProfilePage.module.css";

interface Props {
  user: User;
  // Avisa o App do usuário atualizado (menu lateral, próximas telas)
  onUserChange: (user: User) => void;
  // Conta excluída: o App volta para a tela de entrada
  onAccountDeleted: () => void;
}

// A foto só vai para a API ao salvar: até lá é uma prévia
type PhotoChange =
  | { kind: "keep" }
  | { kind: "new"; blob: Blob; preview: string }
  | { kind: "remove" };

interface FormState {
  name: string;
  email: string;
  birthDate: string;
}

function formFromUser(user: User): FormState {
  return { name: user.name ?? "", email: user.email, birthDate: user.birth_date ?? "" };
}

// Hoje no fuso do navegador, no formato do <input type="date">
function todayISO(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export default function ProfilePage({ user, onUserChange, onAccountDeleted }: Props) {
  const { toast } = useFeedback();
  usePageTitle("Perfil");
  const [form, setForm] = useState<FormState>(() => formFromUser(user));
  const [photo, setPhoto] = useState<PhotoChange>({ kind: "keep" });
  const [currentPassword, setCurrentPassword] = useState("");
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const saved = formFromUser(user);
  const emailChanged = form.email.trim().toLowerCase() !== user.email;
  const dataChanged =
    form.name !== saved.name || emailChanged || form.birthDate !== saved.birthDate;
  const dirty = dataChanged || photo.kind !== "keep";

  const shownPhoto =
    photo.kind === "new" ? photo.preview : photo.kind === "remove" ? null : user.avatar_url;

  function setField(field: keyof FormState) {
    return (e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, [field]: e.target.value });
  }

  async function handlePhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Limpa o campo: escolher o mesmo arquivo de novo também dispara o onChange
    e.target.value = "";
    if (!file) return;
    setPhotoError(null);
    if (!AVATAR_TYPES.includes(file.type)) {
      setPhotoError("Escolha uma foto em JPG, PNG ou WebP.");
      return;
    }
    const blob = await shrinkImage(file);
    if (blob.size > AVATAR_MAX_BYTES) {
      setPhotoError("A foto pode ter no máximo 1 MB.");
      return;
    }
    setPhoto({ kind: "new", blob, preview: await readAsDataURL(blob) });
  }

  function cancel() {
    setForm(formFromUser(user));
    setPhoto({ kind: "keep" });
    setCurrentPassword("");
    setPhotoError(null);
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    let updated = user;
    try {
      // Dados primeiro: é onde a API mais recusa (senha errada, e-mail em uso)
      if (dataChanged) {
        updated = await updateProfile({
          name: form.name,
          email: form.email,
          birth_date: form.birthDate || null,
          ...(emailChanged ? { current_password: currentPassword } : {}),
        });
      }
      if (photo.kind === "new") updated = await uploadAvatar(photo.blob);
      if (photo.kind === "remove") updated = await deleteAvatar();

      onUserChange(updated);
      setForm(formFromUser(updated));
      setPhoto({ kind: "keep" });
      setCurrentPassword("");
      toast.success("Perfil atualizado.");
    } catch (err) {
      // Se os dados salvaram e só a foto falhou, o resto da tela já reflete isso
      if (updated !== user) onUserChange(updated);
      setError(apiErrorMessage(err, "Não foi possível salvar o perfil. Tente de novo."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <header className={styles.top}>
        <p className="eyebrow">Conta e preferências</p>
        <h1 className="page-title">Editar perfil</h1>
        <p className="muted">Mantenha seus dados pessoais atualizados.</p>
      </header>

      <form className={`card ${styles.card}`} onSubmit={handleSubmit}>
        <section className={styles.section} aria-labelledby="perfil-foto">
          <div className={styles.intro}>
            <h2 id="perfil-foto" className="card-title">
              Foto do perfil
            </h2>
            <p>Uma foto nítida em JPG, PNG ou WebP. Ela é recortada em círculo.</p>
          </div>
          <div className={styles.photoRow}>
            <div className={styles.preview}>
              <Avatar name={form.name || null} email={user.email} src={shownPhoto} size="lg" />
              <span className={styles.previewBadge} aria-hidden="true">
                <Icon name="camera" />
              </span>
            </div>
            <div className={styles.photoActions}>
              <input
                ref={fileInput}
                className={styles.fileInput}
                type="file"
                accept={AVATAR_TYPES.join(",")}
                onChange={handlePhoto}
                aria-label="Escolher foto do perfil"
                tabIndex={-1}
              />
              <button className="btn" type="button" onClick={() => fileInput.current?.click()}>
                <Icon name="camera" />
                {shownPhoto ? "Trocar foto" : "Escolher foto"}
              </button>
              <button
                className="btn btn-ghost"
                type="button"
                disabled={!shownPhoto}
                onClick={() => {
                  setPhotoError(null);
                  // Sem foto salva, basta descartar a escolhida; com foto, apaga ao salvar
                  setPhoto(user.avatar_url ? { kind: "remove" } : { kind: "keep" });
                }}
              >
                <Icon name="trash" />
                Remover
              </button>
              {photo.kind !== "keep" && (
                <p className={styles.hint} role="status">
                  {photo.kind === "new"
                    ? "A foto nova entra quando você salvar."
                    : "A foto sai quando você salvar."}
                </p>
              )}
              {photoError && (
                <p className={styles.fieldError} role="alert">
                  {photoError}
                </p>
              )}
            </div>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="perfil-dados">
          <div className={styles.intro}>
            <h2 id="perfil-dados" className="card-title">
              Dados pessoais
            </h2>
            <p>Essas informações identificam sua conta.</p>
          </div>
          <div className={styles.fields}>
            <div>
              <label className="label" htmlFor="perfil-nome">
                Nome completo
              </label>
              <input
                id="perfil-nome"
                className="field"
                value={form.name}
                onChange={setField("name")}
                autoComplete="name"
                required
                minLength={2}
                maxLength={100}
              />
            </div>
            <div>
              <label className="label" htmlFor="perfil-email">
                E-mail
              </label>
              <input
                id="perfil-email"
                className="field"
                type="email"
                value={form.email}
                onChange={setField("email")}
                autoComplete="email"
                required
                aria-describedby="perfil-email-dica"
              />
              <p id="perfil-email-dica" className={styles.hint}>
                É com ele que você entra na Vexira.
              </p>
            </div>
            {emailChanged && (
              <div>
                <label className="label" htmlFor="perfil-senha">
                  Senha atual
                </label>
                <input
                  id="perfil-senha"
                  className="field"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  aria-describedby="perfil-senha-dica"
                />
                <p id="perfil-senha-dica" className={styles.hint}>
                  Para trocar o e-mail, confirme que é você.
                </p>
              </div>
            )}
            <div className={styles.dateField}>
              <label className="label" htmlFor="perfil-nascimento">
                Data de nascimento <span className="muted">(opcional)</span>
              </label>
              <input
                id="perfil-nascimento"
                className="field"
                type="date"
                value={form.birthDate}
                onChange={setField("birthDate")}
                min="1900-01-01"
                max={todayISO()}
              />
            </div>
          </div>
        </section>

        {error && (
          <div className={`notice ${styles.error}`} role="alert">
            <Icon name="alert" />
            <span>{error}</span>
          </div>
        )}

        <footer className={styles.footer}>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={cancel}
            disabled={!dirty || saving}
          >
            Cancelar
          </button>
          <button className="btn btn-primary" type="submit" disabled={!dirty || saving}>
            {saving && <span className="spinner" aria-hidden="true" />}
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>
        </footer>
      </form>

      <ChangePassword email={user.email} />
      <DeleteAccount onDeleted={onAccountDeleted} />
    </>
  );
}
