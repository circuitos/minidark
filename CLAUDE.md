# CLAUDE.md

**What this is:** MINIDARK, a browser synth studio for absolute beginners in the
late-80s industrial / dark synth-pop palette. Static app, vanilla JS, Web Audio,
no build step, no server, no localStorage. The repo IS the deployable.

## Where things live

One owner per fact; link, don't restate.

| Concern | Owner | Rule |
|---|---|---|
| Design tokens (colors, fonts, spacing, radii, shadows, knob metrics) | `css/theme.css` | The ONLY file with raw color/size values. Restyling touches only this file. |
| Component styles | `css/app.css` | Tokens + semantic classes only. Zero raw colors (lint-enforced). |
| User-facing strings (labels, lessons, tooltips, glossary, preset names) | `js/content.js` | UI reads keys, never inline strings. |
| Audio graph, voices, clock, export | `js/engine/*` | No DOM, no user-facing strings, no styles. This rule is what lets CI run the engine headlessly in Node. |
| Sound registry | `js/library.js` | Pure data + loader; schema documented in-file. Grow by appending entries. |
| Project state, event bus | `js/state.js` | In-memory only; persistence is file export by design. Also owns the patch randomizer and the undo/redo snapshot stack, both DOM-free so the check scripts can drive them. |
| Demo tracks | `js/demos.js` | Original compositions as data. Blurbs/names live in CONTENT. |
| UI components | `js/ui/*` | Wire ENGINE state to controls. Tokens + CONTENT keys only. |
| Self-hosted fonts (Barlow, IBM Plex Mono + OFL licenses) | `fonts/`, `@font-face` in `css/theme.css` | CSP is `font-src 'self'`: no CDN webfonts, ever. |
| Boot / CSP | `js/boot.js`, `index.html` | No inline scripts (lint-enforced); CSP meta is in index.html. |
| Deploy + previews | `.github/workflows/deploy-pages.yml`, `scripts/build-preview-site.mjs` | See Deployment below. |
| CI gate | `.github/workflows/check.yml`, `scripts/{validate,lint,smoke}.mjs` | Zero-dependency Node scripts; no npm install anywhere. |

## Commands

```
python3 -m http.server            # serve locally, open http://localhost:8000
                                  # (file:// also works for this app, but serve
                                  #  anyway; it keeps fetch()-based features honest)
node scripts/validate.mjs         # content/schema/data validation
node scripts/lint.mjs             # syntax, dup globals, theme/copy/CSP house rules
node scripts/smoke.mjs            # headless engine run (scheduling, WAV encoder)
git fetch origin && node scripts/build-preview-site.mjs /tmp/site   # composer dry run
```

Run all three check scripts before declaring any change done.

## Deployment

- Trunk is `main` (repo default branch): it deploys to the site root.
  Every other branch auto-deploys to `/previews/<slug>/` (slug: `/` becomes `--`).
- `deploy-pages.yml` composes the whole site with `scripts/build-preview-site.mjs`
  and force-pushes it to `gh-pages` on every push. **`gh-pages` is generated
  output: never edit it, never branch from it.**
- One-time repo setup (manual, in GitHub): Settings → Pages → Source: *Deploy
  from a branch* → `gh-pages` / root.
- A push goes live in about a minute, plus up to 10 minutes of Pages edge
  cache. The composer stamps `data-build="<sha12>"` on `<html>` and appends
  `?v=<sha12>` to local script/style URLs, per branch, to defeat that cache.
- If a branch has an open PR, the workflow maintains one sticky comment with
  the preview URL (marker: `<!-- deploy-pages preview url -->`).
- If the deploy workflow fails, the site silently goes stale: check the
  Actions tab, not the site, when something looks old.
- `/previews/` is excluded from indexing (robots.txt + noindex meta).

## Branch & deploy policy

- `main` is promote-only in spirit: develop on branches, merge when a preview
  is verified. The `claude/**` namespace is reserved for agent branches; they
  auto-preview like any branch.
- Default workflow: branch → push → check the `/previews/<slug>/` URL.
- Do not open a PR unless explicitly asked.

## Gotchas

- Script order in `index.html` IS the dependency graph (classic scripts, one
  `MDS` global). Add new files in dependency order; `scripts/lint.mjs` catches
  duplicate `MDS.*` definitions.
