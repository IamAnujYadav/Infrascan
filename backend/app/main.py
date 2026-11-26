import os
import urllib.request
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

# IMPORTANT: the database module must be imported BEFORE the ai package. It loads the PostgreSQL
# driver, and on Linux (Docker) that driver crashes if TensorFlow was loaded before it.
from app.db.database import SessionLocal, init_db  # isort: skip
from ai import config as ai_config
from ai.pipeline import get_pipeline
from app.api import analysis, assets, auth, dashboard, inspections, models, reports, results, users
from app.config import settings
from app.services import result_service
from app.services.analysis_service import STORAGE
from app.services.auth_service import seed_admin
from app.services.errors import ServiceError

DEFAULT_RESNET_URL = "https://huggingface.co/Iamanujyadav/infrascan-weights/resolve/main/resnet50_crack_B_finetuned.keras"
DEFAULT_UNET_URL = "https://huggingface.co/Iamanujyadav/infrascan-weights/resolve/main/unet_resnet50_crack500.keras"


def ensure_model_weights() -> None:
    """Download missing .keras model weights from Hugging Face on cloud startup."""
    weights_dir = Path(__file__).resolve().parents[1] / "ai" / "weights"
    weights_dir.mkdir(parents=True, exist_ok=True)

    models = {
        "resnet50_crack_B_finetuned.keras": os.getenv("RESNET_WEIGHTS_URL", DEFAULT_RESNET_URL),
        "unet_resnet50_crack500.keras": os.getenv("UNET_WEIGHTS_URL", DEFAULT_UNET_URL),
    }

    for filename, url in models.items():
        target_path = weights_dir / filename
        if not target_path.exists() and url:
            print(f"[InfraScan] Downloading {filename} from Hugging Face...")
            urllib.request.urlretrieve(url, target_path)
            size_mb = target_path.stat().st_size / (1024 * 1024)
            print(f"[InfraScan] Saved {filename} ({size_mb:.1f} MB)")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()                                    # create the tables
    with SessionLocal() as db:
        seed_admin(db)                           # first administrator from .env
        result_service.fail_stale(db)            # analyses cut off by the last restart
    if settings.secret_key.startswith("change-this"):
        print("WARNING: SECRET_KEY in .env is still the default. Set your own long random text.")
    ensure_model_weights()                       # download .keras weights if missing on server
    get_pipeline().load()                        # load the AI models once, when the server starts
    yield


app = FastAPI(
    title="InfraScan API",
    description="AI-powered crack and damage assessment for civil infrastructure.",
    version=ai_config.PIPELINE_VERSION,
    lifespan=lifespan,
)

# CORS: the browser of the frontend developer must be allowed to call this API
if "*" in settings.cors_origin_list:
    app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
else:
    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origin_list,
                       allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


@app.exception_handler(ServiceError)
async def service_error_handler(request: Request, error: ServiceError):
    """Errors raised by the services become normal answers like {"detail": "..."}."""
    return JSONResponse(status_code=error.status_code, content={"detail": str(error)})


# result images (mask, overlay, boxes, heatmap) and photos are served from here
app.mount("/files", StaticFiles(directory=STORAGE), name="files")

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(assets.router)
app.include_router(inspections.router)
app.include_router(results.router)
app.include_router(analysis.router)
app.include_router(models.router)
app.include_router(dashboard.router)
app.include_router(reports.router)


@app.get("/api/health", tags=["system"])
def health():
    models_info = get_pipeline().models_info()
    return {
        "status": "ok",
        "version": ai_config.PIPELINE_VERSION,
        "models_loaded": all(m["loaded"] for m in models_info),
    }