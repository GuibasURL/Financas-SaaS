"""
Monta o relatório em Excel (.xlsx) a partir de transações já filtradas.

Abas:
- Resumo: filtros usados e totais do período
- Por mês: entradas, saídas e saldo de cada mês
- Por categoria: gastos por categoria, com % do total
- Transações: a lista completa (com filtro do Excel e cabeçalho fixo)

Transações de categorias marcadas como "ignorar nos gráficos" (ex:
pagamento de fatura) aparecem na aba Transações, mas ficam fora de todos
os totais, igual ao dashboard.
"""
import io
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.worksheet import Worksheet

from app.models.transaction import Transaction

MONEY_FORMAT = '"R$" #,##0.00;[Red]-"R$" #,##0.00'
PERCENT_FORMAT = "0.0%"
DATE_FORMAT = "DD/MM/YYYY"
HEADER_FONT = Font(bold=True, color="FFFFFF")
HEADER_FILL = PatternFill("solid", fgColor="2F5597")
BOLD = Font(bold=True)
UNCATEGORIZED = "Sem categoria"


@dataclass
class ReportFilters:
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    statement_name: Optional[str] = None


def counts_in_reports(transaction: Transaction) -> bool:
    return not (transaction.category and transaction.category.ignore_in_reports)


def build_report(
    transactions: list[Transaction], filters: ReportFilters, generated_at: datetime
) -> bytes:
    transactions = sorted(transactions, key=lambda t: (t.date, t.id))
    counted = [t for t in transactions if counts_in_reports(t)]

    workbook = Workbook()
    _summary_sheet(workbook.active, counted, len(transactions), filters, generated_at)
    _monthly_sheet(workbook.create_sheet("Por mês"), counted)
    _category_sheet(workbook.create_sheet("Por categoria"), counted)
    _transactions_sheet(workbook.create_sheet("Transações"), transactions)

    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


# ---------- Abas ----------


def _summary_sheet(sheet: Worksheet, counted, total_count, filters: ReportFilters, generated_at):
    sheet.title = "Resumo"
    income = sum((t.amount for t in counted if t.amount > 0), Decimal(0))
    expenses = sum((t.amount for t in counted if t.amount < 0), Decimal(0))
    ignored = total_count - len(counted)

    rows = [
        ("Relatório financeiro", None),
        (None, None),
        ("Período", _period_label(filters)),
        ("Extrato", filters.statement_name or "Todos"),
        ("Gerado em", generated_at.strftime("%d/%m/%Y %H:%M")),
        (None, None),
        ("Entradas", income),
        ("Saídas", expenses),
        ("Saldo", income + expenses),
        (None, None),
        ("Transações", total_count),
    ]
    if ignored:
        rows.append(("Fora dos totais (categorias ignoradas)", ignored))

    for row in rows:
        sheet.append(row)
    sheet["A1"].font = Font(bold=True, size=14)
    for cell in ("B7", "B8", "B9"):
        sheet[cell].number_format = MONEY_FORMAT
    for cell in ("A7", "A8", "A9", "B9"):
        sheet[cell].font = BOLD
    _set_widths(sheet, [40, 26])


def _monthly_sheet(sheet: Worksheet, counted):
    months: dict[tuple[int, int], list[Decimal]] = defaultdict(lambda: [Decimal(0), Decimal(0)])
    for t in counted:
        totals = months[(t.date.year, t.date.month)]
        totals[0 if t.amount > 0 else 1] += t.amount

    _header(sheet, ["Mês", "Entradas", "Saídas", "Saldo"])
    for (year, month), (income, expenses) in sorted(months.items()):
        sheet.append([f"{month:02d}/{year}", income, expenses, income + expenses])
    _total_row(sheet, "Total", columns=["B", "C", "D"])
    _format_columns(sheet, {"B": MONEY_FORMAT, "C": MONEY_FORMAT, "D": MONEY_FORMAT})
    _set_widths(sheet, [12, 16, 16, 16])


def _category_sheet(sheet: Worksheet, counted):
    spending: dict[str, Decimal] = defaultdict(Decimal)
    for t in counted:
        if t.amount < 0:
            spending[t.category.name if t.category else UNCATEGORIZED] += -t.amount
    total = sum(spending.values(), Decimal(0))

    _header(sheet, ["Categoria", "Gastos", "% do total"])
    # Maior gasto primeiro
    for name, value in sorted(spending.items(), key=lambda item: (-item[1], item[0])):
        sheet.append([name, value, float(value / total) if total else 0])
    _total_row(sheet, "Total", columns=["B"])
    if total:
        sheet.cell(row=sheet.max_row, column=3, value=1)
    _format_columns(sheet, {"B": MONEY_FORMAT, "C": PERCENT_FORMAT})
    _set_widths(sheet, [30, 16, 12])


def _transactions_sheet(sheet: Worksheet, transactions):
    _header(sheet, ["Data", "Descrição", "Categoria", "Valor", "Extrato", "Nos totais"])
    for t in transactions:
        sheet.append(
            [
                t.date,
                t.description,
                t.category.name if t.category else UNCATEGORIZED,
                t.amount,
                t.statement.filename,
                "Sim" if counts_in_reports(t) else "Não (ignorada)",
            ]
        )
    _format_columns(sheet, {"A": DATE_FORMAT, "D": MONEY_FORMAT})
    sheet.freeze_panes = "A2"  # cabeçalho fixo ao rolar
    sheet.auto_filter.ref = sheet.dimensions
    _set_widths(sheet, [12, 45, 22, 14, 28, 16])


# ---------- Helpers ----------


def _period_label(filters: ReportFilters) -> str:
    start = filters.start_date.strftime("%d/%m/%Y") if filters.start_date else None
    end = filters.end_date.strftime("%d/%m/%Y") if filters.end_date else None
    if start and end:
        return f"{start} a {end}"
    if start:
        return f"A partir de {start}"
    if end:
        return f"Até {end}"
    return "Todo o período"


def _header(sheet: Worksheet, titles: list[str]):
    sheet.append(titles)
    for cell in sheet[1]:
        cell.font = HEADER_FONT
        cell.fill = HEADER_FILL


def _total_row(sheet: Worksheet, label: str, columns: list[str]):
    """Linha de total com fórmula SUM, para continuar certa se editarem a planilha."""
    last = sheet.max_row
    total_row = last + 1
    sheet.cell(row=total_row, column=1, value=label).font = BOLD
    for column in columns:
        cell = sheet[f"{column}{total_row}"]
        cell.value = f"=SUM({column}2:{column}{last})" if last >= 2 else 0
        cell.font = BOLD


def _format_columns(sheet: Worksheet, formats: dict[str, str]):
    for column, number_format in formats.items():
        for cell in sheet[column][1:]:  # pula o cabeçalho
            cell.number_format = number_format


def _set_widths(sheet: Worksheet, widths: list[int]):
    for index, width in enumerate(widths, start=1):
        sheet.column_dimensions[get_column_letter(index)].width = width
