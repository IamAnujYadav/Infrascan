"""End-to-end check against the RUNNING server, with your real models and your photos in images/.

1. Start the server in one terminal:   uvicorn app.main:app --host 0.0.0.0 --port 8000
2. In another terminal:                python -m scripts.smoke_test
   (another address:                   python -m scripts.smoke_test https://xxxx.trycloudflare.com)

It logs in as the administrator from your .env, makes a test asset and inspection, uploads up to
3 photos from images/, runs the AI, reads the results, reviews one photo and saves the result
images to test_outputs/smoke/ . The test asset is archived at the end."""
import sys
import time
from datetime import datetime
from pathlib import Path

import httpx

from ai import config as ai_config
from app.config import settings

BASE = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else "http://localhost:8000"
OUT = Path("test_outputs/smoke")
client = httpx.Client(base_url=BASE, timeout=120)
step = 0


def title(text):
    global step
    step += 1
    print(f"\n[{step}] {text}")


def ok(text):
    print("    OK    " + text)


def fail(text, hint=""):
    print("    FAIL  " + text)
    if hint:
        print("          -> " + hint)
    sys.exit(1)


def expect(response, status, what):
    if response.status_code != status:
        fail(f"{what}: expected {status}, got {response.status_code}: {response.text[:300]}")


# ---------------------------------------------------------------- 1. server
title("Server")
try:
    health = client.get("/api/health")
except httpx.HTTPError as error:
    fail(f"cannot reach {BASE}: {error}", "start the server first (uvicorn app.main:app --host 0.0.0.0 --port 8000)")
expect(health, 200, "health")
if not health.json()["models_loaded"]:
    fail("the AI models are not loaded")
ok(f"{BASE} is up, version {health.json()['version']}, models loaded")
models = client.get("/api/models").json()
ok("models: " + ", ".join(f"{m['name']} {m['version']}" for m in models))

# ---------------------------------------------------------------- 2. login
title("Login as administrator (from .env)")
if not settings.admin_email or not settings.admin_password:
    fail("ADMIN_EMAIL / ADMIN_PASSWORD are not in .env")
login = client.post("/api/auth/login", json={"email": settings.admin_email, "password": settings.admin_password})
if login.status_code == 401:
    fail("login failed", "the administrator is created when the server starts. Check ADMIN_EMAIL / ADMIN_PASSWORD "
                         "in .env, then restart the server")
expect(login, 200, "login")
HEADERS = {"Authorization": "Bearer " + login.json()["access_token"]}
ok(f"logged in as {login.json()['user']['email']} ({login.json()['user']['role']})")
expect(client.get("/api/users/me", headers=HEADERS), 200, "users/me")
expect(client.get("/api/users/me"), 401, "users/me without token")
ok("a request without a token is refused (401)")

# ---------------------------------------------------------------- 3. asset and inspection
title("Asset and inspection")
stamp = datetime.now().strftime("%H%M%S")
asset = client.post("/api/assets", headers=HEADERS, json={
    "name": f"Smoke Test Bridge {stamp}", "asset_type": "bridge", "location": "Test", "latitude": 26.9, "longitude": 75.8})
expect(asset, 201, "create asset")
asset = asset.json()
ok(f"asset {asset['asset_code']} created")
inspection = client.post("/api/inspections", headers=HEADERS, json={"asset_id": asset["id"], "notes": "smoke test"})
expect(inspection, 201, "create inspection")
INSPECTION = inspection.json()["id"]
ok(f"inspection {INSPECTION} created, status {inspection.json()['status']}")

# ---------------------------------------------------------------- 4. photos
title("Upload photos from images/")
files = sorted(p for p in Path("images").glob("*") if p.suffix.lower() in ai_config.ALLOWED_EXTENSIONS)[:3]
if not files:
    fail("there is no photo in the images/ folder")
