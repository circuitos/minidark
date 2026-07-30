/* ============================================================================
   ███ ENGINE ███  synth.js — all voices: subtractive synth, FM synth, the
   fully synthesized drum kit, Karplus-Strong plucked strings (guitars), and
   sample-buffer playback. Works identically against the live graph and the
   offline (export) graph. No DOM, no user-facing strings.

   Public API:
     trigger(g, trackIdx, patch, opts)        // scheduled note with duration
     noteOn(g, trackIdx, patch, note, vel)    // live key-down → {release()}
     preview(g, patch, note)                  // audition straight to master
   opts: { time, dur, vel(0..1), note(midi), glideFrom(midi|null), dest }
   ========================================================================== */
window.MDS = window.MDS || {};

MDS.synth = (function () {
  "use strict";
  const dsp = MDS.dsp;

  /* Per-voice drive shapers are cheap; cache curves by rounded amount. */
  const curveCache = {};
  function driveCurve(amount) {
    const k = Math.round(amount * 20) / 20;
    if (!curveCache[k]) curveCache[k] = dsp.distCurve(k);
    return curveCache[k];
  }

  function makeOsc(ctx, wave, freq) {
    const o = ctx.createOscillator();
    if (wave === "pulse") o.setPeriodicWave(dsp.pulseWave(ctx));
    else o.type = wave || "sawtooth";
    o.frequency.value = freq;
    return o;
  }

  /* Shared ADSR onto a GainNode's gain. Returns a function that schedules
     the release phase; caller stops sources after release completes. */
  function adsr(param, t0, peak, p) {
    const a = Math.max(0.002, p.a || 0), d = Math.max(0.01, p.d || 0.1);
    const s = (p.s == null ? 0.5 : p.s) * peak;
    param.setValueAtTime(0, t0);
    param.linearRampToValueAtTime(peak, t0 + a);
    param.setTargetAtTime(s, t0 + a, d / 3);
    return function release(tOff) {
      const r = Math.max(0.01, p.r || 0.05);
      // A note can end mid-attack (a short step on a slow patch). Cancelling a
      // linear ramp that has not landed yet reverts the param to the ramp's
      // START value, i.e. silence, so pin the level the attack really reached.
      const held = tOff < t0 + a ? peak * Math.max(0, (tOff - t0) / a) : null;
      param.cancelScheduledValues(tOff);
      if (held != null) param.setValueAtTime(held, tOff);
      param.setTargetAtTime(0, tOff, r / 3);
      return tOff + r * 4 + 0.05; // safe stop time
    };
  }

  /* ── Subtractive voice ─────────────────────────────────────────────── */
  function subVoice(ctx, dest, patch, note, vel, t0, glideFrom) {
    const f = dsp.midiToFreq(note);
    const o1 = makeOsc(ctx, patch.osc1, f);
    const semiR = Math.pow(2, (patch.semi || 0) / 12);
    const o2 = makeOsc(ctx, patch.osc2, f * semiR);
    o2.detune.value = patch.detune || 0;

    if (patch.glide > 0.001 && glideFrom != null && glideFrom !== note) {
      const f0 = dsp.midiToFreq(glideFrom);
      o1.frequency.setValueAtTime(f0, t0);
      o1.frequency.exponentialRampToValueAtTime(f, t0 + patch.glide);
      o2.frequency.setValueAtTime(f0 * semiR, t0);
      o2.frequency.exponentialRampToValueAtTime(f * semiR, t0 + patch.glide);
    } else {
      o1.frequency.setValueAtTime(f, t0);
      o2.frequency.setValueAtTime(f * semiR, t0);
    }

    const mix = patch.mix == null ? 0.5 : patch.mix;
    const g1 = ctx.createGain(); g1.gain.value = 1 - mix;
    const g2 = ctx.createGain(); g2.gain.value = mix;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = patch.res || 0;
    const base = Math.max(30, patch.cutoff || 1000);
    // Filter envelope: quick sweep to peak, exponential-ish fall back to base.
    // Accented notes open the filter further — free groove.
    const peakF = Math.min(16000, base + (patch.envAmt || 0) * (0.5 + 0.5 * vel));
    const fA = Math.max(0.004, (patch.a || 0) * 0.7);
    filter.frequency.setValueAtTime(base, t0);
    filter.frequency.linearRampToValueAtTime(peakF, t0 + fA);
    filter.frequency.setTargetAtTime(base, t0 + fA, Math.max(0.02, patch.fDec || 0.15) / 3);

    const amp = ctx.createGain();
    const release = adsr(amp.gain, t0, vel * (patch.gain == null ? 0.8 : patch.gain) * 0.5, patch);

    o1.connect(g1); o2.connect(g2);
    g1.connect(filter); g2.connect(filter);
    let out = filter;
    if ((patch.drive || 0) > 0.02) {
      const sh = ctx.createWaveShaper(); sh.oversample = "2x";
      sh.curve = driveCurve(patch.drive);
      filter.connect(sh); out = sh;
    }
    out.connect(amp); amp.connect(dest);

    o1.start(t0); o2.start(t0);
    return {
      release(tOff) {
        const stopT = release(tOff);
        o1.stop(stopT); o2.stop(stopT);
        o1.onended = () => { amp.disconnect(); };
      },
    };
  }

  /* ── FM voice (2-operator) ─────────────────────────────────────────── */
  function fmVoice(ctx, dest, patch, note, vel, t0) {
    const f = dsp.midiToFreq(note);
    const car = ctx.createOscillator(); car.type = "sine"; car.frequency.value = f;
    const mod = ctx.createOscillator(); mod.type = "sine";
    mod.frequency.value = f * (patch.ratio || 2);
    const mg = ctx.createGain();
    // Classic FM: modulation depth in Hz = index × carrier freq, decaying fast
    // for struck-metal tones.
    const depth = f * (patch.index == null ? 4 : patch.index);
    mg.gain.setValueAtTime(depth * (0.4 + 0.6 * vel), t0);
    mg.gain.setTargetAtTime(depth * 0.02, t0 + 0.004, Math.max(0.02, patch.iDec || 0.3) / 3);
    mod.connect(mg); mg.connect(car.frequency);

    const amp = ctx.createGain();
    const release = adsr(amp.gain, t0, vel * (patch.gain == null ? 0.8 : patch.gain) * 0.45, patch);
    car.connect(amp); amp.connect(dest);
    car.start(t0); mod.start(t0);
    return {
      release(tOff) {
        const stopT = release(tOff);
        car.stop(stopT); mod.stop(stopT);
        car.onended = () => { amp.disconnect(); };
      },
    };
  }

  /* ── Drum voices (all synthesized; kind switch) ────────────────────── */
  function drumVoice(ctx, dest, patch, vel, t0) {
    const tune = patch.dTune == null ? 1 : patch.dTune;
    const decay = patch.dDecay == null ? 0.5 : patch.dDecay;
    const tone = patch.dTone == null ? 0.5 : patch.dTone;
    const drive = patch.dDrive || 0;
    const outGain = (patch.gain == null ? 1 : patch.gain) * vel;

    const amp = ctx.createGain(); amp.gain.value = 0;
    let head = amp; // node the generators feed
    if (drive > 0.02) {
      const sh = ctx.createWaveShaper(); sh.oversample = "2x";
      sh.curve = driveCurve(drive);
      sh.connect(amp); head = sh;
    }
    amp.connect(dest);
    const sources = [];
    const noiseSrc = () => {
      const s = ctx.createBufferSource(); s.buffer = dsp.noiseBuffer(ctx); s.loop = true;
      sources.push(s); return s;
    };
    let stopT = t0 + 1;

    switch (patch.kind) {
      case "kick": {
        // Sine with a fast pitch envelope; tone sets the click/attack pitch.
        const o = ctx.createOscillator(); o.type = "sine";
        const f0 = (110 + tone * 200) * tune, f1 = 42 * tune;
        o.frequency.setValueAtTime(f0, t0);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + 0.085);
        o.connect(head); o.start(t0); sources.push(o);
        amp.gain.setValueAtTime(0, t0);
        amp.gain.linearRampToValueAtTime(outGain * 1.1, t0 + 0.003);
        amp.gain.setTargetAtTime(0, t0 + 0.01, (0.08 + decay * 0.5) / 3);
        stopT = t0 + 0.15 + decay * 0.9;
        break;
      }
      case "snare": {
        const o = ctx.createOscillator(); o.type = "triangle";
        o.frequency.setValueAtTime(180 * tune, t0);
        o.frequency.exponentialRampToValueAtTime(120 * tune, t0 + 0.06);
        const og = ctx.createGain();
        og.gain.setValueAtTime(outGain * 0.6, t0);
        og.gain.setTargetAtTime(0, t0 + 0.004, 0.035);
        o.connect(og); og.connect(head); o.start(t0); sources.push(o);
        const n = noiseSrc();
        const bp = ctx.createBiquadFilter(); bp.type = "bandpass";
        bp.frequency.value = 1300 + tone * 3000; bp.Q.value = 0.7;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(outGain * 0.9, t0);
        ng.gain.setTargetAtTime(0, t0 + 0.004, (0.06 + decay * 0.22) / 3);
        n.connect(bp); bp.connect(ng); ng.connect(head); n.start(t0);
        amp.gain.value = 1;
        stopT = t0 + 0.15 + decay * 0.4;
        break;
      }
      case "hatC": case "hatO": {
        const open = patch.kind === "hatO";
        const n = noiseSrc();
        const hp = ctx.createBiquadFilter(); hp.type = "highpass";
        hp.frequency.value = (5000 + tone * 4500) * Math.sqrt(tune);
        n.connect(hp); hp.connect(head); n.start(t0);
        const dec = open ? 0.12 + decay * 0.55 : 0.02 + decay * 0.07;
        amp.gain.setValueAtTime(0, t0);
        amp.gain.linearRampToValueAtTime(outGain * 0.7, t0 + 0.002);
        amp.gain.setTargetAtTime(0, t0 + 0.004, dec / 3);
        stopT = t0 + dec * 3 + 0.05;
        break;
      }
      case "clap": {
        const n = noiseSrc();
        const bp = ctx.createBiquadFilter(); bp.type = "bandpass";
        bp.frequency.value = 900 + tone * 1600; bp.Q.value = 1.3;
        n.connect(bp); bp.connect(head); n.start(t0);
        // Three fast retriggers then a tail — the classic 909 clap shape.
        amp.gain.setValueAtTime(0, t0);
        for (let k = 0; k < 3; k++) {
          const tk = t0 + k * 0.011;
          amp.gain.setValueAtTime(outGain * (1 - k * 0.15), tk);
          amp.gain.setTargetAtTime(0.0001, tk, 0.004);
        }
        const tTail = t0 + 0.033;
        amp.gain.setValueAtTime(outGain * 0.85, tTail);
        amp.gain.setTargetAtTime(0, tTail, (0.04 + decay * 0.15) / 3);
        stopT = t0 + 0.25 + decay * 0.3;
        break;
      }
      case "grind": {
        // Industrial hit #1: short distorted noise burst. Drive defaults hot.
        const n = noiseSrc();
        const lp = ctx.createBiquadFilter(); lp.type = "lowpass";
        lp.frequency.setValueAtTime(900 + tone * 6500, t0);
        lp.frequency.exponentialRampToValueAtTime(300 + tone * 800, t0 + 0.12);
        n.connect(lp); lp.connect(head); n.start(t0);
        amp.gain.setValueAtTime(0, t0);
        amp.gain.linearRampToValueAtTime(outGain, t0 + 0.002);
        amp.gain.setTargetAtTime(0, t0 + 0.01, (0.05 + decay * 0.3) / 3);
        stopT = t0 + 0.4 + decay * 0.4;
        break;
      }
      case "clank": {
        // Industrial hit #2: inharmonic FM burst through a bandpass = struck metal.
        const car = ctx.createOscillator(); car.type = "sine";
        const f = 190 * tune;
        car.frequency.value = f;
        const mod = ctx.createOscillator(); mod.type = "sine";
        mod.frequency.value = f * 5.43; // non-integer ratio → clangorous
        const mg = ctx.createGain();
        mg.gain.setValueAtTime(f * 16, t0);
        mg.gain.setTargetAtTime(f * 0.5, t0 + 0.003, 0.05);
        mod.connect(mg); mg.connect(car.frequency);
        const bp = ctx.createBiquadFilter(); bp.type = "bandpass";
        bp.frequency.value = 900 + tone * 2800; bp.Q.value = 2.2;
        car.connect(bp); bp.connect(head);
        car.start(t0); mod.start(t0); sources.push(car, mod);
        amp.gain.setValueAtTime(0, t0);
        amp.gain.linearRampToValueAtTime(outGain * 0.9, t0 + 0.002);
        amp.gain.setTargetAtTime(0, t0 + 0.01, (0.07 + decay * 0.35) / 3);
        stopT = t0 + 0.3 + decay * 0.6;
        break;
      }
      default: { // unknown kind: quiet click so a bad patch is at least audible
        const o = ctx.createOscillator(); o.frequency.value = 880;
        o.connect(head); o.start(t0); sources.push(o);
        amp.gain.setValueAtTime(outGain * 0.3, t0);
        amp.gain.setTargetAtTime(0, t0, 0.02);
        stopT = t0 + 0.1;
      }
    }

    for (const s of sources) s.stop(stopT);
    if (sources[0]) sources[0].onended = () => { amp.disconnect(); };
    return { release() { /* drums are one-shots */ } };
  }

  /* ── Karplus-Strong plucked string (guitars) ──────────────────────────
     The string itself is rendered by dsp.karplus into an AudioBuffer, then
     played through body resonance (peaking filter) and optional drive.
     Buffers are cached per context and per quantized (note, decay, bright,
     pick) so a running pattern reuses its strings instead of re-rendering. */
  const pluckCache = new WeakMap(); // ctx → Map(key → AudioBuffer)
  function pluckBuffer(ctx, note, patch) {
    let byKey = pluckCache.get(ctx);
    if (!byKey) { byKey = new Map(); pluckCache.set(ctx, byKey); }
    const q = (v) => Math.round((v || 0) * 50) / 50;
    const key = note + "|" + q(patch.decay) + "|" + q(patch.bright) + "|" + q(patch.pick);
    let buf = byKey.get(key);
    if (buf) {
      // LRU refresh: re-insert so a knob sweep evicts stale sweeps, never the
      // notes the running pattern is actively playing. Evicting those forces
      // a ~110k-sample karplus re-render inside the scheduler's lookahead
      // window, which is a dropout mechanism, not a memory policy.
      byKey.delete(key); byKey.set(key, buf);
    } else {
      if (byKey.size > 48) byKey.delete(byKey.keys().next().value); // oldest out
      const data = dsp.karplus(ctx.sampleRate, dsp.midiToFreq(note), patch);
      buf = ctx.createBuffer(1, data.length, ctx.sampleRate);
      buf.copyToChannel(data, 0);
      byKey.set(key, buf);
    }
    return buf;
  }

  function pluckVoice(ctx, dest, patch, note, vel, t0) {
    const s = ctx.createBufferSource();
    s.buffer = pluckBuffer(ctx, note, patch);

    // Body resonance: a low peaking bump, the "wood" under the string.
    const body = patch.body == null ? 0.3 : patch.body;
    const bodyF = ctx.createBiquadFilter();
    bodyF.type = "peaking";
    bodyF.frequency.value = 90 + body * 130;
    bodyF.Q.value = 1;
    bodyF.gain.value = body * 7;

    const amp = ctx.createGain();
    amp.gain.value = vel * (patch.gain == null ? 0.8 : patch.gain) * 0.6;

    s.connect(bodyF);
    let out = bodyF;
    if ((patch.drive || 0) > 0.02) {
      const sh = ctx.createWaveShaper(); sh.oversample = "2x";
      sh.curve = driveCurve(patch.drive);
      bodyF.connect(sh); out = sh;
    }
    out.connect(amp); amp.connect(dest);
    s.start(t0);
    s.onended = () => amp.disconnect();
    return {
      release(tOff) {
        // A let-go string is damped, not cut: short fade, longer on open sounds.
        const tc = 0.05 + (patch.decay || 0) * 0.07;
        amp.gain.setTargetAtTime(0, tOff, tc);
        s.stop(tOff + tc * 5 + 0.05);
      },
    };
  }

  /* ── Buffer playback (imported samples; base64/url library sources) ─── */
  function bufferVoice(ctx, dest, patch, note, vel, t0) {
    // A sample can be triggered before its async decode lands; skip silently.
    if (!patch.buffer || !patch.buffer.length) return { release() {} };
    const s = ctx.createBufferSource();
    s.buffer = patch.buffer;
    // Melodic use: repitch relative to middle C; drums leave note at 60.
    s.playbackRate.value = Math.pow(2, ((note || 60) - 60) / 12) * (patch.dTune || 1);
    const amp = ctx.createGain();
    amp.gain.value = vel * (patch.gain == null ? 0.9 : patch.gain);
    s.connect(amp); amp.connect(dest);
    s.start(t0);
    s.onended = () => amp.disconnect();
    return {
      release(tOff) {
        amp.gain.setTargetAtTime(0, tOff, 0.02);
        s.stop(tOff + 0.15);
      },
    };
  }

  function spawn(ctx, dest, patch, note, vel, t0, glideFrom) {
    switch (patch.engine) {
      case "sub": return subVoice(ctx, dest, patch, note, vel, t0, glideFrom);
      case "fm": return fmVoice(ctx, dest, patch, note, vel, t0);
      case "pluck": return pluckVoice(ctx, dest, patch, note, vel, t0);
      case "drum": return drumVoice(ctx, dest, patch, vel, t0);
      case "buffer": return bufferVoice(ctx, dest, patch, note, vel, t0);
      default: return { release() {} };
    }
  }

  /* Scheduled trigger used by the sequencer (live AND offline export). */
  function trigger(g, trackIdx, patch, opts) {
    const dest = opts.dest || g.tracks[trackIdx].input;
    const v = spawn(g.ctx, dest, patch, opts.note == null ? 60 : opts.note,
      opts.vel == null ? 0.8 : opts.vel, opts.time, opts.glideFrom);
    v.release(opts.time + (opts.dur || 0.2));
  }

  /* Live keyboard note. Caller must call .release() on key-up. */
  function noteOn(g, trackIdx, patch, note, vel) {
    const t = g.ctx.currentTime + 0.001;
    const v = spawn(g.ctx, g.tracks[trackIdx].input, patch, note, vel, t, null);
    let done = false;
    return {
      release() {
        if (done) return; done = true;
        v.release(g.ctx.currentTime + 0.001);
      },
    };
  }

  /* Audition a patch straight into the master bus (library preview).
     A plucked string gets a longer gate: its whole point is the ring. */
  function preview(g, patch, note) {
    const t = g.ctx.currentTime + 0.001;
    const v = spawn(g.ctx, g.master.input, patch, note == null ? 57 : note, 0.9, t, null);
    v.release(t + (patch.engine === "drum" ? 0.3 : patch.engine === "pluck" ? 1.2 : 0.45));
  }

  /* Hold-to-play voice into an arbitrary destination (lesson demos).
     dest defaults to the master input. Returns {release()}. */
  function auditionOn(g, patch, note, vel, dest) {
    const t = g.ctx.currentTime + 0.001;
    const v = spawn(g.ctx, dest || g.master.input, patch, note == null ? 57 : note, vel == null ? 0.85 : vel, t, null);
    let done = false;
    return { release() { if (done) return; done = true; v.release(g.ctx.currentTime + 0.001); } };
  }

  return { trigger, noteOn, preview, auditionOn };
})();
