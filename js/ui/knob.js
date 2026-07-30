/* ============================================================================
   ███ UI ███  knob.js — rotary SVG knob. Drag vertically (Shift = fine),
   arrow keys when focused, double-click resets. Visual parameters come from
   THEME tokens (--knob-*); this file contains no colors or magic sizes.
   ========================================================================== */
window.MDS = window.MDS || {};
MDS.ui = MDS.ui || {};

/* Shared wheel / arrow-key / double-click contract for the two continuous
   controls (knob and fader). ONE owner: a step-size or behavior change here
   is automatically the change for both widgets (they used to carry
   byte-identical copies, which had already earned one two-file bugfix).
   c: { get, set, toNorm, fromNorm, min, max, initial } */
MDS.ui.ctlKeys = function (el, c) {
  el.addEventListener("dblclick", () => c.set(c.initial));
  el.addEventListener("wheel", (e) => {
    e.preventDefault();
    c.set(c.fromNorm(c.toNorm(c.get()) - Math.sign(e.deltaY) * (e.shiftKey ? 0.005 : 0.03)));
  }, { passive: false });
  el.addEventListener("keydown", (e) => {
    const step = e.shiftKey ? 0.01 : 0.04;
    if (e.key === "ArrowUp" || e.key === "ArrowRight") { c.set(c.fromNorm(c.toNorm(c.get()) + step)); e.preventDefault(); }
    else if (e.key === "ArrowDown" || e.key === "ArrowLeft") { c.set(c.fromNorm(c.toNorm(c.get()) - step)); e.preventDefault(); }
    else if (e.key === "Home") { c.set(c.min); e.preventDefault(); }
    else if (e.key === "End") { c.set(c.max); e.preventDefault(); }
  });
};

MDS.ui.knob = function (opts) {
  "use strict";
  const min = opts.min, max = opts.max;
  const curve = opts.curve || "lin";
  const fmt = opts.fmt || ((v) => (Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 100) / 100));
  const initial = opts.value;
  let value = opts.value;

  const toNorm = (v) => curve === "exp"
    ? Math.log(v / min) / Math.log(max / min)
    : (v - min) / (max - min);
  const fromNorm = (n) => {
    n = Math.max(0, Math.min(1, n));
    return curve === "exp" ? min * Math.pow(max / min, n) : min + n * (max - min);
  };

  const el = document.createElement("div");
  el.className = "knob" + (opts.small ? " knob-s" : "");
  el.tabIndex = 0;
  el.setAttribute("role", "slider");
  el.setAttribute("aria-label", opts.label || "");
  el.setAttribute("aria-valuemin", min);
  el.setAttribute("aria-valuemax", max);
  if (opts.tip) el.dataset.tt = opts.tip;
  if (opts.tipLabel) el.dataset.ttLabel = opts.tipLabel;

  /* 270° sweep starting at 7-o'clock. viewBox units; stroke width from token. */
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 40 40");
  const css = getComputedStyle(document.documentElement);
  const sw = parseFloat(css.getPropertyValue("--knob-stroke-w")) || 4;
  const R = 16;
  const a0 = 135, sweep = 270;
  const polar = (deg) => {
    const rad = (deg * Math.PI) / 180;
    return [20 + R * Math.cos(rad), 20 + R * Math.sin(rad)];
  };
  const arcPath = (fromDeg, toDeg) => {
    const [x1, y1] = polar(fromDeg), [x2, y2] = polar(toDeg);
    const large = toDeg - fromDeg > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2}`;
  };
  const face = document.createElementNS(NS, "circle");
  face.setAttribute("cx", 20); face.setAttribute("cy", 20); face.setAttribute("r", R - sw / 2 - 1);
  face.setAttribute("fill", "var(--knob-body)");
  const track = document.createElementNS(NS, "path");
  track.setAttribute("d", arcPath(a0, a0 + sweep));
  track.setAttribute("stroke", "var(--knob-track)");
  track.setAttribute("stroke-width", sw); track.setAttribute("fill", "none");
  track.setAttribute("stroke-linecap", "round");
  const fill = document.createElementNS(NS, "path");
  fill.setAttribute("stroke", "var(--knob-fill)");
  fill.setAttribute("stroke-width", sw); fill.setAttribute("fill", "none");
  fill.setAttribute("stroke-linecap", "round");
  const pointer = document.createElementNS(NS, "line");
  pointer.setAttribute("stroke", "var(--knob-pointer)");
  pointer.setAttribute("stroke-width", sw / 2); pointer.setAttribute("stroke-linecap", "round");
  svg.append(face, track, fill, pointer);

  const labelEl = document.createElement("div");
  labelEl.className = "k-label";
  labelEl.textContent = opts.label || "";
  const valueEl = document.createElement("div");
  valueEl.className = "k-value";
  el.append(svg, labelEl, valueEl);

  function draw() {
    const n = toNorm(value);
    const deg = a0 + Math.max(0.001, n * sweep);
    fill.setAttribute("d", arcPath(a0, deg));
    const [px, py] = polar(deg);
    const rad = (deg * Math.PI) / 180;
    pointer.setAttribute("x1", 20 + (R - sw - 3) * Math.cos(rad) * 0.3);
    pointer.setAttribute("y1", 20 + (R - sw - 3) * Math.sin(rad) * 0.3);
    pointer.setAttribute("x2", px); pointer.setAttribute("y2", py);
    valueEl.textContent = fmt(value);
    el.setAttribute("aria-valuenow", Math.round(value * 1000) / 1000);
  }

  function set(v, fire) {
    value = Math.max(min, Math.min(max, v));
    draw();
    if (fire !== false && opts.onInput) opts.onInput(value);
  }

  /* drag */
  let dragY = null, dragN = 0;
  el.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return; // right-click must not start a drag (see seq.js cells)
    dragY = e.clientY; dragN = toNorm(value);
    el.classList.add("is-active");
    el.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  el.addEventListener("pointermove", (e) => {
    if (dragY == null) return;
    const scale = e.shiftKey ? 900 : 160;
    set(fromNorm(dragN + (dragY - e.clientY) / scale));
  });
  el.addEventListener("pointerup", () => { dragY = null; el.classList.remove("is-active"); });
  el.addEventListener("pointercancel", () => { dragY = null; el.classList.remove("is-active"); });
  MDS.ui.ctlKeys(el, { get: () => value, set, toNorm, fromNorm, min, max, initial });

  set(value, false);
  return { el, set, get: () => value };
};
