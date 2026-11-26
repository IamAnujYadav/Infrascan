"""Business logic for inspections and their images."""
import uuid
from datetime import date
from pathlib import Path
from typing import List, Optional, Tuple

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ai import config as ai_config
from ai.modules.quality.checks import file_hash, run_quality_checks
from app.config import settings
from app.db.models import AnalysisRecord, Asset, Inspection, InspectionImage, User
from app.schemas.inspection import (ALLOWED_TRANSITIONS, ImageOut, InspectionCreate, InspectionDetail,
                                    InspectionOut, InspectionStatus)
from app.security.roles import Role
from app.services.auth_service import write_audit
from app.services.errors import ServiceError
from app.services.storage_service import storage

MANAGE_ROLES = {Role.admin.value, Role.manager.value, Role.civil_engineer.value}
CLOSED = {InspectionStatus.completed.value, InspectionStatus.cancelled.value}


# ---------------------------------------------------------------- who may do what
def can_view(user: User, inspection: Inspection) -> bool:
    """An inspector sees only his own inspections. The other roles see all."""
    if user.role != Role.inspector.value:
        return True
    return user.id in (inspection.assigned_to, inspection.created_by)


def can_work(user: User, inspection: Inspection) -> bool:
    """Upload photos, change the status: managers and the assigned inspector."""
    return user.role in MANAGE_ROLES or inspection.assigned_to == user.id


# ---------------------------------------------------------------- reading
def _row_query():
    """One query gives the inspection, its asset, the inspector's name and the number of images."""
    image_count = (select(func.count(InspectionImage.id))
                   .where(InspectionImage.inspection_id == Inspection.id)
                   .correlate(Inspection).scalar_subquery())
    return (select(Inspection, Asset.asset_code, Asset.name, User.full_name, image_count)
            .join(Asset, Asset.id == Inspection.asset_id)
            .outerjoin(User, User.id == Inspection.assigned_to))


def _to_out(row) -> InspectionOut:
    inspection, asset_code, asset_name, inspector_name, image_count = row
    return InspectionOut(
        id=inspection.id, asset_id=inspection.asset_id, asset_code=asset_code, asset_name=asset_name,
        status=inspection.status, scheduled_date=inspection.scheduled_date,
        inspection_date=inspection.inspection_date, assigned_to=inspection.assigned_to,
        assigned_to_name=inspector_name, created_by=inspection.created_by, notes=inspection.notes,
        image_count=image_count or 0, created_at=inspection.created_at, updated_at=inspection.updated_at)


def get_inspection(db: Session, inspection_id: int) -> Optional[Inspection]:
    return db.get(Inspection, inspection_id)


def get_out(db: Session, inspection_id: int) -> Optional[InspectionOut]:
    row = db.execute(_row_query().where(Inspection.id == inspection_id)).first()
    return _to_out(row) if row else None


def image_out(image: InspectionImage) -> ImageOut:
    quality = image.quality or {}
    return ImageOut(
        id=image.id, inspection_id=image.inspection_id, original_name=image.original_name,
        url=storage.url(image.storage_key), width=image.width, height=image.height,
        latitude=image.latitude, longitude=image.longitude, warnings=quality.get("warnings", []),
        quality=quality, uploaded_by=image.uploaded_by, uploaded_at=image.uploaded_at)


def list_images(db: Session, inspection_id: int) -> List[ImageOut]:
    images = db.scalars(select(InspectionImage).where(InspectionImage.inspection_id == inspection_id)
                        .order_by(InspectionImage.id)).all()
    return [image_out(image) for image in images]


def get_detail(db: Session, inspection_id: int) -> Optional[InspectionDetail]:
    out = get_out(db, inspection_id)
    if out is None:
        return None
    return InspectionDetail(**out.model_dump(), images=list_images(db, inspection_id))


