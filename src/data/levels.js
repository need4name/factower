// Path points use oy (y offset from CT).
// UBZs: { x, oy, w, h } — placed at map edges and logical dead zones.
// Hotspots: { x, oy, radius, mult } — seeded by levelId for determinism.
// mult > 1 = power boost (amber), mult < 1 = power drain (blue).

const LEVEL_DATA = {
  storylines: [
    {
      id: 1,
      name: 'SALT & PLASTIC',
      description: 'Establish your base. Survive the first raids.',
      faction: 'Non-Continuous Front',
      levels: [

        // L1 — simple S-curve, gentle intro, minimal UBZs (edge debris only)
        {
          id: 1,
          name: 'THE FIRST PRESS-GANG',
          description: 'Rivals target your turbine. Repel them.',
          difficulty: 1,
          baseHp: 15,
          tutorialText: 'Tap GUNNER below to select it.\nThen tap anywhere off the path to place it.',
          tutorialOptimalSpot: { x: 175, oy: 130 },
          path: [
            { x: 195, oy: 0   },
            { x: 195, oy: 55  },
            { x: 72,  oy: 55  },
            { x: 72,  oy: 190 },
            { x: 312, oy: 190 },
            { x: 312, oy: 310 },
            { x: 72,  oy: 310 },
            { x: 72,  oy: 378 },
            { x: 195, oy: 378 },
            { x: 195, oy: 415 }
          ],
          // L1: edge UBZs only — corners the player wouldn't reach anyway
          ubzs: [
            { x: 0,   oy: 0,   w: 30,  h: 415 }, // left edge strip
            { x: 350, oy: 0,   w: 40,  h: 415 }, // right edge strip
            { x: 0,   oy: 385, w: 390, h: 30  }  // bottom edge
          ],
          // Hotspots seeded by level ID 1 — deterministic
          hotspots: [
            { x: 175, oy: 122, radius: 58, mult: 1.22 },
            { x: 312, oy: 250, radius: 46, mult: 0.84 }
          ],
          waves: [
            {
              preWaveDelay: 3500,
              enemies: [ { type: 'saltChild', count: 5, interval: 3000 } ]
            }
          ]
        },

        // L2 — reversed Z path
        {
          id: 2,
          name: 'HEAVY ORDNANCE',
          description: 'Shielded units. Your scrap-throwers won\'t dent them.',
          difficulty: 2,
          baseHp: 10,
          tutorialText: 'Your second worker is now active in the Factory.\nMore workers means more towers — build before harder missions.',
          path: [
            { x: 195, oy: 0   },
            { x: 195, oy: 44  },
            { x: 315, oy: 44  },
            { x: 315, oy: 150 },
            { x: 78,  oy: 150 },
            { x: 78,  oy: 258 },
            { x: 315, oy: 258 },
            { x: 315, oy: 355 },
            { x: 195, oy: 355 },
            { x: 195, oy: 415 }
          ],
          // L2: edges + one dead-zone island in the middle of each large open zone
          ubzs: [
            { x: 0,   oy: 0,   w: 28,  h: 415 },
            { x: 362, oy: 0,   w: 28,  h: 415 },
            { x: 0,   oy: 385, w: 390, h: 30  },
            { x: 130, oy: 60,  w: 72,  h: 78  }, // island in upper open zone
            { x: 130, oy: 272, w: 72,  h: 72  }  // island in lower open zone
          ],
          hotspots: [
            { x: 195, oy: 200, radius: 62, mult: 1.24 },
            { x: 78,  oy: 44,  radius: 44, mult: 0.82 }
          ],
          waves: [
            {
              preWaveDelay: 3000,
              enemies: [ { type: 'saltChild', count: 10, interval: 1700 } ]
            },
            {
              preWaveDelay: 5500,
              enemies: [
                { type: 'saltChild',   count: 8, interval: 1500 },
                { type: 'scrapRunner', count: 3, interval: 2200 }
              ]
            }
          ]
        },

        // L3 — triple-zigzag
        {
          id: 3,
          name: 'OVERNIGHT ASSAULT',
          description: 'They hit while you sleep. Three waves.',
          difficulty: 3,
          baseHp: 10,
          tutorialText: 'PARTS are earned from every kill — shown top-left.\nKill everything you can — you\'ll need them soon.',
          path: [
            { x: 195, oy: 0   },
            { x: 195, oy: 35  },
            { x: 65,  oy: 35  },
            { x: 65,  oy: 125 },
            { x: 315, oy: 125 },
            { x: 315, oy: 218 },
            { x: 65,  oy: 218 },
            { x: 65,  oy: 308 },
            { x: 315, oy: 308 },
            { x: 315, oy: 365 },
            { x: 195, oy: 365 },
            { x: 195, oy: 415 }
          ],
          ubzs: [
            { x: 0,   oy: 0,   w: 26,  h: 415 },
            { x: 364, oy: 0,   w: 26,  h: 415 },
            { x: 0,   oy: 385, w: 390, h: 30  },
            // Dead zones between the three horizontal corridors
            { x: 125, oy: 42,  w: 80,  h: 72  },
            { x: 125, oy: 232, w: 80,  h: 65  }
          ],
          hotspots: [
            { x: 195, oy: 80,  radius: 52, mult: 1.20 },
            { x: 65,  oy: 260, radius: 48, mult: 1.18 },
            { x: 315, oy: 172, radius: 44, mult: 0.80 }
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

        // L4 — asymmetric spiral
        {
          id: 4,
          name: 'THE COUNTER-RAID',
          description: 'They retaliate. Upgrades now available — tap a placed tower.',
          difficulty: 3,
          baseHp: 10,
          tutorialText: 'UPGRADES UNLOCKED! Tap any placed tower during combat.\nSpend PARTS to increase its power. Upgrades reset each level.',
          path: [
            { x: 195, oy: 0   },
            { x: 195, oy: 40  },
            { x: 318, oy: 40  },
            { x: 318, oy: 130 },
            { x: 65,  oy: 130 },
            { x: 65,  oy: 228 },
            { x: 255, oy: 228 },
            { x: 255, oy: 310 },
            { x: 130, oy: 310 },
            { x: 130, oy: 368 },
            { x: 195, oy: 368 },
            { x: 195, oy: 415 }
          ],
          // L4: edges + larger UBZ islands — starts to feel more constrained
          ubzs: [
            { x: 0,   oy: 0,   w: 26,  h: 415 },
            { x: 364, oy: 0,   w: 26,  h: 415 },
            { x: 0,   oy: 385, w: 390, h: 30  },
            { x: 155, oy: 45,  w: 100, h: 75  }, // blocks easy corner placement
            { x: 155, oy: 240, w: 70,  h: 58  }
          ],
          hotspots: [
            { x: 318, oy: 85,  radius: 55, mult: 1.22 },
            { x: 65,  oy: 178, radius: 52, mult: 1.22 },
            { x: 195, oy: 340, radius: 48, mult: 0.80 }
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

        // L5 — double-back hairpin — UBZs start blocking prime spots
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
            { x: 70,  oy: 110 },
            { x: 308, oy: 110 },
            { x: 308, oy: 180 },
            { x: 152, oy: 180 },
            { x: 152, oy: 258 },
            { x: 308, oy: 258 },
            { x: 308, oy: 335 },
            { x: 70,  oy: 335 },
            { x: 70,  oy: 382 },
            { x: 195, oy: 382 },
            { x: 195, oy: 415 }
          ],
          // L5: edges, islands, AND a zone that blocks the best inner bend
          ubzs: [
            { x: 0,   oy: 0,   w: 26,  h: 415 },
            { x: 364, oy: 0,   w: 26,  h: 415 },
            { x: 0,   oy: 385, w: 390, h: 30  },
            { x: 162, oy: 35,  w: 90,  h: 68  }, // forces sub-optimal upper placement
            { x: 80,  oy: 192, w: 58,  h: 55  }, // blocks inner hairpin
            { x: 174, oy: 268, w: 68,  h: 55  }
          ],
          hotspots: [
            { x: 70,  oy: 143, radius: 52, mult: 1.26 },
            { x: 308, oy: 218, radius: 52, mult: 1.26 },
            { x: 195, oy: 320, radius: 48, mult: 0.78 }
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
                { type: 'driftwoodHulk', count: 2,  interval: 5000 },
                { type: 'saltChild',     count: 12, interval: 1200 },
                { type: 'scrapRunner',   count: 6,  interval: 1600 }
              ]
            }
          ]
        },

        // L6 — figure-8 loop — UBZs cut off multiple good positions
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
            { x: 75,  oy: 195 },
            { x: 235, oy: 195 },
            { x: 235, oy: 270 },
            { x: 75,  oy: 270 },
            { x: 75,  oy: 345 },
            { x: 315, oy: 345 },
            { x: 315, oy: 382 },
            { x: 195, oy: 382 },
            { x: 195, oy: 415 }
          ],
          ubzs: [
            { x: 0,   oy: 0,   w: 26,  h: 415 },
            { x: 364, oy: 0,   w: 26,  h: 415 },
            { x: 0,   oy: 385, w: 390, h: 30  },
            { x: 100, oy: 42,  w: 88,  h: 68  },
            { x: 154, oy: 202, w: 66,  h: 58  },
            { x: 100, oy: 352, w: 88,  h: 26  }
          ],
          hotspots: [
            { x: 195, oy: 78,  radius: 58, mult: 1.28 },
            { x: 75,  oy: 232, radius: 55, mult: 1.22 },
            { x: 315, oy: 157, radius: 48, mult: 0.78 }
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

        // L7 — tight corridor, heavy UBZ — placement at a real premium
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
            { x: 65,  oy: 96  },
            { x: 315, oy: 96  },
            { x: 315, oy: 165 },
            { x: 148, oy: 165 },
            { x: 148, oy: 238 },
            { x: 315, oy: 238 },
            { x: 315, oy: 310 },
            { x: 65,  oy: 310 },
            { x: 65,  oy: 378 },
            { x: 195, oy: 378 },
            { x: 195, oy: 415 }
          ],
          ubzs: [
            { x: 0,   oy: 0,   w: 26,  h: 415 },
            { x: 364, oy: 0,   w: 26,  h: 415 },
            { x: 0,   oy: 385, w: 390, h: 30  },
            { x: 160, oy: 30,  w: 102, h: 58  }, // forces awkward upper placement
            { x: 65,  oy: 198, w: 62,  h: 30  }, // blocks the inner hairpin sweet spot
            { x: 165, oy: 250, w: 72,  h: 48  }, // blocks second hairpin
            { x: 65,  oy: 320, w: 62,  h: 48  }  // blocks lower inner bend
          ],
          hotspots: [
            { x: 65,  oy: 60,  radius: 52, mult: 1.24 },
            { x: 315, oy: 200, radius: 52, mult: 1.24 },
            { x: 195, oy: 344, radius: 48, mult: 1.20 },
            { x: 148, oy: 130, radius: 44, mult: 0.80 }
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

        // L8 — boss level — most constrained UBZ layout
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
            { x: 318, oy: 24  },
            { x: 318, oy: 100 },
            { x: 65,  oy: 100 },
            { x: 65,  oy: 175 },
            { x: 220, oy: 175 },
            { x: 220, oy: 250 },
            { x: 65,  oy: 250 },
            { x: 65,  oy: 322 },
            { x: 318, oy: 322 },
            { x: 318, oy: 378 },
            { x: 195, oy: 378 },
            { x: 195, oy: 415 }
          ],
          ubzs: [
            { x: 0,   oy: 0,   w: 26,  h: 415 },
            { x: 364, oy: 0,   w: 26,  h: 415 },
            { x: 0,   oy: 385, w: 390, h: 30  },
            { x: 78,  oy: 28,  w: 100, h: 62  }, // upper zone left island
            { x: 128, oy: 182, w: 78,  h: 58  }, // centre island
            { x: 240, oy: 258, w: 62,  h: 52  }, // inner lower zone
            { x: 78,  oy: 332, w: 100, h: 40  }  // lower zone left island
          ],
          hotspots: [
            { x: 318, oy: 62,  radius: 58, mult: 1.30 },
            { x: 65,  oy: 212, radius: 58, mult: 1.30 },
            { x: 318, oy: 212, radius: 48, mult: 0.74 },
            { x: 195, oy: 137, radius: 52, mult: 1.16 }
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
