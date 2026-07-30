# Self-audit

Code audit of the whole repo across five dimensions: code smell, redundancy,
inefficiency, scalability bottlenecks, technical debt. Conducted 2026-07-30 on
branch `claude/music-library-features-2jofn1`.

**Method.** A seeding sweep produced 51 candidate findings; six adversarial
verifier agents then tried to refute each one against the actual code (with
Node measurements where a perf claim was disputed), while two gap-sweep agents
audited the files the seed skipped. Result: 67 verdicts, of which 34 confirmed,
19 confirmed with corrections, 14 refuted. Documented judgment calls in
CLAUDE.md and file headers were treated as accepted design, not findings.

**Status.** The ten findings that were single-file, behavior-preserving and
risk-free were fixed in the same commit as this report (section 1). Everything
else is listed for discussion first, per the house rule against refactoring
working code as a side effect. Severity: high = audible/visible today or a
real leak; med = measurable waste or reachable bug; low = latent or cosmetic.

## 1. Fixed in this audit

| ID | Sev | Where | What was wrong |
|---|---|---|---|
| F37 | high | `js/ui/keyboard.js` | keyup recomputed the note at release time, so changing octave, key or scale lock while a QWERTY key was held left the voice ringing forever (oscillators only stop inside `release()`). Now each key offset remembers the note it started and releases exactly that. |
| F32 | high | `js/engine/synth.js` | The pluck-buffer cache evicted by clearing ALL 48 entries, so a guitar-knob sweep during playback forced ~28 ms Karplus re-renders inside the scheduler's 120 ms lookahead window: a dropout mechanism. Now a same-size LRU that never evicts actively playing notes. |
| G2-3 | med | `js/state.js` | `assignSound` re-read `tr.patch` when a sample decode resolved, so assigning sample A then quickly switching to sound B let A's late buffer overwrite B's patch. Now captures the patch object, mirroring `hydrateBuffers`. |
| G2-4 | med | `js/state.js` | `loadProject` shallow-merged `fx`/`master` from the file, so a partial or older project file crashed `graph.apply` with a TypeError. Now per-section defensive merge, like tracks already had. |
| F2 | med | `js/ui/fader.js`, `js/ui/knob.js` | `pointerdown` ignored `e.button`: right-clicking a fader audibly jumped its value before the context menu opened. Both widgets now guard on the primary button, matching the grid cells. |
| F20 | med | `js/engine/graph.js` | `apply()` regenerated the 2048-point distortion and 8192-point crusher curves on every call, i.e. per pointermove of ANY knob including tempo and volume (~1.3 ms + ~40 KB per move, measured). Now guarded by last-value checks like the reverb IR. Verified: 0 rebuilds across a 60-move drag. |
| F30 | med | `js/ui/panels.js` | The LIBRARY tab rebuilds itself on every interaction and the panel body is the scroll container, so tapping an info toggle or USE ON TRACK below the fold snapped the panel back to the top. Scroll position is now preserved across rebuilds. |
| F48 | med | `scripts/lint.mjs` | The duplicate-global guard only matched line-start, two-segment `MDS.*` assignments; the indented `MDS.selftest` already escaped it. Regex broadened (28 definitions now tracked, was 25; zero false positives). |
| G1-1 | low | `css/theme.css` | Tokens `--c-black` and `--c-glass1` were defined but referenced nowhere. Deleted. |
| G1-3 | low | `css/app.css` | `.strip .s-name` was declared in two adjacent identical-specificity rules. Merged. |

## 1b. Fixed in the follow-up pass (all former medium-severity items)

Design decisions taken, per finding:

