import pytest

from tests.conftest import CSV_JANEIRO, CSV_FEVEREIRO


def _totals_by(rows, key):
    return {row[key]: row["total"] for row in rows}


def test_gastos_por_categoria_soma_so_saidas_categorizadas(client, upload, categories):
    upload(CSV_JANEIRO)
    upload(CSV_FEVEREIRO)

    totals = _totals_by(client.get("/dashboard/by-category").json(), "category")

    # FARMACIA (sem categoria) e o salário (entrada) ficam de fora
    assert totals == {
        "Alimentação": pytest.approx(-105.90),
        "Transporte": pytest.approx(-35.50),
    }


def test_gastos_por_categoria_filtrado_por_extrato(client, upload, categories):
    upload(CSV_JANEIRO)
    fevereiro_id = upload(CSV_FEVEREIRO).json()[0]["statement_id"]

    rows = client.get(f"/dashboard/by-category?statement_id={fevereiro_id}").json()

    assert _totals_by(rows, "category") == {
        "Alimentação": pytest.approx(-60.00),
        "Transporte": pytest.approx(-15.50),
    }


def test_evolucao_mensal_soma_saidas_por_mes(client, upload):
    upload(CSV_JANEIRO)
    upload(CSV_FEVEREIRO)

    rows = client.get("/dashboard/monthly").json()

    assert [(r["year"], r["month"]) for r in rows] == [(2025, 1), (2025, 2)]
    assert rows[0]["total"] == pytest.approx(-96.00)
    assert rows[1]["total"] == pytest.approx(-75.50)


def test_evolucao_mensal_filtrada_por_extrato(client, upload):
    janeiro_id = upload(CSV_JANEIRO).json()[0]["statement_id"]
    upload(CSV_FEVEREIRO)

    rows = client.get(f"/dashboard/monthly?statement_id={janeiro_id}").json()

    assert [(r["year"], r["month"]) for r in rows] == [(2025, 1)]
