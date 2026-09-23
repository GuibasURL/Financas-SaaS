import io
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from openpyxl import load_workbook

from tests.conftest import CSV_FEVEREIRO, CSV_JANEIRO, upload_csv

XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _export(client, **params):
    return client.get("/reports/export", params=params)


def _workbook(response):
    assert response.status_code == 200, response.text
    return load_workbook(io.BytesIO(response.content))


def _rows(sheet, skip_header=True):
    rows = [list(r) for r in sheet.iter_rows(values_only=True)]
    return rows[1:] if skip_header else rows


def _summary(workbook) -> dict:
    return {label: value for label, value in workbook["Resumo"].iter_rows(values_only=True) if label}


@pytest.fixture
def dados(upload, categories):
    """
    Janeiro: IFOOD -45,90 (Alimentação), SALARIO +5000, UBER -20 (Transporte), FARMACIA -30,10
    Fevereiro: IFOOD -60 (Alimentação), UBER -15,50 (Transporte)
    """
    janeiro = upload(CSV_JANEIRO, filename="janeiro.csv").json()[0]["statement_id"]
    fevereiro = upload(CSV_FEVEREIRO, filename="fevereiro.csv").json()[0]["statement_id"]
    return {"janeiro": janeiro, "fevereiro": fevereiro}


# ---------- Arquivo ----------


def test_devolve_xlsx_com_as_quatro_abas(client, dados):
    response = _export(client)

    assert response.headers["content-type"] == XLSX
    assert _workbook(response).sheetnames == ["Resumo", "Por mês", "Por categoria", "Transações"]


@pytest.mark.parametrize(
    "params, filename",
    [
        ({}, "vexira-relatorio_completo.xlsx"),
        ({"start_date": "2025-01-01", "end_date": "2025-01-31"}, "vexira-relatorio_2025-01-01_a_2025-01-31.xlsx"),
        ({"start_date": "2025-02-01"}, "vexira-relatorio_2025-02-01_a_hoje.xlsx"),
        ({"end_date": "2025-01-31"}, "vexira-relatorio_inicio_a_2025-01-31.xlsx"),
    ],
)
def test_nome_do_arquivo_reflete_o_periodo(client, dados, params, filename):
    response = _export(client, **params)

    assert response.headers["content-disposition"] == f'attachment; filename="{filename}"'


def test_nome_do_arquivo_fica_visivel_para_o_frontend(client):
    response = client.get("/", headers={"Origin": "http://localhost:5173"})

    assert "content-disposition" in response.headers["access-control-expose-headers"].lower()


# ---------- Conteúdo ----------


def test_resumo_com_totais_e_filtros(client, dados):
    workbook = _workbook(_export(client))
    summary = _summary(workbook)

    assert workbook["Resumo"]["A1"].value == "Vexira — Relatório financeiro"
    assert summary["Período"] == "Todo o período"
    assert summary["Extrato"] == "Todos"
    assert summary["Entradas"] == pytest.approx(5000.00)
    assert summary["Saídas"] == pytest.approx(-171.50)
    assert summary["Saldo"] == pytest.approx(4828.50)
    assert summary["Transações"] == 6
    datetime.strptime(summary["Gerado em"], "%d/%m/%Y %H:%M")


def test_gerado_em_usa_o_fuso_do_app_e_nao_o_do_servidor(client, dados, monkeypatch):
    # Um fuso bem longe do servidor e de Brasília: se a hora vier certa, veio do APP_TIMEZONE
    tokyo = ZoneInfo("Asia/Tokyo")
    monkeypatch.setattr("app.routers.reports.APP_TIMEZONE", tokyo)

    summary = _summary(_workbook(_export(client)))

    generated = datetime.strptime(summary["Gerado em"], "%d/%m/%Y %H:%M")
    now = datetime.now(tokyo).replace(tzinfo=None)
    assert now - timedelta(minutes=2) <= generated <= now


def test_por_mes(client, dados):
    rows = _rows(_workbook(_export(client))["Por mês"])

    assert rows[0] == ["01/2025", 5000, pytest.approx(-96.00), pytest.approx(4904.00)]
    assert rows[1] == ["02/2025", 0, pytest.approx(-75.50), pytest.approx(-75.50)]
    # Linha de total com fórmula, para continuar certa se editarem a planilha
    assert rows[2] == ["Total", "=SUM(B2:B3)", "=SUM(C2:C3)", "=SUM(D2:D3)"]


