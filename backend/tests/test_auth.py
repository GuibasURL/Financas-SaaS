from datetime import timedelta

import pytest

from app.services.security import create_access_token
from tests.conftest import PASSWORD


def _login(client, email, password):
    return client.post("/auth/login", data={"username": email, "password": password})


def test_cadastro_devolve_usuario_sem_senha(anon_client):
    response = anon_client.post(
        "/auth/register", json={"email": "nova@teste.com", "password": "senha-forte-123"}
    )

    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "nova@teste.com"
    assert "password" not in body and "hashed_password" not in body


def test_cadastro_normaliza_email_e_nao_aceita_repetido(anon_client):
    anon_client.post(
        "/auth/register", json={"email": "  Nova@Teste.com ", "password": "senha-forte-123"}
    )

    response = anon_client.post(
        "/auth/register", json={"email": "nova@teste.com", "password": "outra-senha-123"}
    )

    assert response.status_code == 400


@pytest.mark.parametrize(
    "email, password",
    [
        ("sem-arroba.com", "senha-forte-123"),
        ("nova@teste.com", "curta"),
        ("nova@teste.com", "á" * 40),  # 80 bytes: passa do limite do bcrypt
    ],
)
def test_cadastro_valida_email_e_senha(anon_client, email, password):
    response = anon_client.post("/auth/register", json={"email": email, "password": password})

    assert response.status_code == 422


def test_cadastro_e_login_de_ponta_a_ponta(anon_client):
    anon_client.post(
        "/auth/register", json={"email": "nova@teste.com", "password": "senha-forte-123"}
    )

    login = _login(anon_client, "NOVA@teste.com", "senha-forte-123")

    assert login.status_code == 200
    token = login.json()["access_token"]
    me = anon_client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json()["email"] == "nova@teste.com"


@pytest.mark.parametrize(
    "email, password",
    [("ana@teste.com", "senha-errada-123"), ("ninguem@teste.com", PASSWORD)],
)
def test_login_com_credenciais_erradas_da_401(anon_client, user, email, password):
    response = _login(anon_client, email, password)

    assert response.status_code == 401
    assert response.json()["detail"] == "E-mail ou senha incorretos"


@pytest.mark.parametrize(
    "method, path",
    [
        ("get", "/auth/me"),
        ("get", "/transactions"),
        ("patch", "/transactions/1"),
        ("get", "/categories"),
        ("post", "/categories"),
        ("get", "/statements"),
        ("delete", "/statements/1"),
        ("post", "/upload"),
        ("get", "/dashboard/by-category"),
        ("get", "/dashboard/monthly"),
    ],
)
def test_rotas_exigem_token(anon_client, method, path):
    response = anon_client.request(method, path)

    assert response.status_code == 401


def test_token_invalido_da_401(anon_client):
    response = anon_client.get("/auth/me", headers={"Authorization": "Bearer nao-e-um-jwt"})

    assert response.status_code == 401


def test_token_expirado_da_401(anon_client, user):
    token = create_access_token(user.id, expires_delta=timedelta(minutes=-1))

    response = anon_client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401


def test_token_de_usuario_que_nao_existe_mais_da_401(anon_client, db_session, user):
    token = create_access_token(user.id)
    db_session.delete(user)
    db_session.commit()

    response = anon_client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401
