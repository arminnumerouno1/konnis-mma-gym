#!/usr/bin/env python3
"""Rebuild the KONNI emblem with distance-field anti-aliased edges.

The designer PDF is a 1254×1254 CMYK JPEG on white paper — not a vector file.
A binary paper key makes stair-stepped silhouettes when the 3D camera dollies in.
This pass keys paper, rebuilds mark/background coverage from a signed distance
field, premultiplies onto black, and writes a 2× PNG.
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
CROP_PAD = 4
SCALE = 2
EDGE_PX = 1.15  # native pixels of AA; scaled with the 2× image


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


def coverage(mask: np.ndarray, width: float) -> np.ndarray:
    dist_in = ndimage.distance_transform_edt(mask)
    dist_out = ndimage.distance_transform_edt(~mask)
    return np.clip((dist_in - dist_out) / (2.0 * width) + 0.5, 0.0, 1.0)


def nearest_fill(rgb: np.ndarray, keep: np.ndarray) -> np.ndarray:
    if keep.all():
        return rgb
    _, indices = ndimage.distance_transform_edt(~keep, return_indices=True)
    return rgb[indices[0], indices[1]]


def extract(pdf_path: Path) -> Image.Image:
    doc = pymupdf.open(pdf_path)
    page = doc[0]
    pix = page.get_pixmap(matrix=pymupdf.Matrix(1, 1), colorspace=pymupdf.csRGB, annots=False)
    rgb = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3).astype(np.float32)
    lum = rgb.mean(axis=2)
    exterior = flood_paper(lum, PAPER)

    paper = (lum >= PAPER) & ~exterior
    labeled, count = ndimage.label(paper)
    fill = np.zeros_like(paper)
    if count:
        sizes = ndimage.sum(paper, labeled, range(1, count + 1))
        for i, size in enumerate(sizes, start=1):
            if size >= FILL_MIN:
                fill |= labeled == i

    emblem = ~exterior
    mark = emblem & ~fill

    ys, xs = np.where(emblem)
    y0 = max(0, int(ys.min()) - CROP_PAD)
    y1 = min(rgb.shape[0], int(ys.max()) + 1 + CROP_PAD)
    x0 = max(0, int(xs.min()) - CROP_PAD)
    x1 = min(rgb.shape[1], int(xs.max()) + 1 + CROP_PAD)
    rgb = rgb[y0:y1, x0:x1]
    emblem = emblem[y0:y1, x0:x1]
    mark = mark[y0:y1, x0:x1]
    print(f"crop {(x0, y0, x1, y1)} -> {rgb.shape[1]}x{rgb.shape[0]}")

    metal = nearest_fill(rgb, mark)
    inner = coverage(mark, EDGE_PX)
    outer = coverage(emblem, EDGE_PX)
    rgb_out = metal * inner[..., None]
    alpha = outer

    native = np.dstack([rgb_out, alpha * 255.0])
    image = Image.fromarray(np.clip(native, 0, 255).astype(np.uint8), "RGBA")
    wide, high = image.size
    up = image.resize((wide * SCALE, high * SCALE), Image.Resampling.LANCZOS)

    out = np.array(up).astype(np.float32)
    a = out[:, :, 3] / 255.0
    out[a < 0.02, :3] = 0
    image = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGBA")

    opaque = int((out[:, :, 3] >= 250).sum())
    clear = int((out[:, :, 3] <= 2).sum())
    partial = image.size[0] * image.size[1] - opaque - clear
    print(f"alpha opaque={opaque} clear={clear} partial={partial}")
    return image


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=Path)
    parser.add_argument("-o", "--output", type=Path, required=True)
    args = parser.parse_args()
    img = extract(args.pdf)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    dest = args.output
    if dest.suffix.lower() == ".webp":
        img.save(dest, format="WEBP", lossless=True, quality=100, method=6)
    else:
        img.save(dest, format="PNG", optimize=True, compress_level=9)
    print(f"wrote {dest} {img.size} {dest.stat().st_size} bytes")


if __name__ == "__main__":
    main()
