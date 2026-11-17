"""Generate the app's backgrounds: calm, abstract, flat-gradient compositions with fine grain.

Every composition is drawn at 2x and downsampled (crisp, anti-aliased edges), then saved as
high-quality WebP to assets/backgrounds/. Also writes src/ui/backgroundList.ts so the app's
list always matches what was generated.

Usage (from the repo root):
    python scripts/make-backgrounds.py [--preview sheet.png]
"""

import argparse
import math
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "backgrounds"
LIST = ROOT / "src" / "ui" / "backgroundList.ts"
W, H = 1200, 480
SS = 2  # supersampling
SW, SH = W * SS, H * SS


def rgb(value):
    value = value.lstrip("#")
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))


def gradient(c1, c2, angle=90):
    """Linear gradient over the full canvas; angle 90 = top->bottom, 0 = left->right."""
    a = math.radians(angle)
    yy, xx = np.mgrid[0:SH, 0:SW].astype(np.float32)
    t = (xx / SW) * math.cos(a) + (yy / SH) * math.sin(a)
    t = (t - t.min()) / (t.max() - t.min())
    c1, c2 = np.array(rgb(c1), np.float32), np.array(rgb(c2), np.float32)
    return Image.fromarray((c1 * (1 - t[..., None]) + c2 * t[..., None]).astype(np.uint8))


def radial(cx, cy, r, inner, outer):
    yy, xx = np.mgrid[0:SH, 0:SW].astype(np.float32)
    t = np.clip(np.hypot(xx - cx * SS, yy - cy * SS) / (r * SS), 0, 1)[..., None]
    c1, c2 = np.array(rgb(inner), np.float32), np.array(rgb(outer), np.float32)
    return Image.fromarray((c1 * (1 - t) + c2 * t).astype(np.uint8))


