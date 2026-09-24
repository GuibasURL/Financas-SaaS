"""Excluir a conta (DELETE /auth/me): apaga o usuário e tudo o que é dele."""
from app.models.category import Category
from app.models.statement import Statement
from app.models.transaction import Transaction
from app.models.user import User
from tests.conftest import CSV_FEVEREIRO, CSV_JANEIRO, PASSWORD, upload_csv


def _delete(client, password=PASSWORD):
    return client.request("DELETE", "/auth/me", json={"password": password})


def test_exclui_a_conta_e_todos_os_dados(client, db_session, user, categories):
    upload_csv(client, CSV_JANEIRO)
    upload_csv(client, CSV_FEVEREIRO, filename="fevereiro.csv")
    client.put("/auth/me/avatar", files={"file": ("a.png", b"\x89PNG\r\n\x1a\n" + b"\x00" * 10)})
    user_id = user.id

    response = _delete(client)

    assert response.status_code == 204
    db_session.expire_all()
    assert db_session.get(User, user_id) is None
    assert db_session.query(Statement).filter(Statement.user_id == user_id).count() == 0
    assert db_session.query(Category).filter(Category.user_id == user_id).count() == 0
    assert db_session.query(Transaction).count() == 0


def test_depois_de_excluir_o_token_e_o_login_nao_valem_mais(client, anon_client):
    _delete(client)

    assert client.get("/auth/me").status_code == 401
    login = anon_client.post("/auth/login", data={"username": "ana@teste.com", "password": PASSWORD})
    assert login.status_code == 401


def test_o_email_fica_livre_para_um_cadastro_novo(client, anon_client):
    _delete(client)

    response = anon_client.post(
        "/auth/register", json={"email": "ana@teste.com", "password": "Girassol#Azul91"}
    )

    assert response.status_code == 201
    # Conta nova começa do zero: nada da conta antiga
    token = anon_client.post(
        "/auth/login", data={"username": "ana@teste.com", "password": "Girassol#Azul91"}
    ).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    assert anon_client.get("/statements", headers=headers).json() == []


def test_nao_encosta_nos_dados_de_outro_usuario(client, other_client, db_session, other_user):
    upload_csv(client, CSV_JANEIRO)
    upload_csv(other_client, CSV_FEVEREIRO, filename="do-bruno.csv")
    other_client.post("/categories", json={"name": "Lazer", "keywords": "cinema"})

    _delete(client)

    statements = other_client.get("/statements").json()
    assert [s["filename"] for s in statements] == ["do-bruno.csv"]
    assert len(other_client.get("/transactions").json()) == 2
    assert [c["name"] for c in other_client.get("/categories").json()] == ["Lazer"]


def test_senha_errada_nao_exclui(client, db_session, user):
    response = _delete(client, password="errada")

    assert response.status_code == 400  # não 401: o frontend deslogaria
    assert response.json()["detail"] == "Senha atual incorreta"
    db_session.expire_all()
    assert db_session.get(User, user.id) is not None


def test_senha_vazia(client):
    response = _delete(client, password="")

    assert response.status_code == 400
    assert response.json()["detail"] == "Digite sua senha para excluir a conta"


def test_sem_corpo_da_422(client):
    assert client.request("DELETE", "/auth/me").status_code == 422


def test_muitas_senhas_erradas_bloqueiam(client):
    for _ in range(5):
        assert _delete(client, password="errada").status_code == 400

    assert _delete(client).status_code == 429


def test_precisa_estar_logado(anon_client):
    assert _delete(anon_client).status_code == 401
