"""Router: dashboard statistics and map asset severity data (Phase 4)."""
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import User
from app.schemas.report import DashboardSummaryOut, MapAssetOut
from app.security.deps import get_current_user
from app.services import dashboard_service

router = APIRouter(prefix="/api", tags=["dashboard"])


@router.get("/dashboard/summary", response_model=DashboardSummaryOut)
def dashboard_summary(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Summary counts for the dashboard cards and charts."""
    return dashboard_service.get_dashboard_summary(db, user)


@router.get("/dashboard/map", response_model=List[MapAssetOut])
def dashboard_map(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Active assets with their GPS coordinates and latest inspection severity."""
    return dashboard_service.get_map_assets(db, user)
