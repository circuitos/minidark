#!/usr/bin/env node
/* validate.mjs — content/schema validation (cheapest gate, runs first).
   Zero dependencies. Catches the drift bugs a static app actually gets:
   library/CONTENT mismatches, broken demo data, lesson widgets that don't
   exist, tooltips referenced in UI code but missing from CONTENT. */
import { readFileSync, readdirSync } from "node:fs";
import { loadSandbox, ENGINE_FILES } from "./mds-sandbox.mjs";

let failures = 0;
const fail = (msg) => { failures++; console.error("FAIL  " + msg); };
const ok = (msg) => console.log("ok    " + msg);

const MDS = loadSandbox(ENGINE_FILES).MDS;
const C = MDS.CONTENT;

/* ── library ↔ CONTENT ─────────────────────────────────────────────────── */
const catKeys = new Set(Object.keys(C.lib.cats));
const libIds = new Set();
for (const e of MDS.SOUND_LIBRARY) {
  libIds.add(e.id);
  if (!C.libNames[e.id]) fail(`library entry "${e.id}" has no name in CONTENT.libNames`);
  if (!catKeys.has(e.category)) fail(`library entry "${e.id}" has unknown category "${e.category}"`);
  if (e.source.type === "synth") {
    const eng = e.source.patch && e.source.patch.engine;
    if (!["sub", "fm", "pluck", "drum"].includes(eng)) fail(`library entry "${e.id}" has invalid engine "${eng}"`);
  } else if (!["base64", "url"].includes(e.source.type)) {
    fail(`library entry "${e.id}" has unknown source type "${e.source.type}"`);
  }
}
for (const id of Object.keys(C.libNames)) {
  if (!libIds.has(id)) fail(`CONTENT.libNames has orphan id "${id}" (no such library entry)`);
}
ok(`library: ${MDS.SOUND_LIBRARY.length} entries, names + categories consistent`);

