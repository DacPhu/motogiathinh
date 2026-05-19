import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import BaseModel
from app.models.enums import LicenseType, VehicleStatus


class Vehicle(BaseModel):
    __tablename__ = "vehicles"

    branch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("branches.id"), nullable=False, index=True
    )
    bien_so: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    loai_xe: Mapped[str] = mapped_column(String(50), nullable=False)
    hang_xe: Mapped[str | None] = mapped_column(String(100))
    ten_xe: Mapped[str | None] = mapped_column(String(100))
    nam_san_xuat: Mapped[int | None] = mapped_column(SmallInteger)
    mau_xe: Mapped[str | None] = mapped_column(String(50))
    so_khung: Mapped[str | None] = mapped_column(String(50))
    so_may: Mapped[str | None] = mapped_column(String(50))
    dung_tich_may: Mapped[int | None] = mapped_column(SmallInteger)
    loai_bang_lai: Mapped[LicenseType] = mapped_column(Enum(LicenseType), nullable=False, index=True)
    # Registration
    ngay_dang_kiem: Mapped[date | None] = mapped_column(Date)
    ngay_het_dang_kiem: Mapped[date | None] = mapped_column(Date, index=True)
    bao_hiem_den_ngay: Mapped[date | None] = mapped_column(Date)
    # Condition
    trang_thai: Mapped[VehicleStatus] = mapped_column(
        Enum(VehicleStatus), nullable=False, default=VehicleStatus.active, index=True
    )
    odometer_km: Mapped[int] = mapped_column(Integer, default=0)
    last_service_km: Mapped[int] = mapped_column(Integer, default=0)
    last_service_date: Mapped[date | None] = mapped_column(Date)
    next_service_km: Mapped[int | None] = mapped_column(Integer)
    # Cost
    purchase_date: Mapped[date | None] = mapped_column(Date)
    purchase_price: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    anh_xe_url: Mapped[str | None] = mapped_column(String(500))

    # Relationships
    maintenance_records: Mapped[list["VehicleMaintenance"]] = relationship(
        "VehicleMaintenance", back_populates="vehicle"
    )
    sessions: Mapped[list["Session"]] = relationship("Session", back_populates="vehicle")


class VehicleMaintenance(BaseModel):
    __tablename__ = "vehicle_maintenance"

    vehicle_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("vehicles.id"), nullable=False, index=True
    )
    maintenance_date: Mapped[date] = mapped_column(Date, nullable=False)
    maintenance_type: Mapped[str | None] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(Text)
    cost: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    service_center: Mapped[str | None] = mapped_column(String(200))
    odometer_km: Mapped[int | None] = mapped_column(Integer)
    next_due_km: Mapped[int | None] = mapped_column(Integer)
    next_due_date: Mapped[date | None] = mapped_column(Date)
    performed_by: Mapped[str | None] = mapped_column(String(100))
    receipt_url: Mapped[str | None] = mapped_column(String(500))

    vehicle: Mapped["Vehicle"] = relationship("Vehicle", back_populates="maintenance_records")
