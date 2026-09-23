from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.db import get_db
from app.dependencies import get_current_user
from app.models.category import Category
from app.models.transaction import Transaction
from app.models.user import User
from app.routers.transactions import user_transactions
from app.schemas.category import (
    ApplyRulesResult,
    CategoryCreate,
    CategoryOut,
    CategoryUpdate,
    DefaultsResult,
)
from app.services.categorizer import categorize_uncategorized
from app.services.default_categories import add_default_categories

router = APIRouter(prefix="/categories", tags=["categories"])


def _get_user_category(db: Session, user: User, category_id: int) -> Category:
    category = (
        db.query(Category)
        .filter(Category.id == category_id, Category.user_id == user.id)
        .first()
    )
    # Categoria de outro usuário responde igual a inexistente
    if not category:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    return category


def _ensure_name_available(db: Session, user: User, name: str, exclude_id: int | None = None):
    query = db.query(Category).filter(Category.user_id == user.id, Category.name == name)
    if exclude_id is not None:
        query = query.filter(Category.id != exclude_id)
    if query.first():
        raise HTTPException(status_code=400, detail="Categoria já existe")


@router.get("", response_model=list[CategoryOut])
def list_categories(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    return db.query(Category).filter(Category.user_id == user.id).order_by(Category.name).all()


@router.post("", response_model=CategoryOut)
def create_category(
    payload: CategoryCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _ensure_name_available(db, user, payload.name)

    category = Category(
        name=payload.name,
        keywords=payload.keywords,
        ignore_in_reports=payload.ignore_in_reports,
        user_id=user.id,
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.patch("/{category_id}", response_model=CategoryOut)
def update_category(
    category_id: int,
    payload: CategoryUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    category = _get_user_category(db, user, category_id)

    if payload.name is not None:
        _ensure_name_available(db, user, payload.name, exclude_id=category.id)
        category.name = payload.name
    if payload.keywords is not None:
        category.keywords = payload.keywords
    if payload.ignore_in_reports is not None:
        category.ignore_in_reports = payload.ignore_in_reports

    db.commit()
    db.refresh(category)
    return category


@router.delete("/{category_id}", status_code=204)
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Exclui a categoria; as transações dela ficam sem categoria (não são apagadas)."""
    category = _get_user_category(db, user, category_id)

    db.query(Transaction).filter(Transaction.category_id == category.id).update(
        {Transaction.category_id: None}, synchronize_session=False
    )
    db.delete(category)
    db.commit()
    return Response(status_code=204)


@router.post("/defaults", response_model=DefaultsResult)
def add_defaults(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """
    Cria as categorias sugeridas que o usuário ainda não tem (pelo nome,
    sem diferenciar maiúsculas nem acentos). As que já existem não são
    alteradas. Para categorizar extratos já importados, chame depois o
    /categories/apply-rules.
    """
    created = add_default_categories(db, user.id)
    db.commit()
    return DefaultsResult(created=len(created))


@router.post("/apply-rules", response_model=ApplyRulesResult)
def apply_rules(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """
    Reaplica as palavras-chave atuais às transações já importadas que estão
    sem categoria. Útil depois de criar ou editar categorias: sem isso, as
    regras novas só valeriam para os próximos uploads.
    """
    uncategorized = user_transactions(db, user).filter(Transaction.category_id.is_(None)).all()
    categorized = categorize_uncategorized(db, uncategorized, user.id)
    db.commit()
    return ApplyRulesResult(categorized=categorized)
