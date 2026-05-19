import uuid
from datetime import date, datetime

from pydantic import EmailStr, field_validator

from app.models.enums import GenderType, LeadSource, LicenseType, StudentStatus
from app.schemas.common import BaseSchema, UUIDSchema


class StudentCreate(BaseSchema):
    ten_hoc_vien: str
    ngay_sinh: date
    gioi_tinh: GenderType
    cccd_number: str | None = None
    cccd_issued_date: date | None = None
    cccd_issued_place: str | None = None
    so_dien_thoai: str
    dia_chi_email: EmailStr | None = None
    dia_chi: str | None = None
    phuong_xa: str | None = None
    quan_huyen: str | None = None
    tinh_thanh: str | None = None
    ho_ten_nguoi_than: str | None = None
    sdt_nguoi_than: str | None = None
    quan_he: str | None = None
    loai_bang_lai: LicenseType
    lead_source: LeadSource | None = None
    facebook_lead_id: str | None = None
    zalo_number: str | None = None
    health_cert_expiry: date | None = None
    ghi_chu: str | None = None


class StudentUpdate(BaseSchema):
    ten_hoc_vien: str | None = None
    ngay_sinh: date | None = None
    gioi_tinh: GenderType | None = None
    cccd_number: str | None = None
    cccd_issued_date: date | None = None
    cccd_issued_place: str | None = None
    so_dien_thoai: str | None = None
    dia_chi_email: EmailStr | None = None
    dia_chi: str | None = None
    phuong_xa: str | None = None
    quan_huyen: str | None = None
    tinh_thanh: str | None = None
    ho_ten_nguoi_than: str | None = None
    sdt_nguoi_than: str | None = None
    quan_he: str | None = None
    loai_bang_lai: LicenseType | None = None
    trang_thai: StudentStatus | None = None
    zalo_number: str | None = None
    health_cert_expiry: date | None = None
    ghi_chu: str | None = None


class StudentOut(UUIDSchema):
    branch_id: uuid.UUID
    ma_hoc_vien: str
    ten_hoc_vien: str
    ngay_sinh: date
    gioi_tinh: GenderType
    cccd_number: str | None
    so_dien_thoai: str
    dia_chi_email: str | None
    dia_chi: str | None
    phuong_xa: str | None
    quan_huyen: str | None
    tinh_thanh: str | None
    loai_bang_lai: LicenseType
    trang_thai: StudentStatus
    is_repeat_student: bool
    repeat_count: int
    lead_source: LeadSource | None
    health_cert_expiry: date | None
    qr_code_url: str | None
    zalo_number: str | None
    ghi_chu: str | None
    ngay_dang_ky: date


class StudentListItem(BaseSchema):
    id: uuid.UUID
    ma_hoc_vien: str
    ten_hoc_vien: str
    so_dien_thoai: str
    loai_bang_lai: LicenseType
    trang_thai: StudentStatus
    is_repeat_student: bool
    ngay_dang_ky: date
    branch_id: uuid.UUID
    # Document completeness (computed)
    docs_complete: bool | None = None


class DuplicateConflict(BaseSchema):
    id: uuid.UUID
    ma_hoc_vien: str
    ten_hoc_vien: str
    cccd_number: str | None
    so_dien_thoai: str
    branch_id: uuid.UUID


class StudentCreateResponse(BaseSchema):
    student: StudentOut | None = None
    conflicts: list[DuplicateConflict] | None = None
    conflict_detected: bool = False
