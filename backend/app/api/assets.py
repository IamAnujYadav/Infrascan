"""Infrastructure assets (spec module 2)."""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Asset, User
from app.schemas.asset import (ASSET_TYPE_LABELS, FREQUENCY_LABELS, AssetCreate, AssetList, AssetOut,
                               AssetType, AssetUpdate, MaintenanceCreate, MaintenanceOut)
from app.security.deps import get_current_user, require_roles
from app.security.roles import Role
from app.services import asset_service

router = APIRouter(prefix="/api", tags=["assets"])

# who may do what (provisional, to be agreed with the team)
EDIT_ROLES = (Role.admin, Role.manager, Role.civil_engineer)
ARCHIVE_ROLES = (Role.admin, Role.manager)
MAINTENANCE_ROLES = (Role.admin, Role.manager, Role.civil_engineer, Role.maintenance_engineer)


def _get_or_404(db: Session, asset_id: int) -> Asset:
    asset = asset_service.get_asset(db, asset_id)
    if asset is None:
        raise HTTPException(status_code=404, detail="Asset not found.")
    return asset


@router.get("/asset-options")
def asset_options(user: User = Depends(get_current_user)):
    """Values for the dropdowns of the asset form."""
    return {
        "asset_types": [{"value": t.value, "label": label} for t, label in ASSET_TYPE_LABELS.items()],
        "inspection_frequencies": [{"value": f.value, "label": label} for f, label in FREQUENCY_LABELS.items()],
    }


@router.post("/assets", response_model=AssetOut, status_code=201)
def create_asset(body: AssetCreate, user: User = Depends(require_roles(*EDIT_ROLES)), db: Session = Depends(get_db)):
    try:
        return asset_service.create_asset(db, body, user)
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error))


@router.get("/assets", response_model=AssetList)
def list_assets(
    asset_type: Optional[AssetType] = Query(None, alias="type"),
    search: Optional[str] = Query(None, max_length=100, description="Part of the name, code or location"),
    include_archived: bool = False,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if include_archived and user.role not in {r.value for r in ARCHIVE_ROLES}:
        raise HTTPException(status_code=403, detail="Only a manager or administrator can see archived assets.")
    total, items = asset_service.list_assets(
        db, asset_type.value if asset_type else None, search, include_archived, limit, offset)
    return AssetList(total=total, items=items)


@router.get("/assets/{asset_id}", response_model=AssetOut)
def read_asset(asset_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _get_or_404(db, asset_id)


@router.patch("/assets/{asset_id}", response_model=AssetOut)
def update_asset(asset_id: int, body: AssetUpdate,
                 user: User = Depends(require_roles(*EDIT_ROLES)), db: Session = Depends(get_db)):
    asset = _get_or_404(db, asset_id)
    changes = body.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=400, detail="Nothing to change.")
    return asset_service.update_asset(db, asset, changes, user)


@router.delete("/assets/{asset_id}", response_model=AssetOut)
def archive_asset(asset_id: int, user: User = Depends(require_roles(*ARCHIVE_ROLES)), db: Session = Depends(get_db)):
    """Assets are archived, not erased, because inspections will refer to them."""
    return asset_service.set_archived(db, _get_or_404(db, asset_id), True, user)


@router.post("/assets/{asset_id}/restore", response_model=AssetOut)
def restore_asset(asset_id: int, user: User = Depends(require_roles(*ARCHIVE_ROLES)), db: Session = Depends(get_db)):
    return asset_service.set_archived(db, _get_or_404(db, asset_id), False, user)


@router.post("/assets/{asset_id}/maintenance", response_model=MaintenanceOut, status_code=201)
def add_maintenance(asset_id: int, body: MaintenanceCreate,
                    user: User = Depends(require_roles(*MAINTENANCE_ROLES)), db: Session = Depends(get_db)):
    return asset_service.add_maintenance(db, _get_or_404(db, asset_id), body, user)


@router.get("/assets/{asset_id}/maintenance", response_model=List[MaintenanceOut])
def list_maintenance(asset_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _get_or_404(db, asset_id)
    return asset_service.list_maintenance(db, asset_id)