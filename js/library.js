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
  { id: "kickSub", category: "drums", tags: ["kick", "sub", "deep"], track: 0,
    source: { type: "synth", patch: { engine: "drum", kind: "kick", dTune: 0.85, dDecay: 0.8, dTone: 0.15, dDrive: 0.1, gain: 1 } } },
  { id: "kickRust", category: "drums", tags: ["kick", "distorted", "industrial"], track: 0,
    source: { type: "synth", patch: { engine: "drum", kind: "kick", dTune: 1.05, dDecay: 0.4, dTone: 0.55, dDrive: 0.9, gain: 0.95 } } },
  { id: "snare909", category: "drums", tags: ["snare", "909"], track: 1,
    source: { type: "synth", patch: { engine: "drum", kind: "snare", dTune: 1, dDecay: 0.5, dTone: 0.55, dDrive: 0.2, gain: 0.9 } } },
  { id: "snareTight", category: "drums", tags: ["snare", "dry", "tight"], track: 1,
    source: { type: "synth", patch: { engine: "drum", kind: "snare", dTune: 1.2, dDecay: 0.22, dTone: 0.75, dDrive: 0.1, gain: 0.85 } } },
  { id: "snareGate", category: "drums", tags: ["snare", "gated", "80s", "big"], track: 1,
    source: { type: "synth", patch: { engine: "drum", kind: "snare", dTune: 0.95, dDecay: 0.85, dTone: 0.7, dDrive: 0.5, gain: 0.9 } } },
  { id: "snare808", category: "drums", tags: ["snare", "808", "thin"], track: 1,
    source: { type: "synth", patch: { engine: "drum", kind: "snare", dTune: 0.9, dDecay: 0.35, dTone: 0.3, dDrive: 0.05, gain: 0.85 } } },
  { id: "snareGlitch", category: "drums", tags: ["snare", "glitch", "short", "bright"], track: 1,
    source: { type: "synth", patch: { engine: "drum", kind: "snare", dTune: 1.95, dDecay: 0.06, dTone: 1, dDrive: 0.8, gain: 0.8 } } },
  { id: "snareClap", category: "drums", tags: ["snare", "clap", "layered"], track: 1,
    source: { type: "synth", patch: { engine: "drum", kind: "clap", dTune: 1.1, dDecay: 0.6, dTone: 0.75, dDrive: 0.3, gain: 0.85 } } },
  { id: "hatC", category: "drums", tags: ["hihat", "closed"], track: 2,
    source: { type: "synth", patch: { engine: "drum", kind: "hatC", dTune: 1, dDecay: 0.4, dTone: 0.6, dDrive: 0, gain: 0.7 } } },
  { id: "hatO", category: "drums", tags: ["hihat", "open"], track: 2,
    source: { type: "synth", patch: { engine: "drum", kind: "hatO", dTune: 1, dDecay: 0.45, dTone: 0.55, dDrive: 0, gain: 0.6 } } },
  { id: "hatTick", category: "drums", tags: ["hihat", "closed", "tight", "bright"], track: 2,
    source: { type: "synth", patch: { engine: "drum", kind: "hatC", dTune: 1.5, dDecay: 0.15, dTone: 0.95, dDrive: 0, gain: 0.6 } } },
  { id: "hatSizzle", category: "drums", tags: ["hihat", "open", "long"], track: 2,
    source: { type: "synth", patch: { engine: "drum", kind: "hatO", dTune: 0.9, dDecay: 0.85, dTone: 0.75, dDrive: 0.15, gain: 0.55 } } },
  { id: "clap909", category: "drums", tags: ["clap", "909"], track: 3,
    source: { type: "synth", patch: { engine: "drum", kind: "clap", dTune: 1, dDecay: 0.45, dTone: 0.5, dDrive: 0.15, gain: 0.85 } } },
  { id: "clapRoom", category: "drums", tags: ["clap", "room", "wide"], track: 3,
    source: { type: "synth", patch: { engine: "drum", kind: "clap", dTune: 0.95, dDecay: 0.8, dTone: 0.35, dDrive: 0.1, gain: 0.8 } } },
  /* ── Industrial hits ── */
  { id: "grind", category: "fxhit", tags: ["industrial", "noise", "burst"], track: 3,
    source: { type: "synth", patch: { engine: "drum", kind: "grind", dTune: 1, dDecay: 0.4, dTone: 0.6, dDrive: 0.85, gain: 0.8 } } },
  { id: "clank", category: "fxhit", tags: ["industrial", "metal", "fm"], track: 3,
    source: { type: "synth", patch: { engine: "drum", kind: "clank", dTune: 1, dDecay: 0.5, dTone: 0.6, dDrive: 0.5, gain: 0.8 } } },
  { id: "anvil", category: "fxhit", tags: ["industrial", "metal", "high"], track: 3,
    source: { type: "synth", patch: { engine: "drum", kind: "clank", dTune: 1.7, dDecay: 0.35, dTone: 0.85, dDrive: 0.35, gain: 0.8 } } },
  { id: "scrape", category: "fxhit", tags: ["industrial", "noise", "long"], track: 3,
    source: { type: "synth", patch: { engine: "drum", kind: "grind", dTune: 0.8, dDecay: 0.85, dTone: 0.3, dDrive: 0.6, gain: 0.75 } } },
  /* ── Basses ── */
  { id: "bassNail", category: "bass", tags: ["mono", "distorted", "16ths"], track: 4, baseNote: 33,
    source: { type: "synth", patch: { engine: "sub", osc1: "sawtooth", osc2: "square", semi: -12, detune: 6, mix: 0.45, glide: 0.03,
      cutoff: 320, res: 7, envAmt: 2600, fDec: 0.12, a: 0.002, d: 0.14, s: 0.12, r: 0.05, drive: 0.6, gain: 0.95 } } },
  { id: "bassRubber", category: "bass", tags: ["sub", "round"], track: 4, baseNote: 33,
    source: { type: "synth", patch: { engine: "sub", osc1: "triangle", osc2: "sine", semi: -12, detune: 3, mix: 0.5, glide: 0.05,
      cutoff: 420, res: 3, envAmt: 900, fDec: 0.2, a: 0.004, d: 0.22, s: 0.35, r: 0.08, drive: 0.15, gain: 0.95 } } },
  { id: "bassAcid", category: "bass", tags: ["acid", "resonant", "squelch"], track: 4, baseNote: 33,
    source: { type: "synth", patch: { engine: "sub", osc1: "sawtooth", osc2: "sawtooth", semi: 0, detune: 4, mix: 0.3, glide: 0.06,
      cutoff: 260, res: 14, envAmt: 3200, fDec: 0.16, a: 0.002, d: 0.1, s: 0.05, r: 0.06, drive: 0.35, gain: 0.9 } } },
  { id: "bassGrind", category: "bass", tags: ["industrial", "distorted", "heavy"], track: 4, baseNote: 33,
    source: { type: "synth", patch: { engine: "sub", osc1: "square", osc2: "sawtooth", semi: -12, detune: 10, mix: 0.5, glide: 0.02,
      cutoff: 220, res: 5, envAmt: 1800, fDec: 0.2, a: 0.003, d: 0.3, s: 0.4, r: 0.08, drive: 0.85, gain: 0.85 } } },
  { id: "bassPluck", category: "bass", tags: ["pluck", "short", "dry"], track: 4, baseNote: 33,
    source: { type: "synth", patch: { engine: "sub", osc1: "triangle", osc2: "pulse", semi: 0, detune: 4, mix: 0.35, glide: 0,
      cutoff: 700, res: 4, envAmt: 1500, fDec: 0.08, a: 0.002, d: 0.09, s: 0, r: 0.05, drive: 0.1, gain: 0.9 } } },
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
  { id: "leadNeon", category: "lead", tags: ["bright", "pulse", "octave"], track: 5, baseNote: 69,
    source: { type: "synth", patch: { engine: "sub", osc1: "pulse", osc2: "pulse", semi: 12, detune: 12, mix: 0.45, glide: 0,
      cutoff: 2400, res: 6, envAmt: 1800, fDec: 0.14, a: 0.004, d: 0.18, s: 0.25, r: 0.12, drive: 0.2, gain: 0.6 } } },
  { id: "leadBlade", category: "lead", tags: ["aggressive", "saw", "wide"], track: 5, baseNote: 57,
    source: { type: "synth", patch: { engine: "sub", osc1: "sawtooth", osc2: "square", semi: 0, detune: 18, mix: 0.55, glide: 0.02,
      cutoff: 1300, res: 8, envAmt: 3000, fDec: 0.25, a: 0.006, d: 0.35, s: 0.4, r: 0.18, drive: 0.45, gain: 0.62 } } },
  { id: "stabDark", category: "lead", tags: ["stab", "dark", "chords"], track: 5, baseNote: 57,
    source: { type: "synth", patch: { engine: "sub", osc1: "sawtooth", osc2: "sawtooth", semi: -12, detune: 9, mix: 0.5, glide: 0,
      cutoff: 480, res: 3, envAmt: 2200, fDec: 0.18, a: 0.01, d: 0.22, s: 0.12, r: 0.1, drive: 0.3, gain: 0.7 } } },
  /* ── Pads ── */
  { id: "padWarm", category: "pad", tags: ["warm", "slow", "chords"], track: 6, baseNote: 57,
    source: { type: "synth", patch: { engine: "sub", osc1: "sawtooth", osc2: "sawtooth", semi: 0, detune: 12, mix: 0.5, glide: 0,
      cutoff: 900, res: 1.5, envAmt: 600, fDec: 1.2, a: 0.6, d: 0.8, s: 0.8, r: 0.9, drive: 0, gain: 0.5 } } },
  { id: "padGlass", category: "pad", tags: ["cold", "glassy", "thin"], track: 6, baseNote: 69,
    source: { type: "synth", patch: { engine: "sub", osc1: "pulse", osc2: "triangle", semi: 12, detune: 8, mix: 0.4, glide: 0,
      cutoff: 2200, res: 3, envAmt: 300, fDec: 1.5, a: 0.4, d: 1, s: 0.7, r: 1.1, drive: 0, gain: 0.42 } } },
  { id: "padDark", category: "pad", tags: ["dark", "low", "slow"], track: 6, baseNote: 45,
    source: { type: "synth", patch: { engine: "sub", osc1: "sawtooth", osc2: "triangle", semi: -12, detune: 10, mix: 0.45, glide: 0,
      cutoff: 520, res: 2, envAmt: 400, fDec: 1.4, a: 0.8, d: 1.2, s: 0.85, r: 1.4, drive: 0.1, gain: 0.5 } } },
  { id: "padChoir", category: "pad", tags: ["soft", "vocal", "high"], track: 6, baseNote: 57,
    source: { type: "synth", patch: { engine: "sub", osc1: "triangle", osc2: "sine", semi: 12, detune: 6, mix: 0.4, glide: 0,
      cutoff: 1400, res: 1.2, envAmt: 200, fDec: 1.5, a: 0.5, d: 1, s: 0.9, r: 1.2, drive: 0, gain: 0.48 } } },
  { id: "padSweep", category: "pad", tags: ["sweep", "filter", "movement"], track: 6, baseNote: 45,
    source: { type: "synth", patch: { engine: "sub", osc1: "pulse", osc2: "sawtooth", semi: 0, detune: 14, mix: 0.5, glide: 0,
      cutoff: 300, res: 6, envAmt: 4200, fDec: 1.5, a: 0.45, d: 1.1, s: 0.75, r: 1.1, drive: 0.15, gain: 0.45 } } },
  /* ── FM ── */
  { id: "fmBell", category: "fm", tags: ["bell", "metallic", "fm"], track: 5, baseNote: 69,
    source: { type: "synth", patch: { engine: "fm", ratio: 3.5, index: 6, iDec: 0.35, a: 0.002, d: 0.5, s: 0.1, r: 0.4, gain: 0.6 } } },
  { id: "fmTwang", category: "fm", tags: ["twang", "wire", "pluck"], track: 5, baseNote: 57,
    source: { type: "synth", patch: { engine: "fm", ratio: 2.01, index: 3.2, iDec: 0.12, a: 0.002, d: 0.2, s: 0.15, r: 0.1, gain: 0.65 } } },
  { id: "fmScrap", category: "fm", tags: ["metal", "inharmonic", "long"], track: 5, baseNote: 57,
    source: { type: "synth", patch: { engine: "fm", ratio: 5.43, index: 8, iDec: 0.9, a: 0.002, d: 0.9, s: 0.15, r: 0.7, gain: 0.55 } } },
  { id: "fmWood", category: "fm", tags: ["wood", "block", "short"], track: 5, baseNote: 48,
    source: { type: "synth", patch: { engine: "fm", ratio: 2, index: 2.2, iDec: 0.08, a: 0.002, d: 0.16, s: 0.05, r: 0.08, gain: 0.7 } } },
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
