/* ============================================================================
   ███ ENGINE ███  export.js — deterministic offline rendering + encoders.
   Rendering ALWAYS uses OfflineAudioContext (never records live playback):
   the full graph is rebuilt inside the offline context and every step is
   scheduled sample-exactly with the same scheduleStep used live.
   No DOM (blob download handled by UI), no user-facing strings.
   ========================================================================== */
window.MDS = window.MDS || {};

MDS.exporter = (function () {
  "use strict";
  const SR = 44100;
  const TAIL = 2.5; // seconds of reverb/delay tail after the last bar

  /* A fixed tail truncates slow sounds: a pad with r=1.4 rings ~5.6 s past
     its note end (adsr stops at r*4). Look at what actually plays in the
     chain's FINAL bar and extend the tail by the longest release there. */
  function tailSecs(project, lastPatternIdx) {
    const pat = project.patterns[lastPatternIdx];
    let extra = 0;
    if (pat) {
      project.tracks.forEach((tr, ti) => {
        const p = tr.patch;
        if (!p || !pat.steps[ti] || !pat.steps[ti].some((c) => c && c.on)) return;
        const rel = p.engine === "sub" || p.engine === "fm" ? (p.r || 0.05) * 4
          : p.engine === "pluck" ? 0.4 + (p.decay || 0) * 0.35
          : 0.3;
        if (rel > extra) extra = rel;
      });
    }
    return TAIL + extra;
  }

  /* Render the project. scope: 'song' (whole chain) | 'pattern' (current
     pattern looped 4×, handy while sketching). Resolves to an AudioBuffer. */
  function render(project, opts) {
    const scope = (opts && opts.scope) || "song";
    const patternIdx = (opts && opts.patternIdx) || 0;
    const chain = scope === "song"
      ? project.song.slice()
      : [patternIdx, patternIdx, patternIdx, patternIdx];
    if (!chain.length) return Promise.reject(new Error("empty-song"));

    const sDur = 60 / project.bpm / 4;
    const totalSteps = chain.length * 16;
    const durSecs = totalSteps * sDur + tailSecs(project, chain[chain.length - 1]);
    const ctx = new OfflineAudioContext(2, Math.ceil(SR * durSecs), SR);
    const g = MDS.graph.build(ctx);
    MDS.graph.apply(g, project);

    const lastNotes = new Array(8).fill(null);
    const t0 = 0.05;
    for (let bar = 0; bar < chain.length; bar++) {
      for (let s = 0; s < 16; s++) {
        const base = t0 + (bar * 16 + s) * sDur;
        const t = base + (s % 2 === 1 ? project.swing * sDur * 0.5 : 0);
        MDS.seq.scheduleStep(g, project, chain[bar], s, t, sDur, lastNotes);
      }
    }
    return ctx.startRendering();
  }

  /* ── WAV: manual PCM encode, 44.1 kHz / 16-bit / stereo ────────────── */
  function encodeWav(buffer) {
    const nCh = Math.min(2, buffer.numberOfChannels);
    const len = buffer.length;
    const bytesPerSample = 2;
    const blockAlign = nCh * bytesPerSample;
    const dataSize = len * blockAlign;
    const ab = new ArrayBuffer(44 + dataSize);
    const dv = new DataView(ab);
    let p = 0;
    const wStr = (s) => { for (let i = 0; i < s.length; i++) dv.setUint8(p++, s.charCodeAt(i)); };
    const w32 = (v) => { dv.setUint32(p, v, true); p += 4; };
    const w16 = (v) => { dv.setUint16(p, v, true); p += 2; };
    wStr("RIFF"); w32(36 + dataSize); wStr("WAVE");
    wStr("fmt "); w32(16); w16(1); w16(nCh); w32(buffer.sampleRate);
    w32(buffer.sampleRate * blockAlign); w16(blockAlign); w16(16);
    wStr("data"); w32(dataSize);
    const chans = [];
    for (let c = 0; c < nCh; c++) chans.push(buffer.getChannelData(c));
    for (let i = 0; i < len; i++) {
      for (let c = 0; c < nCh; c++) {
        const x = Math.max(-1, Math.min(1, chans[c][i]));
        dv.setInt16(p, x < 0 ? x * 0x8000 : x * 0x7fff, true); p += 2;
      }
    }
    return new Blob([ab], { type: "audio/wav" });
  }

  /* ── MP3 via lamejs (loaded from cdnjs in index.html) ──────────────────
     Availability is a runtime question: index.html sets MDS.LAME_STATE to
     'ok' | 'failed' | 'loading'. The build environment could not reach cdnjs
     (network policy), so the graceful WAV-only fallback is load-bearing —
     the encoder itself was verified against the same lamejs 1.2.0 build
     pulled from npm. */
  function mp3Available() {
    return MDS.LAME_STATE === "ok" && typeof window.lamejs !== "undefined";
  }

  function encodeMp3(buffer, kbps) {
    const enc = new window.lamejs.Mp3Encoder(2, buffer.sampleRate, kbps || 192);
    const len = buffer.length;
    const L = buffer.getChannelData(0);
    const R = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : L;
    const li = new Int16Array(len), ri = new Int16Array(len);
    for (let i = 0; i < len; i++) {
      li[i] = Math.max(-32768, Math.min(32767, L[i] * 32767));
      ri[i] = Math.max(-32768, Math.min(32767, R[i] * 32767));
    }
    const chunks = [];
    const BLK = 1152;
    for (let i = 0; i < len; i += BLK) {
      const b = enc.encodeBuffer(li.subarray(i, i + BLK), ri.subarray(i, i + BLK));
      if (b.length) chunks.push(new Uint8Array(b));
    }
    const fin = enc.flush();
    if (fin.length) chunks.push(new Uint8Array(fin));
    return new Blob(chunks, { type: "audio/mpeg" });
  }

  /* ── OGG/WebM via MediaRecorder (optional; spec-sanctioned exception to
     the no-live-recording rule, since browsers expose no offline Opus
     encoder). The SOURCE is still the deterministic offline render — we
     play the finished buffer into a MediaStreamDestination and record. */
  function webmMime() {
    if (typeof MediaRecorder === "undefined") return null;
    for (const m of ["audio/ogg;codecs=opus", "audio/webm;codecs=opus", "audio/webm"]) {
      if (MediaRecorder.isTypeSupported(m)) return m;
    }
    return null;
  }

  function recordCompressed(buffer) {
    return new Promise((resolve, reject) => {
      const mime = webmMime();
      if (!mime) return reject(new Error("webm-unsupported"));
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const src = ctx.createBufferSource(); src.buffer = buffer;
      const dest = ctx.createMediaStreamDestination();
      src.connect(dest);
      const rec = new MediaRecorder(dest.stream, { mimeType: mime });
      const chunks = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      rec.onstop = () => { ctx.close(); resolve(new Blob(chunks, { type: mime })); };
      rec.onerror = (e) => { ctx.close(); reject(e.error || new Error("recorder")); };
      rec.start();
      src.onended = () => setTimeout(() => rec.stop(), 200);
      src.start();
    });
  }

  function filename(project, ext) {
    const slug = (project.name || "minidark-track")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "minidark-track";
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${slug}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.${ext}`;
  }

  return { render, encodeWav, encodeMp3, mp3Available, webmMime, recordCompressed, filename, TAIL, tailSecs };
})();
