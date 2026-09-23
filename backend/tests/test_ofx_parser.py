"""Extratos OFX: SGML (1.x) e XML (2.x), conta e cartão, e o upload pela API."""
from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest

from app.services.csv_parser import CSVParseError, parse_statement
from app.services.ofx_parser import OFXParseError, looks_like_ofx, parse_ofx
from tests.test_default_categories import _register

FIXTURES = Path(__file__).parent / "fixtures" / "extratos"


def _parse(name: str):
    return parse_statement((FIXTURES / name).read_bytes())


def _ofx(*transactions: str) -> str:
    """OFX 1.x mínimo com os <STMTTRN> dados."""
    return (
        "OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\n\n<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS>"
        "<BANKTRANLIST>\n" + "\n".join(transactions) + "\n</BANKTRANLIST></STMTRS></STMTTRNRS>"
        "</BANKMSGSRSV1></OFX>"
    )


def _trn(amount="-10.00", date_="20250301", fitid="1", trntype="DEBIT", extra="<MEMO>COMPRA"):
    return (
        f"<STMTTRN>\n<TRNTYPE>{trntype}\n<DTPOSTED>{date_}\n<TRNAMT>{amount}\n"
        f"<FITID>{fitid}\n{extra}\n</STMTTRN>"
    )


# ---------- Arquivos de exemplo ----------


def test_conta_em_ofx_1_sgml():
    result = _parse("conta_sgml.ofx")
    by_description = {t["description"]: t["amount"] for t in result.transactions}

    assert result.format.key == "ofx"
    assert len(result.transactions) == 10  # 11 no arquivo, 1 repetido (mesmo FITID)
    assert result.transactions[0] == {
        "date": date(2025, 3, 1),
        "description": "TED RECEBIDA SALARIO EMPRESA X",
        "amount": Decimal("4500.00"),
    }
    # Windows-1252 com acento; NAME + MEMO juntos
    assert by_description["PADARIA SÃO JOÃO - COMPRA CARTAO DEBITO"] == Decimal("-35.50")
    assert by_description["UBER *TRIP"] == Decimal("-15.90")  # só NAME
    assert by_description["IFOOD *RESTAURANTE"] == Decimal("-55.90")  # "-55,90" (fora do padrão)
    assert by_description["NETFLIX.COM"] == Decimal("-39.90")  # DEBIT positivo vira saída
    assert by_description["PAGAMENTO DE FATURA CARTAO"] == Decimal("-1234.56")


def test_fatura_de_cartao_em_ofx_2_xml():
    result = _parse("cartao_xml.ofx")

    assert result.format.key == "ofx"
    assert [(t["description"], t["amount"]) for t in result.transactions] == [
        ("SUPERMERCADO DIA", Decimal("-89.90")),
        ("M&M CAFETERIA", Decimal("-42.00")),  # entidade &amp; do XML
        ("Spotify", Decimal("-21.90")),
        ("Pagamento recebido", Decimal("1234.56")),
    ]


# ---------- Regras ----------


@pytest.mark.parametrize(
    "text, expected",
    [
        ("OFXHEADER:100\nDATA:OFXSGML", True),
        ("﻿  OFXHEADER:100", True),
        ('<?xml version="1.0"?>\n<?OFX OFXHEADER="200"?>\n<OFX>', True),
        ("data,descricao,valor\n2025-01-01,X,-1", False),
    ],
)
def test_reconhece_ofx(text, expected):
    assert looks_like_ofx(text.lstrip("﻿")) is expected


@pytest.mark.parametrize(
    "raw, expected",
    [
        ("20250305", date(2025, 3, 5)),
        ("20250305120000", date(2025, 3, 5)),
        ("20250305120000.000[-3:BRT]", date(2025, 3, 5)),
    ],
)
def test_formatos_de_data(raw, expected):
    assert parse_ofx(_ofx(_trn(date_=raw)))[0]["date"] == expected


@pytest.mark.parametrize(
    "extra, description",
    [
        ("<NAME>PADARIA\n<MEMO>COMPRA DEBITO", "PADARIA - COMPRA DEBITO"),
        ("<NAME>IFOOD\n<MEMO>COMPRA IFOOD *RESTAURANTE", "COMPRA IFOOD *RESTAURANTE"),  # MEMO contém NAME
        ("<NAME>COMPRA IFOOD *RESTAURANTE\n<MEMO>IFOOD", "COMPRA IFOOD *RESTAURANTE"),  # NAME contém MEMO
        ("<MEMO>  PIX   ENVIADO  ", "PIX ENVIADO"),  # espaços extras
        ("<CHECKNUM>123", "Lançamento sem descrição"),
    ],
)
def test_descricao(extra, description):
    assert parse_ofx(_ofx(_trn(extra=extra)))[0]["description"] == description


