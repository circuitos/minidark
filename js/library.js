/* ============================================================================
   ███ ENGINE / DATA ███  library.js — SOUND_LIBRARY registry + loader.

   REGISTRY SCHEMA (pure data — append entries, never logic):
     {
       id:       string   unique key. Display name lives in CONTENT.libNames[id]
                          (CONTENT owns all user-facing strings).
       category: string   one of: drums | bass | lead | pad | fm | fxhit
       tags:     [string] free-form search/filter hints (not user-facing copy)
       track:    number?  suggested default track index (0..7), optional
       baseNote: number?  suggested MIDI note for previews/steps, optional
       source:   one of
         { type:"synth",  patch:{...} }        synthesized; patch feeds
                                               js/engine/synth.js. patch.engine:
                                               "sub" | "fm" | "drum"
         { type:"base64", mime, data }         embedded audio file (decoded via
                                               decodeAudioData at load time)
         { type:"url",    href }               remote audio file (fetched then
                                               decoded)
     }
   v1 ships 100% synth sources (no audio assets needed), but resolve()
   already implements all three types so the library can grow by appending
   entries with NO logic changes.

   PATCH SCHEMAS (source.type === "synth"):
     engine:"sub"  — osc1/osc2: "sawtooth"|"pulse"|"square"|"triangle"|"sine",
                     semi (osc2 semitones), detune (cents), mix (0..1),
                     glide (s), cutoff (Hz), res (Q), envAmt (Hz), fDec (s),
                     a,d,s,r (ADSR), drive (0..1), gain (0..1)
     engine:"fm"   — ratio, index, iDec (s), a,d,s,r, gain
     engine:"drum" — kind: "kick"|"snare"|"hatC"|"hatO"|"clap"|"grind"|"clank",
                     dTune (rate mult), dDecay (0..1), dTone (0..1),
                     dDrive (0..1), gain
   ========================================================================== */
window.MDS = window.MDS || {};

MDS.SOUND_LIBRARY = [
  /* ── Drums ── */
  { id: "kick808", category: "drums", tags: ["kick", "808", "boom"], track: 0,
    source: { type: "synth", patch: { engine: "drum", kind: "kick", dTune: 1, dDecay: 0.55, dTone: 0.35, dDrive: 0.25, gain: 1 } } },
  { id: "kick909", category: "drums", tags: ["kick", "909", "punch"], track: 0,
    source: { type: "synth", patch: { engine: "drum", kind: "kick", dTune: 1.15, dDecay: 0.3, dTone: 0.7, dDrive: 0.45, gain: 1 } } },
  { id: "snare909", category: "drums", tags: ["snare", "909"], track: 1,
    source: { type: "synth", patch: { engine: "drum", kind: "snare", dTune: 1, dDecay: 0.5, dTone: 0.55, dDrive: 0.2, gain: 0.9 } } },
  { id: "snareTight", category: "drums", tags: ["snare", "dry", "tight"], track: 1,
    source: { type: "synth", patch: { engine: "drum", kind: "snare", dTune: 1.2, dDecay: 0.22, dTone: 0.75, dDrive: 0.1, gain: 0.85 } } },
  { id: "hatC", category: "drums", tags: ["hihat", "closed"], track: 2,
    source: { type: "synth", patch: { engine: "drum", kind: "hatC", dTune: 1, dDecay: 0.4, dTone: 0.6, dDrive: 0, gain: 0.7 } } },
  { id: "hatO", category: "drums", tags: ["hihat", "open"], track: 2,
    source: { type: "synth", patch: { engine: "drum", kind: "hatO", dTune: 1, dDecay: 0.45, dTone: 0.55, dDrive: 0, gain: 0.6 } } },
  { id: "clap909", category: "drums", tags: ["clap", "909"], track: 3,
    source: { type: "synth", patch: { engine: "drum", kind: "clap", dTune: 1, dDecay: 0.45, dTone: 0.5, dDrive: 0.15, gain: 0.85 } } },
  /* ── Industrial hits ── */
  { id: "grind", category: "fxhit", tags: ["industrial", "noise", "burst"], track: 3,
    source: { type: "synth", patch: { engine: "drum", kind: "grind", dTune: 1, dDecay: 0.4, dTone: 0.6, dDrive: 0.85, gain: 0.8 } } },
  { id: "clank", category: "fxhit", tags: ["industrial", "metal", "fm"], track: 3,
    source: { type: "synth", patch: { engine: "drum", kind: "clank", dTune: 1, dDecay: 0.5, dTone: 0.6, dDrive: 0.5, gain: 0.8 } } },
  /* ── Basses ── */
  { id: "bassNail", category: "bass", tags: ["mono", "distorted", "16ths"], track: 4, baseNote: 33,
    source: { type: "synth", patch: { engine: "sub", osc1: "sawtooth", osc2: "square", semi: -12, detune: 6, mix: 0.45, glide: 0.03,
      cutoff: 320, res: 7, envAmt: 2600, fDec: 0.12, a: 0.002, d: 0.14, s: 0.12, r: 0.05, drive: 0.6, gain: 0.95 } } },
  { id: "bassRubber", category: "bass", tags: ["sub", "round"], track: 4, baseNote: 33,
    source: { type: "synth", patch: { engine: "sub", osc1: "triangle", osc2: "sine", semi: -12, detune: 3, mix: 0.5, glide: 0.05,
      cutoff: 420, res: 3, envAmt: 900, fDec: 0.2, a: 0.004, d: 0.22, s: 0.35, r: 0.08, drive: 0.15, gain: 0.95 } } },
  /* ── Leads / stabs ── */
  { id: "stabBrass", category: "lead", tags: ["stab", "brass", "chords"], track: 5, baseNote: 57,
    source: { type: "synth", patch: { engine: "sub", osc1: "sawtooth", osc2: "sawtooth", semi: 0, detune: 14, mix: 0.5, glide: 0,
      cutoff: 700, res: 2.5, envAmt: 3400, fDec: 0.22, a: 0.012, d: 0.28, s: 0.18, r: 0.12, drive: 0.25, gain: 0.75 } } },
  { id: "leadCold", category: "lead", tags: ["arp", "cold", "pulse"], track: 7, baseNote: 69,
    source: { type: "synth", patch: { engine: "sub", osc1: "pulse", osc2: "pulse", semi: 0, detune: 9, mix: 0.35, glide: 0,
      cutoff: 1600, res: 5, envAmt: 2200, fDec: 0.09, a: 0.002, d: 0.12, s: 0.08, r: 0.06, drive: 0.1, gain: 0.6 } } },
  { id: "leadHollow", category: "lead", tags: ["hollow", "square", "solo"], track: 5, baseNote: 69,
    source: { type: "synth", patch: { engine: "sub", osc1: "square", osc2: "pulse", semi: -12, detune: 5, mix: 0.3, glide: 0.06,
      cutoff: 1100, res: 6, envAmt: 1800, fDec: 0.3, a: 0.01, d: 0.25, s: 0.5, r: 0.2, drive: 0.2, gain: 0.6 } } },
  /* ── Pads ── */
  { id: "padWarm", category: "pad", tags: ["warm", "slow", "chords"], track: 6, baseNote: 57,
    source: { type: "synth", patch: { engine: "sub", osc1: "sawtooth", osc2: "sawtooth", semi: 0, detune: 12, mix: 0.5, glide: 0,
      cutoff: 900, res: 1.5, envAmt: 600, fDec: 1.2, a: 0.6, d: 0.8, s: 0.8, r: 0.9, drive: 0, gain: 0.5 } } },
  { id: "padGlass", category: "pad", tags: ["cold", "glassy", "thin"], track: 6, baseNote: 69,
    source: { type: "synth", patch: { engine: "sub", osc1: "pulse", osc2: "triangle", semi: 12, detune: 8, mix: 0.4, glide: 0,
      cutoff: 2200, res: 3, envAmt: 300, fDec: 1.5, a: 0.4, d: 1, s: 0.7, r: 1.1, drive: 0, gain: 0.42 } } },
  /* ── FM ── */
  { id: "fmBell", category: "fm", tags: ["bell", "metallic", "fm"], track: 5, baseNote: 69,
    source: { type: "synth", patch: { engine: "fm", ratio: 3.5, index: 6, iDec: 0.35, a: 0.002, d: 0.5, s: 0.1, r: 0.4, gain: 0.6 } } },
  { id: "fmTwang", category: "fm", tags: ["twang", "wire", "pluck"], track: 5, baseNote: 57,
    source: { type: "synth", patch: { engine: "fm", ratio: 2.01, index: 3.2, iDec: 0.12, a: 0.002, d: 0.2, s: 0.15, r: 0.1, gain: 0.65 } } },
];

