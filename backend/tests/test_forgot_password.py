"""'Esqueceu a senha?': pedir o link (POST /auth/forgot-password) e redefinir (POST /auth/reset-password)."""
import logging
import re
import smtplib
from datetime import datetime, timedelta, timezone

import pytest

from app import config
from app.models.password_reset import PasswordResetToken
from app.routers.auth import FORGOT_PASSWORD_MESSAGE, INVALID_RESET_LINK
from app.services import email as email_service
from app.services.password_reset import _hash
from tests.conftest import PASSWORD

NEW_PASSWORD = "Girassol#Azul91"


@pytest.fixture
def outbox(monkeypatch):
    """E-mails "enviados" (no lugar do SMTP)."""
    sent = []
    monkeypatch.setattr(
        "app.routers.auth.send_email",
        lambda to, subject, text: sent.append({"to": to, "subject": subject, "text": text}),
    )
    return sent


def _forgot(client, email="ana@teste.com"):
    return client.post("/auth/forgot-password", json={"email": email})


def _token_from(mail) -> str:
    return re.search(r"/redefinir-senha\?token=([\w-]+)", mail["text"]).group(1)


def _reset(client, token, new_password=NEW_PASSWORD):
    return client.post("/auth/reset-password", json={"token": token, "new_password": new_password})


def _login(client, password):
    return client.post("/auth/login", data={"username": "ana@teste.com", "password": password})


# ---------- Pedir o link ----------


def test_manda_o_link_por_email(anon_client, user, outbox):
    response = _forgot(anon_client, "  ANA@teste.com ")

    assert response.status_code == 200
    assert response.json() == {"message": FORGOT_PASSWORD_MESSAGE}
    assert len(outbox) == 1
    mail = outbox[0]
    assert mail["to"] == "ana@teste.com"
    assert mail["subject"] == "Vexira: redefinir sua senha"
    assert f"{config.FRONTEND_URL}/redefinir-senha?token=" in mail["text"]
    assert "30 minutos" in mail["text"]
    assert "Se não foi você" in mail["text"]


def test_email_sem_conta_responde_igual_e_nao_manda_nada(anon_client, user, outbox):
    response = _forgot(anon_client, "ninguem@teste.com")

    # Mesma resposta: não dá para descobrir quem tem cadastro
    assert (response.status_code, response.json()) == (200, {"message": FORGOT_PASSWORD_MESSAGE})
    assert outbox == []


def test_o_banco_guarda_so_o_hash_do_codigo(anon_client, user, outbox, db_session):
    _forgot(anon_client)
    token = _token_from(outbox[0])

    row = db_session.query(PasswordResetToken).one()
    assert row.token_hash == _hash(token)
    assert token not in row.token_hash
    assert len(token) >= 40  # 256 bits aleatórios


def test_limite_de_pedidos_por_email(anon_client, user, outbox):
    for _ in range(3):
        assert _forgot(anon_client).status_code == 200

    response = _forgot(anon_client)

    assert response.status_code == 429
    assert "Muitos pedidos de redefinição" in response.json()["detail"]
    assert int(response.headers["Retry-After"]) > 0
    assert len(outbox) == 3


def test_limite_de_pedidos_por_ip_vale_para_qualquer_email(anon_client, outbox):
    for i in range(10):
        assert _forgot(anon_client, f"pessoa{i}@teste.com").status_code == 200

    assert _forgot(anon_client, "outra@teste.com").status_code == 429


def test_email_gigante_da_422(anon_client):
    assert _forgot(anon_client, "a" * 400 + "@teste.com").status_code == 422


# ---------- Redefinir ----------


def test_redefine_a_senha_pelo_link(anon_client, user, outbox):
    _forgot(anon_client)

    response = _reset(anon_client, _token_from(outbox[0]))

    assert response.status_code == 200
    assert response.json() == {"message": "Senha redefinida. Entre com a senha nova."}
    assert _login(anon_client, NEW_PASSWORD).status_code == 200
    assert _login(anon_client, PASSWORD).status_code == 401


