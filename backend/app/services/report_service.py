"""Builds structured inspection reports in JSON and CSV formats (Phase 4)."""
import csv
import io
from sqlalchemy.orm import Session

from ai import config as ai_config
from app.db.models import Asset, Inspection, User, utcnow
from app.schemas.report import InspectionReportOut, ReportImageEntry
from app.services import result_service
from app.services.errors import ServiceError


def build_inspection_report(db: Session, inspection_id: int) -> InspectionReportOut:
    inspection = db.get(Inspection, inspection_id)
    if inspection is None:
        raise ServiceError("Inspection not found.", 404)

    asset = db.get(Asset, inspection.asset_id)
    inspector = db.get(User, inspection.assigned_to) if inspection.assigned_to else None
    results = result_service.get_results(db, inspection_id)

    entries = []
    for item in results.items:
        img = item.image
        an = item.analysis
        ai_res = an.result if an else None

        entries.append(
            ReportImageEntry(
                image_id=img.id,
                original_name=img.original_name,
                image_url=img.url,
                width=img.width,
                height=img.height,
                latitude=img.latitude,
                longitude=img.longitude,
                status=an.status if an else "not_analyzed",
                crack_detected=bool(an.crack_detected) if an else False,
                damage_types=list(ai_res.damage_types) if ai_res else [],
                severity=an.effective_severity if an else None,
                severity_score=an.severity_score if an else None,
                priority=an.effective_priority if an else None,
                review_status=an.review_status if an else "pending",
                review_comment=an.review_comment if an else "",
                geometry=(
                    ai_res.segmentation.geometry.model_dump()
                    if ai_res and ai_res.segmentation and ai_res.segmentation.geometry
                    else None
                ),
                overlay_url=(
                    ai_res.segmentation.overlay_path
                    if ai_res and ai_res.segmentation
                    else None
                ),
                mask_url=(
                    ai_res.segmentation.mask_path
                    if ai_res and ai_res.segmentation
                    else None
                ),
                annotated_url=(
                    ai_res.detection.annotated_image_path
                    if ai_res and ai_res.detection
                    else None
                ),
                heatmap_url=(
                    ai_res.classification.heatmap_path
                    if ai_res and ai_res.classification
                    else None
                ),
            )
        )

    summary = results.summary
    return InspectionReportOut(
        inspection_id=inspection.id,
        asset_id=inspection.asset_id,
        asset_code=asset.asset_code if asset else "",
        asset_name=asset.name if asset else "",
        asset_type=asset.asset_type if asset else "",
        location=asset.location if asset else "",
        inspector_name=inspector.full_name if inspector else None,
        status=inspection.status,
        scheduled_date=inspection.scheduled_date,
        inspection_date=inspection.inspection_date,
        notes=inspection.notes,
        overall_severity=summary.overall_severity,
        overall_priority=summary.overall_priority,
        requires_engineering_review=summary.requires_engineering_review,
        total_images=summary.total_images,
        analyzed_images=summary.analyzed,
        images_with_cracks=summary.images_with_cracks,
        awaiting_review=summary.awaiting_review,
        reviewed=summary.reviewed,
        generated_at=utcnow(),
        disclaimer=ai_config.DISCLAIMER,
        items=entries,
    )


def report_to_csv(report: InspectionReportOut) -> str:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(
        [
            "Inspection ID",
            "Asset Code",
            "Asset Name",
            "Asset Type",
            "Location",
            "Inspector",
            "Inspection Date",
            "Image ID",
            "File Name",
            "Analysis Status",
            "Crack Detected",
            "Damage Types",
            "Severity",
            "Severity Score",
            "Priority",
            "Length (px)",
            "Avg Width (px)",
            "Max Width (px)",
            "Density (%)",
            "Review Status",
            "Review Comment",
        ]
    )
    for item in report.items:
        geom = item.geometry or {}
        writer.writerow(
            [
                report.inspection_id,
                report.asset_code,
                report.asset_name,
                report.asset_type,
                report.location,
                report.inspector_name or "Unassigned",
                str(report.inspection_date or report.scheduled_date or ""),
                item.image_id,
                item.original_name,
                item.status,
                item.crack_detected,
                "; ".join(item.damage_types),
                item.severity or "Not assessed",
                item.severity_score if item.severity_score is not None else "",
                item.priority or "",
                geom.get("length", ""),
                geom.get("average_width", ""),
                geom.get("max_width", ""),
                geom.get("density_percent", ""),
                item.review_status,
                item.review_comment,
            ]
        )
    return buf.getvalue()
