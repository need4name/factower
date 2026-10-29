// ── progression.js ────────────────────────────────────────────────────────────
// What unlocks when, tied to story beats. Levels are named by key:
//   p1..p7   Prologue          (storyline 1)
//   s1-1..   Story 1 · SALV    (storyline 2)
//   s2-1..   Story 2 · Borga   (storyline 3)
//   s3-1..   Story 3 · Helix   (storyline 4)
// A feature unlocks once its level has been cleared. `label` is what the
// victory screen announces.
const STORYLINE_PREFIX = { 1: 'p', 2: 's1-', 3: 's2-', 4: 's3-' };

const UNLOCKS = {
  worker2:    { at: 'p1',   label: 'Uncle Bet joins the factory as your second worker.' },
  barricade:  { at: 'p2',   label: 'Barricade bench — bent hull metal that slows raiders.' },
  metal:      { at: 'p2',   label: 'Salvaged Metal store opens in the Factory.' },
  abilities:  { at: 'p2',   label: 'Flares and cargo nets — tap them in battle, then tap the road.' },
  mods:       { at: 'p3',   label: 'Salvage & scavenger mods — collect wreckage mid-battle and bolt it onto towers.' },
  bomber:     { at: 'p4',   label: 'Bomber bench — plans plundered from the Front’s camp.' },
  smelter:    { at: 'p4',   label: 'Smelter — turns scrap into the refined plastic Bombers need.' },
  market:     { at: 'p5',   label: 'The Market — Chrome has set up shop on your raft.' },
  uplink:     { at: 'p7',   label: 'The Uplink — trade bolts for permanent upgrades.' },
  gunner2:    { at: 's1-3', label: 'Gunner Mk II — SALV tech. Build it from metal at a new bench.' },
  siphon:     { at: 's1-6', label: 'The Siphon — Borga\u2019s beam tower. Raiders it drains drop double salvage, straight into your Parts.' },
  worker3:    { at: 's2-2', label: 'Borga joins the factory as your third worker.' },
  belts:      { at: 's1-3', label: 'Conveyor belts — SALV tech that moves items without workers.' }
};

// Storylines open once any of these levels is cleared
const STORYLINE_GATES = { 1: [], 2: ['p7'], 3: ['s1-3'], 4: ['s1-6'] };

const Progress = {
  key(storylineId, levelId) { return (STORYLINE_PREFIX[storylineId] || 'x') + levelId; },

  parse(key) {
    for (const [sid, pre] of Object.entries(STORYLINE_PREFIX)) {
      if (key.startsWith(pre) && /^\d+$/.test(key.slice(pre.length))) return { storylineId: +sid, levelId: +key.slice(pre.length) };
    }
    return null;
  },

  done(save, key) {
    const k = Progress.parse(key);
    if (!k) return false;
    const list = (save && save.completedLevels && save.completedLevels['storyline' + k.storylineId]) || [];
    return list.includes(k.levelId);
  },

  // Is a feature unlocked? (BUILD.unlockAll opens everything for testing)
  has(save, feature) {
    if (typeof BUILD !== 'undefined' && isTestSave(save) && BUILD.unlockAll) return true;
    const u = UNLOCKS[feature];
    return !!u && Progress.done(save, u.at);
  },

  unlocksAt(key) { return Object.entries(UNLOCKS).filter(([, u]) => u.at === key).map(([f, u]) => Object.assign({ feature: f }, u)); },

  storyline(id) { return LEVEL_DATA.storylines.find(s => s.id === id); },

  level(key) {
    const k = Progress.parse(key);
    const s = k && Progress.storyline(k.storylineId);
    return s ? s.levels.find(l => l.id === k.levelId) : null;
  },

  levelName(key) {
    const k = Progress.parse(key), l = Progress.level(key), s = k && Progress.storyline(k.storylineId);
    if (!l || !s) return key;
    return s.short + ' · ' + l.name.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  },

  storylineOpen(save, id) {
    if (typeof BUILD !== 'undefined' && isTestSave(save) && BUILD.allLevels) return true;
    const g = STORYLINE_GATES[id] || [];
    return g.length === 0 || g.some(k => Progress.done(save, k));
  },

  // Why a level can't be played yet ('' = it can). Levels unlock in order
  // inside a storyline, plus any cross-story `requires`.
  levelLock(save, storylineId, level) {
    const s = Progress.storyline(storylineId);
    if (level.soon) return 'Coming soon';
    if (typeof BUILD !== 'undefined' && isTestSave(save) && BUILD.allLevels) return '';
    if (!Progress.storylineOpen(save, storylineId)) return 'Story locked';
    const i = s.levels.indexOf(level);
    if (i > 0 && !Progress.done(save, Progress.key(storylineId, s.levels[i - 1].id))) return 'Clear the previous level';
    const missing = (level.requires || []).filter(k => !Progress.done(save, k));
    if (missing.length) return 'Needs ' + missing.map(Progress.levelName).join(', ');
    return '';
  }
};
