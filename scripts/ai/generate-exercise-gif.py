"""Generate an exercise animation locally with an open text-to-video model (Wan 2.1 T2V 1.3B).

Runs fully offline after the first model download (~17 GB, cached by Hugging Face). Fits an 8 GB
GPU via CPU offload. Output matches the bundled exercise GIFs: 640x360, white background, loop.

Usage (with the AI venv, see scripts/ai/README.md):
    python scripts/ai/generate-exercise-gif.py "Band pull-apart" \
        "holding a resistance band in both hands at chest height with straight arms, she pulls the band apart sideways until it touches her chest, then slowly returns" \
        --out out/band-pull-apart.gif [--seed 7] [--frames 49] [--steps 30]
"""

import argparse
from pathlib import Path

import numpy as np
import torch
from PIL import Image

MODEL = "Wan-AI/Wan2.1-T2V-1.3B-Diffusers"

# Matches the look of the bundled GIFs (same performer style, white studio, full body).
STYLE = (
    "A slim young woman with dark brown hair in a low ponytail, wearing a fitted black short-sleeve "
    "t-shirt and black capri leggings, barefoot, on a seamless pure white studio background. "
    "Full body visible, centered, static camera, side-front view, soft even studio lighting, "
    "smooth slow controlled exercise movement, fitness instruction video. "
)
NEGATIVE = (
    "blurry, low quality, distorted body, extra limbs, extra fingers, deformed hands, cropped body, "
    "camera motion, zoom, text, watermark, logo, colorful background, furniture, multiple people"
)


def to_gif(frames, out: Path, fps: int, size=(640, 360)):
    """Fit each frame onto a white 640x360 canvas and save a looping GIF."""
    images = []
    for frame in frames:
        arr = np.asarray(frame)
        if arr.dtype != np.uint8:  # diffusers returns floats in [0, 1]
            arr = (arr.clip(0, 1) * 255).astype(np.uint8)
        img = Image.fromarray(arr).convert("RGB")
        img.thumbnail(size, Image.LANCZOS)
        canvas = Image.new("RGB", size, (255, 255, 255))
        canvas.paste(img, ((size[0] - img.width) // 2, (size[1] - img.height) // 2))
        images.append(canvas.convert("P", palette=Image.ADAPTIVE, colors=128))
    out.parent.mkdir(parents=True, exist_ok=True)
    images[0].save(out, save_all=True, append_images=images[1:], duration=round(1000 / fps), loop=0, optimize=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("name")
    parser.add_argument("movement", help="what the performer does, in plain words")
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--frames", type=int, default=49, help="4k+1; 49 frames = ~3 s at 16 fps")
    parser.add_argument("--steps", type=int, default=30)
    parser.add_argument("--fps", type=int, default=16)
    args = parser.parse_args()

    from diffusers import AutoencoderKLWan, WanPipeline

    vae = AutoencoderKLWan.from_pretrained(MODEL, subfolder="vae", torch_dtype=torch.float32)
    pipe = WanPipeline.from_pretrained(MODEL, vae=vae, torch_dtype=torch.bfloat16)
    pipe.enable_model_cpu_offload()  # 8 GB GPU: keep only the active part on the GPU

    prompt = f"{STYLE}She performs the exercise '{args.name}': {args.movement}."
    result = pipe(
        prompt=prompt,
        negative_prompt=NEGATIVE,
        height=480,
        width=832,
        num_frames=args.frames,
        num_inference_steps=args.steps,
        guidance_scale=5.0,
        generator=torch.Generator("cpu").manual_seed(args.seed),
    )
    frames = result.frames[0]
    to_gif(frames, args.out, args.fps)
    # Also keep an MP4 for easy review on a PC.
    from diffusers.utils import export_to_video

    export_to_video(frames, str(args.out.with_suffix(".mp4")), fps=args.fps)
    print(f"wrote {args.out} and {args.out.with_suffix('.mp4')}")


if __name__ == "__main__":
    main()
