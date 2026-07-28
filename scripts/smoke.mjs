#!/usr/bin/env node
/* smoke.mjs — headless run of the app's logic (dearest gate, runs last).
   Zero dependencies: exercises DSP math, full sequencer scheduling of all
   three demo songs (with a stubbed synth), and the WAV encoder. The full
   audio path needs a browser; that is covered manually / pre-merge, not here. */
import { loadSandbox, ENGINE_FILES } from "./mds-sandbox.mjs";

let failures = 0;
const fail = (msg) => { failures++; console.error("FAIL  " + msg); };
const ok = (msg) => console.log("ok    " + msg);
const assert = (cond, msg) => { if (!cond) fail(msg); };

const sandbox = loadSandbox([...ENGINE_FILES, "js/engine/sequencer.js", "js/engine/export.js"]);
const MDS = sandbox.MDS;

/* ── DSP math ──────────────────────────────────────────────────────────── */
const dsp = MDS.dsp;
assert(Math.abs(dsp.midiToFreq(69) - 440) < 1e-9, "midiToFreq(69) !== 440");
assert(dsp.noteName(69) === "A4", `noteName(69) = ${dsp.noteName(69)}`);
for (const key of Object.keys(dsp.KEY_TO_PC)) {
  for (let n = 30; n < 90; n += 7) {
    const s = dsp.snapToScale(n, key);
    const rel = (((s - dsp.KEY_TO_PC[key]) % 12) + 12) % 12;
    assert(dsp.MINOR.includes(rel), `snapToScale(${n}, ${key}) = ${s} not in scale`);
    assert(Math.abs(s - n) <= 2, `snapToScale(${n}, ${key}) moved ${Math.abs(s - n)} semitones`);
  }
}
assert(dsp.distCurve(0.5).length === 2048, "distCurve length");
const crush = dsp.crushCurve(4);
assert(new Set(crush).size <= 17, `crushCurve(4) has ${new Set(crush).size} levels (want ≤ 2^4+1)`);
ok("dsp: tuning, scale lock, curves");

/* ── sequencer scheduling over all demo songs (stubbed synth) ──────────── */
let triggers = 0;
sandbox.MDS.synth = {
  trigger(g, ti, patch, opts) {
    triggers++;
    assert(Number.isFinite(opts.time), "trigger with non-finite time");
    assert(Number.isFinite(opts.dur) && opts.dur > 0, "trigger with bad duration");
    assert(patch && patch.engine, "trigger without patch engine");
    assert(opts.vel > 0 && opts.vel <= 1, `trigger with vel ${opts.vel}`);
  },
};
for (const id of MDS.demos.ids()) {
  const p = MDS.demos.make(id);
  const sDur = 60 / p.bpm / 4;
  const lastNotes = new Array(8).fill(null);
  const before = triggers;
  p.song.forEach((pIdx, bar) => {
    for (let s = 0; s < 16; s++) {
      const t = (bar * 16 + s) * sDur + (s % 2 ? p.swing * sDur * 0.5 : 0);
      MDS.seq.scheduleStep(null, p, pIdx, s, t, sDur, lastNotes);
    }
  });
  const n = triggers - before;
  assert(n >= p.song.length * 4, `demo "${id}" scheduled only ${n} notes over ${p.song.length} bars`);
  ok(`sequencer: demo "${id}" scheduled ${n} notes across ${p.song.length} bars without error`);
}

/* ── note length: cell.len scales the scheduled duration ───────────────── */
{
  const seen = [];
  const stub = sandbox.MDS.synth;
  sandbox.MDS.synth = { trigger: (g, ti, patch, opts) => seen.push(opts) };
  const p = MDS.state.defaultProject();
  const PAD = 6;
  p.patterns[0].steps[PAD][0] = { on: true, acc: false, note: 57, len: 8 };
  p.patterns[0].steps[PAD][8] = { on: true, acc: false, note: 57 };
  const sDur = 60 / p.bpm / 4, gate = p.tracks[PAD].gate;
  for (let s = 0; s < 16; s++) MDS.seq.scheduleStep(null, p, 0, s, s * sDur, sDur, null);
  assert(seen.length === 2, `pad row scheduled ${seen.length} notes (want 2)`);
  assert(Math.abs(seen[0].dur - sDur * gate * 8) < 1e-9, `len:8 note lasted ${seen[0].dur}s`);
  assert(Math.abs(seen[1].dur - sDur * gate) < 1e-9, `note without len lasted ${seen[1].dur}s`);
  // The reason len exists at all: a pad's attack outlives a single 16th.
  assert(seen[0].dur > p.tracks[PAD].patch.a, "held pad note is shorter than its own attack");
  sandbox.MDS.synth = stub;
  ok("sequencer: cell.len scales note duration (a held pad outlasts its attack)");
}

/* ── WAV encoder against a fake AudioBuffer ────────────────────────────── */
const N = 44100;
const chan = new Float32Array(N);
for (let i = 0; i < N; i++) chan[i] = Math.sin((2 * Math.PI * 220 * i) / N);
const fakeBuffer = { numberOfChannels: 2, length: N, sampleRate: 44100, duration: 1, getChannelData: () => chan };
const blob = MDS.exporter.encodeWav(fakeBuffer);
assert(blob.size === 44 + N * 4, `WAV size ${blob.size} (want ${44 + N * 4})`);
const head = Buffer.from(await blob.slice(0, 12).arrayBuffer());
assert(head.toString("ascii", 0, 4) === "RIFF" && head.toString("ascii", 8, 12) === "WAVE", "WAV header magic");
ok("export: WAV encoder produces a valid 16-bit/44.1kHz RIFF");

/* ── filename slugging ─────────────────────────────────────────────────── */
const fn = MDS.exporter.filename({ name: "My Track!!" }, "wav");
assert(/^my-track-\d{8}\.wav$/.test(fn), `filename "${fn}" unexpected`);
ok("export: filenames slug cleanly");

if (failures) { console.error(`\nsmoke: ${failures} failure(s)`); process.exit(1); }
console.log("\nsmoke: all good");
