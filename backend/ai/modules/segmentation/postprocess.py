"""Mask cleanup and drawing helpers for the segmentation module."""
import math

import cv2
import numpy as np

from ai import config
from ai.modules.geometry.measure import piece_stats


def clean_mask(binary, min_fraction=None):
    """Remove tiny isolated blobs (noise). Thin long cracks stay.

    binary: 2D array, crack pixels > 0.  Returns uint8 array with values 0 / 1.
    min_fraction: smallest piece to keep, as a share of the whole image area."""
    if min_fraction is None:
        min_fraction = config.SEGMENTER_MIN_COMPONENT_FRACTION

    binary = (binary > 0).astype(np.uint8)
    h, w = binary.shape
    min_area = max(1, int(h * w * min_fraction))

    count, labels, stats, _ = cv2.connectedComponentsWithStats(binary, connectivity=8)
    keep = stats[:, cv2.CC_STAT_AREA] >= min_area      # one True / False per piece
    keep[0] = False                                    # piece 0 is the background
    return keep[labels].astype(np.uint8)


def keep_crack_like(mask):
    """Keep only pieces that look like a crack: long and thin.

    The U-Net also marks thick blobs (shadows, dark bands, patches). A crack is
    thin compared to its length, so thick or very short pieces are removed.
    (Potholes are found by the detection module, not here.)"""
    labels, pieces = piece_stats(mask)
    h, w = mask.shape
    min_length = config.CRACK_MIN_LENGTH_FRACTION * math.hypot(h, w)
    max_width = config.CRACK_MAX_WIDTH_FRACTION * min(h, w)

    keep = np.zeros(labels.max() + 1, dtype=bool)
    for piece in pieces:
        if piece.length >= min_length and piece.mean_width <= max_width:
            keep[piece.label] = True
    return keep[labels].astype(np.uint8)


def draw_overlay(image_rgb, mask, color=(255, 0, 0), alpha=0.6):
    """Paint the crack pixels on the original image. Returns an RGB image."""
    out = image_rgb.copy()
    crack = mask > 0
    out[crack] = (alpha * np.array(color) + (1 - alpha) * out[crack]).astype(np.uint8)
    return out