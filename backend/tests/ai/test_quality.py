"""Stage 2 test. Run from project root:  python -m tests.ai.test_quality

Part 1: synthetic images (checks that every rule works).
Part 2: your real photos from images/ (prints scores so you can tune thresholds).
"""
import tempfile
from pathlib import Path

import cv2
import numpy as np

from ai import config
from ai.modules.quality.checks import run_quality_checks, file_hash


def save(folder, name, array_rgb):
    path = Path(folder) / name
    cv2.imwrite(str(path), cv2.cvtColor(array_rgb, cv2.COLOR_RGB2BGR))
    return path


def test_synthetic():
    rng = np.random.default_rng(0)
    with tempfile.TemporaryDirectory() as tmp:
        noise = rng.integers(0, 256, (480, 640, 3), dtype=np.uint8)

        # good image
        good = save(tmp, "good.png", noise)
        report, img = run_quality_checks(good)
        print("good     :", report.passed, report.warnings)
        assert report.passed and img is not None and not report.warnings

        # too dark
        dark = save(tmp, "dark.png", (noise * 0.1).astype(np.uint8))
        report, _ = run_quality_checks(dark)
        print("dark     :", report.passed, report.warnings)
        assert report.passed and any("dark" in w for w in report.warnings)

        # blurry
        blurry = save(tmp, "blurry.png", cv2.GaussianBlur(noise, (0, 0), 8))
        report, _ = run_quality_checks(blurry)
        print("blurry   :", report.passed, report.warnings)
        assert any("blurry" in w for w in report.warnings)

        # blank
        blank = save(tmp, "blank.png", np.full((480, 640, 3), 128, dtype=np.uint8))
        report, _ = run_quality_checks(blank)
        print("blank    :", report.passed, report.warnings)
        assert any("contrast" in w for w in report.warnings)

        # too small
        tiny = save(tmp, "tiny.png", noise[:100, :100])
        report, img = run_quality_checks(tiny)
        print("tiny     :", report.passed, report.errors)
        assert not report.passed and img is None

        # wrong format
        txt = Path(tmp) / "notes.txt"
        txt.write_text("hello")
        report, img = run_quality_checks(txt)
        print("wrong ext:", report.passed, report.errors)
        assert not report.passed and img is None

        # corrupt file with .jpg name
        bad = Path(tmp) / "bad.jpg"
        bad.write_bytes(b"this is not an image" * 50)
        report, img = run_quality_checks(bad)
        print("corrupt  :", report.passed, report.errors)
        assert not report.passed and img is None

        # missing file
        report, img = run_quality_checks(Path(tmp) / "nahi_hai.jpg")
        print("missing  :", report.passed, report.errors)
        assert not report.passed

        # duplicate
        known = {file_hash(good)}
        report, _ = run_quality_checks(good, known_hashes=known)
        print("duplicate:", report.passed, report.warnings)
        assert report.passed and any("duplicate" in w for w in report.warnings)


def test_real_images():
    folder = Path("images")
    files = sorted(p for p in folder.glob("*") if p.suffix.lower() in config.ALLOWED_EXTENSIONS)
    if not files:
        print("images/ folder mein photo nahi mili, part 2 skip")
        return
    print("\n--- Real photos ---")
    for p in files:
        report, _ = run_quality_checks(p)
        m = report.metrics
        print(f"{p.name:25s} passed={report.passed}  "
              f"size={m.get('width')}x{m.get('height')}  "
              f"blur={m.get('blur_score')}  bright={m.get('brightness')}  contrast={m.get('contrast')}")
        for w in report.warnings:
            print("    warning:", w)
        for e in report.errors:
            print("    ERROR  :", e)


if __name__ == "__main__":
    test_synthetic()
    test_real_images()
    print("\nStage 2 OK")