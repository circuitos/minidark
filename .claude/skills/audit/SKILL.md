---
name: audit
description: Run a full adversarial self-audit of this codebase across code smell, redundancy, inefficiency, scalability and technical debt; verify every finding against the documented judgment calls, apply only safe fixes, and update AUDIT.md. Use when asked to audit the code, review code health, hunt tech debt, or re-run the audit after major growth.
---

# MINIDARK self-audit routine

Distilled from the first full audit (2026-07, branch claude/music-library-features).
That run produced 67 verdicts; every rule below earned its place there.

## Ground rules

1. Read `CLAUDE.md` FIRST. Its Gotchas and the in-file JUDGMENT CALL banners are
   design, not debt. A finding that re-litigates one is auto-refuted unless it
   targets a side effect the docs do not claim (example: whole-project undo
   snapshots are by design, but their per-gesture CPU cost was fair game; it
   measured 0.1 ms and died anyway).
2. Read `AUDIT.md` section "Refuted or accepted" before seeding. Those are
   verified non-issues with evidence. Do not re-report them.
3. Seed the new audit from `AUDIT.md`'s open tables so settled verdicts are
   not re-derived.

## Method (what worked)

1. **Seed sweep**: one explorer produces candidate findings with file:line,
   dimension, severity. Aim wide; verification cuts hard (14 of 51 died).
2. **Adversarial verify**: parallel verifier agents, one per code area
   (widgets / export+modals / panels+seq / engine hot paths / listeners /
   scripts+CI), each instructed to REFUTE its batch against the real code.
   Verdicts: CONFIRMED, ADJUSTED (real but corrected), REFUTED (with reason).
3. **Gap sweep**: separate agents audit the files the seed skipped, primed
   with what is already known so they do not duplicate. The first run's gap
   sweep found the only new correctness bugs (2 of them in same-day code).
4. **Measure disputed perf claims, never argue them.** Engine files are
   DOM-free and run headless: `scripts/mds-sandbox.mjs` loads them in Node.
   UI claims get Chromium via Playwright (`/opt/pw-browsers/chromium`,
   `import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs"`).

## Fix policy (three passes)

- **Pass 1, same commit as the report**: single-file, behavior-preserving,
  cannot disturb a judgment call. Everything else is listed, not fixed
  (house rule: never refactor working code as a side effect).
- **Pass 2, after explicit go-ahead**: medium items; record the design
  decision taken in AUDIT.md (example: scheduler underrun recovery chose
  SKIP over compress; STOP-kill chose a voice registry over track muting so
  live keyboard notes keep ringing).
- **Pass 3**: the long tail. Defer only with written rationale (F36: the
  8x16 grid constants stay hardcoded until the grid actually grows).

## Verification harness (all of it, every pass)

1. `node scripts/validate.mjs && node scripts/lint.mjs && node scripts/smoke.mjs`
2. In-browser `MDS.selftest()` after POWER ON.
3. A Playwright regression probe per fix (click the thing, assert the state).
   Serve with `python3 -m http.server`; filter cdnjs/lamejs network errors
   (unreachable from sandboxes; WAV-only fallback is the designed behavior).

## Codebase-specific traps (each cost real time once)

- `WaveShaperNode.curve` returns a fresh copy per read: identity comparisons
  lie. Count `dsp.distCurve` calls instead.
- The Node vm sandbox is another realm: `instanceof Float32Array` lies. Use
  `ArrayBuffer.isView`.
- Knobs built in detached subtrees make `getComputedStyle` reads look worse
  than they are; only reads interleaved with live-DOM appends force layout.
- A modal overlay blocks physical clicks, so re-entrancy bugs need
  programmatic `.click()` or keyboard focus to reproduce.
- Test ordering: RESET empties the project; anything after it that expects
  audible output must load a demo first.

## Invariants that regress silently (check these every audit)

- AudioParam cancel-then-pin: `adsr()` and `synth.killAll` both pin the
  current value before `cancelScheduledValues`. Any new cancel site must too.
- Voice lifecycle: every sequencer-scheduled note goes through
  `synth.trigger` (which registers it for STOP); keyboard notes and previews
  stay unregistered on purpose.
- One owner each: entry notes (`state.entryNote`), send-knob construction
  (`sendKnobRow`), knob/fader wheel+keys (`MDS.ui.ctlKeys`), blob downloads
  (`MDS.ui.download`), header cells (`MDS.ui.cell`), branch slugs
  (`build-preview-site.mjs --slug`). New copies of any of these are findings.
- ENGINE stays DOM-free (smoke depends on it); CONTENT owns every string;
  raw colors live only in theme.css; sel events that keep the same track
  must stay cheap (panels and seq deliberately skip).

## AUDIT.md protocol

Fixed items move from the open tables into a fixed table with a one-line
resolution and the commit. Refuted items keep their refuting evidence
forever. The report is the seed of the next audit; keep it honest and keep
it free of em dashes (house copy rule).
