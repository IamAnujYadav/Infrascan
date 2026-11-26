"""U-Net crack segmentation (trained on Crack500)."""
from pathlib import Path

import cv2
import numpy as np
from tensorflow import keras

from ai import config
from ai.core.base import BaseModule
from ai.core.schemas import SegmentationResult
from ai.modules.segmentation import postprocess


class CrackSegmenter(BaseModule):
    name = "segmentation"
    version = config.SEGMENTER_VERSION
    weights_path = config.SEGMENTER_PATH

    def _load(self):
        self.model = keras.models.load_model(self.weights_path, compile=False)
        self.input_size = self.model.input_shape[1:3]      # (height, width)

    def _prepare(self, image_rgb):
        """Resize and scale the image exactly like in training."""
        h, w = self.input_size
        x = cv2.resize(image_rgb, (w, h)).astype("float32")
        if config.SEGMENTER_USE_PREPROCESS:
            x = keras.applications.resnet50.preprocess_input(x)
        elif config.SEGMENTER_DIV_255:
            x = x / 255.0
        return x[None]

    def probability_map(self, image_rgb):
        """Crack probability for every pixel of the ORIGINAL image (values 0 to 1)."""
        out = self.model.predict(self._prepare(image_rgb), verbose=0)[0]
        prob = out[..., 0] if out.ndim == 3 else out
        h, w = image_rgb.shape[:2]
        return cv2.resize(prob.astype("float32"), (w, h), interpolation=cv2.INTER_LINEAR)

    def predict(self, image_rgb, mask_path=None, overlay_path=None):
        """Returns (SegmentationResult, mask).
        mask is a uint8 array (0 / 1) with the same size as the image.
        The geometry module (Stage 6) uses this mask to measure the crack."""
        self.ensure_loaded()

        prob = self.probability_map(image_rgb)
        binary = (prob >= config.SEGMENTER_THRESHOLD).astype(np.uint8)
        mask = postprocess.clean_mask(binary)          # remove tiny noise
        mask = postprocess.keep_crack_like(mask)       # remove thick blobs

        saved_mask = saved_overlay = None
        if mask_path is not None:
            Path(mask_path).parent.mkdir(parents=True, exist_ok=True)
            cv2.imwrite(str(mask_path), mask * 255)
            saved_mask = str(mask_path)
        if overlay_path is not None:
            Path(overlay_path).parent.mkdir(parents=True, exist_ok=True)
            overlay = postprocess.draw_overlay(image_rgb, mask)
            cv2.imwrite(str(overlay_path), cv2.cvtColor(overlay, cv2.COLOR_RGB2BGR))
            saved_overlay = str(overlay_path)

        result = SegmentationResult(
            crack_area_percent=round(float(mask.mean() * 100), 2),
            mask_path=saved_mask,
            overlay_path=saved_overlay,
            model_version=self.version,
        )
        return result, mask