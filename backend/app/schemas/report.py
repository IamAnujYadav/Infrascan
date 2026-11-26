"""Pydantic schemas for dashboard summary and inspection reports (Phase 4)."""
from datetime import date, datetime
from typing import Dict, List, Optional

from pydantic import BaseModel


class DashboardSummaryOut(BaseModel):
    role: str
    total_assets: int
    total_inspections: int
    planned_inspections: int
    in_progress_inspections: int
    completed_inspections: int
    cancelled_inspections: int
    total_images: int
    analyzed_images: int
    images_with_cracks: int
    awaiting_review: int
    severe_or_critical_count: int
    assets_by_type: Dict[str, int]
    severity_breakdown: Dict[str, int]


class MapAssetOut(BaseModel):
    id: int
    asset_code: str
    name: str
    asset_type: str
    location: str
    latitude: Optional[float]
    longitude: Optional[float]
    latest_inspection_id: Optional[int] = None
    latest_inspection_date: Optional[date] = None
    latest_severity: str = "Not assessed"
    latest_priority: Optional[str] = None


class ReportImageEntry(BaseModel):
    image_id: int
    original_name: str
    image_url: str
    width: Optional[int]
    height: Optional[int]
    latitude: Optional[float]
    longitude: Optional[float]
    status: str
    crack_detected: bool
    damage_types: List[str] = []
    severity: Optional[str] = None
    severity_score: Optional[float] = None
    priority: Optional[str] = None
    review_status: str = "pending"
    review_comment: str = ""
    geometry: Optional[dict] = None
    overlay_url: Optional[str] = None
    mask_url: Optional[str] = None
    annotated_url: Optional[str] = None
    heatmap_url: Optional[str] = None


class InspectionReportOut(BaseModel):
    inspection_id: int
    asset_id: int
    asset_code: str
    asset_name: str
    asset_type: str
    location: str
    inspector_name: Optional[str]
    status: str
    scheduled_date: Optional[date]
    inspection_date: Optional[date]
    notes: str
    overall_severity: Optional[str]
    overall_priority: Optional[str]
    requires_engineering_review: bool
    total_images: int
    analyzed_images: int
    images_with_cracks: int
    awaiting_review: int
    reviewed: int
    generated_at: datetime
    disclaimer: str
    items: List[ReportImageEntry]
