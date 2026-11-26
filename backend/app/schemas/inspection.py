"""Request and response shapes for inspections and their images."""
from datetime import date, datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class InspectionStatus(str, Enum):
    planned = "planned"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"


# which status may follow which
ALLOWED_TRANSITIONS = {
    InspectionStatus.planned: {InspectionStatus.in_progress, InspectionStatus.cancelled},
    InspectionStatus.in_progress: {InspectionStatus.completed, InspectionStatus.cancelled},
    InspectionStatus.completed: set(),
    InspectionStatus.cancelled: set(),
}


class InspectionCreate(BaseModel):
    asset_id: int
    scheduled_date: Optional[date] = None
    assigned_to: Optional[int] = Field(None, description="User id of the inspector (an inspector who creates "
                                                         "an inspection is assigned automatically)")
    notes: str = Field("", max_length=2000)


class InspectionUpdate(BaseModel):
    """Only the fields that are sent are changed."""
    scheduled_date: Optional[date] = None
    assigned_to: Optional[int] = None          # send null to remove the inspector
    notes: Optional[str] = Field(None, max_length=2000)
    status: Optional[InspectionStatus] = None


class ImageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    inspection_id: int
    original_name: str
    url: str
    width: Optional[int]
    height: Optional[int]
    latitude: Optional[float]
    longitude: Optional[float]
    warnings: List[str]            # quality warnings: blurry, dark, duplicate ...
    quality: dict
    uploaded_by: Optional[int]
    uploaded_at: datetime


class InspectionOut(BaseModel):
    id: int
    asset_id: int
    asset_code: str
    asset_name: str
    status: str
    scheduled_date: Optional[date]
    inspection_date: Optional[date]
    assigned_to: Optional[int]
    assigned_to_name: Optional[str]
    created_by: Optional[int]
    notes: str
    image_count: int
    created_at: datetime
    updated_at: datetime


class InspectionDetail(InspectionOut):
    images: List[ImageOut]


class InspectionList(BaseModel):
    total: int
    items: List[InspectionOut]