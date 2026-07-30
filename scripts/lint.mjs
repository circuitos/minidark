#!/usr/bin/env node
/* lint.mjs — syntax + house-rule lint. Zero dependencies.
   1. `node --check` every script (classic js + mjs).
   2. Duplicate-global check: no MDS.* property defined in two files.
   3. THEME rule: no raw colors outside css/theme.css (tokens only).
   4. Copy rule: no em dashes in copy files (*.md, js/content.js).
   5. CSP rule: no inline <script> in index.html. */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

let failures = 0;
const fail = (msg) => { failures++; console.error("FAIL  " + msg); };
const ok = (msg) => console.log("ok    " + msg);

function walk(dir, exts, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, exts, out);
    else if (exts.some((x) => p.endsWith(x))) out.push(p);
  }
  return out;
}

/* 1 ── syntax */
const jsFiles = [...walk("js", [".js"]), ...walk("scripts", [".mjs"])];
for (const f of jsFiles) {
  try { execFileSync("node", ["--check", f], { stdio: "pipe" }); }
  catch (err) { fail(`syntax: ${f}\n${err.stderr}`); }
}
ok(`syntax: ${jsFiles.length} files pass node --check`);

/* 2 ── duplicate globals (each MDS.* property owned by exactly one file) */
const owners = {};
for (const f of walk("js", [".js"])) {
  const src = readFileSync(f, "utf8");
  for (const line of src.split("\n")) {
    // Leading whitespace and 3+ path segments count too: indented definitions
    // (MDS.selftest in main.js) used to slip past this guard entirely.
    const m = line.match(/^\s*(?:window\.)?MDS\.([A-Za-z_$][\w]*(?:\.[A-Za-z_$][\w]*)*)\s*=(?!=)/);
    if (!m || line.includes("|| {}")) continue;
    const path = m[1];
    if (owners[path] && owners[path] !== f) fail(`duplicate global MDS.${path} defined in ${owners[path]} and ${f}`);
    owners[path] = f;
  }
}
ok(`globals: ${Object.keys(owners).length} MDS.* definitions, no collisions`);

/* 3 ── THEME rule: raw colors live only in css/theme.css.
   Hex lengths are exact (3/4/6/8): {3,8} also matched English-looking
   strings like "#faded" and DOM ids, failing the build on non-colors. */
const colorRx = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b|\brgba?\(/;
for (const f of ["css/app.css", ...walk("js", [".js"])]) {
  const lines = readFileSync(f, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (colorRx.test(line)) fail(`raw color outside THEME: ${f}:${i + 1}: ${line.trim()}`);
  });
}
ok("theme: no raw colors outside css/theme.css");

/* 4 ── copy rule: no em dashes in copy files (house rule; en dashes for
        numeric ranges are fine) */
const copyFiles = [
  ...readdirSync(".").filter((f) => f.endsWith(".md")),
  "js/content.js",
];
for (const f of copyFiles) {
  const lines = readFileSync(f, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (line.includes("—")) fail(`em dash in copy: ${f}:${i + 1}: ${line.trim()}`);
  });
}
ok(`copy: no em dashes in ${copyFiles.join(", ")}`);

/* 5 ── CSP rule: index.html must have no inline scripts */
const html = readFileSync("index.html", "utf8").replace(/<!--[\s\S]*?-->/g, "");
if (/<script(?![^>]*\bsrc=)/.test(html)) fail("inline <script> in index.html (breaks the no-unsafe-inline CSP)");
else ok("csp: no inline scripts in index.html");

if (failures) { console.error(`\nlint: ${failures} failure(s)`); process.exit(1); }
console.log("\nlint: all good");
