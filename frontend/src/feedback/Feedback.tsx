/**
 * Janela de confirmação e avisos flutuantes (toasts) do app, no lugar do
 * confirm()/alert() do navegador.
 *
 *   const { confirm, toast } = useFeedback();
 *   const done = await confirm({ title, message, confirmLabel, action: () => apagar() });
 *   toast.success("Extrato excluído.");
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import Icon from "../components/Icon";
import styles from "./Feedback.module.css";

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  // Texto do botão enquanto a ação roda (padrão: "Excluindo...")
  busyLabel?: string;
  // Roda com a janela aberta, mostrando o botão ocupado. Se falhar, a
  // janela fecha e o confirm() rejeita com o erro.
  action: () => Promise<unknown>;
}

type ToastKind = "success" | "error";

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface Feedback {
  /** true se o usuário confirmou e a ação terminou; false se cancelou */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  toast: {
    /** Some sozinho depois de alguns segundos */
    success: (message: string) => void;
    /** Fica até o usuário fechar */
    error: (message: string) => void;
  };
}

// Tempo que o aviso de sucesso fica na tela
export const TOAST_DURATION_MS = 4000;

const FeedbackContext = createContext<Feedback | null>(null);

export function useFeedback(): Feedback {
  const feedback = useContext(FeedbackContext);
  if (!feedback) throw new Error("useFeedback precisa estar dentro de <FeedbackProvider>");
  return feedback;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
  reject: (error: unknown) => void;
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, kind, message }]);
      if (kind === "success") {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), TOAST_DURATION_MS)
        );
      }
    },
    [dismiss]
  );

  // Sem avisos pendurados depois que o app desmonta (ex: logout)
  useEffect(() => {
    const pendingTimers = timers.current;
    return () => pendingTimers.forEach(clearTimeout);
  }, []);

  const feedback = useMemo<Feedback>(
    () => ({
      confirm: (options) =>
        new Promise<boolean>((resolve, reject) => setPending({ ...options, resolve, reject })),
      toast: {
        success: (message) => show("success", message),
        error: (message) => show("error", message),
      },
    }),
    [show]
  );

  return (
    <FeedbackContext.Provider value={feedback}>
      {children}
      {pending && <ConfirmDialog request={pending} onClose={() => setPending(null)} />}

      {/* Região sempre presente: o leitor de tela anuncia o que entrar nela */}
      <div className={styles.toasts} aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`${styles.toast} ${t.kind === "error" ? styles.error : styles.success}`}
            role={t.kind === "error" ? "alert" : undefined}
          >
            <Icon name={t.kind === "error" ? "alert" : "check"} />
            <p>{t.message}</p>
            <button
              type="button"
              className={styles.close}
              onClick={() => dismiss(t.id)}
              aria-label="Fechar aviso"
            >
              <Icon name="close" />
            </button>
          </div>
        ))}
      </div>
    </FeedbackContext.Provider>
  );
}

const FOCUSABLE = "button:not(:disabled), [href], input:not(:disabled), select, textarea";

function ConfirmDialog({ request, onClose }: { request: PendingConfirm; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Cancelar é o padrão seguro: recebe o foco ao abrir. Ao fechar, o foco
  // volta para quem abriu a janela (se ele ainda existir).
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    return () => opener?.focus?.();
  }, []);

  const cancel = useCallback(() => {
    if (busy) return;
    onClose();
    request.resolve(false);
  }, [busy, onClose, request]);

  async function handleConfirm() {
    setBusy(true);
    try {
      await request.action();
    } catch (err) {
      onClose();
      request.reject(err);
      return;
    }
    onClose();
    request.resolve(true);
  }

  // Esc cancela; Tab fica preso dentro da janela
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        cancel();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [cancel]);

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(e) => {
        // Clique fora do cartão cancela
        if (e.target === e.currentTarget) cancel();
      }}
    >
      <div
        ref={dialogRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
      >
        <h2 id="confirm-title">{request.title}</h2>
        <p id="confirm-message">{request.message}</p>
        <div className={styles.actions}>
          <button ref={cancelRef} type="button" className="btn btn-ghost" onClick={cancel} disabled={busy}>
            Cancelar
          </button>
          <button type="button" className="btn btn-danger" onClick={handleConfirm} disabled={busy}>
            {busy && <span className="spinner" aria-hidden="true" />}
            {busy ? (request.busyLabel ?? "Excluindo...") : request.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
