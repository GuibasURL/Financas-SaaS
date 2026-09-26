"""Aviso de extrato repetido: transações que já foram importadas antes."""
import pytest

from tests.conftest import CSV_FEVEREIRO, CSV_JANEIRO, upload_csv

# Janeiro de novo, mais uma transação nova no fim
CSV_JANEIRO_E_MAIS_UMA = CSV_JANEIRO + "2025-01-20,PADARIA,-12.00\n"


def _upload(client, content, filename="extrato.csv", duplicates=None):
    params = {"duplicates": duplicates} if duplicates else {}
    return client.post(
        "/upload", params=params, files={"file": (filename, content.encode("utf-8"), "text/csv")}
    )


def _transaction_count(client):
    return len(client.get("/transactions").json())


def test_extrato_sem_repeticao_entra_direto(client):
    assert _upload(client, CSV_JANEIRO).status_code == 200
    assert _upload(client, CSV_FEVEREIRO).status_code == 200
    assert _transaction_count(client) == 6


def test_mesmo_arquivo_de_novo_avisa_e_nao_importa(client):
    _upload(client, CSV_JANEIRO, filename="janeiro.csv")

    response = _upload(client, CSV_JANEIRO, filename="janeiro (1).csv")

    assert response.status_code == 409
    assert response.json()["detail"] == {
        "code": "duplicates",
        "message": "Este extrato já foi importado: as 4 transações dele já estão em janeiro.csv.",
        "duplicates": 4,
        "total": 4,
        "statements": ["janeiro.csv"],
    }
    assert _transaction_count(client) == 4
    assert len(client.get("/statements").json()) == 1


def test_extrato_com_parte_repetida(client):
    _upload(client, CSV_JANEIRO, filename="janeiro.csv")

    response = _upload(client, CSV_JANEIRO_E_MAIS_UMA)

    assert response.status_code == 409
    detail = response.json()["detail"]
    assert detail["message"] == "4 de 5 transações deste extrato já foram importadas (em janeiro.csv)."
    assert (detail["duplicates"], detail["total"]) == (4, 5)


def test_importar_so_as_novas(client):
    _upload(client, CSV_JANEIRO)

    response = _upload(client, CSV_JANEIRO_E_MAIS_UMA, filename="janeiro-completo.csv", duplicates="skip")

    assert response.status_code == 200
    assert [t["description"] for t in response.json()] == ["PADARIA"]
    assert _transaction_count(client) == 5
    statements = client.get("/statements").json()
    assert {s["filename"]: s["transaction_count"] for s in statements} == {
        "extrato.csv": 4,
        "janeiro-completo.csv": 1,
    }


def test_importar_tudo_mesmo_assim(client):
    _upload(client, CSV_JANEIRO)

    response = _upload(client, CSV_JANEIRO_E_MAIS_UMA, duplicates="keep")

    assert response.status_code == 200
    assert len(response.json()) == 5
    assert _transaction_count(client) == 9


def test_so_as_novas_quando_nao_ha_nenhuma_nova(client):
    _upload(client, CSV_JANEIRO)

    response = _upload(client, CSV_JANEIRO, duplicates="skip")

    assert response.status_code == 400
    assert response.json()["detail"] == "Nenhuma transação nova: todas já foram importadas."
    assert len(client.get("/statements").json()) == 1


def test_opcao_invalida_da_422(client):
    assert _upload(client, CSV_JANEIRO, duplicates="talvez").status_code == 422


@pytest.mark.parametrize(
    "line",
    [
        "2025-01-05,ifood *restaurante xyz,-45.90",  # maiúsculas
        "2025-01-05,IFOOD  *RESTAURANTE   XYZ,-45.9",  # espaços e casas decimais
        "2025-01-05,IFOOD - RESTAURANTE XYZ,-45.90",  # pontuação
    ],
)
def test_descricao_comparada_sem_detalhes_de_formatacao(client, line):
    _upload(client, CSV_JANEIRO)

    response = _upload(client, f"data,descricao,valor\n{line}\n")

    assert response.status_code == 409


