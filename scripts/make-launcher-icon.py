"""Generate the Move launcher icon ("Stretch": spine + head + motion arc) for every density.

Writes adaptive-icon layers (API 26+: gradient background, foreground, monochrome) plus
legacy square and round PNGs.

Usage (from the repo root):
    python scripts/make-launcher-icon.py
"""

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

RES = Path(__file__).resolve().parent.parent / "android" / "app" / "src" / "main" / "res"
DENSITIES = {"mdpi": 1.0, "hdpi": 1.5, "xhdpi": 2.0, "xxhdpi": 3.0, "xxxhdpi": 4.0}
SS = 4  # supersampling factor

GRADIENT_TOP = (24, 170, 120)
GRADIENT_BOTTOM = (12, 96, 86)
WHITE = (255, 255, 255, 255)
DISC = (150, 235, 200, 255)
HEAD = (255, 196, 92, 255)
ARC = (255, 255, 255, 140)
# Fraction of the 108dp adaptive canvas the artwork spans (66dp safe zone ≈ 0.61).
ADAPTIVE_ART_SCALE = 0.64


def gradient(size: int) -> Image.Image:
    image = Image.new("RGBA", (size, size))
    draw = ImageDraw.Draw(image)
    for y in range(size):
        t = y / max(1, size - 1)
        color = tuple(round(a + (b - a) * t) for a, b in zip(GRADIENT_TOP, GRADIENT_BOTTOM))
        draw.line([(0, y), (size, y)], fill=color + (255,))
    return image


def vertebra(w: float, h: float, disc: bool) -> Image.Image:
    tw, th = int(w * 1.9), int(h * 2.0)
    tile = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    d = ImageDraw.Draw(tile)
    cx, cy = tw / 2, th / 2
    ww, wh = w * 0.30, h * 0.36
    for side in (-1, 1):  # transverse processes
        x = cx + side * (w / 2 + ww * 0.05)
        d.rounded_rectangle([x - ww / 2, cy - h * 0.38 - wh / 2, x + ww / 2, cy - h * 0.38 + wh / 2],
                            radius=wh / 2, fill=WHITE)
    d.rounded_rectangle([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], radius=h * 0.38, fill=WHITE)
    if disc:
        d.rounded_rectangle([cx - w * 0.36, cy + h * 0.64, cx + w * 0.36, cy + h * 0.90],
                            radius=h * 0.08, fill=DISC)
    return tile


def artwork(size: int, monochrome: bool = False) -> Image.Image:
    """Spine, head and motion arc on a transparent canvas designed for a full-bleed icon."""
    art = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    count, top, bottom = 5, size * 0.34, size * 0.86
    step = (bottom - top) / count
    amp = size * 0.03
    for i in range(count):
        t = (i + 0.5) / count
        y = top + step * (i + 0.5)
        x = size * 0.50 + amp * math.sin(t * 2 * math.pi - 0.4)
        slope = amp * 2 * math.pi * math.cos(t * 2 * math.pi - 0.4) / (bottom - top)
        width = size * 0.22 * (0.85 + 0.15 * t * 1.3)
        tile = vertebra(width, step * 0.60, disc=i < count - 1)
        tile = tile.rotate(-math.degrees(math.atan(slope)) * 0.25, resample=Image.BICUBIC, expand=True)
        art.alpha_composite(tile, (int(x - tile.width / 2), int(y - tile.height / 2)))

    d = ImageDraw.Draw(art)
    r, hx, hy = size * 0.085, size * 0.50, size * 0.21
    d.ellipse([hx - r, hy - r, hx + r, hy + r], fill=WHITE if monochrome else HEAD)
    d.arc([size * 0.18, size * 0.12, size * 0.86, size * 0.80], start=200, end=290,
          fill=WHITE if monochrome else ARC, width=int(size * 0.025))
    if monochrome:
        return art

    shadow_alpha = art.getchannel("A").point(lambda v: v * 70 // 255)
    shadow = Image.new("RGBA", art.size, (0, 0, 0, 0))
    shadow.putalpha(shadow_alpha)
    shadow = shadow.filter(ImageFilter.GaussianBlur(size * 0.025))
    out = Image.new("RGBA", art.size, (0, 0, 0, 0))
    out.alpha_composite(shadow, (0, int(size * 0.035)))
    out.alpha_composite(art)
    return out


def legacy(px: int, round_mask: bool) -> Image.Image:
    big = px * SS
    image = gradient(big)
    inner = round(big * 0.86)
    offset = (big - inner) // 2
    image.alpha_composite(artwork(inner), (offset, offset + round(big * 0.02)))
    mask = Image.new("L", (big, big), 0)
    if round_mask:
        ImageDraw.Draw(mask).ellipse([0, 0, big - 1, big - 1], fill=255)
    else:
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, big - 1, big - 1], radius=int(big * 0.23), fill=255)
    image.putalpha(mask)
    return image.resize((px, px), Image.LANCZOS)


def adaptive_foreground(px: int, monochrome: bool = False) -> Image.Image:
    big = px * SS
    inner = round(big * ADAPTIVE_ART_SCALE)
    canvas = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    canvas.alpha_composite(artwork(inner, monochrome), ((big - inner) // 2, (big - inner) // 2))
    return canvas.resize((px, px), Image.LANCZOS)


def main() -> None:
    for name, scale in DENSITIES.items():
        folder = RES / f"mipmap-{name}"
        folder.mkdir(parents=True, exist_ok=True)
        size48, size108 = round(48 * scale), round(108 * scale)
        legacy(size48, round_mask=False).save(folder / "ic_launcher.png")
        legacy(size48, round_mask=True).save(folder / "ic_launcher_round.png")
        adaptive_foreground(size108).save(folder / "ic_launcher_foreground.png")
        adaptive_foreground(size108, monochrome=True).save(folder / "ic_launcher_monochrome.png")
        gradient(size108 * SS).resize((size108, size108), Image.LANCZOS).save(folder / "ic_launcher_background.png")

    stale_color = RES / "values" / "ic_launcher_background.xml"
    if stale_color.exists():
        stale_color.unlink()

    anydpi = RES / "mipmap-anydpi-v26"
    anydpi.mkdir(exist_ok=True)
    adaptive = (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
        '    <background android:drawable="@mipmap/ic_launcher_background" />\n'
        '    <foreground android:drawable="@mipmap/ic_launcher_foreground" />\n'
        '    <monochrome android:drawable="@mipmap/ic_launcher_monochrome" />\n'
        "</adaptive-icon>\n"
    )
    for icon in ("ic_launcher.xml", "ic_launcher_round.xml"):
        (anydpi / icon).write_text(adaptive, encoding="utf-8")
    print(f"wrote launcher icons under {RES}")


if __name__ == "__main__":
    main()
