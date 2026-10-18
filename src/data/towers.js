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
  }
};
