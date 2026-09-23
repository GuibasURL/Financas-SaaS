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


# ---------- Pagamento de fatura (contagem dupla) ----------

CONTA = """data,descricao,valor
2025-03-10,PAGAMENTO DE FATURA NUBANK,-80.00
2025-03-12,MERCADO,-50.00
"""

FATURA = """date,title,amount
2025-03-02,IFOOD,30.00
2025-03-05,UBER,50.00
2025-03-10,Pagamento recebido,-80.00
"""


@pytest.fixture
def fatura_ignorada(client, upload):
    """
    Conta + fatura do cartão: os R$ 80 de compras no cartão aparecem nas
    duas (como compras na fatura e como pagamento da fatura na conta).
    """
    client.post("/categories", json={"name": "Alimentação", "keywords": "ifood,mercado"})
    client.post("/categories", json={"name": "Transporte", "keywords": "uber"})
    client.post(
        "/categories",
        json={
            "name": "Pagamento de fatura",
            "keywords": "pagamento de fatura,pagamento recebido",
            "ignore_in_reports": True,
        },
    )
    upload(CONTA, filename="conta.csv")
    upload(FATURA, filename="fatura.csv")


def test_categoria_ignorada_nao_aparece_nos_gastos_por_categoria(client, fatura_ignorada):
    totals = _totals_by(client.get("/dashboard/by-category").json(), "category")

    assert totals == {"Alimentação": pytest.approx(-80.00), "Transporte": pytest.approx(-50.00)}


def test_categoria_ignorada_nao_conta_duas_vezes_na_evolucao_mensal(client, fatura_ignorada):
    [march] = client.get("/dashboard/monthly").json()

    # 50 (mercado) + 30 (ifood) + 50 (uber); sem os 80 do pagamento da fatura
    assert march["total"] == pytest.approx(-130.00)


def test_transacoes_ignoradas_continuam_na_lista(client, fatura_ignorada):
    descriptions = [t["description"] for t in client.get("/transactions").json()]

    assert "PAGAMENTO DE FATURA NUBANK" in descriptions
    assert "Pagamento recebido" in descriptions


def test_evolucao_mensal_ainda_conta_transacoes_sem_categoria(client, upload):
    upload("data,descricao,valor\n2025-03-01,SEM REGRA,-10.00\n")

    [march] = client.get("/dashboard/monthly").json()

    assert march["total"] == pytest.approx(-10.00)


def test_desmarcar_volta_a_contar_nos_graficos(client, fatura_ignorada):
    fatura_id = next(
        c["id"] for c in client.get("/categories").json() if c["name"] == "Pagamento de fatura"
    )

    client.patch(f"/categories/{fatura_id}", json={"ignore_in_reports": False})

    [march] = client.get("/dashboard/monthly").json()
    assert march["total"] == pytest.approx(-210.00)