def test_acentos_nao_importam(client):
    _upload(client, "data,descricao,valor\n2025-03-05,Farmácia São João,-30.00\n")

    response = _upload(client, "data,descricao,valor\n2025-03-05,FARMACIA SAO JOAO,-30.00\n")

    assert response.status_code == 409


@pytest.mark.parametrize(
    "line",
    [
        "2025-01-06,IFOOD *RESTAURANTE XYZ,-45.90",  # outro dia
        "2025-01-05,IFOOD *RESTAURANTE XYZ,-45.91",  # outro valor
        "2025-01-05,IFOOD *RESTAURANTE XYZ,45.90",  # estorno (entrada), não a compra
        "2025-01-05,IFOOD *OUTRO RESTAURANTE,-45.90",  # outra descrição
    ],
)
def test_parecida_mas_diferente_nao_e_repetida(client, line):
    _upload(client, CSV_JANEIRO)

    assert _upload(client, f"data,descricao,valor\n{line}\n").status_code == 200


def test_compras_iguais_no_mesmo_dia_sao_contadas_uma_a_uma(client):
    # Duas corridas iguais no mesmo dia são duas transações de verdade
    uma = "data,descricao,valor\n2025-01-10,UBER TRIP,-15.90\n"
    duas = uma + "2025-01-10,UBER TRIP,-15.90\n"
    _upload(client, uma)

    response = _upload(client, duas)

    assert response.status_code == 409
    assert (response.json()["detail"]["duplicates"], response.json()["detail"]["total"]) == (1, 2)
    # Só as novas: entra a segunda corrida
    assert len(_upload(client, duas, duplicates="skip").json()) == 1
    # Agora as duas já existem
    assert _upload(client, duas).json()["detail"]["duplicates"] == 2


def test_duas_iguais_no_mesmo_arquivo_novo_nao_sao_repetidas(client):
    content = "data,descricao,valor\n2025-01-10,UBER TRIP,-15.90\n2025-01-10,UBER TRIP,-15.90\n"

    assert _upload(client, content).status_code == 200


def test_lista_os_arquivos_onde_as_repetidas_estao(client):
    _upload(client, CSV_JANEIRO, filename="janeiro.csv")
    _upload(client, CSV_FEVEREIRO, filename="fevereiro.csv")

    response = _upload(client, CSV_JANEIRO + CSV_FEVEREIRO.split("\n", 1)[1], filename="tudo.csv")

    detail = response.json()["detail"]
    assert detail["statements"] == ["janeiro.csv", "fevereiro.csv"]
    assert detail["message"] == (
        "Este extrato já foi importado: as 6 transações dele já estão em janeiro.csv, fevereiro.csv."
    )


def test_uma_transacao_so_mensagem_no_singular(client):
    content = "data,descricao,valor\n2025-01-10,UBER TRIP,-15.90\n"
    _upload(client, content, filename="uber.csv")

    detail = _upload(client, content).json()["detail"]

    assert detail["message"] == "Este extrato já foi importado: a transação dele já está em uber.csv."


def test_extrato_excluido_nao_conta_mais(client):
    statement_id = _upload(client, CSV_JANEIRO).json()[0]["statement_id"]
    client.delete(f"/statements/{statement_id}")

    assert _upload(client, CSV_JANEIRO).status_code == 200


def test_transacoes_de_outro_usuario_nao_contam(client, other_client):
    upload_csv(other_client, CSV_JANEIRO)

    assert _upload(client, CSV_JANEIRO).status_code == 200


def test_ofx_repetido_tambem_avisa(client):
    from pathlib import Path

    content = (Path(__file__).parent / "fixtures" / "extratos" / "conta_sgml.ofx").read_bytes()
    files = {"file": ("extrato.ofx", content, "application/x-ofx")}
    assert client.post("/upload", files=files).status_code == 200

    response = client.post("/upload", files=files)

    assert response.status_code == 409
    assert response.json()["detail"]["duplicates"] == 10


def test_lista_vazia_nao_consulta_nada(db_session, user):
    from app.services.duplicates import find_duplicates

    assert find_duplicates(db_session, user.id, []).count == 0
