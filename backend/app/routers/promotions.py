"""Promotions CRUD."""

import uuid
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from app.dependencies import DB, CurrentUser
from app.models.promotion import Promotion

router = APIRouter(prefix="/promotions", tags=["promotions"])


def _to_wire(p: Promotion) -> dict:
    applies = ["A", "A1"]
    raw_csv: Optional[str] = getattr(p, "applies_to_csv", None)
    if raw_csv:
        applies = [x for x in raw_csv.split("|") if x in ("A", "A1")] or ["A", "A1"]
    discount = 0
    try:
        if getattr(p, "loai_khuyen_mai", None) == "fixed":
            discount = int(float(p.gia_tri or 0))
    except (ValueError, TypeError):
        discount = 0
    return {
        "id": str(p.id),
        "name": p.ten_khuyen_mai or "",
        "appliesTo": applies,
        "discount": discount,
    }


@router.get("")
async def list_promotions(current_user: CurrentUser, db: DB):
    res = await db.execute(select(Promotion).where(Promotion.deleted_at.is_(None), Promotion.is_active == True))
    return [_to_wire(p) for p in res.scalars().all()]


class PromotionCreate(BaseModel):
    name: str
    appliesTo: list[str] = ["A", "A1"]
    discount: int = 0


class PromotionUpdate(BaseModel):
    name: Optional[str] = None
    appliesTo: Optional[list[str]] = None
    discount: Optional[int] = None


def _normalize_applies(arr: list[str]) -> str:
    out = [x for x in arr if x in ("A", "A1")]
    return "|".join(out) if out else "A|A1"


@router.post("", status_code=201)
async def create_promotion(
    data: PromotionCreate,
    current_user: CurrentUser,
    db: DB,
):
    ma = f"KM-{int(Decimal(uuid.uuid4().int).remainder(10**8)):08d}"
    p = Promotion(
        ma_khuyen_mai=ma,
        ten_khuyen_mai=data.name,
        loai_khuyen_mai="fixed",
        gia_tri=Decimal(data.discount),
        is_active=True,
        applies_to_csv=_normalize_applies(data.appliesTo),
    )
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return _to_wire(p)


@router.patch("/{promotion_id}")
async def update_promotion(
    promotion_id: str,
    data: PromotionUpdate,
    current_user: CurrentUser,
    db: DB,
):
    try: u = uuid.UUID(promotion_id)
    except ValueError: raise HTTPException(400, "invalid_id")
    p = await db.get(Promotion, u)
    if not p: raise HTTPException(404, "promotion_not_found")
    fields = data.model_dump(exclude_unset=True)
    if "name" in fields:       p.ten_khuyen_mai = fields["name"]
    if "discount" in fields:   p.gia_tri = Decimal(fields["discount"]); p.loai_khuyen_mai = "fixed"
    if "appliesTo" in fields:  p.applies_to_csv = _normalize_applies(fields["appliesTo"])
    await db.commit()
    await db.refresh(p)
    return _to_wire(p)
