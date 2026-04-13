const TOWER_DATA = {
  gunner: {
    key:      'gunner',
    name:     'GUNNER',
    colour:   0x3a8fc4,
    tier:     1,
    damage:   15,
    range:    120,
    fireRate: 900,
    speed:    70
  },
  bomber: {
    key:          'bomber',
    name:         'BOMBER',
    colour:       0xe8a020,
    tier:         1,
    damage:       20,
    range:        90,
    fireRate:     2500,
    splashRadius: 100,
    speed:        50
  },
  barricade: {
    key:        'barricade',
    name:       'BARRICADE',
    colour:     0xc43a3a,
    tier:       1,
    damage:     0,
    range:      90,           // slow-field radius
    slowAmount: 0.45,         // enemies in range move at 45% speed
    fireRate:   99999,        // never fires
    speed:      25
  }
};
