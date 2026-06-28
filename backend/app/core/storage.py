"""MinIO/S3 file storage service.

Primary storage is MinIO (on-server S3). When R2 is enabled (see config), every
upload is also replicated to Cloudflare R2 as an offsite backup — asynchronously
via the Celery task `app.tasks.backup.replicate_to_r2` — and reads fall back to
R2 if MinIO is missing/unreachable. All R2 paths are no-ops unless `r2_enabled()`.
"""

import logging
import uuid
from functools import lru_cache
from pathlib import PurePosixPath

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from fastapi import UploadFile

from app.config import settings

logger = logging.getLogger(__name__)

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_SIZE = 5 * 1024 * 1024  # 5MB


def _get_client():
    return boto3.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
        region_name="us-east-1",
    )


# --- Cloudflare R2 backup (offsite copy of every upload) ---------------------

def r2_enabled() -> bool:
    """True only when R2 backup is switched on AND fully configured."""
    return bool(
        settings.R2_ENABLED
        and settings.R2_ENDPOINT
        and settings.R2_ACCESS_KEY
        and settings.R2_SECRET_KEY
        and settings.R2_BUCKET_NAME
    )


@lru_cache(maxsize=1)
def _get_r2_client():
    # R2 is S3-compatible: region "auto", SigV4, short timeouts so a slow R2 can't
    # stall the Celery worker for long.
    return boto3.client(
        "s3",
        endpoint_url=settings.R2_ENDPOINT,
        aws_access_key_id=settings.R2_ACCESS_KEY,
        aws_secret_access_key=settings.R2_SECRET_KEY,
        region_name="auto",
        config=Config(
            signature_version="s3v4",
            connect_timeout=5,
            read_timeout=15,
            retries={"max_attempts": 3},
        ),
    )


def _enqueue_r2_backup(key: str) -> None:
    """Best-effort: queue async R2 replication of `key`. Never breaks the upload."""
    if not r2_enabled():
        return
    try:
        # Lazy import avoids a storage <-> tasks circular import at module load.
        from app.tasks.backup import replicate_to_r2

        replicate_to_r2.delay(key)
    except Exception:  # broker down, etc. — the MinIO write already succeeded
        logger.warning("could not enqueue R2 backup for %s", key, exc_info=True)


def replicate_key_to_r2(key: str) -> None:
    """Copy one object from MinIO (primary) to R2. Called by the Celery backup task."""
    if not r2_enabled():
        return
    obj = _get_client().get_object(Bucket=settings.S3_BUCKET_NAME, Key=key)
    body = obj["Body"].read()
    ctype = obj.get("ContentType", "application/octet-stream")
    _get_r2_client().put_object(
        Bucket=settings.R2_BUCKET_NAME,
        Key=key,
        Body=body,
        ContentType=ctype,
    )


def iter_primary_keys():
    """Yield every object key in the MinIO bucket (used to backfill R2)."""
    paginator = _get_client().get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=settings.S3_BUCKET_NAME):
        for obj in page.get("Contents", []):
            yield obj["Key"]


def r2_upload_file(key: str, path: str, content_type: str = "application/octet-stream") -> str:
    """Upload a local file to R2 under `key` (used for DB dumps). Returns the key.

    Uses boto3's managed transfer (multipart, streamed from disk) so large dumps
    don't load fully into memory.
    """
    if not r2_enabled():
        raise RuntimeError("R2 is not enabled/configured")
    _get_r2_client().upload_file(
        path, settings.R2_BUCKET_NAME, key, ExtraArgs={"ContentType": content_type}
    )
    return key


def r2_prune_prefix(prefix: str, keep: int) -> int:
    """Keep the newest `keep` objects under `prefix` in R2; delete older ones."""
    if not r2_enabled() or keep < 1:
        return 0

    client = _get_r2_client()
    paginator = client.get_paginator("list_objects_v2")
    objects = []
    for page in paginator.paginate(Bucket=settings.R2_BUCKET_NAME, Prefix=prefix):
        objects.extend(page.get("Contents", []))

    stale = sorted(
        objects,
        key=lambda obj: obj.get("LastModified"),
        reverse=True,
    )[keep:]
    if not stale:
        return 0

    deleted = 0
    for start in range(0, len(stale), 1000):
        batch = stale[start:start + 1000]
        client.delete_objects(
            Bucket=settings.R2_BUCKET_NAME,
            Delete={"Objects": [{"Key": obj["Key"]} for obj in batch], "Quiet": True},
        )
        deleted += len(batch)
    return deleted


