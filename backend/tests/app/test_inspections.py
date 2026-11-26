"""Inspections test. Run from project root:  python -m tests.app.test_inspections
Uses a separate test database file and a temporary storage folder. Does NOT load the AI models."""
import os
import tempfile
from pathlib import Path

# these must be set BEFORE the app is imported
TEMP_STORAGE = tempfile.mkdtemp(prefix="infrascan_test_storage_")
os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL", "sqlite:///./test_inspections.db")
os.environ["STORAGE_DIR"] = TEMP_STORAGE
os.environ["ADMIN_EMAIL"] = "admin@test.com"
os.environ["ADMIN_PASSWORD"] = "Admin#12345"
os.environ["REQUIRE_LOGIN"] = "false"
Path("test_inspections.db").unlink(missing_ok=True)

import cv2
import numpy as np
from fastapi.testclient import TestClient

import app.db.models  # noqa: F401  (registers the tables)
from app.config import settings
from app.db.database import Base, SessionLocal, engine, init_db
from app.main import app
from app.services.auth_service import seed_admin

client = TestClient(app)               # no "with": the AI models are not loaded
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


def photo(seed, brightness=1.0, size=(480, 640)):
    """A test photo as jpg bytes. Different seed = different photo."""
    rng = np.random.default_rng(seed)
    image = (rng.integers(0, 256, (size[0], size[1], 3)) * brightness).astype(np.uint8)
    ok, buffer = cv2.imencode(".jpg", image)
    return buffer.tobytes()


def upload(inspection_id, headers, data, name="site.jpg", **extra):
    return client.post(f"/api/inspections/{inspection_id}/images", headers=headers,
                       files={"file": (name, data, "image/jpeg")}, data=extra)


def new_asset(name="Ring Road Bridge", kind="bridge"):
    r = client.post("/api/assets", headers=MANAGER, json={"name": name, "asset_type": kind})
    assert r.status_code == 201, r.text
    return r.json()["id"]


ASSET = new_asset()


def test_create():
    r = client.post("/api/inspections", headers=MANAGER,
                    json={"asset_id": ASSET, "assigned_to": ANIL_ID, "scheduled_date": "2026-12-01", "notes": "Yearly visit"})
    print("create:", r.status_code, r.json()["status"], "->", r.json()["assigned_to_name"], "|", r.json()["asset_code"])
    assert r.status_code == 201 and r.json()["status"] == "planned" and r.json()["assigned_to"] == ANIL_ID
    assert r.json()["image_count"] == 0

    # an inspector can only plan work for himself, even if he names someone else
    r = client.post("/api/inspections", headers=BINA, json={"asset_id": ASSET, "assigned_to": ANIL_ID})
    assert r.status_code == 201 and r.json()["assigned_to"] == BINA_ID

    assert client.post("/api/inspections", headers=MAINT, json={"asset_id": ASSET}).status_code == 403
    assert client.post("/api/inspections", json={"asset_id": ASSET}).status_code == 401
    assert client.post("/api/inspections", headers=MANAGER, json={"asset_id": 9999}).status_code == 404
    assert client.post("/api/inspections", headers=MANAGER,
                       json={"asset_id": ASSET, "assigned_to": ENGINEER_ID}).status_code == 400   # not an inspector
    assert client.post("/api/inspections", headers=MANAGER,
                       json={"asset_id": ASSET, "assigned_to": 9999}).status_code == 400

    archived = new_asset("Old Wall", "retaining_wall")
    client.delete(f"/api/assets/{archived}", headers=MANAGER)
    assert client.post("/api/inspections", headers=MANAGER, json={"asset_id": archived}).status_code == 400


