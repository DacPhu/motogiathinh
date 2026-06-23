"""Student document slots — upload / delete + the payments-ledger alias.

Split out of ``routers/students.py`` to keep each file under the 400-line cap.
Shares the same ``/students`` prefix (registered separately in main.py) and
reuses ``_student_accessible`` from the students router for access scoping.
"""

import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select

from app.core.storage import upload_bytes
from app.dependencies import DB, CurrentUser, assigned_class_ids, require_permission
from app.models.class_model import ClassEnrollment
from app.models.enums import RoleName
from app.models.student import Student
from app.routers.students import _student_accessible
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
    try:
        s_uuid = uuid.UUID(student_id)
    except ValueError:
        raise HTTPException(400, "invalid_id")
    s = await db.get(Student, s_uuid)
    if not s:
        raise HTTPException(404, "student_not_found")
    # For CTVs, doc uploads are allowed for students in ANY of their ever-assigned
    # classes (not just currently active ones). This lets them complete legacy
    # profiles where the class has since ended (đã kết thúc).
    if current_user.role == RoleName.collaborator:
        acc = await assigned_class_ids(db, current_user)
        if not acc:
            raise HTTPException(403, "class_not_accessible")
        res = await db.execute(
            select(ClassEnrollment.id).where(
                ClassEnrollment.student_id == s_uuid,
                ClassEnrollment.class_id.in_(acc),
                ClassEnrollment.deleted_at.is_(None),
            ).limit(1)
        )
        if res.first() is None:
            raise HTTPException(403, "class_not_accessible")
        return s
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
    object_key = f"students/{student_id}/{key}-{int(datetime.now(timezone.utc).timestamp()*1000)}.{ext}"
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
    try:
        s_uuid = uuid.UUID(student_id)
    except ValueError:
        raise HTTPException(400, "invalid_id")
    # Don't leak existence of inaccessible students to non-admins.
    if not await _student_accessible(db, current_user, s_uuid):
        raise HTTPException(404, "not_found")
    from app.models.payment import Payment
    from app.utils.dates import method_to_wire
    result = await db.execute(
        select(Payment).where(Payment.student_id == s_uuid, Payment.deleted_at.is_(None))
        .order_by(Payment.collected_at.desc())
    )
    return [{
        "id": str(p.id), "studentId": str(p.student_id), "branchId": str(p.branch_id),
        "amount": int(float(p.so_tien or 0)),
        "method": method_to_wire(p.phuong_thuc.value if hasattr(p.phuong_thuc, "value") else p.phuong_thuc),
        "bienLaiId": getattr(p, "so_bien_lai_id", None) or p.ma_giao_dich or "",
        "kind": getattr(p, "kind", "tuition"),
        "createdAt": iso_to_vn_datetime(p.collected_at or p.payment_date) or "",
    } for p in result.scalars().all()]
