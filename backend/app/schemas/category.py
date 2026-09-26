from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, field_validator


NAME_MAX_LENGTH = 100
# As categorias sugeridas mais longas têm uns 250 caracteres de palavras-chave
KEYWORDS_MAX_LENGTH = 2000


def normalize_name(value: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError("O nome da categoria não pode ficar vazio")
    if len(value) > NAME_MAX_LENGTH:
        raise ValueError(f"O nome da categoria pode ter no máximo {NAME_MAX_LENGTH} caracteres")
    return value


def normalize_keywords(value: str) -> str:
    """
    " iFood, Restaurante ,,uber, - Mercado Pago " -> "ifood,restaurante,uber,-mercado pago"

    A comparação com a descrição já ignora maiúsculas; normalizar aqui só
    deixa o que fica salvo (e aparece na tela) limpo e sem repetição. O "-"
    na frente (palavra-chave de exclusão) é mantido, colado na palavra.
    """
    keywords = []
    for keyword in value.split(","):
        keyword = keyword.strip().lower()
        if keyword.startswith("-"):
            keyword = "-" + keyword.lstrip("-").strip()
        if keyword.strip("-") and keyword not in keywords:
            keywords.append(keyword)
    value = ",".join(keywords)
    if len(value) > KEYWORDS_MAX_LENGTH:
        raise ValueError(f"As palavras-chave podem ter no máximo {KEYWORDS_MAX_LENGTH} caracteres")
    return value


# Para que transações a regra vale: entradas e saídas, só entradas ou só saídas
Direction = Literal["all", "in", "out"]


class CategoryBase(BaseModel):
    name: str
    keywords: str = ""
    # Transações desta categoria não entram nos gráficos
    ignore_in_reports: bool = False
    direction: Direction = "all"


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
    ignore_in_reports: Optional[bool] = None
    direction: Optional[Direction] = None

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


class DefaultsResult(BaseModel):
    # Quantas categorias sugeridas foram criadas (as que o usuário já tinha são puladas)
    created: int


class ApplyRulesResult(BaseModel):
    # Quantas transações sem categoria ganharam uma categoria
    categorized: int
