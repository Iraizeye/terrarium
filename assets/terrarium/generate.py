#!/usr/bin/env python3
"""Generate the Warm Ember Terrarium A asset pack (see MANIFEST.md).

Every sprite matches docs/art/warm-ember-reference.png's family: espresso
wood, cream boxy robots with dome helmets and dark visors (eyes are NOT
baked — the live stage draws them so eye-glow stays telemetry), one red
Chief, candle-warm props. Rerun after any edit: `python3 generate.py`.
"""

from pathlib import Path

OUT = Path(__file__).parent

# palette
CREAM, CREAM_HI, CREAM_LO = "#efe3c8", "#faf3e2", "#cdb992"
RED, RED_HI, RED_LO = "#b3232a", "#e8544a", "#7a1418"
GOLD, GOLD_DIM = "#d9a441", "#8a6a34"
WOOD_D, WOOD_M, WOOD_L = "#241608", "#3a2412", "#54341c"
VISOR, VISOR_LO = "#221a10", "#151009"


def grad(gid, stops, x1=0, y1=0, x2=0, y2=1):
    s = "".join(f'<stop offset="{o}" stop-color="{c}"/>' for o, c in stops)
    return f'<linearGradient id="{gid}" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}">{s}</linearGradient>'


def svg(name, w, h, defs, body):
    (OUT / name).parent.mkdir(parents=True, exist_ok=True)
    (OUT / name).write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}">'
        f"<defs>{defs}</defs>{body}</svg>\n"
    )
    print(f"  {name}")


def robot(name, red=False, pose="idle"):
    b, hi, lo = (RED, RED_HI, RED_LO) if red else (CREAM, CREAM_HI, CREAM_LO)
    v0, v1 = ("#1c2b28", "#0e1715") if red else (VISOR, VISOR_LO)
    defs = grad("body", [(0, hi), (0.45, b), (1, lo)]) + grad("vis", [(0, v0), (1, v1)])
    seated = pose == "laptop"
    torso_y = 78 if seated else 70
    legs = (
        f'<rect x="28" y="{torso_y+34}" width="17" height="16" rx="5" fill="{lo}"/>'
        f'<rect x="55" y="{torso_y+34}" width="17" height="16" rx="5" fill="{lo}"/>'
        if seated
        else f'<rect x="31" y="108" width="14" height="16" rx="4" fill="{lo}"/>'
        f'<rect x="55" y="108" width="14" height="16" rx="4" fill="{lo}"/>'
        f'<rect x="28" y="121" width="19" height="8" rx="4" fill="url(#body)"/>'
        f'<rect x="53" y="121" width="19" height="8" rx="4" fill="url(#body)"/>'
    )
    if pose == "tablet":
        arms = (
            '<rect x="14" y="88" width="16" height="10" rx="4" fill="url(#body)"/>'
            '<rect x="70" y="88" width="16" height="10" rx="4" fill="url(#body)"/>'
        )
    elif pose == "talk":
        arms = (
            f'<rect x="12" y="{torso_y+6}" width="12" height="26" rx="5" fill="url(#body)" transform="rotate(24 18 {torso_y+6})"/>'
            f'<rect x="76" y="{torso_y+8}" width="12" height="30" rx="5" fill="url(#body)"/>'
        )
    elif pose == "laptop":
        arms = (
            f'<rect x="18" y="{torso_y+10}" width="18" height="10" rx="4" fill="url(#body)"/>'
            f'<rect x="64" y="{torso_y+10}" width="18" height="10" rx="4" fill="url(#body)"/>'
        )
    else:
        arms = (
            f'<rect x="13" y="{torso_y+6}" width="12" height="30" rx="5" fill="url(#body)"/>'
            f'<rect x="75" y="{torso_y+6}" width="12" height="30" rx="5" fill="url(#body)"/>'
        )
    shoulders = (
        f'<circle cx="21" cy="{torso_y+10}" r="6.5" fill="url(#body)"/>'
        f'<circle cx="79" cy="{torso_y+10}" r="6.5" fill="url(#body)"/>'
    )
    crest = (
        f'<path d="M50 {torso_y+10} L57 {torso_y+15} L57 {torso_y+22} L50 {torso_y+29} '
        f'L43 {torso_y+22} L43 {torso_y+15} Z" fill="{GOLD}"/>'
        f'<circle cx="50" cy="{torso_y+19}" r="2.6" fill="#8a5f1e"/>'
        if red
        else f'<line x1="28" y1="{torso_y+15}" x2="72" y2="{torso_y+15}" stroke="#a08c5a" stroke-opacity="0.4"/>'
        f'<circle cx="63" cy="{torso_y+23}" r="3" fill="{CREAM_LO}"/>'
    )
    body = (
        legs
        + f'<rect x="25" y="{torso_y}" width="50" height="42" rx="10" fill="url(#body)"/>'
        + crest
        + arms
        + shoulders
        # dome head with soft chin
        + f'<path d="M17 66 L17 40 A33 33 0 0 1 83 40 L83 66 Q83 72 72 72 L28 72 Q17 72 17 66 Z" fill="url(#body)"/>'
        + '<ellipse cx="38" cy="22" rx="11" ry="5.5" fill="#fff8e6" opacity="0.28" transform="rotate(-28 38 22)"/>'
        + f'<rect x="24" y="34" width="52" height="24" rx="12" fill="url(#vis)" stroke="#000" stroke-opacity="0.45"/>'
        + (
            '<rect x="30" y="40" width="40" height="12" rx="6" fill="#7ac8be" opacity="0.08"/>'
            if red
            else ""
        )
        + f'<rect x="47.5" y="4" width="5" height="8" fill="{lo}"/>'
        + f'<circle cx="50" cy="3.5" r="4.5" fill="{lo}"/>'
    )
    svg(name, 100, 132, defs, body)


