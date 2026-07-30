/* ============================================================================
   ███ ENGINE / STATE ███  state.js — the in-memory project model + audio
   bootstrap + a tiny event bus. NOTE: per spec there is NO localStorage /
   sessionStorage anywhere — persistence is the project-file export in the
   EXPORT dialog. No DOM here beyond AudioContext creation.

   PATTERN CELL SCHEMA (patterns[p].steps[track][step]):
     { on:bool, acc:bool, note:midi|null, notes:[midi]|undefined, len:number|undefined }
     - note:  the cell's pitch (melodic tracks; drums ignore it)
     - notes: optional chord (pads in demo data); UI edits `note`, engine
       plays `notes` when present
     - len:   note length in steps (default 1; pads hold e.g. 16)
   ========================================================================== */
window.MDS = window.MDS || {};

/* Minimal pub/sub so ENGINE and UI stay decoupled. */
MDS.bus = (function () {
  const subs = {};
  return {
    on(ev, fn) { (subs[ev] = subs[ev] || []).push(fn); },
    emit(ev, data) { (subs[ev] || []).forEach((fn) => fn(data)); },
  };
})();

MDS.state = (function () {
  "use strict";

  /* Fixed track slots. Any library sound can be assigned to any slot; these
     are the defaults and the row identities (names via CONTENT.tracks). */
  const TRACK_DEFS = [
    { key: "kick", sound: "kick808", baseNote: 36, gate: 1 },
    { key: "snare", sound: "snare909", baseNote: 38, gate: 1 },
    { key: "hat", sound: "hatC", baseNote: 42, gate: 1 },
    { key: "perc", sound: "clap909", baseNote: 39, gate: 1 },
    { key: "bass", sound: "bassNail", baseNote: 33, gate: 0.85 },
    { key: "lead", sound: "stabBrass", baseNote: 57, gate: 0.9 },
    { key: "pad", sound: "padWarm", baseNote: 57, gate: 0.98 },
    { key: "arp", sound: "leadCold", baseNote: 69, gate: 0.6 },
  ];

  function emptyCell() { return { on: false, acc: false, note: null }; }
  function emptyPattern() {
    return { steps: TRACK_DEFS.map(() => Array.from({ length: 16 }, emptyCell)) };
  }

  function makeTrack(def) {
    return {
      key: def.key,
      soundId: def.sound,
      patch: MDS.lib.materialize(def.sound),
      baseNote: def.baseNote,
      gate: def.gate,
      level: 0.8, mute: false, solo: false,
      sends: { dist: 0, chorus: 0, delay: 0, verb: 0, crush: 0 },
    };
  }

  function defaultProject() {
    return {
      name: "untitled",
      bpm: 120,
      swing: 0,
      key: "A",           // musical defaults: minor key, 100–130 BPM
      scaleLock: true,
      tracks: TRACK_DEFS.map(makeTrack),
      patterns: Array.from({ length: 8 }, emptyPattern),
      song: [],
      fx: {
        dist: { drive: 0.55, tone: 0.5, level: 0.35 },
        chorus: { rate: 0.15, depth: 0.4, level: 0.5 },
        delay: { div: "3/16", fb: 0.38, tone: 0.45, level: 0.5 },
        verb: { size: 0.55, tone: 0.4, level: 0.5 },
        crush: { bits: 8, level: 0.4 },
      },
      master: { comp: 0.4, vol: 0.9 },
    };
  }

  const state = {
    project: defaultProject(),
    playMode: "pattern", // 'pattern' | 'song'
    tipsOn: true,        // hover/alt help text (session pref; app keeps no storage)
    /* IMPORTED SAMPLES: [{id, name, mime, data(base64), secs}]. Deliberately
       OUTSIDE `project`: undo snapshots stringify the project on every
       gesture, and megabytes of base64 in every snapshot would make both
       the diff and the stack explode. Samples ride along in the project
       FILE only (toJSON/loadJSON below) and are not undoable. */
    samples: [],
    sel: {
      track: 4,          // start on BASS — the genre's front door
      pattern: 0,
      // LAST CHOSEN NOTE, PER TRACK: the note new melodic steps on that row
      // get. Written by the keyboard and by wheeling a step. Sparse on
      // purpose: a row nobody has chosen on yet follows its sound's own base
      // note, so a fresh pad row starts in pad register, not wherever the
      // bass was. See state.entryNote()/setEntryNote() below.
      entryNotes: {},
      octave: 0,         // keyboard octave shift
    },
    clipboard: null,     // copied pattern
    audio: null,         // { ctx, graph } once powered on
  };

  /* Create/resume the live AudioContext after the first user gesture. */
  state.ensureAudio = function () {
    if (!state.audio) {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const graph = MDS.graph.build(ctx);
      MDS.graph.apply(graph, state.project);
      state.audio = { ctx, graph };
      state.hydrateBuffers();
    }
    if (state.audio.ctx.state === "suspended") state.audio.ctx.resume();
    return state.audio;
  };

  /* Fill in the AudioBuffer of any sample-backed track patch that lacks one
     (project opened before power-on, undo snapshot restored, etc.). */
  state.hydrateBuffers = function () {
    if (!state.audio) return;
    for (const tr of state.project.tracks) {
      const p = tr.patch;
      if (!p || p.engine !== "buffer" || (p.buffer && p.buffer.length)) continue;
      const id = p._pendingId || tr.soundId;
      MDS.lib.resolve(state.audio.ctx, id)
        .then((buf) => { p.buffer = buf; })
        .catch(() => { p.buffer = null; }); // sample gone: row degrades to silence
    }
  };

  /* ── Note entry ────────────────────────────────────────────────────────
     One owner for "which note does a new step get". Every path that lets the
     user pick a pitch (keyboard, wheel) calls setEntryNote; every path that
     writes a step calls entryNote. Keep it that way or the rows quietly stop
     remembering. */
  state.entryNote = function (trackIdx) {
    const chosen = state.sel.entryNotes[trackIdx];
    if (chosen != null) return chosen;
    const tr = state.project.tracks[trackIdx];
    return tr ? tr.baseNote : 60;
  };
  state.setEntryNote = function (trackIdx, note) {
    state.sel.entryNotes[trackIdx] = note;
  };

  state.applyAudio = function () {
    if (state.audio) MDS.graph.apply(state.audio.graph, state.project);
  };
  state.applyMixer = function () {
    if (state.audio) MDS.graph.applyMixer(state.audio.graph, state.project);
  };

  /* ── Imported samples ─────────────────────────────────────────────────
     One owner for the sample list: every import/remove goes through here so
     the library registry and the saved project file never drift apart.
     rec: { name, mime, data(base64), secs }. Returns the registered record. */
  let sampleSeq = 0;
  function sampleEntry(rec) {
    return {
      id: rec.id, name: rec.name, category: "user", tags: ["sample"],
      baseNote: 60, // repitched around middle C by the buffer voice
      source: { type: "base64", mime: rec.mime, data: rec.data },
    };
  }
  state.addSample = function (rec) {
    sampleSeq++;
    const r = { id: "u" + sampleSeq, name: rec.name || ("sample " + sampleSeq),
      mime: rec.mime || "audio/*", data: rec.data, secs: rec.secs || 0 };
    state.samples.push(r);
    MDS.lib.registerUser(sampleEntry(r));
    return r;
  };
  state.removeSample = function (id) {
    const i = state.samples.findIndex((s) => s.id === id);
    if (i < 0) return;
    state.samples.splice(i, 1);
    MDS.lib.unregisterUser(id);
  };
  function registerSamples(list) {
    for (const s of state.samples) MDS.lib.unregisterUser(s.id);
    state.samples = list || [];
    for (const s of state.samples) {
      MDS.lib.registerUser(sampleEntry(s));
      const n = parseInt(String(s.id).slice(1), 10);
      if (n > sampleSeq) sampleSeq = n; // new imports must not collide
    }
  }

  /* Assign a library sound to a track (deep copy; async fill for buffers). */
  state.assignSound = function (trackIdx, soundId) {
    const tr = state.project.tracks[trackIdx];
    tr.soundId = soundId;
    tr.patch = MDS.lib.materialize(soundId);
    const entry = MDS.lib.get(soundId);
    if (entry && entry.baseNote != null) tr.baseNote = entry.baseNote;
    if (tr.patch && tr.patch.engine === "buffer" && state.audio) {
      // Capture the patch object: re-reading tr.patch at resolve time would
      // let a slow decode overwrite whatever sound was assigned meanwhile.
      const p = tr.patch;
      MDS.lib.resolve(state.audio.ctx, soundId).then((buf) => { p.buffer = buf; });
    }
    MDS.bus.emit("patch");
  };

  /* ── Randomizer ───────────────────────────────────────────────────────
     Rolls a new patch for a track, in place. The ranges below are wider than
     the library's own taste (very dark or very bright filters, slow attacks,
     inharmonic FM ratios, hard drive) so a roll can genuinely surprise, but
     they stay inside what the voice can render: gain never reaches zero or
     clipping territory, and engine/kind are never rewritten, so a KICK row
     stays a kick. Deliberately DOM-free: the check scripts roll it headlessly. */
  const rnd = (a, b) => a + Math.random() * (b - a);
  const rndExp = (a, b) => a * Math.pow(b / a, Math.random());
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const chance = (p) => Math.random() < p;

  // Repeats are the weighting: the house sound is saws and pulses.
  const WAVES = ["sawtooth", "sawtooth", "sawtooth", "pulse", "pulse", "square", "triangle", "sine"];
  const SEMIS = [-24, -12, -12, -12, -7, -5, 0, 0, 0, 7, 12, 12, 19];
  const RATIOS = [0.5, 1, 1.5, 2, 2.01, 2.5, 3, 3.5, 4, 5, 5.43, 7, 9, 11];

  function rollPatch(patch) {
    if (!patch) return patch;
    switch (patch.engine) {
      case "sub":
        patch.osc1 = pick(WAVES); patch.osc2 = pick(WAVES);
        patch.semi = pick(SEMIS);
        patch.detune = rnd(0, 28);
        patch.mix = rnd(0.15, 0.85);
        patch.glide = chance(0.7) ? 0 : rnd(0.01, 0.18);
        patch.cutoff = rndExp(120, 9000);
        patch.res = rnd(0.3, 15);
        patch.envAmt = rnd(0, 5200);
        patch.fDec = rndExp(0.03, 1.4);
        patch.a = rndExp(0.002, 1.1);
        patch.d = rndExp(0.04, 1.4);
        patch.s = rnd(0, 0.9);
        patch.r = rndExp(0.02, 1.6);
        patch.drive = chance(0.35) ? 0 : rnd(0.05, 0.85);
        patch.gain = rnd(0.35, 0.85);
        break;
      case "fm":
        patch.ratio = pick(RATIOS);
        patch.index = rnd(0.3, 11);
        patch.iDec = rndExp(0.04, 1.2);
        patch.a = rndExp(0.002, 0.9);
        patch.d = rndExp(0.04, 1.4);
        patch.s = rnd(0, 0.85);
        patch.r = rndExp(0.02, 1.4);
        patch.gain = rnd(0.4, 0.8);
        break;
      case "pluck":
        patch.decay = rnd(0.05, 1);
        patch.bright = rnd(0, 1);
        patch.pick = rnd(0, 1);
        patch.body = rnd(0, 1);
        patch.drive = chance(0.45) ? 0 : rnd(0.05, 0.9);
        patch.gain = rnd(0.45, 0.9);
        break;
      case "drum":
        patch.dTune = rnd(0.55, 1.9);
        patch.dDecay = rnd(0.05, 1);
        patch.dTone = rnd(0, 1);
        patch.dDrive = chance(0.3) ? 0 : rnd(0.05, 0.9);
        patch.gain = rnd(0.6, 1.05);
        break;
      case "buffer":
        patch.dTune = rnd(0.6, 1.6);
        patch.gain = rnd(0.6, 1);
        break;
    }
    return patch;
  }

  /* Roll the patch on one track. Returns it so the UI can audition the result. */
  state.randomizePatch = function (trackIdx) {
    const tr = state.project.tracks[trackIdx];
    if (!tr || !tr.patch) return null;
    rollPatch(tr.patch);
    MDS.bus.emit("patch");
    return tr.patch;
  };

  /* ── Persistence (file-based; see EXPORT dialog) ──
     Imported samples travel inside the project file (there is nowhere else:
     the app keeps no storage) but outside `project`, so undo stays light. */
  state.toJSON = function () {
    return JSON.stringify({ v: 1, project: state.project, samples: state.samples }, null, 1);
  };

  state.loadJSON = function (text) {
    const data = JSON.parse(text);
    if (!data || data.v !== 1 || !data.project) throw new Error("bad-project-file");
    registerSamples(data.samples || []);
    state.loadProject(data.project);
  };

  /* Replace the project (from file or demo). Rebuilds patches defensively so
     old/foreign files can't inject broken shapes silently. */
  state.loadProject = function (p, opts) {
    const base = defaultProject();
    const proj = Object.assign(base, p);
    // fx/master need the same defensive treatment as tracks below: the top
    // level Object.assign replaces them wholesale, so a partial object from
    // an old or hand-edited file would crash graph.apply later.
    const fresh = defaultProject();
    proj.fx = {};
    for (const k of Object.keys(fresh.fx)) {
      proj.fx[k] = Object.assign(fresh.fx[k], (p.fx || {})[k] || {});
    }
    proj.master = Object.assign(fresh.master, p.master || {});
    proj.tracks = base.tracks.map((bt, i) => {
      const src = (p.tracks && p.tracks[i]) || {};
      const t = Object.assign(bt, src);
      t.sends = Object.assign({ dist: 0, chorus: 0, delay: 0, verb: 0, crush: 0 }, src.sends || {});
      if (!t.patch) t.patch = MDS.lib.materialize(t.soundId);
      // An AudioBuffer never survives JSON (undo snapshot or project file):
      // it stringifies to {}. Re-take it from the decode cache, keeping the
      // user's knob values from the serialized patch.
      if (t.patch && t.patch.engine === "buffer") {
        const fresh = MDS.lib.materialize(t.soundId);
        if (fresh && fresh.engine === "buffer") {
          const saved = t.patch;
          t.patch = Object.assign(fresh, saved, { buffer: fresh.buffer, _pendingId: fresh._pendingId });
        } else {
          t.patch.buffer = null; // sample no longer registered
        }
      }
      return t;
    });
    while (proj.patterns.length < 8) proj.patterns.push(emptyPattern());
    state.project = proj;
    // keepView: an undo step restores the music, not where you were looking
    // (and not the notes you had chosen per row, which outlive the edit)
    if (!opts || !opts.keepView) {
      state.sel.pattern = 0;
      state.sel.entryNotes = {};   // different song, different instruments
      state.playMode = proj.song.length ? "song" : "pattern";
    }
    state.applyAudio();
    state.hydrateBuffers();
    MDS.bus.emit("project");
  };

  state.newProject = function () { state.loadProject(defaultProject()); };

  state.TRACK_DEFS = TRACK_DEFS;
  state.emptyPattern = emptyPattern;
  state.defaultProject = defaultProject;
  state.rollPatch = rollPatch;   // exposed for the check scripts
  return state;
})();

