"""Generate the Move launcher icon ("M-motion": rounded M, amber dot, speed lines) for every density.

Writes adaptive-icon layers (API 26+: gradient background, foreground, monochrome) plus
legacy square and round PNGs.

Usage (from the repo root):
    python scripts/make-launcher-icon.py
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

RES = Path(__file__).resolve().parent.parent / "android" / "app" / "src" / "main" / "res"
DENSITIES = {"mdpi": 1.0, "hdpi": 1.5, "xhdpi": 2.0, "xxhdpi": 3.0, "xxxhdpi": 4.0}
SS = 4  # supersampling factor

GRADIENT_TOP = (24, 170, 120)
GRADIENT_BOTTOM = (12, 96, 86)
WHITE = (255, 255, 255, 255)
DOT = (255, 196, 92, 255)
LINES = (255, 255, 255, 170)
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


def stroke(draw: ImageDraw.ImageDraw, size: int, points, width: float, color) -> None:
    pts = [(x * size, y * size) for x, y in points]
    draw.line(pts, fill=color, width=int(width * size), joint="curve")
    r = width * size / 2
    for x, y in (pts[0], pts[-1]):
        draw.ellipse([x - r, y - r, x + r, y + r], fill=color)


def artwork(size: int, monochrome: bool = False) -> Image.Image:
    """Rounded "M" with an amber dot and three speed lines, designed for a full-bleed icon."""
    art = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(art)
    stroke(d, size, [(0.22, 0.74), (0.22, 0.30), (0.42, 0.56), (0.62, 0.30), (0.62, 0.74)], 0.11, WHITE)
    r, cx, cy = size * 0.07, size * 0.80, size * 0.30
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=WHITE if monochrome else DOT)
    for i, y in enumerate((0.48, 0.60, 0.72)):
        stroke(d, size, [(0.74, y), (0.86 - i * 0.03, y)], 0.035, WHITE if monochrome else LINES)
    if monochrome:
        return art

    shadow_alpha = art.getchannel("A").point(lambda v: v * 60 // 255)
    shadow = Image.new("RGBA", art.size, (0, 0, 0, 0))
    shadow.putalpha(shadow_alpha)
    shadow = shadow.filter(ImageFilter.GaussianBlur(size * 0.02))
    out = Image.new("RGBA", art.size, (0, 0, 0, 0))
    out.alpha_composite(shadow, (0, int(size * 0.025)))
    out.alpha_composite(art)
    return out


def legacy(px: int, round_mask: bool) -> Image.Image:
    big = px * SS
    image = gradient(big)
    inner = round(big * 0.84)
    offset = (big - inner) // 2
    image.alpha_composite(artwork(inner), (offset, offset))
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