class Canvas:
    def __init__(self, top, bottom, angle=90):
        self.img = gradient(top, bottom, angle)

    def shape(self, draw_fn, fill, alpha=255):
        """`draw_fn(draw, s)` draws in 1x coordinates scaled by `s`; `fill` = colour or (c1, c2[, angle])."""
        mask = Image.new("L", (SW, SH), 0)
        draw_fn(ImageDraw.Draw(mask), SS)
        if alpha < 255:
            mask = mask.point(lambda v: v * alpha // 255)
        layer = gradient(*fill) if isinstance(fill, tuple) and len(fill) >= 2 and isinstance(fill[0], str) else Image.new("RGB", (SW, SH), rgb(fill))
        self.img.paste(layer, (0, 0), mask)

    def glow(self, cx, cy, r, color, strength=0.6):
        g = radial(cx, cy, r, color, "#000000")
        yy, xx = np.mgrid[0:SH, 0:SW].astype(np.float32)
        t = 1 - np.clip(np.hypot(xx - cx * SS, yy - cy * SS) / (r * SS), 0, 1)
        mask = Image.fromarray((t ** 2 * 255 * strength).astype(np.uint8))
        self.img.paste(Image.new("RGB", (SW, SH), rgb(color)), (0, 0), mask)

    def done(self, seed, grain=2.5, whiten=0.82):
        img = self.img.resize((W, H), Image.LANCZOS)
        if whiten:
            # Wash towards white: softer, lighter scenes with crisp edges (no blur).
            img = Image.blend(img, Image.new("RGB", (W, H), (255, 255, 255)), whiten)
        px = np.asarray(img).astype(np.float32)
        px += np.random.default_rng(seed).normal(0, grain, (H, W, 1))
        return Image.fromarray(np.clip(px, 0, 255).astype(np.uint8))


def wave_poly(y0, amp, period, phase, s, step=8):
    pts = [(x * s, (y0 + amp * math.sin(x / period + phase)) * s) for x in range(0, W + step, step)]
    return pts + [(W * s, H * s), (0, H * s)]


def ridge_poly(y0, amp, period, phase, s, step=6):
    pts = [(x * s, (y0 - amp * abs(math.sin(x / period + phase)) - amp * 0.25 * math.sin(x / (period / 3.3) + phase)) * s)
           for x in range(0, W + step, step)]
    return pts + [(W * s, H * s), (0, H * s)]


def circle(cx, cy, r):
    return lambda d, s: d.ellipse([(cx - r) * s, (cy - r) * s, (cx + r) * s, (cy + r) * s], fill=255)


# --- compositions ------------------------------------------------------------------------------
# Subjects lean right (behind the card buttons); the left keeps calm space for text.

def ocean_waves(r):
    c = Canvas("#e8f6f8", "#d3ecf2")
    c.glow(950, 110, 170, "#fff6df", 0.9)
    for i, col in enumerate(["#bfe3ea", "#9fd2df", "#7fbfd3", "#5fa8c4"]):
        c.shape(lambda d, s, i=i: d.polygon(wave_poly(220 + i * 62, 22, 150 + i * 20, i * 1.4 + r.random(), s), fill=255), col)
    return c


def sage_hills(r):
    c = Canvas("#f3f6ea", "#e4ecd6")
    c.shape(circle(930, 170, 70), ("#fbe3b8", "#f6c98d"))
    for i, col in enumerate(["#d3e2bf", "#b9d1a1", "#9cbd86", "#86aa72"]):
        c.shape(lambda d, s, i=i: d.polygon(wave_poly(250 + i * 55, 40, 240 - i * 25, i * 2.1 + 0.7, s), fill=255), col)
    return c


def dusk_mountains(r):
    c = Canvas("#efe7f7", "#f9e5e4")
    c.shape(circle(960, 120, 46), "#fff4e6")
    for i, cols in enumerate([("#d9cdee", "#e8dcef"), ("#bba9df", "#d2c2e6"), ("#9a86c9", "#b6a4d8")]):
        c.shape(lambda d, s, i=i: d.polygon(ridge_poly(250 + i * 70, 90 - i * 10, 210 + i * 30, i * 1.9, s), fill=255), cols)
    return c


def desert_dunes(r):
    c = Canvas("#fdf0e1", "#f8e2c9")
    c.shape(circle(900, 190, 85), ("#f7b989", "#f39a76"))
    for i, col in enumerate(["#f1d3b0", "#e8bf96", "#d9a67d"]):
        c.shape(lambda d, s, i=i: d.polygon(wave_poly(280 + i * 65, 48, 300 - i * 40, 2.4 * i + 1, s), fill=255), col)
    return c


def breath_rings(r):
    c = Canvas("#e9f6f3", "#dff0f4")
    cx, cy = 900, 240
    for k in range(9, 0, -1):
        rad = 30 + k * 34
        col = ["#d4ede8", "#c5e6e1", "#b5dfd9", "#a6d7d1"][k % 4]
        c.shape(circle(cx, cy, rad), col)
    c.shape(circle(cx, cy, 30), "#f8fffd")
    return c


def sunset_bands(r):
    c = Canvas("#fff1e6", "#ffe4dc")
    cx, cy, rad = 880, 330, 150
    c.shape(circle(cx, cy, rad), ("#ffb48a", "#ff8f8f"))
    for i in range(5):
        y = cy - 10 + i * 26
        c.shape(lambda d, s, y=y, i=i: d.rectangle([0, y * s, W * s, (y + 10 + i * 2) * s], fill=255), "#ffe9df")
    c.shape(lambda d, s: d.rectangle([0, 360 * s, W * s, H * s], fill=255), ("#ffd9cc", "#fbc7c0"))
    return c


def boho_arches(r):
    c = Canvas("#fbf3ea", "#f6e8da")
    cx, base = 900, H + 20
    for k, col in enumerate(["#e9b796", "#f4d6bd", "#d98f6d", "#f1c9a8", "#c7795a"]):
        rad = 260 - k * 48
        c.shape(lambda d, s, rad=rad: d.ellipse([(cx - rad) * s, (base - rad) * s, (cx + rad) * s, (base + rad) * s], fill=255), col)
    return c


def boho_sun(r):
    c = Canvas("#fdf6e3", "#f9ebcc")
    cx, cy = 900, 250
    for k in range(16):
        a = math.pi * 2 * k / 16
        c.shape(lambda d, s, a=a: d.line([((cx + 110 * math.cos(a)) * s, (cy + 110 * math.sin(a)) * s),
                                          ((cx + 175 * math.cos(a)) * s, (cy + 175 * math.sin(a)) * s)],
                                         fill=255, width=10 * s), "#efc77a")
    c.shape(circle(cx, cy, 88), ("#f6c35f", "#ee9f45"))
    return c


def moon_phases(r):
    # Twilight (light) palette so the card's dark text stays readable.
    c = Canvas("#ece9f8", "#dfdcf2")
    for _ in range(40):
        x, y = r.uniform(560, W), r.uniform(0, H)
        c.shape(circle(x, y, r.uniform(1, 2.2)), "#b8b2e0", 200)
    for k in range(5):
        x, rad = 640 + k * 120, 36
        c.shape(circle(x, 240, rad), ("#a99fd9", "#8e86c8"))
        shift = (k - 2) * 26
        if k != 2:
            c.shape(circle(x + shift, 240, rad), "#e4e1f5")
    return c


def aurora_ribbons(r):
    c = Canvas("#eef0fb", "#e6f3f3")
    for i, cols in enumerate([("#c9b6f2", "#a8e0dc", 0), ("#b0c8f5", "#f3c0dc", 0), ("#a7e3cf", "#c3b4f0", 0)]):
        y0 = 120 + i * 95

        def ribbon(d, s, y0=y0, i=i):
            top = [(x * s, (y0 + 50 * math.sin(x / 210 + i * 1.7)) * s) for x in range(0, W + 8, 8)]
            bottom = [(x * s, (y0 + 70 + 40 * math.sin(x / 240 + i * 1.7 + 0.8)) * s) for x in range(W, -8, -8)]
            d.polygon(top + bottom, fill=255)

        c.shape(ribbon, cols, 210)
    return c


def spring_field(r):
    c = Canvas("#eef8f3", "#e3f2e8")
    c.glow(980, 90, 220, "#fff8d8", 0.9)
    for i, col in enumerate(["#cfe9c8", "#b1dcad", "#93cd94", "#78bb80"]):
        c.shape(lambda d, s, i=i: d.polygon(wave_poly(300 + i * 45, 30 + i * 6, 320 - i * 50, 0.6 + i * 2.3, s), fill=255), col)
    return c


def lake_mirror(r):
    c = Canvas("#e8f0f8", "#f3eef5")
    horizon = 270
    for i, col in enumerate(["#c8d5ea", "#a9bbdc"]):
        def hills(d, s, i=i):
            pts = [(x * s, (horizon - 70 + i * 20 - 60 * abs(math.sin(x / (280 - i * 60) + i))) * s) for x in range(0, W + 8, 8)]
            d.polygon(pts + [(W * s, horizon * s), (0, horizon * s)], fill=255)
        c.shape(hills, col)
    c.shape(lambda d, s: d.rectangle([0, horizon * s, W * s, H * s], fill=255), ("#dfe7f3", "#eef2f8"))
    for i in range(6):
        y = horizon + 18 + i * 30
        c.shape(lambda d, s, y=y, i=i: d.rounded_rectangle([(760 + i * 12) * s, y * s, (1080 - i * 20) * s, (y + 5) * s], radius=3 * s, fill=255), "#c4d0e6", 200)
    return c


def chakra_arcs(r):
    c = Canvas("#fbf8f3", "#f4f0ea")
    colors = ["#e6a1a1", "#f2bf95", "#f3dd8f", "#a9d6a4", "#9cc7e6", "#a9a6e3", "#cfa6e3"]
    cx, cy = 980, H + 40
    for k, col in enumerate(colors):
        rad = 430 - k * 48
        c.shape(lambda d, s, rad=rad: d.ellipse([(cx - rad) * s, (cy - rad) * s, (cx + rad) * s, (cy + rad) * s], fill=255), col)
    c.shape(circle(cx, cy, 90), "#fbf8f3")
    return c


def topo_lines(r):
    c = Canvas("#eef4f1", "#e3ede8")
    cx, cy = 880, 230
    for k in range(14, 0, -1):
        rx, ry = 40 + k * 32, 26 + k * 21
        wob = r.uniform(0, 6)

        def contour(d, s, rx=rx, ry=ry, wob=wob):
            pts = []
            for t in range(0, 361, 4):
                a = math.radians(t)
                f = 1 + 0.07 * math.sin(3 * a + wob) + 0.04 * math.sin(5 * a + wob * 2)
                pts.append(((cx + rx * f * math.cos(a)) * s, (cy + ry * f * math.sin(a)) * s))
            d.line(pts, fill=255, width=3 * s, joint="curve")

        c.shape(contour, "#9fc4b4", 230)
    return c


def bauhaus_circles(r):
    c = Canvas("#f7f1e8", "#f1e9dd")
    c.shape(circle(860, 210, 150), "#f3c6b5", 235)
    c.shape(circle(1010, 300, 120), "#b9d3e3", 210)
    c.shape(circle(930, 120, 70), "#f3dc9c", 220)
    c.shape(lambda d, s: d.rectangle([700 * s, 380 * s, 1160 * s, 392 * s], fill=255), "#d9b8a4")
    return c


def ocean_sunpath(r):
    c = Canvas("#fde8de", "#f4dbe6")
    horizon = 260
    c.shape(circle(900, horizon, 90), ("#ffc89a", "#ffa38f"))
    c.shape(lambda d, s: d.rectangle([0, horizon * s, W * s, H * s], fill=255), ("#b9cbe8", "#9eb3dd"))
    for i in range(7):
        y = horizon + 14 + i * 28
        half = 110 - i * 12
        c.shape(lambda d, s, y=y, half=half: d.rounded_rectangle([(900 - half) * s, y * s, (900 + half) * s, (y + 7) * s], radius=4 * s, fill=255), "#ffd3b4", 220)
    return c


def night_hills(r):
    # Light "evening" palette so the card's dark text stays readable.
    c = Canvas("#e6ecf8", "#efe6f3")
    c.shape(circle(950, 120, 50), "#f2c9a8")
    c.shape(circle(972, 108, 46), "#e7ebf8")
    for _ in range(50):
        c.shape(circle(r.uniform(560, W), r.uniform(0, 260), r.uniform(1, 2.2)), "#b9c3e4", 220)
    for i, col in enumerate(["#c9d2ec", "#b3bfe2", "#9dacd8"]):
        c.shape(lambda d, s, i=i: d.polygon(wave_poly(330 + i * 45, 35, 260 - i * 30, i * 1.8, s), fill=255), col)
    return c


def desert_arches_sun(r):
    c = Canvas("#fbeee3", "#f5dfcf")
    c.shape(circle(1000, 150, 60), "#e98c6b")
    for k, (x, w, h, col) in enumerate([(780, 150, 260, "#e5b598"), (900, 170, 200, "#d99a7b"), (1040, 130, 300, "#efc9ad")]):
        c.shape(lambda d, s, x=x, w=w, h=h: (d.rectangle([(x - w / 2) * s, (H - h + w / 2) * s, (x + w / 2) * s, H * s], fill=255),
                                           d.ellipse([(x - w / 2) * s, (H - h) * s, (x + w / 2) * s, (H - h + w) * s], fill=255)), col)
    return c


def organic_blobs(r):
    c = Canvas("#f4f1fb", "#eef6f6")
    for cx, cy, rad, col in ((840, 160, 130, "#d8cdf3"), (1010, 300, 150, "#bfe6dd"), (760, 360, 90, "#f6d3e0")):
        seed = r.uniform(0, 6)

        def blob(d, s, cx=cx, cy=cy, rad=rad, seed=seed):
            pts = []
            for t in range(0, 360, 3):
                a = math.radians(t)
                f = 1 + 0.12 * math.sin(2 * a + seed) + 0.08 * math.sin(3 * a + seed * 1.7)
                pts.append(((cx + rad * f * math.cos(a)) * s, (cy + rad * f * math.sin(a)) * s))
            d.polygon(pts, fill=255)

        c.shape(blob, col, 235)
    return c


def breath_lines(r):
    c = Canvas("#eaf3fb", "#e7eefa")
    for k in range(48):
        x = 640 + k * 11.5
        amp = 150 * math.exp(-((k - 24) / 11) ** 2) * (0.65 + 0.35 * math.sin(k * 0.9)) + 6
        c.shape(lambda d, s, x=x, amp=amp: d.rounded_rectangle([(x - 3) * s, (240 - amp) * s, (x + 3) * s, (240 + amp) * s], radius=3 * s, fill=255),
                ("#9fc1ea", "#b7a8e6"), 230)
    return c


def zen_garden(r):
    c = Canvas("#f4f0e8", "#ece5d8")
    cx, cy = 930, 250
    for k in range(10, 0, -1):
        rad = 40 + k * 26
        c.shape(lambda d, s, rad=rad: d.ellipse([(cx - rad * 1.7) * s, (cy - rad * 0.6) * s, (cx + rad * 1.7) * s, (cy + rad * 0.6) * s],
                                                outline=255, width=3 * s), "#d3c8b4", 230)
    c.shape(lambda d, s: d.ellipse([(cx - 60) * s, (cy - 26) * s, (cx + 60) * s, (cy + 26) * s], fill=255), ("#a99f91", "#8f8578"))
    for i in range(0, 600, 34):
        c.shape(lambda d, s, i=i: d.line([(0, (i - 40) * s), (W * s * 0.45, (i - 40) * s)], fill=255, width=2 * s), "#ddd3c2", 200)
    return c


def lotus_petals(r):
    c = Canvas("#fbf1f4", "#f6e6ef")
    cx, cy = 900, 250
    for layer, (count, length, width, col) in enumerate(((12, 190, 46, "#f3cfdc"), (10, 140, 40, "#ebb3c8"), (8, 90, 30, "#e098b5"))):
        for k in range(count):
            a = 2 * math.pi * (k + layer * 0.5) / count

            def petal(d, s, a=a, length=length, width=width):
                tip = (cx + length * math.cos(a), cy + length * math.sin(a))
                mid = (cx + 0.55 * length * math.cos(a), cy + 0.55 * length * math.sin(a))
                nx, ny = -math.sin(a) * width, math.cos(a) * width
                pts = [(cx, cy), (mid[0] + nx, mid[1] + ny), tip, (mid[0] - nx, mid[1] - ny)]
                d.polygon([(x * s, y * s) for x, y in pts], fill=255)

            c.shape(petal, col, 220)
    c.shape(circle(cx, cy, 34), ("#f8d9a0", "#f1c07a"))
    return c


def tide_lines(r):
    c = Canvas("#eaf4f6", "#e0eef3")
    for k in range(16):
        y0 = 40 + k * 28

        def line(d, s, y0=y0, k=k):
            pts = [(x * s, (y0 + 34 * math.sin(x / 170 + k * 0.35)) * s) for x in range(500, W + 8, 8)]
            d.line(pts, fill=255, width=5 * s, joint="curve")

        c.shape(line, ("#8ec5d6", "#a7b9e6", 0), 220)
    return c


def dawn_rays(r):
    c = Canvas("#fff3e3", "#fde6dc")
    cx, cy = 1060, H + 40
    for k in range(14):
        a0 = math.radians(180 + k * 6.5)
        a1 = a0 + math.radians(3.2)
        c.shape(lambda d, s, a0=a0, a1=a1: d.polygon(
            [(cx * s, cy * s), ((cx + 900 * math.cos(a0)) * s, (cy + 900 * math.sin(a0)) * s),
             ((cx + 900 * math.cos(a1)) * s, (cy + 900 * math.sin(a1)) * s)], fill=255), "#fbd3b4", 200)
    c.shape(circle(cx, cy, 170), ("#ffb98c", "#ff9a7e"))
    return c


def lily_pond(r):
    c = Canvas("#e6f3ef", "#d6ebe7")
    for cx, cy, rad, col in ((820, 170, 80, "#a9d4bf"), (980, 300, 110, "#94c8b0"), (1110, 140, 60, "#b8dcc8"), (760, 360, 50, "#a0cfb8")):
        c.shape(lambda d, s, cx=cx, cy=cy, rad=rad: d.pieslice(
            [(cx - rad) * s, (cy - rad) * s, (cx + rad) * s, (cy + rad) * s], start=20, end=360, fill=255), col)
    c.shape(circle(990, 290, 18), ("#f6c1d3", "#ee9fbd"))
    return c


CARDS = [ocean_waves, sage_hills, dusk_mountains, desert_dunes, breath_rings, sunset_bands, boho_arches,
         boho_sun, moon_phases, aurora_ribbons, spring_field, lake_mirror, chakra_arcs, topo_lines,
         bauhaus_circles, ocean_sunpath, night_hills, desert_arches_sun, organic_blobs, breath_lines, zen_garden]
TILES = {"tile-mint": lily_pond, "tile-sky": tide_lines, "tile-peach": dawn_rays, "tile-lilac": lotus_petals}


def build():
    images = {}
    for name, comp in TILES.items():
        images[name] = comp(random.Random(name)).done(seed=len(images))
    for i, comp in enumerate(CARDS):
        images[f"card-{i:02d}"] = comp(random.Random(i)).done(seed=100 + i)
    return images


def write_list(card_names):
    lines = [
        "// Generated by scripts/make-backgrounds.py: do not edit by hand.",
        "import type {ImageSourcePropType} from 'react-native';",
        "",
        "export const tileImages = {",
        "  mint: require('../../assets/backgrounds/tile-mint.webp'),",
        "  sky: require('../../assets/backgrounds/tile-sky.webp'),",
        "  peach: require('../../assets/backgrounds/tile-peach.webp'),",
        "  lilac: require('../../assets/backgrounds/tile-lilac.webp'),",
        "};",
        "",
        "export const cardImages: ImageSourcePropType[] = [",
        *[f"  require('../../assets/backgrounds/{n}.webp')," for n in card_names],
        "];",
        "",
    ]
    LIST.write_text("\n".join(lines), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--preview", type=Path)
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    for old in list(OUT.glob("*.jpg")) + list(OUT.glob("*.webp")):
        old.unlink()
    images = build()
    for name, image in images.items():
        image.save(OUT / f"{name}.webp", quality=92, method=6)
    write_list([n for n in images if n.startswith("card-")])
    print(f"wrote {len(images)} backgrounds to {OUT} and {LIST}")
    if args.preview:
        cols = 4
        thumbs = list(images.items())
        rows = math.ceil(len(thumbs) / cols)
        sheet = Image.new("RGB", (cols * 360 + 10, rows * 168 + 10), "white")
        draw = ImageDraw.Draw(sheet)
        try:
            font = ImageFont.truetype("arial.ttf", 14)
        except OSError:
            font = ImageFont.load_default()
        for i, (name, im) in enumerate(thumbs):
            x, y = 10 + (i % cols) * 360, 10 + (i // cols) * 168
            sheet.paste(im.resize((350, 140), Image.LANCZOS), (x, y))
            draw.text((x, y + 142), name, fill=(60, 60, 60), font=font)
        sheet.save(args.preview)
        print(f"preview {args.preview}")


if __name__ == "__main__":
    main()
