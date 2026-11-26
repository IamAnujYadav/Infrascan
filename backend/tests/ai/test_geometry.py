"""Stage 6 test. Run from project root:  python -m tests.ai.test_geometry

Part 1: drawn cracks with known size (no model needed).
Part 2: your real photos through U-Net + geometry (needs images/ folder).
"""
from pathlib import Path

import cv2
import numpy as np

from ai import config
from ai.modules.geometry.measure import measure
from ai.modules.quality.checks import load_image
from ai.modules.segmentation import postprocess

OUT = Path("test_outputs")


def blank(h=400, w=600):
    return np.zeros((h, w), dtype=np.uint8)


def test_horizontal_line():
    mask = blank()
    cv2.line(mask, (50, 200), (549, 200), 1, thickness=5)           # about 500 px long
    real_width = int(mask[:, 300].sum())          # cv2 draws a little thicker than asked
    g = measure(mask)
    print("horizontal:", g.length, g.average_width, g.orientation_deg, g.orientation_label)
    assert abs(g.length - 500) <= 15
    assert abs(g.average_width - real_width) <= 1
    assert g.orientation_label == "horizontal"
    assert g.crack_count == 1 and g.branch_points == 0
    assert abs(g.density_percent - g.area / (400 * 600) * 100) < 0.01


def test_vertical_line():
    mask = blank()
    cv2.line(mask, (300, 30), (300, 369), 1, thickness=3)
    g = measure(mask)
    print("vertical  :", g.length, g.average_width, g.orientation_deg, g.orientation_label)
    assert g.orientation_label == "vertical"
    assert abs(g.length - 340) <= 12


def test_diagonal_line():
    mask = blank()
    cv2.line(mask, (100, 350), (400, 50), 1, thickness=3)           # goes up and to the right
    g = measure(mask)
    print("diagonal  :", g.length, g.average_width, g.orientation_deg, g.orientation_label)
    assert g.orientation_label == "diagonal"
    assert abs(g.orientation_deg - 45) <= 5
    assert abs(g.length - 424) <= 20


def test_branches():
    mask = blank()
    cv2.line(mask, (50, 200), (550, 200), 1, thickness=3)
    cv2.line(mask, (300, 50), (300, 350), 1, thickness=3)           # a plus sign
    g = measure(mask)
    print("plus sign :", "branch points =", g.branch_points)
    assert g.branch_points >= 1 and g.crack_count == 1


def test_empty_mask():
    assert measure(blank()) is None
    print("empty mask -> None OK")


def test_filter_blob_vs_line():
    mask = blank(400, 600)
    cv2.line(mask, (50, 100), (550, 130), 1, thickness=4)           # thin long line = crack
    cv2.ellipse(mask, (300, 300), (110, 40), 0, 0, 360, 1, -1)      # thick blob = not a crack
    kept = postprocess.keep_crack_like(mask)
    print("filter    : line kept =", bool(kept[115, 300]), "| blob kept =", bool(kept[300, 300]))
    assert kept[115, 300] == 1
    assert kept[300, 300] == 0


def test_real_images():
    from ai.modules.segmentation.predictor import CrackSegmenter
    files = sorted(p for p in Path("images").glob("*")
                   if p.suffix.lower() in config.ALLOWED_EXTENSIONS)
    if not files:
        print("images/ folder khali hai, real photo test skip")
        return
    print("\n--- Real photos (U-Net + crack filter + geometry) ---")
    OUT.mkdir(exist_ok=True)
    segmenter = CrackSegmenter()
    segmenter.load()
    for p in files:
        image = load_image(p)
        result, mask = segmenter.predict(image, OUT / f"{p.stem}_mask.png", OUT / f"{p.stem}_seg_overlay.jpg")
        g = measure(mask)
        if g is None:
            print(f"{p.name:22s} crack_area={result.crack_area_percent:5.2f}%  -> no crack-like piece found")
        else:
            print(f"{p.name:22s} crack_area={result.crack_area_percent:5.2f}%  pieces={g.crack_count}  "
                  f"length={g.length:7.1f}px  avg_w={g.average_width:5.2f}  max_w={g.max_width:5.2f}  "
                  f"angle={g.orientation_deg} ({g.orientation_label})  branches={g.branch_points}")


if __name__ == "__main__":
    test_horizontal_line()
    test_vertical_line()
    test_diagonal_line()
    test_branches()
    test_empty_mask()
    test_filter_blob_vs_line()
    test_real_images()
    print("\nStage 6 OK")