"""Find out why the server does not start.
Run from the project root (venv active):   python -m scripts.diagnose"""
import importlib
import importlib.util
import socket
import sys
import traceback
from pathlib import Path

problems = []


def ok(text):
    print("  OK     " + text)


def bad(text, hint=""):
    print("  FAIL   " + text)
    if hint:
        print("         -> " + hint)
    problems.append(text)


def warn(text):
    print("  WARN   " + text)


# ------------------------------------------------------------------ 1. environment
print("1. Environment")
ok(f"Python {sys.version.split()[0]}")
if sys.prefix != getattr(sys, "base_prefix", sys.prefix):
    ok("virtual environment is active")
else:
    bad("virtual environment is NOT active", "run:  venv\\Scripts\\activate")
if Path("app").is_dir() and Path("ai").is_dir():
    ok("running from the project root")
else:
    bad("this is not the project root folder", "cd into the folder that contains app\\ and ai\\")

# ------------------------------------------------------------------ 2. files
print("\n2. Files")
REQUIRED = """
ai/config.py ai/pipeline.py ai/core/schemas.py ai/core/base.py ai/core/registry.py
ai/modules/quality/checks.py ai/modules/classification/predictor.py ai/modules/classification/explain.py
ai/modules/detection/predictor.py ai/modules/segmentation/predictor.py ai/modules/segmentation/postprocess.py
ai/modules/geometry/measure.py ai/modules/severity/rules.py ai/modules/priority/rules.py
app/main.py app/config.py
app/api/analysis.py app/api/assets.py app/api/auth.py app/api/inspections.py app/api/models.py
app/api/results.py app/api/users.py
app/db/database.py app/db/models.py
app/schemas/analysis.py app/schemas/asset.py app/schemas/auth.py app/schemas/inspection.py
app/security/deps.py app/security/passwords.py app/security/roles.py app/security/tokens.py
app/services/analysis_service.py app/services/asset_service.py app/services/auth_service.py
app/services/errors.py app/services/inspection_service.py app/services/result_service.py
app/services/storage_service.py
""".split()
missing = [name for name in REQUIRED if not Path(name).is_file()]
tiny = [name for name in REQUIRED if Path(name).is_file() and Path(name).stat().st_size < 150]
if missing:
    for name in missing:
        bad(f"file is missing: {name}", "create it with the code from the chat")
if tiny:
    for name in tiny:
        bad(f"file is almost empty (only the placeholder): {name}", "paste the code from the chat into it")
if not missing and not tiny:
    ok(f"all {len(REQUIRED)} code files are there")
for name in ["resnet50_crack_B_finetuned.keras", "unet_resnet50_crack500.keras", "best.pt"]:
    if Path("ai/weights", name).is_file():
        ok(f"model file: {name}")
    else:
        bad(f"model file is missing: ai/weights/{name}")

# ------------------------------------------------------------------ 3. packages
print("\n3. Packages")
PACKAGES = {"fastapi": "fastapi", "uvicorn": "uvicorn", "sqlalchemy": "sqlalchemy", "psycopg": 'psycopg[binary]',
            "jwt": "pyjwt", "bcrypt": "bcrypt", "pydantic_settings": "pydantic-settings", "pydantic": "pydantic",
            "cv2": "opencv-python", "numpy": "numpy", "PIL": "pillow", "skimage": "scikit-image",
            "tensorflow": "tensorflow", "ultralytics": "ultralytics"}
for module, pip_name in PACKAGES.items():
    if importlib.util.find_spec(module) is not None:
        ok(module)
    else:
        bad(f"package is not installed: {module}", f'pip install "{pip_name}"')
if importlib.util.find_spec("python_multipart") is None and importlib.util.find_spec("multipart") is None:
    bad("package is not installed: python-multipart", "pip install python-multipart")
else:
    ok("python-multipart")

# ------------------------------------------------------------------ 4. settings (.env)
print("\n4. Settings (.env)")
if not Path(".env").is_file():
    warn(".env file not found (the defaults are used)")
settings = None
try:
    from app.config import settings
    ok("settings can be read")
except Exception as error:
    bad(f"settings could not be read: {error}", "check the lines of the .env file (NAME=value, no spaces around =)")

if settings is not None:
    url = settings.database_url
    if url.startswith("sqlite"):
        warn("DATABASE_URL points to a local SQLite file, not to Neon")
    else:
        ok("DATABASE_URL is set (Neon / PostgreSQL)")
    if settings.secret_key.startswith("change-this") or len(settings.secret_key) < 32:
        warn("SECRET_KEY is the default or shorter than 32 characters")
    else:
        ok("SECRET_KEY is set")
    if settings.admin_email and settings.admin_password:
        ok("ADMIN_EMAIL and ADMIN_PASSWORD are set")
    else:
        warn("ADMIN_EMAIL / ADMIN_PASSWORD are not set, so no administrator is created")
    ok(f"REQUIRE_LOGIN = {settings.require_login}")

# ------------------------------------------------------------------ 5. the app code
print("\n5. Loading the application code")
MODULES = ["app.db.database", "app.db.models", "app.security.deps", "app.schemas.analysis", "app.schemas.asset",
           "app.schemas.inspection", "app.services.result_service", "app.api.auth", "app.api.users",
           "app.api.assets", "app.api.inspections", "app.api.results", "app.api.analysis", "app.main"]
app_ok = True
for name in MODULES:
    try:
        importlib.import_module(name)
        ok(name)
    except Exception:
        app_ok = False
        bad(f"{name} cannot be loaded. The error is:")
        print("".join("         | " + line for line in traceback.format_exc().splitlines(keepends=True)[-8:]))
        break

# ------------------------------------------------------------------ 6. database
print("\n6. Database")
if app_ok:
    try:
        from sqlalchemy import text
        from app.db.database import engine
        print("  using:  " + engine.url.render_as_string(hide_password=True))
        with engine.connect() as connection:
            connection.execute(text("select 1"))
        ok("connected to the database")
    except Exception as error:
        bad(f"cannot connect to the database: {str(error).splitlines()[0][:150]}",
            "check the internet, the DATABASE_URL in .env and that the Neon project is not deleted")
else:
    warn("skipped (the app code could not be loaded)")

# ------------------------------------------------------------------ 7. port
print("\n7. Port 8000")
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
try:
    sock.bind(("0.0.0.0", 8000))
    ok("port 8000 is free")
except OSError:
    bad("port 8000 is already in use (an old server is probably still running)",
        "find it:  netstat -ano | findstr :8000   then stop it:  taskkill /PID <number> /F   (or use --port 8001)")
finally:
    sock.close()

# ------------------------------------------------------------------ result
print()
if problems:
    print(f"{len(problems)} problem(s) found. Fix the FAIL lines above, from the top, then start the server again.")
else:
    print("No problem found. Start the server:")
    print("    uvicorn app.main:app --host 0.0.0.0 --port 8000")
    print("If it still stops, copy the COMPLETE text that the server prints and send it.")