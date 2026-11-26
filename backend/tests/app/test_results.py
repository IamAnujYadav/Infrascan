"""Results test. Run from project root:  python -m tests.app.test_results
Uses a separate test database, a temporary storage folder and FAKE AI models (so it is quick
and needs no real model). It tests the saving, the background analysis and the engineer review."""
import os
import tempfile
from pathlib import Path

# these must be set BEFORE the app is imported
TEMP_STORAGE = tempfile.mkdtemp(prefix="infrascan_test_storage_")
os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL", "sqlite:///./test_results.db")
os.environ["STORAGE_DIR"] = TEMP_STORAGE
os.environ["ADMIN_EMAIL"] = "admin@test.com"
os.environ["ADMIN_PASSWORD"] = "Admin#12345"
os.environ["REQUIRE_LOGIN"] = "false"
Path("test_results.db").unlink(missing_ok=True)

import cv2
import numpy as np
from fastapi.testclient import TestClient

import app.db.models  # noqa: F401  (registers the tables; must come BEFORE ai.pipeline, see app/main.py)
import ai.pipeline as pipeline_module
from ai.core import registry
from ai.core.base import BaseModule
from ai.core.schemas import ClassificationResult, DetectionBox, DetectionResult, SegmentationResult
from app.db.database import Base, SessionLocal, engine, init_db
from app.db.models import AnalysisRecord
from app.main import app
from app.services import result_service
from app.services.auth_service import seed_admin


# ---------------------------------------------------------------- fake AI models
class FakeClassifier(BaseModule):
    name = "classification"
    fail = False

    def _load(self):
        pass

    def predict(self, image):
        if self.fail:
            raise RuntimeError("classifier broke")
        return ClassificationResult(label="CRACK", crack_probability=0.97, model_version="v1.0")

    def explain(self, image, out_path):
        Path(out_path).parent.mkdir(parents=True, exist_ok=True)
        cv2.imwrite(str(out_path), image)
        return str(out_path)


class FakeDetector(BaseModule):
    name = "detection"
    fail = False

    def _load(self):
        pass

    def predict(self, image, annotated_path=None):
        if self.fail:
            raise RuntimeError("detector broke")
        Path(annotated_path).parent.mkdir(parents=True, exist_ok=True)
        cv2.imwrite(str(annotated_path), image)
        box = DetectionBox(class_name="longitudinal_crack", confidence=0.8, bbox=[1, 2, 3, 4])
        return DetectionResult(count=1, boxes=[box], annotated_image_path=str(annotated_path), model_version="v1.1")


