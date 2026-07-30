# minidark

A compact browser studio to create and learn dark synth electronic music,
tuned to the sound of late-80s industrial and synth-pop. Built for absolute
beginners: play immediately, learn as you go, export a real track.

## Run it

No server, no build step, no dependencies to install:

```
python3 -m http.server        # then open http://localhost:8000
```

(Opening `index.html` directly also works for this app, but serving is the
documented path.)

Click **POWER ON** (browsers require one gesture before audio), press
**PLAY**: a demo track is already loaded. Open **LESSONS** if you've never
touched a synthesizer.

## What's inside

- **Synth engine** (Web Audio, everything synthesized, zero audio assets):
  subtractive voices (saw/pulse, resonant lowpass, ADSR), a 2-op FM voice,
  Karplus-Strong plucked strings (guitars, acoustic through distorted),
  and a full 808/909-style drum kit incl. industrial hits.
- **46-sound library** with several presets per instrument family (six snares:
  gated, 808, glitch, clap-snare, crack, dry; six guitars), grouped so the
  family a track already uses comes first in its SOUND picker. Every sound
  carries a ⓘ history note: the real machine or record it is modeled on,
  with a Wikipedia link and glossary cross-references.
- **Sample import**: load short audio files as instruments on any track
  (repitchable, FX-sendable); they are stored inside the project file, so a
  saved project stays self-contained.
- **Effects**: waveshaper distortion, chorus, tempo-synced delay, convolution
  reverb with a procedurally generated impulse response, bitcrusher, plus a
  glue-compressed, limited master bus so beginners can't clip.
- **16-step sequencer**, 8 tracks, accents, note lengths (drag a melody step
  right to hold it), 8-pattern bank, undo/redo, song mode
  (chains 30+ bars), scale lock, swing, lookahead scheduling on the audio
  clock (no drift).
- **Playable keyboard** (mouse/touch + QWERTY) over the running sequencer.
- **RANDOMIZE** on every instrument: rerolls each dial inside ranges the voice
  can still render, plays the result, and stays one undo away.
- **Learning layer**: 7 interactive lessons with live sound demos, tooltips
  on every control (toggleable via HINTS), a 67-term glossary that now covers
  the machines behind the sounds (TR-808, TB-303, DX7, Karplus-Strong…), and
  three original, fully editable demo tracks (brooding / mid-tempo /
  aggressive).
- **Export**: deterministic offline render to WAV (always), MP3 (lamejs from
  cdnjs, graceful WAV-only fallback), OGG/WebM where supported. Projects
  save/load as JSON files; the app deliberately uses no localStorage.

## Architecture (for the design pass)

| Layer   | Where                        | Rule |
|---------|------------------------------|------|
| THEME   | `css/theme.css`              | Every color/font/spacing/radius/shadow/knob metric. Restyle the app by editing only this file. |
| CONTENT | `js/content.js`              | Every user-facing string (labels, lessons, tooltips, glossary, preset names). |
| ENGINE  | `js/engine/*`, `js/library.js`, `js/state.js` | Audio graph, voices, clock, export, sound registry. No DOM, no strings, no styles. |
| UI      | `js/ui/*`, `css/app.css`     | Components wiring ENGINE state to controls; tokens + CONTENT keys only. |

The sound registry (`SOUND_LIBRARY` in `js/library.js`) is pure data with a
documented schema; it ships all-synthesized but the loader already handles
`base64` and `url` sources, so the library grows by appending entries.

## Deployment & previews

Every push auto-deploys via GitHub Pages (`gh-pages` branch, generated;
never edit it): the default branch goes to the site root, every other branch
to `/previews/<slug>/`. See `CLAUDE.md` for details, the one-time Pages
setup, and the local dry-run command.

## Checks

Zero-dependency, non-blocking CI (`.github/workflows/check.yml`), also
runnable locally:

```
node scripts/validate.mjs   # content/schema/data validation
node scripts/lint.mjs       # syntax, dup globals, theme/copy/CSP rules
node scripts/smoke.mjs      # headless engine run
```
