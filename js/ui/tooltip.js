/* ============================================================================
   ███ UI ███  tooltip.js — one global tooltip. Any element with data-tt="key"
   shows CONTENT.tooltips[key] ({what, why}) on hover or keyboard focus.
   ========================================================================== */
window.MDS = window.MDS || {};
MDS.ui = MDS.ui || {};

MDS.ui.tooltip = (function () {
  "use strict";
  let el = null, timer = null, current = null;

  function ensure() {
    if (el) return el;
    el = document.createElement("div");
    el.className = "tooltip";
    const what = document.createElement("div"); what.className = "tt-what";
    const why = document.createElement("div"); why.className = "tt-why";
    el.append(what, why);
    document.body.appendChild(el);
    return el;
  }

  function show(target) {
    const key = target.dataset.tt;
    const tip = MDS.CONTENT.tooltips[key];
    if (!tip) return;
    ensure();
    el.children[0].textContent = tip.what;
    el.children[1].textContent = tip.why;
    el.style.display = "block";
    const r = target.getBoundingClientRect();
    const tw = el.offsetWidth, th = el.offsetHeight;
    let x = r.left + r.width / 2 - tw / 2;
    let y = r.bottom + 8;
    x = Math.max(4, Math.min(window.innerWidth - tw - 4, x));
    if (y + th > window.innerHeight - 4) y = r.top - th - 8;
    el.style.left = x + "px";
    el.style.top = Math.max(4, y) + "px";
  }

  function hide() {
    clearTimeout(timer); timer = null; current = null;
    if (el) el.style.display = "none";
  }

  function arm(target) {
    if (current === target) return;
    hide();
    current = target;
    timer = setTimeout(() => show(target), 350);
  }

  function init() {
    document.addEventListener("mouseover", (e) => {
      const t = e.target.closest && e.target.closest("[data-tt]");
      if (t) arm(t); else hide();
    });
    document.addEventListener("mousedown", hide, true);
    document.addEventListener("focusin", (e) => {
      const t = e.target.closest && e.target.closest("[data-tt]");
      if (t) arm(t);
    });
    document.addEventListener("focusout", hide);
    window.addEventListener("scroll", hide, true);
  }

  return { init, hide };
})();
