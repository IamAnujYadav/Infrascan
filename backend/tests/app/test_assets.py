"""Assets test. Run from project root:  python -m tests.app.test_assets
Uses a separate test database file and does NOT load the AI models."""
import os
from datetime import date, timedelta
from pathlib import Path

# these must be set BEFORE the app is imported
os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL", "sqlite:///./test_assets.db")
os.environ["ADMIN_EMAIL"] = "admin@test.com"
os.environ["ADMIN_PASSWORD"] = "Admin#12345"
os.environ["REQUIRE_LOGIN"] = "false"
Path("test_assets.db").unlink(missing_ok=True)

from fastapi.testclient import TestClient

import app.db.models  # noqa: F401  (registers the tables)
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
    """Register a user and let the administrator set the role."""
    r = client.post("/api/auth/register", json={"email": email, "password": PASSWORD, "full_name": "Test User"})
    assert r.status_code == 201, r.text
    client.patch(f"/api/users/{r.json()['id']}", headers=ADMIN, json={"role": role})
    return login(email, PASSWORD)


MANAGER = make_user("manager@test.com", "manager")
ENGINEER = make_user("engineer@test.com", "civil_engineer")
MAINT = make_user("maint@test.com", "maintenance_engineer")
INSPECTOR = make_user("inspector@test.com", "inspector")

BRIDGE = {"name": "Ring Road Bridge", "asset_type": "bridge", "location": "Jaipur, Rajasthan",
          "latitude": 26.9124, "longitude": 75.7873, "construction_year": 1998,
          "material_type": "Reinforced concrete", "responsible_department": "PWD",
          "inspection_frequency": "quarterly"}


def test_create():
    assert client.post("/api/assets", json=BRIDGE).status_code == 401                              # not logged in
    assert client.post("/api/assets", headers=INSPECTOR, json=BRIDGE).status_code == 403            # inspector: no
    assert client.post("/api/assets", headers=MAINT, json=BRIDGE).status_code == 403

    r = client.post("/api/assets", headers=MANAGER, json=BRIDGE)
    print("create:", r.status_code, r.json()["asset_code"], r.json()["asset_type"])
    assert r.status_code == 201
    assert r.json()["asset_code"] == f"BRG-{r.json()['id']:04d}" and r.json()["is_active"] is True

    r = client.post("/api/assets", headers=ENGINEER, json={"name": "City Hall", "asset_type": "building",
                                                           "asset_code": "CH-001"})
    assert r.status_code == 201 and r.json()["asset_code"] == "CH-001"
    assert client.post("/api/assets", headers=ENGINEER, json={"name": "Other", "asset_type": "road",
                                                              "asset_code": "ch-001"}).status_code == 409   # duplicate code

    bad = [{**BRIDGE, "asset_type": "spaceship"}, {**BRIDGE, "latitude": 123}, {**BRIDGE, "longitude": -500},
           {**BRIDGE, "construction_year": 1500}, {**BRIDGE, "construction_year": date.today().year + 5},
           {**BRIDGE, "name": "x"}, {**BRIDGE, "inspection_frequency": "daily"},
           {**BRIDGE, "asset_code": "bad code!"}]
    for body in bad:
        assert client.post("/api/assets", headers=MANAGER, json=body).status_code == 422, body


def test_list_and_read():
    for name, kind, place in [("Mansarovar Road", "road", "Jaipur"), ("Old Dam", "dam", "Kota"),
                              ("Metro Tunnel", "tunnel", "Delhi")]:
        client.post("/api/assets", headers=MANAGER, json={"name": name, "asset_type": kind, "location": place})

    r = client.get("/api/assets", headers=INSPECTOR)                       # every role may look
    assert r.status_code == 200
    print("list: total =", r.json()["total"], [a["asset_code"] for a in r.json()["items"]])
    assert r.json()["total"] == 5 and len(r.json()["items"]) == 5
    assert r.json()["items"][0]["name"] == "Metro Tunnel"                  # newest first

    assert client.get("/api/assets?type=dam", headers=INSPECTOR).json()["total"] == 1
    assert client.get("/api/assets?search=jaipur", headers=INSPECTOR).json()["total"] == 2   # name or location
    assert client.get("/api/assets?search=brg-", headers=INSPECTOR).json()["total"] == 1     # code
    r = client.get("/api/assets?limit=2&offset=2", headers=INSPECTOR)
    assert r.json()["total"] == 5 and len(r.json()["items"]) == 2
    assert client.get("/api/assets?type=spaceship", headers=INSPECTOR).status_code == 422
    assert client.get("/api/assets?limit=0", headers=INSPECTOR).status_code == 422
    assert client.get("/api/assets").status_code == 401

    first_id = client.get("/api/assets?type=bridge", headers=INSPECTOR).json()["items"][0]["id"]
    assert client.get(f"/api/assets/{first_id}", headers=INSPECTOR).json()["name"] == "Ring Road Bridge"
    assert client.get("/api/assets/9999", headers=INSPECTOR).status_code == 404

    options = client.get("/api/asset-options", headers=INSPECTOR).json()
    assert len(options["asset_types"]) == 8 and len(options["inspection_frequencies"]) == 5


