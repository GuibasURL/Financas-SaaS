from tests.conftest import CSV_JANEIRO, CSV_FEVEREIRO


def test_lista_extratos_com_contagem_e_periodo(client, upload):
    upload(CSV_JANEIRO, filename="janeiro.csv")

    [statement] = client.get("/statements").json()
    assert statement["filename"] == "janeiro.csv"
    assert statement["transaction_count"] == 4
    assert statement["start_date"] == "2025-01-05"
    assert statement["end_date"] == "2025-01-15"


def test_lista_extratos_do_mais_recente_para_o_mais_antigo(client, upload):
    upload(CSV_JANEIRO, filename="janeiro.csv")
    upload(CSV_FEVEREIRO, filename="fevereiro.csv")

    filenames = [s["filename"] for s in client.get("/statements").json()]
    assert filenames == ["fevereiro.csv", "janeiro.csv"]


def test_excluir_extrato_apaga_so_as_transacoes_dele(client, upload):
    janeiro_id = upload(CSV_JANEIRO).json()[0]["statement_id"]
    fevereiro_id = upload(CSV_FEVEREIRO).json()[0]["statement_id"]

    response = client.delete(f"/statements/{janeiro_id}")

    assert response.status_code == 204
    assert [s["id"] for s in client.get("/statements").json()] == [fevereiro_id]
    remaining = client.get("/transactions").json()
    assert len(remaining) == 2
    assert all(t["statement_id"] == fevereiro_id for t in remaining)


def test_excluir_extrato_inexistente_da_404(client):
    response = client.delete("/statements/999")

    assert response.status_code == 404
