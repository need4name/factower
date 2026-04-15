const TOWER_DATA = {
  gunner: {
    key: 'gunner', name: 'GUNNER', colour: 0x3a8fc4,
    tier: 1, damage: 15, range: 110, fireRate: 900, speed: 70,
    upgrades: {
      pathA: {
        name: 'OVERCLOCK',
        tiers: [
          { cost: 8,  label: 'Fire rate 900 -> 580',         fireRate: 580 },
          { cost: 16, label: 'Fire rate -> 360  +5 damage',  fireRate: 360, damageBonus: 5 },
          { cost: 28, label: 'Range +30',                    rangeBonus: 30 }
        ]
      }
    }
  },
  bomber: {
    key: 'bomber', name: 'BOMBER', colour: 0xe8a020,
    tier: 1, damage: 20, range: 90, fireRate: 1600, splashRadius: 80, speed: 50,
    upgrades: {
      pathA: {
        name: 'CLUSTER',
        tiers: [
          { cost: 8,  label: 'Splash radius 80 -> 110',      splashRadius: 110 },
          { cost: 16, label: 'Splash -> 145  +5 damage',     splashRadius: 145, damageBonus: 5 },
          { cost: 28, label: '+6 damage',                    damageBonus: 6 }
        ]
      }
    }
  },
  barricade: {
    key: 'barricade', name: 'BARRICADE', colour: 0xc43a3a,
    tier: 1, damage: 0, range: 80, slowAmount: 0.45, fireRate: 99999, speed: 25,
    upgrades: {
      pathA: {
        name: 'DEEP FIELD',
        tiers: [
          { cost: 6,  label: 'Slow 45% -> 30% speed',       slowAmount: 0.30 },
          { cost: 12, label: 'Range 80 -> 115',              rangeBonus: 35 },
          { cost: 20, label: '3 damage/sec to nearby enemies', burnDps: 3 }
        ]
      }
    }
  }
};