IMAGE_IDS = {}
for path in files:
    response = client.post(f"/api/inspections/{INSPECTION}/images", headers=HEADERS,
                           files={"file": (path.name, path.read_bytes(), "image/jpeg")})
    expect(response, 201, f"upload {path.name}")
    body = response.json()
    IMAGE_IDS[body["id"]] = path.name
    ok(f"{path.name}: {body['width']}x{body['height']}, warnings: {body['warnings'] or 'none'}")
detail = client.get(f"/api/inspections/{INSPECTION}", headers=HEADERS).json()
ok(f"inspection is now '{detail['status']}' with {detail['image_count']} photo(s)")

# ---------------------------------------------------------------- 5. analysis
title("AI analysis (runs in the background)")
started = client.post(f"/api/inspections/{INSPECTION}/analyze", headers=HEADERS)
expect(started, 202, "start analysis")
ok(started.json()["message"])
t0 = time.time()
while True:
    data = client.get(f"/api/inspections/{INSPECTION}/results", headers=HEADERS).json()
    summary = data["summary"]
    print(f"    ...    {summary['analyzed']}/{summary['total_images']} done, {summary['in_queue']} waiting "
          f"({time.time() - t0:.0f} s)")
    if summary["in_queue"] == 0:
        break
    if time.time() - t0 > 240:
        fail("the analysis did not finish in 4 minutes")
    time.sleep(3)

print("\n    Photo                  status  crack  found by                          severity              priority")
for item in data["items"]:
    a = item["analysis"]
    name = IMAGE_IDS.get(item["image"]["id"], "?")
    print(f"    {name:22s} {a['status']:7s} {str(a['crack_detected']):6s} {','.join(a['result']['evidence']) if a['result'] else '-':33s} "
          f"{str(a['effective_severity']):21s} {a['effective_priority']}")
    if a["status"] != "ok":
        print("          error: " + a["error"])
        fail(f"the analysis of {name} did not finish well")
    for warning in a["result"]["warnings"]:
        print("          warning: " + warning)
ok("every photo has a result")

# ---------------------------------------------------------------- 6. result images
title("Result images (saved to test_outputs/smoke/)")
OUT.mkdir(parents=True, exist_ok=True)
first = data["items"][0]["analysis"]
result = first["result"]
images = {
    "gradcam": result["classification"] and result["classification"]["heatmap_path"],
    "boxes": result["detection"] and result["detection"]["annotated_image_path"],
    "mask": result["segmentation"] and result["segmentation"]["mask_path"],
    "overlay": result["segmentation"] and result["segmentation"]["overlay_path"],
}
for label, url in images.items():
    if not url:
        fail(f"{label}: this part of the result is missing")
    got = client.get(url)
    if got.status_code != 200 or not got.headers["content-type"].startswith("image/"):
        fail(f"{label}: {url} cannot be downloaded ({got.status_code})")
    target = OUT / f"{IMAGE_IDS[first['image_id']].rsplit('.', 1)[0]}_{label}.jpg"
    target.write_bytes(got.content)
    ok(f"{label:8s} -> {target}")

# ---------------------------------------------------------------- 7. review
title("Engineer review")
review = client.put(f"/api/inspections/{INSPECTION}/images/{first['image_id']}/review", headers=HEADERS,
                    json={"decision": "confirmed"})
expect(review, 200, "review")
ok(f"review_status = {review.json()['review_status']}, effective severity = {review.json()['effective_severity']}")
summary = client.get(f"/api/inspections/{INSPECTION}/results", headers=HEADERS).json()["summary"]
ok(f"inspection summary: overall severity = {summary['overall_severity']}, priority = {summary['overall_priority']}, "
   f"reviewed {summary['reviewed']}/{summary['analyzed']}")

# ---------------------------------------------------------------- 8. clean up
title("Clean up")
expect(client.delete(f"/api/assets/{asset['id']}", headers=HEADERS), 200, "archive the test asset")
ok(f"test asset {asset['asset_code']} is archived (it stays in the database, but it is hidden)")

print("\nALL STEPS PASSED. The backend works end to end with your real models.")
print("Please send me the images in test_outputs/smoke/ (especially the *_gradcam.jpg).")