import pytest

from app.models.category import Category
from app.schemas.category import normalize_keywords
from app.services.categorizer import categorize, parse_keywords
from app.services.text import normalize_for_matching


def _categories(*keyword_lists: str) -> list[Category]:
    return [Category(id=i + 1, name=f"C{i + 1}", keywords=k) for i, k in enumerate(keyword_lists)]


@pytest.mark.parametrize(
    "text, expected",
    [
        ("UBER *EATS", "uber eats"),
        ("NETFLIX.COM", "netflix com"),
        ("DROGASIL1234", "drogasil 1234"),
        ("99APP *99POP", "99 app 99 pop"),
        ("  Farmácia   São João  ", "farmacia sao joao"),
        ("PAG*JoseDaSilva", "pag josedasilva"),
        ("***", ""),
    ],
)
def test_normalize_for_matching(text, expected):
    assert normalize_for_matching(text) == expected


def test_parse_keywords_separa_inclusao_e_exclusao():
    assert parse_keywords("iFood, Restaurante, -Mercado Pago,, -  ") == (
        ["ifood", "restaurante"],
        ["mercado pago"],
    )


@pytest.mark.parametrize(
    "keywords, description, matches",
    [
        ("posto", "AUTO POSTO SHELL", True),
        ("posto", "IMPOSTO DE RENDA", False),  # no meio da palavra não conta
        ("farmacia", "FARMACIAS PAGUE MENOS", True),  # começo da palavra conta
        ("farmácia", "FARMACIA SAO JOAO", True),  # acento só na palavra-chave
        ("farmacia", "Farmácia São João", True),  # acento só na descrição
        ("uber eats", "UBER *EATS", True),  # pontuação vira espaço
        ("99pop", "99POP*CORRIDA", True),
        ("99pop", "LOJA 99 CENTAVOS", False),
        ("apple.com", "APPLE.COM/BILL", True),
        ("mercado, -mercado pago", "MERCADO PAGO *LOJA", False),
        ("mercado, -mercado pago", "MERCADO EXTRA", True),
        ("-mercado pago", "PADARIA", False),  # só exclusão: nunca pega nada
        ("", "QUALQUER COISA", False),
    ],
)
def test_categorize(keywords, description, matches):
    result = categorize(description, -10, _categories(keywords))

    assert (result == 1) is matches


def test_exclusao_so_vale_para_a_propria_categoria():
    # C1 recusa "mercado pago", mas C2 (depois na lista) pode pegar
    categories = _categories("mercado,-mercado pago", "mercado pago")

    assert categorize("MERCADO PAGO *LOJA", -10, categories) == 2
    assert categorize("MERCADO EXTRA", -10, categories) == 1


def _with_directions(*specs: tuple[str, str]) -> list[Category]:
    return [
        Category(id=i + 1, name=f"C{i + 1}", keywords=k, direction=d)
        for i, (k, d) in enumerate(specs)
    ]


@pytest.mark.parametrize(
    "amount, expected",
    [(-50, 1), (200, 2), (0, None)],
)
def test_sentido_separa_enviada_de_recebida(amount, expected):
    # O mesmo texto nos dois sentidos: quem decide é o sinal do valor
    categories = _with_directions(("pix,transf", "out"), ("pix,transf", "in"))

    assert categorize("PIX TRANSF MARIA 12/04", amount, categories) == expected


def test_categoria_de_sentido_errado_deixa_a_proxima_pegar():
    categories = _with_directions(("estorno", "in"), ("compra", "all"))

    assert categorize("ESTORNO COMPRA", 35.5, categories) == 1
    assert categorize("ESTORNO COMPRA", -35.5, categories) == 2


def test_sem_sentido_definido_vale_para_os_dois():
    # Categoria montada sem direction (como as antigas, antes da coluna existir)
    categories = [Category(id=1, name="C1", keywords="pix")]

    assert categorize("PIX", 10, categories) == 1
    assert categorize("PIX", -10, categories) == 1


def test_primeira_categoria_da_lista_vence():
    assert categorize("UBER EATS", -10, _categories("uber", "uber eats")) == 1
    assert categorize("UBER EATS", -10, _categories("uber eats", "uber")) == 1


@pytest.mark.parametrize(
    "raw, saved",
    [
        (" iFood, Restaurante ,,ifood", "ifood,restaurante"),
        ("mercado, - Mercado Pago", "mercado,-mercado pago"),
        ("mercado, --mercado pago", "mercado,-mercado pago"),
        ("a, -, --", "a"),  # "-" sozinho é descartado
    ],
)
def test_normalize_keywords_mantem_o_menos_das_exclusoes(raw, saved):
    assert normalize_keywords(raw) == saved
