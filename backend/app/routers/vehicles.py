"""Vehicles CRUD."""

import uuid
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from app.dependencies import DB, CurrentUser
from app.models.branch import Branch
from app.models.enums import LicenseType, VehicleStatus
from app.models.vehicle import Vehicle
from app.utils.dates import license_to_db, license_to_wire

router = APIRouter(prefix="/vehicles", tags=["vehicles"])


def _to_wire(v: Vehicle, slug_map: dict) -> dict:
    parts = [getattr(v, "hang_xe", None), getattr(v, "loai_xe", None)]
    name = (getattr(v, "ten_xe", None) or " ".join(p for p in parts if p) or getattr(v, "bien_so", "—"))
    licence_raw = getattr(v, "loai_bang_lai", None)
    licence_val = licence_raw.value if hasattr(licence_raw, "value") else licence_raw
    status_raw = getattr(v, "trang_thai", None)
    status_val = status_raw.value if hasattr(status_raw, "value") else status_raw
    return {
        "id": str(v.id),
        "name": name,
        "licence": license_to_wire(licence_val),
        "plate": getattr(v, "bien_so", None),
        "year": getattr(v, "nam_san_xuat", None),
        "branchId": slug_map.get(getattr(v, "branch_id", None), str(v.branch_id) if getattr(v, "branch_id", None) else None),
        "status": "Hoạt động" if status_val == "active" else ("Sửa chữa" if status_val == "maintenance" else None),
        "price": int(float(getattr(v, "rental_price", 0) or 0)),
    }


async def _slug_map(db) -> dict:
    res = await db.execute(select(Branch))
    return {b.id: (b.slug or str(b.id)) for b in res.scalars().all()}


async def _branch_id(db, s: Optional[str]) -> Optional[uuid.UUID]:
    if not s: return None
    try: return uuid.UUID(s)
    except ValueError:
        res = await db.execute(select(Branch).where(Branch.slug == s))
        b = res.scalar_one_or_none()
        return b.id if b else None


@router.get("")
async def list_vehicles(current_user: CurrentUser, db: DB):
    res = await db.execute(select(Vehicle).where(Vehicle.deleted_at.is_(None)))
    slug_map = await _slug_map(db)
    return [_to_wire(v, slug_map) for v in res.scalars().all()]


class VehicleCreate(BaseModel):
    name: str
    licence: Optional[str] = None
    plate: Optional[str] = None
    year: Optional[int] = None
    branchId: Optional[str] = None
    status: Optional[str] = None
    price: int = 0


class VehicleUpdate(BaseModel):
    name: Optional[str] = None
    licence: Optional[str] = None
    plate: Optional[str] = None
    year: Optional[int] = None
    branchId: Optional[str] = None
    status: Optional[str] = None
    price: Optional[int] = None


def _status_to_db(s: Optional[str]) -> VehicleStatus:
    if s == "Sửa chữa": return VehicleStatus.maintenance
    if s == "Hoạt động" or s is None: return VehicleStatus.active
    return VehicleStatus.active


@router.post("", status_code=201)
async def create_vehicle(
    data: VehicleCreate,
    current_user: CurrentUser,
    db: DB,
):
    branch_uuid = await _branch_id(db, data.branchId)
    if not branch_uuid:
        # Pick first branch as fallback (sibling allows null branchId; we require it)
        res = await db.execute(select(Branch).where(Branch.is_active == True).limit(1))
        b = res.scalar_one_or_none()
        if not b: raise HTTPException(400, "no_branches_available")
        branch_uuid = b.id
    v = Vehicle(
        branch_id=branch_uuid,
        bien_so=data.plate or f"NEW-{uuid.uuid4().hex[:6].upper()}",
        loai_xe="motorbike",
        ten_xe=data.name,
        nam_san_xuat=data.year,
        loai_bang_lai=LicenseType(license_to_db(data.licence or "A1")),
        trang_thai=_status_to_db(data.status),
        rental_price=Decimal(data.price),
    )
    db.add(v)
    await db.commit()
    await db.refresh(v)
    return _to_wire(v, await _slug_map(db))


@router.patch("/{vehicle_id}")
async def update_vehicle(
    vehicle_id: str,
    data: VehicleUpdate,
    current_user: CurrentUser,
    db: DB,
):
    try: u = uuid.UUID(vehicle_id)
    except ValueError: raise HTTPException(400, "invalid_id")
    v = await db.get(Vehicle, u)
    if not v: raise HTTPException(404, "vehicle_not_found")
    fields = data.model_dump(exclude_unset=True)
    if "name" in fields:    v.ten_xe = fields["name"]
    if "plate" in fields:   v.bien_so = fields["plate"]
    if "year" in fields:    v.nam_san_xuat = fields["year"]
    if "licence" in fields: v.loai_bang_lai = LicenseType(license_to_db(fields["licence"]))
    if "status" in fields:  v.trang_thai = _status_to_db(fields["status"])
    if "price" in fields:   v.rental_price = Decimal(fields["price"])
    if "branchId" in fields:
        bid = await _branch_id(db, fields["branchId"])
        if bid: v.branch_id = bid
    await db.commit()
    await db.refresh(v)
    return _to_wire(v, await _slug_map(db))
