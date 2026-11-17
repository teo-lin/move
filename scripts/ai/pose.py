"""Pose animator: exact exercise movement as an OpenPose-style skeleton video.

Each exercise is a list of key poses (2D keypoints, normalized 0..1 on an 832x480 frame) with
timings. Frames are eased between key poses and drawn in OpenPose colours on black: that video is
the movement guide for pose-controlled generation (Wan 2.1 VACE). A white-background preview GIF
is written too, so the form can be checked before any AI rendering.

Usage:
    python scripts/ai/pose.py band-pull-apart --out out/band-pull-apart-pose.gif
"""

import argparse
import math
from pathlib import Path

from PIL import Image, ImageDraw

W, H = 832, 480

# OpenPose BODY_18 keypoint names (performer's right/left: "r" appears on the image's left in a front view).
NAMES = ["nose", "neck", "r_sho", "r_elb", "r_wri", "l_sho", "l_elb", "l_wri", "r_hip", "r_kne", "r_ank",
         "l_hip", "l_kne", "l_ank", "r_eye", "l_eye", "r_ear", "l_ear"]
LIMBS = [("neck", "r_sho"), ("neck", "l_sho"), ("r_sho", "r_elb"), ("r_elb", "r_wri"), ("l_sho", "l_elb"),
         ("l_elb", "l_wri"), ("neck", "r_hip"), ("r_hip", "r_kne"), ("r_kne", "r_ank"), ("neck", "l_hip"),
         ("l_hip", "l_kne"), ("l_kne", "l_ank"), ("neck", "nose"), ("nose", "r_eye"), ("r_eye", "r_ear"),
         ("nose", "l_eye"), ("l_eye", "l_ear")]
COLORS = [(255, 0, 0), (255, 85, 0), (255, 170, 0), (255, 255, 0), (170, 255, 0), (85, 255, 0), (0, 255, 0),
          (0, 255, 85), (0, 255, 170), (0, 255, 255), (0, 170, 255), (0, 85, 255), (0, 0, 255), (85, 0, 255),
          (170, 0, 255), (255, 0, 255), (255, 0, 170), (255, 0, 85)]


def standing_front():
    """Neutral standing pose, front view, full body centred."""
    return {
        "nose": (0.500, 0.150), "neck": (0.500, 0.235), "r_eye": (0.490, 0.135), "l_eye": (0.510, 0.135),
        "r_ear": (0.478, 0.142), "l_ear": (0.522, 0.142),
        "r_sho": (0.458, 0.245), "l_sho": (0.542, 0.245),
        "r_elb": (0.448, 0.385), "l_elb": (0.552, 0.385), "r_wri": (0.446, 0.515), "l_wri": (0.554, 0.515),
        "r_hip": (0.476, 0.535), "l_hip": (0.524, 0.535), "r_kne": (0.474, 0.715), "l_kne": (0.526, 0.715),
        "r_ank": (0.472, 0.890), "l_ank": (0.528, 0.890),
    }


def pose(base, **overrides):
    p = dict(base)
    p.update(overrides)
    return p


def band_pull_apart():
    stand = standing_front()
    # Arms straight forward at chest height, hands together (foreshortened in a front view).
    start = pose(stand, r_elb=(0.472, 0.262), r_wri=(0.490, 0.272), l_elb=(0.528, 0.262), l_wri=(0.510, 0.272))
    # Arms opened to a T at chest height, band against the chest, shoulder blades squeezed.
    open_ = pose(stand, r_sho=(0.460, 0.248), l_sho=(0.540, 0.248),
                 r_elb=(0.378, 0.255), r_wri=(0.296, 0.262), l_elb=(0.622, 0.255), l_wri=(0.704, 0.262))
    # (pose, seconds to move into it, seconds to hold it)
    return [(start, 0.0, 0.35), (open_, 1.1, 0.35), (start, 1.4, 0.0)]


EXERCISES = {"band-pull-apart": band_pull_apart}


def ease(t):
    return 0.5 - 0.5 * math.cos(math.pi * t)  # smooth in/out, like a controlled rep


def timeline(keys, fps):
    frames = []
    previous = keys[0][0]
    for target, move, hold in keys:
        steps = max(0, round(move * fps))
        for i in range(1, steps + 1):
            t = ease(i / steps)
            frames.append({k: (previous[k][0] + (target[k][0] - previous[k][0]) * t,
                               previous[k][1] + (target[k][1] - previous[k][1]) * t) for k in NAMES})
        frames.extend([target] * round(hold * fps))
        if steps == 0 and not hold:
            frames.append(target)
        previous = target
    return frames


def draw(points, background=(0, 0, 0), width=8):
    img = Image.new("RGB", (W, H), background)
    d = ImageDraw.Draw(img)
    px = {k: (x * W, y * H) for k, (x, y) in points.items()}
    for (a, b), color in zip(LIMBS, COLORS):
        d.line([px[a], px[b]], fill=color, width=width)
    for i, k in enumerate(NAMES):
        x, y = px[k]
        d.ellipse([x - 5, y - 5, x + 5, y + 5], fill=COLORS[i % len(COLORS)])
    return img


def wan_frame_count(n):
    """Wan needs 4k+1 frames: pad by holding the last pose."""
    return n + ((1 - n) % 4)


def build(name, fps=16):
    frames = timeline(EXERCISES[name](), fps)
    frames += [frames[-1]] * (wan_frame_count(len(frames)) - len(frames))
    return frames


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("exercise", choices=sorted(EXERCISES))
    parser.add_argument("--out", type=Path, required=True, help="preview GIF (white background)")
    parser.add_argument("--fps", type=int, default=16)
    args = parser.parse_args()
    frames = build(args.exercise, args.fps)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    preview = [draw(f, background=(255, 255, 255)).resize((640, 369)) for f in frames]
    preview[0].save(args.out, save_all=True, append_images=preview[1:], duration=round(1000 / args.fps), loop=0)
    print(f"{len(frames)} frames ({len(frames) / args.fps:.1f}s) -> {args.out}")


if __name__ == "__main__":
    main()
