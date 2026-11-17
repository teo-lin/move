"""Turn 2-4 still pose images into an exercise GIF that matches the bundled ones.

The bundled GIFs are slideshows of key poses: 640x360, white background, ~670 ms per pose.
All frames get the SAME crop (the union of where the person is in every frame) so the figure
doesn't jump between poses; near-white background pixels are flattened to pure white.

Usage:
    python scripts/ai/stills-to-gif.py out/pull-1.png out/pull-2.png --out "assets/exercises/122 Band pull-apart.gif"
"""

import argparse
from pathlib import Path

import numpy as np
from PIL import Image

SIZE = (640, 360)
MARGIN = 0.06  # fraction of the crop kept as white space around the person


def load(path: Path, white_threshold: int) -> Image.Image:
    img = Image.open(path).convert("RGB")
    px = np.asarray(img).astype(np.int16)
    near_white = (px >= white_threshold).all(axis=2)
    # Faint neutral greys (thin borders AI tools add) also become white.
    near_white |= (px.min(axis=2) >= 200) & ((px.max(axis=2) - px.min(axis=2)) <= 12)
    px[near_white] = 255  # flatten off-white studio backgrounds
    return Image.fromarray(px.astype(np.uint8))


def content_box(img: Image.Image, white_threshold: int, dark: int = 200, min_pixels: int = 3):
    """Bounding box of the person: clearly dark pixels only, ignoring faint lines/edges
    (AI images often carry a thin grey border) and isolated specks."""
    px = np.asarray(img)
    mask = px.min(axis=2) < dark
    cols = np.where(mask.sum(axis=0) >= min_pixels)[0]
    rows = np.where(mask.sum(axis=1) >= min_pixels)[0]
    # A full-height/width faint line is not "dark", but guard against a dark border too.
    cols = cols[(cols > 1) & (cols < px.shape[1] - 2)]
    rows = rows[(rows > 1) & (rows < px.shape[0] - 2)]
    return cols.min(), rows.min(), cols.max(), rows.max()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("images", nargs="+", type=Path, help="2-4 key poses, in order")
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--ms", type=int, default=670, help="time per pose (bundled GIFs: 670 ms)")
    parser.add_argument("--white", type=int, default=238, help="pixels this bright on all channels become white")
    args = parser.parse_args()

    frames = [load(p, args.white) for p in args.images]
    # Same size for all frames (resize to the first one's size if a tool returned a different size).
    frames = [f if f.size == frames[0].size else f.resize(frames[0].size, Image.LANCZOS) for f in frames]

    boxes = [content_box(f, args.white) for f in frames]
    x0, y0 = min(b[0] for b in boxes), min(b[1] for b in boxes)
    x1, y1 = max(b[2] for b in boxes), max(b[3] for b in boxes)
    # Grow the union box to 16:9 with a margin, centred on the content.
    w, h = (x1 - x0) * (1 + 2 * MARGIN), (y1 - y0) * (1 + 2 * MARGIN)
    if w / h < SIZE[0] / SIZE[1]:
        w = h * SIZE[0] / SIZE[1]
    else:
        h = w * SIZE[1] / SIZE[0]
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    box = (round(cx - w / 2), round(cy - h / 2), round(cx + w / 2), round(cy + h / 2))

    out = []
    for f in frames:
        canvas = Image.new("RGB", (box[2] - box[0], box[3] - box[1]), (255, 255, 255))
        canvas.paste(f, (-box[0], -box[1]))  # crop with white padding if the box leaves the image
        out.append(canvas.resize(SIZE, Image.LANCZOS).convert("P", palette=Image.ADAPTIVE, colors=128))

    args.out.parent.mkdir(parents=True, exist_ok=True)
    out[0].save(args.out, save_all=True, append_images=out[1:], duration=args.ms, loop=0, optimize=True)
    print(f"wrote {args.out} ({len(out)} poses, {args.ms} ms each)")


if __name__ == "__main__":
    main()
