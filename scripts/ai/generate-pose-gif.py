"""Pose-controlled exercise animation: exact movement from scripts/ai/pose.py, rendered by Wan 2.1 VACE.

The skeleton defines the movement (so the form is right); a frame from an existing bundled GIF is
the reference image (so outfit and look match the catalog). Runs locally on an 8 GB GPU.

Usage (AI venv, see scripts/ai/README.md):
    python scripts/ai/generate-pose-gif.py band-pull-apart "Band pull-apart" \
        "pulling a light resistance band apart at chest height" --out out/band-pull-apart.gif
"""

import argparse
import importlib.util
import sys
from pathlib import Path

import torch
from PIL import Image

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import pose  # noqa: E402

VACE = "Wan-AI/Wan2.1-VACE-1.3B-diffusers"
T2V = "Wan-AI/Wan2.1-T2V-1.3B-Diffusers"  # same text encoder; avoids a second 11 GB download
ASSETS = HERE.parent.parent / "assets" / "exercises"
REFERENCE = ASSETS / "117 Arm raises.gif"  # standing, front-on, plain white background

spec = importlib.util.spec_from_file_location("t2v", HERE / "generate-exercise-gif.py")
t2v = importlib.util.module_from_spec(spec)
spec.loader.exec_module(t2v)


def reference_image(path: Path) -> Image.Image:
    gif = Image.open(path)
    gif.seek(0)
    frame = gif.convert("RGB")
    canvas = Image.new("RGB", (pose.W, pose.H), (255, 255, 255))
    frame.thumbnail((pose.W, pose.H))
    canvas.paste(frame, ((pose.W - frame.width) // 2, (pose.H - frame.height) // 2))
    return canvas


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("exercise", choices=sorted(pose.EXERCISES))
    parser.add_argument("name")
    parser.add_argument("detail", help="extra words about props or the movement (e.g. the band)")
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--steps", type=int, default=30)
    parser.add_argument("--fps", type=int, default=16)
    parser.add_argument("--no-reference", action="store_true")
    args = parser.parse_args()

    from diffusers import AutoencoderKLWan, WanVACEPipeline
    from transformers import UMT5EncoderModel

    frames = pose.build(args.exercise, args.fps)
    control = [pose.draw(f) for f in frames]

    text_encoder = UMT5EncoderModel.from_pretrained(T2V, subfolder="text_encoder", torch_dtype=torch.bfloat16)
    vae = AutoencoderKLWan.from_pretrained(VACE, subfolder="vae", torch_dtype=torch.float32)
    pipe = WanVACEPipeline.from_pretrained(VACE, vae=vae, text_encoder=text_encoder, torch_dtype=torch.bfloat16)
    pipe.enable_model_cpu_offload()

    prompt = f"{t2v.STYLE}She performs the exercise '{args.name}', {args.detail}."
    result = pipe(
        prompt=prompt,
        negative_prompt=t2v.NEGATIVE,
        video=control,
        reference_images=None if args.no_reference else [reference_image(REFERENCE)],
        height=pose.H,
        width=pose.W,
        num_frames=len(control),
        num_inference_steps=args.steps,
        guidance_scale=5.0,
        generator=torch.Generator("cpu").manual_seed(args.seed),
    )
    out_frames = result.frames[0]
    t2v.to_gif(out_frames, args.out, args.fps)
    from diffusers.utils import export_to_video

    export_to_video(out_frames, str(args.out.with_suffix(".mp4")), fps=args.fps)
    print(f"wrote {args.out} and {args.out.with_suffix('.mp4')}")


if __name__ == "__main__":
    main()