def test_link_so_vale_uma_vez(anon_client, user, outbox):
    _forgot(anon_client)
    token = _token_from(outbox[0])
    _reset(anon_client, token)

    response = _reset(anon_client, token, "Outra#Senha9876")

    assert (response.status_code, response.json()["detail"]) == (400, INVALID_RESET_LINK)
    assert _login(anon_client, NEW_PASSWORD).status_code == 200


def test_pedir_outro_link_cancela_o_anterior(anon_client, user, outbox):
    _forgot(anon_client)
    _forgot(anon_client)
    old, new = _token_from(outbox[0]), _token_from(outbox[1])

    assert _reset(anon_client, old).status_code == 400
    assert _reset(anon_client, new).status_code == 200


def test_link_vencido(anon_client, user, outbox, db_session):
    _forgot(anon_client)
    row = db_session.query(PasswordResetToken).one()
    row.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    db_session.commit()

    response = _reset(anon_client, _token_from(outbox[0]))

    assert (response.status_code, response.json()["detail"]) == (400, INVALID_RESET_LINK)


@pytest.mark.parametrize("token", ["inventado", "", "x" * 60])
def test_link_inventado(anon_client, user, token):
    response = _reset(anon_client, token)

    assert (response.status_code, response.json()["detail"]) == (400, INVALID_RESET_LINK)


def test_link_marcado_como_usado_nao_vale(anon_client, user, outbox, db_session):
    _forgot(anon_client)
    row = db_session.query(PasswordResetToken).one()
    row.used_at = datetime.now(timezone.utc)
    db_session.commit()

    assert _reset(anon_client, _token_from(outbox[0])).status_code == 400


@pytest.mark.parametrize(
    "new_password, message",
    [("curta1A", "pelo menos 8 caracteres"), ("Senha123!", "fácil de adivinhar")],
)
def test_nova_senha_segue_a_regra_do_cadastro(anon_client, user, outbox, new_password, message):
    _forgot(anon_client)
    token = _token_from(outbox[0])

    response = _reset(anon_client, token, new_password)

    assert response.status_code == 400
    assert message in response.json()["detail"]
    # O link continua valendo para tentar com uma senha boa
    assert _reset(anon_client, token).status_code == 200


def test_senha_acima_de_72_bytes_da_422(anon_client):
    assert _reset(anon_client, "qualquer", "Á1b!" * 20).status_code == 422


def test_redefinir_derruba_as_sessoes_abertas(anon_client, client, user, outbox):
    # "client" estava logado desde antes (outro aparelho, ou quem roubou a senha)
    from app.services.security import create_access_token

    old_token = create_access_token(user.id, issued_at=datetime.now(timezone.utc) - timedelta(minutes=1))
    _forgot(anon_client)

    _reset(anon_client, _token_from(outbox[0]))

    response = anon_client.get("/auth/me", headers={"Authorization": f"Bearer {old_token}"})
    assert response.status_code == 401


def test_link_de_uma_conta_nao_troca_a_senha_de_outra(anon_client, user, other_user, outbox):
    _forgot(anon_client, "bruno@teste.com")

    _reset(anon_client, _token_from(outbox[0]))

    # Só a senha do Bruno mudou
    assert _login(anon_client, PASSWORD).status_code == 200
    bruno = anon_client.post("/auth/login", data={"username": "bruno@teste.com", "password": NEW_PASSWORD})
    assert bruno.status_code == 200


def test_trocar_a_senha_no_perfil_cancela_o_link(anon_client, client, user, outbox):
    _forgot(anon_client)
    client.post("/auth/me/password", json={"current_password": PASSWORD, "new_password": "Outra#Senha9876"})

    assert _reset(anon_client, _token_from(outbox[0])).status_code == 400


def test_excluir_a_conta_apaga_os_links(anon_client, client, user, outbox, db_session):
    _forgot(anon_client)

    client.request("DELETE", "/auth/me", json={"password": PASSWORD})

    assert db_session.query(PasswordResetToken).count() == 0


