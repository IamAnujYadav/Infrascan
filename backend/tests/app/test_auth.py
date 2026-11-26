"""Login / users test. Run from project root:  python -m tests.app.test_auth
Uses a separate test database file and does NOT load the AI models."""
import os
from pathlib import Path

# these must be set BEFORE the app is imported
os.environ["DATABASE_URL"] = "sqlite:///./test_auth.db"
os.environ["ADMIN_EMAIL"] = "admin@test.com"
os.environ["ADMIN_PASSWORD"] = "Admin#12345"
os.environ["REQUIRE_LOGIN"] = "false"
Path("test_auth.db").unlink(missing_ok=True)

from fastapi.testclient import TestClient

from app.config import settings
from app.db.database import SessionLocal, engine, init_db
from app.main import app
from app.security.tokens import create_access_token
from app.services.auth_service import seed_admin

client = TestClient(app)               # no "with": the AI models are not loaded
init_db()
with SessionLocal() as session:
    seed_admin(session)


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def login(email, password):
    return client.post("/api/auth/login", json={"email": email, "password": password})


def test_register():
    body = {"email": "Ravi@Test.com", "password": "Strong#123", "full_name": "Ravi Kumar"}
    r = client.post("/api/auth/register", json=body)
    print("register:", r.status_code, r.json())
    assert r.status_code == 201
    assert r.json()["role"] == "inspector" and r.json()["email"] == "ravi@test.com"
    assert "password" not in r.text and "hashed" not in r.text

    assert client.post("/api/auth/register", json=body).status_code == 409                       # duplicate
    assert client.post("/api/auth/register", json={**body, "email": "b@test.com", "password": "short"}).status_code == 422
    assert client.post("/api/auth/register", json={**body, "email": "not-an-email"}).status_code == 422
    # nobody can register as administrator by sending a role
    r = client.post("/api/auth/register", json={**body, "email": "c@test.com", "role": "admin"})
    assert r.status_code == 201 and r.json()["role"] == "inspector"


def test_login_and_me():
    assert login("ravi@test.com", "wrong-password").status_code == 401
    assert login("nobody@test.com", "Strong#123").status_code == 401
    r = login("ravi@test.com", "Strong#123")
    assert r.status_code == 200
    token = r.json()["access_token"]
    print("login ok, user:", r.json()["user"]["email"])

    me = client.get("/api/users/me", headers=auth(token))
    assert me.status_code == 200 and me.json()["email"] == "ravi@test.com"
    assert client.get("/api/users/me").status_code == 401                                   # no token
    assert client.get("/api/users/me", headers=auth("garbage")).status_code == 401           # bad token
    expired = create_access_token(me.json()["id"], "inspector", expires_minutes=-5)
    assert client.get("/api/users/me", headers=auth(expired)).status_code == 401             # expired

    # form login used by the Authorize button of /docs
    r = client.post("/api/auth/token", data={"username": "ravi@test.com", "password": "Strong#123"})
    assert r.status_code == 200 and r.json()["token_type"] == "bearer"

    r = client.patch("/api/users/me", headers=auth(token), json={"full_name": "Ravi K"})
    assert r.json()["full_name"] == "Ravi K"


def test_roles():
    admin = login("admin@test.com", "Admin#12345").json()["access_token"]
    ravi = login("ravi@test.com", "Strong#123").json()["access_token"]

    assert client.get("/api/users", headers=auth(ravi)).status_code == 403                  # inspector: no
    r = client.get("/api/users", headers=auth(admin))
    assert r.status_code == 200
    users = {u["email"]: u for u in r.json()}
    print("users:", [(email, u["role"]) for email, u in users.items()])
    assert users["admin@test.com"]["role"] == "admin"

    ravi_id, admin_id = users["ravi@test.com"]["id"], users["admin@test.com"]["id"]
    r = client.patch(f"/api/users/{ravi_id}", headers=auth(admin), json={"role": "civil_engineer"})
    assert r.status_code == 200 and r.json()["role"] == "civil_engineer"
    assert client.patch(f"/api/users/{ravi_id}", headers=auth(admin), json={"role": "king"}).status_code == 422
    assert client.patch("/api/users/9999", headers=auth(admin), json={"role": "manager"}).status_code == 404
    # the administrator cannot lock himself out
    assert client.patch(f"/api/users/{admin_id}", headers=auth(admin), json={"role": "inspector"}).status_code == 400
    assert client.patch(f"/api/users/{admin_id}", headers=auth(admin), json={"is_active": False}).status_code == 400

    # disabled user: cannot login and the old token stops working
    assert client.patch(f"/api/users/{ravi_id}", headers=auth(admin), json={"is_active": False}).status_code == 200
    assert login("ravi@test.com", "Strong#123").status_code == 401
    assert client.get("/api/users/me", headers=auth(ravi)).status_code == 401
    client.patch(f"/api/users/{ravi_id}", headers=auth(admin), json={"is_active": True})


def test_password_change():
    token = login("ravi@test.com", "Strong#123").json()["access_token"]
    r = client.post("/api/users/me/password", headers=auth(token),
                    json={"current_password": "wrong", "new_password": "NewPass#456"})
    assert r.status_code == 400
    r = client.post("/api/users/me/password", headers=auth(token),
                    json={"current_password": "Strong#123", "new_password": "NewPass#456"})
    assert r.status_code == 200
    assert login("ravi@test.com", "Strong#123").status_code == 401
    assert login("ravi@test.com", "NewPass#456").status_code == 200


def test_audit_log():
    admin = login("admin@test.com", "Admin#12345").json()["access_token"]
    r = client.get("/api/audit-logs?limit=500", headers=auth(admin))
    actions = {entry["action"] for entry in r.json()}
    print("audit actions:", sorted(actions))
    assert {"register", "login", "login_failed", "user_updated", "password_changed"} <= actions


def test_analyze_needs_login_when_switched_on():
    token = login("admin@test.com", "Admin#12345").json()["access_token"]
    settings.require_login = True
    try:
        r = client.post("/api/analyze", files={"file": ("a.jpg", b"x", "image/jpeg")})
        print("analyze without login:", r.status_code)
        assert r.status_code == 401
        # with login it gets past the guard (and stops at the bad file type, no AI model needed)
        r = client.post("/api/analyze", headers=auth(token), files={"file": ("a.txt", b"x", "text/plain")})
        print("analyze with login   :", r.status_code, r.json())
        assert r.status_code == 400
    finally:
        settings.require_login = False


if __name__ == "__main__":
    test_register()
    test_login_and_me()
    test_roles()
    test_password_change()
    test_audit_log()
    test_analyze_needs_login_when_switched_on()
    engine.dispose()
    try:
        Path("test_auth.db").unlink()
    except OSError:
        pass
    print("\nAuth OK")