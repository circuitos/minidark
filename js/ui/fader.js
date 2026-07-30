/* ============================================================================
   ███ UI ███  fader.js — vertical linear fader for volume controls (per-track
   channel level and the master bus). Same interaction contract as the knob:
   pointer drag (Shift = fine), plus the wheel / arrow-key / double-click
   behavior that MDS.ui.ctlKeys (js/ui/knob.js) owns for both widgets.
   role="slider" with aria-valuemin/max/now and a data-tt tooltip trigger.
   Visual parameters come from THEME tokens; no colors or magic sizes live
   here. Writes only to the caller's onInput handler.
   ========================================================================== */
window.MDS = window.MDS || {};
MDS.ui = MDS.ui || {};

MDS.ui.fader = function (opts) {
  "use strict";
  const min = opts.min, max = opts.max;
  const fmt = opts.fmt || ((v) => Math.round(v * 100) + "%");
  const initial = opts.value;
  let value = opts.value;

  const toNorm = (v) => (v - min) / (max - min);
  const fromNorm = (n) => min + Math.max(0, Math.min(1, n)) * (max - min);

  const horiz = !!opts.horizontal;
  const el = document.createElement("div");
  el.className = "fader" + (opts.small ? " fader-s" : "") + (horiz ? " fader-h" : "");
  el.tabIndex = 0;
  el.setAttribute("role", "slider");
  el.setAttribute("aria-label", opts.label || "");
  el.setAttribute("aria-valuemin", min);
  el.setAttribute("aria-valuemax", max);
  if (opts.tip) el.dataset.tt = opts.tip;
  if (opts.tipLabel) el.dataset.ttLabel = opts.tipLabel;

  const track = document.createElement("div");
  track.className = "f-track";
  const fill = document.createElement("div");
  fill.className = "f-fill";
  const cap = document.createElement("div");
  cap.className = "f-cap";
  track.append(fill, cap);

  const labelEl = document.createElement("div");
  labelEl.className = "f-label";
  labelEl.textContent = opts.label || "";
  const valueEl = document.createElement("div");
  valueEl.className = "f-value";
  el.append(track, valueEl, labelEl);

  function draw() {
    const n = toNorm(value);
    const pct = (n * 100).toFixed(2) + "%";
    if (horiz) { fill.style.width = pct; cap.style.left = pct; }
    else { fill.style.height = pct; cap.style.bottom = pct; }
    valueEl.textContent = fmt(value);
    el.setAttribute("aria-valuenow", Math.round(value * 1000) / 1000);
  }

  function set(v, fire) {
    value = Math.max(min, Math.min(max, v));
    draw();
    if (fire !== false && opts.onInput) opts.onInput(value);
  }

  /* drag: along the control's axis, relative to the track box so the cap
     follows the pointer; Shift switches to fine relative dragging. */
  let dragging = false, dragPos = null, dragN = 0;
  const fromEvent = (e) => {
    const r = track.getBoundingClientRect();
    return horiz ? (e.clientX - r.left) / r.width : 1 - (e.clientY - r.top) / r.height;
  };
  el.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return; // right-click must not jump the value (see seq.js cells)
    dragging = true;
    el.classList.add("is-active");
    el.setPointerCapture(e.pointerId);
    if (e.shiftKey) { dragPos = horiz ? e.clientX : e.clientY; dragN = toNorm(value); }
    else { dragPos = null; set(fromEvent(e)); }
    e.preventDefault();
  });
  el.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    if (dragPos != null) {
      const d = horiz ? e.clientX - dragPos : dragPos - e.clientY;
      set(fromNorm(dragN + d / 900));
    } else set(fromNorm(fromEvent(e)));
  });
  const end = () => { dragging = false; dragPos = null; el.classList.remove("is-active"); };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
  MDS.ui.ctlKeys(el, { get: () => value, set, toNorm, fromNorm, min, max, initial });

  set(value, false);
  return { el, set, get: () => value };
};
