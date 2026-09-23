"""Força da senha: a regra em si e o cadastro recusando senha fraca."""
import pytest

from app.services.password_policy import (
    character_types,
    password_strength,
    weak_password_message,
)


@pytest.mark.parametrize(
    "password, strength",
    [
        ("", "weak"),
        ("Ab1!", "weak"),  # os 4 tipos, mas curta
        ("abcdefgh", "weak"),  # 1 tipo
        ("abcdefg1", "weak"),  # 2 tipos
        ("abcdef1!", "medium"),  # minúscula, número, especial
        ("Abcdefg1", "medium"),  # minúscula, maiúscula, número
        ("senha-forte-123", "medium"),
        ("Senha-forte-123", "strong"),
        ("Çãoçãoç1", "medium"),  # letras acentuadas contam como letras
        ("Açaí com granola 1!", "strong"),  # espaço não conta como especial, "!" sim
    ],
)
def test_forca(password, strength):
    assert password_strength(password) == strength


def test_tipos_de_caractere():
    assert character_types("aB3 ") == {"lower": True, "upper": True, "digit": True, "special": False}
    assert character_types("#") == {"lower": False, "upper": False, "digit": False, "special": True}


@pytest.mark.parametrize(
    "password, expected",
    [
        ("Ab1!", "A senha precisa ter pelo menos 8 caracteres"),
        ("abcdefgh", "Falta: letra maiúscula, número, caractere especial."),
        ("ABCDEFG1", "Falta: letra minúscula, caractere especial."),
    ],
)
def test_mensagem_diz_o_que_falta(password, expected):
    assert expected in weak_password_message(password)


@pytest.mark.parametrize("password", ["abcdef1!", "Senha-forte-123"])
def test_mediana_e_forte_sao_aceitas(password):
    assert weak_password_message(password) is None


# ---------- Cadastro ----------


def test_cadastro_recusa_senha_fraca_com_a_mensagem(anon_client):
    response = anon_client.post(
        "/auth/register", json={"email": "nova@teste.com", "password": "abcdefgh"}
    )

    assert response.status_code == 422
    assert "A senha está fraca" in response.json()["detail"][0]["msg"]


@pytest.mark.parametrize("password", ["abcdef1!", "Senha-Forte-123"])
def test_cadastro_aceita_senha_mediana_e_forte(anon_client, password):
    response = anon_client.post(
        "/auth/register", json={"email": "nova@teste.com", "password": password}
    )

    assert response.status_code == 201


def test_login_de_conta_antiga_com_senha_fraca_continua_funcionando(anon_client, db_session):
    # A regra vale para senhas novas; quem já tem conta não fica trancado do lado de fora
    from app.models.user import User
    from app.services.security import hash_password

    db_session.add(User(email="antiga@teste.com", hashed_password=hash_password("fraquinha")))
    db_session.commit()

    response = anon_client.post(
        "/auth/login", data={"username": "antiga@teste.com", "password": "fraquinha"}
    )

    assert response.status_code == 200
