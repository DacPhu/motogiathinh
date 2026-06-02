"""Fee plans — full CRUD on the new fee_plans table."""

import uuid
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from app.dependencies import DB, CurrentUser
from app.models.fee_plan import FeePlan

router = APIRouter(prefix="/fee-plans", tags=["fee-plans"])


def _to_wire(f: FeePlan) -> dict:
    return {
        "id": str(f.id),
        "name": f.name,
        "licence": f.licence,
        "amount": int(float(f.amount or 0)),
    }


@router.get("")
async def list_fee_plans(current_user: CurrentUser, db: DB):
    res = await db.execute(select(FeePlan).order_by(FeePlan.licence.asc()))
    return [_to_wire(f) for f in res.scalars().all()]


class FeePlanCreate(BaseModel):
    name: str
    licence: str
    amount: int


class FeePlanUpdate(BaseModel):
    name: Optional[str] = None
    licence: Optional[str] = None
    amount: Optional[int] = None


@router.post("", status_code=201)
async def create_fee_plan(
    data: FeePlanCreate,
    current_user: CurrentUser,
    db: DB,
):
    if data.licence not in ("A", "A1"): raise HTTPException(400, "invalid_licence")
    f = FeePlan(name=data.name, licence=data.licence, amount=Decimal(data.amount))
    db.add(f)
    await db.commit()
    await db.refresh(f)
    return _to_wire(f)


@router.patch("/{fee_plan_id}")
async def update_fee_plan(
    fee_plan_id: str,
    data: FeePlanUpdate,
    current_user: CurrentUser,
    db: DB,
):
    try: u = uuid.UUID(fee_plan_id)
    except ValueError: raise HTTPException(400, "invalid_id")
    f = await db.get(FeePlan, u)
    if not f: raise HTTPException(404, "fee_plan_not_found")
    fields = data.model_dump(exclude_unset=True)
    if "name" in fields: f.name = fields["name"]
    if "licence" in fields:
        if fields["licence"] not in ("A", "A1"): raise HTTPException(400, "invalid_licence")
        f.licence = fields["licence"]
    if "amount" in fields: f.amount = Decimal(fields["amount"])
    await db.commit()
    await db.refresh(f)
    return _to_wire(f)
