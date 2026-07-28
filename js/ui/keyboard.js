/* ============================================================================
   ███ UI ███  keyboard.js — on-screen piano (mouse/touch) + QWERTY mapping.
   Plays the currently selected track live over the running sequencer and
   sets the note used when new melodic steps are entered.
   ========================================================================== */
window.MDS = window.MDS || {};
MDS.ui = MDS.ui || {};

MDS.ui.keyboard = (function () {
  "use strict";
  const C = () => MDS.CONTENT;
  const S = () => MDS.state;

  /* QWERTY → semitone offset from the visible keyboard's lowest C.
     Z-row = lower octave, Q-row = upper (classic DAW layout). */
  const QWERTY = {
    z: 0, s: 1, x: 2, d: 3, c: 4, v: 5, g: 6, b: 7, h: 8, n: 9, j: 10, m: 11,
    ",": 12,
    q: 12, "2": 13, w: 14, "3": 15, e: 16, r: 17, "5": 18, t: 19, "6": 20,
    y: 21, "7": 22, u: 23, i: 24, "9": 25, o: 26, "0": 27, p: 28,
  };
  const BLACK = { 1: true, 3: true, 6: true, 8: true, 10: true };

  const held = {};       // note → voice handle (pointer + qwerty share it)
  let keyEls = {};       // note → DOM key
  let root = null, nameEl = null;

  function baseC() { return 48 + S().sel.octave * 12; }  // C3 default

  function playedNote(offset) {
    let n = baseC() + offset;
    if (S().project.scaleLock) n = MDS.dsp.snapToScale(n, S().project.key);
    return n;
  }

  function noteOn(n) {
    if (held[n]) return;
    const audio = S().ensureAudio();
    const ti = S().sel.track;
    const tr = S().project.tracks[ti];
    if (!tr.patch) return;
    held[n] = MDS.synth.noteOn(audio.graph, ti, tr.patch, n, 0.85);
    S().sel.entryNote = n;
    if (keyEls[n]) keyEls[n].classList.add("is-down");
  }

  function noteOff(n) {
    if (!held[n]) return;
    held[n].release();
    delete held[n];
    if (keyEls[n]) keyEls[n].classList.remove("is-down");
  }

  function allOff() { for (const n of Object.keys(held)) noteOff(+n); }

  function build(container) {
    root = container;
    container.className = "kbd-box";
    container.innerHTML = "";

    const head = document.createElement("div");
    head.className = "kbd-head";
    const title = document.createElement("h3");
    title.textContent = C().kbd.title;
    const down = document.createElement("button");
    down.textContent = C().kbd.octDown; down.dataset.tt = "kbdOct";
    down.onclick = () => { S().sel.octave = Math.max(-2, S().sel.octave - 1); render(); };
    const up = document.createElement("button");
    up.textContent = C().kbd.octUp; up.dataset.tt = "kbdOct";
    up.onclick = () => { S().sel.octave = Math.min(2, S().sel.octave + 1); render(); };
    nameEl = document.createElement("span");
    const hint = document.createElement("span");
    hint.className = "seq-help"; hint.textContent = C().kbd.hint;
    head.append(title, down, up, nameEl, hint);

    const kb = document.createElement("div");
    kb.className = "kbd"; kb.dataset.tt = "kbd";
    container.append(head, kb);
    container._kb = kb;
    render();

    /* QWERTY handling (global) */
    document.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
      const off = QWERTY[e.key.toLowerCase()];
      if (off != null) { noteOn(playedNote(off)); }
    });
    document.addEventListener("keyup", (e) => {
      const off = QWERTY[e.key.toLowerCase()];
      if (off != null) {
        // release ALL held notes matching this offset's snapped pitch
        noteOff(playedNote(off));
      }
    });
    window.addEventListener("blur", allOff);
    MDS.bus.on("sel", updateName);
    MDS.bus.on("project", render);
    MDS.bus.on("patch", updateName);
  }

  function updateName() {
    const tr = S().project.tracks[S().sel.track];
    const nm = MDS.CONTENT.libNames[tr.soundId] || tr.soundId;
    nameEl.textContent = C().kbd.playing(`${C().tracks[tr.key]} · ${nm}`);
    // mark out-of-scale keys
    for (const [n, el] of Object.entries(keyEls)) {
      const out = S().project.scaleLock && MDS.dsp.snapToScale(+n, S().project.key) !== +n;
      el.classList.toggle("is-out", out);
    }
  }

  function render() {
    const kb = root._kb;
    kb.innerHTML = "";
    keyEls = {};
    const start = baseC();
    const css = getComputedStyle(document.documentElement);
    const whiteW = css.getPropertyValue("--kb-white-w").trim();
    let whiteIdx = 0;
    for (let off = 0; off <= 24; off++) {
      const n = start + off;
      const pc = ((n % 12) + 12) % 12;
      const isBlack = BLACK[pc];
      const key = document.createElement("div");
      key.className = isBlack ? "key-b" : "key-w";
      if (isBlack) {
        key.style.left = `calc(${whiteIdx} * ${whiteW} - (${css.getPropertyValue("--kb-black-w").trim()} / 2))`;
      } else {
        whiteIdx++;
        if (pc === 0) key.textContent = MDS.dsp.noteName(n);
      }
      const on = (e) => { e.preventDefault(); noteOn(n); };
      const offFn = () => noteOff(n);
      key.addEventListener("pointerdown", on);
      key.addEventListener("pointerup", offFn);
      key.addEventListener("pointerleave", offFn);
      key.addEventListener("pointerenter", (e) => { if (e.buttons) noteOn(n); });
      keyEls[n] = key;
      kb.appendChild(key);
    }
    updateName();
  }

  return { build, allOff };
})();
