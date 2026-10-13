// Lanternfall: music. Every track is composed on the fly from a seed: a chord progression,
// a melody that walks over it (landing on the chord's notes on the strong beats), a bass
// line, a soft pad and a few drums, eight bars that loop. Each world has its own key, mode
// and tempo; boss towers, the castle, the map and the fruit groves have their own too.
// Played with Web Audio through a little look-ahead scheduler. No DOM. ui.js hands over its
// AudioContext (LF.music.attach) once you've pressed something, and says what to play.
(() => {
  const LF = window.LF;
  const M = LF.music = {};
  const SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11], mixo: [0, 2, 4, 5, 7, 9, 10], harmonic: [0, 2, 3, 5, 7, 8, 11],
  };
  // Chord progressions (scale degrees of each bar's chord), per mode.
  const PROGS = {
    major: [[0, 5, 3, 4], [0, 3, 4, 3], [0, 4, 5, 3]], minor: [[0, 5, 2, 6], [0, 3, 6, 4], [0, 6, 5, 4]],
    dorian: [[0, 3, 0, 6], [0, 6, 3, 4]], lydian: [[0, 1, 0, 4], [0, 1, 5, 4]], mixo: [[0, 6, 3, 0], [0, 3, 6, 4]],
    harmonic: [[0, 0, 5, 4], [0, 3, 4, 4]],
  };
  // What each track is: mode, root note (MIDI), tempo, feel (calm: pad and soft hats;
  // drive: full drums; sky; spooky; grand; fight), and a seed.
  const TRACKS = {
    map: { mode: 'major', root: 60, bpm: 92, feel: 'calm', seed: 11 },
    grove: { mode: 'major', root: 65, bpm: 150, feel: 'drive', seed: 77 },
    // Towers: the climb and battlements (spooky); the castle's climb (grand, an organ and
    // brass march). (Each boss's own fight music is made from its name: see fightTrack. The
    // final boss has its own.)
    tower: { mode: 'minor', root: 57, bpm: 108, feel: 'spooky', seed: 31 },
    castle: { mode: 'harmonic', root: 50, bpm: 100, feel: 'grand', seed: 41 },
    final: { mode: 'harmonic', root: 50, bpm: 160, feel: 'fight', seed: 99 },
    world0: { mode: 'major', root: 62, bpm: 104, feel: 'drive', seed: 1 },      // Old Town
    world1: { mode: 'mixo', root: 60, bpm: 98, feel: 'drive', seed: 2 },        // the Waterfront
    world2: { mode: 'dorian', root: 57, bpm: 112, feel: 'drive', seed: 3 },     // the Clockwork Quarter
    world3: { mode: 'lydian', root: 67, bpm: 116, feel: 'sky', seed: 4 },       // the Sky Roads
    world4: { mode: 'mixo', root: 62, bpm: 100, feel: 'drive', seed: 5 },       // the Canal District
    world5: { mode: 'major', root: 64, bpm: 108, feel: 'drive', seed: 6 },      // the Garden Market
    world6: { mode: 'minor', root: 57, bpm: 110, feel: 'drive', seed: 7 },      // the Smokelands
    world7: { mode: 'dorian', root: 59, bpm: 118, feel: 'drive', seed: 8 },     // the Glass Mines
    world8: { mode: 'minor', root: 55, bpm: 96, feel: 'drive', seed: 9 },       // Night's End
  };
  const RHYTHMS = [[0, 3, 6, 8, 10, 12, 14], [0, 2, 4, 6, 8, 11, 12, 14], [0, 4, 6, 8, 12, 14], [0, 2, 3, 6, 8, 10, 12], [0, 3, 4, 8, 11, 12]];

  // A boss fight's music: 'fight:<name>' — fast and minor, with its own key, tempo, mode,
  // chords and hook from the boss's name (see composeFight).
  function fightTrack(name) {
    let h = 7; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return { mode: ['harmonic', 'minor', 'dorian', 'harmonic'][h % 4], root: 52 + (h >>> 3) % 7, bpm: 146 + (h >>> 6) % 5 * 4, feel: 'fight', seed: h % 100000 };
  }
  // Boss fights are built differently, after the castle-boss music of the Mario games: one
  // short hook, played again and carried round the chords so it sticks (and a third higher
  // the second time round), an answer, then a cadence with two big chord hits; under it
  // a bass pumping octaves that creeps up by semitones into the next chord, brass stabs on
  // the off-beats, and a tom fill to bring it round again. Hooks are [step, degree above the
  // chord's root] (16 steps a bar); each boss nudges a note or two of its own.
  const FIGHT_PROGS = [[0, 5, 6, 4], [0, 3, 4, 0], [0, 6, 5, 4], [0, 3, 5, 4]];
  const HOOKS = [
    [[0, 0], [2, 0], [3, 2], [6, 4], [8, 3], [10, 2], [12, 1], [14, -1]],
    [[0, 4], [3, 4], [6, 2], [8, 0], [10, 1], [11, 2], [12, 4]],
    [[0, 0], [3, 0], [4, 1], [6, 2], [8, 4], [11, 2], [12, 0]],
    [[0, 7], [2, 6], [3, 4], [6, 4], [8, 2], [10, 4], [11, 2], [12, 0]],
    [[0, 0], [1, 0], [2, 0], [4, 2], [6, 4], [7, 4], [8, 4], [10, 5], [12, 4], [14, 2]],
    [[0, 4], [2, 3], [3, 4], [6, 0], [8, 4], [10, 3], [11, 4], [12, 7]],
  ];
  const ANSWERS = [
    [[0, 4], [2, 2], [4, 0], [6, -1], [8, 0]],
    [[0, 2], [3, 1], [6, 0], [8, -1], [10, -3], [12, -1]],
    [[0, 7], [2, 4], [4, 2], [6, 4], [8, 0]],
  ];
  const CADENCE = [[0, 4], [3, 2], [6, 0]];
  // The towers' chords: all minor (natural minor's i, iv and v, with ♭VI for colour).
  const TOWER_PROGS = [[0, 3, 4, 0], [0, 3, 0, 4], [0, 4, 3, 0], [0, 5, 3, 4]];
  function composeFight(t, R, progs = FIGHT_PROGS) {
    const scale = SCALES[t.mode], pitch = d => t.root + scale[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
    const prog = progs[Math.floor(R() * progs.length)];
    const hook = HOOKS[Math.floor(R() * HOOKS.length)].map(([s, d], k) => [s, d + (k && R() < .2 ? (R() < .5 ? 1 : -1) : 0)]);
    const answer = ANSWERS[Math.floor(R() * ANSWERS.length)];
    // (Chords high in the scale take the hook down an octave, to keep the tune in one range.)
    const phrase = (notes, c, lift) => {
      if (c > 3) c -= 7;
      const lead = Array(16).fill(null), len = Array(16).fill(0);
      notes.forEach(([s, d], k) => { lead[s] = pitch(7 + c + d + lift); len[s] = Math.min(3, (notes[k + 1] || [16])[0] - s); });
      return { lead, len };
    };
    return Array.from({ length: 8 }, (_, k) => {
      const c = prog[k % 4], next = prog[(k + 1) % 4], lift = k >= 4 && k % 4 < 2 ? 2 : 0;
      const { lead, len } = phrase(k % 4 < 2 ? hook : k % 4 === 2 ? answer : CADENCE, c, lift);
      // (The last bar runs up into the hook to go round again.)
      if (k === 7) [-4, -3, -2, -1].forEach((d, j) => { lead[12 + j] = pitch(7 + prog[0] + hook[0][1] + d); len[12 + j] = 1; });
      const root = pitch(c) - 24, to = pitch(next) - 24 + (pitch(next) < pitch(c) - 4 ? 12 : 0);
      const bass = Array(16).fill(null);
      for (let s = 0; s < 16; s += 2) bass[s] = root + (s % 4 === 2 ? 12 : 0);
      if (k % 2) { bass[12] = to - 3; bass[13] = to - 2; bass[14] = to - 1; bass[15] = null; }
      return {
        lead, len, bass, chord: [0, 2, 4].map(d => pitch(c + d)),
        stab: k % 4 === 3 ? [] : k % 2 ? [6, 14] : [3, 6],
        hit: k % 4 === 3 ? [8, 10] : [],
        toms: k === 7, fill: k === 3,
      };
    });
  }

  // The castle has a tune of its own, written out rather than made up: D minor, dark and
  // grand, after the Mario castle themes. A phrase over i–♭VI–iv–V that hangs on the V, the
  // same again turning off through ♭II (E♭) before coming home. Notes are [step, MIDI].
  const CASTLE = [
    { ch: [62, 65, 69], root: 38, lead: [[0, 74], [3, 69], [6, 74], [8, 76], [9, 77], [11, 76], [12, 74]], stab: [3, 11] },
    { ch: [58, 62, 65], root: 34, lead: [[0, 77], [3, 74], [6, 77], [8, 79], [9, 81], [11, 79], [12, 77]], stab: [3, 11] },
    { ch: [55, 58, 62], root: 31, lead: [[0, 79], [3, 82], [5, 81], [6, 79], [8, 77], [10, 76], [12, 74]], stab: [3, 11], fill: true },
    { ch: [57, 61, 64], root: 33, lead: [[0, 73], [4, 76], [8, 69]], hit: [12, 14] },
    { ch: [62, 65, 69], root: 38, lead: [[0, 74], [3, 69], [6, 74], [8, 76], [9, 77], [11, 76], [12, 74]], stab: [3, 11] },
    { ch: [55, 58, 63], root: 39, lead: [[0, 75], [3, 79], [6, 82], [8, 81], [9, 79], [11, 77], [12, 75]], stab: [3, 11] },
    { ch: [57, 61, 64], root: 33, lead: [[0, 76], [3, 73], [6, 76], [8, 79], [10, 77], [12, 76], [14, 73]], stab: [3, 11] },
    { ch: [62, 65, 69], root: 38, lead: [[0, 74], [8, 69], [10, 70], [12, 73]], hit: [0], toms: true },
  ];
  function castleBars() {
    return CASTLE.map(c => {
      const lead = Array(16).fill(null), len = Array(16).fill(0), bass = Array(16).fill(null);
      c.lead.forEach(([st, n], k) => { lead[st] = n; len[st] = Math.min(8, (c.lead[k + 1] || [16])[0] - st); });
      // (The bass pulses in eighths, an octave leap and a semitone's shudder in each bar.)
      [0, 0, 12, 0, 0, 12, 1, 0].forEach((d, k) => { bass[k * 2] = c.root + d; });
      return { lead, len, bass, chord: c.ch, stab: c.stab || [], hit: c.hit || [], fill: !!c.fill, toms: !!c.toms };
    });
  }

  const cache = {};
  function compose(name) {
    if (cache[name]) return cache[name];
    const t = name.startsWith('fight:') ? fightTrack(name.slice(6)) : TRACKS[name] || TRACKS.map, R = LF.rng(t.seed * 7919 + 13), scale = SCALES[t.mode];
    // (Fights, the towers and the castle are all built on a hook, so they stick.)
    if (t.feel === 'grand') return cache[name] = { ...t, bars: castleBars() };
    if (t.feel === 'fight') return cache[name] = { ...t, bars: composeFight(t, R) };
    if (t.feel === 'spooky') {
      // A tower: the hook, but under it a bass creeping down a semitone every bar (back up at
      // the top), plucked on the beat and a tritone above.
      const bars = composeFight(t, R, TOWER_PROGS);
      bars.forEach((b, k) => {
        const root = t.root - 24 - (k % 4);
        b.bass = Array(16).fill(null);
        for (const st of [0, 4, 8, 12]) b.bass[st] = root + (st === 4 || st === 12 ? 6 : 0);
      });
      return cache[name] = { ...t, bars };
    }
    const prog = PROGS[t.mode][Math.floor(R() * PROGS[t.mode].length)];
    const pitch = d => t.root + scale[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
    const chordTones = c => [c, c + 2, c + 4];
    // A bar of melody over chord c: a rhythm, then a walk in scale steps that lands on the
    // chord's notes on the strong beats (and ends a phrase on the chord's root).
    let deg = 7 + prog[0];
    const bar = (c, end) => {
      const lead = Array(16).fill(null), rh = RHYTHMS[Math.floor(R() * RHYTHMS.length)];
      for (const s of rh) {
        deg += [-2, -1, -1, 1, 1, 2, 0][Math.floor(R() * 7)];
        if (s % 4 === 0) { const ct = chordTones(c).flatMap(x => [x + 7, x + 14]); deg = ct.reduce((a, b) => (Math.abs(b - deg) < Math.abs(a - deg) ? b : a)); }
        deg = Math.max(5, Math.min(16, deg));
        lead[s] = pitch(deg);
      }
      if (end) { for (let s = 12; s < 16; s++) lead[s] = null; lead[12] = pitch(7 + c); }
      return lead;
    };
    const A = prog.map((c, k) => bar(c, k === 3));
    const B = prog.map((c, k) => (k < 2 ? A[k] : bar(c, k === 3)));
    const bars = [...A, ...B].map((lead, k) => {
      const c = prog[k % 4];
      const bass = Array(16).fill(null);
      if (t.feel === 'boss') for (let s = 0; s < 16; s += 2) bass[s] = pitch(c) - 24 + (s % 8 === 6 ? 7 : 0);
      else if (t.feel === 'sky') bass[0] = pitch(c) - 24;
      else for (const s of [0, 4, 8, 12]) bass[s] = pitch(c) - 24 + (s === 8 && t.feel !== 'calm' ? 7 : 0);
      return { lead, bass, chord: chordTones(c).map(d => pitch(d) - 12) };
    });
    return cache[name] = { ...t, bars };
  }

  // ---- voices ----
  let ac = null, out = null, noiseBuf = null;
  function voice(f, t, dur, type, v, attack = .01) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(v, t + attack); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(out); o.start(t); o.stop(t + dur + .05);
  }
  const hz = n => 440 * Math.pow(2, (n - 69) / 12);
  // A string section: each note on two slightly detuned saws, softened, swelling in slowly.
  function pad(notes, t, dur, v) {
    const f = ac.createBiquadFilter(), g = ac.createGain();
    f.type = 'lowpass'; f.frequency.setValueAtTime(1500, t);
    g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(v, t + dur * .3); g.gain.linearRampToValueAtTime(v * .7, t + dur * .85); g.gain.linearRampToValueAtTime(.0001, t + dur + .3);
    f.connect(g).connect(out);
    for (const n of notes) for (const d of [-8, 8]) {
      const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(hz(n), t); o.detune.setValueAtTime(d, t);
      o.connect(f); o.start(t); o.stop(t + dur + .35);
    }
  }
  // How loud the strings are under each kind of track.
  const STRINGS = { calm: .012, drive: .011, sky: .008, spooky: .007, grand: .011, fight: .009 };
  function kick(t, v) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + .12);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + .16);
    o.connect(g).connect(out); o.start(t); o.stop(t + .2);
  }
  function noise(t, v, dur, type, freq, swell) {
    if (!noiseBuf) { noiseBuf = ac.createBuffer(1, ac.sampleRate * .3, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; s.loop = true; f.type = type; f.frequency.value = freq;
    // (A swell rises and falls, like a gust of wind; otherwise it's a hit that dies away.)
    if (swell) { g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(v, t + dur / 2); g.gain.linearRampToValueAtTime(.0001, t + dur); }
    else { g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur); }
    s.connect(f).connect(g).connect(out); s.start(t); s.stop(t + dur + .02);
  }
  function tom(t, f, v) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * .6, t + .16);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + .2);
    o.connect(g).connect(out); o.start(t); o.stop(t + .25);
  }
  // A theremin-ish voice: a sine that slides up into its note and wavers.
  function theremin(f, t, dur, v) {
    const o = ac.createOscillator(), g = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f * .96, t); o.frequency.exponentialRampToValueAtTime(f, t + .07);
    lfo.frequency.setValueAtTime(5.5, t); lg.gain.setValueAtTime(f * .018, t); lfo.connect(lg).connect(o.frequency);
    g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(v, t + .05); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(out); o.start(t); o.stop(t + dur + .05); lfo.start(t); lfo.stop(t + dur + .05);
  }
  function playStep(tr, i, t) {
    const b = tr.bars[Math.floor(i / 16)], s = i % 16, spb = 60 / tr.bpm / 4 / (fast ? 1.3 : 1), bar = Math.floor(i / 16);
    // Under every track: strings on each bar's chord (an octave of it, with the root below);
    // and, but for the gentle ones, timpani at the top of each phrase and a cymbal swelling
    // into the loop's return.
    if (s === 0) pad([b.chord[0] - 12, ...b.chord, b.chord[0] + 12], t, spb * 16, STRINGS[tr.feel] || .01);
    if (tr.feel !== 'calm' && tr.feel !== 'sky') {
      if (s === 0 && bar % 4 === 0) { tom(t, hz(b.chord[0] - 24) * 2, .24); tom(t + spb, hz(b.chord[0] - 24) * 2, .16); }
      if (bar === tr.bars.length - 1 && s === 8) noise(t, .035, spb * 8, 'highpass', 4000, true);
    }
    if (tr.feel === 'sky') {
      // The Sky Roads: a high bell of a tune with an echo, harp-like arpeggios rippling up,
      // a deep slow bass, gusts of wind, and just a shaker for a beat.
      if (b.lead[s]) { voice(hz(b.lead[s] + 12), t, spb * 6, 'sine', .05, .005); voice(hz(b.lead[s] + 12), t + spb * 3, spb * 5, 'sine', .018, .005); }
      if (s % 2 === 0) voice(hz(b.chord[(s / 2) % 3] + 12 + (s >= 8 ? 12 : 0)), t, spb * 3, 'triangle', .016, .004);
      if (b.bass[s]) voice(hz(b.bass[s]), t, spb * 15, 'sine', .07, .05);
      if (s === 0 && Math.floor(i / 16) % 2 === 0) noise(t, .02, spb * 28, 'bandpass', 500, true);
      if (s % 4 === 2) noise(t, .008, .05, 'highpass', 9000);
      return;
    }
    if (tr.feel === 'spooky') {
      // A tower: a wavering theremin tune with a ghostly echo, a music box tinkling the chord
      // high up, the creeping plucked bass, a clock ticking, and a deep bell now and then.
      if (b.lead[s]) { const d = spb * Math.max(2, b.len[s]) * .95; theremin(hz(b.lead[s]), t, d, .05); theremin(hz(b.lead[s]), t + spb * 3, d, .016); }
      if (s % 2 === 0) voice(hz(b.chord[(s / 2) % 3] + 24), t, spb * 1.5, 'triangle', .012, .003);
      if (b.bass[s]) voice(hz(b.bass[s]), t, spb * 1.2, 'triangle', .09, .004);
      if (s % 4 === 0) noise(t, s % 8 ? .006 : .011, .025, 'highpass', 6000);
      if (s === 0 || s === 10) kick(t, .12);
      if (s === 0 && bar % 4 === 0) { voice(hz(tr.root - 12), t, spb * 14, 'sine', .05, .005); voice(hz(tr.root - 12) * 2.76, t, spb * 6, 'sine', .015, .005); }
      if (b.hit.includes(s)) for (const n of b.chord) voice(hz(n), t, spb * 3, 'sine', .022, .01);
      return;
    }
    if (tr.feel === 'grand') {
      // The castle: a pipe organ holding the chords, its tune on brass with an organ an
      // octave up, a bass pulsing in eighths, timpani on the beat (rolling into each half's
      // end), a marching snare, cymbals, and a great bell tolling at the top of each half.
      if (s === 0 || s === 8) for (const n of b.chord) for (const o of [-12, 0, 12]) voice(hz(n + o), t, spb * 8.5, o ? 'sine' : 'square', o ? .012 : .008, .04);
      if (b.lead[s]) { const d = spb * b.len[s] * .95 + .04; voice(hz(b.lead[s]), t, d, 'sawtooth', .026, .02); voice(hz(b.lead[s] - 12), t, d, 'sawtooth', .012, .02); voice(hz(b.lead[s] + 12), t, d, 'sine', .01, .02); }
      if (b.bass[s]) { voice(hz(b.bass[s]), t, spb * 1.8, 'triangle', .09, .006); voice(hz(b.bass[s] + 12), t, spb * 1.2, 'square', .01, .006); }
      if (s === 0 && bar % 4 === 0) { voice(hz(b.chord[0] - 24), t, spb * 20, 'sine', .06, .005); voice(hz(b.chord[0] - 24) * 2.76, t, spb * 8, 'sine', .02, .005); voice(hz(b.chord[0] - 24) * 5.4, t, spb * 4, 'sine', .01, .005); }
      if (s === 0 || s === 8 || ((b.fill || b.toms) && s >= 12)) tom(t, hz(b.chord[0] - 24) * 2, .26);
      if (s === 4 || s === 12) noise(t, .05, .1, 'bandpass', 2200);
      if (s === 14 && bar % 2) noise(t, .03, .06, 'bandpass', 2200);
      if (s === 0 && bar % 4 === 0) noise(t, .045, 1.2, 'highpass', 4500);
      if (b.stab.includes(s) || b.hit.includes(s)) for (const n of b.chord) voice(hz(n), t, spb * 1.6, 'sawtooth', .014, .006);
      return;
    }
    if (tr.feel === 'fight') {
      // A fight: a brassy lead doubled an octave down, the pumping bass, off-beat stabs and
      // chord hits; hats on every step, kicks driving, snares on the backbeat (a fill at the end
      // of the first half, toms at the end of the second) and a crash at the top.
      if (b.lead[s]) { const d = spb * b.len[s] * .85 + .03; voice(hz(b.lead[s]), t, d, 'square', .028, .005); voice(hz(b.lead[s] - 12), t, d, 'sawtooth', .012, .005); }
      if (b.bass[s]) { voice(hz(b.bass[s]), t, spb * 1.1, 'triangle', .1, .005); voice(hz(b.bass[s]), t, spb * .8, 'sawtooth', .018, .005); }
      if (b.stab.includes(s)) for (const n of b.chord) voice(hz(n), t, spb * 1.3, 'sawtooth', .016, .004);
      if (b.hit.includes(s)) for (const n of b.chord) { voice(hz(n), t, spb * 1.8, 'square', .02, .004); voice(hz(n - 12), t, spb * 1.8, 'triangle', .03, .004); }
      noise(t, s % 2 ? .01 : .02, .03, 'highpass', 8000);
      if ([0, 3, 6, 8, 11, 14].includes(s) && !(b.toms && s >= 12)) kick(t, .24);
      if (b.toms && s >= 12) tom(t, 260 - (s - 12) * 45, .2);
      else if (s === 4 || s === 12 || (b.fill && s >= 13)) noise(t, .08, .11, 'bandpass', 1900);
      if (s === 0 && bar % 8 === 0) noise(t, .05, .6, 'highpass', 5000);
      return;
    }
    if (b.lead[s]) voice(hz(b.lead[s]), t, spb * (tr.feel === 'calm' ? 3.5 : 2.2), tr.feel === 'calm' ? 'triangle' : 'square', tr.feel === 'calm' ? .05 : .022);
    // (A horn doubling the tune an octave down.)
    if (b.lead[s] && tr.feel === 'drive') voice(hz(b.lead[s] - 12), t, spb * 2.4, 'sawtooth', .012, .02);
    if (b.bass[s]) voice(hz(b.bass[s]), t, spb * (tr.feel === 'boss' ? 1.8 : 3.6), 'triangle', .07);
    if (s === 0 && tr.feel === 'calm') for (const n of b.chord) voice(hz(n), t, spb * 16, 'sine', .018, .4);
    if (tr.feel === 'calm') { if (s === 4 || s === 12) noise(t, .012, .04, 'highpass', 7000); return; }
    if (s % 2 === 0) noise(t, tr.feel === 'boss' ? .022 : .014, .035, 'highpass', 7000);
    if (s === 0 || s === 8 || (tr.feel === 'boss' && (s === 3 || s === 10))) kick(t, .22);
    if (s === 4 || s === 12) noise(t, .07, .12, 'bandpass', 1800);
  }

  // ---- the scheduler ----
  let track = null, want = 'map', step = 0, nextT = 0, timer = null, on = true, muted = false, duck = 1, fast = false, quietTill = 0;
  const level = () => (on && !muted ? .5 * duck : 0);
  function tick() {
    if (!ac || !track || ac.state !== 'running') return;
    const spb = 60 / track.bpm / 4 / (fast ? 1.3 : 1);
    if (nextT < ac.currentTime) nextT = ac.currentTime + .05;
    while (nextT < ac.currentTime + .15) {
      if (level() > 0 && nextT >= quietTill) playStep(track, step, nextT);
      nextT += spb; step = (step + 1) % (track.bars.length * 16);
    }
  }
  function start(name) {
    track = compose(name); step = 0;
    if (ac) {
      nextT = ac.currentTime + .08;
      out.gain.cancelScheduledValues(ac.currentTime); out.gain.setValueAtTime(0, ac.currentTime); out.gain.linearRampToValueAtTime(level(), ac.currentTime + .6);
    }
  }
  M.attach = context => {
    if (ac || !context) return;
    ac = context; out = ac.createGain(); out.gain.value = 0;
    // Everything plays in a big hall: a long reverb tail mixed under the dry sound, and a
    // gentle compressor gluing it all together.
    const comp = ac.createDynamicsCompressor(), hall = ac.createConvolver(), wet = ac.createGain();
    comp.threshold.value = -18; comp.ratio.value = 3; comp.attack.value = .01; comp.release.value = .25;
    const len = Math.floor(ac.sampleRate * 2.8), ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    hall.buffer = ir; wet.gain.value = .32;
    out.connect(comp); out.connect(hall).connect(wet).connect(comp); comp.connect(ac.destination);
    timer = setInterval(tick, 25);
    start(want);
  };
  // Play a track (by name: map, grove, tower, castle, final, world0…world8, or fight:<boss>);
  // the same one keeps going.
  M.play = name => { if (name === want && track) return; want = name; if (ac) start(name); };
  const setLevel = () => { if (ac) { out.gain.cancelScheduledValues(ac.currentTime); out.gain.setTargetAtTime(level(), ac.currentTime, .08); } };
  M.setOn = v => { on = v; setLevel(); };
  M.setMuted = v => { muted = v; setLevel(); };
  M.duck = v => { duck = v ? .35 : 1; setLevel(); };
  M.isOn = () => on;
  // Hurry up (the level clock's down to 100 seconds): a quick rising tune, three runs each a
  // step higher than the last, while the track holds its breath; then the track plays on
  // faster until hurry(false).
  M.hurry = v => {
    if (!v) { fast = false; quietTill = 0; return; }
    if (fast) return;
    fast = true;
    if (!ac) return;
    const t0 = ac.currentTime + .05, n = .075;
    [0, 2, 4].forEach((up, k) => [72, 76, 79, 84].forEach((m, j) => {
      const t = t0 + k * .42 + j * n;
      voice(hz(m + up), t, n * 1.6, 'square', .05, .004); voice(hz(m + up - 12), t, n * 1.6, 'triangle', .05, .004);
    }));
    [0, 2, 4].forEach((up, k) => kick(t0 + k * .42, .2));
    quietTill = t0 + 3 * .42 + .25;
  };
  // (For checking it's playing: the track, the step it's on, the volume.)
  M.status = () => ({ track: want, step, level: level(), running: !!(ac && ac.state === 'running') });
})();
