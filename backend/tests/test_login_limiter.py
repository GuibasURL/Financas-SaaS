"""Limite de tentativas de login erradas: a regra (relógio falso) e o endpoint."""
import pytest

from app.routers.auth import login_limiter
from app.services.login_limiter import LoginLimiter
from tests.conftest import PASSWORD


class FakeClock:
    def __init__(self):
        self.now = 1000.0

    def __call__(self):
        return self.now


@pytest.fixture
def clock():
    return FakeClock()


@pytest.fixture
def limiter(clock):
    return LoginLimiter(max_per_account=3, max_per_ip=5, window_seconds=600, clock=clock)


# ---------- Regra ----------


def test_bloqueia_a_conta_depois_do_limite_de_falhas(limiter):
    for _ in range(2):
        limiter.record_failure("ana@teste.com", "1.1.1.1")
    assert limiter.retry_after("ana@teste.com", "1.1.1.1") == 0

    limiter.record_failure("ana@teste.com", "1.1.1.1")

    assert limiter.retry_after("ana@teste.com", "1.1.1.1") == 600
    # Outra conta no mesmo IP e a mesma conta em outro IP continuam liberadas
    assert limiter.retry_after("bruno@teste.com", "1.1.1.1") == 0
    assert limiter.retry_after("ana@teste.com", "2.2.2.2") == 0


def test_libera_quando_a_falha_mais_antiga_sai_da_janela(limiter, clock):
    limiter.record_failure("ana@teste.com", "1.1.1.1")
    clock.now += 100
    limiter.record_failure("ana@teste.com", "1.1.1.1")
    limiter.record_failure("ana@teste.com", "1.1.1.1")

    assert limiter.retry_after("ana@teste.com", "1.1.1.1") == 500

    clock.now += 499.5
    assert limiter.retry_after("ana@teste.com", "1.1.1.1") == 1  # arredonda para cima
    clock.now += 0.5
    assert limiter.retry_after("ana@teste.com", "1.1.1.1") == 0


def test_bloqueia_o_ip_que_testa_muitos_emails(limiter):
    for i in range(5):
        limiter.record_failure(f"pessoa{i}@teste.com", "1.1.1.1")

    assert limiter.retry_after("nova@teste.com", "1.1.1.1") == 600
    assert limiter.retry_after("nova@teste.com", "2.2.2.2") == 0


def test_login_certo_limpa_as_falhas_da_conta(limiter):
    for _ in range(2):
        limiter.record_failure("ana@teste.com", "1.1.1.1")

    limiter.record_success("ana@teste.com", "1.1.1.1")
    limiter.record_failure("ana@teste.com", "1.1.1.1")

    assert limiter.retry_after("ana@teste.com", "1.1.1.1") == 0


def test_falhas_antigas_nao_ficam_na_memoria(limiter, clock):
    limiter.record_failure("ana@teste.com", "1.1.1.1")
    clock.now += 601

    limiter.record_failure("bruno@teste.com", "2.2.2.2")

    assert set(limiter._failures) == {("account", "bruno@teste.com", "2.2.2.2"), ("ip", "2.2.2.2")}


def test_reset_esquece_tudo(limiter):
    for _ in range(3):
        limiter.record_failure("ana@teste.com", "1.1.1.1")

    limiter.reset()

    assert limiter.retry_after("ana@teste.com", "1.1.1.1") == 0


# ---------- Endpoint ----------


def _login(client, email, password):
    return client.post("/auth/login", data={"username": email, "password": password})


def test_login_bloqueia_depois_de_5_senhas_erradas(anon_client, user):
    for _ in range(5):
        assert _login(anon_client, "ana@teste.com", "senha-errada").status_code == 401

    # Bloqueado mesmo com a senha certa (e o e-mail com outra caixa)
    response = _login(anon_client, "ANA@teste.com", PASSWORD)

    assert response.status_code == 429
    assert response.json()["detail"] == "Muitas tentativas de login. Tente de novo em 15 minutos."
    assert 0 < int(response.headers["Retry-After"]) <= 15 * 60


def test_login_certo_antes_do_limite_zera_a_contagem(anon_client, user):
    for _ in range(4):
        _login(anon_client, "ana@teste.com", "senha-errada")

    assert _login(anon_client, "ana@teste.com", PASSWORD).status_code == 200
    for _ in range(4):
        assert _login(anon_client, "ana@teste.com", "senha-errada").status_code == 401


def test_email_inexistente_tambem_conta(anon_client, db_session):
    for _ in range(5):
        _login(anon_client, "ninguem@teste.com", "qualquer-senha")

    assert _login(anon_client, "ninguem@teste.com", "qualquer-senha").status_code == 429


def test_mensagem_no_singular_quando_falta_pouco(anon_client, user, monkeypatch):
    for _ in range(5):
        _login(anon_client, "ana@teste.com", "senha-errada")
    monkeypatch.setattr(login_limiter, "retry_after", lambda email, ip: 30)

    response = _login(anon_client, "ana@teste.com", PASSWORD)

    assert response.json()["detail"] == "Muitas tentativas de login. Tente de novo em 1 minuto."
    assert response.headers["Retry-After"] == "30"
