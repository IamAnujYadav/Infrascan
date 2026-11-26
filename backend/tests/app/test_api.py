"""API test. Run from project root:  python -m tests.app.test_api
Needs:  pip install httpx
Uses your real models and the photos in images/."""
from pathlib import Path

from fastapi.testclient import TestClient

from ai import config
from app.main import app


def test_api():
    files = sorted(p for p in Path("images").glob("*") if p.suffix.lower() in config.ALLOWED_EXTENSIONS)

    with TestClient(app) as client:                       # starts the app, loads the models
        r = client.get("/api/health")
        print("health:", r.json())
        assert r.status_code == 200 and r.json()["models_loaded"] is True

        r = client.get("/api/models")
        print("models:", [(m["name"], m["version"], m["loaded"]) for m in r.json()])
        assert len(r.json()) == 3

        # wrong file type
        r = client.post("/api/analyze", files={"file": ("notes.txt", b"hello", "text/plain")})
        print("txt upload:", r.status_code, r.json())
        assert r.status_code == 400

        # empty file
        r = client.post("/api/analyze", files={"file": ("a.jpg", b"", "image/jpeg")})
        assert r.status_code == 400

        # unknown check name
        if files:
            r = client.post("/api/analyze?run=magic", files={"file": (files[0].name, files[0].read_bytes(), "image/jpeg")})
            print("unknown check:", r.status_code, r.json())
            assert r.status_code == 400

        # a real image, full analysis
        for path in files[:3]:
            r = client.post("/api/analyze", files={"file": (path.name, path.read_bytes(), "image/jpeg")})
            assert r.status_code == 200, r.text
            body = r.json()
            print(f"\n{path.name}: status={body['status']} crack={body['crack_detected']} "
                  f"severity={body['severity']['category'] if body['severity'] else None} "
                  f"time={body['processing_time_ms']} ms")
            assert body["image_name"] == path.name
            assert body["original_image_url"].startswith("/files/uploads/")
            urls = [body["original_image_url"]]
            if body["segmentation"]:
                urls += [body["segmentation"]["mask_path"], body["segmentation"]["overlay_path"]]
            if body["detection"]:
                urls.append(body["detection"]["annotated_image_path"])
            if body["classification"] and body["classification"]["heatmap_path"]:
                urls.append(body["classification"]["heatmap_path"])
            for url in urls:                               # every result image must be downloadable
                got = client.get(url)
                assert got.status_code == 200 and got.headers["content-type"].startswith("image/"), url
            print("   result images downloadable:", len(urls))

        # only detection requested
        if files:
            r = client.post("/api/analyze?run=detection", files={"file": (files[0].name, files[0].read_bytes(), "image/jpeg")})
            body = r.json()
            print("\nrun=detection ->", "detection" if body["detection"] else "-", "| severity:", body["severity"])
            assert body["detection"] is not None and body["severity"] is None and body["classification"] is None
    print("\nAPI OK")


if __name__ == "__main__":
    test_api()