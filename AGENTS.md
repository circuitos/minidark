# AGENTS.md

Read `CLAUDE.md` first; it is the single source of truth (architecture,
commands, deployment, gotchas, house rules). This file adds only
session-level policy:

- No build step exists and none may be introduced. The repo is the
  deployable; committed source must run as-is in a browser.
- Develop on a branch (agents: use the `claude/**` namespace). Every push
  gets a live preview at `/previews/<slug>/`. `main` deploys to the site
  root. Never touch `gh-pages` (generated output).
- Do not open a PR unless explicitly asked.
- Before declaring work done, run the gate locally:
  `node scripts/validate.mjs && node scripts/lint.mjs && node scripts/smoke.mjs`.
- Follow the three House Rules in CLAUDE.md (no em dashes in copy, no
  AI-attribution footers, discuss non-trivial changes first).
