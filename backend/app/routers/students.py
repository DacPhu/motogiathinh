"""Students — GET (list) + POST (create with enrollment) + PATCH + docs upload/delete.

Wire shape uses English field names; DB columns are Vietnamese underneath
(translated in _to_wire and the POST/PATCH body parsers).
"""

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import select

from app.core.ocr import extract_cccd_info
from app.core.storage import upload_bytes
from app.dependencies import DB, CurrentUser
from app.models.branch import Branch
from app.models.class_model import Class, ClassEnrollment
from app.models.enums import GenderType, LicenseType, RoleName, StudentStatus
from app.models.fee_plan import FeePlan
from app.models.promotion import Promotion
from app.models.student import Student
from app.utils.dates import (
    gender_to_db, gender_to_wire,
    iso_to_vn_date, iso_to_vn_datetime,
    license_to_db, license_to_wire,
    vn_to_iso_date,
)
from app.utils.id_generator import next_student_id

router = APIRouter(prefix="/students", tags=["students"])

DEFAULT_FEES = {"A": 1995000, "A1": 565000}


def _to_wire(s: Student, slug_map: dict, class_id_by_student: dict | None = None) -> dict:
    licence_raw = getattr(s, "loai_bang_lai", None)
    licence_val = licence_raw.value if hasattr(licence_raw, "value") else licence_raw
    licence = license_to_wire(licence_val)
    parts = [getattr(s, "phuong_xa", None), getattr(s, "quan_huyen", None), getattr(s, "tinh_thanh", None)]
    que_quan = ", ".join(p for p in parts if p)
    gender_val = s.gioi_tinh.value if hasattr(s.gioi_tinh, "value") else s.gioi_tinh
    return {
        "id": str(s.id),
        "maHV": s.ma_hoc_vien or "",
        "name": s.ten_hoc_vien or "",
        "phone": s.so_dien_thoai or "",
        "dob": iso_to_vn_date(s.ngay_sinh) or "",
        "gender": gender_to_wire(gender_val),
        "idNumber": s.cccd_number or "",
        "address": s.dia_chi or "",
        "queQuan": que_quan,
        "ngayCapCCCD": iso_to_vn_date(s.cccd_issued_date) or "",
        "noiCapCCCD": s.cccd_issued_place or "",
        "classId": (
            str(class_id_by_student.get(s.id)) if class_id_by_student and class_id_by_student.get(s.id) else None
        ),
        "licence": licence,
        "feePlanId": str(s.fee_plan_id) if getattr(s, "fee_plan_id", None) else ("fp-A1" if licence == "A1" else "fp-A"),
        "promotionId": str(s.promotion_id) if getattr(s, "promotion_id", None) else None,
        "totalFee": int(float(getattr(s, "total_fee", 0) or 0)) or DEFAULT_FEES.get(licence, 0),
        "profileComplete": bool(getattr(s, "profile_complete", False)),
        "responsibleStaffId": str(s.responsible_staff_id) if getattr(s, "responsible_staff_id", None) else None,
        "branchId": slug_map.get(s.branch_id, str(s.branch_id) if s.branch_id else None),
        "createdAt": iso_to_vn_datetime(s.created_at) or "",
        "docs_cccd": bool(getattr(s, "cmnd_front_url", None)),
        "docs_cccd_back": bool(getattr(s, "docs_cccd_back_url", None)),
        "docs_cccd_qr": bool(getattr(s, "docs_cccd_qr_url", None)),
        "docs_gksk": bool(getattr(s, "docs_gksk_url", None)),
        "docs_donDeNghi": bool(getattr(s, "docs_don_de_nghi_url", None)),
        "docs_the3x4": bool(getattr(s, "anh_the_url", None)),
        "notes": getattr(s, "ghi_chu", None),
    }


async def _slug_map(db) -> dict:
    res = await db.execute(select(Branch))
    return {b.id: (b.slug or str(b.id)) for b in res.scalars().all()}


