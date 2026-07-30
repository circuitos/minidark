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

## 3. Open, low severity

| ID | Effort | Where | Finding |
|---|---|---|---|
| F3 | trivial | `js/ui/knob.js:39` | Per-knob `getComputedStyle` read of a constant token; hoist to module level. |
| F5 | trivial | `js/ui/meter.js:206` | GR column re-implements `drawCol` math inline; the call would be exact. |
| F6 | trivial | `js/ui/meter.js:210` | Per-frame readout string + class toggle written even when unchanged. |
| F7 | small | `js/ui/meter.js:38` | Analyser tap never torn down; latent only (audio is never rebuilt today). |
| F11 | small | `js/ui/exportui.js:62` | MP3 availability sampled once at dialog open; a late lamejs load stays disabled until reopen. |
| F12 | small | `js/ui/exportui.js:34` | No re-entrancy guard: stacked EXPORT modals, stacked Escape listeners, async render writing into a detached log. |
| F16 | small | `js/ui/seq.js`, `js/ui/keyboard.js` | The header-cell wrapper helper exists four times (three byte-identical). |
| F17 | medium | `js/main.js:127` | confirmReset hand-rolls a modal; semi-deliberate (the generic modal lacks Enter-to-confirm), but the split should be intentional, not accidental. |
| F18 | medium | `scripts/build-preview-site.mjs`, `deploy-pages.yml` | Slug rule duplicated between composer and PR-comment job; drift posts wrong URLs while the site deploys fine. |
| F21 | trivial | `js/engine/graph.js:148` | Reverb hysteresis (0.02) and IR cache key rounding (0.05) quantize the same decision differently. |
| F23 | trivial | `js/engine/graph.js:133` | Dead `pre.gain = 1` write per apply; `delaySeconds` allocates its map per call. |
| F24 | medium | `js/engine/graph.js:167` | applyMixer reschedules all 56 params per knob pointermove. |
| F26 | trivial | `js/ui/seq.js:475` | rAF loop writes the play label and toggles a class every frame even while stopped. |
| F27 | trivial | `js/ui/seq.js:488` | `tick` and `transport` bus events have zero subscribers: dead extension points. |
| F28 | medium | `js/ui/seq.js:332` | Full 128-cell repaint on `sel`, `pattern` and `mix`; a wheel tick repaints twice. Bounded by the fixed grid, so cheap today. |
| F29 | small | `js/ui/seq.js:197` | 512 per-cell handler closures where one delegated grid listener would do. |
| F35 | trivial | `js/state.js:319` | loadProject pads patterns to 8 but never truncates extras from foreign files. |
| F36 | large | ~20 sites | 8-track/16-step constants hardcoded everywhere; `graph.NTRACKS` is exported but unused. Only worth touching if the grid ever grows. |
| F38 | small | `js/ui/keyboard.js:90` | Listeners and bus subscriptions registered in build() with no removal path (bus has no `off`); safe because build runs once. |
| F41 | trivial | `js/ui/lessons.js:262` | drumgrid playhead setTimeouts outlive cleanup and touch detached cells. |
| F44 | small | `scripts/validate.mjs:84` | Widget scrape regex is coupled to exact 4-space indentation and a param named `box`; fails loud, but formatting should not be load-bearing. |
| F49 | small | `scripts/lint.mjs:48` | Color regex over all JS makes any `#`+hex-like string (a DOM id, a URL fragment) a false-positive failure. |
| F51 | small | `deploy-pages.yml:45` | PR-comment job runs on every push even with no open PR. |
| G1-2 | small | `css/app.css:492` | `.col-leds` margin hardcodes `6.6rem`, silently coupled to `.row-head` width. |
| G1-4 | small | `css/theme.css` | Anchor hexes repeated across tokens (e.g. `#45a7e6` four times) instead of `var()` references; a retint must find every copy. |
| G1-5 | medium | `js/content.js:271` | Demo blurbs hardcode BPM/key that duplicate the authoritative fields in demos.js; retuning a demo makes the card lie. Could be validated or templated. |
| G1-6 | small | `js/demos.js:242` | `demos.make(id)` indexes without a guard; unknown id throws an opaque TypeError. |
| G1-7 | small | `css/app.css:276` | The signal-grid background can never align with cells past step 4 because beat gaps shift the rhythm it mimics. Cosmetic; decide whether the misalignment is acceptable texture. |
| G2-5 | trivial | `js/boot.js:17` | lamejs script tag has no Subresource Integrity hash or crossorigin attribute. |
| G2-6 | trivial | `js/library.js:211` | `resolve()` returns the live registry patch (no copy), undermining the invariant `materialize()` exists to protect. |
| G2-8 | trivial | `js/engine/dsp.js:105` | `Math.min(1, 1 - a)` in makeIR is dead code (`a` is always >= 0.05). |
| G2-9 | small | `js/engine/sequencer.js:21` | tickQueue is drained only by rAF, which pauses in hidden tabs while audio keeps pushing: unbounded growth during long background playback, then an O(n^2) shift-drain. |

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
