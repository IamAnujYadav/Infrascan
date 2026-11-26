"""Router: structured inspection reports in JSON and CSV formats (Phase 4)."""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import User
from app.schemas.report import InspectionReportOut
from app.security.deps import get_current_user
from app.services import inspection_service, report_service

router = APIRouter(prefix="/api", tags=["reports"])


def _check_access(db: Session, inspection_id: int, user: User):
    inspection = inspection_service.get_inspection(db, inspection_id)
    if inspection is None:
        raise HTTPException(status_code=404, detail="Inspection not found.")
    if not inspection_service.can_view(user, inspection):
        raise HTTPException(status_code=403, detail="You can only see inspections assigned to you.")


@router.get("/inspections/{inspection_id}/report", response_model=InspectionReportOut)
def get_inspection_report(
    inspection_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Full structured inspection report (JSON)."""
    _check_access(db, inspection_id, user)
    return report_service.build_inspection_report(db, inspection_id)


@router.get("/inspections/{inspection_id}/report.csv")
def download_inspection_report_csv(
    inspection_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Download inspection report as a CSV file."""
    _check_access(db, inspection_id, user)
    report = report_service.build_inspection_report(db, inspection_id)
    csv_text = report_service.report_to_csv(report)
    return Response(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="inspection_{inspection_id}_report.csv"'},
    )
