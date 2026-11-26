"""Stage 5 test. Run from project root:  python -m tests.ai.test_segmentation"""
from pathlib import Path

import cv2
import numpy as np

from ai import config
from ai.modules.quality.checks import load_image
from ai.modules.segmentation import postprocess
from ai.modules.segmentation.predictor import CrackSegmenter

OUT = Path("test_outputs")


def test_clean_mask():
    """Long thin line must stay, a tiny dot must go (no model needed)."""
    binary = np.zeros((200, 200), dtype=np.uint8)
    binary[100, 20:180] = 1            # thin line, 160 pixels
    binary[10:12, 10:12] = 1           # tiny 2x2 dot (noise)
    cleaned = postprocess.clean_mask(binary, min_fraction=0.0002)   # min piece = 8 pixels
    assert cleaned[100, 100] == 1, "line hat gayi"
    assert cleaned[10, 10] == 0, "noise dot nahi hata"
    assert set(np.unique(cleaned)) <= {0, 1}
    print("clean_mask OK: line kept, dot removed")


def test_synthetic(segmenter):
    """A random image must not crash anything."""
    rng = np.random.default_rng(0)
    image = rng.integers(0, 256, (360, 640, 3), dtype=np.uint8)
    result, mask = segmenter.predict(image, OUT / "seg_synthetic_mask.png", OUT / "seg_synthetic_overlay.jpg")
    print("synthetic: crack area % =", result.crack_area_percent)
    assert mask.shape == image.shape[:2]
    assert Path(result.mask_path).exists() and Path(result.overlay_path).exists()


def test_real_images(segmenter):
    files = sorted(p for p in Path("images").glob("*")
                   if p.suffix.lower() in config.ALLOWED_EXTENSIONS)
    if not files:
        print("images/ folder khali hai, real photo test skip")
        return
    print("\n--- Real photos ---")
    for p in files:
        image = load_image(p)
        prob = segmenter.probability_map(image)
        result, mask = segmenter.predict(
            image, OUT / f"{p.stem}_mask.png", OUT / f"{p.stem}_seg_overlay.jpg")
        pieces = cv2.connectedComponents(mask, connectivity=8)[0] - 1
        print(f"{p.name:25s} max_prob={prob.max():.3f}  crack_area={result.crack_area_percent:5.2f}%  pieces={pieces}")


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    test_clean_mask()
    segmenter = CrackSegmenter()
    segmenter.load()
    print("Input size:", segmenter.input_size, "| output shape:", segmenter.model.output_shape)
    test_synthetic(segmenter)
    test_real_images(segmenter)
    print("\nStage 5 OK")
    