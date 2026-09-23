"""
Parser de extratos em CSV de vários bancos.

Cada banco exporta de um jeito: separador (vírgula ou ponto e vírgula),
formato de data e de valor (1.234,56 x 1234.56), linhas de cabeçalho antes
da tabela, linhas de saldo no meio, crédito e débito em colunas separadas...

Em vez de um parser por banco, cada formato é descrito por um BankFormat
(abaixo, em FORMATS). O parser procura a linha de cabeçalho que bate com
algum formato, e daí em diante lê as linhas usando a descrição desse
formato. Para suportar um banco novo ou corrigir um existente, basta
mexer em FORMATS.

Os formatos foram montados a partir de exemplos gerados por IA
(backend/tests/fixtures/extratos): quando aparecer um extrato real que não
bata, ajuste o formato e troque o arquivo de exemplo pelo real (anonimizado).
"""
import csv
import io
import re
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Optional

from app.services.text import strip_accents


class CSVParseError(Exception):
    pass


@dataclass(frozen=True)
class BankFormat:
    key: str
    label: str
    date_column: str
    # Colunas que formam a descrição, juntadas com " - " (as vazias são ignoradas)
    description_columns: tuple[str, ...]
    # Ou uma coluna de valor com sinal...
    amount_column: Optional[str] = None
    # ...ou crédito e débito separados (ambos positivos no arquivo)
    credit_column: Optional[str] = None
    debit_column: Optional[str] = None
    # Colunas que só existem nesse formato, usadas só para reconhecê-lo
    extra_columns: tuple[str, ...] = ()
    # Valores no padrão brasileiro (1.234,56)
    decimal_comma: bool = False
    # Fatura de cartão: compra vem positiva, pagamento/estorno negativo
    invert_sign: bool = False

    @property
    def columns(self) -> set[str]:
        named = [self.date_column, self.amount_column, self.credit_column, self.debit_column]
        return {c for c in named if c} | set(self.description_columns) | set(self.extra_columns)


# Nomes de coluna aqui já estão normalizados (ver _normalize_header).
FORMATS: tuple[BankFormat, ...] = (
    BankFormat(
        key="nubank_conta",
        label="Nubank (conta)",
        date_column="data",
        description_columns=("descricao",),
        amount_column="valor",
        extra_columns=("identificador",),
    ),
    BankFormat(
        key="nubank_cartao",
        label="Nubank (fatura do cartão)",
        date_column="date",
        description_columns=("title",),
        amount_column="amount",
        invert_sign=True,
    ),
    BankFormat(
        key="itau",
        label="Itaú",
        date_column="data",
        description_columns=("lancamento",),
        amount_column="valor",
        decimal_comma=True,
    ),
    BankFormat(
        key="inter",
        label="Banco Inter",
        date_column="data lancamento",
        description_columns=("historico", "descricao"),
        amount_column="valor",
        decimal_comma=True,
    ),
    BankFormat(
        key="bradesco",
        label="Bradesco",
        date_column="data",
        description_columns=("historico",),
        credit_column="credito",
        debit_column="debito",
        decimal_comma=True,
    ),
    BankFormat(
        key="banco_do_brasil",
        label="Banco do Brasil",
        date_column="data",
        description_columns=("historico",),
        amount_column="valor",
        extra_columns=("dependencia origem",),
    ),
    # Formato simples do próprio app (o do README)
    BankFormat(
        key="generico",
        label="Genérico (data, descricao, valor)",
        date_column="data",
        description_columns=("descricao",),
        amount_column="valor",
    ),
)

DELIMITERS = (",", ";", "\t")
DATE_FORMATS = ("%d/%m/%Y", "%Y-%m-%d", "%d/%m/%y", "%d-%m-%Y", "%d.%m.%Y")
# Quantas linhas do começo do arquivo olhar procurando o cabeçalho
MAX_PREAMBLE_LINES = 20


@dataclass
class ParseResult:
    format: BankFormat
    transactions: list[dict]


def parse_csv(file_bytes: bytes) -> list[dict]:
    """
    Recebe os bytes de um extrato CSV e retorna uma lista de dicts prontos
    para virar objetos Transaction:
        [{"date": date, "description": str, "amount": Decimal}, ...]
    (negativo = saída, positivo = entrada)
    """
    return parse_statement(file_bytes).transactions


