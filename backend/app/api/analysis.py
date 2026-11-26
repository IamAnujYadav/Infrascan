"""Analysis endpoint. TEMPORARY version: not saved in a database yet.
It is open for everyone while REQUIRE_LOGIN=false (.env). Phase 3 moves it under an inspection."""
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile

from app.db.models import User
from app.schemas.analysis import AnalyzeResponse
from app.security.deps import optional_login
from app.services import analysis_service

router = APIRouter(prefix="/api", tags=["analysis"])


@router.post("/analyze", response_model=AnalyzeResponse)
def analyze(
    file: UploadFile = File(..., description="Photo of the structure (jpg, jpeg or png)"),
    run: Optional[List[str]] = Query(
        None,
        description="Optional. Only these checks: classification, detection, segmentation, geometry, severity. "
                    "Leave empty for the full analysis."),
    user: Optional[User] = Depends(optional_login),
):
    """Upload one image and get the full inspection result."""
    data = file.file.read()
    try:
        return analysis_service.analyze_upload(data, file.filename or "", run)
    except analysis_service.BadUpload as error:
        raise HTTPException(status_code=error.status_code, detail=str(error))