def test_update():
    bridge_id = client.get("/api/assets?type=bridge", headers=INSPECTOR).json()["items"][0]["id"]
    assert client.patch(f"/api/assets/{bridge_id}", headers=INSPECTOR, json={"name": "Hacked"}).status_code == 403
    r = client.patch(f"/api/assets/{bridge_id}", headers=ENGINEER,
                     json={"name": "Ring Road Flyover", "inspection_frequency": "monthly"})
    print("update:", r.status_code, r.json()["name"], r.json()["inspection_frequency"])
    assert r.status_code == 200 and r.json()["name"] == "Ring Road Flyover"
    assert r.json()["inspection_frequency"] == "monthly" and r.json()["material_type"] == "Reinforced concrete"
    assert client.patch(f"/api/assets/{bridge_id}", headers=ENGINEER, json={}).status_code == 400
    assert client.patch(f"/api/assets/{bridge_id}", headers=ENGINEER, json={"latitude": 999}).status_code == 422
    assert client.patch("/api/assets/9999", headers=ENGINEER, json={"name": "Nothing"}).status_code == 404


def test_archive_and_restore():
    dam_id = client.get("/api/assets?type=dam", headers=INSPECTOR).json()["items"][0]["id"]
    assert client.delete(f"/api/assets/{dam_id}", headers=ENGINEER).status_code == 403
    assert client.delete(f"/api/assets/{dam_id}", headers=INSPECTOR).status_code == 403
    r = client.delete(f"/api/assets/{dam_id}", headers=MANAGER)
    assert r.status_code == 200 and r.json()["is_active"] is False

    assert client.get("/api/assets?type=dam", headers=INSPECTOR).json()["total"] == 0                # hidden
    assert client.get("/api/assets?include_archived=true", headers=INSPECTOR).status_code == 403
    assert client.get("/api/assets?type=dam&include_archived=true", headers=MANAGER).json()["total"] == 1
    assert client.get(f"/api/assets/{dam_id}", headers=INSPECTOR).json()["is_active"] is False       # still readable

    r = client.post(f"/api/assets/{dam_id}/restore", headers=MANAGER)
    assert r.status_code == 200 and r.json()["is_active"] is True
    assert client.get("/api/assets?type=dam", headers=INSPECTOR).json()["total"] == 1
    print("archive and restore OK")


def test_maintenance():
    asset_id = client.get("/api/assets?type=road", headers=INSPECTOR).json()["items"][0]["id"]
    today = date.today().isoformat()
    record = {"performed_on": today, "description": "Filled cracks with sealant"}
    assert client.post(f"/api/assets/{asset_id}/maintenance", headers=INSPECTOR, json=record).status_code == 403
    r = client.post(f"/api/assets/{asset_id}/maintenance", headers=MAINT, json=record)
    assert r.status_code == 201 and r.json()["asset_id"] == asset_id
    old = {"performed_on": (date.today() - timedelta(days=90)).isoformat(), "description": "Resurfaced 200 m"}
    assert client.post(f"/api/assets/{asset_id}/maintenance", headers=ENGINEER, json=old).status_code == 201

    future = {"performed_on": (date.today() + timedelta(days=3)).isoformat(), "description": "Planned job"}
    assert client.post(f"/api/assets/{asset_id}/maintenance", headers=MAINT, json=future).status_code == 422
    assert client.post(f"/api/assets/{asset_id}/maintenance", headers=MAINT,
                       json={"performed_on": today, "description": "x"}).status_code == 422
    assert client.post("/api/assets/9999/maintenance", headers=MAINT, json=record).status_code == 404

    r = client.get(f"/api/assets/{asset_id}/maintenance", headers=INSPECTOR)
    print("maintenance:", [(m["performed_on"], m["description"]) for m in r.json()])
    assert r.status_code == 200 and len(r.json()) == 2 and r.json()[0]["performed_on"] == today   # newest first
    assert client.get("/api/assets/9999/maintenance", headers=INSPECTOR).status_code == 404


def test_audit():
    r = client.get("/api/audit-logs?limit=500", headers=ADMIN)
    actions = {entry["action"] for entry in r.json()}
    print("audit actions:", sorted(actions))
    assert {"asset_created", "asset_updated", "asset_archived", "asset_restored", "maintenance_added"} <= actions


if __name__ == "__main__":
    test_create()
    test_list_and_read()
    test_update()
    test_archive_and_restore()
    test_maintenance()
    test_audit()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()
    try:
        Path("test_assets.db").unlink()
    except OSError:
        pass
    print("\nAssets OK")