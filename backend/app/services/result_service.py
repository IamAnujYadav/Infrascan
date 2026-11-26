"""Analysis of inspection photos: run the AI, save the result, engineer review, summary."""
import copy
from pathlib import Path
from typing import List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.orm import Session

from ai.core.schemas import AnalysisResult
from ai.modules.priority.rules import PRIORITY_BY_SEVERITY
from ai.modules.severity.rules import LEVELS, NONE
from ai.pipeline import get_pipeline
from app.db.database import SessionLocal
from app.db.models import AnalysisRecord, Inspection, InspectionImage, User, utcnow
from app.schemas.analysis import (AnalysisOut, ImageResult, InspectionResults, InspectionSummary,
                                  ReviewDecision, ReviewIn)
from app.services import analysis_service
from app.services.auth_service import write_audit
from app.services.errors import ServiceError
from app.services.inspection_service import image_out, list_images
from app.services.storage_service import storage

SEVERITY_ORDER = [NONE] + [name for _, name in reversed(LEVELS)]        # mildest first
WAITING = ("queued", "running")

# the image fields inside the saved result (they hold storage keys, the API shows URLs)
IMAGE_FIELDS = [("classification", "heatmap_path"), ("detection", "annotated_image_path"),
                ("segmentation", "mask_path"), ("segmentation", "overlay_path")]


def _map_image_fields(result: dict, function) -> dict:
    for section, field in IMAGE_FIELDS:
        block = result.get(section)
        if block and block.get(field):
            block[field] = function(block[field])
    return result


def _to_key(path: str) -> str:
    return Path(path).resolve().relative_to(storage.root).as_posix()


# ---------------------------------------------------------------- starting the analysis
def queue_images(db: Session, inspection: Inspection, image_ids: Optional[List[int]],
                 force: bool, user: User) -> Tuple[List[int], int]:
    """Mark photos as waiting. Returns (photo ids to analyse, number skipped)."""
    if inspection.status == "cancelled":
        raise ServiceError("This inspection is cancelled.", 409)

    images = db.scalars(select(InspectionImage).where(InspectionImage.inspection_id == inspection.id)
                        .order_by(InspectionImage.id)).all()
    if not images:
        raise ServiceError("This inspection has no photos yet.", 400)
    if image_ids:
        unknown = set(image_ids) - {image.id for image in images}
        if unknown:
            raise ServiceError(f"Photo {sorted(unknown)[0]} is not part of this inspection.", 404)
        images = [image for image in images if image.id in set(image_ids)]

    existing = {row.image_id: row for row in db.scalars(
        select(AnalysisRecord).where(AnalysisRecord.inspection_id == inspection.id))}

    queued, skipped = [], 0
    for image in images:
        row = existing.get(image.id)
        if row is not None and (row.status in WAITING or (row.status == "ok" and not force)):
            skipped += 1
            continue
        if row is None:
            row = AnalysisRecord(image_id=image.id, inspection_id=inspection.id)
            db.add(row)
        row.status = "queued"
        row.error = ""
        row.analyzed_by = user.id
        row.review_status, row.final_severity = "pending", None          # a new analysis needs a new review
        row.review_comment, row.reviewed_by, row.reviewed_at = "", None, None
        queued.append(image.id)
    db.commit()
    if queued:
        write_audit(db, user.id, "analysis_started", f"inspection={inspection.id} photos={len(queued)}")
    return queued, skipped


def run_batch(image_ids: List[int]):
    """Runs in the background after the answer was sent. Photos are analysed one by one."""
    with SessionLocal() as db:
        for image_id in image_ids:
            _analyze_one(db, image_id)


def _analyze_one(db: Session, image_id: int):
    row = db.scalar(select(AnalysisRecord).where(AnalysisRecord.image_id == image_id))
    image = db.get(InspectionImage, image_id)
    if row is None or image is None:
        return
    row.status = "running"
    db.commit()

    try:
        output_dir = storage.local_path(f"results/inspections/{image.inspection_id}/{image.id}")
        with analysis_service.pipeline_lock:
            result = get_pipeline().analyze(storage.local_path(image.storage_key), output_dir=output_dir,
                                            name="image")
    except Exception as error:
        row.status, row.error, row.analyzed_at = "error", str(error)[:500], utcnow()
        db.commit()
        return

    result.image_name = image.original_name
    row.status = result.status
    row.error = "; ".join(result.warnings)[:500] if result.status != "ok" else ""
    row.crack_detected = result.crack_detected
    row.severity_category = result.severity.category if result.severity else None
    row.severity_score = result.severity.score if result.severity else None
    row.priority_level = result.priority.level if result.priority else None
    row.requires_engineering_review = result.priority.requires_engineering_review if result.priority else False
    row.result = _map_image_fields(result.model_dump(mode="json"), _to_key)
    row.pipeline_version = result.pipeline_version
    row.processing_time_ms = result.processing_time_ms
    row.analyzed_at = utcnow()
    db.commit()


