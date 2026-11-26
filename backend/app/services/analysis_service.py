"""Runs the AI pipeline for one uploaded image and prepares the answer for the API.
(Temporary endpoint /api/analyze. The saved results of inspections are in result_service.py.)"""
import threading
import uuid
from pathlib import Path

from ai import config as ai_config
from ai.pipeline import get_pipeline
from app.config import settings
from app.schemas.analysis import AnalyzeResponse

STORAGE = Path(settings.storage_dir).resolve()
STORAGE.mkdir(parents=True, exist_ok=True)

# The models handle one image at a time (simple and safe). Everything that runs the AI uses this lock.
pipeline_lock = threading.Lock()


class BadUpload(Exception):
    """The uploaded file cannot be analysed."""

    def __init__(self, message, status_code=400):
        super().__init__(message)
        self.status_code = status_code


def file_url(path):
    """Disk path -> URL below /files. None stays None."""
    if not path:
        return None
    relative = Path(path).resolve().relative_to(STORAGE)
    return "/files/" + relative.as_posix()


def analyze_upload(data: bytes, original_name: str, run=None) -> AnalyzeResponse:
    # ---- check the upload ----
    extension = Path(original_name).suffix.lower()
    if extension not in ai_config.ALLOWED_EXTENSIONS:
        allowed = ", ".join(sorted(ai_config.ALLOWED_EXTENSIONS))
        raise BadUpload(f"Unsupported file format '{extension}'. Allowed: {allowed}.")
    if not data:
        raise BadUpload("File is empty.")
    if len(data) > settings.max_upload_mb * 1024 * 1024:
        raise BadUpload(f"File is too large. Maximum is {settings.max_upload_mb} MB.", status_code=413)

    # ---- save it ----
    request_id = uuid.uuid4().hex
    upload_path = STORAGE / "uploads" / f"{request_id}{extension}"
    upload_path.parent.mkdir(parents=True, exist_ok=True)
    upload_path.write_bytes(data)

    # ---- run the AI ----
    try:
        with pipeline_lock:
            result = get_pipeline().analyze(
                upload_path, output_dir=STORAGE / "results" / request_id, name="image", run=run)
    except ValueError as error:                      # unknown step name in `run`
        raise BadUpload(str(error))

    # ---- prepare the answer: disk paths -> URLs ----
    response = AnalyzeResponse(
        **result.model_dump(),
        request_id=request_id,
        original_image_url=file_url(upload_path),
    )
    response.image_name = original_name
    if response.classification:
        response.classification.heatmap_path = file_url(response.classification.heatmap_path)
    if response.detection:
        response.detection.annotated_image_path = file_url(response.detection.annotated_image_path)
    if response.segmentation:
        response.segmentation.mask_path = file_url(response.segmentation.mask_path)
        response.segmentation.overlay_path = file_url(response.segmentation.overlay_path)
    return response