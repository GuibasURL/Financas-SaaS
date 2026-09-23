import { useState } from "react";
import {
  addDefaultCategories,
  apiErrorMessage,
  applyCategoryRules,
  createCategory,
  deleteCategory,
  updateCategory,
} from "../services/api";
import type { Category } from "../types/transaction";
import styles from "./CategoryManager.module.css";

interface Props {
  categories: Category[];
  // Chamado depois de qualquer mudança, para a página recarregar os dados
  onChanged: () => void;
  // Cor da categoria (a mesma dos gráficos); opcional
  categoryColor?: (id: number) => string;
}

const IGNORE_HINT =
  "Transações desta categoria continuam na lista, mas não entram nos gráficos. " +
  "Use para o que não é gasto de verdade: o pagamento da fatura do cartão (as compras " +
  "da fatura já são os gastos) ou transferências entre suas próprias contas.";

// "ifood,restaurante" -> "ifood, restaurante" (mais fácil de ler e editar)
function formatKeywords(keywords: string) {
  return keywords.split(",").filter(Boolean).join(", ");
}

export default function CategoryManager({ categories, onChanged, categoryColor }: Props) {
  const [newName, setNewName] = useState("");
  const [newKeywords, setNewKeywords] = useState("");
  const [newIgnore, setNewIgnore] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editKeywords, setEditKeywords] = useState("");
  const [editIgnore, setEditIgnore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Executa uma ação na API mostrando erro/mensagem e travando os botões
  async function run(action: () => Promise<string | void>, errorFallback: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await action();
      if (result) setMessage(result);
      onChanged();
      return true;
    } catch (err) {
      setError(apiErrorMessage(err, errorFallback));
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
      "Não foi possível criar a categoria."
    );
    if (ok) {
      setNewName("");
      setNewKeywords("");
      setNewIgnore(false);
    }
  }

  function startEditing(category: Category) {
    setEditingId(category.id);
    setEditName(category.name);
    setEditKeywords(formatKeywords(category.keywords));
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
      "Não foi possível salvar a categoria."
    );
    if (ok) setEditingId(null);
  }

  async function handleDelete(category: Category) {
    const confirmed = confirm(
      `Excluir a categoria "${category.name}"? As transações dela ficam sem categoria.`
    );
    if (!confirmed) return;
    await run(
      () => deleteCategory(category.id).then(() => undefined),
      "Não foi possível excluir a categoria."
    );
    if (editingId === category.id) setEditingId(null);
  }

  async function handleAddDefaults() {
    await run(async () => {
      const count = await addDefaultCategories();
      return count === 0
        ? "Você já tem todas as categorias sugeridas."
        : `${count} categoria${count === 1 ? " sugerida adicionada" : "s sugeridas adicionadas"}. ` +
            'Use "Aplicar regras" para categorizar os extratos já importados.';
    }, "Não foi possível adicionar as categorias sugeridas.");
  }

  async function handleApplyRules() {
    await run(async () => {
      const count = await applyCategoryRules();
      return count === 0
        ? "Nenhuma transação sem categoria bateu com as palavras-chave."
        : `${count} transaç${count === 1 ? "ão foi categorizada" : "ões foram categorizadas"}.`;
    }, "Não foi possível aplicar as regras.");
  }

  return (
    <div>
      {categories.length === 0 ? (
        <p className="empty">Nenhuma categoria ainda. Crie uma abaixo ou adicione as sugeridas.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Palavras-chave</th>
                <th title={IGNORE_HINT}>Nos gráficos</th>
                <th className="num">Ações</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) =>
                c.id === editingId ? (
                  <tr key={c.id} className="selected">
                    <td>
                      <input
                        className="field"
                        form="edit-category"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        aria-label="Nome"
                        required
                      />
                    </td>
                    <td>
                      <input
                        className="field"
                        form="edit-category"
                        value={editKeywords}
                        onChange={(e) => setEditKeywords(e.target.value)}
                        aria-label="Palavras-chave"
                        placeholder="ifood, restaurante"
                      />
                    </td>
                    <td>
                      <label className="checkbox" title={IGNORE_HINT}>
                        <input
                          type="checkbox"
                          form="edit-category"
                          checked={editIgnore}
                          onChange={(e) => setEditIgnore(e.target.checked)}
                        />
                        ignorar
                      </label>
                    </td>
                    <td className="num">
                      <span className={styles.actions}>
                        <form id="edit-category" onSubmit={handleSave}>
                          <button className="btn btn-primary btn-sm" type="submit" disabled={busy}>
                            Salvar
                          </button>
                        </form>
                        <button
                          className="btn btn-sm"
                          onClick={() => setEditingId(null)}
                          disabled={busy}
                        >
                          Cancelar
                        </button>
                      </span>
                    </td>
                  </tr>
                ) : (
                  <tr key={c.id}>
                    <td>
                      <span className={styles.name}>
                        {categoryColor && <i style={{ background: categoryColor(c.id) }} />}
                        {c.name}
                      </span>
                    </td>
                    <td className="muted">
                      {c.keywords ? formatKeywords(c.keywords) : <em>nenhuma</em>}
                    </td>
                    <td title={c.ignore_in_reports ? IGNORE_HINT : undefined}>
                      {c.ignore_in_reports ? (
                        <span className="badge badge-warning">ignorada</span>
                      ) : (
                        <span className="muted">conta</span>
                      )}
                    </td>
                    <td className="num">
                      <span className={styles.actions}>
                        <button className="btn btn-sm" onClick={() => startEditing(c)} disabled={busy}>
                          Editar
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDelete(c)}
                          disabled={busy}
                        >
                          Excluir
                        </button>
                      </span>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}

      <form className={styles.newForm} onSubmit={handleCreate}>
        <input
          className="field"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nova categoria"
          aria-label="Nome da nova categoria"
          required
        />
        <input
          className="field"
          value={newKeywords}
          onChange={(e) => setNewKeywords(e.target.value)}
          placeholder="Palavras-chave: ifood, restaurante, -mercado pago"
          aria-label="Palavras-chave da nova categoria"
        />
        <button className="btn btn-primary" type="submit" disabled={busy}>
          Adicionar
        </button>
      </form>
      <label className={`checkbox ${styles.ignoreNew}`} title={IGNORE_HINT}>
        <input
          type="checkbox"
          checked={newIgnore}
          onChange={(e) => setNewIgnore(e.target.checked)}
        />
        Ignorar nos gráficos (ex: pagamento de fatura do cartão, transferência entre suas contas)
      </label>
      <p className={styles.help}>
        Separe as palavras-chave por vírgula. Elas valem no começo de uma palavra da descrição,
        sem diferenciar maiúsculas, acentos e pontuação. Use <code>-</code> na frente para excluir:{" "}
        <code>mercado, -mercado pago</code> pega "MERCADO EXTRA", mas não "MERCADO PAGO".
      </p>

      <div className={styles.bulk}>
        <button
          className="btn"
          onClick={handleApplyRules}
          disabled={busy || categories.length === 0}
        >
          Aplicar regras às transações sem categoria
        </button>
        <button
          className="btn"
          onClick={handleAddDefaults}
          disabled={busy}
          title="Alimentação, Mercado, Transporte, Saúde, Moradia, Assinaturas... Só cria as que você ainda não tem."
        >
          Adicionar categorias sugeridas
        </button>
      </div>

      {error && (
        <p className={`notice ${styles.message}`} role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className={`notice notice-success ${styles.message}`} role="status">
          {message}
        </p>
      )}
    </div>
  );
}
