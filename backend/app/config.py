from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# These origins must always be present regardless of what CORS_ORIGINS is set to
# in the .env — the iOS Capacitor app origin and the live web domain.
_REQUIRED_CORS = {
    "capacitor://localhost",
    "https://localhost",
    "https://motogiathinh.centersai.com",
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @model_validator(mode="after")
    def _inject_required_cors(self) -> "Settings":
        for origin in _REQUIRED_CORS:
            if origin not in self.CORS_ORIGINS:
                self.CORS_ORIGINS.append(origin)
        return self

    # App
    APP_NAME: str = "Moto Gia Thinh"
    DEBUG: bool = False
    SECRET_KEY: str = "change-me"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://mgt:mgt_secret@localhost:5432/motogiathinh"

    # Redis
    REDIS_URL: str = "redis://:redis_secret@localhost:6379/0"

    # S3 / MinIO
    S3_ENDPOINT: str = "http://localhost:9000"
    S3_BUCKET_NAME: str = "motogiathinh"
    S3_ACCESS_KEY: str = "minio_admin"
    S3_SECRET_KEY: str = "minio_secret"
    S3_USE_SSL: bool = False

    # Email
    SMTP_HOST: str = "smtp.mailgun.org"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    FROM_EMAIL: str = "no-reply@motogiathinh.vn"

    # SMS
    SMS_API_KEY: str = ""
    SMS_API_SECRET: str = ""
    SMS_SENDER_ID: str = "MotoGThnh"

    # Facebook
    FB_APP_ID: str = ""
    FB_APP_SECRET: str = ""
    FB_WEBHOOK_VERIFY_TOKEN: str = "motogiathinh_verify"
    FB_PAGE_BRANCH_MAP: str = "{}"

    # Google Vision (optional OCR)
    GOOGLE_VISION_API_KEY: str = ""

    # diachi.io — old→new Vietnamese address conversion (2025 admin reform).
    # Optional key (buy a "Standard" plan, ~200k VND) lifts the free tier's
    # 1-batch-per-3-minutes limit and enables complex merged addresses.
    DIACHI_API_URL: str = "https://diachi.io/api/convert-batch"
    DIACHI_API_KEY: str = ""

    # School
    SCHOOL_NAME: str = "Trường Dạy Lái Xe Moto Gia Thịnh"
    SCHOOL_ADDRESS: str = ""
    SCHOOL_PHONE: str = ""
    SCHOOL_EMAIL: str = ""

    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:80",
        "http://localhost",
        "capacitor://localhost",   # iOS Capacitor app
        "https://localhost",       # iOS WKWebView HTTPS
        "https://motogiathinh.centersai.com",  # live domain
    ]


settings = Settings()
