#!/usr/bin/env node
/* ============================================================================
   build-preview-site.mjs — composes the deployable site from git branches.
   Zero dependencies; read-only w.r.t. the repo (extracts via `git archive`,
   never checks anything out).

   Layout produced in <outDir> (default: _site):
     /                      tree of ROOT_BRANCH (the repo default branch)
     /previews/<slug>/      tree of every other branch (slug: "/" → "--")
     /previews/index.html   generated listing of EVERY branch, trunk pinned
                            first (links to the site root), then newest-first.
                            Styled with the site's own tokens: it links
                            trunk's css/theme.css and uses var() fallbacks
                            that duplicate the anchor palette, so it stays
                            dark even if the root tree is ever absent (same
                            precedent as the favicon in index.html).
     /.nojekyll             stop Pages running Jekyll
     /robots.txt            Disallow: /previews/

   Cache-busting against the ~10-minute Pages edge cache: each tree's HTML
   gets data-build="<sha12>" on <html> and every local .js/.css reference
   rewritten to ...?v=<sha12>. Stamps are per-branch, so deploying one branch
   never busts the others' caches.

   Local dry run:
     git fetch origin && node scripts/build-preview-site.mjs /tmp/site
   ========================================================================== */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const outDir = process.argv[2] || "_site";
const SKIP = new Set(["gh-pages", "HEAD"]);

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
}

function detectRootBranch() {
  if (process.env.ROOT_BRANCH) return process.env.ROOT_BRANCH;
  try {
    return git("symbolic-ref", "refs/remotes/origin/HEAD").replace("refs/remotes/origin/", "");
  } catch {
    return "main";
  }
}

/* Branch name → directory slug. Slashes become "--"; anything else unsafe
   becomes "-". THE one implementation: the sticky-comment job in
   .github/workflows/deploy-pages.yml calls `--slug` below instead of
   carrying a copy (the two had a keep-in-sync contract before). */
function slugify(branch) {
  return branch.replace(/\//g, "--").replace(/[^A-Za-z0-9._-]/g, "-");
}

/* `node scripts/build-preview-site.mjs --slug <branch>`: print the slug and
   exit. Lets CI derive preview URLs without duplicating the rule. */
if (process.argv[2] === "--slug") {
  console.log(slugify(process.argv[3] || ""));
  process.exit(0);
}

function listBranches() {
  const out = git("for-each-ref", "refs/remotes/origin",
    "--format=%(refname:short)%09%(objectname)%09%(committerdate:iso8601)%09%(subject)");
  return out.split("\n").filter(Boolean).map((line) => {
    const [ref, sha, date, ...rest] = line.split("\t");
    return { branch: ref.replace(/^origin\//, ""), sha, date, subject: rest.join("\t") };
  }).filter((b) => !SKIP.has(b.branch) && b.branch !== "origin");
}

/* Extract a commit's tree into dest without touching the working copy.
   spawn with arg arrays: no shell, so branch names need no quoting. */
function extractTree(sha, dest) {
  mkdirSync(dest, { recursive: true });
  const archive = spawnSync("git", ["archive", sha], { maxBuffer: 1 << 28 });
  if (archive.status !== 0) throw new Error(`git archive ${sha}: ${archive.stderr}`);
  const tar = spawnSync("tar", ["-x", "-C", dest], { input: archive.stdout, maxBuffer: 1 << 28 });
  if (tar.status !== 0) throw new Error(`tar extract: ${tar.stderr}`);
  for (const meta of [".github", ".claude"]) {
    rmSync(join(dest, meta), { recursive: true, force: true });
  }
}

/* Stamp data-build + ?v= cache busters into every .html file of a tree. */
function stampTree(dir, sha12) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) { stampTree(p, sha12); continue; }
    if (!entry.endsWith(".html")) continue;
    let html = readFileSync(p, "utf8");
    html = html.replace(/<html(\s|>)/, `<html data-build="${sha12}"$1`);
    // local .js/.css references only; leave http(s):, data:, protocol-relative
    html = html.replace(
      /((?:src|href)=")(?!https?:|data:|\/\/)([^"?]+\.(?:js|css))(")/g,
      (_, pre, path, post) => `${pre}${path}?v=${sha12}${post}`
    );
    writeFileSync(p, html);
  }
}

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* The listing page for /previews/: every branch, trunk pinned first.
   Design tokens come from trunk's css/theme.css; the var() fallbacks below
   duplicate the anchor palette (bg0/bg1/ink/accents, see css/theme.css) so
   the page still reads dark if that stylesheet is missing. Update them by
   hand when the palette changes, like the index.html favicon. */
