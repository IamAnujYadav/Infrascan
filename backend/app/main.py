"""InfraScan API. Run from the project root:
    uvicorn app.main:app --host 0.0.0.0 --port 8000
Then open http://localhost:8000/docs"""
from contextlib import asynccontextmanager

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


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()                                    # create the tables
    with SessionLocal() as db:
        seed_admin(db)                           # first administrator from .env
        result_service.fail_stale(db)            # analyses cut off by the last restart
    if settings.secret_key.startswith("change-this"):
        print("WARNING: SECRET_KEY in .env is still the default. Set your own long random text.")
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