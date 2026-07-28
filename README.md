# minidark

A compact browser studio to create and learn dark synth electronic music —
tuned to the sound of late-80s industrial and synth-pop. Built for absolute
beginners: play immediately, learn as you go, export a real track.

## Run it

No server, no build step, no dependencies to install:

```
open index.html        # or just double-click it
```

(Any static file server also works: `python3 -m http.server` → `localhost:8000`.)

Click **POWER ON** (browsers require one gesture before audio), press **PLAY** —
a demo track is already loaded. Open **LESSONS** if you've never touched a
synthesizer.

## What's inside

- **Synth engine** (Web Audio, everything synthesized — zero audio assets):
  subtractive voices (saw/pulse, resonant lowpass, ADSR), a 2-op FM voice,
  and a full 808/909-style drum kit incl. two industrial hits.
- **Effects**: waveshaper distortion, chorus, tempo-synced delay, convolution
  reverb with a procedurally generated impulse response, bitcrusher — plus a
  glue-compressed, limited master bus so beginners can't clip.
- **16-step sequencer**, 8 tracks, accents, 8-pattern bank, song mode
  (chains 30+ bars), scale lock, swing, lookahead scheduling on the audio
  clock (no drift).
- **Playable keyboard** (mouse/touch + QWERTY) over the running sequencer.
- **Learning layer**: 7 interactive lessons with live sound demos, tooltips
  on every control, a 55-term glossary, and three original, fully editable
  demo tracks (brooding / mid-tempo / aggressive).
- **Export**: deterministic offline render to WAV (always), MP3 (lamejs from
  cdnjs, graceful WAV-only fallback), OGG/WebM where supported. Projects
  save/load as JSON files — the app deliberately uses no localStorage.

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
