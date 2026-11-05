// ── endless.js ────────────────────────────────────────────────────────────────
// Endless Raids: waves built from every raider the player has met, getting
// tougher each wave. Every 5th wave has a twist, every 10th brings a boss.
// A run always pays out, more the further it gets; the best wave is saved.
//
//   Endless.build(save)          → { waves, twists }   (60 waves)
//   Endless.reward(wavesCleared) → { bolts, plasticScrap, salvagedMetal }
//   Endless.best(save)           → best wave reached so far

const Endless = {
  WAVES: 60,

  // Roles decide where in a wave a raider can appear
  ROLES: {
    fodder: ['saltChild', 'bilgeRat', 'scrapRunner', 'salvSkiff', 'helixDrone'],
    mid:    ['driftwoodHulk', 'salvCutter', 'helixTrooper', 'ioaCutter', 'frontDiver', 'salvFlotilla', 'helixGhost'],
    heavy:  ['salvRam', 'helixWarden', 'ioaGunboat'],
    boss:   ['frontCommander', 'umbajiFlagship', 'helixSpearhead', 'helixLancer', 'ortegaFlagship', 'helixMothership']
  },

  TWISTS: {
    swarm:  { name: 'SWARM',        line: 'A swarm — fast boats, lots of them' },
    armada: { name: 'ARMADA',       line: 'An armada — heavy armour only' },
    fog:    { name: 'FOG',          line: 'Fog rolls in — ghosts on the water' },
    shield: { name: 'SHIELD WALL',  line: 'A shield wall — Helix craft in close order' }
  },

  // Raiders the player has met (always at least the Salt Children)
  known(save) {
    const seen = (save && save.seenEnemies) || {};
    const ok = t => ENEMY_DATA[t] && (t === 'saltChild' || seen[t]);
    const r = {};
    Object.entries(Endless.ROLES).forEach(([k, list]) => { r[k] = list.filter(ok); });
    return r;
  },

  pick(list, n) {
    const copy = list.slice(), out = [];
    while (copy.length && out.length < n) out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
    return out;
  },

  build(save) {
    const K = Endless.known(save);
    const waves = [], twists = {};
    const g = (type, count, interval, hp) => ({ type, count: Math.max(1, Math.round(count)), interval: Math.round(interval), hp });
    for (let w = 0; w < Endless.WAVES; w++) {
      // Toughness climbs ~7% a wave, faster after wave 20
      const hp = 1 + w * 0.07 + Math.max(0, w - 20) * 0.05;
      const gap = Math.max(260, 900 - w * 18);
      const e = [];
      const boss = w % 10 === 9 && K.boss.length;
      const twistKeys = Object.keys(Endless.TWISTS).filter(t =>
        t === 'swarm' || (t === 'armada' && K.heavy.length) || (t === 'fog' && K.mid.includes('helixGhost')) ||
        (t === 'shield' && (K.fodder.includes('helixDrone') || K.mid.includes('helixTrooper'))));
      const twist = !boss && w % 5 === 4 ? twistKeys[Math.floor(Math.random() * twistKeys.length)] : null;
      if (twist) twists[w] = twist;

      if (twist === 'swarm') {
        const fast = K.fodder.filter(t => (ENEMY_DATA[t].traits || []).includes('fast') || t === 'bilgeRat');
        Endless.pick(fast.length ? fast : K.fodder, 2).forEach(t => e.push(g(t, 14 + w * 1.2, gap * 0.45, hp)));
      } else if (twist === 'armada') {
        Endless.pick(K.heavy, 2).forEach(t => e.push(g(t, 2 + w / 6, Math.max(1400, 3200 - w * 40), hp)));
        if (K.mid.includes('salvCutter')) e.push(g('salvCutter', 4 + w / 4, gap * 1.6, hp));
      } else if (twist === 'fog') {
        e.push(g('helixGhost', 6 + w / 2.5, gap * 1.2, hp));
        e.push(g(K.fodder[Math.floor(Math.random() * K.fodder.length)], 8 + w * 0.6, gap, hp));
      } else if (twist === 'shield') {
        if (K.fodder.includes('helixDrone')) e.push(g('helixDrone', 10 + w * 0.8, gap * 0.8, hp));
        if (K.mid.includes('helixTrooper')) e.push(g('helixTrooper', 4 + w / 3, gap * 1.8, hp));
        if (K.heavy.includes('helixWarden')) e.push(g('helixWarden', 1 + w / 10, 5000, hp));
      } else {
        // A normal wave: two kinds of fodder, mid boats from wave 3, heavies from wave 7
        Endless.pick(K.fodder, w < 2 ? 1 : 2).forEach(t => e.push(g(t, 8 + w * 0.9, gap, hp)));
        if (w >= 2 && K.mid.length) Endless.pick(K.mid, w < 12 ? 1 : 2).forEach(t => e.push(g(t, 2 + w / 3.5, gap * 2.2, hp)));
        if (w >= 6 && K.heavy.length) e.push(g(K.heavy[Math.floor(Math.random() * K.heavy.length)], 1 + w / 9, Math.max(2200, 5200 - w * 60), hp));
        if (boss) {
          // Bosses in the order the story met them, then at random
          const b = K.boss[Math.min(Math.floor(w / 10), K.boss.length - 1)] || K.boss[Math.floor(Math.random() * K.boss.length)];
          e.unshift(g(b, 1, 0, 1 + w * 0.04));
        }
      }
      if (!e.length) e.push(g('saltChild', 10 + w, gap, hp));
      waves.push({ preWaveDelay: 2000, enemies: e });
    }
    return { waves, twists };
  },

  reward(cleared) {
    return {
      bolts: Math.floor(cleared / 5),
      plasticScrap: Math.floor(cleared / 3),
      salvagedMetal: Math.floor(cleared / 4)
    };
  },

  best(save) { return (save && save.endlessBest) || 0; }
};
