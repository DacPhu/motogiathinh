"""Static constants the frontend reads at boot.

GET /api/constants/profile-docs — the 6 doc keys the student detail screen
                                  uses to render the doc-completeness grid.
GET /api/now — server clock (no auth required).
"""

from datetime import datetime, timezone

from fastapi import APIRouter

router = APIRouter(tags=["constants"])

PROFILE_DOCS = [
    {"key": "cccd",      "label": "CCCD mặt trước",     "hint": "Hình mặt trước · OCR sẽ tự điền thông tin"},
    {"key": "cccd_back", "label": "CCCD mặt sau",       "hint": "Hình mặt sau"},
    {"key": "cccd_qr",   "label": "Mã QR CCCD",         "hint": "Quét mã QR mặt sau"},
    {"key": "gksk",      "label": "Giấy khám sức khỏe", "hint": "Bản scan / chụp"},
    {"key": "donDeNghi", "label": "Đơn đề nghị học",    "hint": "Đơn đề nghị học sát hạch"},
    {"key": "the3x4",    "label": "Thẻ 3×4",            "hint": "Ảnh chân dung"},
]


@router.get("/constants/profile-docs")
async def get_profile_docs():
    return PROFILE_DOCS


@router.get("/now")
async def get_now():
    now = datetime.now(timezone.utc)
    return {"now": now.isoformat(), "ms": int(now.timestamp() * 1000)}
