"""Stage 1 test. Run from project root:  python -m tests.ai.test_stage1"""
from ai import config
from ai.core.base import BaseModule
from ai.core import registry
from ai.core.schemas import (
    AnalysisResult, QualityReport, ClassificationResult,
    DetectionResult, DetectionBox, SegmentationResult, GeometryResult,
    SeverityResult, PriorityResult,
)


def test_weights_exist():
    for path in [config.CLASSIFIER_PATH, config.SEGMENTER_PATH, config.DETECTOR_PATH]:
        print(("OK      " if path.exists() else "MISSING ") + str(path))
        assert path.exists(), f"Model file nahi mili: {path}"


def test_registry():
    class Dummy(BaseModule):
        name = "dummy"
        version = "0.1"

        def _load(self):
            pass

    registry.clear()
    d = Dummy()
    registry.register(d)
    assert registry.get("dummy") is d
    assert d.is_loaded is False
    registry.load_all()
    assert d.is_loaded is True
    print("Registry:", registry.list_models())

    try:
        registry.get("nahi_hai")
        assert False, "KeyError aana chahiye tha"
    except KeyError:
        pass
    registry.clear()


def test_schema_json():
    result = AnalysisResult(
        image_name="crack.jpg",
        image_width=640,
        image_height=360,
        quality=QualityReport(passed=True, metrics={"blur_score": 120.5}),
        classification=ClassificationResult(
            label="CRACK", crack_probability=0.963, model_version=config.CLASSIFIER_VERSION),
        detection=DetectionResult(
            count=1,
            boxes=[DetectionBox(class_name="longitudinal_crack", confidence=0.81,
                                bbox=[10, 20, 200, 90])],
            model_version=config.DETECTOR_VERSION),
        segmentation=SegmentationResult(
            crack_area_percent=1.06,
            geometry=GeometryResult(length=420.0, average_width=3.2, max_width=7.0,
                                    area=1350.0, density_percent=1.06,
                                    orientation_deg=12.5, branch_points=2, crack_count=1),
            model_version=config.SEGMENTER_VERSION),
        severity=SeverityResult(category="Minor Damage", score=22.0,
                                reasons=["Thin crack", "Low crack density"]),
        priority=PriorityResult(level="Low Priority", requires_engineering_review=False,
                                reason="Minor damage"),
        disclaimer=config.DISCLAIMER,
        pipeline_version=config.PIPELINE_VERSION,
    )
    text = result.model_dump_json(indent=2)
    print(text)
    assert '"label": "CRACK"' in text


if __name__ == "__main__":
    test_weights_exist()
    test_registry()
    test_schema_json()
    print("\nStage 1 OK")