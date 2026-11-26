"""Database tables."""
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import JSON, Date, DateTime, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base
from app.security.roles import Role


def utcnow():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(255))
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(50), default=Role.inspector.value)
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class AuditLog(Base):
    """Who did what (spec: audit logging)."""
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(100))
    detail: Mapped[str] = mapped_column(String(500), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Asset(Base):
    """A structure that is inspected: building, bridge, road, tunnel ... (spec module 2)."""
    __tablename__ = "assets"

    id: Mapped[int] = mapped_column(primary_key=True)
    asset_code: Mapped[str] = mapped_column(String(50), unique=True, index=True)   # "Infrastructure ID"
    name: Mapped[str] = mapped_column(String(255))
    asset_type: Mapped[str] = mapped_column(String(50), index=True)
    location: Mapped[str] = mapped_column(String(500), default="")
    latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    construction_year: Mapped[Optional[int]] = mapped_column(nullable=True)
    material_type: Mapped[str] = mapped_column(String(100), default="")
    responsible_department: Mapped[str] = mapped_column(String(255), default="")
    inspection_frequency: Mapped[str] = mapped_column(String(30), default="yearly")
    is_active: Mapped[bool] = mapped_column(default=True)                          # False = archived
    created_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class MaintenanceRecord(Base):
    """One repair / maintenance job done on an asset (maintenance history)."""
    __tablename__ = "maintenance_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    asset_id: Mapped[int] = mapped_column(ForeignKey("assets.id"), index=True)
    performed_on: Mapped[date] = mapped_column(Date)
    description: Mapped[str] = mapped_column(String(1000))
    recorded_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Inspection(Base):
    """One inspection visit of an asset (spec module 2)."""
    __tablename__ = "inspections"

    id: Mapped[int] = mapped_column(primary_key=True)
    asset_id: Mapped[int] = mapped_column(ForeignKey("assets.id"), index=True)
    status: Mapped[str] = mapped_column(String(20), default="planned", index=True)
    scheduled_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    inspection_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)   # when the work was done
    assigned_to: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    created_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    notes: Mapped[str] = mapped_column(String(2000), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class InspectionImage(Base):
    """A photo of an inspection. The file itself is in storage; here is only its key."""
    __tablename__ = "inspection_images"

    id: Mapped[int] = mapped_column(primary_key=True)
    inspection_id: Mapped[int] = mapped_column(ForeignKey("inspections.id"), index=True)
    storage_key: Mapped[str] = mapped_column(String(500))
    original_name: Mapped[str] = mapped_column(String(255))
    file_hash: Mapped[str] = mapped_column(String(64), index=True)                 # to find duplicates
    width: Mapped[Optional[int]] = mapped_column(nullable=True)
    height: Mapped[Optional[int]] = mapped_column(nullable=True)
    latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)        # where the photo was taken
    longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    quality: Mapped[dict] = mapped_column(JSON, default=dict)                      # warnings and scores
    uploaded_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)



class AnalysisRecord(Base):
    """The AI result of one photo, and the engineer's review of it."""
    __tablename__ = "analysis_results"

    id: Mapped[int] = mapped_column(primary_key=True)
    image_id: Mapped[int] = mapped_column(ForeignKey("inspection_images.id"), unique=True, index=True)
    inspection_id: Mapped[int] = mapped_column(ForeignKey("inspections.id"), index=True)
    status: Mapped[str] = mapped_column(String(20), default="queued", index=True)   # queued, running, ok, rejected, error
    error: Mapped[str] = mapped_column(String(500), default="")
    crack_detected: Mapped[bool] = mapped_column(default=False)
    severity_category: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    severity_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    priority_level: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    requires_engineering_review: Mapped[bool] = mapped_column(default=False)
    result: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)             # full AI result (image paths are storage keys)
    pipeline_version: Mapped[str] = mapped_column(String(20), default="")
    processing_time_ms: Mapped[float] = mapped_column(Float, default=0.0)
    analyzed_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    analyzed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    # engineer review
    review_status: Mapped[str] = mapped_column(String(20), default="pending")       # pending, confirmed, modified, rejected
    final_severity: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    review_comment: Mapped[str] = mapped_column(String(1000), default="")
    reviewed_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)