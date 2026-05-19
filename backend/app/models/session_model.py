import uuid
from datetime import date, time

from sqlalchemy import Boolean, Date, Enum, ForeignKey, Integer, String, Text, Time, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import BaseModel
from app.models.enums import AttendanceStatus, SessionType


class Session(BaseModel):
    __tablename__ = "sessions"

    branch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("branches.id"), nullable=False, index=True
    )
    class_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("classes.id"), nullable=False, index=True
    )
    instructor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("instructors.id"), index=True
    )
    vehicle_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("vehicles.id")
    )
    session_type: Mapped[SessionType] = mapped_column(Enum(SessionType), nullable=False)
    session_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    dia_diem: Mapped[str | None] = mapped_column(String(200))
    phong_hoc: Mapped[str | None] = mapped_column(String(100))
    noi_dung: Mapped[str | None] = mapped_column(Text)
    tai_lieu_url: Mapped[str | None] = mapped_column(String(500))
    is_cancelled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    cancel_reason: Mapped[str | None] = mapped_column(Text)
    ghi_chu: Mapped[str | None] = mapped_column(Text)

    # Relationships
    class_: Mapped["Class"] = relationship("Class", back_populates="sessions")
    instructor: Mapped["Instructor | None"] = relationship("Instructor", back_populates="sessions")
    vehicle: Mapped["Vehicle | None"] = relationship("Vehicle", back_populates="sessions")
    attendance_records: Mapped[list["Attendance"]] = relationship(
        "Attendance", back_populates="session"
    )
    session_log: Mapped["SessionLog | None"] = relationship(
        "SessionLog", back_populates="session", uselist=False
    )


class Attendance(BaseModel):
    __tablename__ = "attendance"
    __table_args__ = (UniqueConstraint("session_id", "student_id"),)

    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sessions.id"), nullable=False, index=True
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("students.id"), nullable=False, index=True
    )
    trang_thai: Mapped[AttendanceStatus] = mapped_column(
        Enum(AttendanceStatus), nullable=False, default=AttendanceStatus.absent
    )
    check_in_time: Mapped[time | None] = mapped_column(Time)
    check_out_time: Mapped[time | None] = mapped_column(Time)
    manual_override: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    override_reason: Mapped[str | None] = mapped_column(Text)
    ghi_chu: Mapped[str | None] = mapped_column(Text)
    recorded_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))

    session: Mapped["Session"] = relationship("Session", back_populates="attendance_records")


class SessionLog(BaseModel):
    __tablename__ = "session_logs"

    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sessions.id"), nullable=False, unique=True
    )
    instructor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("instructors.id"), nullable=False
    )
    noi_dung_giang: Mapped[str | None] = mapped_column(Text)
    ket_qua: Mapped[str | None] = mapped_column(Text)
    issues_noted: Mapped[str | None] = mapped_column(Text)
    odometer_start: Mapped[int | None] = mapped_column(Integer)
    odometer_end: Mapped[int | None] = mapped_column(Integer)

    session: Mapped["Session"] = relationship("Session", back_populates="session_log")
