"""Casos extremos: extratos grandes, textos estranhos e caminhos pouco usados."""
from datetime import date
from decimal import Decimal

import pytest

import app.create_user as create_user_module
from app.db import get_db
from app.models.category import Category
from app.models.user import User
from app.services.csv_parser import CSVParseError, parse_statement


# ---------- Upload ----------


def test_extrato_com_5000_linhas(client, upload, categories):
    lines = [f"2025-03-{i % 28 + 1:02d},{'IFOOD' if i % 2 else 'LOJA'} {i},-{i}.50" for i in range(5000)]

    response = upload("data,descricao,valor\n" + "\n".join(lines) + "\n")

    assert response.status_code == 200
    transactions = response.json()
    assert len(transactions) == 5000
    assert [t["description"] for t in transactions[:2]] == ["LOJA 0", "IFOOD 1"]  # ordem do arquivo
    assert sum(t["category_id"] == categories["alimentacao"].id for t in transactions) == 2500
    assert client.get("/statements").json()[0]["transaction_count"] == 5000


def test_descricao_muito_longa_e_caracteres_especiais_voltam_intactos(client, upload):
    long_description = "COMPRA " + "X" * 2000
    special = 'CAFÉ ☕ & "CIA" <script>alert(1)</script> 😀'
    content = f'data,descricao,valor\n2025-03-01,{long_description},-1\n2025-03-02,"{special.replace(chr(34), chr(34) * 2)}",-2\n'

    upload(content)

    descriptions = {t["description"] for t in client.get("/transactions").json()}
    assert descriptions == {long_description, special}


def test_arquivo_com_quebra_de_linha_do_windows(upload):
    response = upload("data,descricao,valor\r\n2025-03-01,IFOOD,-10\r\n2025-03-02,UBER,-5\r\n")

    assert len(response.json()) == 2


def test_valor_zero_e_ano_com_dois_digitos():
    [transaction] = parse_statement("data;lançamento;valor\n05/03/25;AJUSTE;0,00\n".encode()).transactions

    assert transaction["date"] == date(2025, 3, 5)
    assert transaction["amount"] == Decimal("0.00")


def test_arquivo_com_codificacao_ilegivel():
    # 0x81 e 0x8D não existem nem em UTF-8 nem em Windows-1252
    with pytest.raises(CSVParseError, match="codificação"):
        parse_statement(b"data,descricao,valor\n2025-03-01,\x81\x8d,-1\n")


def test_cabecalho_depois_da_linha_20_nao_e_procurado():
    content = "linha de texto\n" * 25 + "data,descricao,valor\n2025-03-01,IFOOD,-1\n"

    with pytest.raises(CSVParseError, match="não reconhecido"):
        parse_statement(content.encode())


# ---------- get_db ----------


def test_get_db_abre_e_fecha_a_sessao():
    generator = get_db()
    session = next(generator)
    assert session.is_active

    with pytest.raises(StopIteration):
        next(generator)  # sai do "yield" e roda o finally (close)


# ---------- Comando create_user ----------


@pytest.fixture
def run_create_user(db_session, monkeypatch, capsys):
    """Roda o main() do comando com o banco dos testes e as senhas digitadas."""

    def _run(email: str, *passwords: str):
        answers = iter(passwords)
        monkeypatch.setattr(create_user_module.getpass, "getpass", lambda prompt="": next(answers))
        monkeypatch.setattr(create_user_module, "SessionLocal", lambda: db_session)
        monkeypatch.setattr("sys.argv", ["create_user", email])
        create_user_module.main()
        return capsys.readouterr().out

    return _run


def test_comando_create_user_cria_e_atribui_dados_sem_dono(run_create_user, db_session):
    db_session.add(Category(name="Antiga"))
    db_session.commit()

    output = run_create_user("eu@teste.com", "senha-forte-123", "senha-forte-123")

    assert "Usuário eu@teste.com criado" in output
    assert "0 extrato(s) e 1 categoria(s)" in output
    assert db_session.query(User).filter_by(email="eu@teste.com").one()


def test_comando_create_user_senhas_diferentes(run_create_user, db_session):
    with pytest.raises(SystemExit, match="As senhas não conferem"):
        run_create_user("eu@teste.com", "senha-forte-123", "outra-senha-123")

    assert db_session.query(User).count() == 0


def test_comando_create_user_email_repetido(run_create_user, user):
    with pytest.raises(SystemExit, match="Já existe"):
        run_create_user("ana@teste.com", "senha-forte-123", "senha-forte-123")
