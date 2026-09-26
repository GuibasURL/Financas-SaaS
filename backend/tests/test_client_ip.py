"""IP do visitante e HTTPS atrás do proxy do deploy (TRUSTED_PROXY_HOPS)."""
import logging

import pytest
from fastapi import Request

from app import config
from app.routers.auth import login_limiter
from app.services.client_ip import client_ip, is_https


def _request(forwarded_for=None, proto=None, scheme="http", client=("10.0.0.1", 5000)):
    headers = []
    if forwarded_for is not None:
        headers.append((b"x-forwarded-for", forwarded_for.encode()))
    if proto is not None:
        headers.append((b"x-forwarded-proto", proto.encode()))
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/",
            "scheme": scheme,
            "server": ("api", 80),
            "headers": headers,
            "client": client,
        }
    )


@pytest.fixture
def hops(monkeypatch):
    def _set(value: int):
        monkeypatch.setattr(config, "TRUSTED_PROXY_HOPS", value)

    return _set


def test_sem_proxy_usa_o_ip_da_conexao_e_ignora_o_header(hops):
    hops(0)
    # Rodando local, qualquer um mandaria esse header: não vale nada
    assert client_ip(_request("1.2.3.4")) == "10.0.0.1"


def test_sem_conexao_conhecida(hops):
    hops(0)
    assert client_ip(_request(client=None)) == "desconhecido"


@pytest.mark.parametrize(
    "forwarded_for, hop_count, expected",
    [
        # O proxy acrescenta o visitante no fim
        ("200.1.1.1", 1, "200.1.1.1"),
        # Visitante tentando se passar por outro IP: o valor inventado fica à esquerda
        ("6.6.6.6, 200.1.1.1", 1, "200.1.1.1"),
        ("6.6.6.6, 7.7.7.7, 200.1.1.1", 1, "200.1.1.1"),
        # Dois proxies (ex: CDN na frente do balanceador): pula os dois do fim
        ("6.6.6.6, 200.1.1.1, 172.16.0.9", 2, "200.1.1.1"),
    ],
)
def test_atras_do_proxy_conta_pela_direita(hops, forwarded_for, hop_count, expected):
    hops(hop_count)
    assert client_ip(_request(forwarded_for)) == expected


@pytest.mark.parametrize("forwarded_for", [None, "", "200.1.1.1"])
def test_header_faltando_ou_curto_demais_usa_o_ip_da_conexao(hops, forwarded_for):
    hops(2)
    assert client_ip(_request(forwarded_for)) == "10.0.0.1"


def test_log_para_conferir_os_proxies_no_deploy(hops, monkeypatch, caplog):
    hops(1)
    monkeypatch.setattr(config, "LOG_CLIENT_IP", True)

    with caplog.at_level(logging.WARNING, logger="app.services.client_ip"):
        client_ip(_request("6.6.6.6, 200.1.1.1"))

    assert "IP usado=200.1.1.1" in caplog.text


@pytest.mark.parametrize(
    "hop_count, proto, scheme, expected",
    [
        (0, None, "https", True),
        (0, "https", "http", False),  # sem proxy confiável, o header não vale
        (1, "https", "http", True),
        (1, "http", "http", False),
        (1, None, "http", False),
    ],
)
def test_https_atras_do_proxy(hops, hop_count, proto, scheme, expected):
    hops(hop_count)
    assert is_https(_request(proto=proto, scheme=scheme)) is expected


def test_trocar_o_ip_no_header_nao_escapa_do_limite_de_login(anon_client, user, hops, monkeypatch):
    hops(1)
    monkeypatch.setattr(login_limiter, "max_per_ip", 3)

    def attempt(fake_ip):
        # O visitante inventa um IP diferente a cada tentativa; o proxy acrescenta o real
        return anon_client.post(
            "/auth/login",
            data={"username": f"alguem{fake_ip}@teste.com", "password": "errada"},
            headers={"X-Forwarded-For": f"{fake_ip}, 200.1.1.1"},
        )

    assert [attempt(f"6.6.6.{i}").status_code for i in range(3)] == [401, 401, 401]
    assert attempt("6.6.6.99").status_code == 429


def test_hsts_atras_do_proxy(client, hops):
    hops(1)
    response = client.get("/transactions", headers={"X-Forwarded-Proto": "https"})

    assert response.headers["Strict-Transport-Security"].startswith("max-age=")
