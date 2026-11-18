"""Generate exercise key-pose stills locally: SDXL + an OpenPose ControlNet, on the GPU.

The skeleton (scripts/ai/plan_poses.py) fixes the movement exactly; the model paints the person
(black fitted top, black capri leggings, white studio background) around it. The same seed and
prompt for every pose keep the figure consistent between the stills.

Usage (AI venv):
    python scripts/ai/sdxl_pose.py "Single-leg stance" --out out/ai [--seed 7] [--steps 30]
Then:
    python scripts/ai/stills-to-gif.py out/ai/single-leg-stance-1.png out/ai/single-leg-stance-2.png \
        --out "assets/exercises/124 Single-leg stance.gif"
"""

import argparse
import sys
from pathlib import Path

import torch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import plan_poses  # noqa: E402

BASE = "stabilityai/stable-diffusion-xl-base-1.0"
VAE = "madebyollin/sdxl-vae-fp16-fix"
CONTROLNET = "xinsir/controlnet-openpose-sdxl-1.0"

PROMPT = (
    "full body photo of a slim young woman with a dark brown ponytail, wearing a fitted black "
    "short-sleeve t-shirt and black capri leggings, barefoot, {extra}centered, on a seamless pure "
    "white studio background, soft even studio lighting, fitness instruction photograph, sharp, "
    "natural skin, high detail"
)
NEGATIVE = (
    "text, watermark, logo, extra limbs, extra fingers, deformed hands, distorted anatomy, cropped, "
    "blurry, colorful background, floor shadow, furniture, multiple people, cartoon, illustration"
)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("exercise", choices=sorted(plan_poses.EXERCISES))
    parser.add_argument("--out", type=Path, default=Path("out/ai"))
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--steps", type=int, default=30)
    parser.add_argument("--control", type=float, default=1.0, help="ControlNet strength")
    parser.add_argument("--extra", default="", help="extra words for the prompt, e.g. 'holding a green resistance band, '")
    parser.add_argument("--size", default="1344x768")
    args = parser.parse_args()
    width, height = (int(v) for v in args.size.split("x"))

    from diffusers import AutoencoderKL, ControlNetModel, StableDiffusionXLControlNetPipeline

    controlnet = ControlNetModel.from_pretrained(CONTROLNET, torch_dtype=torch.float16)
    vae = AutoencoderKL.from_pretrained(VAE, torch_dtype=torch.float16)
    pipe = StableDiffusionXLControlNetPipeline.from_pretrained(
        BASE, controlnet=controlnet, vae=vae, torch_dtype=torch.float16, variant="fp16", use_safetensors=True
    )
    pipe.enable_model_cpu_offload()  # 8 GB GPU
    pipe.vae.enable_tiling()

    args.out.mkdir(parents=True, exist_ok=True)
    slug = args.exercise.lower().replace(" ", "-")
    for i, pose in enumerate(plan_poses.EXERCISES[args.exercise](), 1):
        control = plan_poses.draw_openpose(pose, (width, height))
        control.save(args.out / f"{slug}-skeleton{i}.png")
        image = pipe(
            prompt=PROMPT.format(extra=args.extra or plan_poses.PROMPT_EXTRA.get(args.exercise, "")),
            negative_prompt=NEGATIVE,
            image=control,
            controlnet_conditioning_scale=args.control,
            num_inference_steps=args.steps,
            guidance_scale=6.0,
            width=width,
            height=height,
            generator=torch.Generator("cpu").manual_seed(args.seed),
        ).images[0]
        path = args.out / f"{slug}-{i}.png"
        image.save(path)
        print("wrote", path, flush=True)


if __name__ == "__main__":
    main()
