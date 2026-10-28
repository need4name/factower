// ── towers.js ─────────────────────────────────────────────────────────────────
// Towers and their scavenger mods. Each tower has three mod paths; a tower
// can take mods from any TWO of them (three tiers each). Mods cost Parts —
// salvage collected from wrecks mid-battle — and tier 3 also needs a rare
// part (`rare`) that only elite raiders drop. Mods last for one battle.
//
// Mod fields: rangeBonus, damageBonus (added) · fireRate, splashRadius,
// slowAmount, burnDps (set) · pierce (ignores that much armour) ·
// scatter (a second raider nearby takes this share) · doubleShot ·
// napalm (burn dps left in the blast) · armourBonus (extra damage to armour)
const TOWER_DATA = {
  gunner: {
    key: 'gunner', name: 'GUNNER', colour: 0x3a8fc4,
    tier: 1, damage: 15, range: 110, fireRate: 900, speed: 70,
    mods: [
      { name: 'PIPE BARREL', tiers: [
        { cost: 8,  name: 'Longer pipe',     label: 'Range +20',                          rangeBonus: 20 },
        { cost: 14, name: 'Braced mount',    label: 'Range +20, damage +3',               rangeBonus: 20, damageBonus: 3 },
        { cost: 22, name: 'Harpoon rounds',  label: 'Damage +10, ignores 6 armour',       damageBonus: 10, pierce: 6, rare: 'plate' } ] },
      { name: 'SPRING FEED', tiers: [
        { cost: 8,  name: 'Bedspring',       label: 'Fires faster (0.9s → 0.7s)',     fireRate: 700 },
        { cost: 14, name: 'Bike chain',      label: 'Fires faster (→ 0.52s)',         fireRate: 520 },
        { cost: 22, name: 'Outboard crank',  label: 'Fires much faster (→ 0.34s)',    fireRate: 340, rare: 'engine' } ] },
      { name: 'NAIL ROUNDS', tiers: [
        { cost: 8,  name: 'Nail tips',       label: 'Ignores 3 armour',                   pierce: 3 },
        { cost: 16, name: 'Shrapnel',        label: 'A nearby raider takes half damage',  scatter: 0.5 },
        { cost: 24, name: 'Double barrel',   label: 'Fires two rounds at once',           doubleShot: true, rare: 'engine' } ] }
    ]
  },
  bomber: {
    key: 'bomber', name: 'BOMBER', colour: 0xe8a020,
    tier: 1, damage: 20, range: 90, fireRate: 1600, splashRadius: 80, speed: 50,
    mods: [
      { name: 'GAS CANISTER', tiers: [
        { cost: 8,  name: 'Gas canister',    label: 'Blast radius 80 → 110',          splashRadius: 110 },
        { cost: 14, name: 'Two canisters',   label: 'Blast radius → 145',             splashRadius: 145 },
        { cost: 22, name: 'Napalm',          label: 'Blasts leave fire (4 dmg/s)',        napalm: 4, rare: 'engine' } ] },
      { name: 'HEAVY CHARGE', tiers: [
        { cost: 8,  name: 'Bigger charge',   label: 'Damage +6',                          damageBonus: 6 },
        { cost: 14, name: 'Packed tight',    label: 'Damage +6',                          damageBonus: 6 },
        { cost: 22, name: 'Depth charge',    label: '+15 damage to armoured raiders',     armourBonus: 15, rare: 'plate' } ] },
      { name: 'LONG TUBE', tiers: [
        { cost: 8,  name: 'Drainpipe tube',  label: 'Range +20',                          rangeBonus: 20 },
        { cost: 14, name: 'Quick loader',    label: 'Fires faster (1.6s → 1.25s)',    fireRate: 1250 },
        { cost: 22, name: 'Mortar rig',      label: 'Range +30, fires faster (→ 1s)', rangeBonus: 30, fireRate: 1000, rare: 'engine' } ] }
    ]
  },
  // Tier 2 — SALV tech (Story 1). Heavier rounds, longer reach.
  gunner2: {
    key: 'gunner2', name: 'GUNNER MK II', short: 'Mk II', colour: 0x2fb6d6,
    tier: 2, damage: 24, range: 125, fireRate: 720, speed: 75,
    mods: [
      { name: 'RIFLED PIPE', tiers: [
        { cost: 10, name: 'Rifling',          label: 'Range +20',                          rangeBonus: 20 },
        { cost: 16, name: 'Scope',            label: 'Range +20, damage +4',               rangeBonus: 20, damageBonus: 4 },
        { cost: 26, name: 'Hull-piercer',     label: 'Damage +12, ignores 8 armour',       damageBonus: 12, pierce: 8, rare: 'plate' } ] },
      { name: 'BELT FEED', tiers: [
        { cost: 10, name: 'Belt feed',        label: 'Fires faster (0.72s \u2192 0.55s)',  fireRate: 550 },
        { cost: 16, name: 'Twin feed',        label: 'Fires faster (\u2192 0.42s)',        fireRate: 420 },
        { cost: 26, name: 'Motor drive',      label: 'Fires much faster (\u2192 0.28s)',   fireRate: 280, rare: 'engine' } ] },
      { name: 'FLAK', tiers: [
        { cost: 10, name: 'Shrapnel',         label: 'A nearby raider takes half damage',  scatter: 0.5 },
        { cost: 18, name: 'Wide spread',      label: 'Shrapnel takes 75% damage',          scatter: 0.75 },
        { cost: 28, name: 'Double barrel',    label: 'Fires two rounds at once',           doubleShot: true, rare: 'engine' } ] }
    ]
  },
  barricade: {
    key: 'barricade', name: 'BARRICADE', colour: 0xc43a3a,
    tier: 1, damage: 0, range: 80, slowAmount: 0.45, fireRate: 99999, speed: 25,
    mods: [
      { name: 'FISHING NET', tiers: [
        { cost: 6,  name: 'Fishing net',     label: 'Raiders slowed to 35% speed',        slowAmount: 0.35 },
        { cost: 12, name: 'Double net',      label: 'Slowed to 25% speed',                slowAmount: 0.25 },
        { cost: 20, name: 'Tangle',          label: 'Slowed to a crawl (12%)',            slowAmount: 0.12, rare: 'plate' } ] },
      { name: 'WIDE NETS', tiers: [
        { cost: 6,  name: 'Wider net',       label: 'Field +20',                          rangeBonus: 20 },
        { cost: 12, name: 'Buoy line',       label: 'Field +20',                          rangeBonus: 20 },
        { cost: 20, name: 'Drift net',       label: 'Field +30',                          rangeBonus: 30, rare: 'plate' } ] },
      { name: 'SPIKE STRIP', tiers: [
        { cost: 6,  name: 'Nails',           label: '2 dmg/s to raiders in the field',    burnDps: 2 },
        { cost: 12, name: 'Barbed wire',     label: '4 dmg/s',                            burnDps: 4 },
        { cost: 20, name: 'Razor coil',      label: '8 dmg/s',                            burnDps: 8, rare: 'engine' } ] }
    ]
  },
  // Borga's secret (Story 1 finale). A beam that drains one raider; anything
  // that dies in the beam drops double salvage straight into your Parts.
  siphon: {
    key: 'siphon', name: 'SIPHON', colour: 0x9d7ff0,
    tier: 2, damage: 0, dps: 12, range: 100, fireRate: 120, beams: 1, speed: 45,
    mods: [
      { name: 'LONG HOSE', tiers: [
        { cost: 8,  name: 'Long hose',        label: 'Range +20',                          rangeBonus: 20 },
        { cost: 14, name: 'Longer hose',      label: 'Range +20',                          rangeBonus: 20 },
        { cost: 22, name: 'Fire hose',        label: 'Range +30',                          rangeBonus: 30, rare: 'plate' } ] },
      { name: 'WIDE NOZZLE', tiers: [
        { cost: 10, name: 'Splitter',         label: 'Drains 2 raiders at once',           beams: 2 },
        { cost: 16, name: 'Manifold',         label: 'Drains 3 raiders at once',           beams: 3 },
        { cost: 26, name: 'Octopus',          label: 'Drains 4 raiders at once',           beams: 4, rare: 'engine' } ] },
      { name: 'PRESSURE PUMP', tiers: [
        { cost: 8,  name: 'Hand pump',        label: 'Drain 12 \u2192 16 dmg/s',          dps: 16 },
        { cost: 14, name: 'Bilge pump',       label: 'Drain \u2192 21 dmg/s',             dps: 21 },
        { cost: 24, name: 'Engine pump',      label: 'Drain \u2192 30 dmg/s',             dps: 30, rare: 'engine' } ] }
    ]
  }
};

// Display / selection order everywhere towers are listed
const TOWER_ORDER = ['gunner', 'gunner2', 'bomber', 'barricade', 'siphon'];
