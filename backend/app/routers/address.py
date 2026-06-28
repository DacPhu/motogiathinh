"""POST /api/address/convert — old→new Vietnamese address conversion.

Vietnam's 2025 administrative reform renamed/merged provinces, abolished the
district level and restructured communes, so a CCCD QR carries an OLD address
that must be mapped to its NEW form before being used. This proxies diachi.io's
`convert-batch` (free-text in, free-text out).

Why a backend proxy (not a direct browser call):
  - diachi.io gates by request Origin (returns CORS_BLOCKED for foreign origins) —
    a server-to-server call presents diachi.io's own Origin/Referer to pass.
  - It keeps the optional API key server-side.

What this router adds on top of the raw proxy (the reasons the conversion felt
unreliable / "dính khu phố"):
  1. **Sub-ward stripping** — diachi.io keeps "Khu phố 1 / Tổ 5 / Ấp 3" verbatim in
     its output. We split off the street detail, send ONLY the administrative tail
     (phường/xã + quận/huyện + tỉnh) and recombine, so the result is clean.
  2. **Per-ward Redis cache** (30-day TTL; the mapping is static). The free tier is
     throttled to ~1 batch / 3 min, so without caching a kiosk scanning several
     CCCDs gets the OLD address back on every scan after the first. Caching the
     admin-tail mapping means ~1 upstream call per unique ward, not per scan.
  3. **`rateLimited` surfaced** so the caller can tell "throttled, retry later"
     apart from "genuinely no match".

Accuracy note: without `DIACHI_API_KEY` diachi.io does name-matching only
(`notSure:true`, no geocoding). Set the key for geo-verified matches + no throttle.
"""

import httpx
from fastapi import APIRouter
from pydantic import BaseModel

from app.config import settings
from app.core.cache import cache
from app.dependencies import CurrentUser
from app.utils.vn_address import addr_cache_key, recombine, split_address, strip_subward

router = APIRouter(prefix="/address", tags=["address"])

_MAX = 50  # our use is 1–2 addresses; cap (upstream allows up to 1000)
_CACHE_TTL = 60 * 60 * 24 * 30  # 30 days — the 2025 admin mapping is static


class ConvertRequest(BaseModel):
    addresses: list[str]


def _result(original: str, converted: str, ok: bool, not_sure: bool) -> dict:
    return {
        "original": original,
        "converted": converted or original,
        "notSure": bool(not_sure) or not ok,
        "ok": bool(ok),
    }


def _envelope(results: list[dict], error: str | None = None, rate_limited: bool = False) -> dict:
    return {
        "configured": bool(settings.DIACHI_API_KEY),
        "error": error,
        "rateLimited": rate_limited,
        "results": results,
    }


async def _call_diachi(addresses: list[str]) -> tuple[dict | None, str | None, bool]:
    """POST a batch to diachi.io. Returns (data, error, rate_limited)."""
    payload: dict = {"addresses": addresses}
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
        return None, "upstream_unreachable", False
    if not isinstance(data, dict) or not data.get("success"):
        err = data.get("error") if isinstance(data, dict) else None
        return None, err, bool(isinstance(data, dict) and data.get("rateLimited"))
    return data, None, False


@router.post("/convert")
async def convert_address(body: ConvertRequest, current_user: CurrentUser):
    items = [a.strip() for a in (body.addresses or []) if a and a.strip()][:_MAX]
    if not items:
        return _envelope([])

    key_set = bool(settings.DIACHI_API_KEY)
    resolved: dict[str, dict] = {}     # original → result (cache hits land here first)
    queries: list[str] = []            # strings to send upstream (cache misses)
    plans: list[dict] = []             # parallel meta for each query

    for a in items:
        detail, admin = split_address(a)
        if admin:
            ckey = addr_cache_key(admin)
            cached = await cache.get(ckey)
            if isinstance(cached, str) and cached:
                resolved[a] = _result(a, recombine(detail, cached), True, not key_set)
                continue
            queries.append(admin)
            plans.append({"original": a, "detail": detail, "mode": "admin", "key": ckey})
        else:
            queries.append(a)  # unparseable admin → convert whole string, strip sub-wards
            plans.append({"original": a, "detail": None, "mode": "full", "key": None})

    error = None
    if queries:
        data, error, rate_limited = await _call_diachi(queries)
        if data is None:
            # Whole batch failed (rate-limit/network) → pass the unresolved through.
            for p in plans:
                resolved.setdefault(p["original"], _result(p["original"], p["original"], False, True))
            return _envelope([resolved[a] for a in items], error, rate_limited)

        resp = (data.get("data") or {}).get("results", [])
        for p, item in zip(plans, resp):
            conv = (item.get("converted") or "").strip()
            ok = bool(item.get("success") and conv)
            not_sure = bool(item.get("notSure")) or not ok
            if not ok:
                resolved[p["original"]] = _result(p["original"], p["original"], False, True)
            elif p["mode"] == "admin":
                await cache.set(p["key"], conv, ttl=_CACHE_TTL)
                resolved[p["original"]] = _result(p["original"], recombine(p["detail"], conv), True, not_sure)
            else:
                resolved[p["original"]] = _result(p["original"], strip_subward(conv), True, not_sure)
        # Any plan items beyond the response length → pass through.
        for p in plans:
            resolved.setdefault(p["original"], _result(p["original"], p["original"], False, True))

    return _envelope([resolved[a] for a in items], error, False)
