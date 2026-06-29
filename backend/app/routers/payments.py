"""Payments — immutable event log. GET list + POST tuition/rental + biên lai upload."""

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import select

from app.core.storage import upload_bytes
from app.dependencies import DB, CurrentUser, accessible_class_ids, require_permission
from app.models.branch import Branch
from app.models.enums import PaymentMethod, PaymentStatus, RoleName
from app.models.class_model import ClassEnrollment
from app.models.payment import Payment
from app.models.student import Student
from app.models.vehicle import Vehicle
from app.utils.dates import iso_to_vn_datetime, method_to_db, method_to_wire
from app.utils.id_generator import next_bien_lai_id

router = APIRouter(prefix="/payments", tags=["payments"])


def _to_wire(p: Payment, slug_map: dict) -> dict:
    method_raw = getattr(p, "phuong_thuc", None)
    method_val = method_raw.value if hasattr(method_raw, "value") else method_raw
    return {
        "id": p.id.hex[:8],
        "studentId": p.student_id.hex[:8] if p.student_id else None,
        "branchId": slug_map.get(p.branch_id, str(p.branch_id) if p.branch_id else None),
        "staffId": str(p.collected_by) if p.collected_by else None,
        "amount": int(float(p.so_tien or 0)),
        "method": method_to_wire(method_val),
        "bienLaiId": getattr(p, "so_bien_lai_id", None) or getattr(p, "ma_giao_dich", "") or "",
        "bienLaiPhoto": bool(getattr(p, "bien_lai_photo_url", None)),
        "bienLaiPhoto_url": getattr(p, "bien_lai_photo_url", None),
        "createdAt": iso_to_vn_datetime(p.collected_at or p.payment_date) or "",
        "kind": getattr(p, "kind", "tuition") or "tuition",
        "vehicleId": str(p.vehicle_id) if getattr(p, "vehicle_id", None) else None,
        "rentalRounds": getattr(p, "rental_rounds", None),
    }


async def _slug_map(db) -> dict:
    res = await db.execute(select(Branch))
    return {b.id: (b.slug or str(b.id)) for b in res.scalars().all()}


@router.get("")
async def list_payments(current_user: CurrentUser, db: DB):
    # No LIMIT — must match /api/students; capping orphans payment.studentId.
    query = select(Payment).where(Payment.deleted_at.is_(None)).order_by(Payment.collected_at.desc())
    if current_user.role == RoleName.collaborator:
        acc = await accessible_class_ids(db, current_user)
        if not acc:
            return []
        enrolled_subq = (
            select(ClassEnrollment.student_id)
            .where(
                ClassEnrollment.class_id.in_(acc),
                ClassEnrollment.deleted_at.is_(None),
            )
        )
        query = query.where(Payment.student_id.in_(enrolled_subq))
    elif current_user.role != RoleName.admin and current_user.branch_id:
        query = query.where(Payment.branch_id == current_user.branch_id)
    result = await db.execute(query)
    slug_map = await _slug_map(db)
    return [_to_wire(p, slug_map) for p in result.scalars().all()]


# ── Create (tuition or rental) ──────────────────────────────────────────────
class PaymentCreate(BaseModel):
    studentId: str
    amount: Optional[int] = None
    method: str = "Tiền mặt"
    bienLaiId: Optional[str] = None
    bienLaiPhoto: bool = False
    staffId: Optional[str] = None
    kind: str = "tuition"  # "tuition" | "rental"
    vehicleId: Optional[str] = None
    rentalRounds: Optional[int] = None


@router.post("", status_code=201)
async def create_payment(
    data: PaymentCreate,
    current_user: CurrentUser,
    db: DB,
    _perm: Annotated[None, Depends(require_permission("payments", "create"))] = None,
):
    try: s_uuid = uuid.UUID(data.studentId)
    except ValueError: raise HTTPException(400, "invalid_studentId")
    student = await db.get(Student, s_uuid)
    if not student: raise HTTPException(400, "invalid_studentId")
    if current_user.role != RoleName.admin and current_user.branch_id != student.branch_id:
        raise HTTPException(403, "wrong_branch")

    if data.kind == "rental":
        if not data.vehicleId: raise HTTPException(400, "rental_requires_vehicleId")
        if not data.rentalRounds or data.rentalRounds < 1:
            raise HTTPException(400, "rental_requires_positive_rounds")
        try: v_uuid = uuid.UUID(data.vehicleId)
        except ValueError: raise HTTPException(400, "invalid_vehicleId")
        veh = await db.get(Vehicle, v_uuid)
        if not veh: raise HTTPException(400, "invalid_vehicleId")
        amount = int(float(veh.rental_price or 0)) * int(data.rentalRounds)
    else:
        if data.amount is None: raise HTTPException(400, "amount_required")
        amount = int(data.amount)
    if amount == 0:
        raise HTTPException(400, "amount_must_be_nonzero")

    bl_id = data.bienLaiId or (await next_bien_lai_id())
    p = Payment(
        branch_id=student.branch_id,
        student_id=student.id,
        payment_plan_id=None,  # sibling contract has no payment_plan concept
        ma_giao_dich=bl_id,
        so_bien_lai_id=bl_id,
        so_tien=Decimal(amount),
        phuong_thuc=PaymentMethod(method_to_db(data.method)),
        collected_by=current_user.id,
        collected_at=datetime.now(timezone.utc),
        payment_status=PaymentStatus.paid,
        payment_date=datetime.now(timezone.utc),
        kind=data.kind,
        vehicle_id=v_uuid if data.kind == "rental" else None,
        rental_rounds=data.rentalRounds if data.kind == "rental" else None,
    )
    db.add(p)
    from app.services.audit_service import log_action
    await log_action(
        db, user_id=current_user.id, branch_id=current_user.branch_id,
        user_role=current_user.role.value, action="payment.create",
        resource="payment", resource_id=p.id, new_values={"bienLaiId": bl_id, "amount": amount, "kind": data.kind},
    )
    await db.commit()
    await db.refresh(p)
    return _to_wire(p, await _slug_map(db))


@router.post("/{payment_id}/bien-lai", status_code=201)
async def upload_bien_lai(
    payment_id: str,
    file: UploadFile = File(...),
    current_user: CurrentUser = None,
    db: DB = None,
    _perm: Annotated[None, Depends(require_permission("payments", "update"))] = None,
):
    try: p_uuid = uuid.UUID(payment_id)
    except ValueError: raise HTTPException(400, "invalid_id")
    p = await db.get(Payment, p_uuid)
    if not p: raise HTTPException(404, "payment_not_found")
    if current_user.role != RoleName.admin and current_user.branch_id != p.branch_id:
        raise HTTPException(403, "wrong_branch")
    content = await file.read()
    if len(content) > 8 * 1024 * 1024:
        raise HTTPException(400, "file_too_large")
    ext = (file.filename or "").rsplit(".", 1)[-1].lower() or "bin"
    object_key = f"payments/{payment_id}/bienlai-{int(datetime.now(timezone.utc).timestamp()*1000)}.{ext}"
    url = upload_bytes(object_key, content, content_type=file.content_type or "application/octet-stream")
    p.bien_lai_photo_url = url
    from app.services.audit_service import log_action
    await log_action(
        db, user_id=current_user.id, branch_id=current_user.branch_id,
        user_role=current_user.role.value, action="payment.bien_lai_upload",
        resource="payment", resource_id=p.id, new_values={"url": url},
    )
    await db.commit()
    return {"ok": True, "url": url, "size": len(content)}
