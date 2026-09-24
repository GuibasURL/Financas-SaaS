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
    Category(
        id=index + 1,
        name=d.name,
        keywords=d.keywords,
        ignore_in_reports=d.ignore_in_reports,
        direction=d.direction,
    )
    for index, d in enumerate(DEFAULT_CATEGORIES)
]
NAMES = {c.id: c.name for c in CATEGORIES}


def _category_of(description: str, amount: float = -10.0):
    """Categoria sugerida para a descrição; por padrão como saída (valor negativo)."""
    return NAMES.get(categorize(description, amount, CATEGORIES))


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
        ("LOJAS RIACHUELO - 1/3", "Compras"),  # fatura Nubank: parcela no fim
        ("RENNER SHOPPING", "Compras"),
        ("RD SAUDE - 3/3", "Saúde"),  # Raia Drogasil na fatura do Nubank
        ("TARIFA MENSAL", "Tarifas bancárias"),
        ("IOF COMPRA INTERNACIONAL", "Tarifas bancárias"),
        ("PAGAMENTO DE FATURA NUBANK", "Pagamento de fatura"),
        ("Pagamento recebido", "Pagamento de fatura"),
        # Nubank: limite do cartão que vira saldo na conta (fora dos totais)
        ("Limite convertido em saldo na sua conta do Nubank - 2/2", "Pagamento de fatura"),
    ],
)
def test_descricoes_tipicas(description, expected):
    assert _category_of(description) == expected


@pytest.mark.parametrize(
    "description, amount, expected",
    [
        # Pix e transferências: o sinal do valor decide o sentido
        ("PIX ENVIADO - JOAO DA SILVA", -150, "Transferências enviadas"),
        ("PIX TRANSF MARIA12/04", -80, "Transferências enviadas"),  # Itaú: sem sentido no texto
        ("PIX TRANSF MARIA12/04", 80, "Transferências recebidas"),
        ("Transferência enviada - João da Silva", -150.5, "Transferências enviadas"),
        ("TRANSFERENCIA RECEBIDA", 200, "Transferências recebidas"),
        ("PIX RECEBIDO MARIA", 200, "Transferências recebidas"),
        ("TED RECEBIDA 341 EMPRESA", 1000, "Transferências recebidas"),
        # A mais específica vence a transferência genérica
        ("PIX - ALUGUEL APTO 12", -1500, "Moradia"),
        ("PIX RECEBIDO Transferência de SALARIO", 4500, "Salário"),
        ("Transferência recebida - SALARIO EMPRESA X", 4500, "Salário"),
        ("TRANSF PARA POUPANCA", -500, "Investimentos"),
        # Salário e estornos só valem para entradas
        ("SALARIO EMPRESA X", 5000, "Salário"),
        ("Estorno de Compra", 35.5, "Estornos e reembolsos"),
        ("REEMBOLSO PLANO DE SAUDE", 120, "Estornos e reembolsos"),
        ("CASHBACK NUBANK", 3.2, "Estornos e reembolsos"),
        # Investimentos nos dois sentidos
        ("APLICACAO CDB", -1000, "Investimentos"),
        ("RESGATE CDB", 1000, "Investimentos"),
        ("TESOURO DIRETO", -300, "Investimentos"),
        # Saques
        ("SAQUE BANCO24HORAS", -200, "Saques"),
        # PicPay: cofrinho é dinheiro mudando de lugar; fatura do cartão PicPay
        ("Dinheiro resgatado - Do cofrinho Economia", 10, "Investimentos"),
        ("Dinheiro guardado - No cofrinho Viagem", -100, "Investimentos"),
        ("Pagamento realizado - Fatura PicPay Card", -45.7, "Pagamento de fatura"),
        ("Pix enviado - IFOOD.COM AGENCIA DE RESTAURANTES ONLINE S.A.", -24.96, "Alimentação"),
        ("Pix enviado - RAIA DROGASIL S/A", -27.39, "Saúde"),
        ("Pix enviado - UNIVERSIDADE FEDERAL DO CEARA", -3.3, "Educação"),
        ("Pix enviado - Gabriela Pinheiro", -9.5, "Transferências enviadas"),
    ],
)
def test_sentido_do_dinheiro(description, amount, expected):
    assert _category_of(description, amount) == expected


