// ── Music.js ──────────────────────────────────────────────────────────────────
// Background music, generated as it plays (no audio files). Two moods: a calm
// sea theme for the island and menus, and a tenser battle theme. A scheduler
// queues notes a little ahead of time; switching mood crossfades.
//
//   Music.set('calm' | 'battle' | null)
//
// Plays through Sfx's output, so the speaker button mutes it too.

const Music = {
  mood: null, song: null, timer: null,
  VOLUME: 0.6,

  SONGS: {
    // Am – F – C – G, two bars each; slow pad, soft bass, sparse plucks
    calm:   { bpm: 72,  chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]],
              melody: [69, 72, 74, 76, 79, 81], pluck: 0.32, bassEvery: 8 },
    // Dm – B♭ – C – A; pulsing bass, kick and hats, busier plucks
    battle: { bpm: 112, chords: [[50, 53, 57], [46, 50, 53], [48, 52, 55], [45, 49, 52]],
              melody: [62, 65, 67, 69, 72, 74], pluck: 0.22, pulse: true, drums: true }
  },

  set(mood) {
    if (mood === Music.mood) return;
    Music.mood = mood;
    if (Music.song) {
      // Fade the old song out, then let it go
      const old = Music.song;
      Music.song = null;
      if (Sfx.ctx) old.bus.gain.setTargetAtTime(0.0001, Sfx.ctx.currentTime, 0.4);
      setTimeout(() => { try { old.bus.disconnect(); } catch (e) { /* already gone */ } }, 2500);
    }
    if (!Music.timer) Music.timer = setInterval(Music.tick, 100);
  },

  // Queue every note due in the next 0.3s
  tick() {
    const ctx = Sfx.ctx;
    if (!ctx || ctx.state !== 'running' || !Music.mood) return;
    if (!Music.song) Music.song = Music.start(Music.SONGS[Music.mood]);
    const s = Music.song, eighth = 60 / s.def.bpm / 2;
    if (s.next < ctx.currentTime) s.next = ctx.currentTime + 0.05;
    while (s.next < ctx.currentTime + 0.3) { Music.step(s, s.next, eighth); s.next += eighth; s.i++; }
  },

  start(def) {
    const ctx = Sfx.ctx, bus = ctx.createGain();
    bus.gain.setValueAtTime(0.0001, ctx.currentTime);
    bus.gain.setTargetAtTime(Music.VOLUME, ctx.currentTime, 0.8);
    // A soft echo for the plucks
    const echo = ctx.createDelay(1), fb = ctx.createGain(), wet = ctx.createGain();
    echo.delayTime.value = 60 / def.bpm * 0.75; fb.gain.value = 0.32; wet.gain.value = 0.5;
    echo.connect(fb); fb.connect(echo); echo.connect(wet); wet.connect(bus);
    bus.connect(Sfx.out);
    return { def, bus, echo, next: 0, i: 0 };
  },

  hz(m) { return 440 * Math.pow(2, (m - 69) / 12); },

  step(s, t, eighth) {
    const ctx = Sfx.ctx, d = s.def, i = s.i;
    const chord = d.chords[Math.floor(i / 16) % d.chords.length];
    // Pad: the chord, held for two bars
    if (i % 16 === 0) chord.forEach(m => Music.pad(ctx, t, s.bus, Music.hz(m), eighth * 16));
    // Bass
    if (d.pulse) Music.note(ctx, t, s.bus, Music.hz(chord[0] - 12), { type: 'square', dur: eighth * 0.8, vol: 0.05, lp: 500 });
    else if (i % d.bassEvery === 0) Music.note(ctx, t, s.bus, Music.hz(chord[0] - 12), { type: 'sine', dur: eighth * 7, vol: 0.18, lp: 400, attack: 0.08 });
    // Drums
    if (d.drums) {
      if (i % 4 === 0) Sfx.tone(ctx, t, s.bus, { f0: 120, f1: 45, dur: 0.18, vol: 0.32 });
      if (i % 2 === 1) Sfx.noise(ctx, t, s.bus, { type: 'highpass', f0: 7000, dur: 0.04, vol: 0.05 });
      if (i % 8 === 4) Sfx.noise(ctx, t, s.bus, { type: 'bandpass', f0: 1800, q: 0.8, dur: 0.12, vol: 0.1 });
    }
    // Plucks: mostly chord tones, sometimes a passing note
    if ((d.pulse || i % 2 === 0) && Math.random() < d.pluck) {
      const pool = Math.random() < 0.6 ? chord.map(m => m + 12) : d.melody;
      const m = pool[Math.floor(Math.random() * pool.length)];
      const g = Music.note(ctx, t, s.bus, Music.hz(m), { type: 'triangle', dur: 0.5, vol: 0.08 });
      g.connect(s.echo);
    }
  },

  // A short note with an envelope; returns its gain node (for the echo send)
  note(ctx, t, out, hz, { type = 'sine', dur = 0.3, vol = 0.1, lp = 2400, attack = 0.01 }) {
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = type; o.frequency.value = hz;
    f.type = 'lowpass'; f.frequency.value = lp;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(out);
    o.start(t); o.stop(t + dur + 0.05);
    return g;
  },

  // A slow-swelling pad voice
  pad(ctx, t, out, hz, dur) {
    [0, 4].forEach(detune => {
      const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = hz; o.detune.value = detune;
      f.type = 'lowpass'; f.frequency.value = 900;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.035, t + dur * 0.3);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 1.05);
      o.connect(f); f.connect(g); g.connect(out);
      o.start(t); o.stop(t + dur * 1.1);
    });
  }
};
