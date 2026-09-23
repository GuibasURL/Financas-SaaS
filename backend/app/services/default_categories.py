"""
Categorias sugeridas: criadas automaticamente para contas novas e
disponíveis para contas existentes (POST /categories/defaults).

A ORDEM IMPORTA: quando mais de uma categoria bate com a descrição, vence
a criada primeiro. Por isso as mais específicas vêm antes:
- "Assinaturas" (amazon prime) antes de "Compras" (amazon)
- "Compras" (mercado livre) antes de "Mercado" (mercado)
- "Alimentação" (uber eats) antes de "Transporte" (uber)

Cuidado ao acrescentar palavras-chave: a comparação é por "contém", então
palavras curtas pegam coisas demais. Exemplos que ficaram de fora por isso:
"posto" (está em "imPOSTO"), "curso" (em "reCURSOs"), "amil" (em "fAMILia"),
"internet" (em "INTERNET BANKING"), "99" e "bar" (em qualquer número/"BARbearia").
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
        "mercado livre,amazon,shopee,magazine luiza,magalu,americanas,shein,aliexpress",
        False,
    ),
    (
        "Alimentação",
        "ifood,uber eats,rappi,restaurante,lanchonete,padaria,pizzaria,hamburgueria,"
        "mcdonalds,mc donalds,burger king,subway,cafeteria,starbucks",
        False,
    ),
    (
        "Mercado",
        "supermercado,mercado,atacadão,assaí,carrefour,pão de açúcar,hortifruti",
        False,
    ),
    (
        "Transporte",
        "uber,99 pop,99pop,99app,cabify,auto posto,posto de gasolina,combustível,"
        "shell,ipiranga,petrobras,estacionamento,pedágio,sem parar,metrô,bilhete único",
        False,
    ),
    (
        "Saúde",
        "farmácia,drogaria,drogasil,droga raia,pague menos,hospital,clínica,laboratório,"
        "consulta,dentista,odonto,unimed,hapvida,sulamerica,bradesco saude,academia,smart fit",
        False,
    ),
    (
        "Moradia",
        "aluguel,condomínio,iptu,conta de luz,energia elétrica,enel,cemig,copel,sabesp,"
        "comgás,conta de água",
        False,
    ),
    (
        "Educação",
        "escola,colégio,faculdade,universidade,udemy,alura,coursera,livraria",
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
