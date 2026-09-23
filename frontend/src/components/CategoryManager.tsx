import { useState } from "react";
import { useFeedback } from "../feedback/Feedback";
import {
  addDefaultCategories,
  apiErrorMessage,
  applyCategoryRules,
  createCategory,
  deleteCategory,
  updateCategory,
} from "../services/api";
import type { Category } from "../types/transaction";
import { formatCount, formatSignedMoney } from "../utils/format";
import styles from "./CategoryManager.module.css";

export interface CategoryStats {
  count: number;
  // Soma dos valores (negativa para gastos, positiva para entradas)
  total: number;
}

interface Props {
  categories: Category[];
  // Chamado depois de qualquer mudança, para a página recarregar os dados
  onChanged: () => void;
  // Cor da categoria (a mesma dos gráficos); opcional
  categoryColor?: (id: number) => string;
  // Quantidade e soma das transações de cada categoria (por id); opcional
  stats?: Map<number, CategoryStats>;
}

const IGNORE_HINT =
  "Transações desta categoria continuam na lista, mas não entram nos gráficos nem nos totais. " +
  "Use para o que não é gasto de verdade: o pagamento da fatura do cartão (as compras " +
  "da fatura já são os gastos) ou transferências entre suas próprias contas.";

// "ifood,restaurante,-mercado pago" -> ["ifood", "restaurante", "-mercado pago"]
function splitKeywords(keywords: string) {
  return keywords
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

// Categorias com muitas palavras-chave mostram só as primeiras, com "+N" para ver o resto
const KEYWORD_PREVIEW = 6;

// Onde o erro aparece: no formulário de criar, no de editar ou no topo
type ErrorScope = "new" | "edit" | "top";

export default function CategoryManager({ categories, onChanged, categoryColor, stats }: Props) {
  const { confirm, toast } = useFeedback();
  const [newName, setNewName] = useState("");
  const [newKeywords, setNewKeywords] = useState("");
  const [newIgnore, setNewIgnore] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editKeywords, setEditKeywords] = useState("");
  const [editIgnore, setEditIgnore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ scope: ErrorScope; message: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Executa uma ação na API mostrando erro/mensagem e travando os botões
  async function run(
    action: () => Promise<string | void>,
    errorFallback: string,
    scope: ErrorScope
  ) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await action();
      if (result) setMessage(result);
      onChanged();
      return true;
    } catch (err) {
      setError({ scope, message: apiErrorMessage(err, errorFallback) });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const ok = await run(
      () =>
        createCategory({
          name: newName,
          keywords: newKeywords,
          ignore_in_reports: newIgnore,
        }).then(() => undefined),
      "Não foi possível criar a categoria.",
      "new"
    );
    if (ok) {
      setNewName("");
      setNewKeywords("");
      setNewIgnore(false);
      toast.success("Categoria criada.");
    }
  }

  function startEditing(category: Category) {
    setEditingId(category.id);
    setEditName(category.name);
    setEditKeywords(splitKeywords(category.keywords).join(", "));
    setEditIgnore(category.ignore_in_reports);
    setError(null);
    setMessage(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (editingId === null) return;
    const ok = await run(
      () =>
        updateCategory(editingId, {
          name: editName,
          keywords: editKeywords,
          ignore_in_reports: editIgnore,
        }).then(() => undefined),
      "Não foi possível salvar a categoria.",
      "edit"
    );
    if (ok) {
      setEditingId(null);
      toast.success("Categoria atualizada.");
    }
  }

  async function handleDelete(category: Category) {
    setError(null);
    setMessage(null);
    try {
      const deleted = await confirm({
        title: "Excluir categoria?",
        message:
          `A categoria "${category.name}" será excluída. As transações dela ficam sem ` +
          "categoria; nenhuma transação é apagada.",
        confirmLabel: "Excluir categoria",
        action: () => deleteCategory(category.id),
      });
      if (!deleted) return;
    } catch (err) {
      toast.error(apiErrorMessage(err, "Não foi possível excluir a categoria."));
      return;
    }
    toast.success("Categoria excluída.");
    onChanged();
  }

  async function handleAddDefaults() {
    await run(
      async () => {
        const count = await addDefaultCategories();
        return count === 0
          ? "Você já tem todas as categorias sugeridas."
          : `${count} categoria${count === 1 ? " sugerida adicionada" : "s sugeridas adicionadas"}. ` +
              'Use "Aplicar regras" para categorizar os extratos já importados.';
      },
      "Não foi possível adicionar as categorias sugeridas.",
      "top"
    );
  }

  async function handleApplyRules() {
    await run(
      async () => {
        const count = await applyCategoryRules();
        return count === 0
          ? "Nenhuma transação sem categoria bateu com as palavras-chave."
          : `${count} transaç${count === 1 ? "ão foi categorizada" : "ões foram categorizadas"}.`;
      },
      "Não foi possível aplicar as regras.",
      "top"
    );
  }

  const errorIn = (scope: ErrorScope) =>
    error?.scope === scope && (
      <p className={`notice ${styles.message}`} role="alert">
        {error.message}
      </p>
    );

  const categorizedCount = stats
    ? [...stats.values()].reduce((sum, s) => sum + s.count, 0)
    : null;

  return (
    <>
      <div className={styles.toolbar}>
        <p className={styles.ruleHelp}>
          <b>Aplicar regras</b> categoriza as transações que ainda estão sem categoria, usando as
          palavras-chave atuais. As que já têm categoria não mudam.
        </p>
        <div className={styles.toolbarActions}>
          <button
            className="btn"
            type="button"
            onClick={handleAddDefaults}
            disabled={busy}
            title="Alimentação, Mercado, Transporte, Saúde, Moradia, Assinaturas... Só cria as que você ainda não tem."
          >
            Adicionar categorias sugeridas
          </button>
          <button
            className="btn btn-primary"
            type="button"
            onClick={handleApplyRules}
            disabled={busy || categories.length === 0}
          >
            Aplicar regras
          </button>
        </div>
      </div>

      {errorIn("top")}
      {message && (
        <p className={`notice notice-success ${styles.message}`} role="status">
          {message}
        </p>
      )}

      <div className={styles.layout}>
        <section className={`card ${styles.listCard}`} aria-labelledby="categories-title">
          <div className="card-head">
            <div>
              <h2 className="card-title" id="categories-title">
                Suas categorias
              </h2>
              <p>
                {formatCount(categories.length, "categoria", "categorias")}
                {categorizedCount !== null &&
                  ` · ${formatCount(categorizedCount, "transação categorizada", "transações categorizadas")}`}
              </p>
            </div>
          </div>

          {categories.length === 0 ? (
            <div className="empty">
              <strong>Nenhuma categoria ainda</strong>
              <p>Crie uma em "Nova categoria" ou use "Adicionar categorias sugeridas".</p>
            </div>
          ) : (
            <ul className={styles.list}>
              {categories.map((c) => (
                <li key={c.id} className={styles.row}>
                  {c.id === editingId ? (
                    <form
                      className={styles.editForm}
                      onSubmit={handleSave}
                      aria-label={`Editar ${c.name}`}
                    >
                      <div>
                        <label className="label" htmlFor={`edit-name-${c.id}`}>
                          Nome
                        </label>
                        <input
                          id={`edit-name-${c.id}`}
                          className="field"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <label className="label" htmlFor={`edit-keywords-${c.id}`}>
                          Palavras-chave
                        </label>
                        <KeywordsField
                          id={`edit-keywords-${c.id}`}
                          value={editKeywords}
                          onChange={setEditKeywords}
                          placeholder="ifood, restaurante"
                        />
                      </div>
                      <label className={`checkbox ${styles.full}`} title={IGNORE_HINT}>
                        <input
                          type="checkbox"
                          checked={editIgnore}
                          onChange={(e) => setEditIgnore(e.target.checked)}
                        />
                        Ignorar nos gráficos
                      </label>
                      {errorIn("edit")}
                      <div className={`${styles.rowActions} ${styles.full}`}>
                        <button className="btn btn-primary" type="submit" disabled={busy}>
                          Salvar
                        </button>
                        <button
                          className="btn btn-ghost"
                          type="button"
                          onClick={() => setEditingId(null)}
                          disabled={busy}
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>
                  ) : (
                    <CategoryRow
                      category={c}
                      color={categoryColor?.(c.id)}
                      stats={stats && (stats.get(c.id) ?? { count: 0, total: 0 })}
                      busy={busy}
                      onEdit={() => startEditing(c)}
                      onDelete={() => handleDelete(c)}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={`card ${styles.formCard}`} aria-labelledby="new-category-title">
          <div className="card-head">
            <div>
              <h2 className="card-title" id="new-category-title">
                Nova categoria
              </h2>
              <p>A cor é definida automaticamente.</p>
            </div>
          </div>
          <form className={styles.newForm} onSubmit={handleCreate}>
            <div>
              <label className="label" htmlFor="new-category-name">
                Nome
              </label>
              <input
                id="new-category-name"
                className="field"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="new-category-keywords">
                Palavras-chave
              </label>
              <KeywordsField
                id="new-category-keywords"
                value={newKeywords}
                onChange={setNewKeywords}
                placeholder="mercado, -mercado pago"
                describedBy="keywords-help"
              />
              <ul className={styles.help} id="keywords-help">
                <li>Separe por vírgula.</li>
                <li>Não diferencia maiúsculas nem acentos.</li>
                <li>
                  A palavra precisa estar no começo de uma palavra da descrição: "posto" não pega
                  "IMPOSTO".
                </li>
                <li>
                  Use "-" na frente para excluir: <code>mercado, -mercado pago</code>.
                </li>
                <li>Se duas categorias baterem, vale a criada primeiro.</li>
              </ul>
            </div>
            <div>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={newIgnore}
                  onChange={(e) => setNewIgnore(e.target.checked)}
                  aria-describedby="ignore-help"
                />
                Ignorar nos gráficos
              </label>
              <p className={styles.checkboxHelp} id="ignore-help">
                {IGNORE_HINT}
              </p>
            </div>
            {errorIn("new")}
            <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
              Criar categoria
            </button>
          </form>
        </section>
      </div>
    </>
  );
}

interface KeywordsFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  describedBy?: string;
}

// Várias linhas para caber listas longas; Enter salva (como num campo normal)
// e quebra de linha colada vira vírgula, que é o separador das palavras-chave
function KeywordsField({ id, value, onChange, placeholder, describedBy }: KeywordsFieldProps) {
  return (
    <textarea
      id={id}
      className={`field ${styles.textarea}`}
      rows={2}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\s*\n\s*/g, ", "))}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.form?.requestSubmit();
        }
      }}
      placeholder={placeholder}
      aria-describedby={describedBy}
    />
  );
}

interface RowProps {
  category: Category;
  color?: string;
  stats?: CategoryStats;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

function CategoryRow({ category, color, stats, busy, onEdit, onDelete }: RowProps) {
  const [showAll, setShowAll] = useState(false);
  const keywords = splitKeywords(category.keywords);
  const hidden = keywords.length - KEYWORD_PREVIEW;
  const visible = showAll || hidden <= 0 ? keywords : keywords.slice(0, KEYWORD_PREVIEW);

  return (
    <>
      <div className={styles.name}>
        {color && <i className={styles.dot} style={{ background: color }} aria-hidden="true" />}
        <span>{category.name}</span>
        {category.ignore_in_reports && (
          <span className="badge badge-warning" title={IGNORE_HINT}>
            ignorada nos gráficos
          </span>
        )}
      </div>

      {keywords.length > 0 ? (
        <div className={styles.keywordsCell}>
          <ul className={styles.keywords} aria-label={`Palavras-chave de ${category.name}`}>
            {visible.map((k) => (
              <li
                key={k}
                className={`${styles.keyword} ${k.startsWith("-") ? styles.exclude : ""}`}
                title={k.startsWith("-") ? `Exclui descrições com "${k.slice(1)}"` : undefined}
              >
                {k}
              </li>
            ))}
          </ul>
          {hidden > 0 && (
            <button
              type="button"
              className={styles.more}
              onClick={() => setShowAll(!showAll)}
              aria-expanded={showAll}
              aria-label={
                showAll
                  ? `Mostrar menos palavras-chave de ${category.name}`
                  : `Mostrar mais ${hidden} palavras-chave de ${category.name}`
              }
            >
              {showAll ? "mostrar menos" : `+${hidden}`}
            </button>
          )}
        </div>
      ) : (
        <span className={`muted ${styles.keywordsCell} ${styles.keywordsEmpty}`}>
          nenhuma palavra-chave
        </span>
      )}

      {stats && (
        <div className={styles.meta}>
          {formatCount(stats.count, "transação", "transações")}
          {stats.count > 0 && (
            <span className={`amount ${styles.total} ${stats.total > 0 ? "in" : ""}`}>
              {formatSignedMoney(stats.total)}
            </span>
          )}
        </div>
      )}

      <div className={styles.rowActions}>
        <button
          className="btn btn-ghost btn-sm"
          type="button"
          onClick={onEdit}
          disabled={busy}
          aria-label={`Editar ${category.name}`}
        >
          Editar
        </button>
        <button
          className={`btn btn-ghost btn-sm ${styles.delete}`}
          type="button"
          onClick={onDelete}
          disabled={busy}
          aria-label={`Excluir ${category.name}`}
        >
          Excluir
        </button>
      </div>
    </>
  );
}
