"""Image quality checks (spec modules 3 and 4).

Errors   -> analysis must stop (bad format, corrupt file, too small, ...).
Warnings -> analysis continues, but the result is less reliable
            (blurry, too dark, duplicate, ...).
"""
import hashlib
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageOps

from ai import config
from ai.core.schemas import QualityReport


def file_hash(path) -> str:
    """MD5 of the file. Used to detect duplicate uploads."""
    md5 = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            md5.update(chunk)
    return md5.hexdigest()


def load_image(path):
    """Read an image as RGB uint8 array (H, W, 3). Phone rotation (EXIF) is fixed."""
    with Image.open(path) as img:
        img = ImageOps.exif_transpose(img)
        img = img.convert("RGB")
        return np.array(img)


def blur_score(image_rgb) -> float:
    """Variance of Laplacian. Higher = sharper. Image is resized first so
    the score does not depend on the photo resolution."""
    gray = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2GRAY)
    h, w = gray.shape
    if w != config.BLUR_CHECK_WIDTH:
        scale = config.BLUR_CHECK_WIDTH / w
        new_h = max(1, int(h * scale))
        gray = cv2.resize(gray, (config.BLUR_CHECK_WIDTH, new_h), interpolation=cv2.INTER_AREA)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def brightness_and_contrast(image_rgb):
    """Mean brightness (0-255) and contrast (std of brightness)."""
    gray = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2GRAY)
    return float(gray.mean()), float(gray.std())


def run_quality_checks(path, known_hashes=None):
    """Check one image file.

    known_hashes: hashes of images already uploaded (for duplicate warning).
    Returns (QualityReport, image_rgb). image_rgb is None if the check failed.
    """
    path = Path(path)
    errors, warnings, metrics = [], [], {}

    # 1. file exists
    if not path.exists():
        return QualityReport(passed=False, errors=["File not found."]), None

    # 2. format and file size
    ext = path.suffix.lower()
    metrics["extension"] = ext
    if ext not in config.ALLOWED_EXTENSIONS:
        allowed = ", ".join(sorted(config.ALLOWED_EXTENSIONS))
        errors.append(f"Unsupported file format '{ext}'. Allowed: {allowed}.")

    size_mb = path.stat().st_size / (1024 * 1024)
    metrics["file_size_mb"] = round(size_mb, 2)
    if size_mb == 0:
        errors.append("File is empty.")
    elif size_mb > config.MAX_FILE_SIZE_MB:
        errors.append(f"File is too large ({size_mb:.1f} MB). Maximum is {config.MAX_FILE_SIZE_MB} MB.")

    if errors:
        return QualityReport(passed=False, errors=errors, metrics=metrics), None

    # 3. file hash (for duplicate detection)
    digest = file_hash(path)
    metrics["file_hash"] = digest
    if known_hashes and digest in known_hashes:
        warnings.append("This image was already uploaded (duplicate).")

    # 4. completeness: the image must open fully
    try:
        image = load_image(path)
    except Exception:
        errors.append("Image is corrupt or incomplete and could not be opened.")
        return QualityReport(passed=False, errors=errors, warnings=warnings, metrics=metrics), None

    # 5. resolution
    h, w = image.shape[:2]
    metrics["width"] = w
    metrics["height"] = h
    if min(h, w) < config.MIN_IMAGE_SIDE:
        errors.append(
            f"Image is too small ({w}x{h}). Smaller side must be at least {config.MIN_IMAGE_SIDE} px."
        )

    # 6. blur, low light, contrast
    score = blur_score(image)
    brightness, contrast = brightness_and_contrast(image)
    metrics["blur_score"] = round(score, 2)
    metrics["brightness"] = round(brightness, 2)
    metrics["contrast"] = round(contrast, 2)

    if score < config.BLUR_THRESHOLD:
        warnings.append("Image looks blurry. Thin cracks may be missed.")
    if brightness < config.LOW_LIGHT_THRESHOLD:
        warnings.append("Image is too dark (low light).")
    if contrast < config.MIN_CONTRAST_STD:
        warnings.append("Image has very low contrast (almost blank).")

    passed = len(errors) == 0
    report = QualityReport(passed=passed, errors=errors, warnings=warnings, metrics=metrics)
    return report, (image if passed else None)