@router.get("")
async def list_students(current_user: CurrentUser, db: DB):
    # No LIMIT — frontend's payments screen needs every student its payments
    # reference; capping orphans `payment.studentId → undefined` and crashes
    # screen-payments.jsx (s.totalFee on undefined).
    query = select(Student).where(Student.deleted_at.is_(None)).order_by(Student.created_at.desc())
    if current_user.role == RoleName.staff and current_user.branch_id:
        query = query.where(Student.branch_id == current_user.branch_id)
    elif current_user.role == RoleName.guest:
        query = query.where(Student.responsible_staff_id == current_user.id)
    result = await db.execute(query)
    slug_map = await _slug_map(db)
    students = list(result.scalars().all())

    # Batch-join class_enrollments so each student carries its current classId.
    # Without this the frontend `studentsByClassId` index is empty and every
    # class detail page reads "0 học viên".
    class_id_by_student: dict = {}
    if students:
        student_ids = [s.id for s in students]
        enroll_res = await db.execute(
            select(ClassEnrollment.student_id, ClassEnrollment.class_id, ClassEnrollment.created_at)
            .where(
                ClassEnrollment.student_id.in_(student_ids),
                ClassEnrollment.deleted_at.is_(None),
            )
            .order_by(ClassEnrollment.created_at.desc())
        )
        # First row wins (latest active enrollment per student).
        for sid, cid, _ in enroll_res.all():
            class_id_by_student.setdefault(sid, cid)

    return [_to_wire(s, slug_map, class_id_by_student) for s in students]


# ── Create + enroll ─────────────────────────────────────────────────────────
class StudentCreateForm(BaseModel):
    name: str
    phone: Optional[str] = None
    dob: Optional[str] = None
    gender: Optional[str] = None
    idNumber: Optional[str] = None
    address: Optional[str] = None
    queQuan: Optional[str] = None
    ngayCapCCCD: Optional[str] = None
    noiCapCCCD: Optional[str] = None
    classId: str
    licence: str = "A1"
    feePlanId: Optional[str] = None
    promotionId: Optional[str] = None
    profileComplete: bool = False
    responsibleStaffId: Optional[str] = None
    notes: Optional[str] = None


class StudentDocsFlags(BaseModel):
    cccd: bool = False
    gksk: bool = False
    donDeNghi: bool = False
    the3x4: bool = False


class StudentCreateRequest(BaseModel):
    form: StudentCreateForm
    docs: StudentDocsFlags = StudentDocsFlags()


@router.post("", status_code=201)
async def create_student(
    data: StudentCreateRequest,
    current_user: CurrentUser,
    db: DB,
):
    f = data.form
    # Guest kiosk path: ignore form classId/responsibleStaffId, fill from user.
    if current_user.role == RoleName.guest:
        if not current_user.assigned_class_id:
            raise HTTPException(400, "guest_no_class")
        cls_uuid = current_user.assigned_class_id
    else:
        try:
            cls_uuid = uuid.UUID(f.classId)
        except ValueError:
            raise HTTPException(400, "invalid_classId")
    cls = await db.get(Class, cls_uuid)
    if not cls:
        raise HTTPException(400, "invalid_classId")
    if current_user.role == RoleName.staff and current_user.branch_id != cls.branch_id:
        raise HTTPException(403, "wrong_branch")
    # Resolve fee plan + promotion to compute totalFee
    fp = None
    if f.feePlanId:
        try: fp = await db.get(FeePlan, uuid.UUID(f.feePlanId))
        except ValueError: pass
    pr = None
    if f.promotionId and f.promotionId != "promo-none":
        try: pr = await db.get(Promotion, uuid.UUID(f.promotionId))
        except ValueError: pass
    fp_amount = Decimal(fp.amount) if fp else Decimal(DEFAULT_FEES.get(f.licence, 0))
    pr_disc = Decimal(pr.gia_tri) if (pr and getattr(pr, "loai_khuyen_mai", "fixed") == "fixed") else Decimal(0)
    total_fee = max(Decimal(0), fp_amount - pr_disc)
    # Resolve responsible staff
    resp_uuid = None
    if current_user.role == RoleName.guest:
        resp_uuid = current_user.id
    elif f.responsibleStaffId:
        try: resp_uuid = uuid.UUID(f.responsibleStaffId)
        except ValueError: resp_uuid = None

    ma_hv = await next_student_id()
    s = Student(
        branch_id=cls.branch_id,
        ma_hoc_vien=ma_hv,
        ten_hoc_vien=f.name,
        ngay_sinh=vn_to_iso_date(f.dob) or date.today(),
        gioi_tinh=GenderType(gender_to_db(f.gender) or "other"),
        cccd_number=f.idNumber or None,
        cccd_issued_date=vn_to_iso_date(f.ngayCapCCCD),
        cccd_issued_place=f.noiCapCCCD or None,
        so_dien_thoai=f.phone or "",
        dia_chi=f.address or None,
        tinh_thanh=f.queQuan or None,
        loai_bang_lai=LicenseType(license_to_db(f.licence)),
        trang_thai=StudentStatus.active,
        ghi_chu=f.notes or None,
        ngay_dang_ky=date.today(),
        total_fee=total_fee,
        fee_plan_id=fp.id if fp else None,
        promotion_id=pr.id if pr else None,
        responsible_staff_id=resp_uuid,
        profile_complete=f.profileComplete,
    )
    db.add(s)
    await db.flush()  # need s.id for the enrollment row

    enroll = ClassEnrollment(
        class_id=cls.id, student_id=s.id,
        enrollment_date=date.today(), is_active=True,
    )
    db.add(enroll)
    cls.so_luong_hien_tai = (cls.so_luong_hien_tai or 0) + 1

    from app.services.audit_service import log_action
    await log_action(
        db, user_id=current_user.id, branch_id=current_user.branch_id,
        user_role=current_user.role.value, action="student.create",
        resource="student", resource_id=s.id, new_values={"maHV": ma_hv},
    )
    await db.commit()
    await db.refresh(s)
    slug_map = await _slug_map(db)
    out = _to_wire(s, slug_map)
    out["classId"] = str(cls.id)
    return out