- lamejs (MP3) is the only external dependency, loaded from cdnjs at runtime
  by `js/boot.js`. If it fails, export degrades to WAV-only with a visible
  notice. Keep it that way: never make the app hard-depend on the CDN.
- The CSP meta in `index.html` has no `'unsafe-inline'`: adding an inline
  `<script>` or `style=""` attribute will silently break in ways the console
  explains but the page won't. Lint checks the script side.
- ENGINE files must stay DOM-free. `scripts/smoke.mjs` loads them in a bare
  Node vm; a stray `document.` in ENGINE will fail CI (this is a feature).
- The favicon in `index.html` duplicates three theme colors (bg0, accent,
  ink0) as a data URI; update it by hand when the palette changes (tokens
  can't reach it).
- Patch-knob changes apply per-note (next scheduled step), mixer/FX/master
  knobs apply live to the running graph. Both are intended.
- A step's `len` (cell schema in `js/state.js`) is the only way to make a
  slow patch speak: `padWarm` has a 0.6 s attack, while one 16th at 120 BPM
  lasts 0.125 s. The grid writes `len` by dragging right across a melody row
  (`js/ui/seq.js`), and paints the held steps as a tie bar. Demo pads are
  authored as one chord with `len: 16`, so a pattern loaded from `demos.js`
  sounds nothing like a hand-entered one until the note is held.
- `adsr()` in `js/engine/synth.js` pins the envelope's in-flight value before
  `cancelScheduledValues`. Do not simplify that away: cancelling a
  `linearRampToValueAtTime` that has not landed yet reverts the param to the
  ramp's START value, so before this every note shorter than its own attack
  rendered as exact digital silence, live and in export alike.
- The "last chosen note" is PER ROW and lives behind `state.entryNote(ti)` /
  `state.setEntryNote(ti, n)` (backed by the sparse `sel.entryNotes`). The
  keyboard (`keyboard.js`, writes the SELECTED row) and the wheel-nudge
  (`seq.js`, writes the row under the cursor) are the only two choosers;
  every new melodic step reads it, on any row, selected or not. Rows with no
  choice yet fall back to the track's live `baseNote`, which is why the map is
  sparse rather than pre-filled: an untouched row follows its sound. Selecting
  a track must not write it. Add a third way to pick a pitch and it has to
  call `setEntryNote` too, or rows quietly stop remembering.
- Undo entries are whole-project JSON snapshots pushed at gesture END:
  `main.js` marks on bubbling `click`/`change`/`keyup` (after the handler that
  edited), plus a delayed `pointerup` for drags and for handlers that stop
  propagation. `mark()` diffs before pushing, so calling it too often is free.
  `history.apply()` sets its `last` snapshot BEFORE restoring, which is what
  stops the `project` event it fires from pushing the undone state back on.
- `keyboard.js` ignores keydowns carrying Ctrl/Cmd/Alt: `z`, `x` and `c` are
  note keys, so without that guard Ctrl+Z would play a note while undoing.
- `sendDist`/`sendChor`/`sendDelay`/`sendVerb`/`sendCrush` tooltip keys are
  built by string concatenation in `js/ui/panels.js`; `validate.mjs` hardcodes
  that list. Change one, change both.
- If library entries with `url` sources are ever added, append the build stamp
  (`document.documentElement.dataset.build`) to their fetch URLs from the UI
  layer, not ENGINE.
- The app intentionally has a single dark theme (it's a dark-synth studio);
  a `prefers-color-scheme` light variant is a design-pass decision, not a bug.

## House Rules

- *No em dashes in copy* (reads as an AI tell; use `:` `.` `,` `;` or
  restructure). Exempt numeric ranges and title-style separators. Enforced by
  lint for `*.md` and `js/content.js` (those files allow none at all).
- *No AI-attribution footers or session links* in commits, PRs, or comments
  (`.claude/settings.json` handles the automatic ones; don't add them by hand).
- *Discuss non-trivial changes first; never refactor working code as a side
  effect.* Non-trivial: multi-file changes, state-shape changes, schema/field
  renames. Trivial: typo fixes, a single data/library/glossary addition.

## Doc Upkeep

Treat doc drift as a bug. If a change makes any statement in this file, the
README, or AGENTS.md wrong, fixing the doc is part of the change. Append new
hard-won lessons to Gotchas as you burn time on them.
