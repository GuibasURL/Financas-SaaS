from pathlib import Path

from tests.conftest import CSV_JANEIRO


def test_upload_cria_transacoes_ligadas_a_um_extrato(upload):
    response = upload(CSV_JANEIRO)

    assert response.status_code == 200
    transactions = response.json()
    assert len(transactions) == 4
    assert len({t["statement_id"] for t in transactions}) == 1
    assert transactions[0]["description"] == "IFOOD *RESTAURANTE XYZ"
    assert transactions[0]["amount"] == -45.90


def test_upload_categoriza_por_keyword(upload, categories):
    transactions = upload(CSV_JANEIRO).json()
    by_description = {t["description"]: t["category_id"] for t in transactions}

    assert by_description["IFOOD *RESTAURANTE XYZ"] == categories["alimentacao"].id
    assert by_description["UBER TRIP"] == categories["transporte"].id
    assert by_description["FARMACIA"] is None


def test_mesmo_arquivo_duas_vezes_vira_dois_extratos(client, upload):
    upload(CSV_JANEIRO)
    upload(CSV_JANEIRO)

    statements = client.get("/statements").json()
    assert len(statements) == 2
    assert {s["filename"] for s in statements} == {"extrato.csv"}


def test_upload_rejeita_arquivo_que_nao_e_csv(upload):
    response = upload(CSV_JANEIRO, filename="extrato.txt")

    assert response.status_code == 400


def test_upload_rejeita_csv_sem_colunas_obrigatorias(client, upload):
    response = upload("data,descricao\n2025-01-05,IFOOD\n")

    assert response.status_code == 400
    assert "não reconhecido" in response.json()["detail"]
    assert client.get("/statements").json() == []


def test_upload_de_extrato_de_banco_categoriza_pela_descricao(client, upload, categories):
    content = (Path(__file__).parent / "fixtures" / "extratos" / "bradesco.csv").read_text("utf-8")

    transactions = upload(content, filename="bradesco.csv").json()

    assert len(transactions) == 11
    by_description = {t["description"]: t["category_id"] for t in transactions}
    assert by_description["IFOOD"] == categories["alimentacao"].id
    assert by_description["UBER"] == categories["transporte"].id


def test_upload_rejeita_valor_invalido(client, upload):
    response = upload("data,descricao,valor\n2025-01-05,IFOOD,abc\n")

    assert response.status_code == 400
    assert client.get("/statements").json() == []
