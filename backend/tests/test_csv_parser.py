from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest

from app.services.csv_parser import CSVParseError, _parse_amount, parse_statement

FIXTURES = Path(__file__).parent / "fixtures" / "extratos"


def _parse_fixture(name: str):
    return parse_statement((FIXTURES / name).read_bytes())


# ---------- Extratos de exemplo de cada banco ----------


@pytest.mark.parametrize(
    "filename, format_key, count",
    [
        ("nubank_conta.csv", "nubank_conta", 13),
        ("nubank_cartao.csv", "nubank_cartao", 12),
        ("itau.csv", "itau", 11),
        ("inter.csv", "inter", 11),
        ("bradesco.csv", "bradesco", 11),
        ("banco_do_brasil.csv", "banco_do_brasil", 11),
    ],
)
def test_reconhece_o_formato_de_cada_banco(filename, format_key, count):
    result = _parse_fixture(filename)

    assert result.format.key == format_key
    assert len(result.transactions) == count


@pytest.mark.parametrize("filename", ["itau.csv", "inter.csv", "bradesco.csv", "banco_do_brasil.csv"])
def test_soma_dos_lancamentos_bate_com_os_saldos_do_extrato(filename):
    # Nesses extratos o saldo vai de 1.500,00 para 5.248,31: se valores ou
    # linhas de saldo forem lidos errado, a soma não fecha
    transactions = _parse_fixture(filename).transactions

    assert sum(t["amount"] for t in transactions) == Decimal("5248.31") - Decimal("1500.00")


@pytest.mark.parametrize("filename", ["itau.csv", "inter.csv", "bradesco.csv", "banco_do_brasil.csv"])
def test_pula_linhas_de_saldo(filename):
    descriptions = [t["description"].upper() for t in _parse_fixture(filename).transactions]

    assert not any("SALDO" in d or "S A L D O" in d for d in descriptions)


def test_nubank_conta():
    first = _parse_fixture("nubank_conta.csv").transactions[0]

    assert first == {
        "date": date(2025, 3, 1),
        "description": "Transferência recebida - SALARIO EMPRESA X",
        "amount": Decimal("4500.00"),
    }


def test_fatura_de_cartao_inverte_o_sinal():
    by_description = {t["description"]: t["amount"] for t in _parse_fixture("nubank_cartao.csv").transactions}

    assert by_description["Celular Novo"] == Decimal("-1500.00")  # compra = saída
    assert by_description["Pagamento recebido"] == Decimal("1000.00")
    assert by_description["Estorno Padaria São João"] == Decimal("35.50")


def test_itau_pula_cabecalho_e_le_valor_com_milhar():
    transactions = _parse_fixture("itau.csv").transactions

    assert transactions[0]["description"] == "SALARIO EMPRESA X"
    assert transactions[0]["amount"] == Decimal("4500.00")  # "4.500,00"


def test_inter_junta_historico_e_descricao():
    first = _parse_fixture("inter.csv").transactions[0]

    assert first["description"] == "PIX RECEBIDO - Transferência de SALARIO"


def test_bradesco_le_credito_e_debito_separados():
    by_description = {t["description"]: t["amount"] for t in _parse_fixture("bradesco.csv").transactions}

    assert by_description["SALARIO EMPRESA X"] == Decimal("4500.00")
    assert by_description["UBER"] == Decimal("-15.90")


@pytest.mark.parametrize(
    "filename, description",
    [
        ("nubank_conta.csv", "Compra no débito - Farmacia Preço, Saude e Cia"),
        ("itau.csv", "FARMACIA PRECO; SAUDE E CIA"),
        ("bradesco.csv", "FARMACIA PRECO; SAUDE E CIA"),
        ("banco_do_brasil.csv", "Compra com Cartão - Farmacia Preço, Saude e Cia"),
    ],
)
def test_descricao_com_o_proprio_separador_entre_aspas(filename, description):
    descriptions = [t["description"] for t in _parse_fixture(filename).transactions]

    assert description in descriptions


# ---------- Formato genérico e casos de borda ----------


def test_formato_generico_do_readme():
    result = parse_statement(b"data,descricao,valor\n2025-01-05,IFOOD,-45.90\n05/01/2025,UBER,-10\n")

    assert result.format.key == "generico"
    assert [t["date"] for t in result.transactions] == [date(2025, 1, 5), date(2025, 1, 5)]


def test_arquivo_em_windows_1252_com_acentos():
    content = "data;lançamento;valor\n05/03/2025;PADARIA SÃO JOÃO;-35,50\n".encode("cp1252")

    [transaction] = parse_statement(content).transactions

    assert transaction["description"] == "PADARIA SÃO JOÃO"


def test_arquivo_utf8_com_bom():
    content = "data,descricao,valor\n2025-01-05,IFOOD,-45.90\n".encode("utf-8-sig")

    assert parse_statement(content).format.key == "generico"


def test_ignora_linhas_em_branco():
    content = b"data,descricao,valor\n\n2025-01-05,IFOOD,-45.90\n,,\n"

    assert len(parse_statement(content).transactions) == 1


def test_formato_desconhecido_lista_os_suportados():
    with pytest.raises(CSVParseError, match="não reconhecido.*Nubank.*Itaú"):
        parse_statement(b"coluna1,coluna2\n1,2\n")


def test_erro_informa_a_linha():
    content = b"data,descricao,valor\n2025-01-05,IFOOD,-45.90\n2025-13-40,UBER,-10\n"

    with pytest.raises(CSVParseError, match="Linha 3: data inválida"):
        parse_statement(content)


def test_bradesco_sem_credito_nem_debito_e_erro():
    content = "Data;Histórico;Crédito (R$);Débito (R$)\n05/03/2025;UBER;;\n".encode()

    with pytest.raises(CSVParseError, match="sem valor de crédito nem de débito"):
        parse_statement(content)


def test_extrato_so_com_saldo_e_erro():
    content = "data;lançamento;valor\n01/03/2025;SALDO ANTERIOR;1.500,00\n".encode()

    with pytest.raises(CSVParseError, match="nenhum lançamento"):
        parse_statement(content)


@pytest.mark.parametrize(
    "text, decimal_comma, expected",
    [
        ("1.234,56", True, "1234.56"),
        ("1234,56", True, "1234.56"),
        ("-35,50", True, "-35.50"),
        ("1.500", True, "1500"),  # milhar, num banco com vírgula decimal
        ("1.500", False, "1.500"),  # decimal, num banco com ponto decimal
        ("1,234.56", False, "1234.56"),
        ("-35.50", False, "-35.50"),
        ("R$ 1.234,56", True, "1234.56"),
        ("(35,50)", True, "-35.50"),
        ("35,50-", True, "-35.50"),
    ],
)
def test_parse_amount(text, decimal_comma, expected):
    assert _parse_amount(text, decimal_comma) == Decimal(expected)


def test_parse_amount_invalido():
    with pytest.raises(ValueError, match="valor inválido"):
        _parse_amount("abc", decimal_comma=False)
