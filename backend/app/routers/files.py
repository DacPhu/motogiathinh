"""GET /api/files/<kind>/<recId>/<filename> — proxy MinIO objects.

Branch-scoped: staff can only fetch files attached to records in their branch.
Path-traversal guarded. Only `kind` ∈ {students, payments} is servable.
"""

import uuid

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from sqlalchemy import select

from app.core.storage import get_object_bytes
from app.dependencies import DB, CurrentUser, accessible_class_ids
from app.models.class_model import ClassEnrollment
from app.models.enums import RoleName
from app.models.payment import Payment
from app.models.student import Student

router = APIRouter(prefix="/files", tags=["files"])

ALLOWED_KINDS = {"students", "payments"}


@router.get("/{kind}/{rec_id}/{filename}")
async def get_file(kind: str, rec_id: str, filename: str, current_user: CurrentUser, db: DB):
    if kind not in ALLOWED_KINDS:
        raise HTTPException(404, "not_found")
    if ".." in filename or filename.startswith("/") or "\\" in filename:
        raise HTTPException(400, "invalid_filename")
    try: rec_uuid = uuid.UUID(rec_id)
    except ValueError: raise HTTPException(400, "invalid_rec_id")
    # Access scope
    if current_user.role != RoleName.admin:
        if kind == "students":
            owner = await db.get(Student, rec_uuid)
        else:
            owner = await db.get(Payment, rec_uuid)
        if not owner:
            raise HTTPException(403, "wrong_branch")
        if current_user.role == RoleName.collaborator and kind == "students":
            # CTV: allow only files of students in an assigned active class.
            acc = await accessible_class_ids(db, current_user)
            ok = False
            if acc:
                res = await db.execute(
                    select(ClassEnrollment.id).where(
                        ClassEnrollment.student_id == rec_uuid,
                        ClassEnrollment.class_id.in_(acc),
                        ClassEnrollment.deleted_at.is_(None),
                    ).limit(1)
                )
                ok = res.first() is not None
            if not ok:
                raise HTTPException(403, "wrong_branch")
        elif owner.branch_id != current_user.branch_id:
            raise HTTPException(403, "wrong_branch")
    key = f"{kind}/{rec_id}/{filename}"
    try:
        content, ctype = get_object_bytes(key)
    except Exception:
        raise HTTPException(404, "file_not_found")
    return Response(content=content, media_type=ctype, headers={"Cache-Control": "private, max-age=3600"})
