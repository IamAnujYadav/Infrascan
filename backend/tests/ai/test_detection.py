"""Stage 4 test. Run from project root:  python -m tests.ai.test_detection

Note: this YOLO model was trained on ROAD images (RDD2022). On wall or concrete
photos it can give 0 detections. That is normal, not a bug.
"""
from pathlib import Path

import numpy as np

from ai import config
from ai.modules.detection.predictor import CrackDetector
from ai.modules.quality.checks import load_image

OUT = Path("test_outputs")


def test_synthetic(detector):
    """A random image must not crash anything."""
    rng = np.random.default_rng(0)
    image = rng.integers(0, 256, (480, 640, 3), dtype=np.uint8)
    result = detector.predict(image, OUT / "yolo_synthetic.jpg")
    print("synthetic: detections =", result.count)
    assert result.count == len(result.boxes)
    assert Path(result.annotated_image_path).exists()


def test_real_images(detector):
    files = sorted(p for p in Path("images").glob("*")
                   if p.suffix.lower() in config.ALLOWED_EXTENSIONS)
    if not files:
        print("images/ folder khali hai, real photo test skip")
        return
    print("\n--- Real photos ---")
    for p in files:
        image = load_image(p)
        result = detector.predict(image, OUT / f"{p.stem}_yolo.jpg")
        print(f"{p.name:25s} detections={result.count}")
        for box in result.boxes:
            print(f"      {box.class_name:20s} conf={box.confidence:.2f}  bbox={box.bbox}")


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    detector = CrackDetector()
    detector.load()
    print("Classes:", detector.class_names)
    test_synthetic(detector)
    test_real_images(detector)
    print("\nStage 4 OK")