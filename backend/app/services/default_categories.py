"""
Categorias sugeridas: criadas automaticamente para contas novas e
disponíveis para contas existentes (POST /categories/defaults).

A ORDEM IMPORTA: quando mais de uma categoria bate com a descrição, vence
a criada primeiro. Por isso as mais específicas vêm antes:
- "Assinaturas" (amazon prime) antes de "Compras" (amazon)
- "Compras" (mercado livre) antes de "Mercado" (mercado)
- "Alimentação" (uber eats) antes de "Transporte" (uber)

A palavra-chave precisa estar no começo de uma palavra da descrição (ver
categorizer.py), então "posto" não pega "imPOSTO". Mesmo assim, cuidado com
palavras curtas ou genéricas que começam outras palavras: "bar" pegaria
"BARBEARIA", "99" pegaria "LOJA 99 CENTAVOS", "internet" pegaria
"INTERNET BANKING", "luz" pegaria "MARIA DA LUZ". Palavras-chave com "-" na
frente excluem: "-mercado pago" impede "Mercado" de pegar "MERCADO PAGO".
Os testes em tests/test_default_categories.py pegam esses conflitos.
"""
import unicodedata

from sqlalchemy.orm import Session

from app.models.category import Category
from app.services.text import normalize_text

# (nome, palavras-chave, ignorar nos gráficos)
DEFAULT_CATEGORIES: tuple[tuple[str, str, bool], ...] = (
    (
        "Pagamento de fatura",
        "pagamento de fatura,pagamento recebido,pgto fatura,pagto fatura",
        True,
    ),
    ("Salário", "salário,proventos", False),
    (
        "Assinaturas",
        "netflix,spotify,amazon prime,prime video,disney,hbo,youtube premium,"
        "globoplay,apple.com,deezer",
        False,
    ),
    (
        "Compras",
        "mercado livre,mercadolivre,amazon,shopee,magazine luiza,magalu,americanas,shein,"
        "aliexpress",
        False,
    ),
    (
        "Alimentação",
        "ifood,uber eats,ubereats,rappi,restaurante,lanchonete,padaria,pizzaria,hamburgueria,"
        "mcdonalds,mc donalds,burger king,subway,cafeteria,starbucks",
        False,
    ),
    (
        "Mercado",
        "supermercado,mercado,atacadão,assaí,carrefour,pão de açúcar,hortifruti,"
        "-mercado pago,-mercadopago",
        False,
    ),
    (
        "Transporte",
        "uber,99 pop,99pop,99app,cabify,posto,combustível,shell,ipiranga,petrobras,"
        "estacionamento,pedágio,sem parar,metrô,bilhete único",
        False,
    ),
    (
        "Saúde",
        "farmácia,drogaria,drogasil,droga raia,pague menos,hospital,clínica,laboratório,"
        "consulta,dentista,odonto,unimed,amil,hapvida,sulamerica,bradesco saude,academia,"
        "smart fit,smartfit",
        False,
    ),
    (
        "Moradia",
        "aluguel,condomínio,iptu,conta de luz,boleto de luz,energia elétrica,enel,cemig,"
        "copel,sabesp,comgás,conta de água",
        False,
    ),
    (
        "Educação",
        "escola,colégio,faculdade,universidade,curso,udemy,alura,coursera,livraria",
        False,
    ),
    (
        "Lazer",
        "cinema,cinemark,ingresso,teatro,show,steam,playstation,xbox",
        False,
    ),
    ("Tarifas bancárias", "tarifa,anuidade,iof,juros", False),
)


def add_default_categories(db: Session, user_id: int) -> list[Category]:
    """
    Cria, na ordem da lista, as categorias sugeridas que o usuário ainda
    não tem (comparando o nome sem acento e sem diferenciar maiúsculas).
    Devolve as criadas; não faz commit.
    """
    existing = {
        normalize_text(name)
        for (name,) in db.query(Category.name).filter(Category.user_id == user_id)
    }
    created = []
    for name, keywords, ignore_in_reports in DEFAULT_CATEGORIES:
        if normalize_text(name) in existing:
            continue
        category = Category(
            name=name,
            # Mesmo formato que o schema salva: minúsculo, sem espaços extras
            keywords=unicodedata.normalize("NFC", keywords).lower(),
            ignore_in_reports=ignore_in_reports,
            user_id=user_id,
        )
        db.add(category)
        # flush a cada uma garante ids em ordem crescente = ordem de prioridade
        db.flush()
        created.append(category)
    return created
