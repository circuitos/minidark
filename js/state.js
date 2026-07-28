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
    sel: {
      track: 4,          // start on BASS — the genre's front door
      pattern: 0,
      entryNote: 45,     // note written into new melodic steps (A2)
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
    }
    if (state.audio.ctx.state === "suspended") state.audio.ctx.resume();
    return state.audio;
  };

  state.applyAudio = function () {
    if (state.audio) MDS.graph.apply(state.audio.graph, state.project);
  };
  state.applyMixer = function () {
    if (state.audio) MDS.graph.applyMixer(state.audio.graph, state.project);
  };

  /* Assign a library sound to a track (deep copy; async fill for buffers). */
  state.assignSound = function (trackIdx, soundId) {
    const tr = state.project.tracks[trackIdx];
    tr.soundId = soundId;
    tr.patch = MDS.lib.materialize(soundId);
    const entry = MDS.lib.get(soundId);
    if (entry && entry.baseNote != null) tr.baseNote = entry.baseNote;
    if (tr.patch && tr.patch.engine === "buffer" && state.audio) {
      MDS.lib.resolve(state.audio.ctx, soundId).then((buf) => { tr.patch.buffer = buf; });
    }
    MDS.bus.emit("patch");
  };

  /* ── Persistence (file-based; see EXPORT dialog) ── */
  state.toJSON = function () {
    return JSON.stringify({ v: 1, project: state.project }, null, 1);
  };

  state.loadJSON = function (text) {
    const data = JSON.parse(text);
    if (!data || data.v !== 1 || !data.project) throw new Error("bad-project-file");
    state.loadProject(data.project);
  };

  /* Replace the project (from file or demo). Rebuilds patches defensively so
     old/foreign files can't inject broken shapes silently. */
  state.loadProject = function (p) {
    const base = defaultProject();
    const proj = Object.assign(base, p);
    proj.tracks = base.tracks.map((bt, i) => {
      const src = (p.tracks && p.tracks[i]) || {};
      const t = Object.assign(bt, src);
      t.sends = Object.assign({ dist: 0, chorus: 0, delay: 0, verb: 0, crush: 0 }, src.sends || {});
      if (!t.patch) t.patch = MDS.lib.materialize(t.soundId);
      return t;
    });
    while (proj.patterns.length < 8) proj.patterns.push(emptyPattern());
    state.project = proj;
    state.sel.pattern = 0;
    state.playMode = proj.song.length ? "song" : "pattern";
    state.applyAudio();
    MDS.bus.emit("project");
  };

  state.newProject = function () { state.loadProject(defaultProject()); };

  state.TRACK_DEFS = TRACK_DEFS;
  state.emptyPattern = emptyPattern;
  state.defaultProject = defaultProject;
  return state;
})();
