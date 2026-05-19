import uuid

from fastapi import APIRouter, Depends, Query, UploadFile

from app.core.permissions import branch_scope, check_branch_access, require_role
from app.dependencies import DB, CurrentUser
from app.models.enums import LicenseType, RoleName, StudentStatus
from app.schemas.common import PaginatedResponse
from app.schemas.student import (
    StudentCreate,
    StudentCreateResponse,
    StudentListItem,
    StudentOut,
    StudentUpdate,
)
from app.services.student_service import StudentService

router = APIRouter(prefix="/students", tags=["students"])


@router.get("", response_model=PaginatedResponse[StudentListItem])
async def list_students(
    current_user: CurrentUser,
    db: DB,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
    trang_thai: StudentStatus | None = None,
    loai_bang_lai: LicenseType | None = None,
    is_repeat: bool | None = None,
    branch_id: uuid.UUID | None = None,
):
    effective_branch = branch_scope(current_user, branch_id)
    return await StudentService(db, current_user).list_students(
        page=page,
        page_size=page_size,
        search=search,
        trang_thai=trang_thai.value if trang_thai else None,
        loai_bang_lai=loai_bang_lai.value if loai_bang_lai else None,
        is_repeat=is_repeat,
        branch_id=effective_branch,
    )


@router.post("", response_model=StudentCreateResponse, status_code=201)
async def create_student(
    data: StudentCreate,
    current_user: CurrentUser,
    db: DB,
    force: bool = Query(False, description="Skip duplicate check"),
    branch_id: uuid.UUID | None = Query(None),
):
    effective_branch = branch_scope(current_user, branch_id) or current_user.branch_id
    return await StudentService(db, current_user).create(data, effective_branch, force=force)


@router.get("/{student_id}", response_model=StudentOut)
async def get_student(student_id: uuid.UUID, current_user: CurrentUser, db: DB):
    student = await StudentService(db, current_user).get_by_id(student_id)
    check_branch_access(current_user, student.branch_id)
    return StudentOut.model_validate(student)


@router.patch("/{student_id}", response_model=StudentOut)
async def update_student(
    student_id: uuid.UUID, data: StudentUpdate, current_user: CurrentUser, db: DB
):
    student = await StudentService(db, current_user).get_by_id(student_id)
    check_branch_access(current_user, student.branch_id)
    return await StudentService(db, current_user).update(student_id, data)


@router.delete("/{student_id}", status_code=204)
async def delete_student(student_id: uuid.UUID, current_user: CurrentUser, db: DB):
    student = await StudentService(db, current_user).get_by_id(student_id)
    check_branch_access(current_user, student.branch_id)
    await StudentService(db, current_user).delete(student_id)


@router.get("/{student_id}/docs-completeness")
async def check_docs(student_id: uuid.UUID, current_user: CurrentUser, db: DB):
    complete = await StudentService(db, current_user).get_docs_completeness(student_id)
    return {"student_id": student_id, "docs_complete": complete}


@router.get("/{student_id}/qr")
async def get_student_qr(student_id: uuid.UUID, current_user: CurrentUser, db: DB):
    """Generate or return existing QR code URL for a student."""
    import io

    import qrcode
    from fastapi.responses import StreamingResponse

    student = await StudentService(db, current_user).get_by_id(student_id)
    check_branch_access(current_user, student.branch_id)

    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(f"student:{student_id}")
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return StreamingResponse(buf, media_type="image/png")
