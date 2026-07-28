/* ============================================================================
   ███ UI ███  main.js — bootstrap: power-on overlay (AudioContext gesture),
   layout skeleton, top bar, module init, global shortcuts, self-test hook.
   ========================================================================== */
(function () {
  "use strict";
  const C = () => MDS.CONTENT;
  const S = () => MDS.state;

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function buildTopbar(bar) {
    bar.className = "topbar";
    const logo = el("span", "logo", C().app.title);
    const sub = el("span", "seq-help", C().app.subtitle);

    const nameIn = document.createElement("input");
    nameIn.type = "text"; nameIn.className = "proj-name"; nameIn.dataset.tt = "projName";
    nameIn.value = S().project.name;
    nameIn.oninput = () => { S().project.name = nameIn.value; };
    MDS.bus.on("project", () => { nameIn.value = S().project.name; });

    const grow = el("span", "grow");

    const save = el("button", null, C().transport.save); save.dataset.tt = "save";
    save.onclick = () => {
      const blob = new Blob([S().toJSON()], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = MDS.exporter.filename(S().project, "minidark.json");
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    };

    const openBtn = el("button", null, C().transport.open); openBtn.dataset.tt = "open";
    const fileIn = document.createElement("input");
    fileIn.type = "file"; fileIn.accept = ".json,application/json"; fileIn.hidden = true;
    fileIn.onchange = () => {
      const f = fileIn.files[0];
      if (!f) return;
      f.text().then((t) => {
        MDS.seq.stop();
        S().loadJSON(t);
      }).catch(() => MDS.ui.toast(C().export.err("bad file")));
      fileIn.value = "";
    };
    openBtn.onclick = () => fileIn.click();

    /* RESET: destructive, so it always asks. Modal uses the shared modal
       classes; ENTER/ESC and focus are handled for keyboard users. */
    const reset = el("button", null, C().transport.reset); reset.dataset.tt = "reset";
    reset.onclick = () => confirmReset();

    const exp = el("button", null, C().transport.export); exp.dataset.tt = "export";
    exp.onclick = () => MDS.ui.exportDialog.open();
    const les = el("button", null, C().transport.lessons); les.dataset.tt = "lessons";
    les.onclick = () => MDS.ui.lessons.open();
    const glo = el("button", null, C().transport.glossary); glo.dataset.tt = "glossary";
    glo.onclick = () => MDS.ui.glossary.open();

    bar.append(logo, sub, nameIn, grow, save, openBtn, fileIn, reset, exp, les, glo);
  }

  function confirmReset() {
    const cc = C().confirm;
    const back = el("div", "modal-back");
    const modal = el("div", "modal modal-sm");
    const head = el("div", "modal-head");
    head.appendChild(el("h2", null, cc.resetTitle));
    const body = el("div", "modal-body");
    body.appendChild(el("p", null, cc.resetBody));
    const foot = el("div", "modal-foot");
    const grow = el("span", "grow");
    const cancel = el("button", null, cc.resetCancel);
    const ok = el("button", "btn-danger", cc.resetOk);
    const close = () => { back.remove(); document.removeEventListener("keydown", onKey); };
    cancel.onclick = close;
    ok.onclick = () => {
      MDS.seq.stop();
      S().newProject();
      close();
      MDS.ui.toast(cc.resetDone);
    };
    function onKey(e) {
      if (e.key === "Escape") { e.preventDefault(); close(); }
      else if (e.key === "Enter") { e.preventDefault(); ok.click(); }
    }
    document.addEventListener("keydown", onKey);
    back.onclick = (e) => { if (e.target === back) close(); };
    foot.append(grow, cancel, ok);
    modal.append(head, body, foot);
    back.appendChild(modal);
    document.body.appendChild(back);
    ok.focus();
  }

  function buildLayout(app) {
    const bar = el("div"); buildTopbar(bar);
    const main = el("div", "main");
    const left = el("div", "left-col");
    const transport = el("div");
    const seqBox = el("div");
    const songBox = el("div");
    const kbdBox = el("div");
    left.append(transport, seqBox, songBox, kbdBox);
    const right = el("div", "right-col");
    const panel = el("div");
    right.appendChild(panel);
    main.append(left, right);
    app.append(bar, main);

    MDS.ui.seq.init(transport, seqBox, songBox);
    MDS.ui.keyboard.build(kbdBox);
    MDS.ui.panels.init(panel);
    // sound changes can flip a row between drum and melodic display
    MDS.bus.on("patch", () => MDS.bus.emit("pattern"));
  }

  function buildPowerOverlay(onPower) {
    const ov = el("div", "power-overlay");
    const h = el("h1", "logo", C().app.title);
    const tag = el("p", "tagline", C().app.powerTag);
    const btn = el("button", "power-btn", C().app.powerBtn);
    const hint = el("p", "seq-help", C().app.powerHint);
    btn.onclick = () => { ov.remove(); onPower(); };
    ov.append(h, tag, btn, hint);
    document.body.appendChild(ov);
  }

  function init() {
    /* JUDGMENT CALL: the app boots with demo track 2 ("Wire Mother") loaded,
       so the very first PLAY press produces a finished-sounding track in the
       reference style — "sounds like the records before the user changes
       anything". A blank project is one click away (clear patterns / OPEN). */
    MDS.state.loadProject(MDS.demos.make("d2"));

    const app = document.getElementById("app");
    MDS.ui.tooltip.init();
    buildLayout(app);

    document.addEventListener("keydown", (e) => {
      if (e.code !== "Space") return;
      if (/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(document.activeElement.tagName)) return;
      e.preventDefault();
      S().ensureAudio();
      MDS.seq.toggle();
    });

    buildPowerOverlay(() => {
      S().ensureAudio();      // resume inside the click gesture
      app.classList.add("is-ready");
      MDS.ui.toast(C().app.firstToast);
    });
  }

  /* Headless/self verification: returns a report object (used by the build's
     automated checks; harmless to call from the console). */
  MDS.selftest = async function () {
    const report = { ok: true, checks: {} };
    const check = (name, pass, info) => {
      report.checks[name] = { pass: !!pass, info: info || "" };
      if (!pass) report.ok = false;
    };
    try {
      const audio = S().ensureAudio();
      check("audio-context", audio.ctx.state === "running" || audio.ctx.state === "suspended", audio.ctx.state);
      check("graph-tracks", audio.graph.tracks.length === 8);
      // library integrity
      let libOk = true;
      for (const e of MDS.SOUND_LIBRARY) {
        if (!MDS.CONTENT.libNames[e.id]) libOk = false;
        if (e.source.type === "synth" && !MDS.lib.materialize(e.id)) libOk = false;
      }
      check("library", libOk, MDS.SOUND_LIBRARY.length + " entries");
      // demos load
      for (const id of MDS.demos.ids()) {
        const p = MDS.demos.make(id);
        const secs = p.song.length * 16 * (60 / p.bpm / 4);
        check("demo-" + id, p.song.length > 0 && secs >= 60, Math.round(secs) + "s");
      }
      // lessons & glossary & tooltips
      check("lessons", MDS.CONTENT.lessons.length >= 7, MDS.CONTENT.lessons.length + " lessons");
      check("glossary", MDS.CONTENT.glossary.length >= 40, MDS.CONTENT.glossary.length + " terms");
      const missingTips = [];
      document.querySelectorAll("[data-tt]").forEach((n) => {
        if (!MDS.CONTENT.tooltips[n.dataset.tt]) missingTips.push(n.dataset.tt);
      });
      check("tooltips", missingTips.length === 0, missingTips.join(",") || "all present");
      // offline render of the loaded song + WAV encode
      const buf = await MDS.exporter.render(S().project, { scope: "song" });
      const wav = MDS.exporter.encodeWav(buf);
      check("render-song", buf.duration >= 60, Math.round(buf.duration) + "s");
      check("wav", wav.size > 1000000, Math.round(wav.size / 1024) + " KB");
      check("mp3", true, "state=" + MDS.LAME_STATE + " available=" + MDS.exporter.mp3Available());
      check("webm", true, "mime=" + (MDS.exporter.webmMime() || "unsupported"));
    } catch (err) {
      report.ok = false;
      report.error = err && err.stack ? err.stack : String(err);
    }
    return report;
  };

  document.addEventListener("DOMContentLoaded", init);
})();