def test_por_categoria_inclui_sem_categoria_e_ordena_pelo_maior_gasto(client, dados):
    rows = _rows(_workbook(_export(client))["Por categoria"])

    assert [r[0] for r in rows] == ["Alimentação", "Transporte", "Sem categoria", "Total"]
    assert rows[0][1] == pytest.approx(105.90)
    assert rows[0][2] == pytest.approx(105.90 / 171.50)
    assert rows[2][1] == pytest.approx(30.10)  # FARMACIA
    assert rows[3][1:] == ["=SUM(B2:B4)", 1]


def test_transacoes_em_ordem_de_data_com_categoria_e_extrato(client, dados):
    sheet = _workbook(_export(client))["Transações"]
    rows = _rows(sheet)

    assert _rows(sheet, skip_header=False)[0] == ["Data", "Descrição", "Categoria", "Valor", "Extrato", "Nos totais"]
    assert len(rows) == 6
    assert [r[0].date().isoformat() for r in rows] == sorted(r[0].date().isoformat() for r in rows)
    first = rows[0]
    assert first[1:] == ["IFOOD *RESTAURANTE XYZ", "Alimentação", pytest.approx(-45.90), "janeiro.csv", "Sim"]
    assert sheet.freeze_panes == "A2"
    assert sheet.auto_filter.ref == "A1:F7"


def test_valores_e_datas_sao_numeros_formatados_nao_texto(client, dados):
    sheet = _workbook(_export(client))["Transações"]

    assert isinstance(sheet["A2"].value, datetime)
    assert sheet["A2"].number_format == "DD/MM/YYYY"
    assert isinstance(sheet["D2"].value, (int, float))
    assert "R$" in sheet["D2"].number_format


def test_categoria_ignorada_fica_fora_dos_totais_mas_na_lista(client, dados, categories):
    client.patch(f"/categories/{categories['transporte'].id}", json={"ignore_in_reports": True})

    workbook = _workbook(_export(client))

    summary = _summary(workbook)
    assert summary["Saídas"] == pytest.approx(-171.50 + 35.50)
    assert summary["Transações"] == 6
    assert summary["Fora dos totais (categorias ignoradas)"] == 2
    assert "Transporte" not in [r[0] for r in _rows(workbook["Por categoria"])]
    uber = [r for r in _rows(workbook["Transações"]) if r[1] == "UBER TRIP"]
    assert [r[5] for r in uber] == ["Não (ignorada)", "Não (ignorada)"]


# ---------- Filtros ----------


def test_filtro_de_periodo_inclui_as_datas_das_pontas(client, dados):
    workbook = _workbook(_export(client, start_date="2025-01-06", end_date="2025-02-03"))

    descriptions = [r[1] for r in _rows(workbook["Transações"])]
    # 05/01 fica de fora; 06/01 e 03/02 entram (pontas inclusivas); 20/02 fica de fora
    assert descriptions == ["SALARIO EMPRESA", "UBER TRIP", "FARMACIA", "IFOOD *PIZZARIA"]
    assert _summary(workbook)["Período"] == "06/01/2025 a 03/02/2025"


def test_filtro_de_extrato(client, dados):
    workbook = _workbook(_export(client, statement_id=dados["fevereiro"]))

    assert len(_rows(workbook["Transações"])) == 2
    assert _summary(workbook)["Extrato"] == "fevereiro.csv"


def test_periodo_sem_transacoes_gera_planilha_vazia(client, dados):
    workbook = _workbook(_export(client, start_date="2030-01-01"))

    assert _summary(workbook)["Transações"] == 0
    assert _rows(workbook["Transações"]) == []
    assert _rows(workbook["Por categoria"]) == [["Total", 0, None]]


def test_data_inicial_depois_da_final_da_400(client):
    response = _export(client, start_date="2025-02-01", end_date="2025-01-01")

    assert response.status_code == 400


def test_data_invalida_da_422(client):
    assert _export(client, start_date="01/02/2025").status_code == 422


def test_extrato_inexistente_da_404(client):
    assert _export(client, statement_id=999).status_code == 404


# ---------- Autenticação e isolamento ----------


def test_exige_token(anon_client):
    assert anon_client.get("/reports/export").status_code == 401


def test_relatorio_so_tem_dados_do_proprio_usuario(client, other_client, dados):
    upload_csv(other_client, CSV_FEVEREIRO, filename="do-bruno.csv")

    workbook = _workbook(_export(other_client))

    rows = _rows(workbook["Transações"])
    assert len(rows) == 2
    assert {r[4] for r in rows} == {"do-bruno.csv"}


def test_extrato_de_outro_usuario_da_404(other_client, dados):
    assert _export(other_client, statement_id=dados["janeiro"]).status_code == 404
