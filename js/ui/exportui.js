/* ============================================================================
   ███ UI ███  exportui.js — the EXPORT dialog: offline render to WAV always,
   MP3 when lamejs loaded, OGG/WebM when MediaRecorder supports it, plus the
   project-file save (the app's only persistence, by design — no localStorage).
   ========================================================================== */
window.MDS = window.MDS || {};
MDS.ui = MDS.ui || {};

MDS.ui.exportDialog = (function () {
  "use strict";
  const C = () => MDS.CONTENT.export;
  const S = () => MDS.state;

  /* The one blob-download helper (topbar SAVE uses it too: two copies of
     this had already drifted once). */
  MDS.ui.download = function (blob, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  };
  const download = MDS.ui.download;

  function radio(name, value, label, checked, tip) {
    const wrap = document.createElement("label");
    wrap.className = "tbgroup";
    if (tip) wrap.dataset.tt = tip;
    const r = document.createElement("input");
    r.type = "radio"; r.name = name; r.value = value; r.checked = !!checked;
    const l = document.createElement("span"); l.textContent = label;
    wrap.append(r, l);
    return { wrap, r };
  }

  let isOpen = false;   // one dialog at a time: stacked modals stack Esc handlers
  let mp3Timer = null;  // re-checks a still-loading lamejs (see below)

  function open() {
    if (isOpen) return;
    isOpen = true;
    const m = MDS.ui.modal.open({
      title: C().title,
      onClose: () => { isOpen = false; clearInterval(mp3Timer); mp3Timer = null; },
    });

    /* project name */
    const nameWrap = document.createElement("label");
    nameWrap.className = "exp-row"; nameWrap.dataset.tt = "projName";
    const nl = document.createElement("span"); nl.textContent = MDS.CONTENT.transport.projName;
    const nameIn = document.createElement("input");
    nameIn.type = "text"; nameIn.value = S().project.name;
    // "name" keeps the topbar field in step; the dialog is rebuilt per open,
    // so the sync only needs to flow outward.
    nameIn.oninput = () => { S().project.name = nameIn.value; MDS.bus.emit("name"); };
    nameWrap.append(nl, nameIn);

    /* scope */
    const scopeRow = document.createElement("div"); scopeRow.className = "exp-row";
    const sl = document.createElement("h3"); sl.textContent = C().scope;
    const sSong = radio("exp-scope", "song", C().scopeSong, true, "expScope");
    const sPat = radio("exp-scope", "pattern", C().scopePattern, false, "expScope");
    scopeRow.append(sl, sSong.wrap, sPat.wrap);

    /* format */
    const fmtRow = document.createElement("div"); fmtRow.className = "exp-row";
    const fl = document.createElement("h3"); fl.textContent = C().format;
    const fWav = radio("exp-fmt", "wav", C().wav, true, "expFormat");
    const fMp3 = radio("exp-fmt", "mp3", C().mp3, false, "expFormat");
    const fWebm = radio("exp-fmt", "webm", C().webm, false, "expFormat");
    fmtRow.append(fl, fWav.wrap, fMp3.wrap, fWebm.wrap);

    const notes = document.createElement("div");
    if (!MDS.exporter.mp3Available()) {
      fMp3.r.disabled = true;
      const n = document.createElement("div"); n.className = "exp-note";
      n.textContent = C().mp3Unavailable;
      notes.appendChild(n);
      // lamejs may still be in flight from the CDN: re-enable if it lands
      // while this dialog is open, instead of demanding a reopen.
      if (MDS.LAME_STATE === "loading") {
        mp3Timer = setInterval(() => {
          if (!MDS.exporter.mp3Available()) return;
          fMp3.r.disabled = false;
          n.remove();
          clearInterval(mp3Timer); mp3Timer = null;
        }, 500);
      }
    }
    if (!MDS.exporter.webmMime()) {
      fWebm.r.disabled = true;
      const n = document.createElement("div"); n.className = "exp-note";
      n.textContent = C().webmUnavailable;
      notes.appendChild(n);
    }

    const log = document.createElement("div"); log.className = "exp-log";

    const render = document.createElement("button");
    render.textContent = C().render; render.dataset.tt = "expRender";
    render.onclick = async () => {
      const scope = sSong.r.checked ? "song" : "pattern";
      if (scope === "song" && !S().project.song.length) {
        log.textContent = C().emptySong; log.className = "exp-note"; return;
      }
      // Soft cap: render + encode are synchronous full-length allocations, so
      // an unbounded chain would freeze the tab or exhaust memory.
      if (scope === "song" && S().project.song.length > 300) {
        log.textContent = C().tooLong(S().project.song.length); log.className = "exp-note"; return;
      }
      const fmt = fMp3.r.checked ? "mp3" : fWebm.r.checked ? "webm" : "wav";
      render.disabled = true;
      log.className = "exp-log";
      log.textContent = C().rendering;
      try {
        const buffer = await MDS.exporter.render(S().project, { scope, patternIdx: S().sel.pattern });
        if (!document.contains(log)) return;   // dialog closed mid-render
        let blob, ext = fmt;
        if (fmt === "mp3" && MDS.exporter.mp3Available()) blob = MDS.exporter.encodeMp3(buffer, 192);
        else if (fmt === "webm") { blob = await MDS.exporter.recordCompressed(buffer); ext = blob.type.includes("ogg") ? "ogg" : "webm"; }
        else { blob = MDS.exporter.encodeWav(buffer); ext = "wav"; }
        download(blob, MDS.exporter.filename(S().project, ext));
        const secs = Math.round(buffer.duration);
        const size = blob.size > 1048576 ? (blob.size / 1048576).toFixed(1) + " MB" : Math.round(blob.size / 1024) + " KB";
        log.className = "exp-ok";
        log.textContent = C().done(secs, size);
      } catch (err) {
        log.className = "exp-note";
        log.textContent = C().err(err && err.message ? err.message : String(err));
      }
      render.disabled = false;
    };

    /* project JSON save */
    const saveJson = document.createElement("button");
    saveJson.textContent = C().saveJson; saveJson.dataset.tt = "save";
    saveJson.onclick = () => {
      const blob = new Blob([S().toJSON()], { type: "application/json" });
      download(blob, MDS.exporter.filename(S().project, "minidark.json"));
    };

    m.body.append(nameWrap, scopeRow, fmtRow, notes, log);
    m.foot.append(saveJson, Object.assign(document.createElement("span"), { className: "grow" }), render);
  }

  return { open };
})();