MDS.lib = (function () {
  "use strict";
  const byId = {};
  for (const e of MDS.SOUND_LIBRARY) byId[e.id] = e;

  const bufferCache = {}; // id → AudioBuffer (decoded base64/url sources)

  function get(id) { return byId[id]; }

  /* Deep-copy a playable patch for a track, so knob edits never mutate the
     registry. Buffer-backed sources become {engine:"buffer"} patches whose
     .buffer is filled asynchronously by resolve(). */
  function materialize(id) {
    const e = byId[id];
    if (!e) return null;
    if (e.source.type === "synth") return JSON.parse(JSON.stringify(e.source.patch));
    return { engine: "buffer", buffer: bufferCache[id] || null, dTune: 1, gain: 0.9, _pendingId: id };
  }

  function base64ToArrayBuffer(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }

  /* Resolve an entry so it is ready to play in the given context.
     Handles all three source types (see schema above). */
  function resolve(ctx, id) {
    const e = byId[id];
    if (!e) return Promise.reject(new Error("unknown-sound:" + id));
    switch (e.source.type) {
      case "synth":
        return Promise.resolve(e.source.patch);
      case "base64":
        if (bufferCache[id]) return Promise.resolve(bufferCache[id]);
        return ctx.decodeAudioData(base64ToArrayBuffer(e.source.data))
          .then((buf) => { bufferCache[id] = buf; return buf; });
      case "url":
        if (bufferCache[id]) return Promise.resolve(bufferCache[id]);
        return fetch(e.source.href)
          .then((r) => { if (!r.ok) throw new Error("fetch:" + r.status); return r.arrayBuffer(); })
          .then((ab) => ctx.decodeAudioData(ab))
          .then((buf) => { bufferCache[id] = buf; return buf; });
      default:
        return Promise.reject(new Error("unknown-source-type"));
    }
  }

  function list(category) {
    return MDS.SOUND_LIBRARY.filter((e) => !category || category === "all" || e.category === category);
  }

  return { get, materialize, resolve, list };
})();
