// ── Sfx.js ────────────────────────────────────────────────────────────────────
// Sound effects synthesised with the Web Audio API — no audio files. Phones
// only allow audio after the player touches the screen, so the context is
// created (or resumed) on the first pointer event.
//
//   Sfx.play('shot')       play a named effect (quietly ignored if muted)
//   Sfx.toggleMute()       flip mute; remembered on this device
//
// Busy effects (shots, hits) are rate-limited so ten towers firing at once
// don't turn into noise.

const Sfx = {
  ctx: null, out: null, noiseBuf: null,
  muted: false, _last: {},
  VOLUME: 0.5,

  init() {
    try { Sfx.muted = localStorage.getItem('factower_muted') === '1'; } catch (e) { /* storage blocked */ }
    const unlock = () => {
      if (!Sfx.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        Sfx.ctx = new AC();
        Sfx.out = Sfx.ctx.createGain();
        Sfx.out.gain.value = Sfx.muted ? 0 : Sfx.VOLUME;
        // Gentle limiter so overlapping effects never clip
        const comp = Sfx.ctx.createDynamicsCompressor();
        comp.threshold.value = -14; comp.ratio.value = 6;
        Sfx.out.connect(comp); comp.connect(Sfx.ctx.destination);
        const n = Sfx.ctx.sampleRate;
        Sfx.noiseBuf = Sfx.ctx.createBuffer(1, n, n);
        const d = Sfx.noiseBuf.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      }
      if (Sfx.ctx.state === 'suspended') Sfx.ctx.resume();
    };
    ['pointerdown', 'touchstart', 'keydown'].forEach(ev => window.addEventListener(ev, unlock, { passive: true }));
  },

  toggleMute() {
    Sfx.muted = !Sfx.muted;
    try { localStorage.setItem('factower_muted', Sfx.muted ? '1' : '0'); } catch (e) { /* storage blocked */ }
    if (Sfx.out) Sfx.out.gain.setTargetAtTime(Sfx.muted ? 0 : Sfx.VOLUME, Sfx.ctx.currentTime, 0.02);
    if (!Sfx.muted) Sfx.play('tap');
    return Sfx.muted;
  },

  // Minimum gap (ms) between plays of busy effects
  GAP: { shot: 70, shot2: 80, bomb: 120, boom: 90, hit: 50, sink: 90, coin: 60, tick: 40, zap: 140 },

  play(name) {
    if (Sfx.muted || !Sfx.ctx || Sfx.ctx.state !== 'running') return;
    const fx = Sfx.FX[name];
    if (!fx) return;
    const now = performance.now(), gap = Sfx.GAP[name] || 0;
    if (gap && now - (Sfx._last[name] || 0) < gap) return;
    Sfx._last[name] = now;
    try { fx(Sfx.ctx, Sfx.ctx.currentTime, Sfx.out); } catch (e) { /* never let sound break the game */ }
  },

  // ── Building blocks ─────────────────────────────────────────────────────
  // A tone that glides from f0 to f1 with a quick attack and decay
  tone(ctx, t, out, { type = 'sine', f0, f1 = f0, dur = 0.15, vol = 0.3, attack = 0.005 }) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + dur + 0.02);
  },

  // Filtered noise burst (splashes, explosions, shots)
  noise(ctx, t, out, { type = 'lowpass', f0 = 1200, f1 = f0, q = 1, dur = 0.2, vol = 0.3, attack = 0.004 }) {
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = Sfx.noiseBuf;
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(out);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  },

  // ── The effects ────────────────────────────────────────────────────────
  FX: {
    tap:    (c, t, o) => Sfx.tone(c, t, o, { type: 'triangle', f0: 900, f1: 700, dur: 0.06, vol: 0.12 }),
    tick:   (c, t, o) => Sfx.tone(c, t, o, { type: 'triangle', f0: 1400, dur: 0.03, vol: 0.06 }),
    place:  (c, t, o) => { Sfx.tone(c, t, o, { f0: 220, f1: 90, dur: 0.16, vol: 0.4 }); Sfx.noise(c, t, o, { f0: 900, f1: 200, dur: 0.12, vol: 0.15 }); },
    shot:   (c, t, o) => Sfx.noise(c, t, o, { type: 'highpass', f0: 2600, dur: 0.05, vol: 0.09 }),
    shot2:  (c, t, o) => { Sfx.noise(c, t, o, { type: 'bandpass', f0: 1800, q: 2, dur: 0.07, vol: 0.14 }); Sfx.tone(c, t, o, { type: 'square', f0: 300, f1: 120, dur: 0.05, vol: 0.04 }); },
    bomb:   (c, t, o) => Sfx.tone(c, t, o, { f0: 140, f1: 60, dur: 0.18, vol: 0.3 }),
    boom:   (c, t, o) => { Sfx.noise(c, t, o, { f0: 1400, f1: 120, dur: 0.45, vol: 0.32 }); Sfx.tone(c, t, o, { f0: 90, f1: 40, dur: 0.35, vol: 0.3 }); },
    hit:    (c, t, o) => Sfx.tone(c, t, o, { type: 'square', f0: 1800, f1: 1200, dur: 0.035, vol: 0.03 }),
    clank:  (c, t, o) => Sfx.tone(c, t, o, { type: 'triangle', f0: 2400, f1: 1900, dur: 0.08, vol: 0.06 }),
    zap:    (c, t, o) => Sfx.tone(c, t, o, { type: 'sawtooth', f0: 300, f1: 900, dur: 0.12, vol: 0.05 }),
    shield: (c, t, o) => { Sfx.tone(c, t, o, { type: 'triangle', f0: 2200, f1: 500, dur: 0.25, vol: 0.12 }); Sfx.noise(c, t, o, { type: 'highpass', f0: 4000, dur: 0.2, vol: 0.08 }); },
    sink:   (c, t, o) => Sfx.noise(c, t, o, { type: 'bandpass', f0: 1600, f1: 300, q: 1.5, dur: 0.4, vol: 0.22 }),
    bigsink:(c, t, o) => { Sfx.noise(c, t, o, { f0: 900, f1: 80, dur: 1.2, vol: 0.4 }); Sfx.tone(c, t, o, { f0: 70, f1: 35, dur: 1.0, vol: 0.35 }); },
    leak:   (c, t, o) => { Sfx.tone(c, t, o, { type: 'sawtooth', f0: 160, f1: 110, dur: 0.35, vol: 0.12 }); Sfx.noise(c, t, o, { f0: 400, dur: 0.3, vol: 0.12 }); },
    coin:   (c, t, o) => { Sfx.tone(c, t, o, { type: 'triangle', f0: 988, dur: 0.06, vol: 0.12 }); Sfx.tone(c, t + 0.06, o, { type: 'triangle', f0: 1319, dur: 0.12, vol: 0.12 }); },
    horn:   (c, t, o) => { [110, 165].forEach(f => Sfx.tone(c, t, o, { type: 'sawtooth', f0: f, f1: f * 0.97, dur: 0.9, vol: 0.07, attack: 0.08 })); },
    flare:  (c, t, o) => { Sfx.tone(c, t, o, { f0: 1600, f1: 400, dur: 0.5, vol: 0.12 }); Sfx.FX.boom(c, t + 0.5, o); },
    net:    (c, t, o) => Sfx.noise(c, t, o, { type: 'bandpass', f0: 600, f1: 2000, q: 1.2, dur: 0.35, vol: 0.5 }),
    upgrade:(c, t, o) => [523, 659, 784].forEach((f, i) => Sfx.tone(c, t + i * 0.07, o, { type: 'triangle', f0: f, dur: 0.14, vol: 0.12 })),
    build:  (c, t, o) => { Sfx.tone(c, t, o, { type: 'triangle', f0: 1047, dur: 0.1, vol: 0.1 }); Sfx.tone(c, t + 0.08, o, { type: 'triangle', f0: 1568, dur: 0.18, vol: 0.1 }); },
    win:    (c, t, o) => [523, 659, 784, 1047].forEach((f, i) => Sfx.tone(c, t + i * 0.12, o, { type: 'triangle', f0: f, dur: i === 3 ? 0.6 : 0.18, vol: 0.16 })),
    lose:   (c, t, o) => [392, 330, 262, 196].forEach((f, i) => Sfx.tone(c, t + i * 0.16, o, { type: 'sawtooth', f0: f, f1: f * 0.98, dur: i === 3 ? 0.7 : 0.2, vol: 0.07 })),
    unlock: (c, t, o) => [659, 784, 988, 1319].forEach((f, i) => Sfx.tone(c, t + i * 0.06, o, { type: 'triangle', f0: f, dur: 0.2, vol: 0.1 }))
  }
};

Sfx.init();