def test_visibility():
    all_rows = client.get("/api/inspections", headers=MANAGER).json()
    assert all_rows["total"] == 2
    anil_rows = client.get("/api/inspections", headers=ANIL).json()
    bina_rows = client.get("/api/inspections", headers=BINA).json()
    print("manager sees", all_rows["total"], "| anil sees", anil_rows["total"], "| bina sees", bina_rows["total"])
    assert anil_rows["total"] == 1 and bina_rows["total"] == 1
    assert anil_rows["items"][0]["assigned_to"] == ANIL_ID

    anil_inspection = anil_rows["items"][0]["id"]
    assert client.get(f"/api/inspections/{anil_inspection}", headers=BINA).status_code == 403
    assert client.get(f"/api/inspections/{anil_inspection}", headers=ANIL).status_code == 200
    assert client.get(f"/api/inspections/{anil_inspection}", headers=MAINT).status_code == 200      # other roles see all
    assert client.get("/api/inspections/9999", headers=MANAGER).status_code == 404

    assert client.get(f"/api/inspections?asset_id={ASSET}", headers=MANAGER).json()["total"] == 2
    assert client.get("/api/inspections?status=planned", headers=MANAGER).json()["total"] == 2
    assert client.get("/api/inspections?status=completed", headers=MANAGER).json()["total"] == 0
    assert client.get("/api/inspections?status=nonsense", headers=MANAGER).status_code == 422
    assert client.get("/api/inspections?mine=true", headers=MANAGER).json()["total"] == 0
    assert client.get("/api/inspections?limit=1", headers=MANAGER).json()["total"] == 2

    history = client.get(f"/api/assets/{ASSET}/inspections", headers=MANAGER).json()
    assert history["total"] == 2
    assert client.get(f"/api/assets/{ASSET}/inspections", headers=ANIL).json()["total"] == 1       # inspector: only his
    assert client.get("/api/assets/9999/inspections", headers=MANAGER).status_code == 404


def anil_inspection_id():
    return client.get("/api/inspections?mine=true", headers=ANIL).json()["items"][0]["id"]


def test_upload():
    inspection_id = anil_inspection_id()

    r = upload(inspection_id, ANIL, photo(1), latitude="26.91", longitude="75.78")
    print("upload:", r.status_code, r.json()["url"], r.json()["width"], "x", r.json()["height"], r.json()["warnings"])
    assert r.status_code == 201 and r.json()["url"].startswith(f"/files/inspections/{inspection_id}/")
    assert r.json()["latitude"] == 26.91 and r.json()["warnings"] == []

    detail = client.get(f"/api/inspections/{inspection_id}", headers=ANIL).json()
    assert detail["status"] == "in_progress" and detail["inspection_date"] is not None and detail["image_count"] == 1
    assert len(detail["images"]) == 1

    got = client.get(r.json()["url"])                                     # the file can be shown
    assert got.status_code == 200 and got.headers["content-type"].startswith("image/")

    assert upload(inspection_id, BINA, photo(2)).status_code == 403          # another inspector
    assert upload(inspection_id, MAINT, photo(2)).status_code == 403
    assert client.post(f"/api/inspections/{inspection_id}/images",
                       files={"file": ("a.jpg", photo(3), "image/jpeg")}).status_code == 401
    assert upload(inspection_id, MANAGER, photo(4)).status_code == 201       # a manager may add photos

    assert upload(inspection_id, ANIL, b"hello", name="notes.txt").status_code == 400
    assert upload(inspection_id, ANIL, b"").status_code == 400
    r = upload(inspection_id, ANIL, b"this is not an image" * 40)
    assert r.status_code == 422, r.text
    r = upload(inspection_id, ANIL, photo(5, size=(100, 100)))
    print("tiny photo:", r.status_code, r.json()["detail"])
    assert r.status_code == 422
    assert upload(inspection_id, ANIL, photo(1)).status_code == 409           # same photo again
    assert upload(inspection_id, ANIL, photo(6), latitude="500").status_code == 422

    r = upload(inspection_id, ANIL, photo(7, brightness=0.1))                  # accepted, but dark
    print("dark photo:", r.status_code, r.json()["warnings"])
    assert r.status_code == 201 and any("dark" in w for w in r.json()["warnings"])

    saved = list((Path(TEMP_STORAGE) / "inspections" / str(inspection_id)).glob("*"))
    assert len(saved) == 3, saved                                              # rejected photos were not kept

    old = settings.max_upload_mb
    settings.max_upload_mb = 0
    try:
        assert upload(inspection_id, ANIL, photo(8)).status_code == 413
    finally:
        settings.max_upload_mb = old


def test_duplicate_in_other_inspection():
    """Same photo in another inspection of the same asset: accepted, but flagged."""
    bina_inspection = client.get("/api/inspections?mine=true", headers=BINA).json()["items"][0]["id"]
    r = upload(bina_inspection, BINA, photo(1))
    print("same photo, other inspection:", r.status_code, r.json()["warnings"])
    assert r.status_code == 201 and any("duplicate" in w for w in r.json()["warnings"])


