"""
Categorias sugeridas: criadas automaticamente para contas novas e
disponíveis para contas existentes (POST /categories/defaults).

A ORDEM IMPORTA: quando mais de uma categoria bate com a descrição, vence
a criada primeiro. Por isso as mais específicas vêm antes (e as genéricas,
como as transferências, por último):
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
from typing import NamedTuple

from sqlalchemy.orm import Session

from app.models.category import Category
from app.services.text import normalize_text

class DefaultCategory(NamedTuple):
    name: str
    keywords: str
    # Transações desta categoria não entram nos gráficos nem nos totais
    ignore_in_reports: bool = False
    # "all": entradas e saídas; "in": só entradas; "out": só saídas
    direction: str = "all"


DEFAULT_CATEGORIES: tuple[DefaultCategory, ...] = (
    DefaultCategory(
        "Pagamento de fatura",
        "pagamento de fatura,pagamento recebido,pgto fatura,pagto fatura,fatura picpay",
        ignore_in_reports=True,
    ),
    # Só entradas: dinheiro de volta de uma compra não é renda nem gasto novo
    DefaultCategory("Estornos e reembolsos", "estorno,reembolso,devolução,cashback", direction="in"),
    DefaultCategory("Salário", "salário,proventos", direction="in"),
    # Dinheiro que só muda de lugar (conta -> aplicação e volta): fora dos totais.
    # Antes das transferências, para "TRANSF PARA POUPANCA" cair aqui.
    DefaultCategory(
        "Investimentos",
        # "resgatado"/"cofrinho": no PicPay, "Dinheiro resgatado - Do cofrinho Economia"
        "aplicação,resgate,resgatado,investimento,cdb,rdb,lci,lca,tesouro direto,poupança,"
        "cofrinho",
        ignore_in_reports=True,
    ),
    DefaultCategory(
        "Assinaturas",
        "netflix,spotify,amazon prime,prime video,disney,hbo,youtube premium,"
        "globoplay,apple.com,deezer",
    ),
    DefaultCategory(
        "Compras",
        "mercado livre,mercadolivre,amazon,shopee,magazine luiza,magalu,americanas,shein,"
        "aliexpress,riachuelo,renner",
    ),
    DefaultCategory(
        "Alimentação",
        "ifood,uber eats,ubereats,rappi,restaurante,lanchonete,padaria,pizzaria,hamburgueria,"
        "mcdonalds,mc donalds,burger king,subway,cafeteria,starbucks",
    ),
    DefaultCategory(
        "Mercado",
        "supermercado,mercado,atacadão,assaí,carrefour,pão de açúcar,hortifruti,"
        "-mercado pago,-mercadopago",
    ),
    DefaultCategory(
        "Transporte",
        "uber,99 pop,99pop,99app,cabify,posto,combustível,shell,ipiranga,petrobras,"
        "estacionamento,pedágio,sem parar,metrô,bilhete único",
    ),
    DefaultCategory(
        "Saúde",
        "farmácia,drogaria,drogasil,droga raia,pague menos,hospital,clínica,laboratório,"
        "consulta,dentista,odonto,unimed,amil,hapvida,sulamerica,bradesco saude,academia,"
        "smart fit,smartfit,rd saude",
    ),
    DefaultCategory(
        "Moradia",
        "aluguel,condomínio,iptu,conta de luz,boleto de luz,energia elétrica,enel,cemig,"
        "copel,sabesp,comgás,conta de água",
    ),
    DefaultCategory(
        "Educação",
        "escola,colégio,faculdade,universidade,curso,udemy,alura,coursera,livraria",
    ),
    DefaultCategory("Lazer", "cinema,cinemark,ingresso,teatro,show,steam,playstation,xbox"),
    DefaultCategory("Tarifas bancárias", "tarifa,anuidade,iof,juros"),
    DefaultCategory("Saques", "saque", direction="out"),
    # Por último: "pix" e "transf" são genéricas, então qualquer categoria mais
    # específica acima vence ("PIX ALUGUEL" vai para Moradia). O mesmo texto
    # aparece nos dois sentidos; o sinal do valor decide qual das duas pega.
    # Contam nos totais: Pix para outra pessoa costuma ser gasto (ou renda) de
    # verdade. Entre as próprias contas, o usuário cria uma categoria ignorada.
    DefaultCategory("Transferências enviadas", "pix,transf,ted", direction="out"),
    DefaultCategory("Transferências recebidas", "pix,transf,ted", direction="in"),
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
    for default in DEFAULT_CATEGORIES:
        if normalize_text(default.name) in existing:
            continue
        category = Category(
            name=default.name,
            # Mesmo formato que o schema salva: minúsculo, sem espaços extras
            keywords=unicodedata.normalize("NFC", default.keywords).lower(),
            ignore_in_reports=default.ignore_in_reports,
            direction=default.direction,
            user_id=user_id,
        )
        db.add(category)
        # flush a cada uma garante ids em ordem crescente = ordem de prioridade
        db.flush()
        created.append(category)
    return created
