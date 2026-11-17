"""Generate the original "121 Wall push-up.gif" exercise animation.

Clean-room media: a simple stick figure drawn from geometry, matching the
640x360 frame size of the bundled exercise GIFs.

Usage (from the repo root):
    python scripts/make-wall-pushup-gif.py
"""

import math
from pathlib import Path

from PIL import Image, ImageDraw

WIDTH, HEIGHT = 640, 360
BACKGROUND = (255, 255, 255)
WALL = (170, 180, 190)
FLOOR = (205, 212, 218)
BODY = (34, 111, 184)
LIMB = 14
OUT = Path(__file__).resolve().parent.parent / "assets" / "exercises" / "121 Wall push-up.gif"

ANKLE = (282.0, 318.0)
HAND = (462.0, 128.0)
BODY_LENGTH = 225.0  # ankle -> shoulder
UPPER_ARM = 66.0
FOREARM = 66.0


def circle_intersection(c0, r0, c1, r1, pick_upper=True):
    dx, dy = c1[0] - c0[0], c1[1] - c0[1]
    d = math.hypot(dx, dy)
    a = (r0 * r0 - r1 * r1 + d * d) / (2 * d)
    h = math.sqrt(max(0.0, r0 * r0 - a * a))
    mx, my = c0[0] + a * dx / d, c0[1] + a * dy / d
    p1 = (mx + h * dy / d, my - h * dx / d)
    p2 = (mx - h * dy / d, my + h * dx / d)
    return min(p1, p2, key=lambda p: p[1]) if pick_upper else max(p1, p2, key=lambda p: p[1])


def lerp(p, q, t):
    return (p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t)


def frame(reach: float) -> Image.Image:
    """reach = shoulder-to-hand distance (UPPER_ARM + FOREARM is fully extended)."""
    image = Image.new("RGB", (WIDTH, HEIGHT), BACKGROUND)
    draw = ImageDraw.Draw(image)

    draw.rectangle([470, 20, 490, 330], fill=WALL)
    draw.rectangle([60, 326, 580, 334], fill=FLOOR)

    shoulder = circle_intersection(ANKLE, BODY_LENGTH, HAND, reach, pick_upper=True)
    hip = lerp(ANKLE, shoulder, 0.52)
    knee = lerp(ANKLE, shoulder, 0.26)
    elbow = circle_intersection(shoulder, UPPER_ARM, HAND, FOREARM, pick_upper=False)

    direction = ((shoulder[0] - ANKLE[0]) / BODY_LENGTH, (shoulder[1] - ANKLE[1]) / BODY_LENGTH)
    neck = (shoulder[0] + direction[0] * 18, shoulder[1] + direction[1] * 18)
    head = (shoulder[0] + direction[0] * 46, shoulder[1] + direction[1] * 46)

    def line(*points, width=LIMB):
        draw.line([tuple(map(round, p)) for p in points], fill=BODY, width=width, joint="curve")

    line((ANKLE[0] - 22, ANKLE[1] + 6), ANKLE)  # foot
    line(ANKLE, knee, hip, shoulder, neck, width=LIMB + 4)
    line(shoulder, elbow, HAND)
    for joint in (ANKLE, knee, hip, shoulder, elbow, HAND):
        r = LIMB / 2
        draw.ellipse([joint[0] - r, joint[1] - r, joint[0] + r, joint[1] + r], fill=BODY)
    draw.ellipse([head[0] - 22, head[1] - 22, head[0] + 22, head[1] + 22], fill=BODY)
    return image


def main() -> None:
    extended = UPPER_ARM + FOREARM - 0.5
    bent = 70.0
    frames = [frame(extended), frame((extended + bent) / 2), frame(bent), frame((extended + bent) / 2)]
    durations = [700, 250, 700, 250]
    frames[0].save(OUT, save_all=True, append_images=frames[1:], duration=durations, loop=0, optimize=True)
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
