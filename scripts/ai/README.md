# AI exercise animations (local)

Generates new exercise GIFs on this PC's GPU with the open **Wan 2.1 T2V 1.3B** text-to-video model
(Apache 2.0). Nothing is sent to a server; the model downloads once (~17 GB) into the Hugging Face cache.

## One-time setup (Windows, RTX 50-series → CUDA 12.8 build of PyTorch)

```powershell
py -3.12 -m venv $HOME\.venvs\move-ai
$HOME\.venvs\move-ai\Scripts\python -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cu128
$HOME\.venvs\move-ai\Scripts\python -m pip install "diffusers>=0.33" transformers accelerate ftfy sentencepiece imageio imageio-ffmpeg pillow numpy
```

## Generate

```powershell
$HOME\.venvs\move-ai\Scripts\python scripts\ai\generate-exercise-gif.py "Band pull-apart" `
  "holding a resistance band in both hands at chest height with straight arms, she pulls the band apart sideways until it touches her chest, then slowly returns" `
  --out out\band-pull-apart.gif --seed 7
```

Review the GIF/MP4. If it is good, copy it to `assets/exercises/<next id> <Name>.gif`,
run `npm run generate:exercises`, and add it to a workout. Try other `--seed` values for variants.

## Pose-controlled (recommended: the movement is exactly right)

Text alone leaves the movement to the model. Instead, define it as key poses in `scripts/ai/pose.py`
(OpenPose-style skeleton, eased between poses), check the skeleton preview, then let **Wan 2.1 VACE 1.3B**
render a person following it. A frame of a bundled GIF is the reference, so the outfit and look match.

```powershell
$py = "$HOME\.venvs\move-ai\Scripts\python"
& $py scripts\ai\pose.py band-pull-apart --out out\band-pull-apart-pose.gif        # check the form
& $py scripts\ai\generate-pose-gif.py band-pull-apart "Band pull-apart" `
  "pulling a light resistance band apart at chest height" --out out\band-pull-apart.gif
```

VACE shares the text encoder with the T2V model, so it only adds ~7 GB of weights.
