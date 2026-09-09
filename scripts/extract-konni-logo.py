#!/usr/bin/env python3
"""Extract the KONNI emblem from the Photoshop PDF into a transparent PNG.

The PDF is not vector — it embeds one 1254×1254 CMYK JPEG. This script keeps
native pixels (no upscale), keys the paper background, and fills large interior
paper regions with black so the mark reads on the dark gym.
"""

from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

import numpy as np
import pymupdf
from PIL import Image
from scipy import ndimage

PAPER = 242
FILL_MIN = 3000
DESPILL = 232
DESPILL_PX = 2
CROP_PAD = 2


def flood_paper(lum: np.ndarray, thresh: float) -> np.ndarray:
    h, w = lum.shape
    mask = np.zeros((h, w), dtype=bool)
    q: deque[tuple[int, int]] = deque()
    for x in range(w):
        for y in (0, h - 1):
            if lum[y, x] >= thresh:
                mask[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if lum[y, x] >= thresh and not mask[y, x]:
                mask[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not mask[ny, nx] and lum[ny, nx] >= thresh:
                mask[ny, nx] = True
                q.append((ny, nx))
    return mask


def extract(pdf_path: Path) -> Image.Image:
    doc = pymupdf.open(pdf_path)
    page = doc[0]
    pix = page.get_pixmap(matrix=pymupdf.Matrix(1, 1), colorspace=pymupdf.csRGB, annots=False)
    rgb = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3).copy()
    lum = rgb.astype(np.float32).mean(axis=2)
    exterior = flood_paper(lum, PAPER)

    paper = (lum >= PAPER) & ~exterior
    labeled, count = ndimage.label(paper)
    fill = np.zeros_like(paper)
    if count:
        sizes = ndimage.sum(paper, labeled, range(1, count + 1))
        for i, size in enumerate(sizes, start=1):
            if size >= FILL_MIN:
                fill |= labeled == i

    ring = ndimage.binary_dilation(exterior, iterations=DESPILL_PX) & ~exterior
    exterior = exterior | (ring & (lum >= DESPILL))

    rgba = np.zeros((rgb.shape[0], rgb.shape[1], 4), dtype=np.uint8)
    rgba[:, :, :3] = rgb
    rgba[:, :, 3] = 255
    rgba[fill, 0] = 0
    rgba[fill, 1] = 0
    rgba[fill, 2] = 0
    rgba[exterior, 3] = 0

    alpha = rgba[:, :, 3]
    ys, xs = np.where(alpha > 8)
    y0 = max(0, int(ys.min()) - CROP_PAD)
    y1 = min(rgba.shape[0], int(ys.max()) + 1 + CROP_PAD)
    x0 = max(0, int(xs.min()) - CROP_PAD)
    x1 = min(rgba.shape[1], int(xs.max()) + 1 + CROP_PAD)
    cropped = rgba[y0:y1, x0:x1]
    print(f"crop {(x0, y0, x1, y1)} -> {cropped.shape[1]}x{cropped.shape[0]}")
    opaque = int((cropped[:, :, 3] == 255).sum())
    clear = int((cropped[:, :, 3] == 0).sum())
    partial = cropped.shape[0] * cropped.shape[1] - opaque - clear
    print(f"alpha opaque={opaque} clear={clear} partial={partial}")
    return Image.fromarray(cropped, "RGBA")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=Path)
    parser.add_argument("-o", "--output", type=Path, required=True)
    args = parser.parse_args()
    img = extract(args.pdf)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    img.save(args.output, format="PNG", optimize=True, compress_level=9)
    print(f"wrote {args.output} {img.size} {args.output.stat().st_size} bytes")


if __name__ == "__main__":
    main()
