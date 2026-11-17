"""Generate the Move launcher icon's adaptive-icon layers.

Foreground: Material Symbols "self_improvement" as a vector drawable
(android/app/src/main/res/drawable/self_improvement_24.xml, inset by
drawable/ic_launcher_foreground.xml). It is also the themed (monochrome) icon.
Background: a green gradient PNG per density, generated here.

minSdk is 29, so adaptive icons (API 26+) cover every device and no legacy PNGs are needed.

Usage (from the repo root):
    python scripts/make-launcher-icon.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

RES = Path(__file__).resolve().parent.parent / "android" / "app" / "src" / "main" / "res"
DENSITIES = {"mdpi": 1.0, "hdpi": 1.5, "xhdpi": 2.0, "xxhdpi": 3.0, "xxxhdpi": 4.0}
GRADIENT_TOP = (24, 170, 120)
GRADIENT_BOTTOM = (12, 96, 86)
STALE = ("ic_launcher.png", "ic_launcher_round.png", "ic_launcher_foreground.png", "ic_launcher_monochrome.png")


def gradient(size: int) -> Image.Image:
    image = Image.new("RGB", (size, size))
    draw = ImageDraw.Draw(image)
    for y in range(size):
        t = y / max(1, size - 1)
        draw.line([(0, y), (size, y)], fill=tuple(round(a + (b - a) * t) for a, b in zip(GRADIENT_TOP, GRADIENT_BOTTOM)))
    return image


def main() -> None:
    for name, scale in DENSITIES.items():
        folder = RES / f"mipmap-{name}"
        folder.mkdir(parents=True, exist_ok=True)
        gradient(round(108 * scale)).save(folder / "ic_launcher_background.png")
        for stale in STALE:
            (folder / stale).unlink(missing_ok=True)

    anydpi = RES / "mipmap-anydpi-v26"
    anydpi.mkdir(exist_ok=True)
    adaptive = (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
        '    <background android:drawable="@mipmap/ic_launcher_background" />\n'
        '    <foreground android:drawable="@drawable/ic_launcher_foreground" />\n'
        '    <monochrome android:drawable="@drawable/ic_launcher_foreground" />\n'
        "</adaptive-icon>\n"
    )
    for icon in ("ic_launcher.xml", "ic_launcher_round.xml"):
        (anydpi / icon).write_text(adaptive, encoding="utf-8")
    print(f"wrote launcher icon layers under {RES}")


if __name__ == "__main__":
    main()
