from datetime import date

from app.core.cache import CacheKeys, cache


async def next_student_id(year: int | None = None) -> str:
    y = year or date.today().year
    key = CacheKeys.STUDENT_SEQ.format(year=y)
    seq = await cache.incr(key)
    # Set expiry on first use (keys live for ~2 years to handle carryover)
    if seq == 1:
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


async def next_instructor_id(year: int | None = None) -> str:
    y = year or date.today().year
    key = f"seq:giaovien:{y}"
    seq = await cache.incr(key)
    if seq == 1:
        await cache.expire(key, 365 * 2 * 24 * 3600)
    return f"GV{y}{seq:04d}"