def fail_stale(db: Session) -> int:
    """After a server restart, photos that were still waiting will never finish. Mark them as failed."""
    rows = db.scalars(select(AnalysisRecord).where(AnalysisRecord.status.in_(WAITING))).all()
    for row in rows:
        row.status, row.error = "error", "Interrupted by a server restart. Analyse again."
    db.commit()
    return len(rows)


# ---------------------------------------------------------------- reading
def _effective_severity(row: AnalysisRecord) -> Optional[str]:
    if row.status != "ok":
        return None
    return row.final_severity or row.severity_category


def analysis_out(row: AnalysisRecord) -> AnalysisOut:
    severity = _effective_severity(row)
    result = None
    if row.result:
        result = AnalysisResult.model_validate(_map_image_fields(copy.deepcopy(row.result), storage.url))
    return AnalysisOut(
        id=row.id, image_id=row.image_id, inspection_id=row.inspection_id, status=row.status, error=row.error,
        crack_detected=row.crack_detected, severity_category=row.severity_category,
        severity_score=row.severity_score, priority_level=row.priority_level,
        requires_engineering_review=row.requires_engineering_review, review_status=row.review_status,
        final_severity=row.final_severity, review_comment=row.review_comment, reviewed_by=row.reviewed_by,
        reviewed_at=row.reviewed_at, effective_severity=severity,
        effective_priority=PRIORITY_BY_SEVERITY[severity][0] if severity else None,
        awaiting_review=row.status == "ok" and row.review_status == "pending",
        pipeline_version=row.pipeline_version, processing_time_ms=row.processing_time_ms,
        analyzed_at=row.analyzed_at, result=result)


def get_row(db: Session, inspection_id: int, image_id: int) -> Optional[AnalysisRecord]:
    return db.scalar(select(AnalysisRecord).where(AnalysisRecord.inspection_id == inspection_id,
                                                  AnalysisRecord.image_id == image_id))


def _summary(total_images: int, rows: List[AnalysisRecord]) -> InspectionSummary:
    finished = [row for row in rows if row.status == "ok"]
    worst = None
    if finished:
        worst = max((_effective_severity(row) for row in finished), key=SEVERITY_ORDER.index)
    return InspectionSummary(
        total_images=total_images,
        analyzed=len(finished),
        in_queue=sum(1 for row in rows if row.status in WAITING),
        failed=sum(1 for row in rows if row.status in ("error", "rejected")),
        images_with_cracks=sum(1 for row in finished if row.crack_detected),
        awaiting_review=sum(1 for row in finished if row.review_status == "pending"),
        reviewed=sum(1 for row in finished if row.review_status != "pending"),
        overall_severity=worst,
        overall_priority=PRIORITY_BY_SEVERITY[worst][0] if worst else None,
        requires_engineering_review=bool(worst and PRIORITY_BY_SEVERITY[worst][1]),
    )


def get_results(db: Session, inspection_id: int) -> InspectionResults:
    images = list_images(db, inspection_id)
    rows = {row.image_id: row for row in db.scalars(
        select(AnalysisRecord).where(AnalysisRecord.inspection_id == inspection_id))}
    items = [ImageResult(image=image, analysis=analysis_out(rows[image.id]) if image.id in rows else None)
             for image in images]
    return InspectionResults(inspection_id=inspection_id,
                             summary=_summary(len(images), list(rows.values())), items=items)


# ---------------------------------------------------------------- engineer review
def review(db: Session, inspection: Inspection, image_id: int, body: ReviewIn, user: User) -> AnalysisOut:
    if inspection.status == "cancelled":
        raise ServiceError("This inspection is cancelled.", 409)
    row = get_row(db, inspection.id, image_id)
    if row is None:
        raise ServiceError("This photo has not been analysed yet.", 404)
    if row.status != "ok":
        raise ServiceError("Only a finished analysis can be reviewed.", 409)

    comment = body.comment.strip()
    if body.decision == ReviewDecision.confirmed:
        final = row.severity_category
    elif body.decision == ReviewDecision.rejected:
        final = NONE
    else:
        final = body.final_severity
        if final not in SEVERITY_ORDER:
            raise ServiceError("final_severity must be one of: " + ", ".join(SEVERITY_ORDER), 422)
    if body.decision != ReviewDecision.confirmed and len(comment) < 3:
        raise ServiceError("Please write a short comment that explains the decision.", 422)

    row.review_status = body.decision.value
    row.final_severity = final
    row.review_comment = comment
    row.reviewed_by = user.id
    row.reviewed_at = utcnow()
    db.commit()
    write_audit(db, user.id, "analysis_reviewed",
                f"inspection={inspection.id} image={image_id} decision={body.decision.value} final={final}")
    return analysis_out(row)