import logging

import pytest

from app.config import DEV_SECRET_KEY, MIN_SECRET_KEY_BYTES, load_secret_key


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
