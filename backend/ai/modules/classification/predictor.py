"""ResNet50 (fine-tuned) crack / no-crack classifier."""
from pathlib import Path

import cv2
import numpy as np
from tensorflow import keras

from ai import config
from ai.core.base import BaseModule
from ai.core.schemas import ClassificationResult
from ai.modules.classification import explain


class CrackClassifier(BaseModule):
    name = "classification"
    version = config.CLASSIFIER_VERSION
    weights_path = config.CLASSIFIER_PATH

    def _load(self):
        self.model = keras.models.load_model(self.weights_path, compile=False)
        self.input_size = self.model.input_shape[1:3]      # (height, width)

    def _prepare(self, image_rgb):
        """Resize and scale the image exactly like in training."""
        h, w = self.input_size
        x = cv2.resize(image_rgb, (w, h)).astype("float32")
        if config.CLASSIFIER_USE_PREPROCESS:
            x = keras.applications.resnet50.preprocess_input(x)
        elif config.CLASSIFIER_DIV_255:
            x = x / 255.0
        return x[None]                                      # add batch dimension

    def predict(self, image_rgb) -> ClassificationResult:
        self.ensure_loaded()
        out = self.model.predict(self._prepare(image_rgb), verbose=0)[0]
        # one sigmoid value, or two softmax values (index 1 = crack)
        probability = float(out[0]) if out.shape[-1] == 1 else float(out[1])
        label = "CRACK" if probability >= config.CLASSIFIER_THRESHOLD else "NO_CRACK"
        return ClassificationResult(
            label=label,
            crack_probability=round(probability, 4),
            model_version=self.version,
        )

    def explain(self, image_rgb, out_path):
        """Save a Grad-CAM image. Returns the saved path."""
        self.ensure_loaded()
        Path(out_path).parent.mkdir(parents=True, exist_ok=True)
        heatmap = explain.compute_heatmap(self.model, self._prepare(image_rgb))
        return explain.save_overlay(image_rgb, heatmap, out_path)