from tests.conftest import CSV_JANEIRO, CSV_FEVEREIRO


def _farmacia(client):
    """A transação FARMACIA do CSV_JANEIRO (a única sem categoria automática)."""
    return next(
        t for t in client.get("/transactions").json() if t["description"] == "FARMACIA"
    )


def test_lista_transacoes_da_mais_recente_para_a_mais_antiga(client, upload):
    upload(CSV_JANEIRO)

    dates = [t["date"] for t in client.get("/transactions").json()]
    assert dates == sorted(dates, reverse=True)


def test_filtra_por_extrato(client, upload):
    janeiro_id = upload(CSV_JANEIRO).json()[0]["statement_id"]
    upload(CSV_FEVEREIRO)

    transactions = client.get(f"/transactions?statement_id={janeiro_id}").json()
    assert len(transactions) == 4
    assert all(t["statement_id"] == janeiro_id for t in transactions)


def test_filtra_por_mes_e_ano(client, upload):
    upload(CSV_JANEIRO)
    upload(CSV_FEVEREIRO)

    transactions = client.get("/transactions?month=2&year=2025").json()
    assert len(transactions) == 2


def test_filtra_por_categoria(client, upload, categories):
    upload(CSV_JANEIRO)
    upload(CSV_FEVEREIRO)
    transporte_id = categories["transporte"].id

    transactions = client.get(f"/transactions?category_id={transporte_id}").json()
    assert [t["description"] for t in transactions] == ["UBER TRIP", "UBER TRIP"]


def test_patch_define_categoria(client, upload, categories):
    upload(CSV_JANEIRO)
    transaction = _farmacia(client)

    response = client.patch(
        f"/transactions/{transaction['id']}",
        json={"category_id": categories["alimentacao"].id},
    )

    assert response.status_code == 200
    assert response.json()["category_id"] == categories["alimentacao"].id


def test_patch_com_null_remove_categoria(client, upload, categories):
    transaction = upload(CSV_JANEIRO).json()[0]  # IFOOD, já categorizada
    assert transaction["category_id"] is not None

    response = client.patch(f"/transactions/{transaction['id']}", json={"category_id": None})

    assert response.status_code == 200
    assert response.json()["category_id"] is None


def test_patch_sem_category_id_nao_altera_nada(client, upload, categories):
    transaction = upload(CSV_JANEIRO).json()[0]

    response = client.patch(f"/transactions/{transaction['id']}", json={})

    assert response.status_code == 200
    assert response.json()["category_id"] == transaction["category_id"]


def test_patch_com_categoria_inexistente_da_404(client, upload):
    upload(CSV_JANEIRO)
    transaction = _farmacia(client)

    response = client.patch(f"/transactions/{transaction['id']}", json={"category_id": 999})

    assert response.status_code == 404
    assert _farmacia(client)["category_id"] is None


def test_patch_em_transacao_inexistente_da_404(client):
    response = client.patch("/transactions/999", json={"category_id": None})

    assert response.status_code == 404


# ---------- Excluir uma transação ----------


def test_exclui_so_a_transacao_escolhida(client, upload):
    statement_id = upload(CSV_JANEIRO).json()[0]["statement_id"]
    farmacia = _farmacia(client)

    response = client.delete(f"/transactions/{farmacia['id']}")

    assert response.status_code == 204
    descriptions = [t["description"] for t in client.get("/transactions").json()]
    assert "FARMACIA" not in descriptions
    assert len(descriptions) == 3
    # O extrato continua, com uma transação a menos
    statement = client.get("/statements").json()[0]
    assert (statement["id"], statement["transaction_count"]) == (statement_id, 3)


def test_excluir_tira_a_transacao_dos_totais(client, upload):
    upload(CSV_JANEIRO)
    before = client.get("/dashboard/monthly").json()[0]["total"]

    client.delete(f"/transactions/{_farmacia(client)['id']}")

    assert client.get("/dashboard/monthly").json()[0]["total"] == round(before + 30.10, 2)


def test_excluir_a_compra_repetida_deixa_a_outra(client, upload):
    # O caso que motivou o botão: a mesma compra entrou duas vezes
    upload("data,descricao,valor\n2025-01-26,PENDENTE MERCADO EXTRA,-150.00\n")
    upload("data,descricao,valor\n2025-01-26,MERCADO EXTRA LTDA,-150.00\n")
    pending = next(t for t in client.get("/transactions").json() if t["description"].startswith("PENDENTE"))

    client.delete(f"/transactions/{pending['id']}")

    assert [t["description"] for t in client.get("/transactions").json()] == ["MERCADO EXTRA LTDA"]
    assert client.get("/dashboard/monthly").json()[0]["total"] == -150.0


def test_extrato_sem_nenhuma_transacao_continua_na_lista(client, upload):
    transaction = upload("data,descricao,valor\n2025-01-26,LOJA,-10.00\n").json()[0]

    client.delete(f"/transactions/{transaction['id']}")

    statement = client.get("/statements").json()[0]
    assert (statement["transaction_count"], statement["start_date"]) == (0, None)


def test_excluir_transacao_inexistente_ou_ja_excluida_da_404(client, upload):
    transaction = upload(CSV_JANEIRO).json()[0]
    assert client.delete(f"/transactions/{transaction['id']}").status_code == 204

    for transaction_id in (transaction["id"], 999):
        response = client.delete(f"/transactions/{transaction_id}")
        assert (response.status_code, response.json()) == (404, {"detail": "Transação não encontrada"})
