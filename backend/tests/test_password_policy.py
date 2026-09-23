"""Força da senha: a regra em si e o cadastro recusando senha fraca."""
import re
from pathlib import Path

import pytest

from app.services.password_policy import (
    COMMON_PASSWORDS,
    character_types,
    obvious_reason,
    password_strength,
    weak_password_message,
)

FRONTEND_RULE = Path(__file__).parents[2] / "frontend" / "src" / "utils" / "passwordStrength.ts"


@pytest.mark.parametrize(
    "password, strength",
    [
        ("", "weak"),
        ("Ab1!", "weak"),  # os 4 tipos, mas curta
        ("girassol", "weak"),  # 1 tipo
        ("girassol1", "weak"),  # 2 tipos
        ("girassol1!", "medium"),  # minúscula, número, especial
        ("Girassol1", "medium"),  # minúscula, maiúscula, número
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
        ("girassol", "Falta: letra maiúscula, número, caractere especial."),
        ("ABCDEFG1", "Falta: letra minúscula, caractere especial."),
    ],
)
def test_mensagem_diz_o_que_falta(password, expected):
    assert expected in weak_password_message(password)


@pytest.mark.parametrize("password", ["girassol1!", "Senha-forte-123"])
def test_mediana_e_forte_sao_aceitas(password):
    assert weak_password_message(password) is None


# ---------- Senhas óbvias ----------


@pytest.mark.parametrize(
    "password, reason",
    [
        ("Senha123!", "é uma senha muito comum"),
        ("S3nh@...", None),  # "snh": troca de letra por número/símbolo escapa (limite conhecido)
        ("P@ssword2024", "é uma senha muito comum"),
        ("Qwerty123!", "é uma senha muito comum"),
        ("Flamengo10!", "é uma senha muito comum"),
        ("Vexira2026!", "é uma senha muito comum"),
        ("Abcdefg1!", "é uma sequência ou repetição de letras"),
        ("Zyxwvu99!", "é uma sequência ou repetição de letras"),
        ("Aaaaaaa1!", "é uma sequência ou repetição de letras"),
        ("Abc12345!", None),  # sequência curta (3 letras) não conta
        ("senha-forte-123", None),  # "senhaforte" não é a palavra comum sozinha
        ("Girassol1!", None),
    ],
)
def test_senhas_obvias(password, reason):
    assert obvious_reason(password) == reason


@pytest.mark.parametrize(
    "password, email, blocked",
    [
        ("Joaosilva2024!", "joao.silva@teste.com", True),  # pontos do e-mail são ignorados
        ("JOÃOSILVA#99", "joaosilva@teste.com", True),  # caixa e acento não importam
        ("Banana#2024", "ana@teste.com", False),  # parte curta demais para checar
        ("Girassol1!", "joao.silva@teste.com", False),
    ],
)
def test_senha_com_o_proprio_email(password, email, blocked):
    assert (obvious_reason(password, email) == "contém o seu e-mail") is blocked


def test_obvia_conta_como_fraca_mesmo_com_os_4_tipos():
    assert password_strength("Senha123!") == "weak"
    assert "fácil de adivinhar: é uma senha muito comum" in weak_password_message("Senha123!")


def test_lista_de_senhas_comuns_igual_a_do_frontend():
    # A regra existe nas duas pontas; se uma lista mudar sem a outra, a tela
    # aceitaria uma senha que o backend recusa (ou o contrário)
    source = FRONTEND_RULE.read_text(encoding="utf-8")
    block = re.search(r"COMMON_PASSWORDS = new Set\(\[(.*?)\]\)", source, re.S).group(1)
    assert set(re.findall(r'"([a-z]+)"', block)) == COMMON_PASSWORDS


# ---------- Cadastro ----------


def test_cadastro_recusa_senha_fraca_com_a_mensagem(anon_client):
    response = anon_client.post(
        "/auth/register", json={"email": "nova@teste.com", "password": "girassol"}
    )

    assert response.status_code == 422
    assert "A senha está fraca" in response.json()["detail"][0]["msg"]


@pytest.mark.parametrize("password", ["girassol1!", "Senha-Forte-123"])
def test_cadastro_aceita_senha_mediana_e_forte(anon_client, password):
    response = anon_client.post(
        "/auth/register", json={"email": "nova@teste.com", "password": password}
    )

    assert response.status_code == 201


@pytest.mark.parametrize(
    "email, password, message",
    [
        ("nova@teste.com", "Senha123!", "é uma senha muito comum"),
        ("joao.silva@teste.com", "Joaosilva2024!", "contém o seu e-mail"),
    ],
)
def test_cadastro_recusa_senha_obvia(anon_client, email, password, message):
    response = anon_client.post("/auth/register", json={"email": email, "password": password})

    assert response.status_code == 422
    assert message in response.json()["detail"][0]["msg"]


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
