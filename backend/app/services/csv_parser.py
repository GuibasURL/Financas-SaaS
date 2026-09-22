"""
Parser de extratos em CSV.

IMPORTANTE: cada banco exporta CSV de um jeito diferente (colunas com nomes
diferentes, formato de data diferente, separador decimal diferente etc).
Para começar, este parser assume um formato simples e genérico:

    data,descricao,valor
    2025-01-05,IFOOD *RESTAURANTE XYZ,-45.90
    2025-01-06,SALARIO EMPRESA,5000.00

Conforme for testando com extratos reais, você vai naturalmente evoluir
essa função para detectar/normalizar formatos diferentes. Isso é ótimo
material de portfólio ("lidar com dados do mundo real").
"""
import io
from datetime import datetime
from decimal import Decimal, InvalidOperation

import pandas as pd


class CSVParseError(Exception):
    pass


REQUIRED_COLUMNS = {"data", "descricao", "valor"}


def parse_csv(file_bytes: bytes) -> list[dict]:
    """
    Recebe os bytes de um arquivo CSV e retorna uma lista de dicts prontos
    para virar objetos Transaction:
        [{"date": date, "description": str, "amount": Decimal}, ...]
    """
    try:
        df = pd.read_csv(io.BytesIO(file_bytes))
    except Exception as e:
        raise CSVParseError(f"Não foi possível ler o CSV: {e}")

    # normaliza nomes de coluna (minúsculo, sem espaço nas pontas)
    df.columns = [c.strip().lower() for c in df.columns]

    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise CSVParseError(
            f"Colunas obrigatórias ausentes: {missing}. "
            f"Esperado: {REQUIRED_COLUMNS}"
        )

    transactions = []
    for _, row in df.iterrows():
        try:
            parsed_date = pd.to_datetime(row["data"]).date()
        except Exception:
            raise CSVParseError(f"Data inválida na linha: {row.to_dict()}")

        try:
            amount = Decimal(str(row["valor"]))
        except InvalidOperation:
            raise CSVParseError(f"Valor inválido na linha: {row.to_dict()}")

        transactions.append(
            {
                "date": parsed_date,
                "description": str(row["descricao"]).strip(),
                "amount": amount,
            }
        )

    return transactions