| ID | Where | Resolution |
|---|---|---|
| G2-1 | `js/engine/sequencer.js` | Underrun recovery added: after a stall past the lookahead, missed steps are SKIPPED (step/songPos resync to wall-clock musical time, like hardware dropping beats) instead of firing as a bunched burst. |
| G2-2 | `js/engine/export.js` | Tail is now `TAIL` plus the longest release actually sounding in the chain's final bar (`tailSecs`, covered by a smoke test), so held pads and ringing strings export complete. |
| G2-7 | `js/engine/synth.js`, `sequencer.js` | Voice registry per graph: `trigger()` registers every scheduled voice's amp; STOP calls `synth.killAll` which cancel-then-pins each amp and fades it in ~100 ms. Live keyboard notes and previews stay unregistered and unaffected. |
| F13 | `js/ui/exportui.js` | Soft cap: song renders refuse beyond 300 bars with a clear message (`CONTENT.export.tooLong`); render + encode stay synchronous but bounded. |
| F9 | `js/ui/exportui.js`, `js/main.js` | One shared `MDS.ui.download` (the append-and-remove variant); topbar SAVE now uses it. |
| F10 | `js/ui/exportui.js`, `js/main.js` | The dialog's name input emits a `name` bus event; the topbar field subscribes. |
| F1 | `js/ui/knob.js`, `js/ui/fader.js` | Shared `MDS.ui.ctlKeys` now owns the wheel / arrow-key / double-click contract for both widgets; the byte-identical copies are gone. Drag handling stays per-widget (genuinely different). |
| F14 | `js/ui/panels.js` | One `sendKnobRow` helper builds the send knobs for both the INSTRUMENT group and the MIXER strips; the tooltip-suffix map exists once. |
| F31 | `js/ui/panels.js` | `sel` events that keep the same selected track no longer rebuild the INSTRUMENT/LIBRARY tabs (wheel note nudges, key changes and scale-lock toggles used to tear them down per tick). |
| F34 | `js/ui/panels.js` | 24 MB total cap on imported samples with a friendly refusal (`CONTENT.lib.samplesFull`), alongside the existing 8 MB per-file cap. |
| F4 | `js/ui/meter.js` | The rAF loop idles until audio exists (no more per-frame layout reads against the hidden app), and a resize listener invalidates the cached bar heights so the peak tick stays true. |

## 2. Open, medium severity: discuss before fixing

None. All eleven were resolved in the follow-up pass above.

## 1c. Fixed in the third pass (the low-severity backlog)

| ID | Where | Resolution |
|---|---|---|
| F3 | `js/ui/knob.js` | Stroke-width token read once per session, not once per knob. |
| F5 | `js/ui/meter.js` | GR column now calls `drawCol` (its peak branch no-ops, as verified). |
| F6 | `js/ui/meter.js` | dB readout and clip class written only when the rendered string changes. |
| F7 | `js/ui/meter.js` | Analyser tap keyed on the AudioContext, so a rebuilt context re-taps. |
| F11 | `js/ui/exportui.js` | While lamejs is still loading, the open dialog polls and re-enables MP3 the moment it lands. |
| F12 | `js/ui/exportui.js` | Re-entrancy guard (one dialog), and an in-flight render bails when the dialog closed mid-way. |
| F16 | `js/ui/knob.js` + callers | One `MDS.ui.cell` helper replaces the four header-cell copies. |
| F17 | `js/main.js` | confirmReset now rides `MDS.ui.modal.open`; Enter-to-confirm stays as its own documented addition, removed via onClose. |
| F18 | composer + workflow | The slug rule lives only in `build-preview-site.mjs`; the PR-comment job calls its new `--slug` mode instead of carrying a copy. |
| F21 | `js/engine/graph.js` | Reverb guard quantizes exactly like `makeIR`'s cache key; the two now agree on "changed". |
| F23 | `js/engine/graph.js` | Dead `pre.gain` write removed; delay division map hoisted to a module const. |
| F24 | `js/engine/graph.js` | Per-channel memo: applyMixer reschedules only params whose value actually changed. |
| F26 | `js/ui/seq.js` | Play button written on play/stop transitions only, not per frame. |
| F27 | `js/ui/seq.js`, `sequencer.js` | Dead `tick`/`transport` emits removed. |
| F28 | `js/ui/seq.js` | `sel` events that keep the same track and pattern skip the 128-cell repaint; a wheel tick now repaints once (via `pattern`), not twice. |
| F29 | `js/ui/seq.js` | Four delegated grid listeners replace 512 per-cell closures; row heads fall through untouched. |
| F35 | `js/state.js` | loadProject truncates foreign files to the 8 reachable patterns. |
| F38 | `js/ui/keyboard.js` | `build()` registers its global listeners exactly once (idempotent re-call). |
| F41 | `js/ui/lessons.js` | drumgrid tracks its pending playhead timeouts and clears them on cleanup. |
| F44 | `scripts/validate.mjs` | Widget scrape accepts any indentation; only the `box` param contract stays exact. |
| F49 | `scripts/lint.mjs` | Hex matching restricted to real color lengths (3/4/6/8), ending `#faded`-style false failures. |
| F51 | `deploy-pages.yml` | PR-comment job skips default-branch pushes (their PRs are closed by definition). |
| G1-2 | `css/theme.css`, `app.css` | New `--rowhead-w` token owns the width; the col-LED offset derives from it. |
| G1-4 | `css/theme.css` | Derived tokens (`--knob-fill`, `--meter-gr/hi/mid`, `--track-5`) now reference their anchors; `--meter-lo`'s green stays literal with a comment (equal to `--track-4` by coincidence, not meaning). |
| G1-5 | `scripts/validate.mjs` | Demo blurbs are validated against the real bpm/key in demos.js, so they can no longer drift into lying. |
| G1-6 | `js/demos.js` | `make(id)` throws a diagnosable `unknown-demo:` error. |
| G1-7 | `css/app.css` | Decision recorded in the stylesheet: the signal-grid is a backdrop, not a ruler; alignment past the first beat group is accepted texture. |
| G2-5 | `js/boot.js` | lamejs pinned with an SRI sha512 (computed from the npm 1.2.0 artifact cdnjs mirrors) + `crossorigin`; a tampered response now fails closed into the designed WAV-only fallback. |
| G2-6 | `js/library.js` | `resolve()` returns a deep copy for synth sources, restoring the materialize() invariant. |
| G2-8 | `js/engine/dsp.js` | Dead clamp removed (bit-identical output; `a` is always at least 0.05). |
| G2-9 | `js/engine/sequencer.js` | tickQueue bounded at 128 (hidden-tab growth) and drained with one splice instead of shift-per-tick. |

