import logging

import pytest

from app.config import (
    DEV_SECRET_KEY,
    MIN_SECRET_KEY_BYTES,
    load_secret_key,
    load_timezone,
    parse_cors_origins,
)


def test_chave_de_desenvolvimento_tem_tamanho_minimo():
    assert len(DEV_SECRET_KEY.encode("utf-8")) >= MIN_SECRET_KEY_BYTES


@pytest.mark.parametrize("value", [None, ""])
def test_sem_secret_key_usa_chave_de_dev_e_avisa(value, caplog):
    with caplog.at_level(logging.WARNING, logger="app.config"):
        assert load_secret_key(value) == DEV_SECRET_KEY

    assert "SECRET_KEY não definida" in caplog.text


def test_secret_key_curta_demais_e_recusada():
    with pytest.raises(ValueError, match="pelo menos 32 bytes"):
        load_secret_key("curta")


def test_secret_key_valida_e_usada_sem_aviso(caplog):
    key = "x" * MIN_SECRET_KEY_BYTES

    with caplog.at_level(logging.WARNING, logger="app.config"):
        assert load_secret_key(key) == key

    assert caplog.text == ""


@pytest.mark.parametrize(
    "value, expected",
    [
        (None, ["http://localhost:5173"]),
        ("", ["http://localhost:5173"]),
        ("https://financas.exemplo.com/", ["https://financas.exemplo.com"]),
        (" http://localhost:5174 , https://a.com ", ["http://localhost:5174", "https://a.com"]),
    ],
)
def test_parse_cors_origins(value, expected):
    assert parse_cors_origins(value) == expected


@pytest.mark.parametrize("value", [None, ""])
def test_fuso_padrao_e_brasilia(value):
    assert load_timezone(value).key == "America/Sao_Paulo"


def test_fuso_configurado():
    assert load_timezone("Europe/Lisbon").key == "Europe/Lisbon"


@pytest.mark.parametrize("value", ["Brasil/Nao_Existe", "../etc/passwd"])
def test_fuso_invalido_impede_de_subir(value):
    with pytest.raises(ValueError, match="não é um fuso válido"):
        load_timezone(value)