def props():
    svg("props/candle.svg", 20, 34, grad("c", [(0, CREAM_HI), (1, CREAM_LO)]),
        '<rect x="6" y="8" width="8" height="24" rx="3" fill="url(#c)"/>'
        '<rect x="9" y="4" width="2" height="5" fill="#6b5326"/>')
    svg("props/nightbell.svg", 30, 34, grad("b", [(0, "#c99a48"), (1, GOLD_DIM)]),
        '<line x1="15" y1="0" x2="15" y2="6" stroke="#54341c" stroke-width="2"/>'
        '<path d="M4 22 A11 11 0 0 1 26 22 L28 27 L2 27 Z" fill="url(#b)"/>'
        '<circle cx="15" cy="30" r="2.6" fill="#5f4826"/>')
    svg("props/locker.svg", 46, 96, grad("l", [(0, "#4a3a2c"), (0.5, "#3a2d20"), (1, "#241a10")]),
        '<rect x="1" y="1" width="44" height="94" rx="4" fill="url(#l)" stroke="#180f08" stroke-width="2"/>'
        '<rect x="6" y="6" width="34" height="84" rx="2" fill="none" stroke="#241a10" stroke-width="2"/>'
        + "".join(f'<rect x="12" y="{12+i*8}" width="22" height="2.5" fill="#241a10"/>' for i in range(3)))
    svg("props/charts.svg", 60, 42, "",
        '<rect x="0" y="0" width="60" height="42" rx="3" fill="#241a10" stroke="#0f0803" stroke-width="2"/>'
        '<rect x="4" y="4" width="52" height="34" rx="2" fill="#1a1109"/>')
    svg("props/pass-stack.svg", 52, 30, "",
        "".join(f'<rect x="{2+i}" y="{18-i*5}" width="36" height="6" rx="1.5" fill="#e8dfc8" stroke="#c9bda0" stroke-width="0.6"/>' for i in range(3))
        + '<rect x="40" y="8" width="12" height="14" rx="2" fill="#8a2f28"/>'
        + '<rect x="43" y="4" width="6" height="5" fill="#6b211c"/>')
    svg("props/plant.svg", 44, 60, grad("p", [(0, "#5f7d46"), (1, "#3d5a30")]),
        '<path d="M22 34 C10 26 8 12 14 4 C20 14 22 20 22 32 Z" fill="url(#p)"/>'
        '<path d="M22 34 C34 24 38 12 32 2 C25 12 22 20 22 32 Z" fill="#4f7d46"/>'
        '<path d="M22 36 C16 28 6 26 2 30 C8 36 14 38 22 38 Z" fill="#44663a"/>'
        '<path d="M13 42 L31 42 L28 58 L16 58 Z" fill="#5a3a22" stroke="#40281b" stroke-width="1.5"/>')
    svg("props/bookshelf.svg", 78, 66, "",
        f'<rect x="0" y="0" width="78" height="66" rx="3" fill="{WOOD_L}"/>'
        f'<rect x="4" y="4" width="70" height="26" fill="{WOOD_D}"/>'
        f'<rect x="4" y="36" width="70" height="26" fill="{WOOD_D}"/>'
        + "".join(
            f'<rect x="{8+i*12}" y="{7 + (0 if i%2 else 2)}" width="9" height="{22-(0 if i%2 else 2)}" rx="1" fill="{c}"/>'
            for i, c in enumerate(["#8a5a3a", "#4f7d46", "#a8843c", "#6b4526", "#8a2f28"]))
        + "".join(
            f'<rect x="{10+i*13}" y="{39 + (2 if i%2 else 0)}" width="9" height="{20+(0 if i%2 else 2)}" rx="1" fill="{c}"/>'
            for i, c in enumerate(["#a8843c", "#8a2f28", "#4f7d46", "#8a5a3a"])))
    svg("props/laptop.svg", 40, 30, "",
        '<rect x="4" y="2" width="32" height="20" rx="2" fill="#3b2c1c"/>'
        '<rect x="7" y="5" width="26" height="14" rx="1" fill="#241a12"/>'
        '<path d="M2 22 L38 22 L40 28 L0 28 Z" fill="#4a3a26"/>')
    svg("props/tablet.svg", 36, 24, "",
        '<rect x="0" y="0" width="36" height="24" rx="3" fill="#3b2c1c"/>'
        '<rect x="3" y="3" width="30" height="18" rx="2" fill="#241a12"/>')


