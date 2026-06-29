"""ISO ↔ dd/mm/yyyy converters used by every wire schema at the API edge.

DB stores native PostgreSQL DATE / TIMESTAMPTZ. The sibling frontend's
data-loader expects dd/mm/yyyy and dd/mm/yyyy HH:MM:SS strings everywhere.
"""

from datetime import date, datetime
from typing import Optional


def iso_to_vn_date(d: Optional[date]) -> Optional[str]:
    if d is None:
        return None
    if isinstance(d, datetime):
        d = d.date()
    return f"{d.day:02d}/{d.month:02d}/{d.year:04d}"


def iso_to_vn_datetime(dt: Optional[datetime]) -> Optional[str]:
    if dt is None:
        return None
    return (
        f"{dt.day:02d}/{dt.month:02d}/{dt.year:04d} "
        f"{dt.hour:02d}:{dt.minute:02d}:{dt.second:02d}"
    )


def vn_to_iso_date(s: Optional[str]) -> Optional[date]:
    if not s:
        return None
    parts = s.strip().split("/")
    if len(parts) != 3:
        return None
    try:
        d, m, y = (int(p) for p in parts)
        return date(y, m, d)
    except (ValueError, TypeError):
        return None


def license_to_wire(b: Optional[str]) -> str:
    """Backend enum → frontend wire: only 'A' and 'A1' exist."""
    return "A1" if b == "A1" else "A"


def license_to_db(w: Optional[str]) -> str:
    """Frontend 'A'/'A1' → backend enum A/A1."""
    return "A1" if w == "A1" else "A"


def gender_to_wire(g: Optional[str]) -> Optional[str]:
    return {"male": "Nam", "female": "Nữ"}.get(g)


def gender_to_db(s: Optional[str]) -> Optional[str]:
    if not s:
        return None
    t = s.strip().lower()
    if t in ("nữ", "nu", "female", "f"):
        return "female"
    if t in ("nam", "male", "m"):
        return "male"
    return "other"


def method_to_wire(b: Optional[str]) -> str:
    return {
        "bank_transfer": "Chuyển khoản",
        "momo": "MoMo",
        "zalopay": "ZaloPay",
    }.get(b or "", "Tiền mặt")


def method_to_db(w: Optional[str]) -> str:
    s = (w or "").lower()
    if "chuyển" in s or "bank" in s:
        return "bank_transfer"
    if "momo" in s:
        return "momo"
    if "zalo" in s:
        return "zalopay"
    return "cash"
