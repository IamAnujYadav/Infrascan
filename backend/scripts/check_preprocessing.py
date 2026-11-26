"""Compare 3 preprocessing options on your photos.
Run from project root:  python -m scripts.check_preprocessing"""
from pathlib import Path

from ai import config
from ai.modules.classification.predictor import CrackClassifier
from ai.modules.quality.checks import load_image

OPTIONS = {
    "none (0-255)": (False, False),
    "div 255": (False, True),
    "resnet preprocess_input": (True, False),
}

classifier = CrackClassifier()
classifier.load()

files = sorted(p for p in Path("images").glob("*")
               if p.suffix.lower() in config.ALLOWED_EXTENSIONS)
if not files:
    raise SystemExit("images/ folder mein photos daalo")

for p in files:
    image = load_image(p)
    row = []
    for name, (use_pre, div255) in OPTIONS.items():
        config.CLASSIFIER_USE_PREPROCESS = use_pre
        config.CLASSIFIER_DIV_255 = div255
        prob = classifier.predict(image).crack_probability
        row.append(f"{name}: {prob:.3f}")
    print(f"{p.name:25s} " + " | ".join(row))