def elevator():
    defs = grad("d", [(0, "#6b4526"), (0.5, "#5a3a20"), (1, "#43290f")])
    panels = "".join(
        f'<rect x="{x}" y="{y}" width="34" height="52" rx="3" fill="#1e1108" opacity="0.4"/>'
        for x in (8, 58) for y in (12, 72))
    svg("elevator-doors.svg", 100, 140, defs,
        f'<rect x="0" y="0" width="100" height="140" rx="5" fill="{WOOD_L}"/>'
        '<rect x="4" y="6" width="92" height="134" fill="url(#d)"/>'
        + panels
        + '<rect x="48.5" y="6" width="3" height="134" fill="#2c1a0c"/>'
        + '<rect x="4" y="128" width="92" height="8" fill="#d9a441" opacity="0.2"/>'
        + '<rect x="4" y="6" width="92" height="5" fill="#ffebbe" opacity="0.12"/>'
        + '<rect x="20" y="52" width="60" height="34" rx="4" fill="#33200e" stroke="#d9a441" stroke-width="2"/>'
        + f'<text x="50" y="66" font-family="monospace" font-size="11" font-weight="bold" fill="#f2c35e" text-anchor="middle">ELEVATOR</text>'
        + f'<text x="50" y="79" font-family="monospace" font-size="11" font-weight="bold" fill="#f2c35e" text-anchor="middle">RFC</text>')


