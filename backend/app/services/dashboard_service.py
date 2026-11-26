"""Aggregates role-aware stats for dashboards and map risk pins (Phase 4)."""
from typing import List

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ai.modules.priority.rules import PRIORITY_BY_SEVERITY
from ai.modules.severity.rules import LEVELS, NONE
from app.db.models import AnalysisRecord, Asset, Inspection, InspectionImage, User
from app.schemas.report import DashboardSummaryOut, MapAssetOut
from app.security.roles import Role

SEVERITY_ORDER = [NONE] + [name for _, name in reversed(LEVELS)]
SEVERE_CATEGORIES = {
    "Severe Damage",
    "Critical / Requires Urgent Engineering Review",
}


def get_dashboard_summary(db: Session, user: User) -> DashboardSummaryOut:
    # Assets count (active only)
    active_assets = db.scalars(select(Asset).where(Asset.is_active.is_(True))).all()
    assets_by_type = {}
    for a in active_assets:
        assets_by_type[a.asset_type] = assets_by_type.get(a.asset_type, 0) + 1

    # Inspections visible to this user (inspectors see their own; others see all)
    insp_conditions = []
    if user.role == Role.inspector.value:
        insp_conditions.append(
            or_(Inspection.assigned_to == user.id, Inspection.created_by == user.id)
        )

    inspections = db.scalars(select(Inspection).where(*insp_conditions)).all()
    insp_ids = [ins.id for ins in inspections]

    planned = sum(1 for i in inspections if i.status == "planned")
    in_progress = sum(1 for i in inspections if i.status == "in_progress")
    completed = sum(1 for i in inspections if i.status == "completed")
    cancelled = sum(1 for i in inspections if i.status == "cancelled")

    if insp_ids:
        total_images = (
            db.scalar(
                select(func.count(InspectionImage.id)).where(
                    InspectionImage.inspection_id.in_(insp_ids)
                )
            )
            or 0
        )
        records = db.scalars(
            select(AnalysisRecord).where(
                AnalysisRecord.inspection_id.in_(insp_ids),
                AnalysisRecord.status == "ok",
            )
        ).all()
    else:
        total_images = 0
        records = []

    severity_breakdown = {}
    images_with_cracks = 0
    awaiting_review = 0
    severe_or_critical = 0

    for rec in records:
        eff_sev = rec.final_severity or rec.severity_category or NONE
        severity_breakdown[eff_sev] = severity_breakdown.get(eff_sev, 0) + 1
        if rec.crack_detected and rec.review_status != "rejected":
            images_with_cracks += 1
        if rec.review_status == "pending":
            awaiting_review += 1
        if eff_sev in SEVERE_CATEGORIES:
            severe_or_critical += 1

    return DashboardSummaryOut(
        role=user.role,
        total_assets=len(active_assets),
        total_inspections=len(inspections),
        planned_inspections=planned,
        in_progress_inspections=in_progress,
        completed_inspections=completed,
        cancelled_inspections=cancelled,
        total_images=total_images,
        analyzed_images=len(records),
        images_with_cracks=images_with_cracks,
        awaiting_review=awaiting_review,
        severe_or_critical_count=severe_or_critical,
        assets_by_type=assets_by_type,
        severity_breakdown=severity_breakdown,
    )


def get_map_assets(db: Session, user: User) -> List[MapAssetOut]:
    assets = db.scalars(
        select(Asset).where(Asset.is_active.is_(True)).order_by(Asset.id.desc())
    ).all()

    insp_conditions = []
    if user.role == Role.inspector.value:
        insp_conditions.append(
            or_(Inspection.assigned_to == user.id, Inspection.created_by == user.id)
        )
    inspections = db.scalars(
        select(Inspection).where(*insp_conditions).order_by(Inspection.id.desc())
    ).all()

    latest_insp_by_asset = {}
    for ins in inspections:
        if ins.asset_id not in latest_insp_by_asset:
            latest_insp_by_asset[ins.asset_id] = ins

    insp_ids = [ins.id for ins in latest_insp_by_asset.values()]
    records_by_insp = {}
    if insp_ids:
        for rec in db.scalars(
            select(AnalysisRecord).where(
                AnalysisRecord.inspection_id.in_(insp_ids),
                AnalysisRecord.status == "ok",
            )
        ).all():
            records_by_insp.setdefault(rec.inspection_id, []).append(rec)

    result: List[MapAssetOut] = []
    for asset in assets:
        latest_ins = latest_insp_by_asset.get(asset.id)
        latest_sev = "Not assessed"
        latest_prio = None
        if latest_ins:
            recs = records_by_insp.get(latest_ins.id, [])
            if recs:
                worst = max(
                    (r.final_severity or r.severity_category or NONE for r in recs),
                    key=lambda s: SEVERITY_ORDER.index(s) if s in SEVERITY_ORDER else 0,
                )
                latest_sev = worst
                latest_prio = PRIORITY_BY_SEVERITY.get(worst, (None, False))[0]

        result.append(
            MapAssetOut(
                id=asset.id,
                asset_code=asset.asset_code,
                name=asset.name,
                asset_type=asset.asset_type,
                location=asset.location,
                latitude=asset.latitude,
                longitude=asset.longitude,
                latest_inspection_id=latest_ins.id if latest_ins else None,
                latest_inspection_date=(
                    latest_ins.inspection_date or latest_ins.scheduled_date
                    if latest_ins
                    else None
                ),
                latest_severity=latest_sev,
                latest_priority=latest_prio,
            )
        )
    return result
