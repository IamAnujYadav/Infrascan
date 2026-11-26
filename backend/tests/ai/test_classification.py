"""Stage 3 test. Run from project root:  python -m tests.ai.test_classification"""
from pathlib import Path

import numpy as np

from ai import config
from ai.modules.classification.predictor import CrackClassifier
from ai.modules.quality.checks import load_image

OUT = Path("test_outputs")


def show_structure(classifier):
    print("Input size:", classifier.input_size)
    print("Model layers:")
    for layer in classifier.model.layers:
        print("   ", layer.name, "|", type(layer).__name__)


def test_synthetic(classifier):
    """A random image must not crash anything (checks shapes and Grad-CAM)."""
    rng = np.random.default_rng(0)
    image = rng.integers(0, 256, (360, 640, 3), dtype=np.uint8)
    result = classifier.predict(image)
    print("synthetic:", result.label, result.crack_probability)
    assert 0.0 <= result.crack_probability <= 1.0

    OUT.mkdir(exist_ok=True)
    path = classifier.explain(image, OUT / "gradcam_synthetic.jpg")
    assert Path(path).exists()
    print("Grad-CAM saved:", path)


def test_real_images(classifier):
    files = sorted(p for p in Path("images").glob("*")
                   if p.suffix.lower() in config.ALLOWED_EXTENSIONS)
    if not files:
        print("images/ folder khali hai, real photo test skip")
        return
    print("\n--- Real photos ---")
    OUT.mkdir(exist_ok=True)
    for p in files:
        image = load_image(p)
        result = classifier.predict(image)
        heatmap = classifier.explain(image, OUT / f"{p.stem}_gradcam.jpg")
        print(f"{p.name:25s} {result.label:9s} prob={result.crack_probability:.4f}  gradcam={heatmap}")


if __name__ == "__main__":
    classifier = CrackClassifier()
    classifier.load()
    show_structure(classifier)
    test_synthetic(classifier)
    test_real_images(classifier)
    print("\nStage 3 OK")