class FakeSegmenter(BaseModule):
    name = "segmentation"
    fail = False

    def _load(self):
        pass

    def predict(self, image, mask_path=None, overlay_path=None):
        if self.fail:
            raise RuntimeError("segmenter broke")
        h, w = image.shape[:2]
        mask = np.zeros((h, w), np.uint8)
        cv2.line(mask, (20, h // 2), (w - 20, h // 2 + 40), 1, 4)
        for path in (mask_path, overlay_path):
            Path(path).parent.mkdir(parents=True, exist_ok=True)
            cv2.imwrite(str(path), mask * 255)
        result = SegmentationResult(crack_area_percent=1.0, mask_path=str(mask_path),
                                    overlay_path=str(overlay_path), model_version="v2.0")
        return result, mask


pipeline = pipeline_module.Pipeline()
pipeline.classifier, pipeline.detector, pipeline.segmenter = FakeClassifier(), FakeDetector(), FakeSegmenter()
for module in (pipeline.classifier, pipeline.detector, pipeline.segmenter):
    registry.register(module)
pipeline_module._pipeline = pipeline                 # the app now uses the fake pipeline

# ---------------------------------------------------------------- set up
client = TestClient(app)               # no "with": nothing is loaded at startup
Base.metadata.drop_all(bind=engine)
init_db()
with SessionLocal() as session:
    seed_admin(session)

PASSWORD = "Strong#123"


def login(email, password):
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": "Bearer " + r.json()["access_token"]}


ADMIN = login("admin@test.com", "Admin#12345")


def make_user(email, role):
    r = client.post("/api/auth/register", json={"email": email, "password": PASSWORD, "full_name": email.split("@")[0]})
    assert r.status_code == 201, r.text
    user_id = r.json()["id"]
    client.patch(f"/api/users/{user_id}", headers=ADMIN, json={"role": role})
    return user_id, login(email, PASSWORD)


MANAGER_ID, MANAGER = make_user("manager@test.com", "manager")
ENGINEER_ID, ENGINEER = make_user("engineer@test.com", "civil_engineer")
MAINT_ID, MAINT = make_user("maint@test.com", "maintenance_engineer")
ANIL_ID, ANIL = make_user("anil@test.com", "inspector")
BINA_ID, BINA = make_user("bina@test.com", "inspector")


def photo(seed):
    rng = np.random.default_rng(seed)
    ok, buffer = cv2.imencode(".jpg", rng.integers(0, 256, (480, 640, 3), dtype=np.uint8))
    return buffer.tobytes()


def upload(inspection_id, headers, seed):
    r = client.post(f"/api/inspections/{inspection_id}/images", headers=headers,
                    files={"file": ("site.jpg", photo(seed), "image/jpeg")})
    assert r.status_code == 201, r.text
    return r.json()["id"]


ASSET = client.post("/api/assets", headers=MANAGER, json={"name": "Ring Road Bridge", "asset_type": "bridge"}).json()["id"]
INSPECTION = client.post("/api/inspections", headers=MANAGER, json={"asset_id": ASSET, "assigned_to": ANIL_ID}).json()["id"]
BASE = f"/api/inspections/{INSPECTION}"
IMAGES = []


def results():
    r = client.get(f"{BASE}/results", headers=MANAGER)
    assert r.status_code == 200, r.text
    return r.json()


def test_start_analysis():
    assert client.post(f"{BASE}/analyze", headers=ANIL).status_code == 400            # no photos yet
    IMAGES.extend(upload(INSPECTION, ANIL, seed) for seed in (1, 2, 3))

    assert client.post(f"{BASE}/analyze", headers=BINA).status_code == 403            # not his inspection
    assert client.post(f"{BASE}/analyze", headers=MAINT).status_code == 403            # cannot work on it
    assert client.post(f"{BASE}/analyze").status_code == 401
    assert client.post(f"{BASE}/analyze", headers=ANIL, json={"image_ids": [9999]}).status_code == 404

    r = client.post(f"{BASE}/analyze", headers=ANIL)
    print("start:", r.status_code, r.json())
    assert r.status_code == 202 and r.json()["queued"] == IMAGES and r.json()["skipped"] == 0

    data = results()                                  # the background job has finished
    summary = data["summary"]
    print("summary:", summary)
    assert summary["total_images"] == 3 and summary["analyzed"] == 3 and summary["in_queue"] == 0
    assert summary["images_with_cracks"] == 3 and summary["awaiting_review"] == 3 and summary["reviewed"] == 0
    assert summary["overall_severity"] == "Moderate Damage" and summary["overall_priority"] == "Medium Priority"
    assert summary["requires_engineering_review"] is False

    first = data["items"][0]["analysis"]
    assert first["status"] == "ok" and first["awaiting_review"] is True
    assert first["effective_severity"] == first["severity_category"] == "Moderate Damage"
    assert first["result"]["crack_detected"] is True and first["result"]["evidence"] == ["classifier", "detector", "segmentation"]
    urls = [first["result"]["classification"]["heatmap_path"], first["result"]["detection"]["annotated_image_path"],
            first["result"]["segmentation"]["mask_path"], first["result"]["segmentation"]["overlay_path"]]
    for url in urls:                                  # the result images can be shown
        assert url.startswith(f"/files/results/inspections/{INSPECTION}/{first['image_id']}/"), url
        got = client.get(url)
        assert got.status_code == 200 and got.headers["content-type"].startswith("image/"), url
    assert data["items"][0]["image"]["url"].startswith("/files/inspections/")

    r = client.post(f"{BASE}/analyze", headers=ANIL)                                   # nothing new
    assert r.json()["queued"] == [] and r.json()["skipped"] == 3
    r = client.post(f"{BASE}/analyze", headers=ANIL, json={"image_ids": [IMAGES[0]], "force": True})
    assert r.json()["queued"] == [IMAGES[0]] and r.json()["skipped"] == 0

    r = client.get(f"{BASE}/images/{IMAGES[1]}/analysis", headers=ANIL)
    assert r.status_code == 200 and r.json()["image_id"] == IMAGES[1]
    assert client.get(f"{BASE}/results", headers=BINA).status_code == 403
    assert client.get(f"{BASE}/results").status_code == 401


def test_review():
    body = {"decision": "confirmed"}
    path = lambda image_id: f"{BASE}/images/{image_id}/review"
    assert client.put(path(IMAGES[0]), headers=ANIL, json=body).status_code == 403
    assert client.put(path(IMAGES[0]), headers=MAINT, json=body).status_code == 403
    assert client.put(path(9999), headers=ENGINEER, json=body).status_code == 404

    r = client.put(path(IMAGES[0]), headers=ENGINEER, json=body)
    print("confirmed:", r.json()["review_status"], r.json()["effective_severity"])
    assert r.status_code == 200 and r.json()["review_status"] == "confirmed"
    assert r.json()["effective_severity"] == "Moderate Damage" and r.json()["awaiting_review"] is False

    modify = {"decision": "modified", "final_severity": "Severe Damage", "comment": "Crack is wider on site"}
    assert client.put(path(IMAGES[1]), headers=ENGINEER, json={"decision": "modified", "comment": "x yz"}).status_code == 422
    assert client.put(path(IMAGES[1]), headers=ENGINEER, json={**modify, "final_severity": "Terrible"}).status_code == 422
    assert client.put(path(IMAGES[1]), headers=ENGINEER, json={**modify, "comment": ""}).status_code == 422
    assert client.put(path(IMAGES[1]), headers=ENGINEER, json={"decision": "maybe"}).status_code == 422
    r = client.put(path(IMAGES[1]), headers=MANAGER, json=modify)
    print("modified:", r.json()["review_status"], r.json()["effective_severity"], "->", r.json()["effective_priority"])
    assert r.json()["effective_severity"] == "Severe Damage" and r.json()["effective_priority"] == "High Priority"
    assert r.json()["severity_category"] == "Moderate Damage"                         # the AI value is kept

    assert client.put(path(IMAGES[2]), headers=ENGINEER, json={"decision": "rejected"}).status_code == 422   # no comment
    r = client.put(path(IMAGES[2]), headers=ENGINEER, json={"decision": "rejected", "comment": "Only a shadow"})
    assert r.json()["effective_severity"] == "No Visible Damage" and r.json()["effective_priority"] == "Routine Monitoring"

    summary = results()["summary"]
    print("summary after review:", summary)
    assert summary["reviewed"] == 3 and summary["awaiting_review"] == 0
    assert summary["overall_severity"] == "Severe Damage" and summary["overall_priority"] == "High Priority"
    assert summary["requires_engineering_review"] is True

    # a new analysis of a reviewed photo resets its review
    client.post(f"{BASE}/analyze", headers=ANIL, json={"image_ids": [IMAGES[1]], "force": True})
    again = client.get(f"{BASE}/images/{IMAGES[1]}/analysis", headers=ANIL).json()
    assert again["review_status"] == "pending" and again["effective_severity"] == "Moderate Damage"


def test_errors_and_stale():
    new_image = upload(INSPECTION, MANAGER, 9)
    assert client.get(f"{BASE}/images/{new_image}/analysis", headers=ANIL).status_code == 404      # not analysed
    assert client.put(f"{BASE}/images/{new_image}/review", headers=ENGINEER,
                      json={"decision": "confirmed"}).status_code == 404

    for model in (pipeline.classifier, pipeline.detector, pipeline.segmenter):
        model.fail = True                                                          # every model breaks
    try:
        client.post(f"{BASE}/analyze", headers=ANIL, json={"image_ids": [new_image]})
    finally:
        for model in (pipeline.classifier, pipeline.detector, pipeline.segmenter):
            model.fail = False
    broken = client.get(f"{BASE}/images/{new_image}/analysis", headers=ANIL).json()
    print("all models broke:", broken["status"], "|", broken["error"][:80])
    assert broken["status"] == "error" and "failed" in broken["error"]
    assert broken["effective_severity"] is None and broken["awaiting_review"] is False
    assert client.put(f"{BASE}/images/{new_image}/review", headers=ENGINEER,
                      json={"decision": "confirmed"}).status_code == 409
    assert results()["summary"]["failed"] == 1

    # one broken model only: the others still give a result (the problem is written in the warnings)
    pipeline.detector.fail = True
    try:
        client.post(f"{BASE}/analyze", headers=ANIL, json={"image_ids": [new_image], "force": True})
    finally:
        pipeline.detector.fail = False
    partial = client.get(f"{BASE}/images/{new_image}/analysis", headers=ANIL).json()
    assert partial["status"] == "ok" and any("Detection failed" in w for w in partial["result"]["warnings"])
    assert partial["result"]["detection"] is None and partial["crack_detected"] is True

    # analyses that were waiting when the server stopped
    with SessionLocal() as db:
        row = db.query(AnalysisRecord).filter_by(image_id=new_image).one()
        row.status = "running"
        db.commit()
        assert result_service.fail_stale(db) == 1
        db.refresh(row)
        assert row.status == "error" and "restart" in row.error


def test_cancelled_and_audit():
    other = client.post("/api/inspections", headers=MANAGER, json={"asset_id": ASSET, "assigned_to": ANIL_ID}).json()["id"]
    upload(other, ANIL, 40)
    client.patch(f"/api/inspections/{other}", headers=MANAGER, json={"status": "cancelled"})
    assert client.post(f"/api/inspections/{other}/analyze", headers=MANAGER).status_code == 409

    actions = {e["action"] for e in client.get("/api/audit-logs?limit=500", headers=ADMIN).json()}
    print("audit actions:", sorted(actions))
    assert {"analysis_started", "analysis_reviewed"} <= actions


if __name__ == "__main__":
    test_start_analysis()
    test_review()
    test_errors_and_stale()
    test_cancelled_and_audit()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()
    try:
        Path("test_results.db").unlink()
    except OSError:
        pass
    import shutil
    shutil.rmtree(TEMP_STORAGE, ignore_errors=True)
    print("\nResults OK")