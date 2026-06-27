"""Student document slots — upload / delete + the payments-ledger alias.

Split out of ``routers/students.py`` to keep each file under the 400-line cap.
Shares the same ``/students`` prefix (registered separately in main.py) and
reuses ``_student_accessible`` from the students router for access scoping.
"""

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select

from app.core.storage import upload_bytes
from app.dependencies import DB, CurrentUser, require_permission
from app.models.student import Student
from app.routers.students import _get_student, _student_accessible
from app.utils.dates import iso_to_vn_datetime

router = APIRouter(prefix="/students", tags=["students"])

DOC_KEYS = {"cccd", "cccdBack", "cccdQR", "gksk", "donDeNghi", "the3x4", "bangLaiFront", "bangLaiBack"}

# wire doc key → Student column holding that doc's URL
_DOC_COLUMN = {
    "cccd": "cmnd_front_url",
    "cccdBack": "cmnd_back_url",
    "cccdQR": "docs_cccd_qr_url",
    "gksk": "docs_gksk_url",
    "donDeNghi": "docs_don_de_nghi_url",
    "the3x4": "anh_the_url",
    "bangLaiFront": "docs_bang_lai_front_url",
    "bangLaiBack": "docs_bang_lai_back_url",
}


async def _load_accessible_student(db, current_user, student_id: str) -> Student:
    s = await _get_student(db, student_id)
    if not s:
        raise HTTPException(404, "student_not_found")
    if not await _student_accessible(db, current_user, s.id):
        raise HTTPException(403, "class_not_accessible")
    return s


@router.post("/{student_id}/docs/{key}", status_code=201)
async def upload_doc(
    student_id: str,
    key: str,
    file: UploadFile = File(...),
    current_user: CurrentUser = None,
    db: DB = None,
    _perm: Annotated[None, Depends(require_permission("students", "update"))] = None,
):
    if key not in DOC_KEYS:
        raise HTTPException(400, "invalid_key")
    s = await _load_accessible_student(db, current_user, student_id)
    content = await file.read()
    if len(content) > 8 * 1024 * 1024:
        raise HTTPException(400, "file_too_large")
    ext = (file.filename or "").rsplit(".", 1)[-1].lower() or "bin"
    object_key = f"students/{s.id}/{key}-{int(datetime.now(timezone.utc).timestamp()*1000)}.{ext}"
    url = upload_bytes(object_key, content, content_type=file.content_type or "application/octet-stream")
    setattr(s, _DOC_COLUMN[key], url)
    await db.commit()
    return {"ok": True, "key": key, "url": url, "size": len(content)}


@router.delete("/{student_id}/docs/{key}")
async def delete_doc(
    student_id: str,
    key: str,
    current_user: CurrentUser,
    db: DB,
    _perm: Annotated[None, Depends(require_permission("students", "update"))] = None,
):
    if key not in DOC_KEYS:
        raise HTTPException(400, "invalid_key")
    s = await _load_accessible_student(db, current_user, student_id)
    setattr(s, _DOC_COLUMN[key], None)
    await db.commit()
    return {"ok": True, "key": key}


@router.get("/{student_id}/payments")
async def get_student_payments(student_id: str, current_user: CurrentUser, db: DB):
    """Frontend-compat alias: GET /api/students/{id}/payments returns the
    student's full payment ledger (tuition + rental)."""
    s = await _get_student(db, student_id)
    if not s:
        raise HTTPException(404, "not_found")
    if not await _student_accessible(db, current_user, s.id):
        raise HTTPException(404, "not_found")
    from app.models.payment import Payment
    from app.utils.dates import method_to_wire
    result = await db.execute(
        select(Payment).where(Payment.student_id == s.id, Payment.deleted_at.is_(None))
        .order_by(Payment.collected_at.desc())
    )
    return [{
        "id": p.id.hex[:8], "studentId": p.student_id.hex[:8] if p.student_id else None,
        "branchId": str(p.branch_id),
        "amount": int(float(p.so_tien or 0)),
        "method": method_to_wire(p.phuong_thuc.value if hasattr(p.phuong_thuc, "value") else p.phuong_thuc),
        "bienLaiId": getattr(p, "so_bien_lai_id", None) or p.ma_giao_dich or "",
        "kind": getattr(p, "kind", "tuition"),
        "createdAt": iso_to_vn_datetime(p.collected_at or p.payment_date) or "",
    } for p in result.scalars().all()]
