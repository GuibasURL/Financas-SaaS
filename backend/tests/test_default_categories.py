from pathlib import Path

import pytest

from app.models.category import Category
from app.schemas.category import normalize_keywords
from app.services.categorizer import categorize
from app.services.csv_parser import parse_statement
from app.services.default_categories import DEFAULT_CATEGORIES

FIXTURES = Path(__file__).parent / "fixtures" / "extratos"

# As sugeridas em memória, com ids na ordem da lista (= ordem de prioridade)
CATEGORIES = [
    Category(id=index + 1, name=name, keywords=keywords, ignore_in_reports=ignore)
    for index, (name, keywords, ignore) in enumerate(DEFAULT_CATEGORIES)
]
NAMES = {c.id: c.name for c in CATEGORIES}


def _category_of(description: str):
    return NAMES.get(categorize(description, CATEGORIES))


# ---------- Regras (descrições típicas de extrato) ----------


@pytest.mark.parametrize(
    "description, expected",
    [
        ("IFOOD *RESTAURANTE XYZ", "Alimentação"),
        ("PADARIA SAO JOAO", "Alimentação"),
        ("MC DONALDS PAULISTA", "Alimentação"),
        ("UBER *TRIP", "Transporte"),
        ("99APP *99POP", "Transporte"),
        ("AUTO POSTO CENTRAL", "Transporte"),
        ("POSTO SHELL", "Transporte"),
        ("SEM PARAR", "Transporte"),
        ("FARMACIA PRECO BOM", "Saúde"),  # sem acento no extrato
        ("DROGASIL 1234", "Saúde"),
        ("SMART FIT MENSALIDADE", "Saúde"),
        ("ACADEMIA CORPO SAO", "Saúde"),
        ("SMARTFIT*MENSAL", "Saúde"),
        ("AMIL ASSISTENCIA MEDICA", "Saúde"),
        ("FARMACIAS PAGUE MENOS", "Saúde"),  # plural: a palavra só precisa começar igual
        ("HOSPITAL SANTA CRUZ", "Saúde"),
        ("SUPERMERCADO DIA", "Mercado"),
        ("ASSAI ATACADISTA", "Mercado"),  # palavra-chave "assaí" com acento
        ("PAO DE ACUCAR", "Mercado"),
        ("NETFLIX.COM", "Assinaturas"),
        ("SPOTIFY BRASIL", "Assinaturas"),
        ("ALUGUEL APTO 12", "Moradia"),
        ("CONDOMINIO EDIFICIO SOL", "Moradia"),
        ("ENEL DISTRIBUICAO", "Moradia"),
        ("PAGAMENTO - Boleto de Luz", "Moradia"),
        ("UDEMY CURSO PYTHON", "Educação"),
        ("CURSO DE INGLES", "Educação"),
        ("CINEMARK SHOPPING", "Lazer"),
        ("STEAM PURCHASE", "Lazer"),
        ("SHOPEE BRASIL", "Compras"),
        ("TARIFA MENSAL", "Tarifas bancárias"),
        ("IOF COMPRA INTERNACIONAL", "Tarifas bancárias"),
        ("SALARIO EMPRESA X", "Salário"),
        ("PAGAMENTO DE FATURA NUBANK", "Pagamento de fatura"),
        ("Pagamento recebido", "Pagamento de fatura"),
    ],
)
def test_descricoes_tipicas(description, expected):
    assert _category_of(description) == expected


@pytest.mark.parametrize(
    "description, expected",
    [
        # A mais específica tem que vencer: vem antes na lista
        ("MERCADO LIVRE *LOJA", "Compras"),  # não "Mercado"
        ("AMAZON PRIME VIDEO", "Assinaturas"),  # não "Compras"
        ("AMAZON.COM.BR", "Compras"),
        ("UBER *EATS", "Alimentação"),  # pontuação vira espaço: "uber eats"
        ("UBER EATS", "Alimentação"),  # não "Transporte"
        ("UBEREATS*PEDIDO", "Alimentação"),
        ("MERCADOLIVRE*VENDEDOR", "Compras"),  # não "Mercado"
    ],
)
def test_conflitos_resolvidos_pela_ordem(description, expected):
    assert _category_of(description) == expected


@pytest.mark.parametrize(
    "description",
    [
        # Palavra-chave no meio de outra palavra não conta
        "IMPOSTO DE RENDA",  # "posto"
        "RECURSOS HUMANOS",  # "curso"
        "TRANSF PARA FAMILIA",  # "amil"
        "PAGAMENTO CONCURSO PUBLICO",  # "curso"
        # Exclusões ("-mercado pago" na categoria Mercado)
        "MERCADO PAGO *LOJA",
        "MERCADOPAGO*PAGAMENTO",
        # Palavras que ficaram fora da lista de propósito
        "TRANSF INTERNET BANKING",  # "internet"
        "PIX ENVIADO - JOAO DA SILVA",
        "BARBEARIA DO ZE",  # "bar" não é palavra-chave
        "LOJA 99 CENTAVOS",  # "99" sozinho não é palavra-chave
        "TRANSFERENCIA RECEBIDA",
    ],
)
def test_palavras_curtas_nao_pegam_coisa_errada(description):
    assert _category_of(description) is None


