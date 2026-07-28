/* ============================================================================
   ███ ENGINE ███  sequencer.js — the clock. A lookahead scheduler driven by
   the AudioContext clock (the setInterval below only WAKES the scheduler;
   every note time comes from ctx.currentTime, so there is zero drift).
   scheduleStep() is shared verbatim with the offline export renderer.
   No DOM, no user-facing strings.
   ========================================================================== */
window.MDS = window.MDS || {};

MDS.seq = (function () {
  "use strict";

  const LOOKAHEAD_MS = 25;   // scheduler wake interval
  const AHEAD = 0.12;        // how far ahead notes are booked (s)

  let playing = false;
  let timer = null;
  let nextTime = 0;          // audio-clock time of the next unscheduled step
  let step = 0;              // 0..15
  let songPos = 0;           // index into project.song
  const tickQueue = [];      // {time, step, pIdx, songPos} for the UI playhead
  const lastNotes = new Array(8).fill(null); // per-track, feeds glide

  const ACCENT_VEL = 1.0, NORMAL_VEL = 0.72;

  function stepDur(project) { return 60 / project.bpm / 4; }

  function songBars(project) { return project.song.length; }

  function patternAt(project, sel, mode, pos) {
    if (mode === "song" && project.song.length) return project.song[pos % project.song.length];
    return sel.pattern;
  }

  /* Schedule one step column for all 8 tracks at absolute audio time t.
     Used by the live loop and by export.js against an offline graph. */
  function scheduleStep(g, project, pIdx, stepIdx, t, sDur, lastNotesArr) {
    const pat = project.patterns[pIdx];
    if (!pat) return;
    for (let ti = 0; ti < project.tracks.length; ti++) {
      const tr = project.tracks[ti];
      const cell = pat.steps[ti][stepIdx];
      if (!cell || !cell.on || !tr.patch) continue;
      const vel = cell.acc ? ACCENT_VEL : NORMAL_VEL;
      // A cell holds one note, or several (chords in pads — authored in demo
      // data; the grid UI edits the root. See state.js cell schema.)
      const notes = cell.notes && cell.notes.length ? cell.notes : [cell.note == null ? tr.baseNote : cell.note];
      const gate = tr.patch.engine === "drum" ? 1 : (tr.gate || 0.9);
      const dur = sDur * gate * (cell.len || 1);
      for (const n of notes) {
        MDS.synth.trigger(g, ti, tr.patch, {
          time: t, dur, vel, note: n,
          glideFrom: lastNotesArr ? lastNotesArr[ti] : null,
        });
      }
      if (lastNotesArr) lastNotesArr[ti] = notes[0];
    }
  }

  function loop() {
    const audio = MDS.state.audio;
    if (!audio) return;
    const ctx = audio.ctx, g = audio.graph;
    const project = MDS.state.project, sel = MDS.state.sel;
    const now = ctx.currentTime;
    while (nextTime < now + AHEAD) {
      const sDur = stepDur(project);
      const pIdx = patternAt(project, sel, MDS.state.playMode, songPos);
      // Swing: every second 16th lands late by up to half a step.
      const t = nextTime + (step % 2 === 1 ? project.swing * sDur * 0.5 : 0);
      scheduleStep(g, project, pIdx, step, t, sDur, lastNotes);
      tickQueue.push({ time: nextTime, step, pIdx, songPos });
      step++;
      if (step === 16) {
        step = 0;
        if (MDS.state.playMode === "song" && project.song.length) {
          songPos = (songPos + 1) % project.song.length; // song loops
        }
      }
      nextTime += sDur;
    }
  }

  function start() {
    if (playing) return;
    const ctx = MDS.state.audio.ctx;
    playing = true;
    step = 0; songPos = 0;
    lastNotes.fill(null);
    tickQueue.length = 0;
    nextTime = ctx.currentTime + 0.06;
    loop();
    timer = setInterval(loop, LOOKAHEAD_MS);
    MDS.bus.emit("transport");
  }

  function stop() {
    if (!playing) return;
    playing = false;
    clearInterval(timer); timer = null;
    tickQueue.length = 0;
    MDS.bus.emit("transport");
  }

  function toggle() { playing ? stop() : start(); }

  /* UI playhead support: hand over all ticks whose audio time has passed. */
  function drainTicks(now) {
    const due = [];
    while (tickQueue.length && tickQueue[0].time <= now) due.push(tickQueue.shift());
    return due;
  }

  return {
    get playing() { return playing; },
    get songPos() { return songPos; },
    start, stop, toggle, drainTicks,
    scheduleStep, stepDur, songBars,
  };
})();
