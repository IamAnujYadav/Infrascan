"""Stage 7 test. Run from project root:  python -m tests.ai.test_severity

Uses the real numbers from your own test photos (classifier, YOLO, geometry),
so no model is needed."""
from ai.core.schemas import (ClassificationResult, DetectionBox, DetectionResult, GeometryResult)
from ai.modules.priority.rules import decide_priority
from ai.modules.severity.rules import assess_severity, collect_evidence


def clf(label, prob):
    return ClassificationResult(label=label, crack_probability=prob, model_version="v1.0")


def det(*boxes):
    return DetectionResult(
        count=len(boxes),
        boxes=[DetectionBox(class_name=n, confidence=c, bbox=[0, 0, 10, 10]) for n, c in boxes],
        model_version="v1.1")


def geo(length, avg_w, max_w, density, branches, pieces, angle, label):
    return GeometryResult(length=length, average_width=avg_w, max_width=max_w, area=0.0,
                          density_percent=density, orientation_deg=angle, orientation_label=label,
                          branch_points=branches, crack_count=pieces)


# name: (height, width, classification, detection, geometry, expected category, expected priority)
CASES = {
    "blur.jpg": (750, 1121, clf("NO_CRACK", 0.0858),
                 det(("longitudinal_crack", 0.81), ("longitudinal_crack", 0.70)), None,
                 "Minor Damage", "Low Priority"),
    "crack.jpg": (493, 740, clf("CRACK", 1.0),
                  det(("longitudinal_crack", 0.79), ("transverse_crack", 0.47),
                      ("longitudinal_crack", 0.42), ("longitudinal_crack", 0.28)),
                  geo(589.0, 6.15, 12.18, 1.10, 0, 4, 55.3, "diagonal"),
                  "Moderate Damage", "Medium Priority"),
    "crack1.jpg": (346, 887, clf("CRACK", 0.9686), det(("pothole", 0.43)),
                   geo(237.4, 8.34, 13.39, 0.73, 0, 2, 133.7, "diagonal"),
                   "Moderate Damage", "Medium Priority"),
    "noncrack.jpg": (280, 347, clf("NO_CRACK", 0.0014), det(), None,
                     "No Visible Damage", "Routine Monitoring"),
    "noncrack1.jpg": (836, 1254, clf("NO_CRACK", 0.0003), det(), None,
                      "No Visible Damage", "Routine Monitoring"),
    "crack-pothole.jpg": (449, 800, None,
                          det(("alligator_crack", 0.69), ("pothole", 0.56), ("pothole", 0.44)),
                          geo(74.7, 9.47, 14.59, 0.22, 1, 1, 84.0, "vertical"),
                          "Severe Damage", "High Priority"),
}


def test_cases():
    for name, (h, w, c, d, g, want_category, want_priority) in CASES.items():
        evidence = collect_evidence(c, d, g)
        severity = assess_severity(h, w, evidence, g)
        priority = decide_priority(severity, evidence)
        print(f"\n{name}")
        print(f"   crack_detected={evidence.crack_detected}  sources={evidence.sources}  types={evidence.damage_types}")
        print(f"   severity: {severity.category}  (score {severity.score})")
        for reason in severity.reasons:
            print("      -", reason)
        print(f"   priority: {priority.level} | engineer review: {priority.requires_engineering_review}")
        assert severity.category == want_category, f"{name}: {severity.category} != {want_category}"
        assert priority.level == want_priority


def test_quality_warning_and_floor():
    evidence = collect_evidence(clf("CRACK", 0.9), det(), None)      # classifier only, no size
    severity = assess_severity(500, 700, evidence, None, quality_warnings=["Image looks blurry."])
    print("\nclassifier only:", severity.category, severity.score, severity.reasons)
    assert severity.category == "Minor Damage" and severity.score == 5.0
    assert any("blurry" in r for r in severity.reasons)


if __name__ == "__main__":
    test_cases()
    test_quality_warning_and_floor()
    print("\nStage 7 OK")