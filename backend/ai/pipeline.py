"""The whole AI pipeline: one image in, one AnalysisResult out.

Steps:  quality check -> classifier -> detector -> segmentation -> geometry
        -> combine evidence -> severity -> priority

A failing module never stops the others: its error is added to `warnings`
and its part of the result stays empty (None).
"""
import time
from pathlib import Path

from ai import config
from ai.core import registry
from ai.core.schemas import AnalysisResult
from ai.modules.classification.predictor import CrackClassifier
from ai.modules.detection.predictor import CrackDetector
from ai.modules.geometry.measure import measure
from ai.modules.priority.rules import decide_priority
from ai.modules.quality.checks import run_quality_checks
from ai.modules.segmentation.predictor import CrackSegmenter
from ai.modules.severity.rules import assess_severity, collect_evidence

ALL_STEPS = ["classification", "detection", "segmentation", "geometry", "severity"]
# a step needs these steps first (severity uses the evidence of all three models)
NEEDS = {
    "geometry": ["segmentation"],
    "severity": ["classification", "detection", "segmentation", "geometry"],
}


def resolve_steps(run=None):
    """Which steps to run. None = everything. Needed steps are added automatically."""
    if run is None:
        return set(ALL_STEPS)
    steps = set(run)
    unknown = steps - set(ALL_STEPS)
    if unknown:
        raise ValueError(f"Unknown step(s): {sorted(unknown)}. Allowed: {ALL_STEPS}")
    while True:                              # keep adding until nothing new is needed
        size = len(steps)
        for step in list(steps):
            steps.update(NEEDS.get(step, []))
        if len(steps) == size:
            return steps


class Pipeline:
    def __init__(self):
        self.classifier = CrackClassifier()
        self.detector = CrackDetector()
        self.segmenter = CrackSegmenter()
        for module in (self.classifier, self.detector, self.segmenter):
            registry.register(module)

    def load(self):
        """Load all models (only the first call does work)."""
        registry.load_all()

    def models_info(self):
        return registry.list_models()

    @staticmethod
    def _try(result, label, function):
        """Run one step. On error: add a warning and return None."""
        try:
            return function()
        except Exception as error:
            result.warnings.append(f"{label} failed: {error}")
            return None

    def analyze(self, image_path, output_dir=None, name=None, known_hashes=None, run=None):
        """Analyse one image file.

        output_dir  : where mask / overlay / boxes images are saved
        name        : start of the output file names (default: image file name)
        known_hashes: hashes of images uploaded before (duplicate warning)
        run         : list of steps, for example ["detection"]. None = everything.
        """
        started = time.perf_counter()
        steps = resolve_steps(run)
        image_path = Path(image_path)
        name = name or image_path.stem
        out = Path(output_dir) if output_dir else config.DEFAULT_OUTPUT_DIR

        # ---- 1. quality check ----
        quality, image = run_quality_checks(image_path, known_hashes)
        result = AnalysisResult(
            image_name=image_path.name,
            quality=quality,
            warnings=list(quality.warnings),
            disclaimer=config.DISCLAIMER,
            pipeline_version=config.PIPELINE_VERSION,
        )
        if not quality.passed:
            result.status = "rejected"
            result.warnings = list(quality.errors) + list(quality.warnings)
            result.processing_time_ms = round((time.perf_counter() - started) * 1000, 1)
            return result

        height, width = image.shape[:2]
        result.image_height, result.image_width = height, width
        self.load()

        # ---- 2. the three models ----
        classification = detection = segmentation = geometry = None

        if "classification" in steps:
            classification = self._try(result, "Classification", lambda: self.classifier.predict(image))
            if classification is not None:
                classification.heatmap_path = self._try(
                    result, "Grad-CAM heatmap",
                    lambda: self.classifier.explain(image, out / "overlays" / f"{name}_gradcam.jpg"))

        if "detection" in steps:
            detection = self._try(
                result, "Detection",
                lambda: self.detector.predict(image, out / "annotated" / f"{name}_boxes.jpg"))

        if "segmentation" in steps:
            outcome = self._try(
                result, "Segmentation",
                lambda: self.segmenter.predict(image, out / "masks" / f"{name}_mask.png",
                                               out / "overlays" / f"{name}_overlay.jpg"))
            if outcome is not None:
                segmentation, mask = outcome
                if "geometry" in steps:
                    geometry = self._try(result, "Geometry", lambda: measure(mask))
                    segmentation.geometry = geometry

        result.classification = classification
        result.detection = detection
        result.segmentation = segmentation

        # ---- 3. combine the models ----
        evidence = collect_evidence(classification, detection, geometry)
        result.crack_detected = evidence.crack_detected
        result.evidence = evidence.sources
        result.damage_types = evidence.damage_types

        # ---- 4. severity and priority ----
        if "severity" in steps:
            result.severity = assess_severity(height, width, evidence, geometry, quality.warnings)
            result.priority = decide_priority(result.severity, evidence)

        if not any([classification, detection, segmentation]):
            result.status = "error"          # every model failed

        result.processing_time_ms = round((time.perf_counter() - started) * 1000, 1)
        return result


_pipeline = None


def get_pipeline():
    """One shared pipeline for the whole application (models are loaded once)."""
    global _pipeline
    if _pipeline is None:
        _pipeline = Pipeline()
    return _pipeline