def parse_statement(file_bytes: bytes) -> ParseResult:
    text = _decode(file_bytes)
    rows, bank_format, header = _find_table(text)

    transactions = []
    for line_number, row in rows:
        values = dict(zip(header, (cell.strip() for cell in row)))
        if not any(values.values()):
            continue  # linha em branco

        description = " - ".join(
            values[c] for c in bank_format.description_columns if values.get(c)
        )
        if _is_balance_line(description):
            continue  # SALDO ANTERIOR, SALDO DO DIA, "S A L D O"...

        try:
            transactions.append(
                {
                    "date": _parse_date(values.get(bank_format.date_column, "")),
                    "description": description,
                    "amount": _row_amount(values, bank_format),
                }
            )
        except ValueError as e:
            raise CSVParseError(f"Linha {line_number}: {e}")

    if not transactions:
        raise CSVParseError("O extrato não tem nenhum lançamento.")
    return ParseResult(format=bank_format, transactions=transactions)


# ---------- Leitura e detecção do formato ----------


def _decode(file_bytes: bytes) -> str:
    # utf-8-sig tira o BOM que alguns bancos colocam; Windows-1252 cobre os
    # arquivos antigos em "ANSI" (comuns em bancos tradicionais)
    for encoding in ("utf-8-sig", "cp1252"):
        try:
            return file_bytes.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise CSVParseError("Não foi possível ler o arquivo: codificação de texto desconhecida.")


def _normalize_header(name: str) -> str:
    """ 'Crédito (R$)' -> 'credito', 'Data Lançamento' -> 'data lancamento' """
    name = strip_accents(name).lower()
    name = re.sub(r"\(.*?\)", "", name)
    return " ".join(name.replace(".", " ").split())


def _match_format(header: list[str]) -> Optional[BankFormat]:
    columns = set(header)
    candidates = [f for f in FORMATS if f.columns <= columns]
    # O formato mais específico (que exige mais colunas) ganha: o do
    # Nubank conta também "serve" como genérico, mas é mais preciso
    return max(candidates, key=lambda f: len(f.columns), default=None)


def _find_table(text: str):
    """Acha a linha de cabeçalho e o formato; devolve as linhas seguintes numeradas."""
    lines = text.splitlines()
    for delimiter in DELIMITERS:
        reader = csv.reader(lines, delimiter=delimiter)
        for index, row in enumerate(reader):
            if index >= MAX_PREAMBLE_LINES:
                break
            header = [_normalize_header(cell) for cell in row]
            bank_format = _match_format(header)
            if bank_format:
                # O reader continua de onde parou (logo depois do cabeçalho);
                # line_num é o número da linha no arquivo, para as mensagens de erro
                numbered = ((reader.line_num, r) for r in reader)
                return list(numbered), bank_format, header

    labels = ", ".join(f.label for f in FORMATS)
    raise CSVParseError(
        f"Formato de extrato não reconhecido. Formatos suportados: {labels}."
    )


# ---------- Valores de cada linha ----------


def _is_balance_line(description: str) -> bool:
    compact = strip_accents(description).upper().replace(" ", "")
    return compact.startswith("SALDO")


def _parse_date(value: str) -> date:
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"data inválida: {value!r}")


def _parse_amount(value: str, decimal_comma: bool) -> Decimal:
    """
    Aceita '1.234,56', '1234,56', '1234.56', '-35.50', 'R$ 1.234,56',
    '(35,50)' (negativo) e '35,50-' (negativo).
    """
    text = value.replace("R$", "").replace("\xa0", "").replace(" ", "")
    negative = False
    if text.startswith("(") and text.endswith(")"):
        text, negative = text[1:-1], True
    if text.endswith("-"):
        text, negative = text[:-1], True

    if "," in text and "." in text:
        # O separador que aparece por último é o decimal
        if text.rfind(",") > text.rfind("."):
            text = text.replace(".", "").replace(",", ".")
        else:
            text = text.replace(",", "")
    elif "," in text:
        text = text.replace(",", ".")
    elif decimal_comma and re.fullmatch(r"-?\d{1,3}(\.\d{3})+", text):
        # "1.500" num banco que usa vírgula decimal é mil e quinhentos
        text = text.replace(".", "")

    try:
        amount = Decimal(text)
    except InvalidOperation:
        raise ValueError(f"valor inválido: {value!r}")
    return -amount if negative else amount


def _row_amount(values: dict[str, str], bank_format: BankFormat) -> Decimal:
    if bank_format.amount_column:
        amount = _parse_amount(values.get(bank_format.amount_column, ""), bank_format.decimal_comma)
    else:
        credit = values.get(bank_format.credit_column, "")
        debit = values.get(bank_format.debit_column, "")
        if not credit and not debit:
            raise ValueError("sem valor de crédito nem de débito")
        amount = Decimal(0)
        if credit:
            amount += abs(_parse_amount(credit, bank_format.decimal_comma))
        if debit:
            amount -= abs(_parse_amount(debit, bank_format.decimal_comma))

    return -amount if bank_format.invert_sign else amount
