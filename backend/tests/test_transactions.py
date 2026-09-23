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
