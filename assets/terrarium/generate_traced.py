#!/usr/bin/env python3
"""Trace the Warm Ember reference into motion-ready sprites (Path B).

- Crops each painted robot out of docs/art/warm-ember-reference.png with a
  feathered alpha edge (so small motion offsets blend invisibly).
- Builds traced/stage-bg.png: the same painting with the characters and the
  baked speech bubbles inpainted away (bilinear edge-lerp fill), so the live
  layer fully owns speech and the sprites own the bodies.
- Station tags (KERNEL/LIVE/PAPER) and all furniture stay in the bg: they
  are honest, constant labels and props.

Rerun after tuning boxes: python3 generate_traced.py
"""

from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
REF = ROOT / "docs" / "art" / "warm-ember-reference.png"
OUT = Path(__file__).parent / "traced"
OUT.mkdir(exist_ok=True)

img = Image.open(REF).convert("RGBA")
W, H = img.size
print(f"reference: {W}x{H}")

# full-image bboxes (x0, y0, x1, y1) — sprite crops
ROBOTS = {
    "robot-strategy": (544, 440, 700, 650),
    "robot-meet-a": (1272, 446, 1432, 658),  # overlaps b by 14px at the handshake
    "robot-meet-b": (1418, 446, 1560, 658),
    "robot-build": (588, 775, 762, 1035),
    "robot-chief": (1415, 750, 1585, 1035),
    "robot-kernel": (475, 1145, 625, 1350),
    "robot-live": (715, 1145, 858, 1350),
    "robot-paper": (1005, 1145, 1165, 1350),
}
# bg erase boxes: bubbles first (so robot fills sample clean wall), then
# robots — the meet pair as ONE box so neither fill smears the other robot
ERASE_BUBBLES = {
    "bubble-strategy": (505, 362, 790, 465),
    "bubble-meet": (1308, 368, 1572, 465),
}
ERASE_ROBOTS = {**{k: v for k, v in ROBOTS.items() if not k.startswith("robot-meet")},
                "robot-meet-pair": (1272, 446, 1560, 658)}


def edge_lerp_fill(im: Image.Image, box: tuple) -> None:
    """Fill box by blending the pixel strips just outside its four edges."""
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    left = im.crop((max(0, x0 - 6), y0, max(1, x0 - 1), y1)).resize((1, h))
    right = im.crop((min(W - 6, x1 + 1), y0, min(W - 1, x1 + 6), y1)).resize((1, h))
    top = im.crop((x0, max(0, y0 - 6), x1, max(1, y0 - 1))).resize((w, 1))
    bottom = im.crop((x0, min(H - 6, y1 + 1), x1, min(H - 1, y1 + 6))).resize((w, 1))
    lpx, rpx = left.load(), right.load()
    tpx, bpx = top.load(), bottom.load()
    patch = Image.new("RGBA", (w, h))
    ppx = patch.load()
    for yy in range(h):
        fy = yy / max(1, h - 1)
        for xx in range(w):
            fx = xx / max(1, w - 1)
            lr = tuple(int(lpx[0, yy][c] * (1 - fx) + rpx[0, yy][c] * fx) for c in range(4))
            tb = tuple(int(tpx[xx, 0][c] * (1 - fy) + bpx[xx, 0][c] * fy) for c in range(4))
            # weight toward the nearer axis for a softer field
            wx = min(fx, 1 - fx)
            wy = min(fy, 1 - fy)
            tw_ = wx + wy or 1
            ppx[xx, yy] = tuple(
                int((lr[c] * wy + tb[c] * wx) / tw_) if tw_ else lr[c] for c in range(4)
            )
    patch = patch.filter(ImageFilter.GaussianBlur(6))
    im.paste(patch, (x0, y0))


def feathered_crop(box: tuple, feather: int = 10) -> Image.Image:
    x0, y0, x1, y1 = box
    crop = img.crop(box).convert("RGBA")
    mask = Image.new("L", crop.size, 0)
    inner = Image.new("L", (crop.size[0] - 2 * feather, crop.size[1] - 2 * feather), 255)
    mask.paste(inner, (feather, feather))
    mask = mask.filter(ImageFilter.GaussianBlur(feather * 0.7))
    crop.putalpha(mask)
    return crop


# 1. sprites first (from the pristine image)
for name, box in ROBOTS.items():
    feathered_crop(box).save(OUT / f"{name}.png")
    print(f"  traced/{name}.png {box}")

# 2. background: erase baked bubbles first, then robots
bg = img.copy()
for box in list(ERASE_BUBBLES.values()) + list(ERASE_ROBOTS.values()):
    edge_lerp_fill(bg, box)
bg.save(OUT / "stage-bg.png")
print("  traced/stage-bg.png (characters + baked bubbles inpainted)")
print("done")
