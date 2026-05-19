import uuid
from datetime import datetime
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    pages: int


class BaseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class UUIDSchema(BaseSchema):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class MessageResponse(BaseModel):
    message: str


class PaginationParams(BaseModel):
    page: int = 1
    page_size: int = 20

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size
