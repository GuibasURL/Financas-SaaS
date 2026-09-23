"""
Um usuário nunca pode ver nem mexer nos dados de outro.

Nos testes, `client` é a Ana (dona dos dados) e `other_client` é o Bruno.
Recursos de outro usuário respondem 404, igual a inexistentes, para não
revelar que existem.
"""
from tests.conftest import CSV_FEVEREIRO, CSV_JANEIRO, upload_csv


def test_extratos_e_transacoes_de_outro_usuario_nao_aparecem(client, other_client):
    upload_csv(client, CSV_JANEIRO)

    assert other_client.get("/statements").json() == []
    assert other_client.get("/transactions").json() == []
    assert len(client.get("/transactions").json()) == 4


def test_filtro_por_extrato_de_outro_usuario_nao_retorna_nada(client, other_client):
    statement_id = upload_csv(client, CSV_JANEIRO).json()[0]["statement_id"]

    response = other_client.get(f"/transactions?statement_id={statement_id}")

    assert response.json() == []


def test_dashboard_so_soma_dados_do_proprio_usuario(client, other_client, categories):
    upload_csv(client, CSV_JANEIRO)
    upload_csv(other_client, CSV_FEVEREIRO)

    assert other_client.get("/dashboard/by-category").json() == []  # Bruno não tem categorias
    months = [(r["year"], r["month"]) for r in other_client.get("/dashboard/monthly").json()]
    assert months == [(2025, 2)]


def test_nao_exclui_extrato_de_outro_usuario(client, other_client):
    statement_id = upload_csv(client, CSV_JANEIRO).json()[0]["statement_id"]

    response = other_client.delete(f"/statements/{statement_id}")

    assert response.status_code == 404
    assert len(client.get("/statements").json()) == 1


def test_nao_altera_transacao_de_outro_usuario(client, other_client):
    transaction = upload_csv(client, CSV_JANEIRO).json()[0]

    response = other_client.patch(
        f"/transactions/{transaction['id']}", json={"category_id": None}
    )

    assert response.status_code == 404


def test_nao_usa_categoria_de_outro_usuario(client, other_client, categories):
    transaction = upload_csv(other_client, CSV_JANEIRO).json()[0]

    response = other_client.patch(
        f"/transactions/{transaction['id']}",
        json={"category_id": categories["alimentacao"].id},  # categoria da Ana
    )

    assert response.status_code == 404


def test_upload_so_categoriza_com_as_categorias_do_proprio_usuario(other_client, categories):
    transactions = upload_csv(other_client, CSV_JANEIRO).json()

    assert all(t["category_id"] is None for t in transactions)


def test_categorias_sao_separadas_por_usuario(client, other_client, categories):
    assert other_client.get("/categories").json() == []

    # O Bruno pode ter uma categoria com o mesmo nome de uma da Ana
    response = other_client.post("/categories", json={"name": "Alimentação"})

    assert response.status_code == 200
    assert len(client.get("/categories").json()) == 2
