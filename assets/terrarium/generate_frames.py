#!/usr/bin/env python3
"""Bake articulated animation sheets from the traced Warm Ember robots.

v2 — head/body split. Each bot becomes TWO textures:

  sheets/<name>.png       body sheet, 4 cols x 4 rows:
                            idle / work / talk  (head region erased —
                            the live head sprite sits on top)
                            walk                (FULL bot — whole-body
                            waddle, head baked in)
  sheets/<name>-head.png  3 cells: normal / blink / glow
                            (the chief's smoked visor: normal x3)

Heads rotate at runtime around the neck pivot, so bots glance, nod and
turn toward each other. Every frame is a transform of the SAME painted
pixels — nothing invented.

Rerun after re-tracing: python3 generate_frames.py
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

HERE = Path(__file__).parent
SRC = HERE / "traced"
OUT = SRC / "sheets"
OUT.mkdir(exist_ok=True)

PAD_X, PAD_Y = 10, 8  # body cells
HEAD_PAD = 14  # head cells (room to rotate)
CROP_OFF = (55, 95)

# box: full-image origin (from generate_traced.py); eyes: CROP space;
# headFrac: neck line as a fraction of sprite height
BOTS = {
    "strategy": {"box": (544, 440), "eyes": [(545, 395), (580, 395)], "headFrac": 0.42},
    "meet-a": {"box": (1272, 446), "eyes": [(1250, 397), (1285, 400)], "headFrac": 0.42},
    "meet-b": {"box": (1418, 446), "eyes": [(1407, 403), (1443, 405)], "headFrac": 0.42},
    "build": {"box": (588, 775), "eyes": [(617, 733), (647, 733)], "headFrac": 0.38},
    "chief": {"box": (1415, 750), "eyes": [], "headFrac": 0.34},
    "kernel": {"box": (475, 1145), "eyes": [(477, 1077), (513, 1079)], "headFrac": 0.42},
    "live": {"box": (715, 1145), "eyes": [(747, 1079), (780, 1081)], "headFrac": 0.42},
    "paper": {"box": (1005, 1145), "eyes": [(1007, 1081), (1043, 1083)], "headFrac": 0.42},
}


def local_eyes(spec) -> list:
    bx, by = spec["box"]
    return [(ex + CROP_OFF[0] - bx, ey + CROP_OFF[1] - by) for ex, ey in spec["eyes"]]


def cell(im: Image.Image) -> Image.Image:
    w, h = im.size
    c = Image.new("RGBA", (w + 2 * PAD_X, h + 2 * PAD_Y), (0, 0, 0, 0))
    c.paste(im, (PAD_X, PAD_Y), im)
    return c


def squash(im: Image.Image, k: float) -> Image.Image:
    w, h = im.size
    nh = max(1, round(h * k))
    nw = max(1, round(w * (1 / k) ** 0.6))
    sq = im.resize((nw, nh), Image.LANCZOS)
    c = Image.new("RGBA", (w + 2 * PAD_X, h + 2 * PAD_Y), (0, 0, 0, 0))
    c.paste(sq, (PAD_X + (w - nw) // 2, PAD_Y + (h - nh)), sq)
    return c


def tilt(im: Image.Image, deg: float, lift: int = 0, k: float = 1.0) -> Image.Image:
    w, h = im.size
    c = squash(im, k) if k != 1.0 else cell(im)
    c = c.rotate(deg, resample=Image.BICUBIC, center=(PAD_X + w / 2, PAD_Y + h))
    if lift:
        sh = Image.new("RGBA", c.size, (0, 0, 0, 0))
        sh.paste(c, (0, -lift), c)
        c = sh
    return c


def erase_head(c: Image.Image, w: int, head_h: int) -> Image.Image:
    """Feather-erase the head region from a body cell (head sprite covers it)."""
    out = c.copy()
    mask = Image.new("L", out.size, 255)
    d = ImageDraw.Draw(mask)
    # keep an 8px overlap below the neck so the head always covers the seam
    d.rectangle((0, 0, out.size[0], PAD_Y + head_h - 8), fill=0)
    mask = mask.filter(ImageFilter.GaussianBlur(4))
    r, g, b, a = out.split()
    from PIL import ImageChops

    a = ImageChops.multiply(a, mask)
    out.putalpha(a)
    return out


for name, spec in BOTS.items():
    src = Image.open(SRC / f"robot-{name}.png").convert("RGBA")
    eyes = local_eyes(spec)
    w, h = src.size
    head_h = round(h * spec["headFrac"])
    cw, ch = w + 2 * PAD_X, h + 2 * PAD_Y

    body_clips = {
        "idle": [cell(src), squash(src, 0.990), cell(src), squash(src, 0.996)],
        "work": [squash(src, 0.994), cell(src), squash(src, 0.986), cell(src)],
        "talk": [tilt(src, -2.2), cell(src), tilt(src, 2.2), cell(src)],
    }
    walk = [
        tilt(src, -5.0),
        tilt(src, 0, lift=4, k=0.985),
        tilt(src, 5.0),
        tilt(src, 0, lift=4, k=0.985),
    ]

    sheet = Image.new("RGBA", (cw * 4, ch * 4), (0, 0, 0, 0))
    for row, clip in enumerate(["idle", "work", "talk"]):
        for col, frame in enumerate(body_clips[clip]):
            sheet.paste(erase_head(frame, w, head_h), (col * cw, row * ch))
    for col, frame in enumerate(walk):
        sheet.paste(frame, (col * cw, 3 * ch))
    sheet.save(OUT / f"{name}.png")

    # ── the head: normal / blink / glow ──
    hw, hh = w + 2 * HEAD_PAD, head_h + 2 * HEAD_PAD
    head_src = src.crop((0, 0, w, head_h + 6))  # +6 chin overlap
    # feather the cut edge so rotation never shows a hard line
    hm = Image.new("L", head_src.size, 255)
    hd = ImageDraw.Draw(hm)
    hd.rectangle((0, head_src.size[1] - 5, head_src.size[0], head_src.size[1]), fill=0)
    hm = hm.filter(ImageFilter.GaussianBlur(3))
    from PIL import ImageChops as IC

    ha = IC.multiply(head_src.split()[3], hm)
    head_src.putalpha(ha)

    def head_cell(im: Image.Image) -> Image.Image:
        c = Image.new("RGBA", (hw, hh), (0, 0, 0, 0))
        c.paste(im, (HEAD_PAD, HEAD_PAD), im)
        return c

    normal = head_cell(head_src)
    blink = normal.copy()
    if eyes:
        bd = ImageDraw.Draw(blink)
        for ex, ey in eyes:
            cx, cy = ex + HEAD_PAD, ey + HEAD_PAD
            bd.ellipse((cx - 13, cy - 10, cx + 13, cy + 10), fill=(38, 28, 20, 242))
    glow = normal.copy()
    if eyes:
        gl = Image.new("RGBA", glow.size, (0, 0, 0, 0))
        gd = ImageDraw.Draw(gl)
        for ex, ey in eyes:
            cx, cy = ex + HEAD_PAD, ey + HEAD_PAD
            gd.ellipse((cx - 15, cy - 15, cx + 15, cy + 15), fill=(255, 190, 80, 130))
        gl = gl.filter(ImageFilter.GaussianBlur(7))
        glow = Image.alpha_composite(glow, gl)

    heads = Image.new("RGBA", (hw * 3, hh), (0, 0, 0, 0))
    for i, im in enumerate([normal, blink, glow]):
        heads.paste(im, (i * hw, 0))
    heads.save(OUT / f"{name}-head.png")
    print(f"  {name}: body {cw}x{ch}, head {hw}x{hh} (neck at {head_h}px)")

print("done")
