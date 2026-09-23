from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.dependencies import get_current_user
from app.models.statement import Statement
from app.models.transaction import Transaction
from app.models.user import User
from app.services.csv_parser import parse_csv, CSVParseError
from app.services.categorizer import categorize_all
from app.schemas.transaction import TransactionOut

router = APIRouter(prefix="/upload", tags=["upload"])


@router.post("", response_model=list[TransactionOut])
def upload_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Envie um arquivo .csv")

    file_bytes = file.file.read()

    try:
        parsed = parse_csv(file_bytes)
    except CSVParseError as e:
        raise HTTPException(status_code=400, detail=str(e))

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
