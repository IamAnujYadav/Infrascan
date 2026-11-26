"""Compare 3 preprocessing options for the U-Net and save overlay images.
Run from project root:  python -m scripts.check_seg_preprocessing

Open test_outputs/ and look at the overlays: the right option paints the red
mask on the crack line only. A wrong option paints nothing or paints everything."""
from pathlib import Path

import cv2
import numpy as np

from ai import config
from ai.modules.quality.checks import load_image
from ai.modules.segmentation import postprocess
from ai.modules.segmentation.predictor import CrackSegmenter

OPTIONS = {
    "none": (False, False),
    "div255": (False, True),
    "resnetpre": (True, False),
}
OUT = Path("test_outputs")
OUT.mkdir(exist_ok=True)

segmenter = CrackSegmenter()
segmenter.load()

files = sorted(p for p in Path("images").glob("*")
               if p.suffix.lower() in config.ALLOWED_EXTENSIONS)
if not files:
    raise SystemExit("images/ folder mein photos daalo")

for p in files:
    image = load_image(p)
    for name, (use_pre, div255) in OPTIONS.items():
        config.SEGMENTER_USE_PREPROCESS = use_pre
        config.SEGMENTER_DIV_255 = div255
        prob = segmenter.probability_map(image)
        mask = postprocess.clean_mask((prob >= config.SEGMENTER_THRESHOLD).astype(np.uint8))
        overlay = postprocess.draw_overlay(image, mask)
        out_file = OUT / f"segcheck_{p.stem}_{name}.jpg"
        cv2.imwrite(str(out_file), cv2.cvtColor(overlay, cv2.COLOR_RGB2BGR))
        print(f"{p.name:22s} {name:10s} max_prob={prob.max():.3f}  crack_area={mask.mean() * 100:6.2f}%  -> {out_file.name}")