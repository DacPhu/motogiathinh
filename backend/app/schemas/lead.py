import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.enums import LeadSource, LeadStatus
from app.schemas.common import BaseSchema, UUIDSchema


class LeadOut(UUIDSchema):
    id: uuid.UUID
    branch_id: uuid.UUID | None
    ho_ten: str | None
    so_dien_thoai: str | None
    email: str | None
    lead_source: LeadSource
    facebook_lead_id: str | None
    ad_name: str | None
    form_name: str | None
    trang_thai: LeadStatus
    assigned_to: uuid.UUID | None
    converted_to: uuid.UUID | None
    ghi_chu: str | None


class LeadAssign(BaseModel):
    assigned_to: uuid.UUID


class LeadConvert(BaseModel):
    """Convert a lead to a student. Pre-fills student form data."""
    branch_id: uuid.UUID
    loai_bang_lai: str


class FacebookWebhookVerify(BaseModel):
    hub_mode: str
    hub_challenge: str
    hub_verify_token: str
