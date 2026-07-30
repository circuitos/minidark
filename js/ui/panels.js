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
  let masterFader = null;   // FX/MASTER volume fader, synced with the transport

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

  function waveSwitch(container, tr, param, labelText, tipKey) {
    /* Segmented switch: every waveform is one click away (no dropdown). */
    const row = document.createElement("div");
    row.className = "sw-row"; row.dataset.tt = tipKey;
    const l = document.createElement("span"); l.className = "sw-label"; l.textContent = labelText;
    const seg = document.createElement("div"); seg.className = "segmented";
    const btns = [];
    const valOf = (val) => (val === "saw" ? "sawtooth" : val === "tri" ? "triangle" : val);
    for (const [val, name] of Object.entries(C().inst.waves)) {
      const b = document.createElement("button");
      b.textContent = name; b.dataset.wave = valOf(val);
      b.onclick = () => {
        tr.patch[param] = b.dataset.wave;
        btns.forEach((x) => x.classList.toggle("is-on", x === b));
      };
      seg.appendChild(b); btns.push(b);
    }
    const curVal = tr.patch[param] || "sawtooth";
    btns.forEach((b) => b.classList.toggle("is-on", b.dataset.wave === curVal));
    row.append(l, seg);
    container.appendChild(row);
  }

  /* ── Signal path display ───────────────────────────────────────────── */
  function sigPath(tr) {
    const wrap = document.createElement("div");
    const h = document.createElement("h3"); h.textContent = C().inst.sigTitle;
    const path = document.createElement("div"); path.className = "sigpath";
    const eng = tr.patch ? tr.patch.engine : "sub";
    const first = eng === "sub" || eng === "fm" ? "osc"
      : eng === "drum" ? "gen" : eng === "pluck" ? "string" : "sample";
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
    const map = { gen: "osc", sample: "osc", string: "osc" };
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
    /* The whole library is here, but the family this track is already using
       comes first: on a SNARE row you want the other snares, not to scroll. */
    const cats = Object.keys(C().lib.cats);
    const cur = MDS.lib.get(tr.soundId);
    const order = cur ? [cur.category].concat(cats.filter((c) => c !== cur.category)) : cats;
    for (const cat of order) {
      const entries = MDS.lib.list(cat);
      if (!entries.length) continue;
      const grp = document.createElement("optgroup");
      grp.label = C().lib.cats[cat] || cat;
      for (const e of entries) {
        const o = document.createElement("option");
        o.value = e.id; o.textContent = C().libNames[e.id] || e.id;
        grp.appendChild(o);
      }
      sel.appendChild(grp);
    }
    /* Imported samples close the list (their names are user data, not CONTENT). */
    const userEntries = MDS.lib.userList();
    if (userEntries.length) {
      const grp = document.createElement("optgroup");
      grp.label = C().lib.samplesTitle;
      for (const e of userEntries) {
        const o = document.createElement("option");
        o.value = e.id; o.textContent = e.name || e.id;
        grp.appendChild(o);
      }
      sel.appendChild(grp);
    }
    sel.value = tr.soundId;
    sel.onchange = () => { S().assignSound(ti, sel.value); };
    presetWrap.append(pl, sel);

    /* Roll the dials and play the result: learning by wreckage. */
    const roll = document.createElement("button");
    roll.textContent = C().inst.random; roll.dataset.tt = "random";
    roll.onclick = () => {
      const audio = S().ensureAudio();
      const patch = S().randomizePatch(ti);
      if (patch) MDS.synth.preview(audio.graph, patch, tr.baseNote);
    };
    const head = document.createElement("div");
    head.className = "inst-head";
    head.append(presetWrap, roll);
    bodyEl.appendChild(head);

    const eng = tr.patch ? tr.patch.engine : null;
    if (eng === "sub") {
      /* Layout: the two waveform switches stack full-width above their knob
         row, so selectors and dials never share a line awkwardly. */
      const osc = group(C().inst.gOsc, "osc");
      waveSwitch(osc.g, tr, "osc1", C().inst.osc1, "osc1");
      waveSwitch(osc.g, tr, "osc2", C().inst.osc2, "osc2");
      osc.g.appendChild(osc.row);
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
    } else if (eng === "pluck") {
      const st = group(C().inst.gString, "osc");
      patchKnob(st.row, tr, "decay", { label: C().inst.decay, tip: "decay", min: 0, max: 1, fmt: fmtPct });
      patchKnob(st.row, tr, "bright", { label: C().inst.bright, tip: "bright", min: 0, max: 1, fmt: fmtPct });
      patchKnob(st.row, tr, "pick", { label: C().inst.pick, tip: "pick", min: 0, max: 1, fmt: fmtPct });
      patchKnob(st.row, tr, "body", { label: C().inst.body, tip: "body", min: 0, max: 1, fmt: fmtPct });
      bodyEl.appendChild(st.g);
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
    if (eng === "sub" || eng === "pluck") patchKnob(voice.row, tr, "drive", { label: C().inst.drive, tip: "drive", min: 0, max: 1, fmt: fmtPct });
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
      const lvl = MDS.ui.fader({
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

    /* MASTER first: output level and metering are what you check most, so the
       glue knob, the volume fader and the live VU sit together on one row. */
    const ms = group(cf.master, "master");
    fxKnob(ms.row, S().project.master, "comp", { label: cf.mComp, tip: "mComp", min: 0, max: 1 });
    masterFader = MDS.ui.fader({
      label: cf.mVol, tip: "mVol", min: 0, max: 1, value: S().project.master.vol, fmt: fmtPct,
      onInput: (v) => { S().project.master.vol = v; S().applyAudio(); MDS.bus.emit("master"); },
    });
    ms.row.appendChild(masterFader.el);
    bodyEl.appendChild(ms.g);

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
    divWrap.className = "ctl-sel"; divWrap.dataset.tt = "dlyDiv";
    const dvl = document.createElement("span"); dvl.className = "k-label"; dvl.textContent = cf.dlyDiv;
    const dsel = document.createElement("select");
    for (const [val, name] of Object.entries(cf.divisions)) {
      const o = document.createElement("option"); o.value = val; o.textContent = name;
      dsel.appendChild(o);
    }
    dsel.value = fx.delay.div;
    dsel.onchange = () => { fx.delay.div = dsel.value; S().applyAudio(); };
    divWrap.append(dsel, dvl);
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
  }

  /* ── LIBRARY tab ───────────────────────────────────────────────────── */
  let libCat = "all";
  let infoOpen = null;   // library entry id whose lore panel is expanded

  function assignBtn(e) {
    const use = document.createElement("button"); use.textContent = C().lib.assign; use.dataset.tt = "libAssign";
    use.onclick = (ev) => {
      ev.stopPropagation();
      S().assignSound(S().sel.track, e.id);
      MDS.ui.toast(C().lib.assigned(C().libNames[e.id] || e.name || e.id, C().tracks[S().project.tracks[S().sel.track].key]));
      renderLib();
    };
    return use;
  }

  /* Lore panel under a library item: where the sound comes from in the real
     world, glossary cross-refs, and a link out (CONTENT.libInfo owns copy). */
  function infoPanel(e) {
    const info = C().libInfo[e.id];
    const box = document.createElement("div");
    box.className = "lib-info";
    const txt = document.createElement("p"); txt.textContent = info.text;
    const foot = document.createElement("div"); foot.className = "li-foot";
    for (const term of info.terms || []) {
      const t = document.createElement("button");
      t.className = "li-term"; t.textContent = term;
      t.onclick = () => MDS.ui.glossary.open(term);
      foot.appendChild(t);
    }
    const a = document.createElement("a");
    a.className = "li-wiki"; a.textContent = C().lib.infoWiki;
    a.href = info.wiki; a.target = "_blank"; a.rel = "noopener noreferrer";
    foot.appendChild(a);
    box.append(txt, foot);
    return box;
  }

  function renderLib() {
    // The panel body is the scroll container and this tab rebuilds itself on
    // every interaction; without this, clicking ⓘ or USE ON TRACK below the
    // fold snaps the panel back to the top.
    const scrollTop = bodyEl.scrollTop;
    bodyEl.innerHTML = "";

    /* demo tracks (compact cards: header row + blurb) */
    const dh = document.createElement("h3"); dh.textContent = C().lib.demosTitle;
    bodyEl.appendChild(dh);
    for (const id of MDS.demos.ids()) {
      const card = document.createElement("div");
      card.className = "demo-card";
      const head = document.createElement("div"); head.className = "d-head";
      const nm = document.createElement("strong"); nm.textContent = C().demos[id].name;
      const grow = document.createElement("span"); grow.className = "grow";
      const play = document.createElement("button"); play.textContent = C().lib.demoPlay; play.dataset.tt = "demoPlay";
      play.onclick = () => loadDemo(id, true);
      const open = document.createElement("button"); open.textContent = C().lib.demoLoad; open.dataset.tt = "demoLoad";
      open.onclick = () => loadDemo(id, false);
      head.append(nm, grow, play, open);
      const bl = document.createElement("div"); bl.className = "d-desc"; bl.textContent = C().demos[id].blurb;
      card.append(head, bl);
      bodyEl.appendChild(card);
    }

    /* imported samples (the space the old demo cards used to fill) */
    const sh = document.createElement("h3"); sh.textContent = C().lib.samplesTitle;
    const sHint = document.createElement("div"); sHint.className = "seq-help"; sHint.textContent = C().lib.samplesHint;
    const imp = document.createElement("button");
    imp.textContent = C().lib.import; imp.dataset.tt = "libImport";
    const fileIn = document.createElement("input");
    fileIn.type = "file"; fileIn.accept = "audio/*"; fileIn.multiple = true; fileIn.hidden = true;
    imp.onclick = () => fileIn.click();
    fileIn.onchange = () => { importFiles(Array.from(fileIn.files)); fileIn.value = ""; };
    const sList = document.createElement("div"); sList.className = "lib-list";
    const samples = S().samples;
    if (!samples.length) {
      const empty = document.createElement("div"); empty.className = "seq-help";
      empty.textContent = C().lib.samplesEmpty;
      sList.appendChild(empty);
    }
    for (const smp of samples) {
      const e = MDS.lib.get(smp.id);
      const item = document.createElement("div");
      item.className = "lib-item"; item.dataset.tt = "sampleItem";
      item.classList.toggle("is-cur", S().project.tracks[S().sel.track].soundId === smp.id);
      const nm = document.createElement("span"); nm.className = "l-name"; nm.textContent = smp.name;
      const tags = document.createElement("span"); tags.className = "l-tags";
      tags.textContent = C().lib.sampleSecs(smp.secs || 0);
      const del = document.createElement("button");
      del.className = "l-x"; del.textContent = C().lib.remove; del.dataset.tt = "sampleRemove";
      del.onclick = (ev) => { ev.stopPropagation(); S().removeSample(smp.id); renderLib(); };
      item.onclick = () => { if (e) previewEntry(e); };
      item.append(nm, tags, assignBtn({ id: smp.id, name: smp.name }), del);
      sList.appendChild(item);
    }
    bodyEl.append(sh, sHint, imp, fileIn, sList);

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
      item.onclick = () => previewEntry(e);
      item.append(nm, tags);
      if (C().libInfo[e.id]) {
        const inf = document.createElement("button");
        inf.className = "l-info"; inf.textContent = C().lib.infoBtn; inf.dataset.tt = "libInfo";
        inf.classList.toggle("is-on", infoOpen === e.id);
        inf.onclick = (ev) => { ev.stopPropagation(); infoOpen = infoOpen === e.id ? null : e.id; renderLib(); };
        item.appendChild(inf);
      }
      item.appendChild(assignBtn(e));
      list.appendChild(item);
      if (infoOpen === e.id && C().libInfo[e.id]) list.appendChild(infoPanel(e));
    }
    bodyEl.append(lh, hint, cats, list);
    bodyEl.scrollTop = scrollTop;
  }

  /* Import: base64 for the project file, one decode for duration + cache.
     The base64 copy is made FIRST: decodeAudioData detaches its buffer. */
  const MAX_SAMPLE_BYTES = 8 * 1024 * 1024;
  function importFiles(files) {
    const audio = S().ensureAudio();
    for (const f of files) {
      if (f.size > MAX_SAMPLE_BYTES) { MDS.ui.toast(C().lib.sampleTooBig(f.name)); continue; }
      f.arrayBuffer().then((ab) => {
        const bytes = new Uint8Array(ab);
        let bin = "";
        for (let i = 0; i < bytes.length; i += 0x8000) {
          bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        }
        const data = btoa(bin);
        return audio.ctx.decodeAudioData(ab).then((buf) => {
          const name = f.name.replace(/\.[^.]+$/, "");
          const rec = S().addSample({ name, mime: f.type || "audio/*", data, secs: buf.duration });
          MDS.lib.cacheBuffer(rec.id, buf);
          MDS.ui.toast(C().lib.sampleAdded(name));
          renderLib();
        });
      }).catch(() => MDS.ui.toast(C().lib.sampleBad(f.name)));
    }
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
    // keep the FX/MASTER volume in step with the transport fader
    MDS.bus.on("master", () => {
      if (masterFader && document.contains(masterFader.el)) {
        masterFader.set(S().project.master.vol, false);
      }
    });
    MDS.bus.on("project", () => renderers[curTab]());
  }

  return { init, showTab, highlightGroup };
})();
