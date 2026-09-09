#!/usr/bin/env python3
"""Compose the 1200×630 Open Graph card with a smaller emblem that clears the type."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "og-image.jpg"
W, H = 1200, 630
LOGO_H = 312
LOGO_LEFT = 40
GAP = 56
KONRAD_W = 360


def radial_background() -> Image.Image:
    yy, xx = np.indices((H, W))
    dist = np.sqrt(((xx - 620) / 760) ** 2 + ((yy - 300) / 460) ** 2)
    t = np.clip(1.0 - dist, 0.0, 1.0) ** 1.35
    base = np.array([6, 5, 4], dtype=np.float32)
    glow = np.array([54, 38, 26], dtype=np.float32)
    rgb = base + (glow - base) * t[..., None]
    return Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), "RGB")


def fit_height(img: Image.Image, height: int) -> Image.Image:
    scale = height / img.height
    size = (max(1, round(img.width * scale)), height)
    return img.resize(size, Image.Resampling.LANCZOS)


def paste(dst: Image.Image, src: Image.Image, xy: tuple[int, int]) -> None:
    if src.mode != "RGBA":
        dst.paste(src, xy)
        return
    layer = Image.new("RGBA", dst.size, (0, 0, 0, 0))
    layer.paste(src, xy)
    dst.alpha_composite(layer)


def draw_tracked(
    draw: ImageDraw.ImageDraw,
    xy: tuple[float, float],
    text: str,
    font: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int],
    tracking: float = 0,
) -> None:
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        x += font.getlength(ch) + tracking


def main() -> None:
    canvas = radial_background().convert("RGBA")
    fonts = ROOT / "public" / "fonts"
    title = ImageFont.truetype(str(fonts / "BebasNeue-Regular.ttf"), 58)
    city = ImageFont.truetype(str(fonts / "BebasNeue-Regular.ttf"), 36)
    meta = ImageFont.truetype(str(fonts / "BarlowCondensed-Regular.ttf"), 22)
    small = ImageFont.truetype(str(fonts / "BarlowCondensed-Regular.ttf"), 16)

    logo = Image.open(ROOT / "public" / "brand" / "konni-logo.webp").convert("RGBA")
    logo = fit_height(logo, LOGO_H)
    logo_y = (H - logo.height) // 2
    paste(canvas, logo, (LOGO_LEFT, logo_y))
    text_x = LOGO_LEFT + logo.width + GAP

    konrad = Image.open(ROOT / "public" / "brand" / "konrad.png").convert("RGBA")
    k_scale = KONRAD_W / konrad.width
    konrad = konrad.resize(
        (KONRAD_W, max(1, round(konrad.height * k_scale))),
        Image.Resampling.LANCZOS,
    )
    k_y = H - konrad.height + 18
    k_x = W - konrad.width + 8
    paste(canvas, konrad, (k_x, k_y))

    draw = ImageDraw.Draw(canvas)
    lines = [
        ("KONNI MMA GYM", title, (243, 239, 230), 2.4, 0),
        ("LEIPZIG", city, (196, 58, 58), 5.5, 10),
        ("MMA  ·  GRAPPLING  ·  STRIKING", meta, (180, 174, 162), 1.6, 28),
        ("ERÖFFNET BALD", small, (154, 149, 138), 3.8, 18),
    ]
    block_h = sum(font.size + gap for _, font, _, _, gap in lines) - lines[-1][4]
    y = (H - block_h) / 2 - 6
    text_right = k_x - 28
    for text, font, fill, tracking, gap in lines:
        draw_tracked(draw, (text_x, y), text, font, fill, tracking)
        y += font.size + gap

    rgb = canvas.convert("RGB")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    rgb.save(OUT, format="JPEG", quality=90, optimize=True, subsampling=0)
    print(f"wrote {OUT} {rgb.size} {OUT.stat().st_size} bytes")
    print(f"logo {logo.size} at x={LOGO_LEFT}..{LOGO_LEFT + logo.width}, text from {text_x}")


if __name__ == "__main__":
    main()
