"""Tela "Editar perfil": PATCH /auth/me e a foto em /auth/me/avatar."""
from base64 import b64decode
from datetime import date, timedelta

import pytest

from app.routers.profile import AVATAR_MAX_BYTES
from app.schemas.user import today
from tests.conftest import PASSWORD

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 50
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 50
WEBP = b"RIFF\x00\x00\x00\x00WEBPVP8 " + b"\x00" * 50


def _profile(**changes):
    return {"name": "Ana Souza", "email": "ana@teste.com", "birth_date": "1992-08-17", **changes}


# ---------- Dados pessoais ----------


def test_conta_nova_comeca_sem_perfil(client):
    body = client.get("/auth/me").json()

    assert body["name"] is None
    assert body["birth_date"] is None
    assert body["avatar_url"] is None


def test_salva_nome_e_data_de_nascimento(client):
    response = client.patch("/auth/me", json=_profile(name="  Ana   Souza "))

    assert response.status_code == 200
    assert response.json()["name"] == "Ana Souza"  # espaços extras saem
    me = client.get("/auth/me").json()
    assert me["name"] == "Ana Souza"
    assert me["birth_date"] == "1992-08-17"


def test_data_de_nascimento_e_opcional(client):
    client.patch("/auth/me", json=_profile())

    response = client.patch("/auth/me", json=_profile(birth_date=None))

    assert response.status_code == 200
    assert response.json()["birth_date"] is None


@pytest.mark.parametrize(
    "changes, message",
    [
        ({"name": " a "}, "Informe seu nome"),
        ({"name": "x" * 101}, "no máximo 100 caracteres"),
        ({"email": "sem-arroba"}, "E-mail inválido"),
        ({"birth_date": str(today() + timedelta(days=1))}, "não pode ser no futuro"),
        ({"birth_date": "1899-12-31"}, "Data de nascimento inválida"),
    ],
)
def test_valida_os_campos(client, changes, message):
    response = client.patch("/auth/me", json=_profile(**changes))

    assert response.status_code == 422
    assert message in str(response.json()["detail"])


def test_hoje_e_uma_data_de_nascimento_valida(client):
    response = client.patch("/auth/me", json=_profile(birth_date=str(today())))

    assert response.status_code == 200


def test_precisa_estar_logado(anon_client):
    assert anon_client.patch("/auth/me", json=_profile()).status_code == 401
    assert anon_client.put("/auth/me/avatar", files={"file": ("a.png", PNG)}).status_code == 401
    assert anon_client.delete("/auth/me/avatar").status_code == 401


# ---------- Troca de e-mail ----------


def test_trocar_email_pede_a_senha_atual(client):
    response = client.patch("/auth/me", json=_profile(email="nova@teste.com"))

    assert response.status_code == 400
    assert response.json()["detail"] == "Digite sua senha atual para trocar o e-mail"


def test_trocar_email_com_senha_errada(client):
    response = client.patch(
        "/auth/me", json=_profile(email="nova@teste.com", current_password="errada")
    )

    assert response.status_code == 400  # não 401: o frontend deslogaria
    assert response.json()["detail"] == "Senha atual incorreta"
    assert client.get("/auth/me").json()["email"] == "ana@teste.com"


def test_troca_o_email_e_o_login_passa_a_ser_pelo_novo(client, anon_client):
    response = client.patch(
        "/auth/me", json=_profile(email="  Ana.Nova@Teste.com ", current_password=PASSWORD)
    )

    assert response.status_code == 200
    assert response.json()["email"] == "ana.nova@teste.com"
    login = anon_client.post(
        "/auth/login", data={"username": "ana.nova@teste.com", "password": PASSWORD}
    )
    assert login.status_code == 200
    old = anon_client.post("/auth/login", data={"username": "ana@teste.com", "password": PASSWORD})
    assert old.status_code == 401


def test_nao_troca_para_email_de_outra_conta(client, other_user):
    response = client.patch(
        "/auth/me", json=_profile(email="BRUNO@teste.com", current_password=PASSWORD)
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "E-mail já cadastrado"


def test_mesmo_email_em_maiusculas_nao_e_troca(client):
    # Normalizado, é o mesmo e-mail: não pede senha
    response = client.patch("/auth/me", json=_profile(email="ANA@teste.com"))

    assert response.status_code == 200


def test_muitas_senhas_erradas_bloqueiam_a_troca(client):
    wrong = _profile(email="nova@teste.com", current_password="errada")
    for _ in range(5):
        assert client.patch("/auth/me", json=wrong).status_code == 400

    right = _profile(email="nova@teste.com", current_password=PASSWORD)
    response = client.patch("/auth/me", json=right)

    assert response.status_code == 429


def test_um_usuario_so_edita_o_proprio_perfil(client, other_client):
    client.patch("/auth/me", json=_profile(name="Ana Souza"))

    assert other_client.get("/auth/me").json()["name"] is None


# ---------- Foto ----------


@pytest.mark.parametrize("content, content_type", [(PNG, "image/png"), (JPEG, "image/jpeg"), (WEBP, "image/webp")])
def test_envia_foto(client, content, content_type):
    # Nome e Content-Type do cliente não importam: o tipo vem dos bytes
    response = client.put(
        "/auth/me/avatar", files={"file": ("foto.bin", content, "application/octet-stream")}
    )

    assert response.status_code == 200
    url = response.json()["avatar_url"]
    prefix = f"data:{content_type};base64,"
    assert url.startswith(prefix)
    assert b64decode(url[len(prefix):]) == content
    assert client.get("/auth/me").json()["avatar_url"] == url


def test_troca_e_remove_a_foto(client):
    client.put("/auth/me/avatar", files={"file": ("a.png", PNG)})
    client.put("/auth/me/avatar", files={"file": ("b.jpg", JPEG)})
    assert client.get("/auth/me").json()["avatar_url"].startswith("data:image/jpeg")

    response = client.delete("/auth/me/avatar")

    assert response.status_code == 200
    assert response.json()["avatar_url"] is None
    assert client.get("/auth/me").json()["avatar_url"] is None


def test_salvar_os_dados_nao_apaga_a_foto(client):
    client.put("/auth/me/avatar", files={"file": ("a.png", PNG)})

    response = client.patch("/auth/me", json=_profile())

    assert response.json()["avatar_url"].startswith("data:image/png")


@pytest.mark.parametrize(
    "content",
    [b"GIF89a" + b"\x00" * 20, b"<svg xmlns='http://www.w3.org/2000/svg'/>", b"%PDF-1.4", b""],
)
def test_recusa_o_que_nao_e_foto(client, content):
    response = client.put("/auth/me/avatar", files={"file": ("foto.png", content, "image/png")})

    assert response.status_code == 400
    assert response.json()["detail"] == "Envie uma foto em JPG, PNG ou WebP"


def test_recusa_foto_grande_demais(client):
    content = PNG + b"\x00" * (AVATAR_MAX_BYTES - len(PNG) + 1)

    response = client.put("/auth/me/avatar", files={"file": ("grande.png", content)})

    assert response.status_code == 400
    assert response.json()["detail"] == "A foto pode ter no máximo 1 MB"


def test_foto_no_limite_e_aceita(client):
    content = PNG + b"\x00" * (AVATAR_MAX_BYTES - len(PNG))

    assert client.put("/auth/me/avatar", files={"file": ("ok.png", content)}).status_code == 200


def test_data_de_nascimento_volta_como_data(client):
    client.patch("/auth/me", json=_profile(birth_date="2000-02-29"))

    assert date.fromisoformat(client.get("/auth/me").json()["birth_date"]) == date(2000, 2, 29)