# ── Update ──────────────────────────────────────────────────────────────────
class StudentUpdateRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    dob: Optional[str] = None
    gender: Optional[str] = None
    idNumber: Optional[str] = None
    address: Optional[str] = None
    queQuan: Optional[str] = None
    ngayCapCCCD: Optional[str] = None
    noiCapCCCD: Optional[str] = None
    licence: Optional[str] = None
    feePlanId: Optional[str] = None
    promotionId: Optional[str] = None
    profileComplete: Optional[bool] = None
    responsibleStaffId: Optional[str] = None
    notes: Optional[str] = None


@router.patch("/{student_id}")
async def update_student(
    student_id: str,
    data: StudentUpdateRequest,
    current_user: CurrentUser,
    db: DB,
):
    try: s_uuid = uuid.UUID(student_id)
    except ValueError: raise HTTPException(400, "invalid_id")
    s = await db.get(Student, s_uuid)
    if not s: raise HTTPException(404, "student_not_found")
    if current_user.role == RoleName.guest and s.responsible_staff_id != current_user.id:
        raise HTTPException(403, "not_own_student")
    if current_user.role == RoleName.staff and current_user.branch_id != s.branch_id:
        raise HTTPException(403, "wrong_branch")

    fields = data.model_dump(exclude_unset=True)
    if "name" in fields:        s.ten_hoc_vien = fields["name"]
    if "phone" in fields:       s.so_dien_thoai = fields["phone"] or ""
    if "dob" in fields:         s.ngay_sinh = vn_to_iso_date(fields["dob"]) or s.ngay_sinh
    if "gender" in fields:      s.gioi_tinh = GenderType(gender_to_db(fields["gender"]) or "other")
    if "idNumber" in fields:    s.cccd_number = fields["idNumber"] or None
    if "address" in fields:     s.dia_chi = fields["address"] or None
    if "queQuan" in fields:     s.tinh_thanh = fields["queQuan"] or None
    if "ngayCapCCCD" in fields: s.cccd_issued_date = vn_to_iso_date(fields["ngayCapCCCD"])
    if "noiCapCCCD" in fields:  s.cccd_issued_place = fields["noiCapCCCD"] or None
    if "licence" in fields:     s.loai_bang_lai = LicenseType(license_to_db(fields["licence"]))
    if "notes" in fields:       s.ghi_chu = fields["notes"] or None
    if "profileComplete" in fields: s.profile_complete = fields["profileComplete"]
    if "responsibleStaffId" in fields:
        try: s.responsible_staff_id = uuid.UUID(fields["responsibleStaffId"]) if fields["responsibleStaffId"] else None
        except ValueError: s.responsible_staff_id = None
    # Admin-only: feePlanId, promotionId
    if current_user.role == RoleName.admin:
        if "feePlanId" in fields:
            try: s.fee_plan_id = uuid.UUID(fields["feePlanId"]) if fields["feePlanId"] else None
            except ValueError: s.fee_plan_id = None
        if "promotionId" in fields:
            try: s.promotion_id = uuid.UUID(fields["promotionId"]) if fields["promotionId"] and fields["promotionId"] != "promo-none" else None
            except ValueError: s.promotion_id = None
        # Re-derive total_fee
        fp = await db.get(FeePlan, s.fee_plan_id) if s.fee_plan_id else None
        pr = await db.get(Promotion, s.promotion_id) if s.promotion_id else None
        fp_amount = Decimal(fp.amount) if fp else Decimal(DEFAULT_FEES.get(license_to_wire(s.loai_bang_lai.value), 0))
        pr_disc = Decimal(pr.gia_tri) if (pr and getattr(pr, "loai_khuyen_mai", "fixed") == "fixed") else Decimal(0)
        s.total_fee = max(Decimal(0), fp_amount - pr_disc)

    from app.services.audit_service import log_action
    await log_action(
        db, user_id=current_user.id, branch_id=current_user.branch_id,
        user_role=current_user.role.value, action="student.update",
        resource="student", resource_id=s.id, new_values=fields,
    )
    await db.commit()
    await db.refresh(s)
    slug_map = await _slug_map(db)
    return _to_wire(s, slug_map)


