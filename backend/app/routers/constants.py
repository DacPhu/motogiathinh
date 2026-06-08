"""Static constants the frontend reads at boot.

GET /api/constants/profile-docs — the 7 doc keys the student detail screen
                                  uses to render the doc-completeness grid.
GET /api/now — server clock (no auth required).
"""

from datetime import datetime, timezone

from fastapi import APIRouter

router = APIRouter(tags=["constants"])

PROFILE_DOCS = [
    {"key": "cccd",      "label": "CCCD mặt trước", "hint": "Hình mặt trước căn cước công dân", "required": True},
    {"key": "cccdBack",  "label": "CCCD mặt sau",   "hint": "Mặt sau căn cước công dân", "required": True},
    {"key": "cccdQR",    "label": "QR CCCD",        "hint": "Chụp rõ mã QR để tự động điền", "required": True},
    {"key": "gksk",      "label": "Giấy khám sức khỏe", "hint": "Bản scan / chụp", "required": True},
    {"key": "donDeNghi", "label": "Đơn đề nghị học",     "hint": "Đơn đề nghị học sát hạch", "required": True},
    {"key": "the3x4",    "label": "Thẻ 3×4",            "hint": "Ảnh chân dung", "required": True},
    {"key": "bangLaiFront", "label": "Bằng lái mặt trước", "hint": "Ảnh mặt trước bằng lái hiện có (nếu có)", "required": False},
    {"key": "bangLaiBack",  "label": "Bằng lái mặt sau",  "hint": "Ảnh mặt sau bằng lái hiện có (nếu có)",  "required": False},
]


@router.get("/constants/profile-docs")
async def get_profile_docs():
    return PROFILE_DOCS


@router.get("/now")
async def get_now():
    now = datetime.now(timezone.utc)
    return {"now": now.isoformat(), "ms": int(now.timestamp() * 1000)}
