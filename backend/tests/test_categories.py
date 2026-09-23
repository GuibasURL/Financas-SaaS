def test_cria_e_lista_categorias(client):
    response = client.post(
        "/categories", json={"name": "Lazer", "keywords": "cinema,netflix"}
    )

    assert response.status_code == 200
    created = response.json()
    assert created["name"] == "Lazer"
    assert client.get("/categories").json() == [created]


def test_nao_permite_categoria_com_nome_repetido(client):
    client.post("/categories", json={"name": "Lazer"})

    response = client.post("/categories", json={"name": "Lazer"})

    assert response.status_code == 400
    assert len(client.get("/categories").json()) == 1