# ── Docs upload / delete ────────────────────────────────────────────────────
DOC_KEYS = {"cccd", "cccd_back", "cccd_qr", "gksk", "donDeNghi", "the3x4"}


def _set_doc_url(s: Student, key: str, url: Optional[str]) -> None:
    if key == "cccd":         s.cmnd_front_url = url
    elif key == "cccd_back":  s.docs_cccd_back_url = url
    elif key == "cccd_qr":    s.docs_cccd_qr_url = url
    elif key == "gksk":       s.docs_gksk_url = url
    elif key == "donDeNghi":  s.docs_don_de_nghi_url = url
    elif key == "the3x4":     s.anh_the_url = url


def _check_student_access(current_user, s: Student) -> None:
    if current_user.role == RoleName.guest and s.responsible_staff_id != current_user.id:
        raise HTTPException(403, "not_own_student")
    if current_user.role == RoleName.staff and current_user.branch_id != s.branch_id:
        raise HTTPException(403, "wrong_branch")


@router.post("/{student_id}/docs/{key}", status_code=201)
async def upload_doc(
    student_id: str,
    key: str,
    file: UploadFile = File(...),
    current_user: CurrentUser = None,
    db: DB = None,
):
    if key not in DOC_KEYS:
        raise HTTPException(400, "invalid_key")
    try: s_uuid = uuid.UUID(student_id)
    except ValueError: raise HTTPException(400, "invalid_id")
    s = await db.get(Student, s_uuid)
    if not s: raise HTTPException(404, "student_not_found")
    _check_student_access(current_user, s)
    content = await file.read()
    if len(content) > 8 * 1024 * 1024:
        raise HTTPException(400, "file_too_large")
    ext = (file.filename or "").rsplit(".", 1)[-1].lower() or "bin"
    object_key = f"students/{student_id}/{key}-{int(datetime.now(timezone.utc).timestamp()*1000)}.{ext}"
    url = upload_bytes(object_key, content, content_type=file.content_type or "application/octet-stream")
    _set_doc_url(s, key, url)
    await db.commit()
    return {"ok": True, "key": key, "url": url, "size": len(content)}


@router.delete("/{student_id}/docs/{key}")
async def delete_doc(
    student_id: str,
    key: str,
    current_user: CurrentUser,
    db: DB,
):
    if key not in DOC_KEYS:
        raise HTTPException(400, "invalid_key")
    try: s_uuid = uuid.UUID(student_id)
    except ValueError: raise HTTPException(400, "invalid_id")
    s = await db.get(Student, s_uuid)
    if not s: raise HTTPException(404, "student_not_found")
    _check_student_access(current_user, s)
    _set_doc_url(s, key, None)
    await db.commit()
    return {"ok": True, "key": key}


@router.get("/{student_id}/payments")
async def get_student_payments(student_id: str, current_user: CurrentUser, db: DB):
    """Frontend-compat alias: GET /api/students/{id}/payments returns the
    student's full payment ledger (tuition + rental)."""
    try: s_uuid = uuid.UUID(student_id)
    except ValueError: raise HTTPException(400, "invalid_id")
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