/* ============================================================================
   UNDO / REDO. Entries are whole-project JSON snapshots: the project is a few
   tens of KB, and copying all of it sidesteps the classic undo bug where a
   half-recorded edit restores into a state it was never taken from.
   mark() is a no-op when nothing actually changed, so the UI can fire it after
   any gesture without deciding first whether that gesture was an edit.
   No DOM here: the triggers (buttons, hotkeys, gesture ends) live in main.js.
   ========================================================================== */
MDS.history = (function () {
  "use strict";
  const LIMIT = 60;          // entries; the oldest edits fall off the bottom
  let stack = [], idx = -1, last = "";

  function view() {
    return { pattern: MDS.state.sel.pattern, track: MDS.state.sel.track };
  }

  /* Record the current project as a new entry. Returns true if it was one. */
  function mark() {
    const json = JSON.stringify(MDS.state.project);
    if (json === last) return false;
    stack = stack.slice(0, idx + 1);      // a fresh edit drops the redo tail
    stack.push({ json, sel: view() });
    if (stack.length > LIMIT) stack.shift();
    idx = stack.length - 1;
    last = json;
    MDS.bus.emit("history");
    return true;
  }

  /* Restoring emits "project", which the UI answers with a mark(); setting
     `last` first is what makes that mark a no-op instead of a new entry. */
  function apply(entry) {
    last = entry.json;
    MDS.state.loadProject(JSON.parse(entry.json), { keepView: true });
    MDS.state.sel.pattern = entry.sel.pattern;
    MDS.state.sel.track = entry.sel.track;
    MDS.bus.emit("sel");
    MDS.bus.emit("history");
  }

  function undo() { if (idx <= 0) return false; apply(stack[--idx]); return true; }
  function redo() { if (idx >= stack.length - 1) return false; apply(stack[++idx]); return true; }
  function reset() { stack = []; idx = -1; last = ""; mark(); }

  return {
    mark, undo, redo, reset,
    get canUndo() { return idx > 0; },
    get canRedo() { return idx < stack.length - 1; },
    get depth() { return stack.length; },
  };
})();
