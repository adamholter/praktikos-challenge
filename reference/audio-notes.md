# Audio notes

## Reference read

Source: `/Users/adam/.t3/userdata/attachments/f2b84232-86ed-4dd0-b074-7ca83f7fb6ee-34030a39-f09a-445e-a2ca-3fd54bd2a0c9-mp4.mp4`. The audio stream is 53.01 seconds, stereo AAC at 48 kHz. I extracted it locally to inspect short-time RMS, band energy, chroma, beat estimates, and an FFmpeg log-frequency spectrogram. No source music or sound-effect snippets are included in the clone.

The clip builds quietly for about five seconds, then holds a denser body until a short drop near 51 seconds. The game soundtrack has a steady pulse near 117 BPM, with half-time readings also present. Chroma analysis favors D minor, though impacts and the short clip make both tempo and key approximate. The 25–27 second gold-synergy window has stereo band-power shares of 28.5% at 20–120 Hz, 59.2% at 120–800 Hz, 10.9% at 800–4,000 Hz, and 1.3% at 4,000–10,000 Hz. That window is fuller in the mids than the first loop draft. Impacts around 12–17 seconds are much broader and louder than the steady music bed; the 16 second blast has a low rumble with a sharp high-frequency onset.

## Original loop

`public/audio/culpo-loop.ogg` is a locally synthesized, 16-bar original cue. It runs at 116 BPM in 4/4 for 33.10 seconds and moves through:

```text
Dm – Dm – Bb – A7 | Dm – C – Bb – A7
Dm – Bb – F – A7  | Dm – C – Gm – A7
```

The arrangement uses a restrained D/A bass pulse, mid-register bowed-synth chord tones, a repeating bright pluck ostinato, and compact drum hits. A7 resolves into D minor at the loop point. The deterministic local renderer is `reference/audio-composer.py`; it uses NumPy, SciPy, SoundFile, and FFmpeg without network calls or paid services. The 48 kHz stereo Vorbis decode measures -1.75 dBFS peak and -20.31 dBFS RMS. Its band-power shares are 25.15%, 59.12%, 14.52%, and 1.20% in the same four bands. The original low-heavy draft measured 84.2% in the lowest band; the revised loop's absolute 20–120 Hz level is about 10 dB lower while the midrange carries the rhythm. The remaining 800–4,000 Hz share is about 3.6 percentage points above the reference window.

## Sound engine

`src/audio.js` exports `AudioEngine`. Create one instance and call `await audio.unlock()` inside the first user gesture. Music starts after unlock by default. Use `play()` with `hover`, `pick`, `place`, `invalid`, `score`, `attack`, `boom`, `victory`, `defeat`, `map`, or `forge`. Card and map aliases are also accepted, such as `card-hover` and `map-choice`. Pass `{ power, chain }` to `attack`, `boom`, or `score` to vary impact weight, pitch, and scoring-note count. `setMuted(bool)` controls the master output; `setMusic(bool)` toggles music; `stopMusic()` or `stop()` fades and stops the loop. Effects are synthesized in Web Audio, so they need no additional assets or dependencies.