function previewIndex(trunk, previews) {
  const stamp = trunk ? `?v=${trunk.sha.slice(0, 12)}` : "";
  const row = (href, name, badge, sha, date, subject) =>
    `<li><a class="br" href="${href}">` +
    `<span class="name">${esc(name)}</span>` +
    (badge ? `<span class="badge">${esc(badge)}</span>` : "") +
    `<code>${esc(sha.slice(0, 7))}</code>` +
    `<span class="date">${esc(date.slice(0, 16))}</span>` +
    `<span class="subj">${esc(subject)}</span>` +
    `</a></li>`;
  const rows = [
    ...(trunk ? [row("../", trunk.branch, "root", trunk.sha, trunk.date, trunk.subject)] : []),
    ...previews.map((p) => row(`./${esc(p.slug)}/`, p.branch, "", p.sha, p.date, p.subject)),
  ].join("\n");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>MINIDARK · branch previews</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' fill='%230c0d10'/%3E%3Ccircle cx='8' cy='8' r='4' fill='none' stroke='%23e0483c' stroke-width='2'/%3E%3Cline x1='8' y1='8' x2='11' y2='5' stroke='%23e6e8ec' stroke-width='1.5'/%3E%3C/svg%3E">
<link rel="stylesheet" href="../css/theme.css${stamp}">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: var(--c-bg0, #0c0d10);
  color: var(--c-ink0, #e6e8ec);
  font-family: var(--font-ui, "Barlow", "Helvetica Neue", Helvetica, "Segoe UI", system-ui, Arial, sans-serif);
  min-height: 100vh;
}
main {
  max-width: 46rem; margin: 0 auto;
  padding: var(--sp-6, 2.2rem) var(--sp-4, 1rem);
  display: flex; flex-direction: column; gap: var(--sp-4, 1rem);
}
h1 {
  font-size: var(--fs-l, 1.05rem); font-weight: 600;
  letter-spacing: 0.24em; text-transform: uppercase;
}
/* inline-block: ::first-letter only takes effect on block-like boxes */
h1 .logo { display: inline-block; }
h1 .logo::first-letter { color: var(--c-accent, #e0483c); }
h1 .sub { color: var(--c-ink2, #767c88); font-weight: 500; letter-spacing: var(--track-caps, 0.16em); }
.note { color: var(--c-ink2, #767c88); font-size: var(--fs-s, 0.78rem); }
ul { list-style: none; display: flex; flex-direction: column; gap: var(--sp-2, 0.4rem); }
.br {
  display: flex; flex-wrap: wrap; align-items: baseline;
  gap: var(--sp-1, 0.2rem) var(--sp-3, 0.65rem);
  background: var(--c-bg1, #16171b);
  border: var(--bw, 1px) solid var(--c-line, #2b2e35);
  border-radius: var(--r-m, 5px);
  padding: var(--sp-3, 0.65rem) var(--sp-4, 1rem);
  color: inherit; text-decoration: none;
  transition: border-color 150ms ease, background 150ms ease;
}
.br:hover { border-color: var(--c-accent2, #45a7e6); background: var(--c-bg2, #1e2025); }
.name { font-weight: 600; overflow-wrap: anywhere; }
.badge {
  font-size: var(--fs-xs, 0.68rem); color: var(--c-accent, #e0483c);
  border: var(--bw, 1px) solid var(--c-accent, #e0483c);
  border-radius: var(--r-s, 3px); padding: 0 var(--sp-2, 0.4rem);
  text-transform: uppercase; letter-spacing: var(--track-caps, 0.16em);
}
code, .date {
  font-family: var(--font-mono, ui-monospace, "SF Mono", Menlo, Consolas, monospace);
  font-size: var(--fs-s, 0.78rem); color: var(--c-ink1, #9ba0aa);
}
.date { margin-left: auto; color: var(--c-ink2, #767c88); }
.subj { flex-basis: 100%; color: var(--c-ink1, #9ba0aa); font-size: var(--fs-s, 0.78rem); }
.empty { color: var(--c-ink2, #767c88); font-size: var(--fs-s, 0.78rem); padding: var(--sp-3, 0.65rem) 0; }
</style>
</head>
<body>
<main>
<h1><span class="logo">MINIDARK</span> <span class="sub">branch previews</span></h1>
<p class="note">Every branch of the repo, live. The root branch deploys to the site root; every other branch previews here, newest first. Allow ~1 minute per push plus up to 10 minutes of Pages edge cache.</p>
<ul>
${rows || `<li class="empty">(no branches found)</li>`}
</ul>
</main>
</body>
</html>
`;
}

/* ── main ── */
const rootBranch = detectRootBranch();
const branches = listBranches();

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const trunk = branches.find((b) => b.branch === rootBranch);
if (trunk) {
  extractTree(trunk.sha, outDir);
  stampTree(outDir, trunk.sha.slice(0, 12));
  console.log(`root      ← ${rootBranch} @ ${trunk.sha.slice(0, 7)}`);
} else {
  console.warn(`warning: root branch "${rootBranch}" not found in origin refs; site root left empty`);
}

const previews = branches
  .filter((b) => b.branch !== rootBranch)
  .sort((a, z) => z.date.localeCompare(a.date))
  .map((b) => ({ ...b, slug: slugify(b.branch) }));

for (const p of previews) {
  const dest = join(outDir, "previews", p.slug);
  extractTree(p.sha, dest);
  stampTree(dest, p.sha.slice(0, 12));
  console.log(`previews/${p.slug} ← ${p.branch} @ ${p.sha.slice(0, 7)}`);
}

mkdirSync(join(outDir, "previews"), { recursive: true });
writeFileSync(join(outDir, "previews", "index.html"), previewIndex(trunk, previews));
writeFileSync(join(outDir, ".nojekyll"), "");
writeFileSync(join(outDir, "robots.txt"), "User-agent: *\nDisallow: /previews/\n");
console.log(`composed ${previews.length} preview(s) into ${outDir}`);
