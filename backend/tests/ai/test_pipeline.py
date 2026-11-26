"""Stage 8 test. Run from project root:  python -m tests.ai.test_pipeline"""
import tempfile
from pathlib import Path

import cv2
import numpy as np

from ai import config
from ai.core.schemas import AnalysisResult
from ai.pipeline import get_pipeline, resolve_steps


def test_resolve_steps():
    """No model needed."""
    assert resolve_steps(None) == {"classification", "detection", "segmentation", "geometry", "severity"}
    assert resolve_steps(["detection"]) == {"detection"}
    assert resolve_steps(["geometry"]) == {"geometry", "segmentation"}
    assert resolve_steps(["severity"]) == {"classification", "detection", "segmentation", "geometry", "severity"}
    try:
        resolve_steps(["magic"])
        assert False, "ValueError aana chahiye tha"
    except ValueError:
        pass
    print("resolve_steps OK")


def test_rejected_image(pipeline):
    """A tiny image is rejected before any model runs."""
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "tiny.png"
        cv2.imwrite(str(path), np.random.default_rng(0).integers(0, 256, (100, 100, 3), dtype=np.uint8))
        result = pipeline.analyze(path, output_dir=tmp)
    print("tiny image:", result.status, result.warnings)
    assert result.status == "rejected"
    assert result.classification is None and result.severity is None


def test_custom_run(pipeline, image_path):
    """Only detection requested: the other parts stay empty."""
    result = pipeline.analyze(image_path, output_dir="test_outputs/pipeline", run=["detection"])
    print("custom run [detection]:", result.status, "| detection:", result.detection is not None,
          "| classification:", result.classification, "| severity:", result.severity)
    assert result.detection is not None
    assert result.classification is None and result.segmentation is None and result.severity is None


def test_full_run(pipeline, files):
    print("\n--- Full analysis ---")
    seen = set()
    for path in files:
        result = pipeline.analyze(path, output_dir="test_outputs/pipeline", known_hashes=seen)
        again = AnalysisResult.model_validate_json(result.model_dump_json())    # JSON round trip
        assert again.image_name == result.image_name
        severity = result.severity.category if result.severity else "-"
        print(f"{path.name:22s} {result.status:6s} crack={str(result.crack_detected):5s} "
              f"by={result.evidence}  severity={severity}  {result.processing_time_ms:.0f} ms")
        for warning in result.warnings:
            print("      warning:", warning)
        assert result.status == "ok"


if __name__ == "__main__":
    test_resolve_steps()
    pipeline = get_pipeline()
    test_rejected_image(pipeline)
    files = sorted(p for p in Path("images").glob("*") if p.suffix.lower() in config.ALLOWED_EXTENSIONS)
    if files:
        test_custom_run(pipeline, files[0])
        test_full_run(pipeline, files)
    else:
        print("images/ folder khali hai, model tests skip")
    print("\nStage 8 OK")