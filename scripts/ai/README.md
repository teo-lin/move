# Exercise pictures (AI-assisted)

The own exercise animations (ids 121+) are 2-4 still poses turned into a catalog-style GIF
(640x360, white background, ~670 ms per pose). Nothing here needs a GPU.

Local diffusion models (video and SDXL + ControlNet) were tried and dropped: the output was not
accurate enough for the exercises, and sustained GPU load crashed the laptop.

## Workflow (Gemini in a browser)

1. Upload one frame of a bundled GIF (the woman in the black outfit) as the reference, plus -- when
   the pose is hard to describe -- a stick-figure pose guide made with `plan_poses.py`
   (`stick figure` drawing, see `standing_front()` / `with_()` there).
2. Ask for each pose of the exercise in the same chat ("same woman, same framing, size and
   position, pure white background, 16:9") so the figure stays consistent.
3. Download each picture with Gemini's own Download button (it cannot be automated).
4. Build the GIF and refresh the catalog:

```powershell
$py = "$HOME\.venvs\move-ai\Scripts\python"   # any Python with Pillow + numpy
& $py scripts\ai\stills-to-gif.py pose-a.jpg pose-b.jpg --out "assets\exercises\<id> <Name>.gif" --white 232
npm run generate:exercises
```

`stills-to-gif.py` crops every frame identically (so the figure does not jump), flattens the
off-white background to pure white, and sizes the result like the bundled GIFs.

Exercises named in the plan but not yet animated live in `src/data/extraExercises.ts` and show a
placeholder until a GIF with their id exists.
