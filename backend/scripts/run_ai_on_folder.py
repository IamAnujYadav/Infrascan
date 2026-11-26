"""Run the whole AI pipeline on every photo of a folder.

Run from project root:
    python -m scripts.run_ai_on_folder                      (uses images/)
    python -m scripts.run_ai_on_folder my_photos  my_output

For every photo it saves a JSON file and the result images
(mask, overlay, boxes, Grad-CAM) in the output folder."""
import sys
from pathlib import Path

from ai import config
from ai.pipeline import get_pipeline


def main():
    folder = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("images")
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("test_outputs/pipeline")
    files = sorted(p for p in folder.glob("*") if p.suffix.lower() in config.ALLOWED_EXTENSIONS)
    if not files:
        raise SystemExit(f"{folder} mein koi photo nahi mili")

    (out / "json").mkdir(parents=True, exist_ok=True)
    pipeline = get_pipeline()
    pipeline.load()

    seen_hashes = set()
    for path in files:
        result = pipeline.analyze(path, output_dir=out, known_hashes=seen_hashes)
        if result.quality and result.quality.metrics.get("file_hash"):
            seen_hashes.add(result.quality.metrics["file_hash"])

        (out / "json" / f"{path.stem}.json").write_text(result.model_dump_json(indent=2), encoding="utf-8")

        severity = result.severity.category if result.severity else "-"
        priority = result.priority.level if result.priority else "-"
        print(f"{path.name:22s} {result.status:8s} crack={str(result.crack_detected):5s} "
              f"by={','.join(result.evidence) or '-':32s} severity={severity:20s} "
              f"priority={priority:26s} {result.processing_time_ms:7.0f} ms")
        for warning in result.warnings:
            print("      warning:", warning)

    print(f"\nJSON aur images yahan hain: {out}")


if __name__ == "__main__":
    main()