#!/usr/bin/env python3
"""Render the Culpo clone's original loop locally, with no network/API use."""

from __future__ import annotations

import argparse
import math
import subprocess
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfiltfilt


RATE = 48_000
BPM = 116
BEAT = 60 / BPM
BARS = 16
DURATION = BARS * 4 * BEAT
ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public/audio/culpo-loop.ogg"
CHORDS = [
    ("Dm", [146.83, 174.61, 220.00, 293.66]),
    ("Dm", [146.83, 174.61, 220.00, 293.66]),
    ("Bb", [116.54, 146.83, 174.61, 233.08]),
    ("A7", [110.00, 138.59, 164.81, 220.00]),
    ("Dm", [146.83, 174.61, 220.00, 293.66]),
    ("C", [130.81, 164.81, 196.00, 261.63]),
    ("Bb", [116.54, 146.83, 174.61, 233.08]),
    ("A7", [110.00, 138.59, 164.81, 220.00]),
    ("Dm", [146.83, 174.61, 220.00, 293.66]),
    ("Bb", [116.54, 146.83, 174.61, 233.08]),
    ("F", [130.81, 164.81, 196.00, 261.63]),
    ("A7", [110.00, 138.59, 164.81, 220.00]),
    ("Dm", [146.83, 174.61, 220.00, 293.66]),
    ("C", [130.81, 164.81, 196.00, 261.63]),
    ("Gm", [130.81, 155.56, 196.00, 261.63]),
    ("A7", [110.00, 138.59, 164.81, 220.00]),
]


def band_energy(audio: np.ndarray) -> list[float]:
    """Integrated stereo power in the reference-comparison bands."""
    sections = [butter(4, edge, btype="bandpass", fs=RATE, output="sos")
                for edge in ((20, 120), (120, 800), (800, 4_000), (4_000, 10_000))]
    powers = [float(np.mean(sosfiltfilt(sos, audio, axis=0) ** 2)) for sos in sections]
    total = sum(powers)
    return [100 * p / total for p in powers]