# ---------- A lista em si ----------


def test_nomes_unicos():
    names = [name for name, _, _ in DEFAULT_CATEGORIES]
    assert len(names) == len(set(names))


def test_palavras_chave_ja_no_formato_que_o_app_salva():
    # Mesmo formato do CategoryCreate: minúsculo, sem espaços nas pontas, sem repetição
    for name, keywords, _ in DEFAULT_CATEGORIES:
        assert normalize_keywords(keywords) == keywords, name


def test_nenhuma_palavra_chave_repetida_entre_categorias():
    seen = {}
    for name, keywords, _ in DEFAULT_CATEGORIES:
        for keyword in keywords.split(","):
            assert keyword not in seen, f"'{keyword}' em {seen.get(keyword)} e {name}"
            seen[keyword] = name


def test_so_pagamento_de_fatura_e_ignorada_nos_graficos():
    ignored = [name for name, _, ignore in DEFAULT_CATEGORIES if ignore]
    assert ignored == ["Pagamento de fatura"]


# ---------- Extratos de exemplo dos bancos ----------


@pytest.mark.parametrize("filename", sorted(p.name for p in FIXTURES.glob("*.csv")))
def test_extratos_de_exemplo_compras_tipicas_sao_categorizadas(filename):
    by_description = {
        t["description"]: _category_of(t["description"])
        for t in parse_statement((FIXTURES / filename).read_bytes()).transactions
    }
    categorized = {c for c in by_description.values() if c}

    # Todo extrato de exemplo tem padaria, uber, ifood, netflix, farmácia e tarifa
    assert {"Alimentação", "Transporte", "Assinaturas", "Saúde", "Tarifas bancárias"} <= categorized
    # E ao menos 2/3 dos lançamentos saem categorizados
    assert len([c for c in by_description.values() if c]) >= len(by_description) * 2 / 3


# ---------- API ----------


def _register(anon_client, email="nova@teste.com"):
    anon_client.post("/auth/register", json={"email": email, "password": "senha-forte-123"})
    token = anon_client.post(
        "/auth/login", data={"username": email, "password": "senha-forte-123"}
    ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_conta_nova_nasce_com_as_sugeridas_na_ordem_da_lista(anon_client, db_session):
    _register(anon_client)

    categories = db_session.query(Category).order_by(Category.id).all()
    assert [c.name for c in categories] == [name for name, _, _ in DEFAULT_CATEGORIES]
    fatura = next(c for c in categories if c.name == "Pagamento de fatura")
    assert fatura.ignore_in_reports is True


def test_conta_nova_ja_categoriza_o_primeiro_extrato(anon_client):
    headers = _register(anon_client)

    transactions = anon_client.post(
        "/upload",
        headers=headers,
        files={"file": ("nubank.csv", (FIXTURES / "nubank_conta.csv").read_bytes(), "text/csv")},
    ).json()

    assert sum(t["category_id"] is not None for t in transactions) >= 9


def test_adicionar_sugeridas_em_conta_sem_categorias(client):
    response = client.post("/categories/defaults")

    assert response.json() == {"created": len(DEFAULT_CATEGORIES)}
    assert len(client.get("/categories").json()) == len(DEFAULT_CATEGORIES)


def test_adicionar_sugeridas_de_novo_nao_duplica(client):
    client.post("/categories/defaults")

    assert client.post("/categories/defaults").json() == {"created": 0}
    assert len(client.get("/categories").json()) == len(DEFAULT_CATEGORIES)


def test_adicionar_sugeridas_pula_as_que_ja_existem_sem_mexer_nelas(client):
    # Mesmo nome, só que sem acento e em minúsculas: conta como já existente
    mine = client.post("/categories", json={"name": "alimentacao", "keywords": "minha-padaria"}).json()

    created = client.post("/categories/defaults").json()["created"]

    assert created == len(DEFAULT_CATEGORIES) - 1
    categories = {c["name"]: c for c in client.get("/categories").json()}
    assert "Alimentação" not in categories
    assert categories["alimentacao"] == mine  # não foi alterada


def test_adicionar_sugeridas_nao_afeta_outro_usuario(client, other_client):
    client.post("/categories/defaults")

    assert other_client.get("/categories").json() == []


def test_adicionar_sugeridas_exige_token(anon_client):
    assert anon_client.post("/categories/defaults").status_code == 401
