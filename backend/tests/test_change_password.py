"""Alterar senha (POST /auth/me/password) e a queda das sessões antigas."""
from datetime import datetime, timedelta, timezone

import pytest

from app.services.security import create_access_token
from tests.conftest import PASSWORD

NEW_PASSWORD = "Girassol#Azul91"


def _change(client, current=PASSWORD, new=NEW_PASSWORD):
    return client.post(
        "/auth/me/password", json={"current_password": current, "new_password": new}
    )


def _login(anon_client, password):
    return anon_client.post("/auth/login", data={"username": "ana@teste.com", "password": password})


def test_troca_a_senha_e_o_login_passa_a_ser_pela_nova(client, anon_client):
    response = _change(client)

    assert response.status_code == 200
    assert _login(anon_client, NEW_PASSWORD).status_code == 200
    assert _login(anon_client, PASSWORD).status_code == 401


def test_devolve_um_token_novo_que_ja_vale(client, anon_client):
    token = _change(client).json()["access_token"]

    me = anon_client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert me.status_code == 200
    assert me.json()["email"] == "ana@teste.com"


def test_sessoes_antigas_caem_depois_da_troca(client, anon_client, user):
    # Outro aparelho, logado um minuto antes
    old_token = create_access_token(
        user.id, issued_at=datetime.now(timezone.utc) - timedelta(minutes=1)
    )

    _change(client)

    response = anon_client.get("/auth/me", headers={"Authorization": f"Bearer {old_token}"})
    assert response.status_code == 401


def test_login_depois_da_troca_gera_token_valido(client, anon_client):
    _change(client)

    token = _login(anon_client, NEW_PASSWORD).json()["access_token"]

    assert anon_client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 200


def test_token_sem_iat_de_antes_da_atualizacao(anon_client, db_session, user):
    # Tokens emitidos antes de o "iat" existir continuam valendo até a primeira troca
    import jwt

    from app.config import SECRET_KEY

    legacy = jwt.encode(
        {"sub": str(user.id), "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
        SECRET_KEY,
        algorithm="HS256",
    )
    headers = {"Authorization": f"Bearer {legacy}"}
    assert anon_client.get("/auth/me", headers=headers).status_code == 200

    user.password_changed_at = datetime.now(timezone.utc)
    db_session.commit()

    assert anon_client.get("/auth/me", headers=headers).status_code == 401


def test_senha_atual_errada(client, anon_client):
    response = _change(client, current="errada")

    assert response.status_code == 400  # não 401: o frontend deslogaria
    assert response.json()["detail"] == "Senha atual incorreta"
    assert _login(anon_client, PASSWORD).status_code == 200


def test_senha_atual_vazia(client):
    response = _change(client, current="")

    assert response.status_code == 400
    assert response.json()["detail"] == "Digite sua senha atual"


def test_muitas_senhas_erradas_bloqueiam(client):
    for _ in range(5):
        assert _change(client, current="errada").status_code == 400

    assert _change(client).status_code == 429


def test_nova_senha_igual_a_atual(client):
    response = _change(client, new=PASSWORD)

    assert response.status_code == 400
    assert response.json()["detail"] == "A nova senha precisa ser diferente da atual"


@pytest.mark.parametrize(
    "new_password, message",
    [
        ("curta1A", "pelo menos 8 caracteres"),
        ("somenteletras", "A senha está fraca"),
        ("Senha123!", "fácil de adivinhar"),  # palavra comum
    ],
)
def test_nova_senha_segue_a_regra_do_cadastro(client, new_password, message):
    response = _change(client, new=new_password)

    assert response.status_code == 400
    assert message in response.json()["detail"]


def test_nova_senha_acima_de_72_bytes(client):
    response = _change(client, new="Á1b!" * 20)

    assert response.status_code == 422
    assert "72 bytes" in str(response.json()["detail"])


def test_precisa_estar_logado(anon_client):
    assert _change(anon_client).status_code == 401
