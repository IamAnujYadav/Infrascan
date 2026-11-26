"""Result schemas. AnalysisResult is the JSON that the frontend receives."""
from typing import List, Optional
from pydantic import BaseModel


class QualityReport(BaseModel):
    passed: bool
    errors: List[str] = []      # problems that stop the analysis
    warnings: List[str] = []    # problems that only reduce trust
    metrics: dict = {}          # width, height, blur_score, brightness, ...


class ClassificationResult(BaseModel):
    label: str                  # "CRACK" or "NO_CRACK"
    crack_probability: float
    heatmap_path: Optional[str] = None   # Grad-CAM image
    model_version: str


class DetectionBox(BaseModel):
    class_name: str             # longitudinal_crack, transverse_crack, ...
    confidence: float
    bbox: List[float]           # [x1, y1, x2, y2] in pixels
    low_confidence: bool = False   # True when confidence is below DETECTOR_LOW_CONF


class DetectionResult(BaseModel):
    count: int
    boxes: List[DetectionBox] = []
    annotated_image_path: Optional[str] = None
    model_version: str


class GeometryResult(BaseModel):
    unit: str = "pixels"        # stays "pixels" unless the scale is calibrated
    length: float
    average_width: float
    max_width: float
    area: float
    density_percent: float      # crack area / image area * 100
    orientation_deg: Optional[float] = None
    orientation_label: Optional[str] = None   # horizontal / vertical / diagonal
    branch_points: int = 0
    crack_count: int = 0        # separate crack pieces


class SegmentationResult(BaseModel):
    crack_area_percent: float
    mask_path: Optional[str] = None
    overlay_path: Optional[str] = None
    geometry: Optional[GeometryResult] = None
    model_version: str


class SeverityResult(BaseModel):
    category: str               # No Visible Damage / Minor / Moderate / Severe / Critical
    score: float                # 0 to 100
    reasons: List[str] = []     # why this category was given


class PriorityResult(BaseModel):
    level: str                  # Routine Monitoring / Low / Medium / High / Urgent Engineering Review
    requires_engineering_review: bool
    reason: str


class AnalysisResult(BaseModel):
    image_name: str
    image_width: int = 0
    image_height: int = 0
    status: str = "ok"          # "ok", "rejected" (bad image) or "error" (all models failed)
    warnings: List[str] = []

    crack_detected: bool = False
    evidence: List[str] = []        # which models found a crack: classifier / detector / segmentation
    damage_types: List[str] = []    # crack, longitudinal_crack, pothole, ...

    quality: Optional[QualityReport] = None
    classification: Optional[ClassificationResult] = None
    detection: Optional[DetectionResult] = None
    segmentation: Optional[SegmentationResult] = None
    severity: Optional[SeverityResult] = None
    priority: Optional[PriorityResult] = None

    disclaimer: str = ""
    pipeline_version: str = ""
    processing_time_ms: float = 0.0