"""Response shapes for analysis: the temporary /api/analyze endpoint and the saved results of inspections."""
from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field

from ai.core.schemas import AnalysisResult
from app.schemas.inspection import ImageOut


class AnalyzeResponse(AnalysisResult):
    """Everything from the AI pipeline, plus an id and the original image.
    All image fields are URLs (for example /files/results/<id>/masks/image_mask.png)."""
    request_id: str
    original_image_url: Optional[str] = None


# ---------------------------------------------------------------- inspection results
class ReviewDecision(str, Enum):
    confirmed = "confirmed"      # the AI result is right
    modified = "modified"        # the engineer sets another severity
    rejected = "rejected"        # the AI was wrong: there is no damage (false alarm)


class AnalyzeRequest(BaseModel):
    image_ids: Optional[List[int]] = Field(None, description="Only these photos. Empty = all photos of the inspection.")
    force: bool = Field(False, description="True = analyse again, even if a result exists (the review is reset).")


class AnalyzeStarted(BaseModel):
    inspection_id: int
    queued: List[int]            # photo ids that will be analysed now
    skipped: int                 # already analysed or already waiting
    message: str


class ReviewIn(BaseModel):
    decision: ReviewDecision
    final_severity: Optional[str] = Field(None, description="Needed when the decision is 'modified'. One of: "
                                          "No Visible Damage, Minor Damage, Moderate Damage, Severe Damage, "
                                          "Critical / Requires Urgent Engineering Review")
    comment: str = Field("", max_length=1000, description="Needed when the decision is 'modified' or 'rejected'")


class AnalysisOut(BaseModel):
    id: int
    image_id: int
    inspection_id: int
    status: str                              # queued, running, ok, rejected, error
    error: str
    crack_detected: bool
    severity_category: Optional[str]         # what the AI said
    severity_score: Optional[float]
    priority_level: Optional[str]
    requires_engineering_review: bool
    review_status: str                       # pending, confirmed, modified, rejected
    final_severity: Optional[str]            # set by the engineer
    review_comment: str
    reviewed_by: Optional[int]
    reviewed_at: Optional[datetime]
    effective_severity: Optional[str]        # the engineer's severity if reviewed, else the AI's
    effective_priority: Optional[str]
    awaiting_review: bool
    pipeline_version: str
    processing_time_ms: float
    analyzed_at: Optional[datetime]
    result: Optional[AnalysisResult]         # the full AI result; image fields are URLs


class ImageResult(BaseModel):
    image: ImageOut
    analysis: Optional[AnalysisOut]          # null = not analysed yet


class InspectionSummary(BaseModel):
    total_images: int
    analyzed: int
    in_queue: int
    failed: int
    images_with_cracks: int
    awaiting_review: int
    reviewed: int
    overall_severity: Optional[str]          # the worst photo
    overall_priority: Optional[str]
    requires_engineering_review: bool


class InspectionResults(BaseModel):
    inspection_id: int
    summary: InspectionSummary
    items: List[ImageResult]