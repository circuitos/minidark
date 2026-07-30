/* ============================================================================
   ███ UI ███  meter.js — the design pass's signature element: a master VU
   cluster (L/R peak meters + gain-reduction bar) with real ballistics.

   STRICTLY READ-ONLY with respect to the engine: it taps the master output
   with a ChannelSplitter feeding two AnalyserNodes (passive: analysers have
   no onward connections, so the audible graph is untouched) and reads the
   compressor/limiter `reduction` properties. It never writes engine state.

   PERFORMANCE NOTES (why this loop is smooth):
     - No CSS transitions on the bars. A transition plus a per-frame transform
       write fight each other: the browser keeps restarting an interpolation
       that the next frame overwrites, which is what made it look choppy. The
       rAF loop IS the animation, so it owns the value outright.
     - Real elapsed time drives the decay, not an assumed 1/60 step, so the
       fall rate stays constant if a frame is late.
     - Bar height is measured once and cached; reading clientHeight every frame
       forces a layout per bar per frame.
     - One small analyser buffer, one loop for all bars, transform/opacity only.
     - Switched off (or reduced-motion) it does no analyser work at all.

   Animation honors prefers-reduced-motion by parking the meter in its off
   state. Colors/metrics come from THEME tokens; strings from CONTENT.
   ========================================================================== */
window.MDS = window.MDS || {};
MDS.ui = MDS.ui || {};

