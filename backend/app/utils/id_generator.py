from datetime import date

from sqlalchemy import text

from app.core.cache import CacheKeys, cache


async def next_student_id(db, year: int | None = None) -> str:
    y = year or date.today().year
    key = CacheKeys.STUDENT_SEQ.format(year=y)
    seq = await cache.incr(key)
    if seq == 1:
        # Fresh counter — first use this year, or Redis was evicted (allkeys-lru)
        # / reset. Reconcile against the real DB max so we never re-issue an
        # existing ma_hoc_vien: a re-issued code collides on INSERT and would
        # otherwise surface to the user as a misleading "duplicate CCCD".
        res = await db.execute(
            text("SELECT MAX(CAST(SUBSTRING(ma_hoc_vien FROM 7) AS INTEGER)) "
                 "FROM students WHERE ma_hoc_vien ~ :pat"),
            {"pat": f"^HV{y}[0-9]+$"},
        )
        db_seq = res.scalar() or 0
        if db_seq >= seq:
            seq = db_seq + 1
            await cache.redis.set(key, seq)
        # Keys live ~2 years to handle carryover.
        await cache.expire(key, 365 * 2 * 24 * 3600)
    return f"HV{y}{seq:04d}"


async def next_class_id(branch_code: str, license_type: str, year: int | None = None) -> str:
    y = year or date.today().year
    key = CacheKeys.CLASS_SEQ.format(year=y, branch=branch_code)
    seq = await cache.incr(key)
    if seq == 1:
        await cache.expire(key, 365 * 2 * 24 * 3600)
    return f"LOP-{license_type}-{y}-{seq:03d}"


async def next_payment_id(branch_code: str, year: int | None = None) -> str:
    y = year or date.today().year
    key = CacheKeys.PAYMENT_SEQ.format(year=y, branch=branch_code)
    seq = await cache.incr(key)
    if seq == 1:
        await cache.expire(key, 365 * 2 * 24 * 3600)
    return f"GD{y}{seq:06d}"


async def next_bien_lai_id(year: int | None = None) -> str:
    """Sibling-format biên lai: BL-YYYY-NNNN."""
    y = year or date.today().year
    key = f"seq:bienlai:{y}"
    seq = await cache.incr(key)
    if seq == 1:
        await cache.expire(key, 365 * 2 * 24 * 3600)
    return f"BL-{y}-{seq:04d}"


async def next_instructor_id(year: int | None = None) -> str:
    y = year or date.today().year
    key = f"seq:giaovien:{y}"
    seq = await cache.incr(key)
    if seq == 1:
        await cache.expire(key, 365 * 2 * 24 * 3600)
    return f"GV{y}{seq:04d}"
