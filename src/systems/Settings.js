// ── Settings.js ───────────────────────────────────────────────────────────────
// Device-level preferences (not part of a save slot): sound effects, music,
// vibration and reduced effects. Kept in localStorage on this device.
//
//   Settings.get('music')          → true / false
//   Settings.set('music', false)   saves and applies it
//   Settings.buzz(30)              vibrate (if supported and switched on)

const Settings = {
  KEY: 'factower_settings',
  DEFAULTS: { sound: true, music: true, vibration: true, reducedFx: false, fps: false },
  LABELS: {
    sound:     ['Sound effects', 'Shots, splashes and clicks'],
    music:     ['Music', 'The sea and battle themes'],
    vibration: ['Vibration', 'Buzz on hits and big moments (Android)'],
    reducedFx: ['Reduced effects', 'Less fog, light and gulls (smoother)'],
    fps:       ['Frame rate', 'Show frames per second in the corner']
  },
  _v: null,

  all() {
    if (!Settings._v) {
      let saved = {};
      try { saved = JSON.parse(localStorage.getItem(Settings.KEY) || '{}') || {}; } catch (e) { /* storage blocked */ }
      // The old single mute switch silenced everything
      try { if (localStorage.getItem('factower_muted') === '1' && saved.sound === undefined) saved = { sound: false, music: false }; } catch (e) { /* storage blocked */ }
      Settings._v = Object.assign({}, Settings.DEFAULTS, saved);
    }
    return Settings._v;
  },

  get(k) { return Settings.all()[k]; },

  set(k, v) {
    Settings.all()[k] = v;
    try { localStorage.setItem(Settings.KEY, JSON.stringify(Settings._v)); } catch (e) { /* storage blocked */ }
    if ((k === 'sound' || k === 'music') && typeof Sfx !== 'undefined') Sfx.applyVolumes();
    if (k === 'fps') Settings.fpsMeter(v);
  },

  // A small frames-per-second readout in the top-left corner, on top of
  // everything. Green at 50+, amber at 30+, red below.
  fpsMeter(on) {
    if (!on) { if (Settings._fps) { cancelAnimationFrame(Settings._fps.raf); Settings._fps.el.remove(); Settings._fps = null; } return; }
    if (Settings._fps || typeof document === 'undefined') return;
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;left:4px;top:4px;z-index:9999;padding:2px 6px;border-radius:6px;font:600 11px monospace;'
      + 'background:rgba(0,0,0,0.6);color:#52c47f;pointer-events:none';
    document.body.appendChild(el);
    const st = Settings._fps = { el, frames: 0, last: performance.now(), raf: 0 };
    const tick = (now) => {
      st.frames++;
      if (now - st.last >= 500) {
        const fps = Math.round(st.frames * 1000 / (now - st.last));
        el.textContent = fps + ' FPS';
        el.style.color = fps >= 50 ? '#52c47f' : fps >= 30 ? '#f2a93b' : '#e5534b';
        st.frames = 0; st.last = now;
      }
      st.raf = requestAnimationFrame(tick);
    };
    st.raf = requestAnimationFrame(tick);
  },

  buzz(pattern) {
    if (!Settings.get('vibration') || !navigator.vibrate) return;
    try { navigator.vibrate(pattern); } catch (e) { /* not allowed */ }
  }
};

if (typeof window !== 'undefined') window.addEventListener('load', () => { if (Settings.get('fps')) Settings.fpsMeter(true); });
