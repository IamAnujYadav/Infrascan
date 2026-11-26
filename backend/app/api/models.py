"""Which AI models are deployed (spec module 21)."""
from fastapi import APIRouter

from ai.pipeline import get_pipeline

router = APIRouter(prefix="/api", tags=["models"])


@router.get("/models")
def list_models():
    """Name, version, weights file and loaded status of every AI model."""
    return get_pipeline().models_info()