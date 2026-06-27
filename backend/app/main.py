from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import (
    accounts,
    activity_log,
    address,
    auth,
    branches,
    classes,
    constants,
    fee_plans,
    files,
    me,
    notifications,
    ocr,
    payments,
    promotions,
    reports,
    student_docs,
    students,
    teachers,
    vehicles,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    from app.core.cache import get_redis
    await get_redis().aclose()


app = FastAPI(
    title=settings.APP_NAME,
    version="2.0.0",
    description="Driving school management system API (sibling-contract /api/*)",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_PREFIX = "/api"

# Auth + identity
app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(me.router, prefix=API_PREFIX)
# Boot entities (frontend fetches these 11 in parallel + /constants/profile-docs)
app.include_router(address.router, prefix=API_PREFIX)
app.include_router(branches.router, prefix=API_PREFIX)
app.include_router(accounts.router, prefix=API_PREFIX)
app.include_router(fee_plans.router, prefix=API_PREFIX)
app.include_router(promotions.router, prefix=API_PREFIX)
app.include_router(teachers.router, prefix=API_PREFIX)
app.include_router(vehicles.router, prefix=API_PREFIX)
app.include_router(classes.router, prefix=API_PREFIX)
app.include_router(students.router, prefix=API_PREFIX)
app.include_router(student_docs.router, prefix=API_PREFIX)
app.include_router(payments.router, prefix=API_PREFIX)
app.include_router(notifications.router, prefix=API_PREFIX)
app.include_router(activity_log.router, prefix=API_PREFIX)
app.include_router(constants.router, prefix=API_PREFIX)
app.include_router(files.router, prefix=API_PREFIX)
app.include_router(ocr.router, prefix=API_PREFIX)
app.include_router(reports.router, prefix=API_PREFIX)


@app.get("/health")
async def health_check():
    return {"status": "ok", "app": settings.APP_NAME}