# ---------- Envio do e-mail ----------


class FakeSMTP:
    instances: list = []

    def __init__(self, host, port, **kwargs):
        self.host, self.port, self.calls = host, port, []
        FakeSMTP.instances.append(self)

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def starttls(self, context=None):
        self.calls.append("starttls")

    def login(self, user, password):
        self.calls.append(("login", user))

    def send_message(self, message):
        self.calls.append(("send", message["To"], message["Subject"], message.get_content()))


@pytest.fixture
def smtp(monkeypatch):
    FakeSMTP.instances = []
    monkeypatch.setattr(smtplib, "SMTP", FakeSMTP)
    monkeypatch.setattr(smtplib, "SMTP_SSL", FakeSMTP)
    monkeypatch.setattr(config, "SMTP_HOST", "smtp.exemplo.com")
    monkeypatch.setattr(config, "SMTP_USER", "vexira")
    monkeypatch.setattr(config, "SMTP_PASSWORD", "segredo")
    return FakeSMTP


def test_envia_por_smtp_com_starttls(smtp, monkeypatch):
    monkeypatch.setattr(config, "SMTP_SECURITY", "starttls")

    email_service.send_email("ana@teste.com", "Assunto", "Texto")

    server = smtp.instances[0]
    assert (server.host, server.port) == ("smtp.exemplo.com", config.SMTP_PORT)
    assert server.calls == ["starttls", ("login", "vexira"), ("send", "ana@teste.com", "Assunto", "Texto\n")]


def test_envia_por_smtp_com_ssl_e_sem_login(smtp, monkeypatch):
    monkeypatch.setattr(config, "SMTP_SECURITY", "ssl")
    monkeypatch.setattr(config, "SMTP_USER", "")

    email_service.send_email("ana@teste.com", "Assunto", "Texto")

    assert smtp.instances[0].calls == [("send", "ana@teste.com", "Assunto", "Texto\n")]


def test_falha_no_smtp_so_registra_no_log(smtp, monkeypatch, caplog):
    def broken(*args, **kwargs):
        raise OSError("sem rede")

    monkeypatch.setattr(smtplib, "SMTP", broken)

    with caplog.at_level(logging.ERROR, logger="app.services.email"):
        email_service.send_email("ana@teste.com", "Assunto", "Texto")

    assert "Falha ao enviar e-mail para ana@teste.com" in caplog.text


def test_sem_smtp_e_site_local_o_email_vai_para_o_log(monkeypatch, caplog):
    monkeypatch.setattr(config, "SMTP_HOST", "")
    monkeypatch.setattr(config, "FRONTEND_URL", "http://localhost:5173")

    with caplog.at_level(logging.WARNING, logger="app.services.email"):
        email_service.send_email("ana@teste.com", "Assunto", "link-secreto")

    assert "link-secreto" in caplog.text


def test_sem_smtp_e_site_publico_o_link_nao_vai_para_o_log(monkeypatch, caplog):
    monkeypatch.setattr(config, "SMTP_HOST", "")
    monkeypatch.setattr(config, "FRONTEND_URL", "https://vexira.com.br")

    with caplog.at_level(logging.WARNING, logger="app.services.email"):
        email_service.send_email("ana@teste.com", "Assunto", "link-secreto")

    # Link num log de servidor deixaria quem lê o log trocar a senha de qualquer um
    assert "link-secreto" not in caplog.text
    assert "configure SMTP_HOST" in caplog.text


def test_pedido_de_verdade_passa_pelo_envio_em_segundo_plano(anon_client, user, smtp, monkeypatch):
    monkeypatch.setattr(config, "SMTP_SECURITY", "starttls")

    _forgot(anon_client)

    sent = smtp.instances[0].calls[-1]
    assert sent[:3] == ("send", "ana@teste.com", "Vexira: redefinir sua senha")
    assert "/redefinir-senha?token=" in sent[3]