def render() -> np.ndarray:
    count = round(DURATION * RATE)
    mix = np.zeros((count, 2), dtype=np.float64)
    rng = np.random.default_rng(20161002)

    def add(start: float, signal: np.ndarray, pan: float = 0.0) -> None:
        offset = round(start * RATE)
        if offset >= count or offset < 0:
            return
        length = min(len(signal), count - offset)
        # Equal-power placement keeps mono-compatible center instruments full.
        left = math.sqrt((1 - pan) * 0.5) * math.sqrt(2)
        right = math.sqrt((1 + pan) * 0.5) * math.sqrt(2)
        mix[offset:offset + length, 0] += signal[:length] * left
        mix[offset:offset + length, 1] += signal[:length] * right

    def note(start: float, freq: float, dur: float, amp: float, *, kind: str,
             pan: float = 0.0) -> None:
        n = max(1, min(round(dur * RATE), count - round(start * RATE)))
        if n <= 0:
            return
        t = np.arange(n) / RATE
        if kind == "pad":
            attack = min(0.16, dur * 0.2)
            release = min(0.26, dur * 0.27)
            env = np.minimum(1, t / max(attack, 1e-3))
            env *= np.minimum(1, np.maximum(0, (dur - t) / max(release, 1e-3)))
            slow = 1 + 0.018 * np.sin(2 * np.pi * 4.1 * t)
            tone = (np.sin(2 * np.pi * freq * t)
                    + 0.23 * np.sin(2 * np.pi * 2 * freq * t + 0.12)
                    + 0.07 * np.sin(2 * np.pi * 3 * freq * t + 0.31))
            signal = amp * env * slow * tone
        elif kind == "bass":
            env = np.exp(-t * (5.4 if dur < 0.6 else 2.8))
            signal = amp * env * (np.sin(2 * np.pi * freq * t)
                                  + 0.12 * np.sin(2 * np.pi * 2 * freq * t))
        else:  # bright, rounded pluck with audible chord partials
            attack = np.minimum(1, t / 0.003)
            env = attack * (0.76 * np.exp(-t * 7.2) + 0.24 * np.exp(-t * 2.5))
            phase = 2 * np.pi * freq * t
            signal = amp * env * (
                0.63 * np.sin(phase)
                + 0.39 * np.sin(2 * phase + 0.14)
                + 0.24 * np.sin(3 * phase + 0.27)
                + 0.12 * np.sin(4 * phase + 0.39)
            )
        add(start, signal, pan)

    # Low bed is deliberately restrained: harmonic movement now carries the cue.
    whole_t = np.arange(count) / RATE
    fade_in = np.minimum(1, whole_t / 1.05)
    for f, a, phase in ((36.71, 0.0018, 0.0), (73.42, 0.0057, 0.2), (110.00, 0.0034, 0.4)):
        mix[:, 0] += a * fade_in * np.sin(2 * np.pi * f * whole_t + phase)
        mix[:, 1] += a * fade_in * np.sin(2 * np.pi * f * whole_t + phase + 0.04)

    # Bowed chord bed in compact mid-register voicings, with a gentle swell.
    for bar, (_, tones) in enumerate(CHORDS):
        start = bar * 4 * BEAT
        for i, freq in enumerate(tones):
            note(start, freq, 4 * BEAT, 0.0165 if i < 3 else 0.0115,
                 kind="pad", pan=(-0.17 if i % 2 == 0 else 0.17))

    # A short eighth-note ostinato supplies pulse and puts the pluck harmonics
    # where the reference's busy gameplay bed has most of its energy.
    degrees = (0, 2, 3, 1, 2, 3, 1, 2)
    for bar, (_, tones) in enumerate(CHORDS):
        start = bar * 4 * BEAT
        for step, degree in enumerate(degrees):
            # Lift alternate notes to keep the motif in the upper midrange.
            # Keep the motif out of the old low-mid-only register.
            freq = tones[degree] * 2 * (2 if step in (3, 7) else 1)
            accent = (1.16 if step in (0, 4) else 0.86)
            note(start + step * BEAT / 2, freq, 0.39 * BEAT,
                 0.105 * accent, kind="pluck", pan=(-0.21 if step % 2 == 0 else 0.21))

    # A lighter answer line adds motion without becoming a lead melody copy.
    answer = (2, 1, 3, 2, 1, 3, 2, 0)
    for bar, (_, tones) in enumerate(CHORDS):
        start = bar * 4 * BEAT
        for step in (1, 3, 5, 7):
            freq = tones[answer[step]] * 4
            note(start + step * BEAT / 2, freq, 0.27 * BEAT, 0.042,
                 kind="pluck", pan=(0.32 if step in (1, 5) else -0.32))

    # A gentle bass pulse stays above the old sustained sub drone.
    for bar, (_, tones) in enumerate(CHORDS):
        start = bar * 4 * BEAT
        bass = tones[0] / 2
        for beat in (0, 2):
            note(start + beat * BEAT, bass, 0.74 * BEAT, 0.036,
                 kind="bass", pan=0)
            note(start + (beat + 1) * BEAT, tones[2] / 2, 0.38 * BEAT,
                 0.014, kind="bass", pan=0)

    # Compact low kick, mid snare, and quiet filtered hats keep the groove crisp.
    for beat_index in range(BARS * 4):
        start = beat_index * BEAT
        if beat_index % 4 in (0, 2):
            n = round(0.22 * RATE)
            t = np.arange(n) / RATE
            phase = 2 * np.pi * (43 * t + 72 * (1 - np.exp(-t * 19)) / 19)
            env = np.exp(-t * 19)
            kick = 0.190 * env * np.sin(phase)
            # A very quiet click gives the attack definition without extra bass.
            click = 0.013 * np.exp(-t * 115) * rng.standard_normal(n)
            add(start, kick + click)
        elif beat_index % 4 in (1, 3):
            n = round(0.115 * RATE)
            t = np.arange(n) / RATE
            raw = rng.standard_normal(n)
            hp = butter(2, 720, btype="highpass", fs=RATE, output="sos")
            body = sosfiltfilt(hp, raw)
            env = np.exp(-t * 36)
            snare = 0.041 * env * body / max(np.max(np.abs(body)), 1e-5)
            # Tuned mid component reads like a soft frame drum, not a clap.
            snare += 0.012 * env * np.sin(2 * np.pi * 185 * t)
            add(start, snare, pan=(0.07 if beat_index % 4 == 1 else -0.07))

        # Every second eighth carries a soft woody tick, no wideband wash.
        if beat_index % 2 == 1:
            n = round(0.040 * RATE)
            t = np.arange(n) / RATE
            tick = np.exp(-t * 105) * (
                0.012 * np.sin(2 * np.pi * 3_300 * t) + 0.100 * np.sin(2 * np.pi * 5_100 * t)
            )
            add(start, tick, pan=(-0.28 if beat_index % 4 == 1 else 0.28))

    # Small cross-channel room reflections. They remain deterministic and the
    # last phrase is allowed to ring through the exact loop boundary.
    dry = mix.copy()
    for delay, level, side in ((0.086, 0.105, 1), (0.149, 0.067, 0), (0.231, 0.038, 1)):
        shift = round(delay * RATE)
        if side:
            mix[shift:, 0] += dry[:-shift, 1] * level
            mix[shift:, 1] += dry[:-shift, 0] * level
        else:
            mix[shift:] += dry[:-shift] * level

    # Low-energy handoff at the end prevents a click; Dm/A7 loop harmony resolves.
    fade_n = round(0.015 * RATE)
    mix[-fade_n:] *= np.linspace(1, 0, fade_n, endpoint=True)[:, None]
    return mix.astype(np.float32)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--reference", type=Path, help="optional stereo/mono WAV for band comparison")
    parser.add_argument("--reference-start", type=float, default=25.0)
    parser.add_argument("--reference-end", type=float, default=27.0)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args()

    audio = render()
    # Make the render's level intentional while leaving lossy-codec headroom.
    audio *= 0.82 / float(np.max(np.abs(audio)))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="culpo-audio-") as render_dir:
        wav_path = Path(render_dir) / "culpo-loop.wav"
        sf.write(wav_path, audio, RATE, subtype="PCM_24")
        subprocess.run([
            "ffmpeg", "-y", "-v", "error", "-i", str(wav_path),
            "-c:a", "vorbis", "-strict", "-2", "-q:a", "6", "-ar", str(RATE),
            "-ac", "2", str(args.output),
        ], check=True)
    encoded, rate = sf.read(args.output, always_2d=True, dtype="float32")
    if rate != RATE:
        raise RuntimeError(f"Unexpected encoded sample rate {rate}")
    rms = float(np.sqrt(np.mean(encoded ** 2)))
    peak = float(np.max(np.abs(encoded)))
    bands = band_energy(encoded)
    print(f"loop: {args.output} ({len(encoded) / rate:.3f}s, stereo {rate} Hz)")
    print("decoded band power 20-120 / 120-800 / 800-4000 / 4000-10000 Hz: "
          + " / ".join(f"{x:.2f}%" for x in bands))
    print(f"decoded RMS {20 * math.log10(rms):.2f} dBFS, peak {20 * math.log10(peak):.2f} dBFS")
    if args.reference:
        ref, ref_rate = sf.read(args.reference, always_2d=True, dtype="float32")
        if ref_rate != RATE:
            raise ValueError(f"Reference must be {RATE} Hz; got {ref_rate}")
        begin = round(args.reference_start * RATE)
        finish = round(args.reference_end * RATE)
        print(f"reference {args.reference_start:.2f}-{args.reference_end:.2f}s bands: "
              + " / ".join(f"{x:.2f}%" for x in band_energy(ref[begin:finish])))


if __name__ == "__main__":
    main()
