"""Request and response shapes for infrastructure assets."""
from datetime import date, datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class AssetType(str, Enum):
    building = "building"
    bridge = "bridge"
    road = "road"
    tunnel = "tunnel"
    dam = "dam"
    concrete_structure = "concrete_structure"
    retaining_wall = "retaining_wall"
    industrial_structure = "industrial_structure"


class InspectionFrequency(str, Enum):
    weekly = "weekly"
    monthly = "monthly"
    quarterly = "quarterly"
    half_yearly = "half_yearly"
    yearly = "yearly"


ASSET_TYPE_LABELS = {
    AssetType.building: "Building",
    AssetType.bridge: "Bridge",
    AssetType.road: "Road",
    AssetType.tunnel: "Tunnel",
    AssetType.dam: "Dam",
    AssetType.concrete_structure: "Concrete structure",
    AssetType.retaining_wall: "Retaining wall",
    AssetType.industrial_structure: "Industrial structure",
}

FREQUENCY_LABELS = {
    InspectionFrequency.weekly: "Weekly",
    InspectionFrequency.monthly: "Monthly",
    InspectionFrequency.quarterly: "Every 3 months",
    InspectionFrequency.half_yearly: "Every 6 months",
    InspectionFrequency.yearly: "Yearly",
}


class AssetCreate(BaseModel):
    asset_code: Optional[str] = Field(None, min_length=2, max_length=50, pattern=r"^[A-Za-z0-9._-]+$",
                                      description="Leave empty to get an automatic code like BRG-0001")
    name: str = Field(min_length=2, max_length=255)
    asset_type: AssetType
    location: str = Field("", max_length=500)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    construction_year: Optional[int] = Field(None, ge=1800, le=date.today().year)
    material_type: str = Field("", max_length=100)
    responsible_department: str = Field("", max_length=255)
    inspection_frequency: InspectionFrequency = InspectionFrequency.yearly


class AssetUpdate(BaseModel):
    """Only the fields that are sent are changed."""
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    asset_type: Optional[AssetType] = None
    location: Optional[str] = Field(None, max_length=500)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    construction_year: Optional[int] = Field(None, ge=1800, le=date.today().year)
    material_type: Optional[str] = Field(None, max_length=100)
    responsible_department: Optional[str] = Field(None, max_length=255)
    inspection_frequency: Optional[InspectionFrequency] = None


class AssetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    asset_code: str
    name: str
    asset_type: str
    location: str
    latitude: Optional[float]
    longitude: Optional[float]
    construction_year: Optional[int]
    material_type: str
    responsible_department: str
    inspection_frequency: str
    is_active: bool                 # False = archived
    created_by: Optional[int]
    created_at: datetime
    updated_at: datetime


class AssetList(BaseModel):
    total: int
    items: List[AssetOut]


class MaintenanceCreate(BaseModel):
    performed_on: date
    description: str = Field(min_length=3, max_length=1000)

    @field_validator("performed_on")
    @classmethod
    def not_in_future(cls, value):
        if value > date.today():
            raise ValueError("The date cannot be in the future.")
        return value


class MaintenanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    asset_id: int
    performed_on: date
    description: str
    recorded_by: Optional[int]
    created_at: datetime