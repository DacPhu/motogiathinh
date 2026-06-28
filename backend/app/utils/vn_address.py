"""Vietnamese address helpers for the diachi.io old→new conversion.

A CCCD "Nơi thường trú" looks like:
    "123 Lê Lợi, Khu phố 1, Phường Bến Thành, Quận 1, Thành phố Hồ Chí Minh"

We split it into three buckets (comma-separated segments, classified by their
leading keyword on a diacritics-folded copy):
  - detail   — the street part to KEEP            → "123 Lê Lợi"
  - sub-ward — khu phố / tổ N / ấp N / thôn / xóm  → DROPPED. These are obsolete
               after the 2025 reform AND diachi.io carries them through verbatim
               ("...Khu phố 1, Phường..."), which is the "dính khu phố" noise.
  - admin    — phường/xã + quận/huyện + tỉnh/thành → the part diachi.io maps.

Only the admin tail is sent to diachi.io (cleaner match, and cacheable per ward),
then the result is recombined as ``detail + ", " + converted_admin``.
"""

import re
import unicodedata

# Leading-keyword patterns, matched on a folded (lowercase, no-diacritic) segment.
# Sub-ward: "tổ"/"ấp" only when followed by a number, so street names like
# "Tô Hiến Thành" / "Ấp Bắc" are NOT dropped; the rest are distinctive enough.
_SUBWARD = re.compile(r"^(khu pho|khu vuc|thon|xom|khom|kp)\b|^(to|ap)\.?\s*\d")
_ADMIN_FULL = re.compile(r"^(phuong|xa|thi tran|quan|huyen|thi xa|thanh pho|tinh)\b")
_ADMIN_ABBR = re.compile(r"^(tp|tx|tt)\.?\s*\S|^(p|q|x)\.\s*\S")


def fold(s: str) -> str:
    """Lowercase, drop Vietnamese diacritics (đ→d), collapse whitespace."""
    s = (s or "").replace("đ", "d").replace("Đ", "D")
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", s).strip().lower()


def _segments(raw: str) -> list[str]:
    return [p.strip() for p in (raw or "").split(",") if p and p.strip()]


def _is_subward(folded: str) -> bool:
    return bool(_SUBWARD.match(folded))


def _is_admin(folded: str) -> bool:
    return bool(_ADMIN_FULL.match(folded) or _ADMIN_ABBR.match(folded))


def split_address(raw: str) -> tuple[str, str | None]:
    """Return ``(detail_kept, admin_tail)``.

    ``admin_tail`` is None when no administrative level is recognised — the caller
    should then fall back to converting the whole string and stripping sub-wards.
    """
    segs = _segments(raw)
    first_admin = next((i for i, s in enumerate(segs) if _is_admin(fold(s))), None)
    if first_admin is None:
        return "", None
    # Everything from the first admin keyword to the end is the admin tail (this
    # captures a trailing bare province like "Bình Dương" with no "Tỉnh" prefix).
    detail = ", ".join(s for s in segs[:first_admin] if not _is_subward(fold(s)))
    admin = ", ".join(s for s in segs[first_admin:] if not _is_subward(fold(s)))
    return detail, admin


def strip_subward(text: str) -> str:
    """Remove sub-ward segments from an already-converted free-text address."""
    return ", ".join(seg for seg in _segments(text) if not _is_subward(fold(seg)))


def recombine(detail: str, converted_admin: str) -> str:
    """Join the kept street detail with the converted admin tail, cleanly."""
    parts = [p for p in (detail, converted_admin) if p and p.strip()]
    out = ", ".join(parts)
    out = re.sub(r"\s*,(\s*,)+", ", ", out)  # collapse any empty segments
    return re.sub(r"\s+", " ", out).strip().strip(",").strip()


def addr_cache_key(admin_tail: str) -> str:
    """Stable, ward-level Redis key — folded so spelling/diacritic variants share it."""
    return "addr:v1:" + fold(admin_tail)
