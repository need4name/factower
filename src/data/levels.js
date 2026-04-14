const LEVEL_DATA = {
  storylines: [
    {
      id:          1,
      name:        'SALT & PLASTIC',
      description: 'Establish your base. Survive the first raids.',
      faction:     'Non-Continuous Front',
      levels: [

        {
          id:           1,
          name:         'THE FIRST PRESS-GANG',
          description:  'Rivals target your turbine. Repel them.',
          difficulty:   1,
          towerSlots:   6,
          baseHp:       10,
          tutorialText: 'Tap GUNNER below then tap anywhere off the path to place it.\nTowers placed at bends cover more path — aim for corners.',
          waves: [
            {
              preWaveDelay: 3000,
              enemies: [
                { type: 'saltChild', count: 5, interval: 2200 }
              ]
            }
          ]
        },

        {
          id:           2,
          name:         'HEAVY ORDNANCE',
          description:  'Shielded units. Your scrap-throwers won\'t dent them.',
          difficulty:   2,
          towerSlots:   6,
          baseHp:       10,
          tutorialText: 'Your second worker is now active in the Factory.\nMore workers means more towers — head back to build more Gunners before harder missions.',
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

        {
          id:           3,
          name:         'SCRAP RECOVERY',
          description:  'Mid-wave, the turbine kicks up debris. Parts incoming.',
          difficulty:   3,
          towerSlots:   6,
          baseHp:       10,
          tutorialText: 'Bomber and Barricade assembly is now unlocked in the Factory.\nBOMBERS deal splash damage to clusters. Build some before the next mission.',
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

        {
          id:           4,
          name:         'THE COUNTER-RAID',
          description:  'They retaliate. Heavier numbers, coordinated push.',
          difficulty:   3,
          towerSlots:   7,
          baseHp:       10,
          tutorialText: 'BARRICADES slow all nearby enemies — place them at bends.\nA slowed cluster gives your Bombers and Gunners far more time on target.',
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

        {
          id:           5,
          name:         'THE DRIFTWOOD HULK',
          description:  'A massive bio-mass floats in. High HP. Ignores light towers.',
          difficulty:   4,
          towerSlots:   7,
          baseHp:       10,
          tutorialText: 'DRIFTWOOD HULKS have extreme HP — Bombers barely scratch them.\nBARRICADES slow them while your GUNNERS focus fire.',
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

        {
          id:           6,
          name:         'THE KING\'S VISION',
          description:  'Your factory output reaches critical mass. The island grows.',
          difficulty:   4,
          towerSlots:   7,
          baseHp:       10,
          tutorialText: 'Mixed loadouts outperform spamming one type.\nGUNNERS handle singles. BOMBERS clear clusters. BARRICADES buy time for both.',
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

        {
          id:           7,
          name:         'THE PRODUCTION LINE',
          description:  'A rival scout captured. The largest assault yet.',
          difficulty:   5,
          towerSlots:   8,
          baseHp:       10,
          tutorialText: 'Your factory throughput is your real ceiling.\nIf you\'re running short on towers, go back and optimise your production line.',
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

        {
          id:           8,
          name:         'THE FRONT COMMANDER',
          description:  'The leader of the local rival faction arrives to shut you down.',
          difficulty:   5,
          towerSlots:   8,
          baseHp:       10,
          tutorialText: 'BOSS FIGHT. Every unit type arrives at once.\nUse everything you have — this ends the first campaign.',
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
  ]
};
