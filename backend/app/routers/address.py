"""POST /api/address/convert — old→new Vietnamese address conversion.

Vietnam's 2025 administrative reform renamed/merged provinces, abolished the
district level and restructured communes, so a CCCD QR carries an OLD address
that must be mapped to its NEW form before being used. This proxies diachi.io's
`convert-batch` (free-text in, free-text out).

Why a backend proxy (not a direct browser call):
  - diachi.io gates by request Origin (server-side, returns code CORS_BLOCKED for
    foreign origins) — a server-to-server call presents Origin/Referer of
    diachi.io to pass the gate.
  - It keeps the optional API key server-side.

Tiers (verified live):
  - No key  → works but throttled to ~1 batch / 3 min; complex merged addresses
              need a key.
  - Key set → lifts the limit + complex addresses. Set `DIACHI_API_KEY`.

Resilience: on ANY failure (rate-limit, invalid key, network, blocked) we return
the originals unchanged with notSure=true so the caller's flow never breaks.
"""

import httpx
from fastapi import APIRouter
from pydantic import BaseModel

from app.config import settings
from app.dependencies import CurrentUser

router = APIRouter(prefix="/address", tags=["address"])

_MAX = 50  # our use is 1–2 addresses; cap (upstream allows up to 1000)


class ConvertRequest(BaseModel):
    addresses: list[str]


def _passthrough(items: list[str], error: str | None = None) -> dict:
    return {
        "configured": bool(settings.DIACHI_API_KEY),
        "error": error,
        "results": [
            {"original": a, "converted": a, "notSure": True, "ok": False} for a in items
        ],
    }


@router.post("/convert")
async def convert_address(body: ConvertRequest, current_user: CurrentUser):
    items = [a.strip() for a in (body.addresses or []) if a and a.strip()][:_MAX]
    if not items:
        return {"configured": bool(settings.DIACHI_API_KEY), "error": None, "results": []}

    payload: dict = {"addresses": items}
    if settings.DIACHI_API_KEY:
        payload["key"] = settings.DIACHI_API_KEY
    headers = {
        "Origin": "https://diachi.io",
        "Referer": "https://diachi.io/",
        "User-Agent": "Mozilla/5.0 (compatible; MotoGiaThinh/1.0)",
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(settings.DIACHI_API_URL, json=payload, headers=headers)
        data = r.json()
    except Exception:
        return _passthrough(items, "upstream_unreachable")

    if not isinstance(data, dict) or not data.get("success"):
        err = data.get("error") if isinstance(data, dict) else None
        return _passthrough(items, err)

    results = []
    for item in (data.get("data") or {}).get("results", []):
        conv = (item.get("converted") or "").strip()
        ok = bool(item.get("success") and conv)
        results.append({
            "original": item.get("original", ""),
            "converted": conv or item.get("original", ""),
            "notSure": bool(item.get("notSure")) or not ok,
            "ok": ok,
        })
    if not results:
        return _passthrough(items, "empty_result")
    return {"configured": bool(settings.DIACHI_API_KEY), "error": None, "results": results}