## 3. Open, low severity

| ID | Effort | Where | Finding |
|---|---|---|---|
| F36 | large | ~20 sites | 8-track/16-step constants hardcoded everywhere; `graph.NTRACKS` is exported but unused. Deliberately deferred: 8x16 is a stable core product constant of this beginner app, and a 20-site churn buys nothing until the grid actually grows. Revisit only alongside a real grid-size feature. |

## 4. Refuted or accepted (do not re-report)

Verified non-issues, with the refuting evidence:

- **F8** meter "latest mount wins": single call site, explicitly commented; no occurrence path.
- **F15 / F45 / F46 / F47** validate.mjs heuristics and escape lists: documented maintenance contract in CLAUDE.md; unused-tooltip note is deliberately non-fatal and visible on every run.
- **F19** lesson widgets bypassing `auditionOn`: they need live wave/filter access on the raw node that `auditionOn`'s opaque handle cannot give.
- **F22** `setParam` instanceof cost: the fallback branch never executes in a real browser; measured irrelevant.
- **F25** undo snapshot stringify cost: measured 0.096 ms per gesture on a ~41 KB project; imperceptible, and project size is bounded by design (samples live outside it).
- **F33** `lib.list()` filtering per call: ~320 predicate calls per render, microseconds.
- **F39** keyup lacking modifier guards: functionally required; guarding would stick notes when modifiers or focus change mid-hold.
- **F40** tooltip mouseover walk: fires per element entered, not per pixel; ~16 cheap events per row swipe.
- **F42** lesson cleanups array growth: reset on every step change and close; max 2-3 entries.
- **F43** `document.activeElement` null-guard: falls back to `document.body` in any fully active document; unreachable here.
- **F50** preview composer re-extracting all branches: the documented deployment model; branch deletes DO prune (the workflow redeploys on delete events).

Plus the standing judgment calls documented in CLAUDE.md and file headers
(whole-project undo snapshots, WaveShaper bitcrusher, samples outside
`project`, classic scripts + one global, lamejs soft dependency, favicon and
previews-page color duplication, single dark theme, adsr cancel-pinning,
per-note patch application). These are design, not debt.

## 5. Re-auditing

Re-run the same audit after major growth (new engine, grid size change,
library past ~100 entries). Seed it from this file's open tables so verified
verdicts are not re-litigated; anything fixed here should move from the open
tables into section 1 with its commit.
