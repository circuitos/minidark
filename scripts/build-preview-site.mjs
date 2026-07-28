#!/usr/bin/env node
/* ============================================================================
   build-preview-site.mjs — composes the deployable site from git branches.
   Zero dependencies; read-only w.r.t. the repo (extracts via `git archive`,
   never checks anything out).

   Layout produced in <outDir> (default: _site):
     /                      tree of ROOT_BRANCH (the repo default branch)
     /previews/<slug>/      tree of every other branch (slug: "/" → "--")
     /previews/index.html   generated listing (noindex), newest-first
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
   becomes "-". Keep this in sync with the sticky-comment job in
   .github/workflows/deploy-pages.yml. */
function slugify(branch) {
  return branch.replace(/\//g, "--").replace(/[^A-Za-z0-9._-]/g, "-");
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

function previewIndex(previews) {
  const rows = previews.map((p) =>
    `<li><a href="./${esc(p.slug)}/">${esc(p.branch)}</a>` +
    ` <code>${p.sha.slice(0, 7)}</code> <small>${esc(p.date)}</small>` +
    ` <span>${esc(p.subject)}</span></li>`
  ).join("\n");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>branch previews</title>
</head>
<body>
<h1>Branch previews</h1>
<ul>
${rows || "<li>(no preview branches)</li>"}
</ul>
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
writeFileSync(join(outDir, "previews", "index.html"), previewIndex(previews));
writeFileSync(join(outDir, ".nojekyll"), "");
writeFileSync(join(outDir, "robots.txt"), "User-agent: *\nDisallow: /previews/\n");
console.log(`composed ${previews.length} preview(s) into ${outDir}`);
