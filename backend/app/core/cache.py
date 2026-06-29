import json
from typing import Any

import redis.asyncio as aioredis

from app.config import settings

_redis: aioredis.Redis | None = None


def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis


class CacheKeys:
    # Auth
    REFRESH_TOKEN = "auth:refresh:{user_id}"
    BLACKLISTED_TOKEN = "auth:blacklist:{jti}"
    RATE_LIMIT = "ratelimit:{ip}:{endpoint}"
    # User / Permission
    USER_PERMISSIONS = "perms:{user_id}"
    USER_PROFILE = "user:{user_id}"
    # Reference data
    COURSE_TYPES_ALL = "ref:course_types"
    DOCUMENT_TYPES_ALL = "ref:document_types"
    SYSTEM_SETTINGS = "ref:settings"
    # Reports
    DASHBOARD_STATS = "report:dashboard:{branch_id}"
    REVENUE_MONTHLY = "report:revenue:{branch_id}:{year}:{month}"
    STAFF_COLLECTION = "report:staffcollection:{branch_id}:{date}"
    CTV_COMPETITION = "ctv_competition:{year}:{month}"
    # Scheduling conflict
    INSTRUCTOR_BUSY = "sched:instructor:{id}:{date}"
    VEHICLE_BUSY = "sched:vehicle:{id}:{date}"
    # Student cache
    STUDENT_DETAIL = "student:{id}:detail"
    STUDENT_SCHEDULE = "student:{id}:schedule"
    STUDENT_PAYMENTS = "student:{id}:payments"
    STUDENT_DOCS_COMPLETE = "student:{id}:docs_complete"
    # Leads
    LEADS_UNCLAIMED = "lead:unclaimed:{branch_id}"
    # Analytics
    ANALYTICS = "report:analytics:{branch_id}:{year}"
    # Sequences (atomic INCR)
    STUDENT_SEQ = "seq:hocvien:{year}"
    CLASS_SEQ = "seq:lop:{year}:{branch}"
    PAYMENT_SEQ = "seq:payment:{year}:{branch}"
    # Queues
    NOTIFICATION_QUEUE = "queue:notifications"
    OCR_QUEUE = "queue:ocr"


class Cache:
    def __init__(self):
        self.redis = get_redis()

    async def get(self, key: str) -> Any | None:
        value = await self.redis.get(key)
        if value is None:
            return None
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return value

    async def set(self, key: str, value: Any, ttl: int | None = None) -> None:
        serialized = json.dumps(value, default=str)
        if ttl:
            await self.redis.setex(key, ttl, serialized)
        else:
            await self.redis.set(key, serialized)

    async def delete(self, *keys: str) -> None:
        if keys:
            await self.redis.delete(*keys)

    async def delete_pattern(self, pattern: str) -> None:
        keys = await self.redis.keys(pattern)
        if keys:
            await self.redis.delete(*keys)

    async def incr(self, key: str) -> int:
        return await self.redis.incr(key)

    async def expire(self, key: str, ttl: int) -> None:
        await self.redis.expire(key, ttl)

    async def exists(self, key: str) -> bool:
        return bool(await self.redis.exists(key))

    async def setex(self, key: str, ttl: int, value: Any) -> None:
        serialized = json.dumps(value, default=str)
        await self.redis.setex(key, ttl, serialized)


cache = Cache()
