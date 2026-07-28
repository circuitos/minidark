/* ============================================================================
   ███ UI ███  panels.js — right-hand tabbed panel: INSTRUMENT (signal path +
   patch knobs + sends), MIXER, FX/MASTER, LIBRARY (incl. demo tracks).
   ========================================================================== */
window.MDS = window.MDS || {};
MDS.ui = MDS.ui || {};

MDS.ui.panels = (function () {
  "use strict";
  const C = () => MDS.CONTENT;
  const S = () => MDS.state;

  let bodyEl = null, tabBtns = {}, curTab = "inst";

  const fmtHz = (v) => (v >= 1000 ? (v / 1000).toFixed(1) + "k" : Math.round(v) + "");
  const fmtMs = (v) => (v >= 1 ? v.toFixed(2) + "s" : Math.round(v * 1000) + "ms");
  const fmtPct = (v) => Math.round(v * 100) + "%";
  const fmt1 = (v) => (Math.round(v * 100) / 100).toString();

  function group(title, id) {
    const g = document.createElement("div");
    g.className = "ctl-group"; g.dataset.group = id || "";
    const h = document.createElement("h3"); h.textContent = title;
    const row = document.createElement("div"); row.className = "ctl-row";
    g.append(h, row);
    return { g, row };
  }

  function patchKnob(row, tr, param, spec) {
    const k = MDS.ui.knob({
      label: spec.label, tip: spec.tip, min: spec.min, max: spec.max,
      curve: spec.curve, value: tr.patch[param] == null ? spec.min : tr.patch[param],
      fmt: spec.fmt || fmt1, small: spec.small,
      onInput: (v) => { tr.patch[param] = spec.round ? Math.round(v) : v; },
    });
    row.appendChild(k.el);
    return k;
  }

  function waveSelect(row, tr, param, labelText, tipKey) {
    const wrap = document.createElement("label");
    wrap.className = "tbgroup"; wrap.dataset.tt = tipKey;
    const l = document.createElement("span"); l.className = "k-label"; l.textContent = labelText;
    const sel = document.createElement("select");
    for (const [val, name] of Object.entries(C().inst.waves)) {
      const o = document.createElement("option");
      o.value = val === "saw" ? "sawtooth" : val === "tri" ? "triangle" : val;
      o.textContent = name;
      sel.appendChild(o);
    }
    sel.value = tr.patch[param] || "sawtooth";
    sel.onchange = () => { tr.patch[param] = sel.value; };
    wrap.append(l, sel);
    row.appendChild(wrap);
  }

  /* ── Signal path display ───────────────────────────────────────────── */
  function sigPath(tr) {
    const wrap = document.createElement("div");
    const h = document.createElement("h3"); h.textContent = C().inst.sigTitle;
    const path = document.createElement("div"); path.className = "sigpath";
    const eng = tr.patch ? tr.patch.engine : "sub";
    const first = eng === "sub" ? "osc" : eng === "fm" ? "osc" : eng === "drum" ? "gen" : "sample";
    const nodes = eng === "sub"
      ? [["osc", C().inst.sigNodes.osc], ["filter", C().inst.sigNodes.filter]]
      : [[first, C().inst.sigNodes[first]]];
    nodes.push(["amp", C().inst.sigNodes.amp], ["sends", C().inst.sigNodes.sends], ["master", C().inst.sigNodes.master]);
    nodes.forEach(([id, label], i) => {
      if (i) {
        const a = document.createElement("span"); a.className = "sig-arrow"; a.textContent = "→";
        path.appendChild(a);
      }
      const n = document.createElement("button");
      n.className = "sig-node"; n.textContent = label; n.dataset.tt = "sigNode";
      n.onclick = () => jumpTo(id);
      path.appendChild(n);
    });
    wrap.append(h, path);
    return wrap;
  }

  function jumpTo(id) {
    if (id === "master") { showTab("fx"); highlightGroup("master"); return; }
    const map = { gen: "osc", sample: "osc" };
    highlightGroup(map[id] || id);
  }

  function highlightGroup(id) {
    const el = bodyEl.querySelector(`[data-group="${id}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("is-hot");
    setTimeout(() => el.classList.remove("is-hot"), 1600);
  }

  /* ── INSTRUMENT tab ────────────────────────────────────────────────── */
  function renderInst() {
    bodyEl.innerHTML = "";
    const ti = S().sel.track;
    const tr = S().project.tracks[ti];
    bodyEl.appendChild(sigPath(tr));

    /* preset picker (whole library, grouped by category) */
    const presetWrap = document.createElement("label");
    presetWrap.className = "tbgroup"; presetWrap.dataset.tt = "preset";
    const pl = document.createElement("span"); pl.textContent = C().inst.preset;
    const sel = document.createElement("select");
    const groups = {};
    for (const e of MDS.lib.list()) {
      if (!groups[e.category]) {
        groups[e.category] = document.createElement("optgroup");
        groups[e.category].label = C().lib.cats[e.category] || e.category;
        sel.appendChild(groups[e.category]);
      }
      const o = document.createElement("option");
      o.value = e.id; o.textContent = C().libNames[e.id] || e.id;
      groups[e.category].appendChild(o);
    }
    sel.value = tr.soundId;
    sel.onchange = () => { S().assignSound(ti, sel.value); };
    presetWrap.append(pl, sel);
    bodyEl.appendChild(presetWrap);

    const eng = tr.patch ? tr.patch.engine : null;
    if (eng === "sub") {
      const osc = group(C().inst.gOsc, "osc");
      waveSelect(osc.row, tr, "osc1", C().inst.osc1, "osc1");
      waveSelect(osc.row, tr, "osc2", C().inst.osc2, "osc2");
      patchKnob(osc.row, tr, "mix", { label: C().inst.mix, tip: "mix", min: 0, max: 1, fmt: fmtPct });
      patchKnob(osc.row, tr, "semi", { label: C().inst.semi, tip: "semi", min: -24, max: 24, round: true });
      patchKnob(osc.row, tr, "detune", { label: C().inst.detune, tip: "detune", min: 0, max: 30 });
      patchKnob(osc.row, tr, "glide", { label: C().inst.glide, tip: "glide", min: 0, max: 0.3, fmt: fmtMs });
      bodyEl.appendChild(osc.g);

      const flt = group(C().inst.gFilter, "filter");
      patchKnob(flt.row, tr, "cutoff", { label: C().inst.cutoff, tip: "cutoff", min: 40, max: 12000, curve: "exp", fmt: fmtHz });
      patchKnob(flt.row, tr, "res", { label: C().inst.res, tip: "res", min: 0.1, max: 18 });
      patchKnob(flt.row, tr, "envAmt", { label: C().inst.envAmt, tip: "envAmt", min: 0, max: 6000, fmt: fmtHz });
      patchKnob(flt.row, tr, "fDec", { label: C().inst.fDec, tip: "fDec", min: 0.02, max: 1.5, curve: "exp", fmt: fmtMs });
      bodyEl.appendChild(flt.g);
    } else if (eng === "fm") {
      const fm = group(C().inst.gFm, "osc");
      patchKnob(fm.row, tr, "ratio", { label: C().inst.ratio, tip: "ratio", min: 0.5, max: 12 });
      patchKnob(fm.row, tr, "index", { label: C().inst.index, tip: "index", min: 0, max: 12 });
      patchKnob(fm.row, tr, "iDec", { label: C().inst.iDec, tip: "iDec", min: 0.02, max: 2, curve: "exp", fmt: fmtMs });
      bodyEl.appendChild(fm.g);
    } else if (eng === "drum") {
      const dr = group(C().inst.gDrum, "osc");
      patchKnob(dr.row, tr, "dTune", { label: C().inst.dTune, tip: "dTune", min: 0.5, max: 2 });
      patchKnob(dr.row, tr, "dDecay", { label: C().inst.dDecay, tip: "dDecay", min: 0, max: 1, fmt: fmtPct });
      patchKnob(dr.row, tr, "dTone", { label: C().inst.dTone, tip: "dTone", min: 0, max: 1, fmt: fmtPct });
      patchKnob(dr.row, tr, "dDrive", { label: C().inst.dDrive, tip: "dDrive", min: 0, max: 1, fmt: fmtPct });
      bodyEl.appendChild(dr.g);
    } else if (eng === "buffer") {
      const sm = group(C().inst.gSample, "osc");
      patchKnob(sm.row, tr, "dTune", { label: C().inst.dTune, tip: "dTune", min: 0.5, max: 2 });
      bodyEl.appendChild(sm.g);
    }

    if (eng === "sub" || eng === "fm") {
      const env = group(C().inst.gEnv, "amp");
      patchKnob(env.row, tr, "a", { label: C().inst.a, tip: "a", min: 0.001, max: 2, curve: "exp", fmt: fmtMs });
      patchKnob(env.row, tr, "d", { label: C().inst.d, tip: "d", min: 0.01, max: 2, curve: "exp", fmt: fmtMs });
      patchKnob(env.row, tr, "s", { label: C().inst.s, tip: "s", min: 0, max: 1, fmt: fmtPct });
      patchKnob(env.row, tr, "r", { label: C().inst.r, tip: "r", min: 0.01, max: 3, curve: "exp", fmt: fmtMs });
      bodyEl.appendChild(env.g);
    } else {
      // drums/samples: their amp envelope is the DECAY knob; still give the
      // signal-path AMP node a landing spot
      const env = group(C().inst.gEnv, "amp");
      env.row.appendChild(Object.assign(document.createElement("span"), { className: "seq-help", textContent: C().inst.dDecay + " ↑" }));
      bodyEl.appendChild(env.g);
    }

    const voice = group(C().inst.gVoice, "voice");
    if (eng === "sub") patchKnob(voice.row, tr, "drive", { label: C().inst.drive, tip: "drive", min: 0, max: 1, fmt: fmtPct });
    patchKnob(voice.row, tr, "gain", { label: C().inst.gain, tip: "gain", min: 0, max: 1.2, fmt: fmtPct });
    bodyEl.appendChild(voice.g);

    const sends = group(C().inst.gSends, "sends");
    for (const [k, label] of Object.entries(C().sends)) {
      const kn = MDS.ui.knob({
        label, tip: "send" + { dist: "Dist", chorus: "Chor", delay: "Delay", verb: "Verb", crush: "Crush" }[k],
        min: 0, max: 1, value: tr.sends[k], fmt: fmtPct, small: true,
        onInput: (v) => { tr.sends[k] = v; S().applyMixer(); },
      });
      sends.row.appendChild(kn.el);
    }
    bodyEl.appendChild(sends.g);
  }

  /* ── MIXER tab ─────────────────────────────────────────────────────── */
  let mixerRefs = [];
  function renderMixer() {
    bodyEl.innerHTML = "";
    const h = document.createElement("h3"); h.textContent = C().mixer.title;
    const mixer = document.createElement("div"); mixer.className = "mixer";
    mixerRefs = [];
    S().project.tracks.forEach((tr, ti) => {
      const strip = document.createElement("div");
      strip.className = "strip";
      strip.style.setProperty("--strip-hue", `var(--track-${ti})`);
      const nm = document.createElement("button");
      nm.className = "s-name"; nm.textContent = C().tracks[tr.key]; nm.dataset.tt = "trackSelect";
      nm.onclick = () => { S().sel.track = ti; MDS.bus.emit("sel"); };
      const lvl = MDS.ui.knob({
        label: C().mixer.level, tip: "chLevel", min: 0, max: 1.2, value: tr.level, fmt: fmtPct,
        onInput: (v) => { tr.level = v; S().applyMixer(); },
      });
      const ms = document.createElement("div"); ms.className = "ms";
      const m = document.createElement("button"); m.textContent = C().mixer.mute; m.dataset.tt = "chMute";
      m.onclick = () => { tr.mute = !tr.mute; S().applyMixer(); MDS.bus.emit("mix"); };
      const s = document.createElement("button"); s.textContent = C().mixer.solo; s.dataset.tt = "chSolo";
      s.onclick = () => { tr.solo = !tr.solo; S().applyMixer(); MDS.bus.emit("mix"); };
      ms.append(m, s);
      const sends = document.createElement("div"); sends.className = "sends";
      const sendKnobs = {};
      for (const [k, label] of Object.entries(C().sends)) {
        const kn = MDS.ui.knob({
          label, tip: "send" + { dist: "Dist", chorus: "Chor", delay: "Delay", verb: "Verb", crush: "Crush" }[k],
          min: 0, max: 1, value: tr.sends[k], fmt: fmtPct, small: true,
          onInput: (v) => { tr.sends[k] = v; S().applyMixer(); },
        });
        sends.appendChild(kn.el);
        sendKnobs[k] = kn;
      }
      strip.append(nm, lvl.el, ms, sends);
      mixer.appendChild(strip);
      mixerRefs.push({ tr, m, s, lvl, sendKnobs });
    });
    bodyEl.append(h, mixer);
    refreshMixer();
  }

  function refreshMixer() {
    for (const r of mixerRefs) {
      r.m.classList.toggle("is-on", r.tr.mute);
      r.s.classList.toggle("is-on", r.tr.solo);
    }
  }

  /* ── FX / MASTER tab ───────────────────────────────────────────────── */
  function fxKnob(row, obj, param, spec) {
    const k = MDS.ui.knob({
      label: spec.label, tip: spec.tip, min: spec.min, max: spec.max, curve: spec.curve,
      value: obj[param], fmt: spec.fmt || fmtPct, small: spec.small,
      onInput: (v) => { obj[param] = spec.round ? Math.round(v) : v; S().applyAudio(); },
    });
    row.appendChild(k.el);
  }

  function renderFx() {
    bodyEl.innerHTML = "";
    const fx = S().project.fx;
    const cf = C().fx;

    const d = group(cf.dist, "fx-dist");
    fxKnob(d.row, fx.dist, "drive", { label: cf.distDrive, tip: "distDrive", min: 0, max: 1 });
    fxKnob(d.row, fx.dist, "tone", { label: cf.distTone, tip: "distTone", min: 0, max: 1 });
    fxKnob(d.row, fx.dist, "level", { label: cf.distLevel, tip: "distLevel", min: 0, max: 1 });
    bodyEl.appendChild(d.g);

    const ch = group(cf.chorus, "fx-chorus");
    fxKnob(ch.row, fx.chorus, "rate", { label: cf.choRate, tip: "choRate", min: 0, max: 1 });
    fxKnob(ch.row, fx.chorus, "depth", { label: cf.choDepth, tip: "choDepth", min: 0, max: 1 });
    fxKnob(ch.row, fx.chorus, "level", { label: cf.choLevel, tip: "choLevel", min: 0, max: 1 });
    bodyEl.appendChild(ch.g);

    const dl = group(cf.delay, "fx-delay");
    const divWrap = document.createElement("label");
    divWrap.className = "tbgroup"; divWrap.dataset.tt = "dlyDiv";
    const dvl = document.createElement("span"); dvl.className = "k-label"; dvl.textContent = cf.dlyDiv;
    const dsel = document.createElement("select");
    for (const [val, name] of Object.entries(cf.divisions)) {
      const o = document.createElement("option"); o.value = val; o.textContent = name;
      dsel.appendChild(o);
    }
    dsel.value = fx.delay.div;
    dsel.onchange = () => { fx.delay.div = dsel.value; S().applyAudio(); };
    divWrap.append(dvl, dsel);
    dl.row.appendChild(divWrap);
    fxKnob(dl.row, fx.delay, "fb", { label: cf.dlyFb, tip: "dlyFb", min: 0, max: 0.85 });
    fxKnob(dl.row, fx.delay, "tone", { label: cf.dlyTone, tip: "dlyTone", min: 0, max: 1 });
    fxKnob(dl.row, fx.delay, "level", { label: cf.dlyLevel, tip: "dlyLevel", min: 0, max: 1 });
    bodyEl.appendChild(dl.g);

    const rv = group(cf.verb, "fx-verb");
    fxKnob(rv.row, fx.verb, "size", { label: cf.verbSize, tip: "verbSize", min: 0, max: 1 });
    fxKnob(rv.row, fx.verb, "tone", { label: cf.verbTone, tip: "verbTone", min: 0, max: 1 });
    fxKnob(rv.row, fx.verb, "level", { label: cf.verbLevel, tip: "verbLevel", min: 0, max: 1 });
    bodyEl.appendChild(rv.g);

    const cr = group(cf.crush, "fx-crush");
    fxKnob(cr.row, fx.crush, "bits", { label: cf.crushBits, tip: "crushBits", min: 2, max: 12, round: true, fmt: (v) => Math.round(v) + " bit" });
    fxKnob(cr.row, fx.crush, "level", { label: cf.crushLevel, tip: "crushLevel", min: 0, max: 1 });
    bodyEl.appendChild(cr.g);

    const ms = group(cf.master, "master");
    fxKnob(ms.row, S().project.master, "comp", { label: cf.mComp, tip: "mComp", min: 0, max: 1 });
    fxKnob(ms.row, S().project.master, "vol", { label: cf.mVol, tip: "mVol", min: 0, max: 1 });
    bodyEl.appendChild(ms.g);
  }

  /* ── LIBRARY tab ───────────────────────────────────────────────────── */
  let libCat = "all";
  function renderLib() {
    bodyEl.innerHTML = "";

    /* demo tracks */
    const dh = document.createElement("h3"); dh.textContent = C().lib.demosTitle;
    bodyEl.appendChild(dh);
    for (const id of MDS.demos.ids()) {
      const card = document.createElement("div");
      card.className = "demo-card";
      const nm = document.createElement("strong"); nm.textContent = C().demos[id].name;
      const bl = document.createElement("div"); bl.className = "d-desc"; bl.textContent = C().demos[id].blurb;
      const btns = document.createElement("div"); btns.className = "d-btns";
      const play = document.createElement("button"); play.textContent = C().lib.demoPlay; play.dataset.tt = "demoPlay";
      play.onclick = () => loadDemo(id, true);
      const open = document.createElement("button"); open.textContent = C().lib.demoLoad; open.dataset.tt = "demoLoad";
      open.onclick = () => loadDemo(id, false);
      btns.append(play, open);
      card.append(nm, bl, btns);
      bodyEl.appendChild(card);
    }

    /* sound browser */
    const lh = document.createElement("h3"); lh.textContent = C().lib.title;
    const hint = document.createElement("div"); hint.className = "seq-help"; hint.textContent = C().lib.previewHint;
    const cats = document.createElement("div"); cats.className = "lib-cats";
    const mkCat = (id, label) => {
      const b = document.createElement("button"); b.textContent = label;
      b.classList.toggle("is-on", libCat === id);
      b.onclick = () => { libCat = id; renderLib(); };
      cats.appendChild(b);
    };
    mkCat("all", C().lib.all);
    for (const [id, label] of Object.entries(C().lib.cats)) mkCat(id, label);

    const list = document.createElement("div"); list.className = "lib-list";
    for (const e of MDS.lib.list(libCat)) {
      const item = document.createElement("div");
      item.className = "lib-item"; item.dataset.tt = "libItem";
      item.classList.toggle("is-cur", S().project.tracks[S().sel.track].soundId === e.id);
      const nm = document.createElement("span"); nm.className = "l-name";
      nm.textContent = C().libNames[e.id] || e.id;
      const tags = document.createElement("span"); tags.className = "l-tags";
      tags.textContent = e.tags.join(" · ");
      const use = document.createElement("button"); use.textContent = C().lib.assign; use.dataset.tt = "libAssign";
      use.onclick = (ev) => {
        ev.stopPropagation();
        S().assignSound(S().sel.track, e.id);
        MDS.ui.toast(C().lib.assigned(C().libNames[e.id] || e.id, C().tracks[S().project.tracks[S().sel.track].key]));
        renderLib();
      };
      item.onclick = () => previewEntry(e);
      item.append(nm, tags, use);
      list.appendChild(item);
    }
    bodyEl.append(lh, hint, cats, list);
  }

  function previewEntry(e) {
    const audio = S().ensureAudio();
    if (e.source.type === "synth") {
      MDS.synth.preview(audio.graph, e.source.patch, e.baseNote);
    } else {
      MDS.lib.resolve(audio.ctx, e.id).then((buf) => {
        MDS.synth.preview(audio.graph, { engine: "buffer", buffer: buf, gain: 0.9 }, e.baseNote || 60);
      });
    }
  }

  function loadDemo(id, andPlay) {
    MDS.seq.stop();
    S().loadProject(MDS.demos.make(id));
    MDS.ui.toast(C().lib.demoLoaded(C().demos[id].name));
    if (andPlay) { S().ensureAudio(); S().playMode = "song"; MDS.seq.start(); }
    MDS.bus.emit("project");
  }

  /* ── Tabs / init ───────────────────────────────────────────────────── */
  const renderers = { inst: renderInst, mixer: renderMixer, fx: renderFx, lib: renderLib };

  function showTab(name) {
    curTab = name;
    for (const [k, b] of Object.entries(tabBtns)) b.classList.toggle("is-cur", k === name);
    renderers[name]();
  }

  function init(root) {
    root.className = "panel";
    const tabs = document.createElement("div"); tabs.className = "tabs";
    for (const [k, label] of Object.entries(C().tabs)) {
      const b = document.createElement("button");
      b.textContent = label;
      b.onclick = () => showTab(k);
      tabs.appendChild(b); tabBtns[k] = b;
    }
    bodyEl = document.createElement("div"); bodyEl.className = "panel-body";
    root.append(tabs, bodyEl);
    showTab("inst");

    MDS.bus.on("sel", () => { if (curTab === "inst" || curTab === "lib") renderers[curTab](); });
    MDS.bus.on("patch", () => { if (curTab === "inst") renderInst(); });
    MDS.bus.on("mix", () => { if (curTab === "mixer") refreshMixer(); });
    MDS.bus.on("project", () => renderers[curTab]());
  }

  return { init, showTab, highlightGroup };
})();
