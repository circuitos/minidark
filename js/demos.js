/* ============================================================================
   ███ CONTENT / DATA ███  demos.js — three preloaded demo tracks.
   All three are ORIGINAL compositions written for this app in the style of
   late-80s industrial / dark synth-pop (no melodies, riffs or lyrics are
   reproduced from any existing song). Each is a complete project: patterns,
   song chain, sound assignments, mixer + FX settings — fully editable once
   loaded. Display names/blurbs live in CONTENT.demos.
   ----------------------------------------------------------------------------
   Track rows: 0 kick · 1 snare · 2 hat · 3 perc · 4 bass · 5 lead · 6 pad · 7 arp
   Cell helpers:
     d("x..X")      drum row: x = step on, X = on + accent, . = off
     m([[step, note, len?, acc?], …])            melodic row
     c([[step, [notes…], len?, acc?], …])        chord row (pads/stabs)
   MIDI cheat sheet: C2=36 E2=40 A2=45 C3=48 E3=52 A3=57 C4=60 E4=64 A4=69
   ========================================================================== */
window.MDS = window.MDS || {};

MDS.demos = (function () {
  "use strict";

  function d(str) {
    return Array.from({ length: 16 }, (_, i) => {
      const ch = str[i] || ".";
      return { on: ch === "x" || ch === "X", acc: ch === "X", note: null };
    });
  }
  function m(list) {
    const row = Array.from({ length: 16 }, () => ({ on: false, acc: false, note: null }));
    for (const [step, note, len, acc] of list) {
      row[step] = { on: true, acc: !!acc, note, len: len || 1 };
    }
    return row;
  }
  function c(list) {
    const row = Array.from({ length: 16 }, () => ({ on: false, acc: false, note: null }));
    for (const [step, notes, len, acc] of list) {
      row[step] = { on: true, acc: !!acc, note: notes[0], notes: notes.slice(), len: len || 1 };
    }
    return row;
  }
  const OFF = () => d("................");

  /* pattern from rows object; missing rows are empty */
  function pat(rows) {
    return { steps: [
      rows.kick || OFF(), rows.snare || OFF(), rows.hat || OFF(), rows.perc || OFF(),
      rows.bass || OFF(), rows.lead || OFF(), rows.pad || OFF(), rows.arp || OFF(),
    ] };
  }

  /* Build a full project from a compact spec. */
  function project(spec) {
    const p = MDS.state.defaultProject();
    p.name = spec.name; p.bpm = spec.bpm; p.key = spec.key; p.swing = spec.swing || 0;
    Object.assign(p.fx, spec.fx || {});
    p.master = Object.assign(p.master, spec.master || {});
    spec.tracks.forEach((ts, i) => {
      const tr = p.tracks[i];
      if (ts.sound) { tr.soundId = ts.sound; tr.patch = MDS.lib.materialize(ts.sound); }
      if (ts.patch) Object.assign(tr.patch, ts.patch);
      if (ts.level != null) tr.level = ts.level;
      if (ts.sends) Object.assign(tr.sends, ts.sends);
      if (ts.gate != null) tr.gate = ts.gate;
      if (ts.baseNote != null) tr.baseNote = ts.baseNote;
    });
    spec.patterns.forEach((pt, i) => { p.patterns[i] = pt; });
    p.song = spec.song.slice();
    return p;
  }

  /* ════ DEMO 1 · "Grey Rain" — brooding · 100 BPM · A minor ════
     Harmony: bars alternate Am / F / G. Sparse half-time drums, slow pads,
     a patient bell motif. ~62 s. */
  function d1() {
    const arpAm = m([[0,69],[2,72],[4,76],[6,72],[8,69],[10,72],[12,76],[14,72]]);
    const arpF  = m([[0,65],[2,69],[4,72],[6,69],[8,65],[10,69],[12,72],[14,69]]);
    const arpG  = m([[0,67],[2,71],[4,74],[6,71],[8,67],[10,71],[12,74],[14,71]]);
    const padAm = c([[0,[57,60,64],16]]);
    const padF  = c([[0,[53,57,60,64],16]]);
    const padG  = c([[0,[55,59,62],16]]);
    const hats  = d("..x...x...x...x.");
    const bassAm = m([[0,33,4,true],[4,33,2],[6,33,2],[8,33,4],[12,31,4]]);
    const bassF  = m([[0,29,4,true],[4,29,2],[6,29,2],[8,29,4],[12,28,4]]);
    const bassG  = m([[0,31,4,true],[4,31,2],[6,31,2],[8,31,4],[12,33,4]]);

    const P0 = pat({ kick: d("x..............."), pad: padAm });
    const P1 = pat({ kick: d("x.......x......."), pad: padAm, arp: arpAm });
    const P2 = pat({ kick: d("x.......x......."), pad: padF, arp: arpF });
    const P3 = pat({ kick: d("x.......x......."), snare: d("........x......."), hat: hats,
      bass: bassAm, pad: padAm, arp: arpAm, lead: m([[4,64,2],[12,62,2]]) });
    const P4 = pat({ kick: d("x.......x......."), snare: d("........x......."), hat: hats,
      bass: bassF, pad: padF, arp: arpF, lead: m([[4,65,2],[12,64,2]]) });
    const P5 = pat({ kick: d("x.......x.....x."), snare: d("........x......."), hat: hats,
      bass: bassG, pad: padG, arp: arpG, lead: m([[4,67,2],[12,71,2]]),
      perc: d("......x.........") });
    const P6 = pat({ pad: padF, lead: m([[0,69,4],[8,67,4]]) });

    return project({
      name: MDS.CONTENT.demos.d1.name, bpm: 100, key: "A",
      fx: {
        delay: { div: "3/16", fb: 0.45, tone: 0.4, level: 0.55 },
        verb: { size: 0.75, tone: 0.35, level: 0.55 },
        dist: { drive: 0.4, tone: 0.45, level: 0.3 },
      },
      master: { comp: 0.35, vol: 0.9 },
      tracks: [
        { sound: "kick808", level: 0.85, patch: { dDecay: 0.7, dTone: 0.2, dDrive: 0.15 }, sends: { verb: 0.12 } },
        { sound: "snareTight", level: 0.6, sends: { verb: 0.4 } },
        { sound: "hatC", level: 0.4, sends: { verb: 0.15 } },
        { sound: "clank", level: 0.5, sends: { verb: 0.45, delay: 0.3 } },
        { sound: "bassRubber", level: 0.8 },
        { sound: "fmBell", level: 0.62, sends: { delay: 0.55, verb: 0.35 } },
        { sound: "padWarm", level: 0.6, sends: { verb: 0.35, chorus: 0.5 } },
        { sound: "leadCold", level: 0.42, sends: { delay: 0.35, chorus: 0.25 } },
      ],
      patterns: [P0, P1, P2, P3, P4, P5, P6],
      /* 26 bars @100 BPM ≈ 62 s: intro → layer arp → full → break → reprise → out */
      song: [0,0,1,2,1,2,3,4,3,5,3,4,3,5,6,6,3,4,3,5,3,4,1,2,0,0],
    });
  }

  /* ════ DEMO 2 · "Wire Mother" — mid-tempo · 118 BPM · E minor ════
     Driving octave 8th-note bass, backbeat snare, brass stabs.
     Harmony: Em / C verses, Am / D choruses. ~65 s. */
  function d2() {
    const kick4 = d("x...x...x...x...");
    const backbeat = d("....X.......X...");
    const hats = d("..x...x...x...x.");
    const bassEm = m([[0,28,1,true],[2,40],[4,28],[6,40],[8,28,1,true],[10,40],[12,31],[14,33]]);
    const bassC  = m([[0,36,1,true],[2,48],[4,36],[6,48],[8,36,1,true],[10,48],[12,35],[14,33]]);
    const bassAm = m([[0,33,1,true],[1,33],[2,45],[3,33],[4,33,1,true],[5,45],[6,33],[7,33],
                      [8,33,1,true],[9,33],[10,45],[11,33],[12,33,1,true],[13,45],[14,33],[15,45]]);
    const bassD  = m([[0,38,1,true],[1,38],[2,50],[3,38],[4,38,1,true],[5,50],[6,38],[7,38],
                      [8,38,1,true],[9,38],[10,50],[11,38],[12,38,1,true],[13,50],[14,38],[15,50]]);
    const stabEm = c([[3,[52,55,59],1],[11,[52,55,59],1]]);
    const stabC  = c([[3,[48,52,55],1],[11,[48,52,55],1]]);
    const stabAm = c([[7,[57,60,64],1,true],[15,[57,60,64],1]]);
    const stabD  = c([[7,[50,54,57],1,true],[15,[50,54,57],1]]);
    const arpAm = m([[0,69],[1,72],[2,76],[3,72],[4,69],[5,72],[6,76],[7,72],
                     [8,69],[9,72],[10,76],[11,72],[12,69],[13,72],[14,76],[15,72]]);
    const arpD  = m([[0,74],[1,78],[2,81],[3,78],[4,74],[5,78],[6,81],[7,78],
                     [8,74],[9,78],[10,81],[11,78],[12,74],[13,78],[14,81],[15,78]]);

    const P0 = pat({ kick: kick4, hat: hats, bass: bassEm, pad: c([[0,[64,67,71],16]]) });
    const P1 = pat({ kick: kick4, snare: backbeat, hat: hats, bass: bassEm, lead: stabEm, pad: c([[0,[64,67,71],16]]) });
    const P2 = pat({ kick: kick4, snare: backbeat, hat: hats, bass: bassC, lead: stabC, pad: c([[0,[60,64,67],16]]) });
    const P3 = pat({ kick: kick4, snare: backbeat, hat: hats, perc: d("....x.......x..."),
      bass: bassAm, lead: stabAm, pad: c([[0,[57,60,64],16]]), arp: arpAm });
    const P4 = pat({ kick: kick4, snare: backbeat, hat: hats, perc: d("....x.......x..."),
      bass: bassD, lead: stabD, pad: c([[0,[62,66,69],16]]), arp: arpD });
    const P5 = pat({ kick: d("x..............."), pad: c([[0,[60,64,67],16]]),
      arp: m([[0,72],[2,76],[4,79],[6,76],[8,72],[10,76],[12,79],[14,76]]) });
    const P6 = pat({ kick: kick4, snare: backbeat, hat: hats, perc: d("............x..."),
      bass: bassEm, pad: c([[0,[64,67,71],16]]),
      lead: m([[0,64,2],[4,62,2],[8,59,4],[12,62,2]]) });

    return project({
      name: MDS.CONTENT.demos.d2.name, bpm: 118, key: "E",
      fx: {
        delay: { div: "3/16", fb: 0.35, tone: 0.5, level: 0.5 },
        verb: { size: 0.5, tone: 0.45, level: 0.45 },
        dist: { drive: 0.5, tone: 0.5, level: 0.35 },
        chorus: { rate: 0.18, depth: 0.45, level: 0.55 },
      },
      master: { comp: 0.45, vol: 0.9 },
      tracks: [
        { sound: "kick909", level: 0.9, sends: { dist: 0.2 } },
        { sound: "snare909", level: 0.75, sends: { verb: 0.3 } },
        { sound: "hatC", level: 0.45, sends: { crush: 0.15 } },
        { sound: "clap909", level: 0.6, sends: { verb: 0.25 } },
        { sound: "bassNail", level: 0.82, sends: { dist: 0.3 } },
        { sound: "stabBrass", level: 0.7, sends: { delay: 0.35, verb: 0.2 } },
        { sound: "padGlass", level: 0.5, sends: { chorus: 0.5, verb: 0.3 } },
        { sound: "leadCold", level: 0.4, sends: { delay: 0.25, chorus: 0.3 } },
      ],
      patterns: [P0, P1, P2, P3, P4, P5, P6],
      /* 32 bars @118 BPM ≈ 65 s: intro → verse → chorus → break → verse → chorus → tag → out */
      song: [0,0,1,1,2,2,1,1,2,2,3,3,4,4,3,4,5,5,1,1,2,2,3,3,4,4,3,4,6,6,0,0],
    });
  }

  /* ════ DEMO 3 · "Rust Engine" — aggressive · 128 BPM · C minor ════
     16th-note distorted bass riff, relentless kick, grinder hits, snare-roll
     build. Harmony: Cm / Ab / Bb. ~68 s. */
  function d3() {
    const kick4 = d("X...x...X...x...");
    const kickPush = d("X...x...X...x.x.");
    const backbeat = d("....X.......X..x");
    const hats16 = d("x.X.x.X.x.X.x.X.");
    const riffC = m([[0,36,1,true],[1,36],[2,36],[3,48],[4,36,1,true],[5,36],[6,48],[7,36],
                     [8,36,1,true],[9,36],[10,36],[11,48],[12,39,1,true],[13,39],[14,43],[15,46]]);
    const riffAb = m([[0,32,1,true],[1,32],[2,32],[3,44],[4,32,1,true],[5,32],[6,44],[7,32],
                      [8,32,1,true],[9,32],[10,32],[11,44],[12,32,1,true],[13,39],[14,41],[15,43]]);
    const riffBb = m([[0,34,1,true],[1,34],[2,34],[3,46],[4,34,1,true],[5,34],[6,46],[7,34],
                      [8,34,1,true],[9,34],[10,34],[11,46],[12,34,1,true],[13,41],[14,43],[15,46]]);
    const bass8C = m([[0,36,1,true],[2,48],[4,36],[6,48],[8,36,1,true],[10,48],[12,36],[14,48]]);
    const stabCm = c([[3,[60,63,67],1,true],[10,[60,63,67],1]]);
    const stabAb = c([[3,[56,60,63],1,true],[10,[56,60,63],1]]);
    const stabBb = c([[3,[58,62,65],1,true],[10,[58,62,65],1]]);
    const arpC  = m([[0,72],[1,75],[2,79],[3,75],[4,72],[5,75],[6,79],[7,75],
                     [8,72],[9,75],[10,79],[11,75],[12,72],[13,75],[14,79],[15,75]]);
    const arpAb = m([[0,68],[1,72],[2,75],[3,72],[4,68],[5,72],[6,75],[7,72],
                     [8,68],[9,72],[10,75],[11,72],[12,68],[13,72],[14,75],[15,72]]);

    const P0 = pat({ kick: kick4, hat: d("..x...x...x...x."), perc: d(".......x........"), bass: bass8C });
    const P1 = pat({ kick: kick4, snare: backbeat, hat: hats16, bass: riffC, lead: stabCm });
    const P2 = pat({ kick: kick4, snare: backbeat, hat: hats16, bass: riffAb, lead: stabAb, arp: arpAb });
    const P3 = pat({ kick: kickPush, snare: backbeat, hat: hats16, bass: riffBb, lead: stabBb, arp: arpC });
    const P4 = pat({ kick: kickPush, snare: backbeat, hat: hats16, perc: d("...x.......x...."),
      bass: riffC, lead: stabCm, arp: arpC });
    const P5 = pat({ perc: d("x..............."), pad: c([[0,[60,63,67],16]]), bass: m([[0,36,8,true],[8,36,8]]),
      arp: m([[0,72],[2,75],[4,79],[6,75],[8,72],[10,75],[12,79],[14,75]]) });
    const P6 = pat({ kick: kick4, snare: d("x.x.x.x.X.X.XXXX"), pad: c([[0,[56,60,63],16]]) });
    const P7 = pat({ kick: d("x.......x......."), perc: d("....x..........."), bass: bass8C });

    return project({
      name: MDS.CONTENT.demos.d3.name, bpm: 128, key: "C",
      fx: {
        dist: { drive: 0.7, tone: 0.45, level: 0.45 },
        delay: { div: "1/8", fb: 0.3, tone: 0.4, level: 0.4 },
        verb: { size: 0.6, tone: 0.3, level: 0.4 },
        crush: { bits: 7, level: 0.45 },
      },
      master: { comp: 0.55, vol: 0.9 },
      tracks: [
        { sound: "kick909", level: 0.92, patch: { dDrive: 0.6 }, sends: { dist: 0.35 } },
        { sound: "snare909", level: 0.8, patch: { dDrive: 0.35 }, sends: { verb: 0.25, dist: 0.2 } },
        { sound: "hatC", level: 0.4, patch: { dDecay: 0.25 }, sends: { crush: 0.25 } },
        { sound: "grind", level: 0.65, sends: { verb: 0.3 } },
        { sound: "bassNail", level: 0.85, patch: { drive: 0.7, cutoff: 380 }, sends: { dist: 0.5 } },
        { sound: "stabBrass", level: 0.68, patch: { drive: 0.4 }, sends: { delay: 0.3, dist: 0.2 } },
        { sound: "padWarm", level: 0.5, sends: { verb: 0.4 } },
        { sound: "leadCold", level: 0.42, sends: { crush: 0.3, delay: 0.25 } },
      ],
      patterns: [P0, P1, P2, P3, P4, P5, P6, P7],
      /* 36 bars @128 BPM ≈ 68 s: tense intro → riff → lift → break → build → peak → collapse */
      song: [0,0,1,1,2,3,1,1,2,3,4,4,5,5,6,6,4,4,2,3,4,4,1,1,2,3,4,4,6,6,4,4,7,7,0,0],
    });
  }

  const makers = { d1, d2, d3 };
  function make(id) { return makers[id](); }
  function ids() { return ["d1", "d2", "d3"]; }

  return { make, ids };
})();
