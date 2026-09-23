import { useState } from "react";
import {
  apiErrorMessage,
  applyCategoryRules,
  createCategory,
  deleteCategory,
  updateCategory,
} from "../services/api";
import type { Category } from "../types/transaction";

interface Props {
  categories: Category[];
  // Chamado depois de qualquer mudança, para o Dashboard recarregar os dados
  onChanged: () => void;
}

const IGNORE_HINT =
  "Transações desta categoria continuam na lista, mas não entram nos gráficos. " +
  "Use para o que não é gasto de verdade: o pagamento da fatura do cartão (as compras " +
  "da fatura já são os gastos) ou transferências entre suas próprias contas.";

// "ifood,restaurante" -> "ifood, restaurante" (mais fácil de ler e editar)
function formatKeywords(keywords: string) {
  return keywords.split(",").filter(Boolean).join(", ");
}

export default function CategoryManager({ categories, onChanged }: Props) {
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
        <p>Nenhuma categoria ainda. Crie uma abaixo.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Palavras-chave</th>
              <th title={IGNORE_HINT}>Nos gráficos</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) =>
              c.id === editingId ? (
                <tr key={c.id}>
                  <td>
                    <input
                      form="edit-category"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      aria-label="Nome"
                      required
                    />
                  </td>
                  <td>
                    <input
                      form="edit-category"
                      value={editKeywords}
                      onChange={(e) => setEditKeywords(e.target.value)}
                      aria-label="Palavras-chave"
                      placeholder="ifood, restaurante"
                      style={{ width: "100%" }}
                    />
                  </td>
                  <td>
                    <label title={IGNORE_HINT}>
                      <input
                        type="checkbox"
                        form="edit-category"
                        checked={editIgnore}
                        onChange={(e) => setEditIgnore(e.target.checked)}
                      />{" "}
                      ignorar
                    </label>
                  </td>
                  <td>
                    <form id="edit-category" onSubmit={handleSave} style={{ display: "inline" }}>
                      <button type="submit" disabled={busy}>
                        Salvar
                      </button>
                    </form>{" "}
                    <button onClick={() => setEditingId(null)} disabled={busy}>
                      Cancelar
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.keywords ? formatKeywords(c.keywords) : <em>nenhuma</em>}</td>
                  <td title={c.ignore_in_reports ? IGNORE_HINT : undefined}>
                    {c.ignore_in_reports ? <em>ignorada</em> : "conta"}
                  </td>
                  <td>
                    <button onClick={() => startEditing(c)} disabled={busy}>
                      Editar
                    </button>{" "}
                    <button onClick={() => handleDelete(c)} disabled={busy}>
                      Excluir
                    </button>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      )}

      <form onSubmit={handleCreate} style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nova categoria"
          aria-label="Nome da nova categoria"
          required
        />
        <input
          value={newKeywords}
          onChange={(e) => setNewKeywords(e.target.value)}
          placeholder="Palavras-chave, separadas por vírgula"
          aria-label="Palavras-chave da nova categoria"
          style={{ flex: 1 }}
        />
        <button type="submit" disabled={busy}>
          Adicionar
        </button>
      </form>
      <label style={{ display: "block", marginTop: 4 }} title={IGNORE_HINT}>
        <input
          type="checkbox"
          checked={newIgnore}
          onChange={(e) => setNewIgnore(e.target.checked)}
        />{" "}
        Ignorar nos gráficos (ex: pagamento de fatura do cartão, transferência entre suas contas)
      </label>

      <p>
        <button onClick={handleApplyRules} disabled={busy || categories.length === 0}>
          Aplicar regras às transações sem categoria
        </button>
      </p>

      {error && <p style={{ color: "red" }}>{error}</p>}
      {message && <p style={{ color: "green" }}>{message}</p>}
    </div>
  );
}
