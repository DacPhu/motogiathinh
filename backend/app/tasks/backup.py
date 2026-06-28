"""Celery tasks: replicate uploaded files + the database to Cloudflare R2.

- replicate_to_r2 / backfill_r2 — offsite copies of uploaded files (enqueued by
  app.core.storage after each MinIO upload; backfill seeds pre-existing files).
- backup_database_to_r2 — scheduled pg_dump of Postgres → R2 (Celery beat, daily).

All are no-ops unless R2 is enabled + configured (storage.r2_enabled()).
"""
import logging
import os
import re
import subprocess
from datetime import datetime, timezone
from urllib.parse import unquote, urlparse

from app.celery_app import celery
from app.config import settings
from app.core import storage

logger = logging.getLogger(__name__)

_SAFE_KEY_PART_RE = re.compile(r"[^A-Za-z0-9_.-]+")


def _safe_key_part(value: str, fallback: str = "database") -> str:
    """Return a conservative S3 key/file component."""
    cleaned = _SAFE_KEY_PART_RE.sub("-", value).strip(".-")
    return cleaned or fallback


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


@celery.task(
    name="app.tasks.backup.backup_database_to_r2",
    bind=True,
    max_retries=3,
    default_retry_delay=300,
)
def backup_database_to_r2(self):
    """pg_dump the Postgres DB and upload it to R2 (offsite). Scheduled daily.

    No-op if R2 isn't configured. Writes a compressed custom-format dump to
    db-backups/<db>-<UTC-timestamp>.dump in R2; restore with `pg_restore`.
    """
    if not storage.r2_enabled():
        logger.warning("R2 not enabled; skipping database backup")
        return None

    # DATABASE_URL is an asyncpg URL; pg_dump wants plain libpq params.
    raw = (
        settings.DATABASE_URL
        .replace("+asyncpg", "")
        .replace("+psycopg2", "")
        .replace("+psycopg", "")
    )
    u = urlparse(raw)
    dbname = unquote((u.path or "/").lstrip("/")) or "postgres"
    safe_dbname = _safe_key_part(dbname)
    env = dict(os.environ)
    if u.password:
        env["PGPASSWORD"] = unquote(u.password)

    ts = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    key = f"db-backups/{safe_dbname}-{ts}.dump"
    tmp = f"/tmp/{safe_dbname}-{ts}.dump"
    try:
        subprocess.run(
            [
                "pg_dump", "-Fc",
                "-h", u.hostname or "db",
                "-p", str(u.port or 5432),
                "-U", unquote(u.username or "postgres"),
                "-d", dbname,
                "-f", tmp,
            ],
            check=True,
            env=env,
            capture_output=True,
        )
        if not os.path.exists(tmp) or os.path.getsize(tmp) <= 0:
            raise RuntimeError("pg_dump completed but produced an empty backup file")
        storage.r2_upload_file(key, tmp, content_type="application/octet-stream")
        size = os.path.getsize(tmp)
        pruned = storage.r2_prune_prefix("db-backups/", settings.DB_BACKUP_RETENTION)
        logger.info("DB backup uploaded to R2: %s (%d bytes, pruned=%d)", key, size, pruned)
        return {"key": key, "bytes": size, "pruned": pruned}
    except subprocess.CalledProcessError as exc:
        stderr = exc.stderr.decode(errors="replace") if exc.stderr else ""
        logger.error("pg_dump failed (rc=%s): %s", exc.returncode, stderr)
        raise self.retry(exc=exc)
    except Exception as exc:
        logger.error("DB backup failed for %s; retrying", key, exc_info=True)
        raise self.retry(exc=exc)
    finally:
        try:
            os.remove(tmp)
        except OSError:
            pass
