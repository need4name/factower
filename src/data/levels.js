// All path points use:
//   x: absolute canvas x
//   oy: y offset from CT (scene adds CT to get absolute y)
// UBZs: { x, oy, w, h }  — debris zones, no tower placement
// Hotspots: { x, oy, radius, mult } — power zones (mult > 1 = boost, < 1 = drain)
// mult colours: boost = amber (0xe8a020), drain = blue (0x1a4a8a)

const LEVEL_DATA = {
  storylines: [
    {
      id: 1,
      name: 'SALT & PLASTIC',
      description: 'Establish your base. Survive the first raids.',
      faction: 'Non-Continuous Front',
      levels: [

        // ── L1 ─────────────────────────────────────────────────────────────
        {
          id: 1,
          name: 'THE FIRST PRESS-GANG',
          description: 'Rivals target your turbine. Repel them.',
          difficulty: 1,
          baseHp: 15,
          tutorialText: 'Tap GUNNER below to select it.\nThen tap anywhere off the path to place it.',
          tutorialOptimalSpot: { x: 175, oy: 125 },
          path: [
            { x: 195, oy: 0   },
            { x: 195, oy: 52  },
            { x: 75,  oy: 52  },
            { x: 75,  oy: 185 },
            { x: 310, oy: 185 },
            { x: 310, oy: 308 },
            { x: 75,  oy: 308 },
            { x: 75,  oy: 375 },
            { x: 195, oy: 375 },
            { x: 195, oy: 415 }
          ],
          ubzs: [
            { x: 128, oy: 240, w: 88,  h: 50 }
          ],
          hotspots: [
            { x: 175, oy: 120, radius: 55, mult: 1.20 },
            { x: 310, oy: 245, radius: 40, mult: 0.85 }
          ],
          waves: [
            {
              preWaveDelay: 3500,
              enemies: [ { type: 'saltChild', count: 5, interval: 3200 } ]
            }
          ]
        },

        // ── L2 ─────────────────────────────────────────────────────────────
        {
          id: 2,
          name: 'HEAVY ORDNANCE',
          description: 'Shielded units. Your scrap-throwers won\'t dent them.',
          difficulty: 2,
          baseHp: 10,
          tutorialText: 'Your second worker is now active in the Factory.\nMore workers means more towers — build before harder missions.',
          path: [
            { x: 195, oy: 0   },
            { x: 195, oy: 46  },
            { x: 315, oy: 46  },
            { x: 315, oy: 152 },
            { x: 80,  oy: 152 },
            { x: 80,  oy: 260 },
            { x: 315, oy: 260 },
            { x: 315, oy: 352 },
            { x: 195, oy: 352 },
            { x: 195, oy: 415 }
          ],
          ubzs: [
            { x: 130, oy: 65,  w: 100, h: 72 },
            { x: 130, oy: 278, w: 100, h: 62 }
          ],
          hotspots: [
            { x: 195, oy: 205, radius: 65, mult: 1.25 },
            { x: 80,  oy: 46,  radius: 42, mult: 0.82 }
          ],
          waves: [
            {
              preWaveDelay: 3000,
              enemies: [ { type: 'saltChild', count: 10, interval: 1600 } ]
            },
            {
              preWaveDelay: 5500,
              enemies: [
                { type: 'saltChild',   count: 8, interval: 1400 },
                { type: 'scrapRunner', count: 3, interval: 2200 }
              ]
            }
          ]
        },

        // ── L3 ─────────────────────────────────────────────────────────────
        {
          id: 3,
          name: 'OVERNIGHT ASSAULT',
          description: 'They hit while you sleep. Three waves.',
          difficulty: 3,
          baseHp: 10,
          tutorialText: 'PARTS are earned from every kill — shown top-left.\nKill everything you can — you\'ll need them soon.',
          path: [
            { x: 195, oy: 0   },
            { x: 195, oy: 36  },
            { x: 65,  oy: 36  },
            { x: 65,  oy: 128 },
            { x: 315, oy: 128 },
            { x: 315, oy: 218 },
            { x: 65,  oy: 218 },
            { x: 65,  oy: 308 },
            { x: 315, oy: 308 },
            { x: 315, oy: 365 },
            { x: 195, oy: 365 },
            { x: 195, oy: 415 }
          ],
          ubzs: [
            { x: 140, oy: 148, w: 72, h: 60 },
            { x: 140, oy: 268, w: 72, h: 30 }
          ],
          hotspots: [
            { x: 195, oy: 128, radius: 52, mult: 1.20 },
            { x: 65,  oy: 263, radius: 48, mult: 1.15 },
            { x: 315, oy: 173, radius: 42, mult: 0.80 }
          ],
          waves: [
            {
              preWaveDelay: 3000,
              enemies: [ { type: 'saltChild', count: 12, interval: 1400 } ]
            },
            {
              preWaveDelay: 5500,
              enemies: [
                { type: 'saltChild',   count: 10, interval: 1300 },
                { type: 'scrapRunner', count: 5,  interval: 2000 }
              ]
            },
            {
              preWaveDelay: 6000,
              enemies: [
                { type: 'saltChild',   count: 14, interval: 1100 },
                { type: 'scrapRunner', count: 7,  interval: 1700 }
              ]
            }
          ]
        },

        // ── L4 ─────────────────────────────────────────────────────────────
        {
          id: 4,
          name: 'THE COUNTER-RAID',
          description: 'They retaliate. Tap any placed tower to spend PARTS on upgrades.',
          difficulty: 3,
          baseHp: 10,
          tutorialText: 'UPGRADES UNLOCKED! Tap any placed tower during combat.\nSpend PARTS to increase its power. Upgrades reset each level.',
          path: [
            { x: 195, oy: 0   },
            { x: 195, oy: 40  },
            { x: 320, oy: 40  },
            { x: 320, oy: 130 },
            { x: 65,  oy: 130 },
            { x: 65,  oy: 228 },
            { x: 255, oy: 228 },
            { x: 255, oy: 308 },
            { x: 135, oy: 308 },
            { x: 135, oy: 368 },
            { x: 195, oy: 368 },
            { x: 195, oy: 415 }
          ],
          ubzs: [
            { x: 158, oy: 48,  w: 100, h: 72 },
            { x: 158, oy: 248, w: 62,  h: 50 }
          ],
          hotspots: [
            { x: 320, oy: 85,  radius: 55, mult: 1.20 },
            { x: 65,  oy: 179, radius: 52, mult: 1.20 },
            { x: 195, oy: 338, radius: 48, mult: 0.82 }
          ],
          waves: [
            {
              preWaveDelay: 3000,
              enemies: [
                { type: 'saltChild',   count: 14, interval: 1200 },
                { type: 'scrapRunner', count: 4,  interval: 2200 }
              ]
            },
            {
              preWaveDelay: 5500,
              enemies: [
                { type: 'saltChild',   count: 12, interval: 1200 },
                { type: 'scrapRunner', count: 6,  interval: 1800 }
              ]
            },
            {
              preWaveDelay: 6500,
              enemies: [
                { type: 'saltChild',   count: 18, interval: 1000 },
                { type: 'scrapRunner', count: 8,  interval: 1400 }
              ]
            }
          ]
        },

        // ── L5 ─────────────────────────────────────────────────────────────
        {
          id: 5,
          name: 'THE DRIFTWOOD HULK',
          description: 'A massive bio-mass floats in. High HP. Ignores light towers.',
          difficulty: 4,
          baseHp: 10,
          tutorialText: 'DRIFTWOOD HULKS have extreme HP — Bombers barely scratch them.\nBARRICADES slow them while your GUNNERS focus fire.',
          path: [
            { x: 195, oy: 0   },
            { x: 195, oy: 30  },
            { x: 70,  oy: 30  },
            { x: 70,  oy: 108 },
            { x: 310, oy: 108 },
            { x: 310, oy: 178 },
            { x: 155, oy: 178 },
            { x: 155, oy: 256 },
            { x: 310, oy: 256 },
            { x: 310, oy: 332 },
            { x: 70,  oy: 332 },
            { x: 70,  oy: 382 },
            { x: 195, oy: 382 },
            { x: 195, oy: 415 }
          ],
          ubzs: [
            { x: 165, oy: 35,  w: 90, h: 62 },
            { x: 165, oy: 188, w: 80, h: 58 }
          ],
          hotspots: [
            { x: 70,  oy: 143, radius: 52, mult: 1.25 },
            { x: 310, oy: 217, radius: 52, mult: 1.25 },
            { x: 195, oy: 315, radius: 48, mult: 0.80 }
          ],
          waves: [
            {
              preWaveDelay: 3000,
              enemies: [ { type: 'saltChild', count: 12, interval: 1300 } ]
            },
            {
              preWaveDelay: 5500,
              enemies: [
                { type: 'driftwoodHulk', count: 1, interval: 0    },
                { type: 'saltChild',     count: 10, interval: 1400 }
              ]
            },
            {
              preWaveDelay: 6500,
              enemies: [
                { type: 'driftwoodHulk', count: 2, interval: 5500 },
                { type: 'scrapRunner',   count: 6, interval: 1400 }
              ]
            },
            {
              preWaveDelay: 7000,
              enemies: [
                { type: 'driftwoodHulk', count: 2, interval: 5000 },
                { type: 'saltChild',     count: 12, interval: 1200 },
                { type: 'scrapRunner',   count: 6, interval: 1600 }
              ]
            }
          ]
        },

        // ── L6 ─────────────────────────────────────────────────────────────
        {
          id: 6,
          name: 'THE KING\'S VISION',
          description: 'Your factory output reaches critical mass. The island grows.',
          difficulty: 4,
          baseHp: 10,
          tutorialText: 'Mixed loadouts outperform spamming one type.\nGUNNERS handle singles. BOMBERS clear clusters. BARRICADES buy time.',
          path: [
            { x: 195, oy: 0   },
            { x: 195, oy: 36  },
            { x: 315, oy: 36  },
            { x: 315, oy: 118 },
            { x: 75,  oy: 118 },
            { x: 75,  oy: 192 },
            { x: 235, oy: 192 },
            { x: 235, oy: 268 },
            { x: 75,  oy: 268 },
            { x: 75,  oy: 342 },
            { x: 315, oy: 342 },
            { x: 315, oy: 380 },
            { x: 195, oy: 380 },
            { x: 195, oy: 415 }
          ],
          ubzs: [
            { x: 100, oy: 40,  w: 85, h: 68 },
            { x: 158, oy: 200, w: 68, h: 58 },
            { x: 100, oy: 355, w: 85, h: 50 }
          ],
          hotspots: [
            { x: 195, oy: 78,  radius: 58, mult: 1.30 },
            { x: 75,  oy: 230, radius: 52, mult: 1.20 },
            { x: 315, oy: 155, radius: 48, mult: 0.78 }
          ],
          waves: [
            {
              preWaveDelay: 3000,
              enemies: [
                { type: 'saltChild',   count: 14, interval: 1200 },
                { type: 'scrapRunner', count: 5,  interval: 1800 }
              ]
            },
            {
              preWaveDelay: 5500,
              enemies: [
                { type: 'driftwoodHulk', count: 1,  interval: 0    },
                { type: 'scrapRunner',   count: 8,  interval: 1400 },
                { type: 'saltChild',     count: 10, interval: 1200 }
              ]
            },
            {
              preWaveDelay: 6000,
              enemies: [
                { type: 'driftwoodHulk', count: 2,  interval: 5000 },
                { type: 'saltChild',     count: 14, interval: 1000 },
                { type: 'scrapRunner',   count: 8,  interval: 1400 }
              ]
            },
            {
              preWaveDelay: 7000,
              enemies: [
                { type: 'driftwoodHulk', count: 3,  interval: 4500 },
                { type: 'scrapRunner',   count: 10, interval: 1200 },
                { type: 'saltChild',     count: 8,  interval: 1000 }
              ]
            }
          ]
        },

        // ── L7 ─────────────────────────────────────────────────────────────
        {
          id: 7,
          name: 'THE PRODUCTION LINE',
          description: 'A rival scout captured. The largest assault yet.',
          difficulty: 5,
          baseHp: 10,
          tutorialText: 'Your factory throughput is your real ceiling.\nIf you\'re short on towers, optimise your production line first.',
          path: [
            { x: 195, oy: 0   },
            { x: 195, oy: 26  },
            { x: 65,  oy: 26  },
            { x: 65,  oy: 95  },
            { x: 315, oy: 95  },
            { x: 315, oy: 162 },
            { x: 148, oy: 162 },
            { x: 148, oy: 236 },
            { x: 315, oy: 236 },
            { x: 315, oy: 308 },
            { x: 65,  oy: 308 },
            { x: 65,  oy: 375 },
            { x: 195, oy: 375 },
            { x: 195, oy: 415 }
          ],
          ubzs: [
            { x: 158, oy: 26,  w: 100, h: 58 },
            { x: 65,  oy: 192, w: 65,  h: 38 },
            { x: 162, oy: 288, w: 72,  h: 50 }
          ],
          hotspots: [
            { x: 65,  oy: 60,  radius: 52, mult: 1.25 },
            { x: 315, oy: 199, radius: 52, mult: 1.25 },
            { x: 195, oy: 342, radius: 48, mult: 1.20 },
            { x: 148, oy: 128, radius: 42, mult: 0.82 }
          ],
          waves: [
            {
              preWaveDelay: 3000,
              enemies: [
                { type: 'saltChild',   count: 16, interval: 1100 },
                { type: 'scrapRunner', count: 6,  interval: 1600 }
              ]
            },
            {
              preWaveDelay: 5000,
              enemies: [
                { type: 'driftwoodHulk', count: 1,  interval: 0    },
                { type: 'saltChild',     count: 14, interval: 1100 },
                { type: 'scrapRunner',   count: 8,  interval: 1400 }
              ]
            },
            {
              preWaveDelay: 6000,
              enemies: [
                { type: 'driftwoodHulk', count: 2,  interval: 5000 },
                { type: 'saltChild',     count: 16, interval: 1000 },
                { type: 'scrapRunner',   count: 8,  interval: 1400 }
              ]
            },
            {
              preWaveDelay: 7000,
              enemies: [
                { type: 'driftwoodHulk', count: 3,  interval: 4000 },
                { type: 'saltChild',     count: 18, interval: 900  },
                { type: 'scrapRunner',   count: 10, interval: 1200 }
              ]
            },
            {
              preWaveDelay: 8000,
              enemies: [
                { type: 'driftwoodHulk', count: 4,  interval: 3800 },
                { type: 'scrapRunner',   count: 12, interval: 1100 },
                { type: 'saltChild',     count: 16, interval: 900  }
              ]
            }
          ]
        },

        // ── L8 ─────────────────────────────────────────────────────────────
        {
          id: 8,
          name: 'THE FRONT COMMANDER',
          description: 'The leader of the local rival faction arrives to shut you down.',
          difficulty: 5,
          baseHp: 10,
          tutorialText: 'BOSS FIGHT. The Front Commander leads the full assault.\nEvery unit type arrives. Use everything you have.',
          path: [
            { x: 195, oy: 0   },
            { x: 195, oy: 24  },
            { x: 320, oy: 24  },
            { x: 320, oy: 100 },
            { x: 65,  oy: 100 },
            { x: 65,  oy: 174 },
            { x: 220, oy: 174 },
            { x: 220, oy: 248 },
            { x: 65,  oy: 248 },
            { x: 65,  oy: 320 },
            { x: 320, oy: 320 },
            { x: 320, oy: 375 },
            { x: 195, oy: 375 },
            { x: 195, oy: 415 }
          ],
          ubzs: [
            { x: 80,  oy: 24,  w: 98, h: 65 },
            { x: 128, oy: 180, w: 78, h: 58 },
            { x: 240, oy: 260, w: 62, h: 52 }
          ],
          hotspots: [
            { x: 320, oy: 62,  radius: 58, mult: 1.30 },
            { x: 65,  oy: 211, radius: 58, mult: 1.30 },
            { x: 320, oy: 211, radius: 48, mult: 0.75 },
            { x: 195, oy: 137, radius: 52, mult: 1.15 }
          ],
          waves: [
            {
              preWaveDelay: 3000,
              enemies: [
                { type: 'saltChild',   count: 16, interval: 1000 },
                { type: 'scrapRunner', count: 8,  interval: 1400 }
              ]
            },
            {
              preWaveDelay: 5500,
              enemies: [
                { type: 'driftwoodHulk', count: 2,  interval: 5000 },
                { type: 'saltChild',     count: 14, interval: 1000 },
                { type: 'scrapRunner',   count: 6,  interval: 1400 }
              ]
            },
            {
              preWaveDelay: 6500,
              enemies: [
                { type: 'driftwoodHulk', count: 3,  interval: 4500 },
                { type: 'scrapRunner',   count: 10, interval: 1200 },
                { type: 'saltChild',     count: 14, interval: 1000 }
              ]
            },
            {
              preWaveDelay: 7000,
              enemies: [
                { type: 'driftwoodHulk', count: 2,  interval: 5000 },
                { type: 'scrapRunner',   count: 16, interval: 1000 },
                { type: 'saltChild',     count: 18, interval: 900  }
              ]
            },
            {
              preWaveDelay: 9000,
              enemies: [
                { type: 'frontCommander', count: 1,  interval: 0    },
                { type: 'saltChild',      count: 18, interval: 800  },
                { type: 'scrapRunner',    count: 12, interval: 1100 },
                { type: 'driftwoodHulk',  count: 2,  interval: 8000 }
              ]
            }
          ]
        }

      ]
    }
  ]
};
