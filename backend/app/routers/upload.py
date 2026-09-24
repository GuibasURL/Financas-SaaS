from typing import Literal

from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.dependencies import get_current_user
from app.models.statement import Statement
from app.models.transaction import Transaction
from app.models.user import User
from app.services.csv_parser import parse_csv, CSVParseError
from app.services.categorizer import categorize_all
from app.services.duplicates import DuplicateCheck, find_duplicates
from app.schemas.transaction import TransactionOut

router = APIRouter(prefix="/upload", tags=["upload"])


@router.post("", response_model=list[TransactionOut])
def upload_csv(
    file: UploadFile = File(...),
    duplicates: Literal["check", "skip", "keep"] = "check",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Importa um extrato. Transações que já foram importadas antes (mesma data,
    valor e descrição) dependem de `duplicates`:

    - `check` (padrão): se houver alguma, não importa nada e responde 409 com
      quantas são, para a pessoa escolher
    - `skip`: importa só as novas
    - `keep`: importa tudo, inclusive as repetidas
    """
    # CSV dos bancos que o app conhece, ou OFX (padrão, de qualquer banco)
    if not (file.filename or "").lower().endswith((".csv", ".ofx")):
        raise HTTPException(status_code=400, detail="Envie um arquivo .csv ou .ofx")

    file_bytes = file.file.read()

    try:
        parsed = parse_csv(file_bytes)
    except CSVParseError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if duplicates != "keep":
        check = find_duplicates(db, user.id, parsed)
        if check.count and duplicates == "check":
            raise HTTPException(status_code=409, detail=_duplicates_detail(check, len(parsed)))
        if check.count == len(parsed):
            raise HTTPException(
                status_code=400, detail="Nenhuma transação nova: todas já foram importadas."
            )
        parsed = [t for i, t in enumerate(parsed) if i not in check.indexes]

    parsed = categorize_all(db, parsed, user.id)

    statement = Statement(filename=file.filename, user_id=user.id)
    db.add(statement)

    for item in parsed:
        db.add(
            Transaction(
                date=item["date"],
                description=item["description"],
                amount=item["amount"],
                category_id=item.get("category_id"),
                statement=statement,
            )
        )
    db.commit()

    # Uma consulta só para devolver as transações criadas (com id e
    # created_at), em vez de um refresh por transação
    return (
        db.query(Transaction)
        .filter(Transaction.statement_id == statement.id)
        .order_by(Transaction.id)
        .all()
    )


def _duplicates_detail(check: DuplicateCheck, total: int) -> dict:
    """Corpo do 409: a mensagem pronta e os números, para o frontend montar as opções."""
    files = ", ".join(check.statements)
    if check.count == total:
        message = (
            "Este extrato já foi importado: "
            + ("a transação dele já está" if total == 1 else f"as {total} transações dele já estão")
            + f" em {files}."
        )
    else:
        message = (
            f"{check.count} de {total} transações deste extrato já foram importadas (em {files})."
        )
    return {
        "code": "duplicates",
        "message": message,
        "duplicates": check.count,
        "total": total,
        "statements": check.statements,
    }
