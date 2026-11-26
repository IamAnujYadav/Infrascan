"""Business logic for infrastructure assets."""
import uuid
from typing import List, Optional, Tuple

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models import Asset, MaintenanceRecord, User
from app.schemas.asset import AssetCreate, AssetType, MaintenanceCreate
from app.services.auth_service import write_audit

CODE_PREFIX = {
    AssetType.building.value: "BLD",
    AssetType.bridge.value: "BRG",
    AssetType.road.value: "RD",
    AssetType.tunnel.value: "TUN",
    AssetType.dam.value: "DAM",
    AssetType.concrete_structure.value: "CON",
    AssetType.retaining_wall.value: "RW",
    AssetType.industrial_structure.value: "IND",
}


def create_asset(db: Session, data: AssetCreate, user: User) -> Asset:
    values = data.model_dump(exclude={"asset_code"})
    values["asset_type"] = data.asset_type.value
    values["inspection_frequency"] = data.inspection_frequency.value

    custom_code = data.asset_code.strip() if data.asset_code else None
    if custom_code and db.scalar(select(Asset).where(func.lower(Asset.asset_code) == custom_code.lower())):
        raise ValueError(f"The code {custom_code} is already used.")

    asset = Asset(**values, created_by=user.id, asset_code=custom_code or f"TMP-{uuid.uuid4().hex}")
    db.add(asset)
    try:
        db.flush()                                    # gives the asset its id
        if not custom_code:
            asset.asset_code = f"{CODE_PREFIX[asset.asset_type]}-{asset.id:04d}"
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ValueError("The code is already used.")
    db.refresh(asset)
    write_audit(db, user.id, "asset_created", f"asset={asset.asset_code}")
    return asset


def list_assets(db: Session, asset_type: Optional[str], search: Optional[str],
                include_archived: bool, limit: int, offset: int) -> Tuple[int, List[Asset]]:
    conditions = []
    if not include_archived:
        conditions.append(Asset.is_active.is_(True))
    if asset_type:
        conditions.append(Asset.asset_type == asset_type)
    if search and search.strip():
        like = f"%{search.strip()}%"
        conditions.append(or_(Asset.name.ilike(like), Asset.asset_code.ilike(like), Asset.location.ilike(like)))

    total = db.scalar(select(func.count()).select_from(Asset).where(*conditions)) or 0
    items = db.scalars(
        select(Asset).where(*conditions).order_by(Asset.id.desc()).limit(limit).offset(offset)
    ).all()
    return total, list(items)


def get_asset(db: Session, asset_id: int) -> Optional[Asset]:
    return db.get(Asset, asset_id)


def update_asset(db: Session, asset: Asset, changes: dict, user: User) -> Asset:
    for field, value in changes.items():
        if field in ("asset_type", "inspection_frequency") and value is not None:
            value = value.value
        setattr(asset, field, value)
    db.commit()
    db.refresh(asset)
    write_audit(db, user.id, "asset_updated", f"asset={asset.asset_code} fields={','.join(changes)}")
    return asset


def set_archived(db: Session, asset: Asset, archived: bool, user: User) -> Asset:
    asset.is_active = not archived
    db.commit()
    db.refresh(asset)
    write_audit(db, user.id, "asset_archived" if archived else "asset_restored", f"asset={asset.asset_code}")
    return asset


def add_maintenance(db: Session, asset: Asset, data: MaintenanceCreate, user: User) -> MaintenanceRecord:
    record = MaintenanceRecord(asset_id=asset.id, performed_on=data.performed_on,
                               description=data.description.strip(), recorded_by=user.id)
    db.add(record)
    db.commit()
    db.refresh(record)
    write_audit(db, user.id, "maintenance_added", f"asset={asset.asset_code}")
    return record


def list_maintenance(db: Session, asset_id: int) -> List[MaintenanceRecord]:
    return list(db.scalars(
        select(MaintenanceRecord).where(MaintenanceRecord.asset_id == asset_id)
        .order_by(MaintenanceRecord.performed_on.desc(), MaintenanceRecord.id.desc())
    ).all())