# -----------------------------------------------------------------------------

def _ensure_bucket(client):
    try:
        client.head_bucket(Bucket=settings.S3_BUCKET_NAME)
    except ClientError:
        client.create_bucket(Bucket=settings.S3_BUCKET_NAME)
        # Make bucket public-read for serving images
        policy = (
            '{"Version":"2012-10-17","Statement":[{"Effect":"Allow",'
            '"Principal":"*","Action":"s3:GetObject",'
            f'"Resource":"arn:aws:s3:::{settings.S3_BUCKET_NAME}/*"'
            "}]}"
        )
        client.put_bucket_policy(Bucket=settings.S3_BUCKET_NAME, Policy=policy)


async def upload_file(file: UploadFile, folder: str) -> str:
    """Upload file to MinIO and return the public URL."""
    if file.content_type not in ALLOWED_TYPES:
        raise ValueError(f"File type {file.content_type} not allowed. Use JPG, PNG, or WebP.")

    content = await file.read()
    if len(content) > MAX_SIZE:
        raise ValueError(f"File too large ({len(content) // 1024}KB). Max {MAX_SIZE // 1024 // 1024}MB.")

    ext = PurePosixPath(file.filename or "image.jpg").suffix or ".jpg"
    key = f"{folder}/{uuid.uuid4().hex}{ext}"

    client = _get_client()
    _ensure_bucket(client)

    client.put_object(
        Bucket=settings.S3_BUCKET_NAME,
        Key=key,
        Body=content,
        ContentType=file.content_type,
    )
    _enqueue_r2_backup(key)

    return f"{settings.S3_ENDPOINT}/{settings.S3_BUCKET_NAME}/{key}"


def upload_bytes(key: str, content: bytes, content_type: str = "application/octet-stream") -> str:
    """Sync upload of raw bytes to MinIO; returns the public URL.

    Used by /api/students/{id}/docs/{key} and /api/payments/{id}/bien-lai
    where the caller has already read the request body (and validated
    size/type via magic-bytes elsewhere).
    """
    client = _get_client()
    _ensure_bucket(client)
    client.put_object(
        Bucket=settings.S3_BUCKET_NAME,
        Key=key,
        Body=content,
        ContentType=content_type,
    )
    _enqueue_r2_backup(key)
    return f"{settings.S3_ENDPOINT}/{settings.S3_BUCKET_NAME}/{key}"


def get_object_bytes(key: str) -> tuple[bytes, str]:
    """Fetch raw bytes + content_type for /api/files/<kind>/<recId>/<filename>.

    Falls back to the R2 backup if MinIO is missing the object or unreachable.
    """
    try:
        obj = _get_client().get_object(Bucket=settings.S3_BUCKET_NAME, Key=key)
        return obj["Body"].read(), obj.get("ContentType", "application/octet-stream")
    except Exception:
        if not r2_enabled():
            raise
        logger.warning("MinIO read failed for %s; falling back to R2", key, exc_info=True)
        obj = _get_r2_client().get_object(Bucket=settings.R2_BUCKET_NAME, Key=key)
        return obj["Body"].read(), obj.get("ContentType", "application/octet-stream")


async def delete_file(url: str) -> None:
    """Delete file from MinIO (and its R2 backup) by its URL."""
    prefix = f"{settings.S3_ENDPOINT}/{settings.S3_BUCKET_NAME}/"
    if not url.startswith(prefix):
        return
    key = url[len(prefix):]
    try:
        _get_client().delete_object(Bucket=settings.S3_BUCKET_NAME, Key=key)
    except ClientError:
        pass
    if r2_enabled():
        try:
            _get_r2_client().delete_object(Bucket=settings.R2_BUCKET_NAME, Key=key)
        except Exception:
            pass