def list_inspections(db: Session, user: User, asset_id: Optional[int], status: Optional[str],
                     mine: bool, limit: int, offset: int) -> Tuple[int, List[InspectionOut]]:
    conditions = []
    if user.role == Role.inspector.value:
        conditions.append(or_(Inspection.assigned_to == user.id, Inspection.created_by == user.id))
    if mine:
        conditions.append(Inspection.assigned_to == user.id)
    if asset_id is not None:
        conditions.append(Inspection.asset_id == asset_id)
    if status:
        conditions.append(Inspection.status == status)

    total = db.scalar(select(func.count()).select_from(Inspection).where(*conditions)) or 0
    rows = db.execute(_row_query().where(*conditions).order_by(Inspection.id.desc())
                      .limit(limit).offset(offset)).all()
    return total, [_to_out(row) for row in rows]


# ---------------------------------------------------------------- writing
def _check_assignee(db: Session, user_id: int):
    person = db.get(User, user_id)
    if person is None or not person.is_active or person.role != Role.inspector.value:
        raise ServiceError("The assigned person must be an active Infrastructure Inspector.", 400)


def create_inspection(db: Session, data: InspectionCreate, user: User) -> InspectionOut:
    asset = db.get(Asset, data.asset_id)
    if asset is None:
        raise ServiceError("Asset not found.", 404)
    if not asset.is_active:
        raise ServiceError("This asset is archived.", 400)

    if user.role == Role.inspector.value:
        assigned_to = user.id                    # an inspector can only plan work for himself
    else:
        assigned_to = data.assigned_to
        if assigned_to is not None:
            _check_assignee(db, assigned_to)

    inspection = Inspection(asset_id=asset.id, scheduled_date=data.scheduled_date, assigned_to=assigned_to,
                            created_by=user.id, notes=data.notes.strip())
    db.add(inspection)
    db.commit()
    write_audit(db, user.id, "inspection_created", f"inspection={inspection.id} asset={asset.asset_code}")
    return get_out(db, inspection.id)


def update_inspection(db: Session, inspection: Inspection, changes: dict, user: User) -> InspectionOut:
    if inspection.status in CLOSED:
        raise ServiceError("A completed or cancelled inspection cannot be changed.", 409)

    if user.role not in MANAGE_ROLES:
        if inspection.assigned_to != user.id:
            raise ServiceError("This inspection is not assigned to you.", 403)
        if set(changes) - {"status", "notes"}:
            raise ServiceError("You can only change the status and the notes.", 403)
        if changes.get("status") == InspectionStatus.cancelled:
            raise ServiceError("Only a manager can cancel an inspection.", 403)

    if changes.get("assigned_to") is not None:
        _check_assignee(db, changes["assigned_to"])

    new_status = changes.pop("status", None)
    if new_status is not None and new_status.value != inspection.status:
        old_status = InspectionStatus(inspection.status)
        if new_status not in ALLOWED_TRANSITIONS[old_status]:
            raise ServiceError(f"A {old_status.value} inspection cannot become {new_status.value}.", 400)
        if new_status == InspectionStatus.completed:
            count = db.scalar(select(func.count(InspectionImage.id))
                              .where(InspectionImage.inspection_id == inspection.id))
            if not count:
                raise ServiceError("Upload at least one image before completing the inspection.", 400)
        if new_status in (InspectionStatus.in_progress, InspectionStatus.completed) \
                and inspection.inspection_date is None:
            inspection.inspection_date = date.today()
        inspection.status = new_status.value

    for field, value in changes.items():
        setattr(inspection, field, value.strip() if field == "notes" and value is not None else value)
    db.commit()
    write_audit(db, user.id, "inspection_updated",
                f"inspection={inspection.id} status={inspection.status} assigned_to={inspection.assigned_to}")
    return get_out(db, inspection.id)


