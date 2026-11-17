"""Generate the runner's percussion cues as WAV files (original synthesis, no samples).

    countdown       -> soft tom taps, slowly speeding up over 5 s  res/raw/cue_countdown.wav
    repetition      -> one soft castanet click                      res/raw/cue_rep.wav
    exercise done   -> one pure rising cuica "whoop"               res/raw/cue_finish.wav
    rest finished   -> one pure falling cuica "hoo"                res/raw/cue_rest.wav

Usage (from the repo root):
    python scripts/make-cue-sounds.py [--preview path/to/preview.wav]

--preview also writes a short demo sequence (countdown roll, reps, finish, rest end) for listening.
"""

import argparse
import math
import wave
from pathlib import Path

import numpy as np

RATE = 44100
OUT = Path(__file__).resolve().parent.parent / "android" / "app" / "src" / "main" / "res" / "raw"
rng = np.random.default_rng(7)  # deterministic output


def t_axis(seconds):
    return np.arange(int(RATE * seconds)) / RATE


def bandpass(x, f0, q):
    """RBJ biquad band-pass (constant 0 dB peak gain)."""
    w0 = 2 * math.pi * f0 / RATE
    alpha = math.sin(w0) / (2 * q)
    b0, b1, b2 = alpha, 0.0, -alpha
    a0, a1, a2 = 1 + alpha, -2 * math.cos(w0), 1 - alpha
    b0, b1, b2, a1, a2 = b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0
    y = np.zeros_like(x)
    x1 = x2 = y1 = y2 = 0.0
    for i, xi in enumerate(x):
        yi = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
        x2, x1, y2, y1 = x1, xi, y1, yi
        y[i] = yi
    return y


def place(buffer, sound, at_seconds, gain=1.0):
    start = int(at_seconds * RATE)
    end = min(len(buffer), start + len(sound))
    buffer[start:end] += sound[: end - start] * gain


def normalize(x, peak):
    m = np.max(np.abs(x))
    return x if m == 0 else x * (peak / m)


def fade_edges(x, ms=4):
    n = int(RATE * ms / 1000)
    x = x.copy()
    x[:n] *= np.linspace(0, 1, n)
    x[-n:] *= np.linspace(1, 0, n)
    return x


def tom_tap():
    """Fingertip on a low tom: a rounded, muffled thump with a hint of skin, no snare wires."""
    t = t_axis(0.16)
    pitch = 150 * (1 + 0.15 * np.exp(-t / 0.02))  # slight pitch drop like a real drum head
    phase = 2 * math.pi * np.cumsum(pitch) / RATE
    body = np.sin(phase) * np.exp(-t / 0.06)
    skin = bandpass(rng.normal(0, 1, len(t)), 900, 1.2) * np.exp(-t / 0.012) * 0.25
    return body + skin


def drum_roll(seconds=5.0):
    """Gentle taps ~0.7 s apart that slowly speed up to ~0.18 s, swelling only slightly toward "Go"."""
    out = np.zeros(int(RATE * seconds))
    t = 0.0
    end = seconds - 0.16
    while t < end:
        progress = t / end
        place(out, tom_tap(), t, 0.55 + 0.45 * progress)
        t += max(0.18, 0.7 * math.exp(-0.32 * t))
    return out


def castanet_click():
    """Hardwood shells clapping: a tiny noise snap exciting a few short wooden resonances."""
    t = t_axis(0.05)
    body = (
        1.00 * np.exp(-t / 0.0060) * np.sin(2 * math.pi * 2150 * t)
        + 0.65 * np.exp(-t / 0.0045) * np.sin(2 * math.pi * 3320 * t + 0.6)
        + 0.35 * np.exp(-t / 0.0030) * np.sin(2 * math.pi * 4870 * t + 1.1)
    )
    snap = bandpass(rng.normal(0, 1, len(t)), 3800, 0.9) * np.exp(-t / 0.0015)
    return body + 0.8 * snap


def castanets(hits, spacing):
    out = np.zeros(int(RATE * (spacing * len(hits) + 0.06)))
    for i, gain in enumerate(hits):
        place(out, castanet_click(), i * spacing, gain)
    return out


def cuica(f_start, f_end, seconds, glide):
    """Friction-drum voice: a gliding tone with throaty harmonics, slight vibrato and rub noise."""
    t = t_axis(seconds)
    shape = np.minimum(1, t / glide)
    freq = f_start * (f_end / f_start) ** (shape * (2 - shape))  # ease-out glide
    phase = 2 * math.pi * np.cumsum(freq) / RATE
    tone = np.sin(phase) + 0.2 * np.sin(2 * phase)
    # Dry: no resonant noise layer (it rang like an echo) and a quick, clean release.
    envelope = np.minimum(1, t / 0.02) * np.minimum(1, (seconds - t) / 0.05)
    return tone * envelope


def build():
    countdown = normalize(fade_edges(drum_roll()), 0.32)
    rep = normalize(fade_edges(castanets([1.0], 0.0)), 0.42)
    finish = normalize(fade_edges(cuica(330, 660, 0.24, 0.16)), 0.42)
    rest = normalize(fade_edges(cuica(520, 300, 0.26, 0.2)), 0.34)
    return {"cue_countdown": countdown, "cue_rep": rep, "cue_finish": finish, "cue_rest": rest}


def write_wav(path, samples):
    data = (np.clip(samples, -1, 1) * 32767).astype("<i2").tobytes()
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(RATE)
        handle.writeframes(data)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--preview", type=Path, help="also write a demo sequence WAV here")
    args = parser.parse_args()

    sounds = build()
    OUT.mkdir(parents=True, exist_ok=True)
    for name, samples in sounds.items():
        write_wav(OUT / f"{name}.wav", samples)
        print(f"wrote {OUT / (name + '.wav')} ({len(samples) / RATE:.2f}s)")

    if args.preview:
        demo = np.zeros(int(RATE * 16))
        place(demo, sounds["cue_countdown"], 0.2)
        for i in range(1, 4):  # three reps at 2 s
            place(demo, sounds["cue_rep"], 5.8 + 2 * i)
        place(demo, sounds["cue_finish"], 13.8)
        place(demo, sounds["cue_rest"], 15.0)
        write_wav(args.preview, demo)
        print(f"wrote preview {args.preview}")


if __name__ == "__main__":
    main()
