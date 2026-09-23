"""
Leitura de extratos OFX (Open Financial Exchange), o formato padrão que a
maioria dos bancos oferece para download, igual em todos eles. Um leitor só
cobre qualquer banco, inclusive os que não têm um formato CSV próprio no app.

Aceita as duas versões:
- OFX 1.x (SGML): tags de valor sem fechamento, uma por linha
      <STMTTRN>
      <TRNTYPE>DEBIT
      <DTPOSTED>20250305120000[-3:BRT]
      <TRNAMT>-35.50
      <MEMO>COMPRA PADARIA
      </STMTTRN>
- OFX 2.x (XML): <MEMO>COMPRA PADARIA</MEMO>, com entidades como &amp;

De cada lançamento (<STMTTRN>) usa a data (DTPOSTED), o valor com sinal
(TRNAMT: negativo = saída) e a descrição (NAME e MEMO). Serve para extrato
de conta e para fatura de cartão (na fatura, compra também vem negativa).
"""
import html
import re
from datetime import date

# Onde cada lançamento começa, e onde termina a lista de lançamentos
_TRANSACTION_START = re.compile(r"<STMTTRN>", re.IGNORECASE)
_LIST_END = re.compile(r"</BANKTRANLIST>", re.IGNORECASE)

# Tipos de lançamento que são sempre saída de dinheiro. Alguns bancos mandam
# o valor positivo mesmo assim (fora do padrão); nesses casos o sinal é corrigido.
_OUTFLOW_TYPES = {"DEBIT", "PAYMENT", "CHECK", "ATM", "POS", "FEE", "SRVCHG", "DIRECTDEBIT"}


class OFXParseError(ValueError):
    pass


def looks_like_ofx(text: str) -> bool:
    """Cabeçalho do OFX 1.x ("OFXHEADER:100") ou a tag <OFX> do 2.x."""
    start = text.lstrip()[:2000].upper()
    return start.startswith("OFXHEADER") or "<OFX>" in start or "<?OFX" in start


def parse_ofx(text: str) -> list[dict]:
    """
    Devolve os lançamentos no mesmo formato do leitor de CSV:
        [{"date": date, "description": str, "amount": Decimal}, ...]
    """
    # Import aqui para não criar ciclo: o csv_parser chama este módulo
    from app.services.csv_parser import _is_balance_line, _parse_amount

    transactions = []
    seen_ids = set()
    for block, line_number in _transaction_blocks(text):
        try:
            transaction_id = _field(block, "FITID")
            # O mesmo lançamento repetido no arquivo (acontece em alguns bancos)
            if transaction_id and transaction_id in seen_ids:
                continue

            description = _description(block)
            if _is_balance_line(description):
                continue

            amount = _parse_amount(_required(block, "TRNAMT"), decimal_comma=False)
            if _field(block, "TRNTYPE").upper() in _OUTFLOW_TYPES and amount > 0:
                amount = -amount

            transactions.append(
                {
                    "date": _parse_date(_required(block, "DTPOSTED")),
                    "description": description,
                    "amount": amount,
                }
            )
            if transaction_id:
                seen_ids.add(transaction_id)
        except ValueError as e:
            raise OFXParseError(f"Linha {line_number}: {e}")

    if not transactions:
        raise OFXParseError("O extrato OFX não tem nenhum lançamento.")
    return transactions


def _transaction_blocks(text: str):
    """
    Cada <STMTTRN> até o próximo <STMTTRN> (ou o fim da lista). Não depende
    do </STMTTRN>, que alguns bancos omitem no SGML. Devolve (bloco, linha).
    """
    starts = [m.start() for m in _TRANSACTION_START.finditer(text)]
    list_end = _LIST_END.search(text)
    end_of_list = list_end.start() if list_end else len(text)
    for index, start in enumerate(starts):
        end = starts[index + 1] if index + 1 < len(starts) else max(end_of_list, start)
        yield text[start:end], text.count("\n", 0, start) + 1


def _field(block: str, tag: str) -> str:
    # O valor vai até o fim da linha ou a próxima tag (serve para SGML e XML)
    match = re.search(rf"<{tag}>([^<\r\n]*)", block, re.IGNORECASE)
    return html.unescape(match.group(1)).strip() if match else ""


def _required(block: str, tag: str) -> str:
    value = _field(block, tag)
    if not value:
        raise ValueError(f"lançamento sem {tag}")
    return value


def _description(block: str) -> str:
    """NAME e MEMO juntos; se um já contém o outro, fica só o mais completo."""
    name, memo = _field(block, "NAME"), _field(block, "MEMO")
    if not name or name.upper() in memo.upper():
        text = memo or name
    elif memo.upper() in name.upper():
        text = name
    else:
        text = f"{name} - {memo}"
    return " ".join(text.split()) or "Lançamento sem descrição"


def _parse_date(value: str) -> date:
    """ "20250305", "20250305120000", "20250305120000.000[-3:BRT]" -> 2025-03-05 """
    digits = re.match(r"\d{8}", value)
    if not digits:
        raise ValueError(f"data inválida: {value!r}")
    text = digits.group(0)
    try:
        return date(int(text[:4]), int(text[4:6]), int(text[6:8]))
    except ValueError:
        raise ValueError(f"data inválida: {value!r}")
