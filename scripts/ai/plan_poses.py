"""Key poses for the plan exercises as simple skeletons, drawn as stick figures to guide Gemini.

Coordinates are in body units: x relative to the figure's centre line, y measured down from the
nose, with nose->ankle = 1.0 (a real body is ~0.89 of its height from nose to ankle, so shoulders
sit at ~0.12, hips ~0.45, knees ~0.73). `draw_stick()` renders a pose as a black stick figure on
white, to upload next to the reference woman (see README.md in this folder).

Run `python scripts/ai/plan_poses.py out/ai` to write a PNG per pose.
"""

from pathlib import Path

from PIL import Image, ImageDraw

NAMES = ["nose", "neck", "r_sho", "r_elb", "r_wri", "l_sho", "l_elb", "l_wri", "r_hip", "r_kne", "r_ank",
         "l_hip", "l_kne", "l_ank", "r_eye", "l_eye", "r_ear", "l_ear"]
LIMBS = [("neck", "r_sho"), ("neck", "l_sho"), ("r_sho", "r_elb"), ("r_elb", "r_wri"), ("l_sho", "l_elb"),
         ("l_elb", "l_wri"), ("neck", "r_hip"), ("r_hip", "r_kne"), ("r_kne", "r_ank"), ("neck", "l_hip"),
         ("l_hip", "l_kne"), ("l_kne", "l_ank"), ("neck", "nose"), ("nose", "r_eye"), ("r_eye", "r_ear"),
         ("nose", "l_eye"), ("l_eye", "l_ear")]

def standing_front():
    """Neutral standing pose, facing the camera. r_* is the figure's right = image-left."""
    return {
        "nose": (0.0, 0.0), "neck": (0.0, 0.075),
        "r_eye": (-0.012, -0.012), "l_eye": (0.012, -0.012), "r_ear": (-0.03, -0.004), "l_ear": (0.03, -0.004),
        "r_sho": (-0.12, 0.09), "l_sho": (0.12, 0.09),
        "r_elb": (-0.135, 0.30), "l_elb": (0.135, 0.30), "r_wri": (-0.14, 0.50), "l_wri": (0.14, 0.50),
        "r_hip": (-0.065, 0.45), "l_hip": (0.065, 0.45),
        "r_kne": (-0.07, 0.73), "l_kne": (0.07, 0.73), "r_ank": (-0.075, 1.0), "l_ank": (0.075, 1.0),
    }


def with_(base, **changes):
    pose = dict(base)
    pose.update(changes)
    return pose


def single_leg_stance():
    stand = standing_front()
    # arms a little out for balance, the right foot lifted a few centimetres (knee up in front)
    arms = dict(r_elb=(-0.20, 0.27), l_elb=(0.20, 0.27), r_wri=(-0.29, 0.40), l_wri=(0.29, 0.40))
    start = with_(stand, **arms)
    lifted = with_(stand, **arms, r_kne=(-0.13, 0.58), r_ank=(-0.10, 0.80))
    return [start, lifted]


ARMS_OUT = dict(r_elb=(-0.20, 0.27), l_elb=(0.20, 0.27), r_wri=(-0.29, 0.40), l_wri=(0.29, 0.40))


def tandem_stance():
    """Feet in one line, heel to toe, seen from the front: the front foot is lower in the image."""
    stand = with_(standing_front(), **ARMS_OUT)
    narrow = dict(r_hip=(-0.04, 0.45), l_hip=(0.04, 0.45), r_kne=(-0.035, 0.73), l_kne=(0.035, 0.73))
    right_front = with_(stand, **narrow, r_ank=(-0.02, 1.0), l_ank=(0.02, 0.965))
    left_front = with_(stand, **narrow, r_ank=(-0.02, 0.965), l_ank=(0.02, 1.0))
    return [right_front, left_front]


def heel_to_toe_walking():
    """Walking toward the camera on a line: alternate which foot is in front (lower in the image)."""
    stand = with_(standing_front(), **ARMS_OUT)
    step = dict(r_hip=(-0.04, 0.45), l_hip=(0.04, 0.45))
    right_front = with_(stand, **step, r_kne=(-0.04, 0.74), l_kne=(0.04, 0.70), r_ank=(-0.02, 1.0), l_ank=(0.02, 0.93))
    left_front = with_(stand, **step, r_kne=(-0.04, 0.70), l_kne=(0.04, 0.74), r_ank=(-0.02, 0.93), l_ank=(0.02, 1.0))
    return [right_front, left_front]


def romberg_stance():
    """Feet together, arms by the sides (eyes closed comes from the prompt); a static hold."""
    together = with_(
        standing_front(),
        r_hip=(-0.045, 0.45), l_hip=(0.045, 0.45), r_kne=(-0.04, 0.73), l_kne=(0.04, 0.73),
        r_ank=(-0.035, 1.0), l_ank=(0.035, 1.0),
        r_elb=(-0.13, 0.30), l_elb=(0.13, 0.30), r_wri=(-0.12, 0.50), l_wri=(0.12, 0.50),
    )
    return [together]


# exercise name -> builder returning its key poses
EXERCISES = {
    "Single-leg stance": single_leg_stance,
    "Tandem stance": tandem_stance,
    "Heel-to-toe walking": heel_to_toe_walking,
    "Romberg stance": romberg_stance,
}



def to_pixels(pose, size, height_fraction=0.80):
    """Scale a pose (body units) into a frame of `size`, centred, nose->ankle = height_fraction."""
    w, h = size
    scale = h * height_fraction
    cx, top = w / 2, h * (1 - height_fraction) / 2 + h * 0.02
    return {name: (cx + x * scale, top + y * scale) for name, (x, y) in pose.items()}


def draw_stick(pose, size=(1280, 720), width=8):
    """Black stick figure (head circle, torso, limbs) on white."""
    w, h = size
    img = Image.new("RGB", size, "white")
    d = ImageDraw.Draw(img)
    px = to_pixels(pose, size, 0.78)
    face = ("nose", "r_eye", "l_eye", "r_ear", "l_ear")
    for a, b in LIMBS:
        if a in face or b in face:
            continue
        d.line([px[a], px[b]], fill="black", width=width)
    x, y = px["nose"]
    r = h * 0.045
    d.ellipse([x - r, y - r * 0.9, x + r, y + r * 1.1], outline="black", width=width)
    d.line([px["neck"], (x, y + r * 1.1)], fill="black", width=width)
    return img


if __name__ == "__main__":
    import sys

    out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("out/ai")
    out.mkdir(parents=True, exist_ok=True)
    for name, build in EXERCISES.items():
        for i, pose in enumerate(build(), 1):
            slug = name.lower().replace(" ", "-")
            draw_stick(pose).save(out / f"{slug}-pose{i}.png")
            print("wrote", out / f"{slug}-pose{i}.png")
