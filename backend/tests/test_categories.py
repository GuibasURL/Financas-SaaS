import pytest

from tests.conftest import CSV_JANEIRO


def test_cria_e_lista_categorias(client):
    response = client.post(
        "/categories", json={"name": "Lazer", "keywords": "cinema,netflix"}
    )

    assert response.status_code == 200
    created = response.json()
    assert created["name"] == "Lazer"
    assert client.get("/categories").json() == [created]


def test_lista_categorias_em_ordem_alfabetica(client):
    for name in ["Transporte", "Alimentação", "Lazer"]:
        client.post("/categories", json={"name": name})

    names = [c["name"] for c in client.get("/categories").json()]
    assert names == ["Alimentação", "Lazer", "Transporte"]


def test_nao_permite_categoria_com_nome_repetido(client):
    client.post("/categories", json={"name": "Lazer"})

    response = client.post("/categories", json={"name": "  Lazer "})

    assert response.status_code == 400
    assert len(client.get("/categories").json()) == 1


def test_normaliza_nome_e_keywords(client):
    response = client.post(
        "/categories", json={"name": "  Lazer ", "keywords": " Cinema, NETFLIX ,, cinema,"}
    )

    assert response.json()["name"] == "Lazer"
    assert response.json()["keywords"] == "cinema,netflix"


@pytest.mark.parametrize("name", ["", "   "])
def test_nao_aceita_nome_vazio(client, name):
    response = client.post("/categories", json={"name": name})

    assert response.status_code == 422


# ---------- Editar ----------


def test_edita_nome_e_keywords(client, categories):
    category_id = categories["alimentacao"].id

    response = client.patch(
        f"/categories/{category_id}", json={"name": "Comida", "keywords": "ifood, Padaria"}
    )

    assert response.status_code == 200
    assert response.json() == {
        "id": category_id,
        "name": "Comida",
        "keywords": "ifood,padaria",
        "ignore_in_reports": False,
    }


def test_edita_so_o_campo_enviado(client, categories):
    category_id = categories["alimentacao"].id

    response = client.patch(f"/categories/{category_id}", json={"keywords": "mercado"})

    assert response.json()["name"] == "Alimentação"
    assert response.json()["keywords"] == "mercado"


def test_pode_manter_o_proprio_nome_ao_editar(client, categories):
    category_id = categories["alimentacao"].id

    response = client.patch(
        f"/categories/{category_id}", json={"name": "Alimentação", "keywords": "x"}
    )

    assert response.status_code == 200


def test_nao_renomeia_para_nome_de_outra_categoria(client, categories):
    response = client.patch(
        f"/categories/{categories['alimentacao'].id}", json={"name": "Transporte"}
    )

    assert response.status_code == 400


def test_editar_categoria_inexistente_da_404(client):
    response = client.patch("/categories/999", json={"name": "X"})

    assert response.status_code == 404


def test_marca_e_desmarca_ignorar_nos_graficos(client, categories):
    category_id = categories["alimentacao"].id

    marked = client.patch(f"/categories/{category_id}", json={"ignore_in_reports": True})
    only_name = client.patch(f"/categories/{category_id}", json={"name": "Comida"})

    assert marked.json()["ignore_in_reports"] is True
    assert only_name.json()["ignore_in_reports"] is True  # não mexeu no que não foi enviado
    unmarked = client.patch(f"/categories/{category_id}", json={"ignore_in_reports": False})
    assert unmarked.json()["ignore_in_reports"] is False


def test_cria_categoria_ja_ignorada_nos_graficos(client):
    response = client.post(
        "/categories", json={"name": "Pagamento de fatura", "ignore_in_reports": True}
    )

    assert response.json()["ignore_in_reports"] is True


def test_categoria_nova_conta_nos_graficos_por_padrao(client):
    assert client.post("/categories", json={"name": "Lazer"}).json()["ignore_in_reports"] is False


# ---------- Excluir ----------


def test_excluir_categoria_deixa_transacoes_sem_categoria(client, upload, categories):
    upload(CSV_JANEIRO)
    alimentacao_id = categories["alimentacao"].id

    response = client.delete(f"/categories/{alimentacao_id}")

    assert response.status_code == 204
    transactions = {t["description"]: t["category_id"] for t in client.get("/transactions").json()}
    assert len(transactions) == 4  # nenhuma transação foi apagada
    assert transactions["IFOOD *RESTAURANTE XYZ"] is None
    assert transactions["UBER TRIP"] == categories["transporte"].id
    assert [c["name"] for c in client.get("/categories").json()] == ["Transporte"]


def test_excluir_categoria_inexistente_da_404(client):
    response = client.delete("/categories/999")

    assert response.status_code == 404


# ---------- Reaplicar regras ----------


def test_reaplicar_regras_categoriza_transacoes_ja_importadas(client, upload, categories):
    upload(CSV_JANEIRO)  # FARMACIA fica sem categoria
    client.post("/categories", json={"name": "Saúde", "keywords": "farmacia"})

    response = client.post("/categories/apply-rules")

    assert response.status_code == 200
    assert response.json() == {"categorized": 1}
    farmacia = next(t for t in client.get("/transactions").json() if t["description"] == "FARMACIA")
    assert farmacia["category_id"] is not None


def test_reaplicar_regras_nao_mexe_em_categoria_ja_definida(client, upload, categories):
    transaction = upload(CSV_JANEIRO).json()[0]  # IFOOD -> Alimentação
    # O usuário decidiu à mão que esse IFOOD é Transporte
    client.patch(
        f"/transactions/{transaction['id']}",
        json={"category_id": categories["transporte"].id},
    )

    client.post("/categories/apply-rules")

    updated = next(t for t in client.get("/transactions").json() if t["id"] == transaction["id"])
    assert updated["category_id"] == categories["transporte"].id


def test_reaplicar_regras_sem_nada_para_categorizar(client, upload):
    upload(CSV_JANEIRO)  # sem categorias, nada bate

    assert client.post("/categories/apply-rules").json() == {"categorized": 0}


def test_palavra_chave_de_exclusao_pela_api(client, upload):
    upload("data,descricao,valor\n2025-03-01,MERCADO PAGO *LOJA,-10\n2025-03-02,MERCADO EXTRA,-20\n")
    created = client.post("/categories", json={"name": "Mercado", "keywords": "mercado, - Mercado Pago"})

    assert created.json()["keywords"] == "mercado,-mercado pago"
    assert client.post("/categories/apply-rules").json() == {"categorized": 1}
    by_description = {t["description"]: t["category_id"] for t in client.get("/transactions").json()}
    assert by_description["MERCADO PAGO *LOJA"] is None
    assert by_description["MERCADO EXTRA"] == created.json()["id"]
