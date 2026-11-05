// ── progression.js ────────────────────────────────────────────────────────────
// What unlocks when, tied to story beats. Levels are named by key:
//   p1..p7   Prologue          (storyline 1)
//   s1-1..   Story 1 · SALV    (storyline 2)
//   s2-1..   Story 2 · Borga   (storyline 3)
//   s3-1..   Story 3 · Helix   (storyline 4)
//   s4-1..   Story 4 · Ortega  (storyline 5)  — branches on save.choices.ortega
//   s5-1..   Story 5 · Turbine (storyline 6)
// A feature unlocks once its level has been cleared. `label` is what the
// victory screen announces.
const STORYLINE_PREFIX = { 1: 'p', 2: 's1-', 3: 's2-', 4: 's3-', 5: 's4-', 6: 's5-' };

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
  harpoon:    { at: 's3-2', label: 'The Harpoon — a whaling gun from the Front\u2019s stores. Long reach, armour-piercing, reels raiders in.' },
  cannon:     { at: 's4-2', label: 'The Water Cannon — Helix tech from the relay. Shoves raiders back up the road and washes shields away.' },
  siphon:     { at: 's1-6', label: 'The Siphon — Borga\u2019s beam tower. Raiders it drains drop double salvage, straight into your Parts.' },
  borga:      { at: 's3-1', label: 'Borga fights with you — place her in battle from the round BORGA button. She levels up as raiders sink around her.' },
  worker3:    { at: 's2-2', label: 'Borga joins the factory as your third worker.' },
  belts:      { at: 's1-3', label: 'Conveyor belts — SALV tech that moves items without workers.' }
};

// Storylines open once any of these levels is cleared
const STORYLINE_GATES = { 1: [], 2: ['p7'], 3: ['s1-3'], 4: ['s1-6'], 5: ['s3-4'], 6: ['s4-6'] };

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
    return s.short + ' · ' + UI.titleCase(l.name);
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

// ── Stars and hard mode ──────────────────────────────────────────────────────
// Every mission has three stars (see CombatScene / RaidScene for what earns
// them), stored as save.stars[key] = 0..3. Hard mode opens once a mission is
// cleared; save.hardCleared[key] marks a hard win.
const Stars = {
  get(save, key) { return (save && save.stars && save.stars[key]) || 0; },
  hard(save, key) { return !!(save && save.hardCleared && save.hardCleared[key]); },
  // { got, max } across a storyline's built levels
  total(save, storylineId) {
    const st = Progress.storyline(storylineId);
    const levels = st ? st.levels.filter(l => !l.soon) : [];
    return { got: levels.reduce((n, l) => n + Stars.get(save, Progress.key(storylineId, l.id)), 0), max: levels.length * 3 };
  },
  // Record a result. Returns { newStars, hardFirst } — what earns a reward
  record(save, key, count, hard) {
    if (!save.stars) save.stars = {};
    const prev = save.stars[key] || 0, newStars = Math.max(0, count - prev);
    if (count > prev) save.stars[key] = count;
    let hardFirst = false;
    if (hard) { if (!save.hardCleared) save.hardCleared = {}; hardFirst = !save.hardCleared[key]; save.hardCleared[key] = true; }
    return { newStars, hardFirst };
  },
  // Hard mode for defences: tougher, faster raiders and a weaker base
  HARD: { hp: 1.5, speed: 1.1, baseHp: 0.7, turrets: 1.3, bolts: 3, materials: 1.5 },
  // Raider toughness on hard, by storyline: later stories expect an upgraded
  // Uplink, so hard mode leans harder on them (sim-tuned)
  HARD_HP: { 1: 1.5, 2: 1.85, 3: 1.85, 4: 1.85, 5: 1.8, 6: 1.8 },
  hardHp(storylineId) { return Stars.HARD_HP[storylineId] || Stars.HARD.hp; }
};

// ── Story choices ────────────────────────────────────────────────────────────
// A story beat can ask the player to choose (see Story.js). The answer is
// kept in save.choices; levels can carry `variants: { <answer>: {...} }`
// that replace their waves, name and description for that answer.
const Choices = {
  get(save, key) { return (save && save.choices && save.choices[key]) || null; },
  set(key, value) { SaveManager.update(s => { if (!s.choices) s.choices = {}; s.choices[key] = value; }); },
  // The level as this save plays it
  apply(level, save) {
    if (!level || !level.variants) return level;
    const pick = Object.keys(level.variants).find(k => Object.values(save && save.choices || {}).includes(k));
    return pick ? Object.assign({}, level, level.variants[pick]) : level;
  },
  // Ortega deal perks: siding with the IOA brings an escort (a tougher base in
  // Stories 4–5); staying free, the rogue agent shows how to break Helix shields
  ortega(save) { return Choices.get(save, 'ortega'); }
};