def test_status_flow():
    inspection_id = anil_inspection_id()                                       # now in_progress with photos
    assert client.patch(f"/api/inspections/{inspection_id}", headers=ANIL, json={}).status_code == 400
    assert client.patch(f"/api/inspections/{inspection_id}", headers=BINA, json={"notes": "x"}).status_code == 403
    assert client.patch(f"/api/inspections/{inspection_id}", headers=ANIL,
                        json={"assigned_to": BINA_ID}).status_code == 403          # only a manager reassigns
    assert client.patch(f"/api/inspections/{inspection_id}", headers=ANIL,
                        json={"status": "cancelled"}).status_code == 403
    assert client.patch(f"/api/inspections/{inspection_id}", headers=ANIL,
                        json={"status": "planned"}).status_code == 400            # cannot go back

    r = client.patch(f"/api/inspections/{inspection_id}", headers=ANIL, json={"notes": "Crack near pier 3"})
    assert r.status_code == 200 and r.json()["notes"] == "Crack near pier 3"

    # a fresh inspection without photos cannot be completed
    fresh = client.post("/api/inspections", headers=MANAGER, json={"asset_id": ASSET, "assigned_to": ANIL_ID}).json()["id"]
    assert client.patch(f"/api/inspections/{fresh}", headers=MANAGER, json={"status": "completed"}).status_code == 400
    assert client.patch(f"/api/inspections/{fresh}", headers=MANAGER, json={"status": "in_progress"}).status_code == 200
    assert client.patch(f"/api/inspections/{fresh}", headers=MANAGER, json={"status": "completed"}).status_code == 400  # no photos
    assert client.patch(f"/api/inspections/{fresh}", headers=MANAGER, json={"status": "cancelled"}).status_code == 200
    assert client.patch(f"/api/inspections/{fresh}", headers=MANAGER, json={"notes": "late"}).status_code == 409        # closed
    assert upload(fresh, MANAGER, photo(20)).status_code == 409

    # the manager moves an inspection to another inspector
    other = client.post("/api/inspections", headers=MANAGER, json={"asset_id": ASSET, "assigned_to": ANIL_ID}).json()["id"]
    r = client.patch(f"/api/inspections/{other}", headers=MANAGER, json={"assigned_to": BINA_ID})
    assert r.status_code == 200 and r.json()["assigned_to_name"] == "bina"
    assert client.get(f"/api/inspections/{other}", headers=ANIL).status_code == 403          # Anil lost access
    assert client.get(f"/api/inspections/{other}", headers=BINA).status_code == 200
    r = client.patch(f"/api/inspections/{other}", headers=MANAGER, json={"assigned_to": None})
    assert r.status_code == 200 and r.json()["assigned_to"] is None

    # delete a photo, then complete
    detail = client.get(f"/api/inspections/{inspection_id}", headers=ANIL).json()
    first = detail["images"][0]
    assert client.delete(f"/api/inspections/{inspection_id}/images/{first['id']}", headers=BINA).status_code == 403
    assert client.delete(f"/api/inspections/{inspection_id}/images/9999", headers=ANIL).status_code == 404
    assert client.delete(f"/api/inspections/{inspection_id}/images/{first['id']}", headers=ANIL).status_code == 204
    assert client.get(first["url"]).status_code == 404                                       # file is gone
    assert client.get(f"/api/inspections/{inspection_id}", headers=ANIL).json()["image_count"] == 2

    r = client.patch(f"/api/inspections/{inspection_id}", headers=ANIL, json={"status": "completed"})
    print("complete:", r.status_code, r.json()["status"], r.json()["inspection_date"])
    assert r.status_code == 200 and r.json()["status"] == "completed"
    assert upload(inspection_id, ANIL, photo(30)).status_code == 409                         # locked
    assert client.delete(f"/api/inspections/{inspection_id}/images/{detail['images'][1]['id']}",
                         headers=ANIL).status_code == 409


def test_audit():
    actions = {e["action"] for e in client.get("/api/audit-logs?limit=500", headers=ADMIN).json()}
    print("audit actions:", sorted(actions))
    assert {"inspection_created", "inspection_updated", "image_uploaded", "image_deleted"} <= actions


if __name__ == "__main__":
    test_create()
    test_visibility()
    test_upload()
    test_duplicate_in_other_inspection()
    test_status_flow()
    test_audit()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()
    try:
        Path("test_inspections.db").unlink()
    except OSError:
        pass
    import shutil
    shutil.rmtree(TEMP_STORAGE, ignore_errors=True)
    print("\nInspections OK")