/* ============================================================================
   ███ ENGINE ███  graph.js — builds the complete audio graph (track channels,
   shared FX buses, master chain) for ANY AudioContext: the live one and the
   OfflineAudioContext used by export. No DOM, no user-facing strings.

   Per-track channel:   voices → input → chLevel → muteG ┬→ master.input
                                                         └→ send[fx] → fx bus
   FX buses (shared):   dist, chorus, delay, verb, crush → return gain → master
   Master chain:        input → glue compressor → limiter → volume → destination
   ========================================================================== */
window.MDS = window.MDS || {};

MDS.graph = (function () {
  "use strict";
  const dsp = MDS.dsp;
  const NTRACKS = 8;
  const FX_KEYS = ["dist", "chorus", "delay", "verb", "crush"];

  /* Smoothing time constant for live knob changes (click-free). Offline
     contexts get instant values via the same setter (still fine). */
  const SMOOTH = 0.015;

  function build(ctx) {
    const g = { ctx, tracks: [], fx: {}, master: {} };

    /* ── Master chain ── */
    const mIn = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 20; comp.ratio.value = 3;
    comp.attack.value = 0.01; comp.release.value = 0.25;
    const limiter = ctx.createDynamicsCompressor();
    // Hard settings = brick-wall-ish safety so beginners can't clip the output.
    limiter.threshold.value = -2; limiter.knee.value = 0; limiter.ratio.value = 20;
    limiter.attack.value = 0.002; limiter.release.value = 0.1;
    const mVol = ctx.createGain(); mVol.gain.value = 0.9;
    mIn.connect(comp); comp.connect(limiter); limiter.connect(mVol); mVol.connect(ctx.destination);
    g.master = { input: mIn, comp, limiter, vol: mVol };

    /* ── FX buses ── */
    // Distortion: input → drive gain → waveshaper → tone LP → return
    {
      const input = ctx.createGain();
      const pre = ctx.createGain(); pre.gain.value = 1;
      const shaper = ctx.createWaveShaper(); shaper.oversample = "4x";
      shaper.curve = dsp.distCurve(0.5);
      const tone = ctx.createBiquadFilter(); tone.type = "lowpass"; tone.frequency.value = 4000;
      const ret = ctx.createGain(); ret.gain.value = 0.5;
      input.connect(pre); pre.connect(shaper); shaper.connect(tone); tone.connect(ret); ret.connect(mIn);
      g.fx.dist = { input, pre, shaper, tone, ret, _drive: 0.5 };
    }
    // Chorus: two modulated delays, LFOs in opposite phase for stereo width
    {
      const input = ctx.createGain();
      const merger = ctx.createChannelMerger(2);
      const ret = ctx.createGain(); ret.gain.value = 0.5;
      const lfo = ctx.createOscillator(); lfo.type = "sine"; lfo.frequency.value = 0.6;
      const mk = (invert) => {
        const dl = ctx.createDelay(0.1); dl.delayTime.value = 0.02;
        const depth = ctx.createGain(); depth.gain.value = 0.004 * (invert ? -1 : 1);
        lfo.connect(depth); depth.connect(dl.delayTime);
        input.connect(dl);
        return { dl, depth };
      };
      const L = mk(false), R = mk(true);
      L.dl.connect(merger, 0, 0); R.dl.connect(merger, 0, 1);
      merger.connect(ret); ret.connect(mIn);
      lfo.start();
      g.fx.chorus = { input, lfo, depthL: L.depth, depthR: R.depth, ret };
    }
    // Delay: tempo-synced, feedback loop with darkening tone filter
    {
      const input = ctx.createGain();
      const dl = ctx.createDelay(4); dl.delayTime.value = 0.375;
      const fb = ctx.createGain(); fb.gain.value = 0.35;
      const tone = ctx.createBiquadFilter(); tone.type = "lowpass"; tone.frequency.value = 3000;
      const ret = ctx.createGain(); ret.gain.value = 0.5;
      input.connect(dl); dl.connect(tone); tone.connect(fb); fb.connect(dl);
      tone.connect(ret); ret.connect(mIn);
      g.fx.delay = { input, dl, fb, tone, ret };
    }
    // Reverb: convolver with a procedurally generated IR
    {
      const input = ctx.createGain();
      const conv = ctx.createConvolver();
      conv.buffer = dsp.makeIR(ctx, 0.55, 0.4);
      const tone = ctx.createBiquadFilter(); tone.type = "lowpass"; tone.frequency.value = 6500;
      const ret = ctx.createGain(); ret.gain.value = 0.5;
      input.connect(conv); conv.connect(tone); tone.connect(ret); ret.connect(mIn);
      g.fx.verb = { input, conv, tone, ret, _size: 11, _tone: 8 }; // quantized ×20, matches apply()
    }
    // Bitcrusher: staircase waveshaper (see dsp.crushCurve for rationale)
    {
      const input = ctx.createGain();
      const shaper = ctx.createWaveShaper(); shaper.curve = dsp.crushCurve(8);
      const ret = ctx.createGain(); ret.gain.value = 0.4;
      input.connect(shaper); shaper.connect(ret); ret.connect(mIn);
      g.fx.crush = { input, shaper, ret, _bits: 8 };
    }

    /* ── Track channels ── */
    for (let i = 0; i < NTRACKS; i++) {
      const input = ctx.createGain();
      const chLevel = ctx.createGain(); chLevel.gain.value = 0.8;
      const muteG = ctx.createGain(); muteG.gain.value = 1;
      input.connect(chLevel); chLevel.connect(muteG); muteG.connect(mIn);
      const sends = {};
      for (const k of FX_KEYS) {
        const s = ctx.createGain(); s.gain.value = 0;
        muteG.connect(s); s.connect(g.fx[k].input);
        sends[k] = s;
      }
      g.tracks.push({ input, chLevel, muteG, sends });
    }

    return g;
  }

  function setParam(param, value, ctx) {
    // Offline render wants exact initial values; live wants smooth ramps.
    if (ctx instanceof (window.OfflineAudioContext || function () {})) {
      param.value = value;
    } else {
      param.setTargetAtTime(value, ctx.currentTime, SMOOTH);
    }
  }

  /* Sync every graph node from project state. Cheap enough to call whole-hog
     on any knob change. */
  function apply(g, project) {
    const ctx = g.ctx;
    const fx = project.fx;

    // Curve rebuilds are guarded like the reverb IR below: apply() runs per
    // pointermove of ANY knob (incl. tempo/volume), and regenerating a
    // 2048/8192-point Float32Array per move is pure waste when unchanged.
    if (g.fx.dist._drive !== fx.dist.drive) {
      g.fx.dist.shaper.curve = dsp.distCurve(fx.dist.drive);
      g.fx.dist._drive = fx.dist.drive;
    }
    setParam(g.fx.dist.tone.frequency, 600 + fx.dist.tone * 7400, ctx);
    setParam(g.fx.dist.ret.gain, fx.dist.level, ctx);

    setParam(g.fx.chorus.lfo.frequency, 0.1 + fx.chorus.rate * 4.9, ctx);
    setParam(g.fx.chorus.depthL.gain, fx.chorus.depth * 0.008, ctx);
    setParam(g.fx.chorus.depthR.gain, -fx.chorus.depth * 0.008, ctx);
    setParam(g.fx.chorus.ret.gain, fx.chorus.level, ctx);

    setParam(g.fx.delay.dl.delayTime, delaySeconds(project.bpm, fx.delay.div), ctx);
    setParam(g.fx.delay.fb.gain, Math.min(0.85, fx.delay.fb), ctx);
    setParam(g.fx.delay.tone.frequency, 500 + fx.delay.tone * 7500, ctx);
    setParam(g.fx.delay.ret.gain, fx.delay.level, ctx);

    // Quantized exactly like dsp.makeIR's cache key, so this guard and that
    // cache agree on what counts as "changed" (they used to disagree).
    const qs = Math.round(fx.verb.size * 20), qt = Math.round(fx.verb.tone * 20);
    if (g.fx.verb._size !== qs || g.fx.verb._tone !== qt) {
      g.fx.verb.conv.buffer = dsp.makeIR(ctx, fx.verb.size, fx.verb.tone);
      g.fx.verb._size = qs; g.fx.verb._tone = qt;
    }
    setParam(g.fx.verb.tone.frequency, 1200 + fx.verb.tone * 8800, ctx);
    setParam(g.fx.verb.ret.gain, fx.verb.level, ctx);

    if (g.fx.crush._bits !== fx.crush.bits) {
      g.fx.crush.shaper.curve = dsp.crushCurve(fx.crush.bits);
      g.fx.crush._bits = fx.crush.bits;
    }
    setParam(g.fx.crush.ret.gain, fx.crush.level, ctx);

    // Master: "glue" macro maps one knob onto threshold+ratio
    const glue = project.master.comp;
    g.master.comp.threshold.value = -10 - glue * 20;
    g.master.comp.ratio.value = 1.5 + glue * 4;
    setParam(g.master.vol.gain, project.master.vol, ctx);

    applyMixer(g, project);
  }

  /* Per-channel memo: applyMixer is the onInput of every send knob and
     channel fader, so without it one knob drag reschedules all 56 params
     (8 tracks × level+mute+5 sends) per pointermove. */
  function applyMixer(g, project) {
    const ctx = g.ctx;
    const anySolo = project.tracks.some((t) => t.solo);
    project.tracks.forEach((t, i) => {
      const ch = g.tracks[i];
      const m = ch._last || (ch._last = { level: NaN, audible: NaN, sends: {} });
      if (m.level !== t.level) { setParam(ch.chLevel.gain, t.level, ctx); m.level = t.level; }
      const audible = !t.mute && (!anySolo || t.solo) ? 1 : 0;
      if (m.audible !== audible) { setParam(ch.muteG.gain, audible, ctx); m.audible = audible; }
      for (const k of FX_KEYS) {
        if (m.sends[k] !== t.sends[k]) { setParam(ch.sends[k].gain, t.sends[k], ctx); m.sends[k] = t.sends[k]; }
      }
    });
  }

  /* Step divisions in beats (module-level: called per apply, allocation-free). */
  const DIV_BEATS = { "1/16": 0.25, "1/8": 0.5, "3/16": 0.75, "1/4": 1 };
  function delaySeconds(bpm, div) {
    const beat = 60 / bpm;
    return Math.min(3.9, beat * (DIV_BEATS[div] || 0.75));
  }

  return { build, apply, applyMixer, delaySeconds, NTRACKS, FX_KEYS };
})();
