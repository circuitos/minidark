/* ============================================================================
   ███ ENGINE ███  dsp.js — pure audio-math helpers shared by the live graph
   and the offline (export) graph. No DOM, no strings shown to users.
   ========================================================================== */
window.MDS = window.MDS || {};

MDS.dsp = (function () {
  "use strict";

  /* Per-AudioContext caches (an AudioBuffer/PeriodicWave belongs to the
     context that created it, so live and offline contexts each get their own). */
  const noiseCache = new WeakMap();
  const pulseCache = new WeakMap();
  const irCache = new WeakMap();

  function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  /* 2 seconds of white noise, reused by every noise-based drum. */
  function noiseBuffer(ctx) {
    let buf = noiseCache.get(ctx);
    if (!buf) {
      const len = Math.floor(ctx.sampleRate * 2);
      buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      // Deterministic PRNG (mulberry32) instead of Math.random so offline
      // renders are bit-identical run to run.
      let s = 0x9e3779b9;
      for (let i = 0; i < len; i++) {
        s |= 0; s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        d[i] = (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
      }
      noiseCache.set(ctx, buf);
    }
    return buf;
  }

  /* Band-limited pulse wave (25% duty) via Fourier series.
     Web Audio has no native pulse; PeriodicWave keeps it alias-free. */
  function pulseWave(ctx) {
    let w = pulseCache.get(ctx);
    if (!w) {
      const N = 64, duty = 0.25;
      const real = new Float32Array(N), imag = new Float32Array(N);
      for (let n = 1; n < N; n++) {
        // Fourier coefficients of a rectangular pulse with the DC term dropped.
        real[n] = (2 / (n * Math.PI)) * Math.sin(Math.PI * n * duty);
      }
      w = ctx.createPeriodicWave(real, imag);
      pulseCache.set(ctx, w);
    }
    return w;
  }

  /* tanh-style distortion curve. amount 0..1 */
  function distCurve(amount) {
    const k = 1 + amount * 60;
    const n = 2048, curve = new Float32Array(n);
    const norm = Math.tanh(k);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(k * x) / norm;
    }
    return curve;
  }

  /* Staircase quantization curve = bit-depth reduction.
     JUDGMENT CALL: the bitcrusher is a WaveShaper (amplitude quantization)
     rather than an AudioWorklet doing sample-rate decimation. It gives the
     characteristic digital fizz, needs no async module loading, and behaves
     identically in OfflineAudioContext — worth the loss of true rate-crush. */
  function crushCurve(bits) {
    const levels = Math.pow(2, Math.max(1, Math.min(16, bits)));
    const n = 8192, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.round(x * (levels / 2)) / (levels / 2);
    }
    return curve;
  }

  /* Procedurally generated impulse response: exponentially decaying noise,
     progressively lowpassed so the tail darkens like a real room.
     size 0..1 maps to ~0.4–4.5 s, tone 0..1 sets tail darkness. */
  function makeIR(ctx, size, tone) {
    const key = Math.round(size * 20) + ":" + Math.round(tone * 20);
    let byKey = irCache.get(ctx);
    if (!byKey) { byKey = {}; irCache.set(ctx, byKey); }
    if (byKey[key]) return byKey[key];

    const secs = 0.4 + size * 4.1;
    const len = Math.floor(ctx.sampleRate * secs);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    const noise = noiseBuffer(ctx).getChannelData(0);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      // one-pole lowpass whose coefficient tightens along the tail
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const env = Math.pow(1 - t, 2.2 + size * 1.5);
        const a = 0.05 + (1 - tone) * 0.55 + t * 0.3; // more smoothing later + darker with low tone
        const src = noise[(i * (ch + 1) + ch * 7919) % noise.length];
        lp += (1 - a) * (src - lp); // a is always >= 0.05, so 1-a needs no clamp
        d[i] = lp * env;
      }
      // tiny pre-delay of silence keeps the dry transient distinct
      const pre = Math.floor(ctx.sampleRate * 0.012);
      for (let i = len - 1; i >= 0; i--) d[i] = i >= pre ? d[i - pre] : 0;
    }
    byKey[key] = buf;
    return buf;
  }

  /* Karplus-Strong plucked string, rendered as raw samples (1983 algorithm:
     a noise burst circulating through a delay line one period long, losing
     treble on every pass, rings into a pitched string). Pure math so the
     smoke test can run it in Node and offline renders stay bit-identical.
     p: { decay 0..1 (ring time ~0.12–2.5 s), bright 0..1 (pick/tone),
          pick 0..1 (pick-position comb) }.
     Returns a Float32Array normalized to ±1. */
  function karplus(sampleRate, freq, p) {
    const decay = Math.min(1, Math.max(0, p.decay == null ? 0.6 : p.decay));
    const bright = Math.min(1, Math.max(0, p.bright == null ? 0.7 : p.bright));
    const pickPos = Math.min(1, Math.max(0, p.pick == null ? 0.4 : p.pick));

    const f = Math.min(sampleRate / 6, Math.max(20, freq));
    const D = sampleRate / f;                     // exact loop length (samples)
    const N = Math.max(2, Math.floor(D - 0.5));   // integer part of the delay
    const frac = Math.min(0.999, Math.max(0, D - N - 0.5)); // interp remainder

    const secs = 0.12 + decay * 2.4;
    const len = Math.ceil(sampleRate * secs);
    const out = new Float32Array(len);

    // Excitation: one period of deterministic noise (mulberry32, fixed seed),
    // lowpassed by `bright`, comb-filtered by pick position.
    let s = 0x1234567;
    const rand = () => {
      s |= 0; s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
    };
    const exLen = N + 2;
    const k = 0.08 + bright * 0.88;               // one-pole coefficient
    let lp = 0;
    for (let i = 0; i < exLen && i < len; i++) {
      lp += k * (rand() - lp);
      out[i] = lp;
    }
    const comb = Math.max(1, Math.round(N * (0.08 + pickPos * 0.42)));
    for (let i = Math.min(exLen, len) - 1; i >= comb; i--) out[i] -= 0.9 * out[i - comb];

    // String loop: averaging lowpass (treble loss per pass) + linear-interp
    // fractional delay for tuning; g sets ~-60 dB at `secs`.
    const g = Math.pow(10, -3 / (secs * f));
    for (let i = exLen; i < len; i++) {
      const s0 = 0.5 * (out[i - N] + out[i - N - 1]);
      const s1 = 0.5 * (out[i - N - 1] + out[i - N - 2]);
      out[i] = g * ((1 - frac) * s0 + frac * s1);
    }

    let peak = 0;
    for (let i = 0; i < len; i++) { const a = Math.abs(out[i]); if (a > peak) peak = a; }
    if (peak > 0) for (let i = 0; i < len; i++) out[i] /= peak;
    return out;
  }

  /* Natural minor scale intervals; used by scale lock and note naming. */
  const MINOR = [0, 2, 3, 5, 7, 8, 10];
  const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const KEY_TO_PC = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };

  /* Snap a MIDI note to the nearest tone of the natural minor scale of `key`. */
  function snapToScale(midi, key) {
    const root = KEY_TO_PC[key] || 0;
    const rel = ((midi - root) % 12 + 12) % 12;
    let best = MINOR[0], bd = 99;
    for (const iv of MINOR) {
      const d = Math.min(Math.abs(iv - rel), 12 - Math.abs(iv - rel));
      if (d < bd) { bd = d; best = iv; }
    }
    let out = midi + (best - rel);
    if (best - rel > 6) out -= 12;
    if (best - rel < -6) out += 12;
    return out;
  }

  function noteName(midi) {
    return NOTE_NAMES[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
  }

  return { midiToFreq, noiseBuffer, pulseWave, distCurve, crushCurve, makeIR, karplus, snapToScale, noteName, MINOR, KEY_TO_PC };
})();
