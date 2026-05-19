import uuid

from sqlalchemy import Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import BaseModel
from app.models.enums import LeadSource, LeadStatus


class Lead(BaseModel):
    __tablename__ = "leads"

    branch_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("branches.id"), index=True
    )
    ho_ten: Mapped[str | None] = mapped_column(String(100))
    so_dien_thoai: Mapped[str | None] = mapped_column(String(20), index=True)
    email: Mapped[str | None] = mapped_column(String(255))
    lead_source: Mapped[LeadSource] = mapped_column(
        Enum(LeadSource), nullable=False, default=LeadSource.facebook
    )
    facebook_lead_id: Mapped[str | None] = mapped_column(String(100), unique=True, index=True)
    facebook_page_id: Mapped[str | None] = mapped_column(String(100))
    ad_name: Mapped[str | None] = mapped_column(String(200))
    form_name: Mapped[str | None] = mapped_column(String(200))
    raw_data: Mapped[dict | None] = mapped_column(JSONB)
    trang_thai: Mapped[LeadStatus] = mapped_column(
        Enum(LeadStatus), nullable=False, default=LeadStatus.new, index=True
    )
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), index=True
    )
    converted_to: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("students.id")
    )
    ghi_chu: Mapped[str | None] = mapped_column(Text)

    # Relationships
    assigned_user: Mapped["User | None"] = relationship("User", foreign_keys=[assigned_to])
    converted_student: Mapped["Student | None"] = relationship(
        "Student", foreign_keys=[converted_to]
    )
