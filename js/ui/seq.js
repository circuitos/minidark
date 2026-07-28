/* ============================================================================
   ███ UI ███  seq.js — transport bar, 8×16 step grid, pattern bank, song
   chain editor, and the rAF playhead fed by the engine's tick queue.
   All strings from CONTENT, all styling via tokens/semantic classes.
   ========================================================================== */
window.MDS = window.MDS || {};
MDS.ui = MDS.ui || {};

MDS.ui.seq = (function () {
  "use strict";
  const C = () => MDS.CONTENT;
  const S = () => MDS.state;

  let els = {};       // named DOM handles
  let cells = [];     // cells[track][step]
  let lastPlayCol = -1;

  /* ── Transport ─────────────────────────────────────────────────────── */
  function buildTransport(root) {
    const c = C().transport;
    root.className = "transport";

    const play = document.createElement("button");
    play.className = "t-btn"; play.dataset.tt = "play";
    const playIcon = document.createElement("span");
    playIcon.className = "t-icon";
    const playLabel = document.createElement("span");
    playLabel.textContent = c.play;
    play.append(playIcon, playLabel);
    play.onclick = () => { S().ensureAudio(); MDS.seq.toggle(); };
    els.play = play; els.playLabel = playLabel;

    const pos = document.createElement("span");
    pos.className = "pos-readout"; els.pos = pos;

    /* Global output level plus the live VU, grouped at the right end of the
       transport so level and metering read together. */
    const vol = MDS.ui.fader({
      label: C().fx.mVol, tip: "mVol",
      min: 0, max: 1, value: S().project.master.vol,
      fmt: (v) => Math.round(v * 100) + "%",
      onInput: (v) => { S().project.master.vol = v; S().applyAudio(); MDS.bus.emit("master"); },
    });
    els.masterVol = vol;
    const outGroup = document.createElement("div");
    outGroup.className = "out-group";
    outGroup.appendChild(vol.el);
    if (MDS.ui.meter) outGroup.appendChild(MDS.ui.meter.create({ compact: true }));

    const tempo = MDS.ui.knob({
      label: c.tempo, tip: "tempo", min: 60, max: 180, value: S().project.bpm,
      fmt: (v) => Math.round(v) + " BPM",
      onInput: (v) => { S().project.bpm = Math.round(v); S().applyAudio(); },
    });
    els.tempo = tempo;

    const swing = MDS.ui.knob({
      label: c.swing, tip: "swing", min: 0, max: 0.6, value: S().project.swing,
      fmt: (v) => Math.round(v * 100) + "%",
      onInput: (v) => { S().project.swing = v; },
    });
    els.swing = swing;

    const keyWrap = document.createElement("label");
    keyWrap.className = "tbgroup"; keyWrap.dataset.tt = "key";
    const keyLbl = document.createElement("span"); keyLbl.textContent = c.key;
    const keySel = document.createElement("select");
    for (const k of Object.keys(MDS.dsp.KEY_TO_PC)) {
      const o = document.createElement("option"); o.value = k; o.textContent = k + "m";
      keySel.appendChild(o);
    }
    keySel.value = S().project.key;
    keySel.onchange = () => { S().project.key = keySel.value; MDS.bus.emit("sel"); };
    keyWrap.append(keyLbl, keySel);
    els.keySel = keySel;

    const lock = document.createElement("button");
    lock.dataset.tt = "scaleLock"; lock.textContent = c.scaleLock;
    const syncLock = () => lock.classList.toggle("is-on", S().project.scaleLock);
    lock.onclick = () => { S().project.scaleLock = !S().project.scaleLock; syncLock(); MDS.bus.emit("sel"); };
    els.lockBtn = lock; els.syncLock = syncLock;

    const modeWrap = document.createElement("span");
    modeWrap.className = "tbgroup"; modeWrap.dataset.tt = "mode";
    const mPat = document.createElement("button"); mPat.textContent = c.modePattern;
    const mSong = document.createElement("button"); mSong.textContent = c.modeSong;
    const syncMode = () => {
      mPat.classList.toggle("is-on", S().playMode === "pattern");
      mSong.classList.toggle("is-on", S().playMode === "song");
    };
    mPat.onclick = () => { S().playMode = "pattern"; syncMode(); };
    mSong.onclick = () => { S().playMode = "song"; syncMode(); };
    modeWrap.append(mPat, mSong);
    els.syncMode = syncMode;

    const spacer = document.createElement("span");
    spacer.className = "grow";
    /* Grouped into equal-height cells with hairline separators so every
       control sits on one rhythm instead of floating at its own height. */
    const cell = (...kids) => {
      const d = document.createElement("div");
      d.className = "tp-cell";
      d.append(...kids);
      return d;
    };
    root.append(
      cell(play, pos),
      cell(tempo.el, swing.el),
      cell(keyWrap, lock),
      cell(modeWrap),
      spacer,
      outGroup
    );
    syncLock(); syncMode();
  }

  /* ── Step grid ─────────────────────────────────────────────────────── */
  function trackIsMelodic(ti) {
    const p = S().project.tracks[ti].patch;
    return p && p.engine !== "drum";
  }

  function buildGrid(root) {
    root.innerHTML = "";
    root.className = "seq-box";

    const head = document.createElement("div");
    head.className = "seq-head";
    const title = document.createElement("h3"); title.textContent = C().seq.patterns;
    const bank = document.createElement("div");
    bank.className = "pat-bank"; bank.dataset.tt = "patternBank";
    els.bankBtns = [];
    for (let i = 0; i < 8; i++) {
      const b = document.createElement("button");
      b.textContent = String(i + 1);
      b.onclick = () => { S().sel.pattern = i; MDS.bus.emit("sel"); };
      bank.appendChild(b); els.bankBtns.push(b);
    }
    const cp = document.createElement("button"); cp.textContent = C().seq.copy; cp.dataset.tt = "patCopy";
    cp.onclick = () => { S().clipboard = JSON.parse(JSON.stringify(S().project.patterns[S().sel.pattern])); };
    const pst = document.createElement("button"); pst.textContent = C().seq.paste; pst.dataset.tt = "patPaste";
    pst.onclick = () => {
      if (!S().clipboard) return;
      S().project.patterns[S().sel.pattern] = JSON.parse(JSON.stringify(S().clipboard));
      MDS.bus.emit("pattern");
    };
    const clr = document.createElement("button"); clr.textContent = C().seq.clear; clr.dataset.tt = "patClear";
    clr.onclick = () => { S().project.patterns[S().sel.pattern] = S().emptyPattern(); MDS.bus.emit("pattern"); };
    /* Same cell rhythm as the transport: label, bank, edit actions. */
    const hCell = (...kids) => {
      const d = document.createElement("div");
      d.className = "hd-cell";
      d.append(...kids);
      return d;
    };
    head.append(hCell(title), hCell(bank), hCell(cp, pst, clr));

    const scroll = document.createElement("div");
    scroll.className = "grid-scroll";
    const grid = document.createElement("div");
    grid.className = "grid"; grid.dataset.tt = "stepGrid";
    cells = [];
    els.rowHeads = [];
    for (let ti = 0; ti < 8; ti++) {
      const row = document.createElement("div");
      row.className = "grid-row";
      row.style.setProperty("--row-hue", `var(--track-${ti})`);

      const rh = document.createElement("div");
      rh.className = "row-head"; rh.dataset.tt = "trackSelect";
      const led = document.createElement("span"); led.className = "led";
      const nm = document.createElement("span");
      nm.textContent = C().tracks[S().TRACK_DEFS[ti].key];
      const mute = document.createElement("button");
      mute.className = "mini"; mute.textContent = C().mixer.mute; mute.dataset.tt = "trackMuteMini";
      mute.onclick = (e) => { e.stopPropagation(); const t = S().project.tracks[ti]; t.mute = !t.mute; S().applyMixer(); MDS.bus.emit("mix"); };
      const solo = document.createElement("button");
      solo.className = "mini"; solo.textContent = C().mixer.solo; solo.dataset.tt = "trackMuteMini";
      solo.onclick = (e) => { e.stopPropagation(); const t = S().project.tracks[ti]; t.solo = !t.solo; S().applyMixer(); MDS.bus.emit("mix"); };
      rh.append(led, nm, mute, solo);
      rh.onclick = () => {
        S().sel.track = ti;
        S().sel.entryNote = S().project.tracks[ti].baseNote;
        MDS.bus.emit("sel");
      };
      els.rowHeads.push({ rh, mute, solo });
      row.appendChild(rh);

      const rowCells = [];
      for (let si = 0; si < 16; si++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        if (si % 4 === 0 && si !== 0) cell.dataset.beat = "1";
        cell.onclick = () => toggleCell(ti, si);
        cell.oncontextmenu = (e) => { e.preventDefault(); accentCell(ti, si); };
        cell.onwheel = (e) => { e.preventDefault(); nudgeNote(ti, si, e.deltaY < 0 ? 1 : -1); };
        row.appendChild(cell);
        rowCells.push(cell);
      }
      cells.push(rowCells);
      grid.appendChild(row);
    }
    scroll.appendChild(grid);

    /* Per-column step LEDs above the grid, aligned to the cell rhythm. */
    const leds = document.createElement("div");
    leds.className = "col-leds";
    els.colLeds = [];
    for (let si = 0; si < 16; si++) {
      const d = document.createElement("span");
      d.className = "col-led";
      if (si % 4 === 0) d.dataset.beat = "1";
      if (si % 4 === 0 && si !== 0) d.dataset.gap = "1";
      leds.appendChild(d); els.colLeds.push(d);
    }
    scroll.insertBefore(leds, grid);

    const help = document.createElement("div");
    help.className = "seq-help";
    help.textContent = C().seq.help;

    root.append(head, scroll, help);
  }

  function cellAt(ti, si) { return S().project.patterns[S().sel.pattern].steps[ti][si]; }

  function toggleCell(ti, si) {
    const cell = cellAt(ti, si);
    cell.on = !cell.on;
    if (cell.on && trackIsMelodic(ti) && cell.note == null) {
      const raw = ti === S().sel.track ? S().sel.entryNote : S().project.tracks[ti].baseNote;
      cell.note = maybeSnap(raw);
    }
    MDS.bus.emit("pattern");
  }

  function accentCell(ti, si) {
    const cell = cellAt(ti, si);
    if (!cell.on) { toggleCell(ti, si); }
    cell.acc = !cell.acc;
    MDS.bus.emit("pattern");
  }

  function nudgeNote(ti, si, dir) {
    if (!trackIsMelodic(ti)) return;
    const cell = cellAt(ti, si);
    if (!cell.on) return;
    let n = (cell.note == null ? S().project.tracks[ti].baseNote : cell.note) + dir;
    if (S().project.scaleLock) {
      // step through scale tones, not semitones
      let guard = 0;
      while (MDS.dsp.snapToScale(n, S().project.key) !== n && guard++ < 12) n += dir;
    }
    cell.note = Math.max(21, Math.min(108, n));
    if (cell.notes) delete cell.notes; // editing the root dissolves authored chords
    MDS.bus.emit("pattern");
  }

  function maybeSnap(n) {
    return S().project.scaleLock ? MDS.dsp.snapToScale(n, S().project.key) : n;
  }

  function refreshGrid() {
    const pat = S().project.patterns[S().sel.pattern];
    for (let ti = 0; ti < 8; ti++) {
      const tr = S().project.tracks[ti];
      const heads = els.rowHeads[ti];
      heads.rh.classList.toggle("is-sel", S().sel.track === ti);
      heads.mute.classList.toggle("is-on", tr.mute);
      heads.solo.classList.toggle("is-on", tr.solo);
      for (let si = 0; si < 16; si++) {
        const cell = pat.steps[ti][si];
        const el = cells[ti][si];
        el.classList.toggle("is-on", !!cell.on);
        el.classList.toggle("is-accent", !!(cell.on && cell.acc));
        if (cell.on && trackIsMelodic(ti) && cell.note != null) {
          el.textContent = MDS.dsp.noteName(cell.note) + (cell.notes && cell.notes.length > 1 ? "+" : "");
        } else el.textContent = "";
      }
    }
    for (let i = 0; i < 8; i++) els.bankBtns[i].classList.toggle("is-cur", S().sel.pattern === i);
  }

  /* ── Song chain ────────────────────────────────────────────────────── */
  function buildSong(root) {
    root.innerHTML = "";
    root.className = "seq-box song-box";
    const head = document.createElement("div");
    head.className = "song-head";
    const title = document.createElement("h3"); title.textContent = C().seq.songTitle;
    const add = document.createElement("button"); add.textContent = C().seq.songAdd; add.dataset.tt = "songAdd";
    add.onclick = () => { S().project.song.push(S().sel.pattern); MDS.bus.emit("song"); };
    const clear = document.createElement("button"); clear.textContent = C().seq.songClear; clear.dataset.tt = "songClear";
    clear.onclick = () => { S().project.song.length = 0; MDS.bus.emit("song"); };
    const len = document.createElement("span"); len.className = "seq-help"; els.songLen = len;
    const hint = document.createElement("span");
    hint.className = "seq-help is-right"; hint.textContent = C().seq.chipRemove;
    const sCell = (...kids) => {
      const d = document.createElement("div");
      d.className = "hd-cell";
      d.append(...kids);
      return d;
    };
    head.append(sCell(title), sCell(add, clear), sCell(len), hint);
    const chain = document.createElement("div");
    chain.className = "chain"; chain.dataset.tt = "songChain";
    els.chain = chain;
    root.append(head, chain);
  }

  function refreshSong() {
    const song = S().project.song;
    els.chain.innerHTML = "";
    if (!song.length) {
      const e = document.createElement("span"); e.className = "seq-help";
      e.textContent = C().seq.songEmpty;
      els.chain.appendChild(e);
    }
    song.forEach((pIdx, i) => {
      const chip = document.createElement("span");
      chip.className = "chip"; chip.textContent = String(pIdx + 1);
      chip.title = C().seq.chipRemove;
      chip.onclick = (e) => {
        // shift-click duplicates this slot in place; plain click removes it
        if (e.shiftKey) song.splice(i + 1, 0, pIdx);
        else song.splice(i, 1);
        MDS.bus.emit("song");
      };
      els.chain.appendChild(chip);
    });
    const secs = Math.round(song.length * 16 * MDS.seq.stepDur(S().project));
    els.songLen.textContent = C().seq.songLen(song.length, secs);
  }

  /* ── Playhead (rAF drains the engine's tick queue) ─────────────────── */
  function raf() {
    requestAnimationFrame(raf);
    els.playLabel.textContent = MDS.seq.playing ? C().transport.stop : C().transport.play;
    els.play.classList.toggle("is-playing", MDS.seq.playing);
    if (!MDS.seq.playing) {
      if (lastPlayCol >= 0) { clearPlayCol(); lastPlayCol = -1; }
      return;
    }
    const audio = S().audio;
    if (!audio) return;
    const ticks = MDS.seq.drainTicks(audio.ctx.currentTime);
    if (!ticks.length) return;
    const t = ticks[ticks.length - 1];
    MDS.bus.emit("tick", t);
    els.pos.textContent = `${C().transport.posBar} ${t.songPos + 1} · ${C().transport.posStep} ${t.step + 1}`;
    // playhead column (only when the playing pattern is the one on screen)
    clearPlayCol();
    const showing = S().sel.pattern;
    if (S().playMode === "pattern" || t.pIdx === showing) {
      for (let ti = 0; ti < 8; ti++) cells[ti][t.step].classList.add("is-play");
      lastPlayCol = t.step;
    }
    if (els.colLeds) {
      for (let si = 0; si < 16; si++) els.colLeds[si].classList.toggle("is-lit", si === t.step);
    }
    for (let i = 0; i < 8; i++) els.bankBtns[i].classList.toggle("is-live", MDS.seq.playing && t.pIdx === i);
    // highlight current song chip
    if (S().playMode === "song") {
      const chips = els.chain.querySelectorAll(".chip");
      chips.forEach((ch, i) => ch.classList.toggle("is-play", i === t.songPos));
    }
  }

  function clearPlayCol() {
    if (els.colLeds) els.colLeds.forEach((d) => d.classList.remove("is-lit"));
    if (lastPlayCol < 0) return;
    for (let ti = 0; ti < 8; ti++) cells[ti][lastPlayCol].classList.remove("is-play");
  }

  /* ── Public init ───────────────────────────────────────────────────── */
  function init(transportRoot, gridRoot, songRoot) {
    buildTransport(transportRoot);
    buildGrid(gridRoot);
    buildSong(songRoot);
    refreshGrid(); refreshSong();

    MDS.bus.on("sel", () => { refreshGrid(); els.syncLock(); });
    MDS.bus.on("pattern", refreshGrid);
    MDS.bus.on("mix", refreshGrid);
    MDS.bus.on("song", refreshSong);
    // keep the transport volume in step with the FX/MASTER fader
    MDS.bus.on("master", () => {
      if (els.masterVol) els.masterVol.set(S().project.master.vol, false);
    });
    MDS.bus.on("project", () => {
      els.tempo.set(S().project.bpm, false);
      els.swing.set(S().project.swing, false);
      if (els.masterVol) els.masterVol.set(S().project.master.vol, false);
      els.keySel.value = S().project.key;
      els.syncLock(); els.syncMode();
      refreshGrid(); refreshSong();
    });
    raf();
  }

  return { init };
})();
