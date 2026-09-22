from pydantic import BaseModel, ConfigDict


class CategoryBase(BaseModel):
    name: str
    keywords: str = ""


class CategoryCreate(CategoryBase):
    pass


class CategoryOut(CategoryBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
