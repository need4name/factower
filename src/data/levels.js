const LEVEL_DATA = {
storylines: [
{
id:          1,
name:        ‘SALT & PLASTIC’,
description: ‘Establish your base. Survive the first raids.’,
faction:     ‘Non-Continuous Front’,
levels: [

```
    // ─── L1 ───────────────────────────────────────────────────────────────
    {
      id:           1,
      name:         'THE FIRST PRESS-GANG',
      description:  'Rivals target your turbine. Repel them.',
      difficulty:   1,
      towerSlots:   5,
      baseHp:       10,
      tutorialText: 'Select a GUNNER from the panel below, then tap a numbered slot to place it.\nGunners fire fast at single targets — your core early-game tower.',
      waves: [
        {
          preWaveDelay: 3000,
          enemies: [
            { type: 'saltChild', count: 5, interval: 2200 }
          ]
        }
      ]
    },

    // ─── L2 ───────────────────────────────────────────────────────────────
    {
      id:           2,
      name:         'HEAVY ORDNANCE',
      description:  'Shielded units. Your scrap-throwers won\'t dent them.',
      difficulty:   2,
      towerSlots:   6,
      baseHp:       10,
      tutorialText: 'BOMBERS deal splash damage — perfect against clusters.\nYou\'ve unlocked them in the Factory. Build some before this mission.',
      waves: [
        {
          preWaveDelay: 3000,
          enemies: [
            { type: 'saltChild', count: 8, interval: 1800 }
          ]
        },
        {
          preWaveDelay: 5000,
          enemies: [
            { type: 'saltChild',   count: 6, interval: 1600 },
            { type: 'scrapRunner', count: 4, interval: 2200 }
          ]
        }
      ]
    },

    // ─── L3 ───────────────────────────────────────────────────────────────
    {
      id:           3,
      name:         'SCRAP RECOVERY',
      description:  'Mid-wave, the turbine kicks up debris. Parts incoming.',
      difficulty:   3,
      towerSlots:   6,
      baseHp:       10,
      tutorialText: 'PARTS are earned from every kill — shown top-left.\nThey\'ll power upgrades in future levels. Kill everything you can.',
      waves: [
        {
          preWaveDelay: 3000,
          enemies: [
            { type: 'saltChild', count: 10, interval: 1400 }
          ]
        },
        {
          preWaveDelay: 5000,
          enemies: [
            { type: 'scrapRunner', count: 6, interval: 1600 },
            { type: 'saltChild',   count: 8, interval: 1400 }
          ]
        },
        {
          preWaveDelay: 6000,
          enemies: [
            { type: 'saltChild',   count: 12, interval: 1100 },
            { type: 'scrapRunner', count: 6,  interval: 1800 }
          ]
        }
      ]
    },

    // ─── L4 ── placeholder until offensive missions are built ─────────────
    {
      id:           4,
      name:         'THE COUNTER-RAID',
      description:  'They retaliate. Heavier numbers, coordinated push.',
      difficulty:   3,
      towerSlots:   7,
      baseHp:       10,
      missionType:  'defence_placeholder',
      tutorialText: 'BARRICADES slow nearby enemies — place them in crowded sections of the path.\nA slowed cluster gives your Gunners and Bombers far more time on target.',
      waves: [
        {
          preWaveDelay: 3000,
          enemies: [
            { type: 'saltChild',   count: 12, interval: 1200 },
            { type: 'scrapRunner', count: 4,  interval: 2000 }
          ]
        },
        {
          preWaveDelay: 6000,
          enemies: [
            { type: 'scrapRunner', count: 8,  interval: 1400 },
            { type: 'saltChild',   count: 10, interval: 1200 }
          ]
        },
        {
          preWaveDelay: 6000,
          enemies: [
            { type: 'saltChild',   count: 16, interval: 1000 },
            { type: 'scrapRunner', count: 8,  interval: 1400 }
          ]
        }
      ]
    },

    // ─── L5 ───────────────────────────────────────────────────────────────
    {
      id:           5,
      name:         'THE DRIFTWOOD HULK',
      description:  'A massive bio-mass floats in. High HP. Ignores light towers.',
      difficulty:   4,
      towerSlots:   7,
      baseHp:       10,
      tutorialText: 'DRIFTWOOD HULKS have extreme HP — Bombers barely scratch them.\nPlace BARRICADES to slow them while your GUNNERS focus fire.',
      waves: [
        {
          preWaveDelay: 3000,
          enemies: [
            { type: 'saltChild', count: 10, interval: 1300 }
          ]
        },
        {
          preWaveDelay: 6000,
          enemies: [
            { type: 'driftwoodHulk', count: 1, interval: 0    },
            { type: 'saltChild',     count: 8, interval: 1400 }
          ]
        },
        {
          preWaveDelay: 7000,
          enemies: [
            { type: 'driftwoodHulk', count: 2, interval: 6000 },
            { type: 'scrapRunner',   count: 6, interval: 1400 }
          ]
        }
      ]
    },

    // ─── L6 ───────────────────────────────────────────────────────────────
    {
      id:           6,
      name:         'THE KING\'S VISION',
      description:  'Your factory output reaches critical mass. The island grows.',
      difficulty:   4,
      towerSlots:   7,
      baseHp:       10,
      tutorialText: 'Tower diversity matters — a mixed loadout outperforms spamming one type.\nGUNNERS handle singles. BOMBERS clear clusters. BARRICADES buy time.',
      waves: [
        {
          preWaveDelay: 3000,
          enemies: [
            { type: 'saltChild',   count: 12, interval: 1200 },
            { type: 'scrapRunner', count: 4,  interval: 1800 }
          ]
        },
        {
          preWaveDelay: 6000,
          enemies: [
            { type: 'driftwoodHulk', count: 1,  interval: 0    },
            { type: 'scrapRunner',   count: 8,  interval: 1400 },
            { type: 'saltChild',     count: 10, interval: 1200 }
          ]
        },
        {
          preWaveDelay: 7000,
          enemies: [
            { type: 'driftwoodHulk', count: 2,  interval: 5000 },
            { type: 'saltChild',     count: 14, interval: 1000 },
            { type: 'scrapRunner',   count: 8,  interval: 1400 }
          ]
        }
      ]
    },

    // ─── L7 ───────────────────────────────────────────────────────────────
    {
      id:           7,
      name:         'THE PRODUCTION LINE',
      description:  'A rival scout captured. The largest assault yet.',
      difficulty:   5,
      towerSlots:   8,
      baseHp:       10,
      tutorialText: 'Largest wave yet — your factory throughput is your real ceiling.\nIf you\'re short on towers, go back and optimise your production line.',
      waves: [
        {
          preWaveDelay: 3000,
          enemies: [
            { type: 'saltChild',   count: 14, interval: 1000 },
            { type: 'scrapRunner', count: 6,  interval: 1600 }
          ]
        },
        {
          preWaveDelay: 6000,
          enemies: [
            { type: 'driftwoodHulk', count: 2,  interval: 5000 },
            { type: 'saltChild',     count: 12, interval: 1000 },
            { type: 'scrapRunner',   count: 8,  interval: 1400 }
          ]
        },
        {
          preWaveDelay: 8000,
          enemies: [
            { type: 'driftwoodHulk', count: 3,  interval: 4000 },
            { type: 'saltChild',     count: 16, interval: 900  },
            { type: 'scrapRunner',   count: 10, interval: 1200 }
          ]
        }
      ]
    },

    // ─── L8 ── BOSS ───────────────────────────────────────────────────────
    {
      id:           8,
      name:         'THE FRONT COMMANDER',
      description:  'The leader of the local rival faction arrives to shut you down.',
      difficulty:   5,
      towerSlots:   8,
      baseHp:       10,
      tutorialText: 'BOSS FIGHT. The Front Commander leads the full assault.\nEvery unit type arrives. Use everything you have.',
      waves: [
        {
          preWaveDelay: 3000,
          enemies: [
            { type: 'saltChild',   count: 14, interval: 1000 },
            { type: 'scrapRunner', count: 8,  interval: 1400 }
          ]
        },
        {
          preWaveDelay: 6000,
          enemies: [
            { type: 'driftwoodHulk', count: 2,  interval: 5000 },
            { type: 'saltChild',     count: 12, interval: 1000 }
          ]
        },
        {
          preWaveDelay: 8000,
          enemies: [
            { type: 'frontCommander', count: 1,  interval: 0     },
            { type: 'saltChild',      count: 16, interval: 800   },
            { type: 'scrapRunner',    count: 10, interval: 1200  },
            { type: 'driftwoodHulk',  count: 1,  interval: 10000 }
          ]
        }
      ]
    }

  ]
}
```

]
};