# ---------------------------------------------------------------- images
def add_image(db: Session, inspection: Inspection, data: bytes, filename: str,
              latitude: Optional[float], longitude: Optional[float], user: User) -> ImageOut:
    if inspection.status in CLOSED:
        raise ServiceError("Photos cannot be added to a completed or cancelled inspection.", 409)

    extension = Path(filename).suffix.lower()
    if extension not in ai_config.ALLOWED_EXTENSIONS:
        allowed = ", ".join(sorted(ai_config.ALLOWED_EXTENSIONS))
        raise ServiceError(f"Unsupported file format '{extension}'. Allowed: {allowed}.", 400)
    if not data:
        raise ServiceError("File is empty.", 400)
    if len(data) > settings.max_upload_mb * 1024 * 1024:
        raise ServiceError(f"File is too large. Maximum is {settings.max_upload_mb} MB.", 413)

    key = f"inspections/{inspection.id}/{uuid.uuid4().hex}{extension}"
    storage.save(key, data)
    path = storage.local_path(key)
    try:
        digest = file_hash(path)
        same_inspection = db.scalar(select(func.count(InspectionImage.id)).where(
            InspectionImage.inspection_id == inspection.id, InspectionImage.file_hash == digest))
        if same_inspection:
            raise ServiceError("This photo is already in this inspection.", 409)

        # photos of the same asset from other inspections: allowed, but flagged as duplicate
        asset_hashes = set(db.scalars(
            select(InspectionImage.file_hash).join(Inspection, Inspection.id == InspectionImage.inspection_id)
            .where(Inspection.asset_id == inspection.asset_id)).all())

        report, _ = run_quality_checks(path, known_hashes=asset_hashes)
        if not report.passed:
            raise ServiceError(" ".join(report.errors), 422)
    except Exception:
        storage.delete(key)                       # never keep a rejected file
        raise

    image = InspectionImage(
        inspection_id=inspection.id, storage_key=key, original_name=filename[:255], file_hash=digest,
        width=report.metrics.get("width"), height=report.metrics.get("height"),
        latitude=latitude, longitude=longitude,
        quality={"warnings": report.warnings, "metrics": report.metrics}, uploaded_by=user.id)
    db.add(image)

    if inspection.status == InspectionStatus.planned.value:
        inspection.status = InspectionStatus.in_progress.value
    if inspection.inspection_date is None:
        inspection.inspection_date = date.today()
    db.commit()
    db.refresh(image)
    write_audit(db, user.id, "image_uploaded", f"inspection={inspection.id} image={image.id}")
    return image_out(image)


def delete_image(db: Session, inspection: Inspection, image_id: int, user: User):
    if inspection.status in CLOSED:
        raise ServiceError("Photos of a completed or cancelled inspection cannot be removed.", 409)
    image = db.get(InspectionImage, image_id)
    if image is None or image.inspection_id != inspection.id:
        raise ServiceError("Image not found.", 404)
    key = image.storage_key
    db.delete(image)
    db.commit()
    storage.delete(key)
    write_audit(db, user.id, "image_deleted", f"inspection={inspection.id} image={image_id}")


def delete_inspection(db: Session, inspection: Inspection, user: User):
    if user.role not in MANAGE_ROLES:
        raise ServiceError(
            "Only an administrator, manager, or civil engineer can delete an inspection.",
            403,
        )

    inspection_id = inspection.id

    # 1. Collect storage keys before deleting rows
    keys = list(
        db.scalars(
            select(InspectionImage.storage_key).where(
                InspectionImage.inspection_id == inspection_id
            )
        ).all()
    )

    # 2. Delete child rows in strict foreign-key order
    db.query(AnalysisRecord).filter(
        AnalysisRecord.inspection_id == inspection_id
    ).delete(synchronize_session=False)
    db.flush()

    db.query(InspectionImage).filter(
        InspectionImage.inspection_id == inspection_id
    ).delete(synchronize_session=False)
    db.flush()

    # 3. Delete parent inspection row
    db.query(Inspection).filter(Inspection.id == inspection_id).delete(
        synchronize_session=False
    )
    db.commit()

    # 4. Remove uploaded files from local storage
    for key in keys:
        storage.delete(key)

    write_audit(db, user.id, "inspection_deleted", f"inspection={inspection_id}")