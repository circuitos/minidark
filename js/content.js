/* ============================================================================
   ███ CONTENT ███  Every user-facing string in the app lives here.
   UI code references keys, never inline strings. A localization or copy
   pass edits THIS FILE ONLY.
   ----------------------------------------------------------------------------
   Sections:  app chrome · transport · sequencer · panels · library names ·
              tooltips (one per control: {what, why}) · glossary · lessons ·
              export dialog · demo track blurbs
   House rule: no em dashes anywhere in this file (enforced by scripts/lint.mjs).
   ========================================================================== */
window.MDS = window.MDS || {};

MDS.CONTENT = {
  app: {
    title: "MINIDARK",
    subtitle: "a tiny dark-synth studio",
    powerBtn: "POWER ON",
    powerTag: "A browser studio for late-80s industrial and synth-pop sounds. " +
      "No experience needed: press POWER, hit PLAY, and start breaking things. " +
      "Nothing here can be damaged.",
    powerHint: "(browsers only allow sound after a click; that's what this button is for)",
    firstToast: "A demo groove is loaded. Press PLAY, then open LESSONS if you're new to synths.",
    confirmLoad: "Load this project? Your current work will be replaced (export it first if you want to keep it).",
  },

  transport: {
    play: "PLAY",
    stop: "STOP",
    tempo: "TEMPO",
    swing: "SWING",
    key: "KEY",
    scaleLock: "SCALE LOCK",
    modePattern: "PATTERN",
    modeSong: "SONG",
    projName: "Project name",
    undo: "UNDO",
    redo: "REDO",
    save: "SAVE",
    open: "OPEN",
    reset: "RESET",
    export: "EXPORT",
    lessons: "LESSONS",
    glossary: "GLOSSARY",
    posBar: "bar",
    posStep: "step",
  },

  seq: {
    title: "SEQUENCER",
    patterns: "PATTERNS",
    copy: "COPY",
    paste: "PASTE",
    clear: "CLEAR",
    help: "click: step on/off · drag right on a melody step: hold the note over several steps (slow pads need this) · shift-click: hold one step longer · right-click: accent · mouse-wheel on a step: change note (melody rows) · the keyboard below sets the note used for new steps",
    songTitle: "SONG: chain patterns into a full track",
    songAdd: "+ ADD PATTERN",
    songClear: "CLEAR SONG",
    songEmpty: "Song is empty. Add patterns to build a track (30+ bars ≈ one minute).",
    songLen: (bars, secs) => `${bars} bars ≈ ${secs}s`,
    chipHint: "click to remove · shift-click to duplicate · hold, then drag to move it along the song",
  },

  confirm: {
    resetTitle: "Reset project?",
    resetBody: "This clears every pattern, the song chain and all sounds back to a blank project. Your current track is not saved anywhere, so use SAVE first if you want to keep it.",
    resetCancel: "CANCEL",
    resetOk: "RESET PROJECT",
    resetDone: "Project reset to blank.",
  },

  tracks: {
    kick: "KICK", snare: "SNARE", hat: "HAT", perc: "PERC",
    bass: "BASS", lead: "LEAD", pad: "PAD", arp: "ARP",
  },

  tabs: { inst: "INSTRUMENT", mixer: "MIXER", fx: "FX / MASTER", lib: "LIBRARY" },

  inst: {
    sigTitle: "SIGNAL PATH: click a box to jump to its controls",
    preset: "SOUND",
    random: "RANDOMIZE",
    gOsc: "OSCILLATORS", gFilter: "FILTER", gEnv: "ENVELOPE (ADSR)",
    gVoice: "VOICE", gFm: "FM", gDrum: "DRUM", gSends: "FX SENDS", gSample: "SAMPLE",
    osc1: "OSC 1", osc2: "OSC 2", mix: "MIX", detune: "DETUNE", semi: "O2 PITCH",
    glide: "GLIDE", cutoff: "CUTOFF", res: "RESO", envAmt: "ENV→FILT", fDec: "F.DECAY",
    a: "ATTACK", d: "DECAY", s: "SUSTAIN", r: "RELEASE",
    drive: "DRIVE", gain: "LEVEL",
    ratio: "RATIO", index: "FM AMT", iDec: "FM DECAY",
    dTune: "TUNE", dDecay: "DECAY", dTone: "TONE", dDrive: "DRIVE",
    waves: { saw: "saw", pulse: "pulse", square: "square", triangle: "tri", sine: "sine" },
    sigNodes: { osc: "OSC", gen: "GEN", sample: "SMPL", filter: "FILTER", amp: "AMP", sends: "FX SENDS", master: "MASTER" },
  },

  sends: { dist: "DIST", chorus: "CHOR", delay: "DELAY", verb: "VERB", crush: "CRUSH" },

  mixer: {
    title: "MIXER", level: "LEVEL", mute: "M", solo: "S",
  },

  fx: {
    dist: "DISTORTION", chorus: "CHORUS", delay: "DELAY (tempo-synced)",
    verb: "REVERB", crush: "BITCRUSHER", master: "MASTER",
    distDrive: "DRIVE", distTone: "TONE", distLevel: "RETURN",
    choRate: "RATE", choDepth: "DEPTH", choLevel: "RETURN",
    dlyDiv: "TIME", dlyFb: "FEEDBK", dlyTone: "TONE", dlyLevel: "RETURN",
    verbSize: "SIZE", verbTone: "TONE", verbLevel: "RETURN",
    crushBits: "BITS", crushLevel: "RETURN",
    mComp: "GLUE", mVol: "VOLUME",
    meterTitle: "OUTPUT", meterL: "L", meterR: "R", meterGr: "GR", meterPeak: "PEAK", meterDb: "dB",
    meterToggle: "VU",
    divisions: { "1/16": "1/16", "1/8": "1/8", "3/16": "3/16 (dotted)", "1/4": "1/4" },
  },

  kbd: {
    title: "KEYBOARD: plays the selected track",
    octDown: "OCT −", octUp: "OCT +",
    hint: "QWERTY works too: Z-row = lower octave, Q-row = upper. Space = play/stop.",
    playing: (name) => `playing: ${name}`,
  },

  lib: {
    title: "SOUND LIBRARY",
    all: "ALL",
    cats: { drums: "DRUMS", bass: "BASS", lead: "LEAD", pad: "PAD", fm: "FM / KEYS", fxhit: "FX HITS" },
    assign: "USE ON TRACK",
    previewHint: "click a sound to hear it; USE ON TRACK loads it on the selected track",
    demosTitle: "DEMO TRACKS: full songs you can take apart",
    demoLoad: "OPEN IN EDITOR",
    demoPlay: "PLAY",
    demoLoaded: (name) => `"${name}" loaded. Everything in the sequencer is now editable.`,
    assigned: (name, track) => `${name} → ${track}`,
  },

  /* Names for SOUND_LIBRARY entries (registry in js/library.js keeps ids only) */
  libNames: {
    kick808: "Boom Kick", kick909: "Punch Kick", snare909: "Crack Snare",
    snareTight: "Dry Snare", hatC: "Closed Hat", hatO: "Open Hat", clap909: "Clap",
    grind: "Grinder Hit", clank: "Metal Clank",
    bassNail: "Nailgun Bass", bassRubber: "Rubber Sub",
    stabBrass: "Brass Stab", leadCold: "Cold Wire Lead", leadHollow: "Hollow Pulse",
    padWarm: "Warm Ghost Pad", padGlass: "Glass Pad",
    fmBell: "Ice Bell", fmTwang: "Wire Twang",
  },

  demos: {
    d1: { name: "Grey Rain", blurb: "Brooding · 100 BPM · A minor. Slow pads, a patient arp, almost no drums. How tension works when nothing is loud." },
    d2: { name: "Wire Mother", blurb: "Mid-tempo · 118 BPM · E minor. A driving eighth-note bassline under brass stabs: classic dark synth-pop movement." },
    d3: { name: "Rust Engine", blurb: "Aggressive · 128 BPM · C minor. Sixteenth-note distorted bass, industrial hits and a relentless kick. The angry one." },
  },

  export: {
    title: "EXPORT",
    scope: "WHAT",
    scopeSong: "Whole song (the pattern chain)",
    scopePattern: "Current pattern (one bar, looped ×4)",
    format: "FORMAT",
    wav: "WAV (always available, best quality)",
    mp3: "MP3 (smaller file)",
    webm: "OGG/WebM (browser codec)",
    render: "RENDER & DOWNLOAD",
    saveJson: "SAVE PROJECT FILE",
    rendering: "Rendering… (offline render, faster than real time)",
    done: (secs, size) => `Done: ${secs}s of audio, ${size}. Download should have started.`,
    mp3Unavailable: "MP3 encoder (lamejs from cdnjs) failed to load, so exports fall back to WAV. Check your network and reload to retry.",
    webmUnavailable: "This browser can't record OGG/WebM; use WAV or MP3.",
    emptySong: "The song chain is empty. Add patterns in SONG mode, or export the current pattern instead.",
    err: (msg) => `Export failed: ${msg}`,
  },

  glossaryTitle: "GLOSSARY",
  glossarySearch: "search terms…",

  /* ──────────────────────────────────────────────────────────────────────
     TOOLTIPS: one entry per control. {what}: plain-language function.
     {why}: why it matters for the industrial / dark synth-pop sound.
     ────────────────────────────────────────────────────────────────────── */
  tooltips: {
    play: { what: "Starts and stops the sequencer, the machine that plays your patterns in a loop.", why: "This music is built on relentless loops; leave it running and tweak sounds while it plays." },
    tempo: { what: "Speed of the track in beats per minute (BPM).", why: "The reference records live around 100–130 BPM; slower feels brooding, faster feels aggressive." },
    swing: { what: "Delays every second 16th-note step to make the rhythm less robotic.", why: "Industrial grooves usually stay near 0 (machine-tight); a touch of swing loosens synth-pop hats." },
    key: { what: "The home note all melodies are built around.", why: "Combined with the minor scale, this is what makes everything sound dark instead of happy." },
    scaleLock: { what: "Snaps every note you play or program to the minor scale of the current key.", why: "With this on you literally cannot hit a wrong note, which is ideal while you learn." },
    mode: { what: "PATTERN loops the one-bar pattern you're editing; SONG plays your pattern chain in order.", why: "You sculpt sounds in PATTERN mode, then arrange a full track in SONG mode." },
    projName: { what: "The name of your project, used for exported file names.", why: "Name it early; exported WAV/MP3 files inherit it." },
    undo: { what: "Steps back through your last edits (Ctrl+Z, or Cmd+Z on a Mac). Greyed out when there is nothing left to undo.", why: "Nothing here can be damaged: if undo can take it back, you can afford to try the reckless version first." },
    redo: { what: "Steps forward again through edits you just undid (Ctrl+Shift+Z or Ctrl+Y). A new edit clears the forward steps.", why: "Undo past something, hear the difference, then decide which version you actually wanted." },
    save: { what: "Downloads your whole project as a small file you can re-open later.", why: "This studio keeps nothing between visits; the file IS your save game." },
    open: { what: "Loads a previously saved project file.", why: "Bring back yesterday's track and keep working." },
    reset: { what: "Empties the whole project back to a blank track. Asks first.", why: "A clean slate is the fastest way to practice something new from scratch." },
    export: { what: "Renders your music to a real audio file (WAV/MP3).", why: "This is how a loop in a browser becomes a track you can share." },
    lessons: { what: "Interactive lessons that teach synthesis from zero, with live sound demos.", why: "Fifteen minutes here and every knob in this app will make sense." },
    glossary: { what: "Plain-language definitions of every technical word used in this app.", why: "Synth jargon is 50 years old and mostly historical accident. Look it up, don't memorize it." },

    patternBank: { what: "Eight pattern slots; each holds one bar of steps for all tracks.", why: "Verse, chorus, break: make variations here, then chain them in SONG mode." },
    patCopy: { what: "Copies the current pattern.", why: "The classic move: copy a pattern, paste to the next slot, change one thing." },
    patPaste: { what: "Pastes the copied pattern into the current slot.", why: "Small variations between patterns keep a track alive." },
    patClear: { what: "Erases every step in the current pattern.", why: "Sometimes the best edit is a clean slate." },
    stepGrid: { what: "Each row is a track, each square a 16th-note step. Click to turn a step on; on melody rows, drag right to hold one note over several steps.", why: "Drum machines made this grid famous; whole genres live inside these 16 squares. Slow sounds like pads only bloom if you hold them: a single 16th ends before the attack has opened." },
    trackSelect: { what: "Selects this track; the keyboard and INSTRUMENT panel follow your selection.", why: "Tweak one voice at a time; the selected track is the one you're sculpting." },
    trackMuteMini: { what: "Silences this track (M) or plays it alone (S).", why: "Muting parts in and out is the fastest way to hear what each one contributes." },
    songChain: { what: "The order your patterns play in SONG mode. Click a block to remove it.", why: "Arrangement is just a list: low-energy patterns first, add layers, strip back, end." },
    songAdd: { what: "Appends the currently selected pattern to the song.", why: "Chain 30+ bars and you have a real one-minute-plus track to export." },
    songClear: { what: "Empties the song chain.", why: "Start the arrangement over without touching your patterns." },

    kbd: { what: "A piano keyboard that plays the selected track's sound live, even while the sequencer runs.", why: "Jam over the loop to find melodies before you commit them to steps." },
    kbdOct: { what: "Shifts the on-screen keyboard up or down one octave.", why: "Basses live low, leads live high. Same keys, different neighborhood." },

    preset: { what: "Loads a ready-made sound from the library onto this track.", why: "Presets are how you learn: load one, look at what the knobs are doing, break it." },
    random: { what: "Throws every dial on this instrument to a new random setting and plays it once. The kind of instrument stays the same: a kick stays a kick.", why: "Chaos teaches faster than theory. Roll it until something surprises you, then look at which knobs got you there. Undo brings back what you had." },
    osc1: { what: "The waveform of oscillator 1, the raw tone before any shaping.", why: "Saw = bright and angry, pulse = hollow and cold: the two flavors this genre runs on." },
    osc2: { what: "A second oscillator layered with the first.", why: "Two slightly different oscillators beat against each other: instant thickness." },
    mix: { what: "Balance between oscillator 1 and oscillator 2.", why: "Blend a low square under a saw for weight, or pure saw for cut." },
    semi: { what: "Tunes oscillator 2 in semitones against oscillator 1 (−12 = one octave down).", why: "An octave-down second oscillator is the oldest trick for a huge bass." },
    detune: { what: "Pushes oscillator 2 slightly out of tune, in cents.", why: "A few cents of detune makes a synth shimmer; zero sounds sterile, which is sometimes the point." },
    glide: { what: "Slides the pitch from the previous note instead of jumping.", why: "Short glides make a mono bassline snake between notes. Very Violator." },
    cutoff: { what: "The filter's cutoff: sounds above this frequency are removed, making the tone darker or brighter.", why: "THE knob of subtractive synthesis; sweeping it is the most famous sound in electronic music." },
    res: { what: "Resonance boosts a whistle right at the cutoff frequency.", why: "High resonance gives that hollow, acidic sting; low keeps things solid." },
    envAmt: { what: "How far the envelope pushes the cutoff up on each note.", why: "This creates the 'wow' attack of a bass note: bright hit, dark tail." },
    fDec: { what: "How fast the filter falls back down after each note's bright attack.", why: "Short = tight percussive bass; long = slow opening sweep." },
    a: { what: "Attack: how long a note takes to reach full volume after you hit the key.", why: "Zero attack punches like a drum; slow attack floats like a pad." },
    d: { what: "Decay: how fast the note falls from its peak to the sustain level.", why: "Short decay + low sustain = the plucky stabs all over these records." },
    s: { what: "Sustain: the volume a note holds at while the key stays down.", why: "Basses and stabs want low sustain; pads want it high." },
    r: { what: "Release: how long the sound rings out after the key is let go.", why: "Short release keeps grooves tight; long release smears, good for pads only." },
    drive: { what: "Overdrives this voice into gentle distortion before the mixer.", why: "A driven bass is the backbone of the industrial sound; clean is optional." },
    gain: { what: "The output level of this voice.", why: "Keep voices balanced here so the master never has to fight." },
    ratio: { what: "FM: the modulator's speed as a multiple of the note's pitch. Whole numbers sound tuned, odd fractions sound metallic.", why: "Ratios like 3.5 give the clanging, bell-like tones FM is famous for." },
    index: { what: "FM: how hard the modulator shakes the pitch; more equals brighter and noisier.", why: "This is FM's 'cutoff': the aggression control." },
    iDec: { what: "FM: how fast the shaking dies away after the attack.", why: "Fast decay = plucked wire and struck metal; slow = sustained alarm." },
    dTune: { what: "Tunes this drum up or down.", why: "A detuned kick or clank instantly changes the mood of the whole kit." },
    dDecay: { what: "How long this drum rings.", why: "Tight decays make machine grooves; long open hats and booms fill space." },
    dTone: { what: "Shifts this drum's character, darker to brighter / more click.", why: "Dial snares and hats to sit against the synths, not fight them." },
    dDrive: { what: "Distorts this drum on its way out.", why: "A crushed, driven kick is half the industrial aesthetic by itself." },

    sendDist: { what: "How much of this track is sent into the shared distortion effect.", why: "Distortion glues and angers anything: drums, bass, even pads." },
    sendChor: { what: "How much of this track is sent to the chorus.", why: "Chorus doubles a sound into a wider, colder version of itself. Very 80s." },
    sendDelay: { what: "How much of this track feeds the tempo-synced echo.", why: "A dotted echo on a sparse lead makes three notes feel like a melody." },
    sendVerb: { what: "How much of this track goes to the shared reverb.", why: "Reverb is the room your track lives in: a little on snare/pads, rarely on bass." },
    sendCrush: { what: "How much of this track is bit-crushed into lo-fi grit.", why: "Digital dirt: the cheap-sampler crunch all over early industrial records." },

    chLevel: { what: "This track's volume in the mix.", why: "Mixing IS the arrangement: kick and bass loud, everything else makes room." },
    chMute: { what: "Silences this track.", why: "Pull parts out and back in: instant arrangement, and the best way to A/B." },
    chSolo: { what: "Plays only the soloed track(s).", why: "Listen to one voice in isolation while you sculpt it." },

    distDrive: { what: "How hard the signal is pushed into the distortion curve.", why: "From warm saturation to full snarl; the genre lives in the upper half." },
    distTone: { what: "Darkens the distortion output.", why: "Distortion creates harsh highs; this tames them back to menace." },
    distLevel: { what: "How much distorted signal returns to the mix.", why: "Blend dirt under the clean signal instead of replacing it." },
    choRate: { what: "Speed of the chorus wobble.", why: "Slow = seasick and wide, fast = shimmering vibrato." },
    choDepth: { what: "How far the chorus bends the copies out of tune.", why: "More depth, more width; past halfway it gets unstable (which can be the point)." },
    choLevel: { what: "How much chorus returns to the mix.", why: "The 'expensive 80s studio' sheen lives on this knob." },
    dlyDiv: { what: "The echo's rhythm, locked to the tempo (1/8, dotted…).", why: "Dotted delays create the loping, off-grid echoes of classic synth-pop." },
    dlyFb: { what: "How much echo is fed back for repeat-of-repeat trails.", why: "Low = slapback; high = endless corridors. Careful past 0.7." },
    dlyTone: { what: "Darkens each repeat more than the last.", why: "Analog-style echoes die into murk; bright digital repeats feel clinical." },
    dlyLevel: { what: "How much delay returns to the mix.", why: "Delay adds space without the wash of reverb; this genre leans delay-first." },
    verbSize: { what: "The size of the artificial space, from closet to hangar.", why: "Big empty rooms are an industrial signature. Think machine halls." },
    verbTone: { what: "Darkens the reverb tail.", why: "Dark tails sit behind the track; bright tails wash over it." },
    verbLevel: { what: "How much reverb returns to the mix.", why: "Less is more: a dry, close mix with one deep element hits harder." },
    crushBits: { what: "Reduces audio resolution: fewer bits, more digital fizz.", why: "Early samplers were 8–12 bit; that broken crunch is a period-correct color." },
    crushLevel: { what: "How much crushed signal returns to the mix.", why: "Parallel grit: blend it under the clean mix for texture." },
    mComp: { what: "'Glue' compression on everything: it evens out peaks so the mix feels solid.", why: "Machine music wants a firm, even loudness; this also protects your ears and speakers." },
    mVol: { what: "Final output volume after compression and limiting.", why: "A limiter downstream stops clipping, so this is safe to push." },
    meterVu: { what: "Live output meter: left and right level, plus GR, how hard the safety limiter is working.", why: "Healthy mixes dance in the green; constant red or heavy GR means turn voices down, not the master up." },

    sigNode: { what: "One stage of this voice's signal chain. Click to jump to its controls.", why: "Synthesis is plumbing: sound flows left to right; knowing the pipes is knowing the instrument." },

    libItem: { what: "A sound from the library. Click to preview it.", why: "Listen with your ears, not the names. Then steal and modify." },
    libAssign: { what: "Loads this sound onto the currently selected track.", why: "Any track can host any sound: put a clank on the HAT row if it grooves." },
    demoPlay: { what: "Loads this demo song and plays it.", why: "Hearing a finished track in context teaches faster than any manual." },
    demoLoad: { what: "Opens this demo in the editor: every pattern, sound and mix setting becomes editable.", why: "Taking apart working tracks is how everyone actually learns this craft." },

    expScope: { what: "Choose whether to render the whole song chain or just the current pattern.", why: "Render patterns while sketching, the song when it's a track." },
    expFormat: { what: "The audio file type to produce.", why: "WAV is lossless and always works; MP3 is smaller for sharing." },
    expRender: { what: "Renders your music offline (not a live recording) and downloads the file.", why: "Offline rendering is sample-exact: no glitches from a busy laptop." },
  },

  /* ──────────────────────────────────────────────────────────────────────
     GLOSSARY: every technical term that appears anywhere in the UI.
     ────────────────────────────────────────────────────────────────────── */
  glossary: [
    ["Synthesizer", "An instrument that creates sound from electricity (or math) instead of strings or drums. You shape the sound with knobs."],
    ["Oscillator (OSC)", "The part of a synth that actually makes the raw tone: a vibration repeating hundreds of times a second. Everything else just shapes it."],
    ["Waveform", "The shape of an oscillator's vibration. Different shapes = different tone colors: saw, pulse, square, triangle, sine."],
    ["Saw wave", "A bright, buzzy waveform containing every harmonic. The default choice for aggressive basses and brassy stabs."],
    ["Pulse / Square wave", "A hollow, woody waveform with only odd harmonics. Cold and clipped; a synth-pop staple."],
    ["Sine wave", "The purest tone: one single frequency, no harmonics. On its own it's a flute-like 'boo'; pitched down fast, it's an 808 kick."],
    ["Triangle wave", "A soft, dark waveform, like a sine with a hint of edge."],
    ["Subtractive synthesis", "Start with a bright waveform, then subtract harmonics with a filter. The classic analog synth recipe used by most sounds in this app."],
    ["FM synthesis", "Frequency Modulation: one oscillator shakes another's pitch extremely fast, creating metallic, bell-like or glassy tones. The DX7 sound of the 80s."],
    ["Carrier / Modulator", "In FM, the carrier is the oscillator you hear; the modulator is the one shaking it. The RATIO and FM AMT knobs set their relationship."],
    ["Filter", "A tone control on steroids. This app uses a lowpass filter: it lets lows through and cuts highs above the cutoff point."],
    ["Cutoff", "The frequency where the filter starts cutting. Low cutoff = dark and muffled, high = bright and raw. The most-touched knob in synthesis."],
    ["Resonance", "A boost right at the cutoff frequency that adds a whistling, acidic emphasis. High resonance makes filter sweeps dramatic."],
    ["Envelope", "An automatic hand that moves a knob for you on every note, usually volume (amp envelope) or cutoff (filter envelope)."],
    ["ADSR", "The four stages of an envelope: Attack (time to reach full level), Decay (fall to sustain), Sustain (held level), Release (fade-out after letting go)."],
    ["Amp", "Short for amplifier: the stage that controls a voice's loudness over time, driven by the ADSR envelope."],
    ["Sequencer", "A machine that plays notes for you in a repeating pattern. This app's grid is a step sequencer: 16 boxes, each a 16th note."],
    ["Step", "One box in the sequencer grid, one 16th of a bar. Turning it on means 'play a note here'."],
    ["Pattern", "One bar (16 steps) of music for all tracks. You get 8 pattern slots to build variations."],
    ["Bar", "A musical 'sentence' of 4 beats. At 120 BPM one bar lasts exactly 2 seconds."],
    ["BPM / Tempo", "Beats per minute: the speed of the track. This genre lives around 100–130."],
    ["Swing", "Delaying every second step slightly so rhythms lope instead of march."],
    ["Velocity", "How hard a note is hit. In this app, accented steps play louder and brighter."],
    ["Accent", "A step marked to hit harder than the others (right-click a step). Accents create groove inside a wall of 16ths."],
    ["Song mode", "Chaining patterns into an arrangement: intro, build, drop. The chain is what EXPORT renders."],
    ["Track", "One row of the sequencer with its own instrument, mixer channel and effect sends, like one musician in a band."],
    ["Mixer", "Where all tracks meet: set each one's volume, mute or solo it, and feed the effects."],
    ["Mute / Solo", "Mute silences a track. Solo silences everyone else. Both are for listening surgically."],
    ["Send / Bus", "A 'send' splits some of a track's signal off to a shared effect (a 'bus'). All tracks share one reverb, one delay, etc., like a real studio."],
    ["Distortion", "Overloading a signal until it snarls. Adds harmonics, aggression and glue. The sound of industrial."],
    ["Waveshaper", "The digital circuit used here to distort: it bends the waveform against a curve."],
    ["Chorus", "An effect that layers slightly detuned copies of the sound: instant width and 80s sheen."],
    ["Delay", "An echo. Tempo-synced delay repeats in rhythm with the track (1/8, dotted 3/16…)."],
    ["Feedback", "How much of an echo is fed back into the delay to echo again. High feedback = long trails."],
    ["Reverb", "Simulates a room or hall around the sound. This app builds its space procedurally; no recordings involved."],
    ["Impulse response (IR)", "A fingerprint of a space that a convolution reverb uses to place your sound inside it. Ours is generated from shaped noise."],
    ["Bitcrusher", "Deliberately reduces digital resolution for gritty, broken texture: the sound of cheap 80s samplers."],
    ["Compressor", "Automatically turns down loud moments so the mix feels dense and even. The master bus uses gentle 'glue' compression."],
    ["Limiter", "A brick wall that stops the signal from ever clipping into harsh digital distortion. It's always on; you're safe."],
    ["Clipping", "What happens when digital audio exceeds maximum level: ugly crackling. The limiter here prevents it."],
    ["Master", "The final channel everything flows through before your speakers: compression, limiting and the volume knob live there."],
    ["Key", "The home note of a piece. Everything gravitates back to it."],
    ["Scale / Minor scale", "The set of 'allowed' notes in a key. The minor scale is the dark-sounding one; this whole app defaults to it."],
    ["Scale lock", "A helper that snaps every note to the current scale so nothing you play can clash."],
    ["Arpeggio (ARP)", "A chord played one note at a time, usually fast and hypnotic: a signature of the reference records."],
    ["Pad", "A soft, sustained chord sound that fills the background like fog."],
    ["Stab", "A short, punchy chord hit: brass-like, rhythmic punctuation."],
    ["Glide / Portamento", "Sliding smoothly from one note's pitch to the next instead of stepping. Makes mono basslines slither."],
    ["Mono / Polyphonic", "Mono = one note at a time (classic bass). Polyphonic = several at once (chords, pads)."],
    ["Sample rate", "How many audio snapshots per second a digital system takes. CD standard is 44100, which is what exports here use."],
    ["Bit depth", "The resolution of each audio snapshot. CD = 16-bit. Fewer bits = noisier (see Bitcrusher)."],
    ["WAV", "An uncompressed, lossless audio file. Big but perfect. The always-available export."],
    ["MP3", "A compressed audio file, about a tenth the size, slightly reduced quality. Fine for sharing."],
    ["Render / Export", "Computing your song into an audio file. Done 'offline', faster than real time and glitch-free."],
    ["Lookahead scheduler", "How this app keeps time: notes are booked slightly in advance on the audio clock, so timing never drifts even if the screen stutters."],
  ],

  /* Strings used inside lesson demo widgets */
  widgets: {
    hold: "♪ HOLD TO PLAY",
    sweep: "AUTO SWEEP",
    cutoff: "CUTOFF",
    reso: "RESONANCE",
    pluck: "▶ PLUCK (hold)",
    padBtn: "▶ PAD (hold)",
    play: "▶ PLAY",
    stop: "■ STOP",
    dry: "DRY",
    dist: "DISTORTION",
    delay: "DELAY",
    verb: "REVERB",
    crush: "BITCRUSH",
    loadChain: "LOAD MINI ARRANGEMENT (uses pattern slots 5–7)",
    chainLoaded: "Loaded. SONG mode is now playing an energy curve; watch the pattern blocks light up.",
    doIt: "✎ WRITE IT IN",
    done: "✓ written. Look at the sequencer",
    abBefore: "HEAR IT CLEAN",
    abAfter: "HEAR IT DIRTY",
    waves: { sawtooth: "SAW", pulse: "PULSE", triangle: "TRI", sine: "SINE" },
  },

  /* ──────────────────────────────────────────────────────────────────────
     LESSONS: interactive, each step may embed a live demo widget.
     Widget kinds are implemented in js/ui/lessons.js:
       osc | filter | env | drumgrid | fxab | chain | groove-*
     ────────────────────────────────────────────────────────────────────── */
  lessonsTitle: "LESSONS: learn by touching sound",
  lessonsIntro: "Seven short lessons, zero prior knowledge assumed. Every demo is live: you trigger every sound yourself.",
  lessonNext: "NEXT →", lessonPrev: "← BACK", lessonDone: "FINISH", lessonClose: "✕",
  lessons: [
    {
      id: "synth", title: "What is a synthesizer?",
      blurb: "Hear a single oscillator and change its waveform.",
      steps: [
        { text: "A synthesizer doesn't record sound. It CREATES it, from a vibration called an oscillator. That's the whole secret. Everything else (filters, envelopes, effects) just shapes this one raw vibration. Press and hold the button below to hear one naked oscillator. This is the raw material of every track you'll make here.", demo: "osc" },
        { text: "The SHAPE of the vibration decides the tone color. While holding the note, switch waveforms: SAW is bright and angry (contains every overtone), PULSE is hollow and cold, TRIANGLE is soft, SINE is pure. Industrial and dark synth-pop are built almost entirely on saws and pulses.", demo: "osc" },
        { text: "That's genuinely it: a synthesizer is an oscillator plus tools to shape it. In the next lesson you'll meet the most important shaping tool: the filter." },
      ],
    },
    {
      id: "filter", title: "Filters: sculpting brightness",
      blurb: "Sweep a cutoff over a raw saw wave.",
      steps: [
        { text: "A raw saw wave is TOO bright, like unprocessed noise from a machine shop. A LOWPASS FILTER fixes that: it removes everything above a chosen frequency, the CUTOFF. Hold the note below and drag the CUTOFF slider. You're performing the single most famous gesture in electronic music.", demo: "filter" },
        { text: "Now raise RESONANCE and sweep again. Resonance boosts a whistle exactly at the cutoff, so the sweep starts to talk; that acidic 'wow' is pure resonance. Almost every bass in this genre is a filtered saw with a bit of resonance.", demo: "filter" },
        { text: "In the studio, every synth track has this filter (the FILTER group in the INSTRUMENT panel). Dark = low cutoff. Bright = high. When a track sounds harsh, your first move is always: close the filter a little." },
      ],
    },
    {
      id: "env", title: "Envelopes: movement over time",
      blurb: "Compare a plucky ADSR against a slow one.",
      steps: [
        { text: "Why does a piano note die away while an organ note holds? The difference is the ENVELOPE, an automatic hand that moves the volume on every note. It has four stages: Attack, Decay, Sustain, Release (ADSR). Play the two buttons below: the SAME oscillator, only the envelope differs.", demo: "env" },
        { text: "PLUCK = instant attack, fast decay, no sustain: perfect for basses and stabs. PAD = slow attack, high sustain, long release: sound that breathes in and out like fog. Between those two extremes lives every rhythm and every atmosphere in your track.", demo: "env" },
        { text: "Envelopes also drive the filter (the ENV→FILT knob): each note starts bright and darkens as it decays. That bright-hit-dark-tail movement is what makes a bassline feel alive instead of static." },
      ],
    },
    {
      id: "drums", title: "Drum machines & steps",
      blurb: "Program a kick pattern together.",
      steps: [
        { text: "A drum machine is a grid: 16 boxes = one bar, each box a 16th note. Click boxes below to program a KICK. Try the classic: boxes 1, 5, 9, 13, known as 'four on the floor'. Then press PLAY.", demo: "drumgrid" },
        { text: "Now break it. Remove the kick on 13, or add one on 11, and feel how one box changes the whole groove. Every drum sound in this app is SYNTHESIZED (the kick is a sine wave whose pitch drops fast); no recordings anywhere.", demo: "drumgrid" },
        { text: "The main sequencer works exactly like this, with 8 rows instead of 1: four drums, bass, lead, pad, arp. Melodic rows work the same way, plus a pitch per step (mouse-wheel over a step changes it)." },
      ],
    },
    {
      id: "fx", title: "Effects: dirt and space",
      blurb: "A/B a dry loop against distortion, delay and reverb.",
      steps: [
        { text: "Effects are rooms and abuse you apply to a finished voice. Below, a short loop plays DRY (untouched). Now click DISTORTION: the signal is overloaded until it snarls. This one effect is half the industrial aesthetic.", demo: "fxab" },
        { text: "DELAY is a tempo-locked echo; notice how three notes become a rolling pattern. REVERB places everything inside a big dark hall (generated from pure math; no hall was recorded). BITCRUSH breaks the sound like a cheap 80s sampler.", demo: "fxab" },
        { text: "In the studio these are SHARED effects: each track has SEND knobs deciding how much of it visits each effect. Send the snare to reverb, the lead to delay, everything a little into distortion. That's a classic dark mix." },
      ],
    },
    {
      id: "song", title: "Song structure: energy over time",
      blurb: "How pattern chains become arrangements.",
      steps: [
        { text: "A track is just patterns arranged over time: A A B B A A C C… The listener hears ENERGY: start sparse, add layers, strip back, peak, end. Click below to load a miniature arrangement into SONG mode and hear a 30-second energy curve.", demo: "chain" },
        { text: "The recipe used by most electronic tracks: INTRO (few elements) → BUILD (add bass, then leads) → PEAK (everything on) → BREAK (drop the drums) → PEAK again → OUT. With 8 patterns and a chain you can build all of it." },
        { text: "Rule of thumb: change SOMETHING every 4 bars. Add a hat, open a filter, mute a pad. At 120 BPM, 32 chained bars ≈ 64 seconds: a real track. That's what EXPORT renders to WAV or MP3." },
      ],
    },
    {
      id: "groove", title: "Capstone: your first industrial groove",
      blurb: "Build a playing pattern, step by step, for real.",
      steps: [
        { text: "Time to build a real groove IN THE ACTUAL SEQUENCER. This lesson writes into pattern slot 8, and everything stays yours when we finish. First: the spine. Click below to put a kick on every beat, then press PLAY (the transport up top) and leave it running.", demo: "groove-kick" },
        { text: "Snare on beats 2 and 4: the backbeat. Add it, and notice we accented it (accents hit harder). With just these two rows you already have the skeleton of a track.", demo: "groove-snare" },
        { text: "Hats OFF the beat, on the 'and' between kicks. Offbeat hats create forward motion; suddenly the groove runs instead of stomps.", demo: "groove-hats" },
        { text: "Now the bassline: driving 8th-notes on the root, with two passing notes so it snakes. It's dark, distorted, and locked to the minor scale. This is your engine room.", demo: "groove-bass" },
        { text: "Finally, dirt: we push the bass and kick into the shared distortion and add a touch of reverb to the snare. Compare before/after with the button. Then this groove is yours: change notes, add an arp, chain it into a song. You just built an industrial track from nothing.", demo: "groove-fx" },
      ],
    },
  ],
};
