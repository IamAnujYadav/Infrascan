"""AI analysis of inspection photos, saved results, and the engineer's review."""
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Inspection, User
from app.schemas.analysis import AnalysisOut, AnalyzeRequest, AnalyzeStarted, InspectionResults, ReviewIn
from app.security.deps import get_current_user, require_roles
from app.security.roles import Role
from app.services import inspection_service, result_service

router = APIRouter(prefix="/api", tags=["analysis results"])

REVIEW_ROLES = (Role.admin, Role.manager, Role.civil_engineer)


def _load(db: Session, inspection_id: int, user: User) -> Inspection:
    inspection = inspection_service.get_inspection(db, inspection_id)
    if inspection is None:
        raise HTTPException(status_code=404, detail="Inspection not found.")
    if not inspection_service.can_view(user, inspection):
        raise HTTPException(status_code=403, detail="You can only see inspections assigned to you.")
    return inspection


@router.post("/inspections/{inspection_id}/analyze", response_model=AnalyzeStarted, status_code=202)
def start_analysis(inspection_id: int, background_tasks: BackgroundTasks, body: Optional[AnalyzeRequest] = None,
                   user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Start the AI analysis of the photos. It runs in the background (about 4 seconds per photo).
    Call GET /api/inspections/{id}/results every few seconds to see the progress."""
    inspection = _load(db, inspection_id, user)
    if not inspection_service.can_work(user, inspection):
        raise HTTPException(status_code=403, detail="Only the assigned inspector or a manager can start the analysis.")
    queued, skipped = result_service.queue_images(
        db, inspection, body.image_ids if body else None, body.force if body else False, user)
    if queued:
        background_tasks.add_task(result_service.run_batch, queued)
    message = f"{len(queued)} photo(s) are being analysed." if queued else "Nothing new to analyse."
    return AnalyzeStarted(inspection_id=inspection_id, queued=queued, skipped=skipped, message=message)


@router.get("/inspections/{inspection_id}/results", response_model=InspectionResults)
def inspection_results(inspection_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Every photo with its analysis, and a summary of the whole inspection."""
    _load(db, inspection_id, user)
    return result_service.get_results(db, inspection_id)


@router.get("/inspections/{inspection_id}/images/{image_id}/analysis", response_model=AnalysisOut)
def photo_analysis(inspection_id: int, image_id: int,
                   user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """The analysis of one photo (for the analysis screen)."""
    _load(db, inspection_id, user)
    row = result_service.get_row(db, inspection_id, image_id)
    if row is None:
        raise HTTPException(status_code=404, detail="This photo has not been analysed yet.")
    return result_service.analysis_out(row)


@router.put("/inspections/{inspection_id}/images/{image_id}/review", response_model=AnalysisOut)
def review_analysis(inspection_id: int, image_id: int, body: ReviewIn,
                    user: User = Depends(require_roles(*REVIEW_ROLES)), db: Session = Depends(get_db)):
    """The engineer confirms, changes or rejects the AI result."""
    inspection = _load(db, inspection_id, user)
    return result_service.review(db, inspection, image_id, body, user)