def test_credito_e_debito_mantem_o_sinal_do_arquivo():
    transactions = parse_ofx(
        _ofx(
            _trn("200.00", fitid="1", trntype="CREDIT"),
            _trn("-15.00", fitid="2", trntype="DEBIT"),
            _trn("-5.00", fitid="3", trntype="OTHER"),
            _trn("7.00", fitid="4", trntype="FEE"),  # tarifa positiva: fora do padrão, vira saída
        )
    )
    assert [t["amount"] for t in transactions] == [
        Decimal("200.00"),
        Decimal("-15.00"),
        Decimal("-5.00"),
        Decimal("-7.00"),
    ]


def test_sem_fechamento_do_stmttrn():
    # Alguns bancos omitem o </STMTTRN> no SGML: cada lançamento vai até o próximo
    text = _ofx(_trn(fitid="1").replace("</STMTTRN>", ""), _trn(fitid="2").replace("</STMTTRN>", ""))
    assert len(parse_ofx(text)) == 2


def test_lancamentos_sem_fitid_nao_sao_descartados():
    text = _ofx(_trn(fitid=""), _trn(fitid=""))
    assert len(parse_ofx(text)) == 2


def test_pula_linha_de_saldo():
    text = _ofx(_trn(extra="<MEMO>SALDO ANTERIOR", fitid="1"), _trn(fitid="2"))
    assert [t["description"] for t in parse_ofx(text)] == ["COMPRA"]


@pytest.mark.parametrize(
    "transaction, message",
    [
        ("<STMTTRN>\n<DTPOSTED>20250301\n<MEMO>X\n</STMTTRN>", "lançamento sem TRNAMT"),
        ("<STMTTRN>\n<TRNAMT>-1\n<MEMO>X\n</STMTTRN>", "lançamento sem DTPOSTED"),
        (_trn(amount="abc"), "valor inválido"),
        (_trn(date_="ontem"), "data inválida"),
        (_trn(date_="20251345"), "data inválida"),
    ],
)
def test_erros_dizem_a_linha_e_o_problema(transaction, message):
    with pytest.raises(OFXParseError, match=rf"Linha \d+: .*{message}"):
        parse_ofx(_ofx(transaction))


def test_ofx_sem_lancamentos_e_erro_de_leitura():
    with pytest.raises(CSVParseError, match="não tem nenhum lançamento"):
        parse_statement(_ofx().encode())


def test_csv_desconhecido_sugere_ofx():
    with pytest.raises(CSVParseError, match="envie o extrato em OFX"):
        parse_statement(b"coluna,outra\n1,2\n")


# ---------- Upload pela API ----------


def test_upload_de_ofx_numa_conta_nova_ja_categoriza(anon_client):
    headers = _register(anon_client)

    response = anon_client.post(
        "/upload",
        headers=headers,
        files={"file": ("extrato.OFX", (FIXTURES / "conta_sgml.ofx").read_bytes(), "application/x-ofx")},
    )

    assert response.status_code == 200
    transactions = response.json()
    names = {c["id"]: c["name"] for c in anon_client.get("/categories", headers=headers).json()}
    by_description = {t["description"]: names.get(t["category_id"]) for t in transactions}
    assert by_description["TED RECEBIDA SALARIO EMPRESA X"] == "Salário"
    assert by_description["IFOOD *RESTAURANTE"] == "Alimentação"
    assert by_description["PIX ENVIADO JOAO DA SILVA"] == "Transferências enviadas"
    assert by_description["PAGAMENTO DE FATURA CARTAO"] == "Pagamento de fatura"
    statements = anon_client.get("/statements", headers=headers).json()
    assert statements[0]["filename"] == "extrato.OFX"
    assert statements[0]["transaction_count"] == 10


def test_upload_aceita_extensao_em_maiusculas(client):
    response = client.post(
        "/upload",
        files={"file": ("EXTRATO.CSV", b"data,descricao,valor\n2025-01-05,IFOOD,-45.90\n", "text/csv")},
    )
    assert response.status_code == 200


def test_upload_recusa_outros_tipos_de_arquivo(client):
    response = client.post("/upload", files={"file": ("extrato.pdf", b"%PDF-1.4", "application/pdf")})

    assert response.status_code == 400
    assert response.json()["detail"] == "Envie um arquivo .csv ou .ofx"
