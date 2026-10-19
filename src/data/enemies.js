// ── enemies.js ────────────────────────────────────────────────────────────────
// Raiders. Each has a trait that asks for a different answer:
//   fast      — outruns slow towers; Barricades slow them
//   armoured  — `armour` is knocked off every hit (min 1), so small rounds
//               barely scratch them; big hits and armour-piercing mods work
//   healer    — patches up nearby raiders every few seconds; focus it down
//   swarm     — tiny and many; splash damage shines
// `card` is shown the first time a raider appears (see CombatScene).
// `rareDrop` is the rare salvage an elite leaves behind (for tier-3 mods).
const ENEMY_DATA = {
  saltChild: {
    key: 'saltChild', name: 'SALT CHILD',
    hp: 50, speed: 120, partsReward: 2, baseDamage: 2,
    colour: 0xc8d0dc, size: 10, traits: [],
    card: { title: 'Salt Child', trait: 'RAIDER', body: 'Desperate kids from the Front, wading in with whatever they can carry. Any tower handles them.' }
  },
  scrapRunner: {
    key: 'scrapRunner', name: 'SCRAP RUNNER',
    hp: 35, speed: 195, partsReward: 3, baseDamage: 1,
    colour: 0xe8a020, size: 9, traits: ['fast'],
    card: { title: 'Scrap Runner', trait: 'FAST', body: 'Light and quick — they sprint past towers before they can fire twice. A Barricade’s field slows them right down.' }
  },
  bilgeRat: {
    key: 'bilgeRat', name: 'BILGE RATS',
    hp: 18, speed: 150, partsReward: 1, baseDamage: 1,
    colour: 0x9aa48a, size: 7, traits: ['swarm'],
    card: { title: 'Bilge Rats', trait: 'SWARM', body: 'Swarms of tiny raiders pouring in together. Single shots can’t keep up — a Bomber’s blast clears the pack.' }
  },
  driftwoodHulk: {
    key: 'driftwoodHulk', name: 'DRIFTWOOD HULK',
    hp: 380, speed: 40, partsReward: 15, baseDamage: 4, armour: 6,
    colour: 0x6a7585, size: 18, traits: ['armoured'], rareDrop: 'plate',
    card: { title: 'Driftwood Hulk', trait: 'ARMOURED', body: 'Bolted-on planks knock 6 off every hit. Gunner rounds barely dent it — Bombers and armour-piercing mods do. Wrecks leave a Hull Plate.' }
  },
  // ── SALV Collective ───────────────────────────────────────────────────
  salvSkiff: {
    key: 'salvSkiff', name: 'SALV SKIFF',
    hp: 60, speed: 170, partsReward: 3, baseDamage: 2,
    colour: 0x3fae8e, size: 10, traits: ['fast'],
    card: { title: 'SALV Skiff', trait: 'FAST', body: 'Quick SALV boarders — tougher than Front runners. Slow them with Barricades and let the Gunners work.' }
  },
  salvCutter: {
    key: 'salvCutter', name: 'SALV CUTTER',
    hp: 170, speed: 70, partsReward: 8, baseDamage: 3, armour: 4,
    colour: 0x2f7d6a, size: 15, traits: ['armoured'], rareDrop: 'plate',
    card: { title: 'SALV Cutter', trait: 'ARMOURED', body: 'Plated SALV boats that shrug off 4 damage per hit. Bombers and armour-piercing mods break them open.' }
  },
  frontCommander: {
    key: 'frontCommander', name: 'FRONT COMMANDER',
    hp: 650, speed: 55, partsReward: 40, baseDamage: 6, armour: 3,
    isBoss: true, colour: 0xc43a3a, size: 22, traits: ['healer', 'armoured'], rareDrop: 'engine',
    heal: { amount: 14, radius: 95, every: 2200 },
    card: { title: 'Front Commander', trait: 'HEALER · BOSS', body: 'Rallies the raiders around it, patching them up every few seconds. Take it down first. Its wreck holds an Engine.' }
  }
};

// Rare salvage dropped by elites — needed for tier-3 mods
const RARE_PARTS = {
  plate:  { name: 'Hull Plate', colour: 0x8fb3c9 },
  engine: { name: 'Engine',     colour: 0xd77cf0 }
};