MDS.ui.meter = (function () {
  "use strict";
  const C = () => MDS.CONTENT;

  const DB_FLOOR = -48;      /* meter bottom */
  const GR_RANGE = 12;       /* dB of reduction that fills the GR bar */
  const FALL = 1.5;          /* meter release, full scale per second */
  const PEAK_HOLD = 900;     /* ms before the peak tick starts falling */
  const PEAK_FALL = 0.45;    /* peak tick fall, full scale per second */

  let tap = null;            /* { splitter, anL, anR, bufL, bufR } once audio exists */
  let cur = null;            /* the mounted meter's refs (latest wins) */
  let rafOn = false;
  let last = 0;              /* previous frame timestamp */
  let lastTxt = "";          /* last rendered dB readout */
  /* Shared across mounts and re-renders, so toggling survives a tab switch.
     Deliberately in memory only: this app stores nothing between visits. */
  let on = true;
  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
  if (reduced && reduced.matches) on = false;

  /* The compact bars flex with the topbar, so a cached height goes stale on
     resize and the peak tick would ride a wrong scale. Cheap to invalidate. */
  window.addEventListener("resize", () => {
    if (cur) { cur.L.h = 0; cur.R.h = 0; cur.GR.h = 0; }
  });

  function ensureTap() {
    const audio = MDS.state.audio;
    if (!audio) return;
    if (tap && tap.ctx === audio.ctx) return; // keyed on ctx: survives a rebuild
    const ctx = audio.ctx, g = audio.graph;
    const splitter = ctx.createChannelSplitter(2);
    const mk = () => {
      const an = ctx.createAnalyser();
      an.fftSize = 512; an.smoothingTimeConstant = 0;
      return an;
    };
    const anL = mk(), anR = mk();
    g.master.vol.connect(splitter);
    splitter.connect(anL, 0);
    splitter.connect(anR, 1);
    tap = {
      ctx, splitter, anL, anR,
      bufL: new Float32Array(anL.fftSize), bufR: new Float32Array(anR.fftSize),
    };
  }

  function peakOf(an, buf) {
    an.getFloatTimeDomainData(buf);
    let p = 0;
    for (let i = 0; i < buf.length; i++) {
      const a = buf[i] < 0 ? -buf[i] : buf[i];
      if (a > p) p = a;
    }
    return p;
  }

  const toScale = (db) => Math.max(0, Math.min(1, (db - DB_FLOOR) / -DB_FLOOR));

  function col(labelText, grMode) {
    const wrap = document.createElement("div");
    wrap.className = "vu-col" + (grMode ? " vu-gr" : "");
    const bar = document.createElement("div");
    bar.className = "vu-bar";
    const fill = document.createElement("div");
    fill.className = "vu-fill";
    bar.appendChild(fill);
    let peak = null;
    if (!grMode) {
      peak = document.createElement("div");
      peak.className = "vu-peak";
      bar.appendChild(peak);
    }
    const label = document.createElement("div");
    label.className = "vu-label";
    label.textContent = labelText;
    wrap.append(bar, label);
    return { wrap, bar, fill, peak, lvl: 0, pk: 0, pkAt: 0, h: 0 };
  }

  function create(opts) {
    opts = opts || {};
    const compact = !!opts.compact;
    const cm = C().fx;
    const root = document.createElement("div");
    root.className = "vu" + (compact ? " vu-compact" : "");
    root.dataset.tt = "meterVu";

    const cluster = document.createElement("div");
    cluster.className = "vu-cluster";
    const L = col(cm.meterL), R = col(cm.meterR), GR = col(cm.meterGr, true);
    cluster.append(L.wrap, R.wrap, GR.wrap);

    const readout = document.createElement("div");
    readout.className = "vu-readout";
    const num = document.createElement("span");
    num.className = "vu-num";
    num.textContent = "-inf " + cm.meterDb;
    const cap = document.createElement("span");
    cap.className = "vu-cap";
    cap.textContent = cm.meterPeak;
    if (compact) {
      readout.appendChild(num);
    } else {
      const title = document.createElement("span");
      title.className = "vu-cap";
      title.textContent = cm.meterTitle;
      readout.append(title, num, cap);
    }

    /* On/off switch for anyone who finds live metering distracting. */
    const sw = document.createElement("button");
    sw.className = "vu-switch";
    sw.textContent = cm.meterToggle;
    sw.setAttribute("aria-pressed", String(on));
    sw.onclick = (e) => { e.stopPropagation(); setOn(!on); };

    root.append(cluster, readout, sw);
    /* The whole panel is a toggle target too. */
    root.onclick = () => setOn(!on);

    cur = { root, L, R, GR, num, sw, compact };
    applyOn();
    if (!rafOn) { rafOn = true; last = performance.now(); requestAnimationFrame(loop); }
    return root;
  }

  function setOn(v) {
    on = !!v;
    applyOn();
    if (on && !rafOn) { rafOn = true; last = performance.now(); requestAnimationFrame(loop); }
  }

  function applyOn() {
    if (!cur) return;
    cur.root.classList.toggle("is-off", !on);
    if (cur.sw) {
      cur.sw.setAttribute("aria-pressed", String(on));
      cur.sw.classList.toggle("is-on", on);
    }
    if (!on) {
      /* Park everything at rest so the display reads "off", not "silent". */
      [cur.L, cur.R, cur.GR].forEach((c) => {
        c.lvl = 0; c.pk = 0;
        c.fill.style.transform = "scaleY(0)";
        if (c.peak) c.peak.style.opacity = "0";
      });
      cur.num.textContent = "-inf " + C().fx.meterDb;
      cur.num.classList.remove("is-clip");
      lastTxt = "";
    }
  }

  function drawCol(c, v, now, dt) {
    c.lvl = Math.max(v, c.lvl - FALL * dt);
    c.fill.style.transform = "scaleY(" + c.lvl.toFixed(4) + ")";
    if (!c.peak) return;
    if (v >= c.pk) { c.pk = v; c.pkAt = now; }
    else if (now - c.pkAt > PEAK_HOLD) c.pk = Math.max(0, c.pk - PEAK_FALL * dt);
    if (!c.h) c.h = c.bar.clientHeight;   // measured once, then cached
    c.peak.style.transform = "translateY(" + (-(c.pk * (c.h - 2))).toFixed(1) + "px)";
    c.peak.style.opacity = c.pk > 0.001 ? "1" : "0";
  }

  function loop(ts) {
    if (!cur || !document.contains(cur.root)) { cur = null; rafOn = false; return; }
    if (!on) { rafOn = false; return; }   // switched off: stop burning frames
    requestAnimationFrame(loop);

    // Pre-power there is nothing to meter and .app is display:none, so
    // drawCol would force a layout read per frame against zero-height bars
    // (exactly what the header note promises this loop never does).
    if (!MDS.state.audio) { last = ts || performance.now(); return; }

    const now = ts || performance.now();
    let dt = (now - last) / 1000;
    if (!(dt > 0)) dt = 1 / 60;
    if (dt > 0.1) dt = 0.1;               // clamp after a stall
    last = now;

    ensureTap();
    let dbL = -Infinity, dbR = -Infinity, gr = 0;
    if (tap && MDS.state.audio) {
      dbL = 20 * Math.log10(peakOf(tap.anL, tap.bufL) || 1e-6);
      dbR = 20 * Math.log10(peakOf(tap.anR, tap.bufR) || 1e-6);
      const m = MDS.state.audio.graph.master;
      gr = -((m.comp.reduction || 0) + (m.limiter.reduction || 0));
    }
    drawCol(cur.L, toScale(dbL), now, dt);
    drawCol(cur.R, toScale(dbR), now, dt);
    // GR is a plain drawCol too: its peak is null, so the peak branch no-ops.
    drawCol(cur.GR, Math.max(0, Math.min(1, gr / GR_RANGE)), now, dt);

    const db = Math.max(dbL, dbR);
    const txt = (db <= DB_FLOOR ? "-inf" : (db > 0 ? "+" : "") + db.toFixed(1)) + " " + C().fx.meterDb;
    if (txt !== lastTxt) {   // skip the DOM write on the many identical frames
      lastTxt = txt;
      cur.num.textContent = txt;
      cur.num.classList.toggle("is-clip", db > -0.5);
    }
  }

  return { create, setOn, isOn: () => on };
})();
