"""Key poses for the exercises from the health plan, as OpenPose-style skeletons.

Coordinates are in body units: x relative to the figure's centre line, y measured down from the
nose, with nose->ankle = 1.0 (a real body is ~0.89 of its height from nose to ankle, so shoulders
sit at ~0.12, hips ~0.45, knees ~0.73). `place()` scales a figure into a frame and the same
skeleton image drives the ControlNet.

Each exercise is 2-4 poses (the same few key poses the catalog GIFs flip between).
"""

from pathlib import Path

from PIL import Image, ImageDraw

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
    lifted = with_(stand, **arms, r_kne=(-0.075, 0.64), r_ank=(-0.075, 0.86))
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

# extra words for the image prompt (props, expression), per exercise
PROMPT_EXTRA = {
    "Tandem stance": "standing with one foot directly in front of the other in a straight line, heel touching toes, ",
    "Heel-to-toe walking": "walking in a straight line placing one foot directly in front of the other, ",
    "Romberg stance": "standing still with the feet together and the eyes closed, ",
    "Single-leg stance": "balancing, ",
}


def to_pixels(pose, size, height_fraction=0.80):
    """Scale a pose (body units) into a frame of `size`, centred, nose->ankle = height_fraction."""
    w, h = size
    scale = h * height_fraction
    cx, top = w / 2, h * (1 - height_fraction) / 2 + h * 0.02
    return {name: (cx + x * scale, top + y * scale) for name, (x, y) in pose.items()}


def draw_openpose(pose, size=(1344, 768), background=(0, 0, 0), width=None):
    """The skeleton image a ControlNet OpenPose model expects (coloured limbs on black)."""
    w, h = size
    width = width or max(4, round(h / 120))
    img = Image.new("RGB", size, background)
    d = ImageDraw.Draw(img)
    px = to_pixels(pose, size)
    for (a, b), color in zip(LIMBS, COLORS):
        d.line([px[a], px[b]], fill=color, width=width)
    r = width * 0.9
    for i, name in enumerate(NAMES):
        x, y = px[name]
        d.ellipse([x - r, y - r, x + r, y + r], fill=COLORS[i % len(COLORS)])
    return img


if __name__ == "__main__":
    import sys
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("out/ai")
    out.mkdir(parents=True, exist_ok=True)
    for name, build in EXERCISES.items():
        for i, pose in enumerate(build(), 1):
            slug = name.lower().replace(" ", "-")
            draw_openpose(pose).save(out / f"{slug}-pose{i}.png")
            print("wrote", out / f"{slug}-pose{i}.png")
