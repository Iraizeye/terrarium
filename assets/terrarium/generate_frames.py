#!/usr/bin/env python3
"""Bake animation sprite sheets from the traced Warm Ember robots.

Each bot gets one sheet: 4 columns x 5 rows = clips idle / work / walk /
talk / blink (blink row uses frame 0 only). Frames are transforms of the
SAME painted pixels — squash-and-stretch, waddle tilt, baked eye glow,
eyelid pass — so every frame stays in the painting's family.

Cells are padded (+16w +12h) so tilted/hopped frames never clip; the
sprite's bottom-center sits at (pad_x + w/2, pad_y + h) in every frame.

Rerun after re-tracing: python3 generate_frames.py
"""

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

HERE = Path(__file__).parent
SRC = HERE / "traced"
OUT = SRC / "sheets"
OUT.mkdir(exist_ok=True)

PAD_X, PAD_Y = 8, 6

# full-image box origins (from generate_traced.py) + CROP-space eye coords
BOTS = {
    "strategy": {"box": (544, 440), "eyes": [(545, 395), (580, 395)]},
    "meet-a": {"box": (1272, 446), "eyes": [(1250, 397), (1285, 400)]},
    "meet-b": {"box": (1418, 446), "eyes": [(1407, 403), (1443, 405)]},
    "build": {"box": (588, 775), "eyes": [(617, 733), (647, 733)]},
    "chief": {"box": (1415, 750), "eyes": []},
    "kernel": {"box": (475, 1145), "eyes": [(477, 1077), (513, 1079)]},
    "live": {"box": (715, 1145), "eyes": [(747, 1079), (780, 1081)]},
    "paper": {"box": (1005, 1145), "eyes": [(1007, 1081), (1043, 1083)]},
}
CROP_OFF = (55, 95)  # CROP space -> full-image space


def local_eyes(spec) -> list:
    bx, by = spec["box"]
    return [(ex + CROP_OFF[0] - bx, ey + CROP_OFF[1] - by) for ex, ey in spec["eyes"]]


def cell_base(im: Image.Image) -> Image.Image:
    w, h = im.size
    cell = Image.new("RGBA", (w + 2 * PAD_X, h + 2 * PAD_Y), (0, 0, 0, 0))
    cell.paste(im, (PAD_X, PAD_Y), im)
    return cell


def squash(im: Image.Image, k: float) -> Image.Image:
    """Bottom-anchored squash: height*k, width/k**0.6, feet stay planted."""
    w, h = im.size
    nh = max(1, round(h * k))
    nw = max(1, round(w * (1 / k) ** 0.6))
    sq = im.resize((nw, nh), Image.LANCZOS)
    cell = Image.new("RGBA", (w + 2 * PAD_X, h + 2 * PAD_Y), (0, 0, 0, 0))
    cell.paste(sq, (PAD_X + (w - nw) // 2, PAD_Y + (h - nh)), sq)
    return cell


def tilt(im: Image.Image, deg: float, lift: int = 0) -> Image.Image:
    w, h = im.size
    cell = cell_base(im)
    cell = cell.rotate(deg, resample=Image.BICUBIC, center=(PAD_X + w / 2, PAD_Y + h))
    if lift:
        shifted = Image.new("RGBA", cell.size, (0, 0, 0, 0))
        shifted.paste(cell, (0, -lift), cell)
        cell = shifted
    return cell


def with_glow(cell: Image.Image, eyes: list, strength: float) -> Image.Image:
    if not eyes or strength <= 0:
        return cell
    glow = Image.new("RGBA", cell.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(glow)
    r = 14
    for ex, ey in eyes:
        cx, cy = ex + PAD_X, ey + PAD_Y
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(255, 190, 80, int(150 * strength)))
    glow = glow.filter(ImageFilter.GaussianBlur(7))
    return Image.alpha_composite(cell, glow)


def with_blink(cell: Image.Image, eyes: list) -> Image.Image:
    if not eyes:
        return cell
    out = cell.copy()
    d = ImageDraw.Draw(out)
    for ex, ey in eyes:
        cx, cy = ex + PAD_X, ey + PAD_Y
        d.ellipse((cx - 13, cy - 10, cx + 13, cy + 10), fill=(38, 28, 20, 242))
    return out


for name, spec in BOTS.items():
    src = Image.open(SRC / f"robot-{name}.png").convert("RGBA")
    eyes = local_eyes(spec)
    w, h = src.size
    cw, ch = w + 2 * PAD_X, h + 2 * PAD_Y

    clips = {
        "idle": [cell_base(src), squash(src, 0.994), cell_base(src), squash(src, 0.997)],
        "work": [
            with_glow(squash(src, 0.996), eyes, 0.5),
            with_glow(cell_base(src), eyes, 0.85),
            with_glow(squash(src, 0.992), eyes, 0.5),
            with_glow(cell_base(src), eyes, 0.3),
        ],
        "walk": [
            tilt(src, -3.2),
            tilt(src, 0, lift=3),
            tilt(src, 3.2),
            tilt(src, 0, lift=3),
        ],
        "talk": [
            with_glow(tilt(src, -1.6), eyes, 0.7),
            with_glow(cell_base(src), eyes, 0.9),
            with_glow(tilt(src, 1.6), eyes, 0.7),
            with_glow(cell_base(src), eyes, 0.4),
        ],
        "blink": [with_blink(cell_base(src), eyes)] * 4,
    }

    sheet = Image.new("RGBA", (cw * 4, ch * 5), (0, 0, 0, 0))
    for row, clip in enumerate(["idle", "work", "walk", "talk", "blink"]):
        for col, frame in enumerate(clips[clip]):
            sheet.paste(frame, (col * cw, row * ch))
    sheet.save(OUT / f"{name}.png")
    print(f"  sheets/{name}.png cell {cw}x{ch}")

print("done")