@pytest.mark.parametrize(
    "description, amount",
    [
        ("SALARIO EMPRESA X", -5000),  # "salário" só vale para entrada
        ("ESTORNO DE TARIFA", -10),  # estorno negativo não é reembolso (cai em Tarifas)
        ("SAQUE", 200),  # saque só vale para saída
    ],
)
def test_sentido_errado_nao_usa_a_categoria(description, amount):
    category = _category_of(description, amount)
    assert category not in {"Salário", "Estornos e reembolsos", "Saques"}


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
        "PAGAMENTO FAMILIA SILVA",  # "amil"
        "PAGAMENTO CONCURSO PUBLICO",  # "curso"
        # Exclusões ("-mercado pago" na categoria Mercado)
        "MERCADO PAGO *LOJA",
        "MERCADOPAGO*PAGAMENTO",
        # Palavras que ficaram fora da lista de propósito
        "PAGAMENTO INTERNET BANKING",  # "internet"
        "BARBEARIA DO ZE",  # "bar" não é palavra-chave
        "LOJA 99 CENTAVOS",  # "99" sozinho não é palavra-chave
        "DOCERIA DA ANA",  # "doc" (DOC foi extinto em 2024) não é palavra-chave
    ],
)
def test_palavras_curtas_nao_pegam_coisa_errada(description):
    assert _category_of(description) is None


# ---------- A lista em si ----------


def test_nomes_unicos():
    names = [d.name for d in DEFAULT_CATEGORIES]
    assert len(names) == len(set(names))


def test_palavras_chave_ja_no_formato_que_o_app_salva():
    # Mesmo formato do CategoryCreate: minúsculo, sem espaços nas pontas, sem repetição
    for d in DEFAULT_CATEGORIES:
        assert normalize_keywords(d.keywords) == d.keywords, d.name


def test_sentidos_validos():
    assert {d.direction for d in DEFAULT_CATEGORIES} <= {"all", "in", "out"}


def test_palavra_chave_repetida_so_em_sentidos_opostos():
    # "pix" em "enviadas" (só saídas) e "recebidas" (só entradas) não conflita;
    # em qualquer outro caso, a segunda categoria nunca pegaria nada
    seen = {}
    for d in DEFAULT_CATEGORIES:
        for keyword in d.keywords.split(","):
            if keyword in seen:
                other = seen[keyword]
                assert {other.direction, d.direction} == {"in", "out"}, (
                    f"'{keyword}' em {other.name} e {d.name}"
                )
            seen[keyword] = d


def test_ignoradas_nos_graficos():
    ignored = [d.name for d in DEFAULT_CATEGORIES if d.ignore_in_reports]
    assert ignored == ["Pagamento de fatura", "Investimentos"]


# ---------- Extratos de exemplo dos bancos ----------


@pytest.mark.parametrize("filename", sorted(p.name for p in FIXTURES.glob("*.csv")))
def test_extratos_de_exemplo_compras_tipicas_sao_categorizadas(filename):
    by_description = {
        t["description"]: _category_of(t["description"], t["amount"])
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
    assert [c.name for c in categories] == [d.name for d in DEFAULT_CATEGORIES]
    fatura = next(c for c in categories if c.name == "Pagamento de fatura")
    assert fatura.ignore_in_reports is True
    recebidas = next(c for c in categories if c.name == "Transferências recebidas")
    assert recebidas.direction == "in"


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


def test_extrato_do_picpay_numa_conta_nova(anon_client):
    # O cofrinho e a fatura do cartão ficam fora dos gráficos: são dinheiro mudando
    # de lugar, não gasto nem renda
    headers = _register(anon_client)

    transactions = anon_client.post(
        "/upload",
        headers=headers,
        files={"file": ("picpay.csv", (FIXTURES / "picpay.csv").read_bytes(), "text/csv")},
    ).json()
    names = {c["id"]: c["name"] for c in anon_client.get("/categories", headers=headers).json()}
    by_description = {t["description"]: names.get(t["category_id"]) for t in transactions}

    assert by_description["Dinheiro guardado - No cofrinho Viagem"] == "Investimentos"
    assert by_description["Pagamento realizado - Fatura PicPay Card"] == "Pagamento de fatura"
    assert by_description["Pix recebido - EMPRESA X LTDA - SALARIO"] == "Salário"
    assert by_description["Pix recebido - Maria Oliveira"] == "Transferências recebidas"
    assert all(category is not None for category in by_description.values())

    spending = anon_client.get("/dashboard/by-category", headers=headers).json()
    assert {s["category"] for s in spending} == {
        "Alimentação",
        "Transporte",
        "Assinaturas",
        "Saúde",
        "Tarifas bancárias",
        "Transferências enviadas",
    }
