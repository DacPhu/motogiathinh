import hashlib
import hmac
import json
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.lead import Lead
from app.models.user import User


class LeadService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def verify_facebook_signature(self, payload: bytes, signature: str) -> bool:
        """Verify X-Hub-Signature-256 header from Facebook."""
        expected = "sha256=" + hmac.new(
            settings.FB_APP_SECRET.encode(),
            payload,
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, signature)

    async def process_facebook_webhook(self, payload: dict) -> list[Lead]:
        """Parse FB lead gen webhook and create Lead records."""
        import json as json_mod

        # Parse FB Page → Branch mapping
        try:
            page_branch_map: dict[str, str] = json_mod.loads(settings.FB_PAGE_BRANCH_MAP)
        except Exception:
            page_branch_map = {}

        created_leads = []
        for entry in payload.get("entry", []):
            page_id = entry.get("id")
            branch_id_str = page_branch_map.get(page_id)
            branch_id = uuid.UUID(branch_id_str) if branch_id_str else None

            for change in entry.get("changes", []):
                if change.get("field") != "leadgen":
                    continue
                value = change.get("value", {})
                lead_id = value.get("leadgen_id")

                # Avoid duplicates
                existing = await self.db.execute(
                    select(Lead).where(Lead.facebook_lead_id == str(lead_id))
                )
                if existing.scalar_one_or_none():
                    continue

                lead = Lead(
                    branch_id=branch_id,
                    lead_source="facebook",
                    facebook_lead_id=str(lead_id),
                    facebook_page_id=page_id,
                    ad_name=value.get("ad_name"),
                    form_name=value.get("form_id"),
                    raw_data=value,
                )
                self.db.add(lead)
                created_leads.append(lead)

        await self.db.commit()
        return created_leads

    async def assign_lead(self, lead_id: uuid.UUID, user_id: uuid.UUID) -> Lead:
        from fastapi import HTTPException

        result = await self.db.execute(select(Lead).where(Lead.id == lead_id))
        lead = result.scalar_one_or_none()
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")

        lead.assigned_to = user_id
        lead.trang_thai = "contacted"
        await self.db.commit()
        await self.db.refresh(lead)
        return lead

    async def convert_lead(
        self, lead_id: uuid.UUID, student_id: uuid.UUID
    ) -> Lead:
        from fastapi import HTTPException

        result = await self.db.execute(select(Lead).where(Lead.id == lead_id))
        lead = result.scalar_one_or_none()
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")

        lead.converted_to = student_id
        lead.trang_thai = "enrolled"
        await self.db.commit()
        await self.db.refresh(lead)
        return lead

    async def get_unclaimed_count(self, branch_id: uuid.UUID | None) -> int:
        from sqlalchemy import func

        query = select(func.count(Lead.id)).where(
            Lead.assigned_to.is_(None),
            Lead.trang_thai == "new",
        )
        if branch_id:
            query = query.where(Lead.branch_id == branch_id)
        result = await self.db.execute(query)
        return result.scalar_one()
