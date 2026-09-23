from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator


def normalize_name(value: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError("O nome da categoria não pode ficar vazio")
    return value


def normalize_keywords(value: str) -> str:
    """
    " iFood, Restaurante ,,uber " -> "ifood,restaurante,uber"

    A comparação com a descrição já ignora maiúsculas; normalizar aqui só
    deixa o que fica salvo (e aparece na tela) limpo e sem repetição.
    """
    keywords = []
    for keyword in value.split(","):
        keyword = keyword.strip().lower()
        if keyword and keyword not in keywords:
            keywords.append(keyword)
    return ",".join(keywords)


class CategoryBase(BaseModel):
    name: str
    keywords: str = ""


class CategoryCreate(CategoryBase):
    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return normalize_name(value)

    @field_validator("keywords")
    @classmethod
    def validate_keywords(cls, value: str) -> str:
        return normalize_keywords(value)


class CategoryUpdate(BaseModel):
    """Só os campos enviados são alterados."""

    name: Optional[str] = None
    keywords: Optional[str] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: Optional[str]) -> Optional[str]:
        return None if value is None else normalize_name(value)

    @field_validator("keywords")
    @classmethod
    def validate_keywords(cls, value: Optional[str]) -> Optional[str]:
        return None if value is None else normalize_keywords(value)


class CategoryOut(CategoryBase):
    model_config = ConfigDict(from_attributes=True)

    id: int


class ApplyRulesResult(BaseModel):
    # Quantas transações sem categoria ganharam uma categoria
    categorized: int
