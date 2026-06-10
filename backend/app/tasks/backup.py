"""Celery tasks: replicate uploaded files to Cloudflare R2 (offsite backup).

Enqueued by `app.core.storage._enqueue_r2_backup` after each MinIO upload; no-op
unless R2 is enabled + configured (`storage.r2_enabled()`). `backfill_r2` seeds
the backup for files that already existed in MinIO before R2 was turned on.
"""
import logging

from app.celery_app import celery
from app.core import storage

logger = logging.getLogger(__name__)


@celery.task(
    name="app.tasks.backup.replicate_to_r2",
    bind=True,
    max_retries=5,
    default_retry_delay=60,
)
def replicate_to_r2(self, key: str):
    """Copy one MinIO object to R2. Retries on transient failure."""
    try:
        storage.replicate_key_to_r2(key)
        logger.info("R2 backup: replicated %s", key)
    except Exception as exc:
        logger.warning("R2 backup failed for %s (retrying): %s", key, exc)
        raise self.retry(exc=exc)


@celery.task(name="app.tasks.backup.backfill_r2")
def backfill_r2():
    """Enqueue replication for every existing MinIO object (seed the backup)."""
    n = 0
    for key in storage.iter_primary_keys():
        replicate_to_r2.delay(key)
        n += 1
    logger.info("R2 backfill: enqueued %d objects", n)
    return n
