from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import auth, leads, payments, reports, students


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: verify DB connection, init MinIO bucket, etc.
    yield
    # Shutdown: close Redis pool
    from app.core.cache import get_redis
    await get_redis().aclose()


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="Driving school management system API",
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

API_PREFIX = "/api/v1"

app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(students.router, prefix=API_PREFIX)
app.include_router(payments.router, prefix=API_PREFIX)
app.include_router(leads.router, prefix=API_PREFIX)
app.include_router(reports.router, prefix=API_PREFIX)


@app.get("/health")
async def health_check():
    return {"status": "ok", "app": settings.APP_NAME}