def stage_bg():
    W, H = 1200, 800
    defs = (
        grad("wall", [(0, "#241610"), (1, "#2e1d13")])
        + grad("slab", [(0, "#38230f"), (0.25, "#241608"), (1, "#170d05")])
        + grad("floorline", [(0, "#231610"), (1, "#1a100a")])
    )
    tiers = [(100, 312), (332, 540), (560, 748)]  # top,ground per tier
    body = [f'<rect width="{W}" height="{H}" fill="#120a07"/>']
    # pines + window lights
    for side, sgn in ((22, 1), (1178, -1)):
        for i in range(4):
            px, ph = side + sgn * i * 13, 270 - i * 40
            py = 440 + i * 112
            col = "#0c130e" if i % 2 else "#101a13"
            for tier in range(3):
                tw = ph * (0.5 - tier * 0.12)
                ty = py - ph * 0.35 * tier
                body.append(f'<path d="M{px} {ty-ph*0.5} L{px-tw} {ty} L{px+tw} {ty} Z" fill="{col}"/>')
    for i in range(10):
        lx = 30 + (i * 137) % 60 + (1100 if i % 2 else 0)
        ly = 200 + (i * 83) % 500
        body.append(f'<rect x="{lx}" y="{ly}" width="3" height="3" fill="#f6c05a" opacity="{0.2+((i*31)%5)*0.06}"/>')
    # frame
    body.append(f'<rect x="54" y="10" width="1092" height="780" rx="26" fill="#221410"/>')
    body.append('<rect x="60" y="16" width="1080" height="768" rx="22" fill="none" stroke="#40281b" stroke-width="3"/>')
    # tiers
    for top, ground in tiers:
        body.append(f'<rect x="96" y="{top}" width="1008" height="{ground-top}" fill="url(#wall)"/>')
        # panel seams + big panels
        for sx in range(96, 1104, 90):
            body.append(f'<line x1="{sx}" y1="{top}" x2="{sx}" y2="{ground}" stroke="#180d07" stroke-opacity="0.5"/>')
        for pxw in range(120, 1000, 126):
            body.append(f'<rect x="{pxw}" y="{top+24}" width="108" height="{ground-top-60}" fill="none" stroke="#0a0502" stroke-opacity="0.35" stroke-width="2"/>')
        # wainscot + gold pinline + haze
        body.append(f'<rect x="96" y="{ground-44}" width="1008" height="6" fill="#1e1109" opacity="0.75"/>')
        body.append(f'<rect x="96" y="{ground-38}" width="1008" height="1.6" fill="#d9a441" opacity="0.12"/>')
        body.append(f'<rect x="96" y="{ground-72}" width="1008" height="72" fill="#f6c05a" opacity="0.05"/>')
        # ceiling shadow
        body.append(f'<rect x="96" y="{top}" width="1008" height="40" fill="#0f0804" opacity="0.45"/>')
        # floor band + thick slab with warm lip
        body.append(f'<rect x="96" y="{ground-13}" width="1008" height="22" fill="url(#floorline)"/>')
        body.append(f'<rect x="84" y="{ground+9}" width="1032" height="24" fill="url(#slab)"/>')
        body.append(f'<rect x="84" y="{ground+9}" width="1032" height="2" fill="#e8a44e" opacity="0.12"/>')
    # interior partitions (upper two tiers)
    for top, ground in tiers[:2]:
        for wx in (402, 798):
            body.append(f'<rect x="{wx-8}" y="{top}" width="16" height="{ground-top+9}" fill="#2a190e"/>')
            body.append(f'<rect x="{wx-8}" y="{top}" width="2" height="{ground-top}" fill="#d9a441" opacity="0.1"/>')
    # elevator shaft recess
    body.append(f'<rect x="550" y="100" width="152" height="449" fill="#1c110a"/>')
    # sconce fixtures (glow is live)
    for sx, sy in ((360, 140), (1014, 138), (318, 372)):
        body.append(f'<rect x="{sx-4}" y="{sy}" width="8" height="14" fill="#3a281a"/>')
        body.append(f'<path d="M{sx-14} {sy-24} L{sx+14} {sy-24} L{sx+24} {sy} L{sx-24} {sy} Z" fill="#4a3826"/>')
    # plaques (static text is art; live labels stay in the app layer)
    def plaque(cx, cy, w, h, lines, size=13):
        p = [f'<rect x="{cx-w/2-3}" y="{cy-3}" width="{w+6}" height="{h+6}" rx="5" fill="#54341c"/>',
             f'<rect x="{cx-w/2}" y="{cy}" width="{w}" height="{h}" rx="4" fill="#2c1c10"/>',
             f'<rect x="{cx-w/2+3}" y="{cy+3}" width="{w-6}" height="{h-6}" fill="none" stroke="#8a6a34" stroke-width="1.2"/>']
        for i, ln in enumerate(lines):
            p.append(f'<text x="{cx}" y="{cy+size+4+i*(size+4)}" font-family="monospace" font-size="{size if i==0 else size-3}" font-weight="{700 if i==0 else 400}" fill="{"#d9a441" if i==0 else "#8a6a34"}" text-anchor="middle">{ln}</text>')
        return "".join(p)
    body.append(plaque(600, 116, 250, 52, ["TERRARIUM A", "OFFICE · SYSTEMS · GROWTH"], 16))
    body.append(plaque(140, 128, 62, 46, ["3F", "HALL"]))
    body.append(plaque(140, 360, 62, 46, ["1F", "PIT"]))
    body.append(plaque(486, 168, 46, 26, ["2F"]))
    body.append(plaque(222, 400, 150, 64, ["SYSTEMS", "NEVER SLEEP", "⚙"]))
    body.append(plaque(930, 392, 180, 64, ["CHIEF", "PAPER &amp; PARCHMENT", "⛨"]))
    body.append(plaque(210, 596, 220, 58, ["PIT PATROL", "KERNEL · LIVE · PAPER"]))
    # 2F door (3F hall, left of elevator)
    body.append(f'<rect x="452" y="188" width="70" height="124" rx="4" fill="#241408"/>')
    body.append(f'<rect x="456" y="192" width="62" height="120" fill="#33200e"/>')
    body.append(f'<rect x="461" y="198" width="52" height="108" fill="none" stroke="#4a2e16" stroke-width="2"/>')
    body.append('<circle cx="508" cy="252" r="4" fill="#d9a441"/>')
    # tables, crates, mug, binder, frame art, emblem, R plate
    def table(cx, gy, w, h):
        return (f'<rect x="{cx-w/2}" y="{gy-h}" width="{w}" height="{h*0.18}" rx="3" fill="#6b4526"/>'
                f'<rect x="{cx-w*0.36}" y="{gy-h*0.8}" width="{w*0.1}" height="{h*0.8}" fill="#54341c"/>'
                f'<rect x="{cx+w*0.27}" y="{gy-h*0.8}" width="{w*0.1}" height="{h*0.8}" fill="#54341c"/>')
    body.append(table(1060, 312, 96, 42))
    body.append(table(1064, 540, 100, 44))
    body.append(table(1078, 748, 76, 40))
    body.append(table(700, 748, 84, 38))
    for cx, cy, s in ((156, 540, 34), (196, 540, 26), (128, 748, 30), (170, 748, 22)):
        body.append(f'<rect x="{cx-s/2}" y="{cy-s}" width="{s}" height="{s}" rx="2" fill="#5f3d22" stroke="#4a2e18"/>')
        body.append(f'<line x1="{cx-s/2+2}" y1="{cy-s+2}" x2="{cx+s/2-2}" y2="{cy-2}" stroke="#4a2e18"/>')
    body.append('<rect x="1042" y="482" width="15" height="17" rx="2" fill="#8a5a3a"/>')  # mug
    body.append('<rect x="1066" y="486" width="26" height="7" rx="1.5" fill="#8a2f28"/>'
                '<rect x="1066" y="478" width="26" height="7" rx="1.5" fill="#a8433a"/>')  # binder
    body.append('<rect x="1028" y="150" width="64" height="56" rx="3" fill="#54341c"/>'
                '<rect x="1033" y="155" width="54" height="46" fill="#e8dfc8"/>'
                '<path d="M1060 196 C1052 184 1048 172 1054 162 C1060 172 1060 180 1060 192 Z" fill="#4f7d46"/>')
    # recessed emblem + railing
    body.append('<ellipse cx="980" cy="734" rx="118" ry="44" fill="#140c07"/>')
    body.append('<ellipse cx="980" cy="734" rx="98" ry="36" fill="#b45a1e"/>')
    body.append('<ellipse cx="980" cy="734" rx="76" ry="28" fill="#e88a2e" opacity="0.6"/>')
    body.append('<ellipse cx="980" cy="734" rx="54" ry="20" fill="#1c0f08"/>')
    body.append('<path d="M980 720 C973 727 973 740 980 746 C987 740 987 727 980 720 Z" fill="#e8a84e"/>')
    body.append('<path d="M962 736 A98 36 0 0 1 998 700" fill="none" stroke="#3a281a" stroke-width="4"/>')
    for rx in (-0.85, -0.4, 0.4, 0.85):
        px = 980 + rx * 98
        py = 734 - 36 * (1 - rx * rx) ** 0.5
        body.append(f'<line x1="{px}" y1="{py}" x2="{px}" y2="{py+26}" stroke="#3a281a" stroke-width="4"/>')
    body.append(plaque(626, 322, 62, 26, ["● R"], 12))
    svg("stage-bg.svg", W, H, defs, "".join(body))


print("generating Warm Ember asset pack:")
for spec in [("robot-cream-idle.svg", False, "idle"),
             ("robot-cream-laptop.svg", False, "laptop"),
             ("robot-cream-tablet.svg", False, "tablet"),
             ("robot-cream-talk.svg", False, "talk"),
             ("robot-chief-red.svg", True, "idle")]:
    robot(*spec)
props()
elevator()
stage_bg()
print("done")
