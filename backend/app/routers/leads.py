import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, Response

from app.config import settings
from app.core.permissions import branch_scope
from app.dependencies import DB, CurrentUser
from app.schemas.lead import LeadAssign, LeadConvert, LeadOut
from app.services.lead_service import LeadService

router = APIRouter(prefix="/leads", tags=["leads"])


@router.get("/facebook/webhook")
async def verify_facebook_webhook(
    hub_mode: str = Query(alias="hub.mode"),
    hub_challenge: str = Query(alias="hub.challenge"),
    hub_verify_token: str = Query(alias="hub.verify_token"),
):
    """Facebook webhook verification (GET)."""
    if hub_mode == "subscribe" and hub_verify_token == settings.FB_WEBHOOK_VERIFY_TOKEN:
        return Response(content=hub_challenge, media_type="text/plain")
    raise HTTPException(status_code=403, detail="Verification failed")


@router.post("/facebook/webhook", status_code=200)
async def receive_facebook_webhook(request: Request, db: DB, background_tasks: BackgroundTasks):
    """Receive Facebook lead gen events (POST)."""
    payload = await request.json()
    raw_body = await request.body()
    signature = request.headers.get("X-Hub-Signature-256", "")

    service = LeadService(db)
    if not service.verify_facebook_signature(raw_body, signature):
        raise HTTPException(status_code=403, detail="Invalid signature")

    background_tasks.add_task(service.process_facebook_webhook, payload)
    return {"status": "received"}


@router.get("", response_model=list[LeadOut])
async def list_leads(
    current_user: CurrentUser,
    db: DB,
    unclaimed_only: bool = Query(False),
    branch_id: uuid.UUID | None = Query(None),
):
    from sqlalchemy import select
    from app.models.lead import Lead

    effective_branch = branch_scope(current_user, branch_id)
    query = select(Lead).where(Lead.deleted_at.is_(None))
    if effective_branch:
        query = query.where(Lead.branch_id == effective_branch)
    if unclaimed_only:
        query = query.where(Lead.assigned_to.is_(None))

    result = await db.execute(query.order_by(Lead.created_at.desc()).limit(200))
    leads = result.scalars().all()
    return [LeadOut.model_validate(l) for l in leads]


@router.get("/unclaimed-count")
async def unclaimed_count(current_user: CurrentUser, db: DB):
    effective_branch = branch_scope(current_user)
    count = await LeadService(db).get_unclaimed_count(effective_branch)
    return {"count": count}


@router.post("/{lead_id}/assign")
async def assign_lead(lead_id: uuid.UUID, data: LeadAssign, current_user: CurrentUser, db: DB):
    lead = await LeadService(db).assign_lead(lead_id, data.assigned_to)
    return LeadOut.model_validate(lead)


@router.post("/{lead_id}/convert")
async def convert_lead(lead_id: uuid.UUID, data: LeadConvert, current_user: CurrentUser, db: DB):
    """Convert lead to student — returns pre-filled student data."""
    from sqlalchemy import select
    from app.models.lead import Lead

    result = await db.execute(select(Lead).where(Lead.id == lead_id))
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    # Return pre-fill data for the student creation form
    return {
        "ho_ten": lead.ho_ten,
        "so_dien_thoai": lead.so_dien_thoai,
        "dia_chi_email": lead.email,
        "lead_source": lead.lead_source.value,
        "facebook_lead_id": lead.facebook_lead_id,
        "loai_bang_lai": data.loai_bang_lai,
        "branch_id": str(data.branch_id),
        "lead_id": str(lead_id),
    }
