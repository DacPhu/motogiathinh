from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # App
    APP_NAME: str = "Moto Gia Thinh"
    DEBUG: bool = False
    SECRET_KEY: str = "change-me"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
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

    # VNPay
    VNPAY_TMN_CODE: str = ""
    VNPAY_HASH_SECRET: str = ""
    VNPAY_URL: str = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html"
    VNPAY_RETURN_URL: str = "http://localhost:3000/payments/vnpay/return"

    # Google Vision (optional OCR)
    GOOGLE_VISION_API_KEY: str = ""

    # School
    SCHOOL_NAME: str = "Trường Dạy Lái Xe Moto Gia Thịnh"
    SCHOOL_ADDRESS: str = ""
    SCHOOL_PHONE: str = ""
    SCHOOL_EMAIL: str = ""

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:80"]


settings = Settings()