/* ── library lore: every sound anchored in the real world ──────────────── */
const glossaryTerms = new Set(C.glossary.map(([term]) => term));
for (const e of MDS.SOUND_LIBRARY) {
  const info = C.libInfo[e.id];
  if (!info || !info.text || !info.wiki) { fail(`library entry "${e.id}" has no CONTENT.libInfo lore (text + wiki)`); continue; }
  if (!/^https:\/\//.test(info.wiki)) fail(`libInfo "${e.id}" wiki link is not https: ${info.wiki}`);
  for (const t of info.terms || []) {
    if (!glossaryTerms.has(t)) fail(`libInfo "${e.id}" references glossary term "${t}" which does not exist`);
  }
}
for (const id of Object.keys(C.libInfo)) {
  if (!libIds.has(id)) fail(`CONTENT.libInfo has orphan id "${id}" (no such library entry)`);
}
ok(`libInfo: lore + https link for all ${MDS.SOUND_LIBRARY.length} sounds, glossary cross-refs resolve`);

/* ── demo tracks ───────────────────────────────────────────────────────── */
for (const id of MDS.demos.ids()) {
  if (!C.demos[id]) { fail(`demo "${id}" has no CONTENT.demos entry`); continue; }
  const p = MDS.demos.make(id);
  const secs = p.song.length * 16 * (60 / p.bpm / 4);
  if (secs < 60) fail(`demo "${id}" song is ${Math.round(secs)}s (< 60s)`);
  if (p.bpm < 60 || p.bpm > 180) fail(`demo "${id}" bpm ${p.bpm} out of range`);
  for (const pi of p.song) {
    if (!Number.isInteger(pi) || pi < 0 || pi > 7) fail(`demo "${id}" song references invalid pattern ${pi}`);
  }
  p.patterns.forEach((pat, pi) => {
    if (pat.steps.length !== 8) fail(`demo "${id}" pattern ${pi} has ${pat.steps.length} rows`);
    pat.steps.forEach((row, ti) => {
      if (row.length !== 16) fail(`demo "${id}" pattern ${pi} track ${ti} has ${row.length} steps`);
      row.forEach((cell, si) => {
        if (!cell || !cell.on) return;
        const notes = cell.notes && cell.notes.length ? cell.notes : (cell.note != null ? [cell.note] : []);
        for (const n of notes) {
          if (n < 21 || n > 108) fail(`demo "${id}" p${pi} t${ti} s${si}: note ${n} out of range`);
        }
      });
    });
  });
  for (const tr of p.tracks) {
    if (!tr.patch || !["sub", "fm", "pluck", "drum", "buffer"].includes(tr.patch.engine)) {
      fail(`demo "${id}" track "${tr.key}" has invalid patch`);
    }
  }
  // the blurb states tempo and key; it must state the REAL ones (they have
  // drifted apart from demos.js silently before this check existed)
  const blurb = (C.demos[id] && C.demos[id].blurb) || "";
  if (!blurb.includes(p.bpm + " BPM")) fail(`demo "${id}" blurb does not state its real tempo (${p.bpm} BPM)`);
  if (!blurb.includes(p.key + " minor")) fail(`demo "${id}" blurb does not state its real key (${p.key} minor)`);
  ok(`demo "${id}": ${p.song.length} bars ≈ ${Math.round(secs)}s, data well-formed, blurb in sync`);
}

/* ── lessons ↔ widgets ─────────────────────────────────────────────────── */
const lessonsSrc = readFileSync("js/ui/lessons.js", "utf8");
const widgetKeys = new Set();
// any indentation: formatting must not be load-bearing (the `box` param name
// IS the widget-builder contract, so that part stays exact)
for (const m of lessonsSrc.matchAll(/^\s+([A-Za-z_$]\w*)\(box\)\s*{/gm)) widgetKeys.add(m[1]);
for (const m of lessonsSrc.matchAll(/widgets\["([\w-]+)"\]/g)) widgetKeys.add(m[1]);
if (C.lessons.length < 7) fail(`only ${C.lessons.length} lessons (spec: 7)`);
for (const L of C.lessons) {
  if (!L.title || !L.blurb || !L.steps.length) fail(`lesson "${L.id}" incomplete`);
  for (const s of L.steps) {
    if (s.demo && !widgetKeys.has(s.demo)) fail(`lesson "${L.id}" references unknown widget "${s.demo}"`);
  }
}
ok(`lessons: ${C.lessons.length}, all demo widgets exist (${[...widgetKeys].length} widgets)`);

/* ── tooltips referenced in UI code all exist ──────────────────────────── */
const tipRefs = new Set([
  // built by concatenation in panels.js ("send" + suffix)
  "sendDist", "sendChor", "sendDelay", "sendVerb", "sendCrush",
  // passed as plain call arguments (waveSelect/radio helpers), invisible to the regexes
  "osc1", "osc2", "expScope", "expFormat",
]);
const uiFiles = ["js/main.js", ...readdirSync("js/ui").map((f) => "js/ui/" + f)];
for (const f of uiFiles) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/dataset\.tt\s*=\s*"([\w-]+)"/g)) tipRefs.add(m[1]);
  // negative lookahead: skip concatenations like tip: "send" + ...
  for (const m of src.matchAll(/tip:\s*"([\w-]+)"(?!\s*\+)/g)) tipRefs.add(m[1]);
}
for (const key of tipRefs) {
  if (!C.tooltips[key]) fail(`tooltip key "${key}" used in UI but missing from CONTENT.tooltips`);
  else if (!C.tooltips[key].what || !C.tooltips[key].why) fail(`tooltip "${key}" missing what/why`);
}
const unused = Object.keys(C.tooltips).filter((k) => !tipRefs.has(k));
if (unused.length) console.log(`note  unused tooltip keys (harmless): ${unused.join(", ")}`);
ok(`tooltips: ${tipRefs.size} referenced keys all present with what+why`);

/* ── glossary ──────────────────────────────────────────────────────────── */
if (C.glossary.length < 40) fail(`glossary has ${C.glossary.length} terms (< 40)`);
for (const [term, def] of C.glossary) {
  if (!term || !def) fail(`glossary entry "${term}" empty`);
}
ok(`glossary: ${C.glossary.length} terms`);

if (failures) { console.error(`\nvalidate: ${failures} failure(s)`); process.exit(1); }
console.log("\nvalidate: all good");
