"""Classes — GET list / GET :id/students / POST / PATCH.

Wire shape uses English field names + dd/mm/yyyy dates.
"""

import uuid
from datetime import date
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from app.dependencies import DB, CurrentUser, accessible_class_ids, require_permission
from app.models.branch import Branch
from app.models.class_model import Class, ClassEnrollment
from app.models.course import CourseType
from app.models.enums import ClassStatus, RoleName
from app.models.student import Student
from app.utils.dates import gender_to_wire, iso_to_vn_date, iso_to_vn_datetime, license_to_wire, vn_to_iso_date

router = APIRouter(prefix="/classes", tags=["classes"])


def _status_override(trang_thai):
    val = trang_thai.value if hasattr(trang_thai, "value") else trang_thai
    if val == "cancelled":  return "đã hủy"
    if val == "completed":  return "đã kết thúc"
    return None


def _status_from_override(s: Optional[str]) -> ClassStatus:
    if s == "đã hủy":      return ClassStatus.cancelled
    if s == "đã kết thúc": return ClassStatus.completed
    return ClassStatus.in_progress


def _to_wire(c: Class, slug_map: dict) -> dict:
    return {
        "id": str(c.id),
        "code": c.ma_lop or "",
        "name": c.ten_lop or "",
        "branchId": slug_map.get(c.branch_id, str(c.branch_id) if c.branch_id else None),
        "openDate": iso_to_vn_date(c.ngay_khai_giang) or "",
        "examDate": iso_to_vn_date(c.ngay_ket_thuc) or "",
        "capacity": int(c.so_luong_toi_da or 30),
        "enrolled": int(c.so_luong_hien_tai or 0),
        "fee": int(float(c.hoc_phi or 0)),
        "statusOverride": _status_override(c.trang_thai),
    }


async def _slug_map(db) -> dict:
    res = await db.execute(select(Branch))
    return {b.id: (b.slug or str(b.id)) for b in res.scalars().all()}


async def _branch_id_from_slug(db, slug_or_uuid: str) -> Optional[uuid.UUID]:
    if not slug_or_uuid:
        return None
    try: return uuid.UUID(slug_or_uuid)
    except ValueError: pass
    res = await db.execute(select(Branch).where(Branch.slug == slug_or_uuid))
    b = res.scalar_one_or_none()
    return b.id if b else None


@router.get("")
async def list_classes(current_user: CurrentUser, db: DB):
    query = select(Class).where(Class.deleted_at.is_(None)).order_by(Class.ngay_khai_giang.desc())
    if current_user.role == RoleName.guest:
        # Guest kiosk: only the single class it is assigned to.
        if not current_user.assigned_class_id:
            return []
        query = query.where(Class.id == current_user.assigned_class_id)
    elif current_user.role == RoleName.collaborator:
        acc = await accessible_class_ids(db, current_user)
        if not acc:
            return []
        query = query.where(Class.id.in_(acc))
    elif current_user.role != RoleName.admin and current_user.branch_id:
        query = query.where(Class.branch_id == current_user.branch_id)
    result = await db.execute(query)
    slug_map = await _slug_map(db)
    return [_to_wire(c, slug_map) for c in result.scalars().all()]


@router.get("/{class_id}/students")
async def get_class_students(class_id: str, current_user: CurrentUser, db: DB):
    try: c_uuid = uuid.UUID(class_id)
    except ValueError: raise HTTPException(400, "invalid_id")
    # CTV access check — can only view students in their assigned active classes.
    if current_user.role == RoleName.collaborator:
        acc = await accessible_class_ids(db, current_user)
        if not acc or c_uuid not in acc:
            raise HTTPException(403, "access_denied")
    result = await db.execute(
        select(Student).join(ClassEnrollment, ClassEnrollment.student_id == Student.id)
        .where(ClassEnrollment.class_id == c_uuid, ClassEnrollment.deleted_at.is_(None), Student.deleted_at.is_(None))
    )
    slug_map = await _slug_map(db)
    return [{
        "id": str(s.id), "maHV": s.ma_hoc_vien or "", "name": s.ten_hoc_vien or "",
        "phone": s.so_dien_thoai or "", "dob": iso_to_vn_date(s.ngay_sinh) or "",
        "gender": gender_to_wire(s.gioi_tinh.value if hasattr(s.gioi_tinh, "value") else s.gioi_tinh),
        "licence": license_to_wire(s.loai_bang_lai.value if hasattr(s.loai_bang_lai, "value") else s.loai_bang_lai),
        "branchId": slug_map.get(s.branch_id, str(s.branch_id) if s.branch_id else None),
        "createdAt": iso_to_vn_datetime(s.created_at) or "",
        "totalFee": int(float(getattr(s, "total_fee", 0) or 0)),
    } for s in result.scalars().all()]


# ── Create / Update ─────────────────────────────────────────────────────────
class ClassCreateRequest(BaseModel):
    code: str
    branchId: str
    openDate: Optional[str] = None
    examDate: Optional[str] = None


class ClassUpdateRequest(BaseModel):
    code: Optional[str] = None
    branchId: Optional[str] = None
    openDate: Optional[str] = None
    examDate: Optional[str] = None
    statusOverride: Optional[str] = None


@router.post("", status_code=201)
async def create_class(
    data: ClassCreateRequest,
    current_user: CurrentUser,
    db: DB,
    _perm: Annotated[None, Depends(require_permission("classes", "create"))] = None,
):
    branch_uuid = await _branch_id_from_slug(db, data.branchId)
    if not branch_uuid: raise HTTPException(400, "invalid_branchId")
    # Pick the first course type (frontend doesn't model course_type)
    ct_result = await db.execute(select(CourseType).where(CourseType.is_active == True).limit(1))
    ct = ct_result.scalar_one_or_none()
    if not ct: raise HTTPException(400, "no_course_types")
    c = Class(
        branch_id=branch_uuid,
        ma_lop=data.code,
        ten_lop=data.code,
        course_type_id=ct.id,
        ngay_khai_giang=vn_to_iso_date(data.openDate) or date.today(),
        ngay_ket_thuc=vn_to_iso_date(data.examDate),
        so_luong_toi_da=30,
        trang_thai=ClassStatus.upcoming,
        created_by=current_user.id,
    )
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return _to_wire(c, await _slug_map(db))


@router.patch("/{class_id}")
async def update_class(
    class_id: str,
    data: ClassUpdateRequest,
    current_user: CurrentUser,
    db: DB,
    _perm: Annotated[None, Depends(require_permission("classes", "update"))] = None,
):
    try: c_uuid = uuid.UUID(class_id)
    except ValueError: raise HTTPException(400, "invalid_id")
    c = await db.get(Class, c_uuid)
    if not c: raise HTTPException(404, "class_not_found")
    fields = data.model_dump(exclude_unset=True)
    if "code" in fields:       c.ma_lop = fields["code"]; c.ten_lop = fields["code"]
    if "branchId" in fields:
        new_branch = await _branch_id_from_slug(db, fields["branchId"])
        if new_branch: c.branch_id = new_branch
    if "openDate" in fields:   c.ngay_khai_giang = vn_to_iso_date(fields["openDate"]) or c.ngay_khai_giang
    if "examDate" in fields:   c.ngay_ket_thuc = vn_to_iso_date(fields["examDate"])
    if "statusOverride" in fields:
        c.trang_thai = _status_from_override(fields["statusOverride"])
    await db.commit()
    await db.refresh(c)
    return _to_wire(c, await _slug_map(db))
