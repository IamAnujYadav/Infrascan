"""Rule-based damage severity (spec module 10).

IMPORTANT: every number in the RULES block below is PROVISIONAL.
The spec says severity limits must be validated by a qualified engineer
against the applicable standard and the type of structure.
Until then the result is only an inspection aid, never a safety verdict.

Without a calibrated scale we cannot measure in mm, so the rules use
scale-free values: length compared to the image diagonal, width compared
to the image short side, and crack density (% of the image).
"""
import math
from dataclasses import dataclass
from typing import List

from ai.core.schemas import SeverityResult

# ======================= RULES (provisional) =======================
DETECTOR_CRACK_CLASSES = {"longitudinal_crack", "transverse_crack", "alligator_crack"}
DETECTOR_EVIDENCE_CONF = 0.5     # a detector box counts as evidence only above this confidence

LENGTH_SCALE, LENGTH_MAX = 40, 25      # points per 1.0 of (length / image diagonal), max points
DENSITY_SCALE, DENSITY_MAX = 7.5, 15   # points per 1% crack density
WIDTH_SCALE, WIDTH_MAX = 300, 15       # points per 1.0 of (max width / image short side)
BRANCH_EACH, BRANCH_MAX = 3, 10        # points per branch point (crack network)
ALLIGATOR_POINTS = 20                  # alligator (map) cracking
POTHOLE_POINTS = 25                    # pothole
DETECTION_ONLY_EACH, DETECTION_ONLY_MAX = 5, 15   # when only the detector saw the crack (no mask)
MIN_POINTS_IF_FOUND = 5

CRITICAL = "Critical / Requires Urgent Engineering Review"
LEVELS = [                              # score at or above -> category
    (70, CRITICAL),
    (45, "Severe Damage"),
    (20, "Moderate Damage"),
    (1, "Minor Damage"),
]
NONE = "No Visible Damage"
# ===================================================================


@dataclass
class Evidence:
    """What the three models found, combined."""
    crack_detected: bool
    damage_found: bool          # crack OR pothole
    sources: List[str]          # classifier / detector / segmentation
    damage_types: List[str]
    crack_boxes: int
    has_alligator: bool
    has_pothole: bool


def collect_evidence(classification, detection, geometry) -> Evidence:
    """Combine the models. A crack counts as found if ANY model reports it,
    because no single model works on every kind of photo."""
    sources, damage_types = [], []
    crack_boxes = 0
    has_alligator = has_pothole = False

    if classification is not None and classification.label == "CRACK":
        sources.append("classifier")

    if detection is not None:
        for box in detection.boxes:
            if box.confidence < DETECTOR_EVIDENCE_CONF:
                continue
            if box.class_name in DETECTOR_CRACK_CLASSES:
                crack_boxes += 1
            has_alligator = has_alligator or box.class_name == "alligator_crack"
            has_pothole = has_pothole or box.class_name == "pothole"
            if box.class_name not in damage_types:
                damage_types.append(box.class_name)
        if crack_boxes:
            sources.append("detector")

    if geometry is not None:
        sources.append("segmentation")

    crack_detected = len(sources) > 0
    if crack_detected and not any(t in DETECTOR_CRACK_CLASSES for t in damage_types):
        damage_types.insert(0, "crack")

    return Evidence(
        crack_detected=crack_detected,
        damage_found=crack_detected or has_pothole,
        sources=sources,
        damage_types=damage_types,
        crack_boxes=crack_boxes,
        has_alligator=has_alligator,
        has_pothole=has_pothole,
    )


def assess_severity(image_height, image_width, evidence, geometry=None, quality_warnings=()):
    """Return SeverityResult. 'reasons' lists every rule that added points."""
    if not evidence.damage_found:
        return SeverityResult(category=NONE, score=0.0,
                              reasons=["No crack or surface damage was found by the models."])

    diagonal = math.hypot(image_height, image_width)
    short_side = min(image_height, image_width)
    points, reasons = 0.0, []

    def add(value, text):
        nonlocal points
        points += value
        reasons.append(f"{text} (+{value:.0f})")

    if geometry is not None:
        length_share = geometry.length / diagonal
        add(min(LENGTH_MAX, LENGTH_SCALE * length_share),
            f"Crack length is {length_share * 100:.0f}% of the image diagonal")
        add(min(DENSITY_MAX, DENSITY_SCALE * geometry.density_percent),
            f"Cracks cover {geometry.density_percent:.2f}% of the image")
        width_share = geometry.max_width / short_side
        add(min(WIDTH_MAX, WIDTH_SCALE * width_share),
            f"Widest part is {width_share * 100:.1f}% of the image short side")
        if geometry.branch_points > 0:
            add(min(BRANCH_MAX, BRANCH_EACH * geometry.branch_points),
                f"Crack branches {geometry.branch_points} time(s)")
    elif evidence.crack_boxes > 0:
        add(min(DETECTION_ONLY_MAX, DETECTION_ONLY_EACH * evidence.crack_boxes),
            f"{evidence.crack_boxes} crack box(es) found by the detector, size not measured")

    if evidence.has_alligator:
        add(ALLIGATOR_POINTS, "Alligator (map) cracking found")
    if evidence.has_pothole:
        add(POTHOLE_POINTS, "Pothole found")

    if points < MIN_POINTS_IF_FOUND:
        points = MIN_POINTS_IF_FOUND
        reasons.append("Damage was reported but its size could not be measured (minimum score used)")

    points = min(100.0, points)
    category = next(name for limit, name in LEVELS if points >= limit)

    if len(evidence.sources) == 1 and evidence.crack_detected:
        reasons.append(f"Only the {evidence.sources[0]} reported the crack. Please verify it by eye.")
    if quality_warnings:
        reasons.append("Image quality lowers reliability: " + "; ".join(quality_warnings))

    return SeverityResult(category=category, score=round(points, 1), reasons=reasons)