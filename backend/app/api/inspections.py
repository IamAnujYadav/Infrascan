"""Inspections and their photos (spec modules 2 and 3)."""
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Asset, Inspection, User
from app.schemas.inspection import (ImageOut, InspectionCreate, InspectionDetail, InspectionList, InspectionOut,
                                    InspectionStatus, InspectionUpdate)
from app.security.deps import get_current_user, require_roles
from app.security.roles import Role
from app.services import inspection_service as service

router = APIRouter(prefix="/api", tags=["inspections"])

CREATE_ROLES = (Role.admin, Role.manager, Role.civil_engineer, Role.inspector)


def _load(db: Session, inspection_id: int, user: User) -> Inspection:
    """Find the inspection and check that this user may see it."""
    inspection = service.get_inspection(db, inspection_id)
    if inspection is None:
        raise HTTPException(status_code=404, detail="Inspection not found.")
    if not service.can_view(user, inspection):
        raise HTTPException(status_code=403, detail="You can only see inspections assigned to you.")
    return inspection


@router.post("/inspections", response_model=InspectionOut, status_code=201)
def create_inspection(body: InspectionCreate, user: User = Depends(require_roles(*CREATE_ROLES)),
                      db: Session = Depends(get_db)):
    """Plan an inspection of an asset. Managers can choose the inspector.
    An inspector who creates one is assigned to it automatically."""
    return service.create_inspection(db, body, user)


@router.get("/inspections", response_model=InspectionList)
def list_inspections(
    asset_id: Optional[int] = None,
    status: Optional[InspectionStatus] = None,
    mine: bool = Query(False, description="Only inspections assigned to me"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    total, items = service.list_inspections(db, user, asset_id, status.value if status else None,
                                            mine, limit, offset)
    return InspectionList(total=total, items=items)


@router.get("/assets/{asset_id}/inspections", response_model=InspectionList)
def asset_history(asset_id: int, limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0),
                  user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Inspection history of one asset."""
    if db.get(Asset, asset_id) is None:
        raise HTTPException(status_code=404, detail="Asset not found.")
    total, items = service.list_inspections(db, user, asset_id, None, False, limit, offset)
    return InspectionList(total=total, items=items)


@router.get("/inspections/{inspection_id}", response_model=InspectionDetail)
def read_inspection(inspection_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _load(db, inspection_id, user)
    return service.get_detail(db, inspection_id)


@router.patch("/inspections/{inspection_id}", response_model=InspectionOut)
def update_inspection(inspection_id: int, body: InspectionUpdate,
                      user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Assign an inspector, set dates and notes, or move the status forward."""
    inspection = _load(db, inspection_id, user)
    changes = body.model_dump(exclude_unset=True)
    if changes.get("status") is None:
        changes.pop("status", None)
    if not changes:
        raise HTTPException(status_code=400, detail="Nothing to change.")
    return service.update_inspection(db, inspection, changes, user)


@router.post("/inspections/{inspection_id}/images", response_model=ImageOut, status_code=201)
def upload_image(
    inspection_id: int,
    file: UploadFile = File(..., description="Photo (jpg, jpeg or png)"),
    latitude: Optional[float] = Form(None, ge=-90, le=90, description="Where the photo was taken (optional)"),
    longitude: Optional[float] = Form(None, ge=-180, le=180),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add a photo. It is checked at once (format, size, blur, dark, duplicate).
    The `warnings` of the answer tell if the photo is not good."""
    inspection = _load(db, inspection_id, user)
    if not service.can_work(user, inspection):
        raise HTTPException(status_code=403, detail="Only the assigned inspector or a manager can add photos.")
    return service.add_image(db, inspection, file.file.read(), file.filename or "", latitude, longitude, user)


@router.delete("/inspections/{inspection_id}/images/{image_id}", status_code=204)
def remove_image(inspection_id: int, image_id: int,
                 user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    inspection = _load(db, inspection_id, user)
    if not service.can_work(user, inspection):
        raise HTTPException(status_code=403, detail="Only the assigned inspector or a manager can remove photos.")
    service.delete_image(db, inspection, image_id, user)


@router.delete("/inspections/{inspection_id}", status_code=204)
def delete_inspection(
    inspection_id: int,
    user: User = Depends(require_roles(Role.admin, Role.manager, Role.civil_engineer)),
    db: Session = Depends(get_db),
):
    """Delete an inspection and all its uploaded photos."""
    inspection = _load(db, inspection_id, user)
    service.delete_inspection(db, inspection, user)