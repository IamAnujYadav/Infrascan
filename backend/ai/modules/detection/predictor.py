"""YOLO detector: crack types and potholes (trained on RDD2022 road images)."""
from pathlib import Path

import cv2
import numpy as np

from ai import config
from ai.core.base import BaseModule
from ai.core.schemas import DetectionBox, DetectionResult


class CrackDetector(BaseModule):
    name = "detection"
    version = config.DETECTOR_VERSION
    weights_path = config.DETECTOR_PATH

    def _load(self):
        from ultralytics import YOLO
        self.model = YOLO(str(self.weights_path))
        self.class_names = self.model.names          # {0: 'longitudinal_crack', ...}

    def predict(self, image_rgb, annotated_path=None) -> DetectionResult:
        """Find cracks / potholes. If annotated_path is given, the image with
        boxes drawn on it is saved there."""
        self.ensure_loaded()

        # ultralytics expects OpenCV style images (BGR), ours is RGB
        image_bgr = np.ascontiguousarray(image_rgb[:, :, ::-1])
        result = self.model(image_bgr, conf=config.DETECTOR_CONF, verbose=False)[0]

        boxes = []
        for b in result.boxes:
            class_id = int(b.cls[0])
            confidence = float(b.conf[0])
            boxes.append(DetectionBox(
                class_name=self.class_names[class_id],
                confidence=round(confidence, 4),
                bbox=[round(v, 1) for v in b.xyxy[0].tolist()],   # x1, y1, x2, y2 pixels
                low_confidence=confidence < config.DETECTOR_LOW_CONF,
            ))
        boxes.sort(key=lambda box: box.confidence, reverse=True)

        saved_path = None
        if annotated_path is not None:
            Path(annotated_path).parent.mkdir(parents=True, exist_ok=True)
            cv2.imwrite(str(annotated_path), result.plot())      # plot() returns BGR
            saved_path = str(annotated_path)

        return DetectionResult(
            count=len(boxes),
            boxes=boxes,
            annotated_image_path=saved_path,
            model_version=self.version,
        )