"""Crack measurement (spec module 9).

All sizes are in PIXELS. Real units (mm / cm) need a calibrated scale,
so we do not claim them here.
"""
import math
from dataclasses import dataclass
from typing import Optional

import cv2
import numpy as np
from skimage.morphology import skeletonize

from ai.core.schemas import GeometryResult


@dataclass
class Piece:
    """Measurements of one connected piece of crack."""
    label: int
    area: int
    length: float            # along the skeleton
    mean_width: float
    max_width: float
    skeleton_pixels: int
    angle: Optional[float]   # 0 = horizontal, 90 = vertical (degrees)
    branch_points: int


# ---------------------------------------------------------------- helpers
def _skeleton_lengths(skel, labels, count):
    """Length of the skeleton of every piece.
    Straight steps count 1, diagonal steps count sqrt(2)."""
    s = skel
    lengths = np.zeros(count)
    right = s[:, :-1] & s[:, 1:]
    down = s[:-1, :] & s[1:, :]
    # a diagonal link is skipped when a straight path already connects the two pixels
    diag_down_right = s[:-1, :-1] & s[1:, 1:] & ~(s[:-1, 1:] | s[1:, :-1])
    diag_down_left = s[:-1, 1:] & s[1:, :-1] & ~(s[:-1, :-1] | s[1:, 1:])
    for links, owner, weight in [
        (right, labels[:, :-1], 1.0),
        (down, labels[:-1, :], 1.0),
        (diag_down_right, labels[:-1, :-1], math.sqrt(2)),
        (diag_down_left, labels[:-1, 1:], math.sqrt(2)),
    ]:
        lengths += weight * np.bincount(owner[links], minlength=count)
    return lengths


def _junction_pixels(skel):
    """Skeleton pixels where the crack splits into 3 or more directions."""
    s = np.pad(skel.astype(np.uint8), 1)
    around = [s[:-2, 1:-1], s[:-2, 2:], s[1:-1, 2:], s[2:, 2:],
              s[2:, 1:-1], s[2:, :-2], s[1:-1, :-2], s[:-2, :-2]]      # 8 neighbours in a circle
    changes = sum(((around[i] == 0) & (around[(i + 1) % 8] == 1)).astype(np.uint8) for i in range(8))
    return skel & (changes >= 3)


def _count_junctions(skel, labels, count):
    """Number of branch points per piece (touching junction pixels count as one)."""
    junction = _junction_pixels(skel).astype(np.uint8)
    result = np.zeros(count, dtype=int)
    if junction.sum() == 0:
        return result
    _, groups = cv2.connectedComponents(cv2.dilate(junction, np.ones((3, 3), np.uint8)), connectivity=8)
    ys, xs = np.nonzero(junction)
    _, first = np.unique(groups[ys, xs], return_index=True)     # one pixel per junction
    np.add.at(result, labels[ys[first], xs[first]], 1)
    return result


def _angle(xs, ys):
    """Main direction of a piece in degrees: 0 = horizontal, 90 = vertical."""
    if len(xs) < 2:
        return None
    points = np.stack([xs, -ys]).astype(float)          # y goes up
    points -= points.mean(axis=1, keepdims=True)
    values, vectors = np.linalg.eigh(points @ points.T / points.shape[1])
    vx, vy = vectors[:, 1]                              # direction with the biggest spread
    return math.degrees(math.atan2(vy, vx)) % 180


def orientation_label(angle):
    if angle is None:
        return None
    if angle <= 15 or angle >= 165:
        return "horizontal"
    if 75 <= angle <= 105:
        return "vertical"
    return "diagonal"


# ---------------------------------------------------------------- main functions
def piece_stats(mask):
    """Measure every connected piece of the mask.
    Returns (labels, pieces). labels is an image where each piece has its own number."""
    mask = (mask > 0).astype(np.uint8)
    count, labels, _, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    if count <= 1:
        return labels, []

    skel = skeletonize(mask > 0)
    distance = cv2.distanceTransform(mask, cv2.DIST_L2, 5)[skel]
    widths = np.maximum(2.0 * distance - 1.0, 1.0)      # crack width in pixels at every skeleton point
    skel_labels = labels[skel]

    areas = np.bincount(labels.ravel(), minlength=count)
    skel_pixels = np.bincount(skel_labels, minlength=count)
    width_sum = np.bincount(skel_labels, weights=widths, minlength=count)
    width_max = np.zeros(count)
    np.maximum.at(width_max, skel_labels, widths)
    lengths = _skeleton_lengths(skel, labels, count)
    junctions = _count_junctions(skel, labels, count)
    ys, xs = np.nonzero(skel)

    pieces = []
    for i in range(1, count):
        if skel_pixels[i] == 0:
            continue
        mine = skel_labels == i
        pieces.append(Piece(
            label=i,
            area=int(areas[i]),
            length=float(lengths[i]),
            mean_width=float(width_sum[i] / skel_pixels[i]),
            max_width=float(width_max[i]),
            skeleton_pixels=int(skel_pixels[i]),
            angle=_angle(xs[mine], ys[mine]),
            branch_points=int(junctions[i]),
        ))
    return labels, pieces


def measure(mask) -> Optional[GeometryResult]:
    """Measure all cracks in the mask. Returns None if the mask is empty."""
    mask = (mask > 0).astype(np.uint8)
    _, pieces = piece_stats(mask)
    if not pieces:
        return None

    h, w = mask.shape
    area = sum(p.area for p in pieces)
    total_pixels = sum(p.skeleton_pixels for p in pieces)
    mean_width = sum(p.mean_width * p.skeleton_pixels for p in pieces) / total_pixels
    longest = max(pieces, key=lambda p: p.length)

    return GeometryResult(
        unit="pixels",
        length=round(sum(p.length for p in pieces), 1),
        average_width=round(mean_width, 2),
        max_width=round(max(p.max_width for p in pieces), 2),
        area=float(area),
        density_percent=round(area / (h * w) * 100, 3),
        orientation_deg=None if longest.angle is None else round(longest.angle, 1),
        orientation_label=orientation_label(longest.angle),
        branch_points=sum(p.branch_points for p in pieces),
        crack_count=len(pieces),
    )