from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.dependencies import get_current_user
from app.models.category import Category
from app.models.user import User
from app.schemas.category import CategoryCreate, CategoryOut

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryOut])
def list_categories(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    return db.query(Category).filter(Category.user_id == user.id).all()


@router.post("", response_model=CategoryOut)
def create_category(
    payload: CategoryCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    existing = (
        db.query(Category)
        .filter(Category.user_id == user.id, Category.name == payload.name)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Categoria já existe")

    category = Category(name=payload.name, keywords=payload.keywords, user_id=user.id)
    db.add(category)
    db.commit()
    db.refresh(category)
    return category
