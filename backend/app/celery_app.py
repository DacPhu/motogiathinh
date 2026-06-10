from celery import Celery
from celery.schedules import crontab

from app.config import settings

celery = Celery(
    "motogiathinh",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.tasks.notifications", "app.tasks.backup"],
)

celery.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Asia/Ho_Chi_Minh",
    enable_utc=True,
    beat_schedule={
        # Fire notification checks every hour
        "check-session-reminders": {
            "task": "app.tasks.notifications.send_session_reminders",
            "schedule": crontab(minute=0),
        },
        "check-payment-due": {
            "task": "app.tasks.notifications.send_payment_due_reminders",
            "schedule": crontab(hour=8, minute=0),
        },
        "check-exam-reminders": {
            "task": "app.tasks.notifications.send_exam_reminders",
            "schedule": crontab(hour=8, minute=30),
        },
        "check-overdue-payments": {
            "task": "app.tasks.notifications.mark_overdue_payments",
            "schedule": crontab(hour=1, minute=0),
        },
        "recompute-auto-notifications": {
            "task": "app.tasks.notifications.recompute_auto_notifications",
            "schedule": crontab(minute="*/5"),
        },
        # Daily offsite database backup → R2 (03:30 Asia/Ho_Chi_Minh).
        "backup-database-to-r2": {
            "task": "app.tasks.backup.backup_database_to_r2",
            "schedule": crontab(hour=3, minute=30),
        },
    },
)
