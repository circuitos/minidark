/* ============================================================================
   ███ UI ███  lessons.js — modal system, toast, glossary, and the interactive
   lesson runner with live audio demo widgets. Widgets synthesize through the
   live engine graph; local loops are cleaned up on step change/close.
   ========================================================================== */
window.MDS = window.MDS || {};
MDS.ui = MDS.ui || {};

/* ── Generic modal ─────────────────────────────────────────────────────── */
MDS.ui.modal = (function () {
  "use strict";
  function open(opts) {
    const back = document.createElement("div");
    back.className = "modal-back";
    const box = document.createElement("div");
    box.className = "modal";
    const head = document.createElement("div");
    head.className = "modal-head";
    const title = document.createElement("h2");
    title.textContent = opts.title || "";
    const grow = document.createElement("span"); grow.className = "grow";
    const x = document.createElement("button");
    x.textContent = MDS.CONTENT.lessonClose;
    head.append(title, grow, x);
    const body = document.createElement("div"); body.className = "modal-body";
    const foot = document.createElement("div"); foot.className = "modal-foot";
    box.append(head, body, foot);
    back.appendChild(box);
    document.body.appendChild(back);

    function close() {
      if (opts.onClose) opts.onClose();
      document.removeEventListener("keydown", esc);
      back.remove();
    }
    function esc(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", esc);
    x.onclick = close;
    back.onclick = (e) => { if (e.target === back) close(); };
    return { close, body, foot, setTitle: (t) => { title.textContent = t; } };
  }
  return { open };
})();

/* ── Toast ─────────────────────────────────────────────────────────────── */
MDS.ui.toast = (function () {
  "use strict";
  let el = null, timer = null;
  return function (msg) {
    if (!el) { el = document.createElement("div"); el.className = "toast"; document.body.appendChild(el); }
    el.textContent = msg;
    el.style.display = "block";
    clearTimeout(timer);
    timer = setTimeout(() => { el.style.display = "none"; }, 4000);
  };
})();

/* ── Glossary ──────────────────────────────────────────────────────────── */
MDS.ui.glossary = (function () {
  "use strict";
  /* Optional `query` prefills the search (library ⓘ notes deep-link here). */
  function open(query) {
    const m = MDS.ui.modal.open({ title: MDS.CONTENT.glossaryTitle });
    const search = document.createElement("input");
    search.type = "text"; search.placeholder = MDS.CONTENT.glossarySearch;
    const dl = document.createElement("dl"); dl.className = "gloss-list";
    function render(q) {
      dl.innerHTML = "";
      for (const [term, def] of MDS.CONTENT.glossary) {
        if (q && !(term + " " + def).toLowerCase().includes(q.toLowerCase())) continue;
        const dt = document.createElement("dt"); dt.textContent = term;
        const dd = document.createElement("dd"); dd.textContent = def;
        dl.append(dt, dd);
      }
    }
    search.oninput = () => render(search.value);
    if (query) search.value = query;
    render(query || "");
    m.body.append(search, dl);
  }
  return { open };
})();

/* ── Lessons ───────────────────────────────────────────────────────────── */
MDS.ui.lessons = (function () {
  "use strict";
  const C = () => MDS.CONTENT;
  const S = () => MDS.state;
  const W = () => MDS.CONTENT.widgets;

  let cleanups = [];
  function addCleanup(fn) { cleanups.push(fn); }
  function runCleanups() { cleanups.forEach((f) => { try { f(); } catch (e) {} }); cleanups = []; }

  /* hold-to-play button helper */
  function holdBtn(label, onDown, onUp) {
    const b = document.createElement("button");
    b.textContent = label;
    let active = false;
    const down = (e) => { e.preventDefault(); if (active) return; active = true; onDown(); };
    const up = () => { if (!active) return; active = false; onUp(); };
    b.addEventListener("pointerdown", down);
    b.addEventListener("pointerup", up);
    b.addEventListener("pointerleave", up);
    addCleanup(up);
    return b;
  }

  /* small local lookahead loop for lesson widgets (independent of main seq) */
  function makeLoop(onStep) {
    let timer = null, next = 0, step = 0;
    const loop = () => {
      const ctx = S().audio.ctx;
      const sDur = 60 / S().project.bpm / 4;
      while (next < ctx.currentTime + 0.12) {
        onStep(step, next);
        step = (step + 1) % 16;
        next += sDur;
      }
    };
    return {
      start() {
        S().ensureAudio();
        if (timer) return;
        step = 0;
        next = S().audio.ctx.currentTime + 0.06;
        loop();
        timer = setInterval(loop, 25);
      },
      stop() { clearInterval(timer); timer = null; },
      get playing() { return !!timer; },
    };
  }

  function rootNote() {
    let r = 24 + (MDS.dsp.KEY_TO_PC[S().project.key] || 0);
    if (r < 28) r += 12;
    return r;
  }

  /* ── widget builders (keyed by CONTENT lesson step .demo) ───────────── */
  const widgets = {

    /* one naked oscillator + waveform switches */
    osc(box) {
      let wave = "sawtooth", osc = null, gain = null;
      const hold = holdBtn(W().hold, () => {
        const a = S().ensureAudio();
        osc = a.ctx.createOscillator();
        if (wave === "pulse") osc.setPeriodicWave(MDS.dsp.pulseWave(a.ctx));
        else osc.type = wave;
        osc.frequency.value = 110;
        gain = a.ctx.createGain(); gain.gain.value = 0.14;
        osc.connect(gain); gain.connect(a.graph.master.input);
        osc.start();
      }, () => {
        if (!osc) return;
        gain.gain.setTargetAtTime(0, S().audio.ctx.currentTime, 0.02);
        osc.stop(S().audio.ctx.currentTime + 0.15);
        osc = null;
      });
      box.appendChild(hold);
      for (const [w, label] of Object.entries(W().waves)) {
        const b = document.createElement("button");
        b.textContent = label;
        b.classList.toggle("is-on", w === wave);
        b.onclick = () => {
          wave = w;
          box.querySelectorAll("button").forEach((x) => { if (x !== hold) x.classList.toggle("is-on", x === b); });
          if (osc) {
            if (w === "pulse") osc.setPeriodicWave(MDS.dsp.pulseWave(S().audio.ctx));
            else osc.type = w;
          }
        };
        box.appendChild(b);
      }
    },

    /* raw saw through a lowpass with cutoff/resonance sliders + auto sweep */
    filter(box) {
      let osc = null, flt = null, gain = null;
      let cut = 800, res = 2;
      /* Uses the app's own fader so the lesson control looks and behaves like
         every other control (native range tracks render inconsistently and
         nearly invisibly once appearance:none removes the platform track). */
      const mkSlider = (label, min, max, val, onInput, fmt) => {
        const f = MDS.ui.fader({
          label: label, horizontal: true, min: min, max: max, value: val,
          fmt: fmt || ((v) => Math.round(v) + ""),
          onInput: onInput,
        });
        box.appendChild(f.el);
        return f;
      };
      const hold = holdBtn(W().hold, () => {
        const a = S().ensureAudio();
        osc = a.ctx.createOscillator(); osc.type = "sawtooth"; osc.frequency.value = 82;
        flt = a.ctx.createBiquadFilter(); flt.type = "lowpass";
        flt.frequency.value = cut; flt.Q.value = res;
        gain = a.ctx.createGain(); gain.gain.value = 0.16;
        osc.connect(flt); flt.connect(gain); gain.connect(a.graph.master.input);
        osc.start();
      }, () => {
        if (!osc) return;
        gain.gain.setTargetAtTime(0, S().audio.ctx.currentTime, 0.02);
        osc.stop(S().audio.ctx.currentTime + 0.15);
        osc = null; flt = null;
      });
      box.appendChild(hold);
      const cs = mkSlider(W().cutoff, 40, 100, 62, (v) => {
        cut = 40 * Math.pow(200, (v - 40) / 60); // log taper 40 Hz → 8 kHz
        if (flt) flt.frequency.setTargetAtTime(cut, S().audio.ctx.currentTime, 0.01);
      }, (v) => {
        const hz = 40 * Math.pow(200, (v - 40) / 60);
        return hz >= 1000 ? (hz / 1000).toFixed(1) + "k" : Math.round(hz) + "";
      });
      mkSlider(W().reso, 0, 100, 15, (v) => {
        res = (v / 100) * 16;
        if (flt) flt.Q.setTargetAtTime(res, S().audio.ctx.currentTime, 0.01);
      }, (v) => Math.round(v) + "%");
      const sweep = document.createElement("button");
      sweep.textContent = W().sweep;
      sweep.onclick = () => {
        if (!flt) return;
        const t = S().audio.ctx.currentTime;
        flt.frequency.cancelScheduledValues(t);
        flt.frequency.setValueAtTime(120, t);
        flt.frequency.exponentialRampToValueAtTime(8000, t + 2);
        flt.frequency.exponentialRampToValueAtTime(120, t + 4);
        cs.set(62, false);
      };
      box.appendChild(sweep);
    },

    /* pluck vs pad — same oscillator, different ADSR */
    env(box) {
      const pluck = { engine: "sub", osc1: "sawtooth", osc2: "sawtooth", semi: 0, detune: 8, mix: 0.5,
        cutoff: 900, res: 3, envAmt: 2500, fDec: 0.15, a: 0.002, d: 0.16, s: 0, r: 0.06, drive: 0.1, gain: 0.8 };
      const pad = { engine: "sub", osc1: "sawtooth", osc2: "sawtooth", semi: 0, detune: 12, mix: 0.5,
        cutoff: 900, res: 1.5, envAmt: 500, fDec: 1.2, a: 0.7, d: 0.6, s: 0.85, r: 1.4, drive: 0, gain: 0.7 };
      let h = null;
      const mk = (label, patch) => holdBtn(label,
        () => { const a = S().ensureAudio(); h = MDS.synth.auditionOn(a.graph, patch, 57, 0.85); },
        () => { if (h) { h.release(); h = null; } });
      box.append(mk(W().pluck, pluck), mk(W().padBtn, pad));
    },

    /* 1×16 kick grid the learner programs, with local playback */
    drumgrid(box) {
      const steps = new Array(16).fill(false);
      const kick = MDS.lib.materialize("kick808");
      const grid = document.createElement("div"); grid.className = "mini-grid";
      grid.style.setProperty("--row-hue", "var(--track-0)");
      const cellEls = [];
      for (let i = 0; i < 16; i++) {
        const c = document.createElement("div");
        c.className = "cell";
        if (i % 4 === 0 && i !== 0) c.dataset.beat = "1";
        c.onclick = () => { steps[i] = !steps[i]; c.classList.toggle("is-on", steps[i]); };
        grid.appendChild(c); cellEls.push(c);
      }
      const loop = makeLoop((step, t) => {
        if (steps[step]) MDS.synth.trigger(S().audio.graph, 0, kick, { time: t, dur: 0.2, vel: 0.9, dest: S().audio.graph.master.input });
        const ms = Math.max(0, (t - S().audio.ctx.currentTime) * 1000);
        setTimeout(() => {
          cellEls.forEach((c, i) => c.classList.toggle("is-play", i === step && loop.playing));
        }, ms);
      });
      const play = document.createElement("button");
      play.textContent = W().play;
      play.onclick = () => {
        if (loop.playing) { loop.stop(); play.textContent = W().play; play.classList.remove("is-on"); cellEls.forEach((c) => c.classList.remove("is-play")); }
        else { loop.start(); play.textContent = W().stop; play.classList.add("is-on"); }
      };
      addCleanup(() => loop.stop());
      box.append(grid, play);
    },

    /* A/B a small loop dry against each shared effect */
    fxab(box) {
      const kick = MDS.lib.materialize("kick808");
      const bass = MDS.lib.materialize("bassNail");
      let lg = null, mode = "dry", connected = null;
      const ensureBus = () => {
        const a = S().ensureAudio();
        if (!lg) { lg = a.ctx.createGain(); lg.gain.value = 1; lg.connect(a.graph.master.input); }
        return a;
      };
      const setMode = (m) => {
        const a = ensureBus();
        if (connected) { try { lg.disconnect(connected); } catch (e) {} connected = null; }
        mode = m;
        const busMap = { dist: a.graph.fx.dist.input, delay: a.graph.fx.delay.input, verb: a.graph.fx.verb.input, crush: a.graph.fx.crush.input };
        if (busMap[m]) { lg.connect(busMap[m]); connected = busMap[m]; }
        box.querySelectorAll("button[data-mode]").forEach((b) => b.classList.toggle("is-on", b.dataset.mode === m));
      };
      const root = rootNote();
      const loop = makeLoop((step, t) => {
        const a = ensureBus();
        if (step % 4 === 0) MDS.synth.trigger(a.graph, 0, kick, { time: t, dur: 0.2, vel: 0.9, dest: lg });
        if (step % 2 === 0) MDS.synth.trigger(a.graph, 4, bass, { time: t, dur: 0.11, vel: step % 8 === 0 ? 1 : 0.7, note: root, dest: lg });
      });
      const play = document.createElement("button");
      play.textContent = W().play;
      play.onclick = () => {
        if (loop.playing) { loop.stop(); play.textContent = W().play; play.classList.remove("is-on"); }
        else { ensureBus(); loop.start(); play.textContent = W().stop; play.classList.add("is-on"); }
      };
      box.appendChild(play);
      for (const [m, label] of [["dry", W().dry], ["dist", W().dist], ["delay", W().delay], ["verb", W().verb], ["crush", W().crush]]) {
        const b = document.createElement("button");
        b.textContent = label; b.dataset.mode = m;
        b.classList.toggle("is-on", m === "dry");
        b.onclick = () => setMode(m);
        box.appendChild(b);
      }
      addCleanup(() => { loop.stop(); if (lg) { try { lg.disconnect(); } catch (e) {} lg = null; } });
    },

    /* load a miniature arrangement into pattern slots 5-7 + song mode */
    chain(box) {
      const b = document.createElement("button");
      b.textContent = W().loadChain;
      b.onclick = () => {
        const p = S().project;
        const root = rootNote();
        const A = S().emptyPattern(), B = S().emptyPattern(), Cc = S().emptyPattern();
        for (const pt of [A, B, Cc]) {
          [0, 4, 8, 12].forEach((s) => { pt.steps[0][s] = { on: true, acc: s === 0, note: null }; });
          [2, 6, 10, 14].forEach((s) => { pt.steps[2][s] = { on: true, acc: false, note: null }; });
        }
        for (const pt of [B, Cc]) {
          for (let s = 0; s < 16; s += 2) pt.steps[4][s] = { on: true, acc: s % 8 === 0, note: root };
        }
        const triad = [root + 24, root + 27, root + 31, root + 27];
        for (let s = 0; s < 16; s += 2) Cc.steps[7][s] = { on: true, acc: false, note: triad[(s / 2) % 4] };
        p.patterns[4] = A; p.patterns[5] = B; p.patterns[6] = Cc;
        p.song = [4, 4, 5, 5, 6, 6, 5, 4];
        S().playMode = "song";
        S().ensureAudio();
        MDS.bus.emit("project");
        MDS.seq.start();
        MDS.ui.toast(W().chainLoaded);
      };
      box.appendChild(b);
    },
  };

  /* capstone steps: write parts into pattern slot 8 (index 7) */
  const CAP = 7;
  function capstoneWriter(write) {
    return (box) => {
      const b = document.createElement("button");
      b.textContent = W().doIt;
      b.onclick = () => {
        S().sel.pattern = CAP;
        S().playMode = "pattern";
        write(S().project.patterns[CAP], S().project);
        MDS.bus.emit("sel"); MDS.bus.emit("pattern");
        b.textContent = W().done;
        b.classList.add("is-on");
      };
      box.appendChild(b);
    };
  }
  widgets["groove-kick"] = capstoneWriter((pat) => {
    [0, 4, 8, 12].forEach((s) => { pat.steps[0][s] = { on: true, acc: s === 0, note: null }; });
  });
  widgets["groove-snare"] = capstoneWriter((pat) => {
    [4, 12].forEach((s) => { pat.steps[1][s] = { on: true, acc: true, note: null }; });
  });
  widgets["groove-hats"] = capstoneWriter((pat) => {
    [2, 6, 10, 14].forEach((s) => { pat.steps[2][s] = { on: true, acc: false, note: null }; });
  });
  widgets["groove-bass"] = capstoneWriter((pat, p) => {
    const r = rootNote();
    const line = [[0, r, true], [2, r], [4, r], [6, r], [8, r, true], [10, r], [12, MDS.dsp.snapToScale(r - 2, p.key)], [14, MDS.dsp.snapToScale(r + 3, p.key)]];
    for (const [s, n, acc] of line) pat.steps[4][s] = { on: true, acc: !!acc, note: n };
  });
  widgets["groove-fx"] = (box) => {
    const dirty = { bassDist: 0.45, kickDist: 0.3, snareVerb: 0.35 };
    let isDirty = false;
    const apply = (on) => {
      const tks = S().project.tracks;
      tks[4].sends.dist = on ? dirty.bassDist : 0;
      tks[0].sends.dist = on ? dirty.kickDist : 0;
      tks[1].sends.verb = on ? dirty.snareVerb : 0;
      S().applyMixer(); MDS.bus.emit("mix");
      isDirty = on;
      ab.textContent = on ? W().abBefore : W().abAfter;
    };
    const doit = document.createElement("button");
    doit.textContent = W().doIt;
    doit.onclick = () => { apply(true); doit.textContent = W().done; doit.classList.add("is-on"); };
    const ab = document.createElement("button");
    ab.textContent = W().abAfter;
    ab.onclick = () => apply(!isDirty);
    box.append(doit, ab);
  };

  /* ── lesson runner ─────────────────────────────────────────────────── */
  function open() {
    const m = MDS.ui.modal.open({ title: C().lessonsTitle, onClose: runCleanups });
    showList(m);
  }

  function showList(m) {
    runCleanups();
    m.setTitle(C().lessonsTitle);
    m.body.innerHTML = ""; m.foot.innerHTML = "";
    const intro = document.createElement("div");
    intro.className = "d-desc"; intro.textContent = C().lessonsIntro;
    const list = document.createElement("div"); list.className = "lesson-list";
    C().lessons.forEach((L, i) => {
      const item = document.createElement("div");
      item.className = "lesson-item";
      const num = document.createElement("span"); num.className = "num"; num.textContent = String(i + 1).padStart(2, "0");
      const tw = document.createElement("div");
      const t = document.createElement("div"); t.textContent = L.title;
      const bl = document.createElement("div"); bl.className = "blurb"; bl.textContent = L.blurb;
      tw.append(t, bl);
      item.append(num, tw);
      item.onclick = () => showStep(m, i, 0);
      list.appendChild(item);
    });
    m.body.append(intro, list);
  }

  function showStep(m, li, si) {
    runCleanups();
    const L = C().lessons[li];
    const step = L.steps[si];
    m.setTitle(`${li + 1}. ${L.title}`);
    m.body.innerHTML = ""; m.foot.innerHTML = "";

    const txt = document.createElement("p");
    txt.className = "lesson-step-text"; txt.textContent = step.text;
    m.body.appendChild(txt);
    if (step.demo && widgets[step.demo]) {
      const box = document.createElement("div");
      box.className = "lesson-demo";
      widgets[step.demo](box);
      m.body.appendChild(box);
    }

    const back = document.createElement("button");
    back.textContent = C().lessonPrev;
    back.onclick = () => (si === 0 ? showList(m) : showStep(m, li, si - 1));
    const dots = document.createElement("div"); dots.className = "lesson-dots";
    L.steps.forEach((_, i) => {
      const d = document.createElement("span");
      d.className = "dot" + (i === si ? " is-cur" : "");
      dots.appendChild(d);
    });
    const grow = document.createElement("span"); grow.className = "grow";
    const next = document.createElement("button");
    next.textContent = si === L.steps.length - 1 ? C().lessonDone : C().lessonNext;
    next.onclick = () => (si === L.steps.length - 1 ? showList(m) : showStep(m, li, si + 1));
    m.foot.append(back, dots, grow, next);
  }

  return { open };
})();
