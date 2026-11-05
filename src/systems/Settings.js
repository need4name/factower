// ── Settings.js ───────────────────────────────────────────────────────────────
// Device-level preferences (not part of a save slot): sound effects, music,
// vibration and reduced effects. Kept in localStorage on this device.
//
//   Settings.get('music')          → true / false
//   Settings.set('music', false)   saves and applies it
//   Settings.buzz(30)              vibrate (if supported and switched on)

const Settings = {
  KEY: 'factower_settings',
  DEFAULTS: { sound: true, music: true, vibration: true, reducedFx: false },
  LABELS: {
    sound:     ['Sound effects', 'Shots, splashes and clicks'],
    music:     ['Music', 'The sea and battle themes'],
    vibration: ['Vibration', 'Buzz on hits and big moments (Android)'],
    reducedFx: ['Reduced effects', 'Less fog, light and gulls (smoother)']
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
  },

  buzz(pattern) {
    if (!Settings.get('vibration') || !navigator.vibrate) return;
    try { navigator.vibrate(pattern); } catch (e) { /* not allowed */ }
  }
};
