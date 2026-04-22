// ── levels.js ─────────────────────────────────────────────────────────────────
// Level data for all storylines.
// materialRewards defines what players earn:
//   killDrops     — materials per enemy kill (small, anti-hardlock trickle)
//   completionBonus — bulk reward on level victory
//
// S1 (Salt & Plastic) uses only T1 materials: plasticScrap + salvagedMetal.
// S2-S6 are test storylines for difficulty scaling validation — not for release.

// ── Shared kill drop tables ────────────────────────────────────────────────────

const _NCF_DROPS = {
  saltChild:      { plasticScrap: 1 },
  scrapRunner:    { plasticScrap: 1 },
  driftwoodHulk:  { salvagedMetal: 2 },
  frontCommander: { plasticScrap: 2, salvagedMetal: 3 }
};

// ── Test storyline generator ───────────────────────────────────────────────────
// Produces 10-level NCF-only runs scaled by enemy count.
// Scale affects waves per level and enemies per wave — HP/speed stay at base.
// rewardMult scales the completion bonus proportionally to difficulty.

function _buildTestStoryline(id, name, countScale, rewardMult) {
  const levels = [];

  for (let lvl = 1; lvl <= 10; lvl++) {
    const waveCount = Math.min(2 + Math.floor(lvl / 2), 7);
    const base      = Math.round(5 * countScale * (1 + (lvl - 1) * 0.18));
    const waves     = [];

    for (let w = 0; w < waveCount; w++) {
      const wave = {
        preWaveDelay: w === 0 ? 3000 : 6000,
        enemies: []
      };

      // Salt Children — core swarm, present every wave
      wave.enemies.push({
        type: 'saltChild',
        count: Math.round(base * (1 + w * 0.22)),
        interval: Math.max(500, 1200 - w * 80)
      });

      // Scrap Runners — from wave 2 onward, or if level >= 3
      if (w >= 1 || lvl >= 3) {
        wave.enemies.push({
          type: 'scrapRunner',
          count: Math.max(1, Math.round(base * 0.45)),
          interval: 1800
        });
      }

      // Driftwood Hulks — mid-level onward, later waves only
      if (lvl >= 4 && w >= Math.floor(waveCount / 2)) {
        wave.enemies.push({
          type: 'driftwoodHulk',
          count: Math.max(1, Math.round(countScale * Math.ceil(lvl / 3))),
          interval: 4000
        });
      }

      // Front Commander — boss in final wave of levels 6+
      if (lvl >= 6 && w === waveCount - 1) {
        wave.enemies.push({
          type: 'frontCommander',
          count: Math.max(1, Math.round(countScale * 0.5)),
          interval: 0
        });
      }

      waves.push(wave);
    }

    // Completion bonus scales with level position and storyline difficulty
    const scrapBonus = Math.round((6 + lvl * 2) * rewardMult);
    const metalBonus = Math.round((1 + lvl * 1.5) * rewardMult);

    levels.push({
      id:          lvl,
      name:        name + ' \xb7 ' + lvl,
      description: 'Test run ' + id + ', tier ' + lvl + '. Enemy count \xd7' + countScale.toFixed(1) + '.',
      difficulty:  (id - 1) * 10 + lvl,
      towerSlots:  8,
      baseHp:      10,
      waves,
      materialRewards: {
        killDrops:       _NCF_DROPS,
        completionBonus: { plasticScrap: scrapBonus, salvagedMetal: metalBonus }
      }
    });
  }

  return {
    id,
    name,
    description: 'Difficulty scaling test (' + countScale.toFixed(1) + '\xd7 enemy count). Not for release.',
    faction:     'Non-Continuous Front',
    levels
  };
}

// ── Main level data ────────────────────────────────────────────────────────────

const LEVEL_DATA = {
  storylines: [

    // ── STORYLINE 1 — SALT & PLASTIC ──────────────────────────────────────────
    {
      id:          1,
      name:        'SALT & PLASTIC',
      description: 'Establish your base. Survive the first raids.',
      faction:     'Non-Continuous Front',
      levels: [
        // ── L1: FIRST CONTACT ─────────────────────────────────────────────────
        {
          id: 1, name: 'FIRST CONTACT',
          description: 'A small scouting party. Learn your towers.',
          difficulty: 1, towerSlots: 6, baseHp: 10,
          waves: [
            { preWaveDelay: 3000, enemies: [
              { type: 'saltChild', count: 4, interval: 2500 }
            ]}
          ],
          materialRewards: {
            killDrops: _NCF_DROPS,
            completionBonus: { plasticScrap: 6, salvagedMetal: 0 }
          }
        },

        // ── L2: WORD SPREADS ──────────────────────────────────────────────────
        {
          id: 2, name: 'WORD SPREADS',
          description: 'A larger force. Scrap Runners have joined.',
          difficulty: 2, towerSlots: 6, baseHp: 10,
          waves: [
            { preWaveDelay: 3000, enemies: [
              { type: 'saltChild', count: 8, interval: 1500 }
            ]},
            { preWaveDelay: 5000, enemies: [
              { type: 'saltChild',   count: 6, interval: 1500 },
              { type: 'scrapRunner', count: 3, interval: 2500 }
            ]}
          ],
          materialRewards: {
            killDrops: _NCF_DROPS,
            completionBonus: { plasticScrap: 8, salvagedMetal: 2 }
          }
        },

        // ── L3: OVERNIGHT ASSAULT ─────────────────────────────────────────────
        {
          id: 3, name: 'OVERNIGHT ASSAULT',
          description: 'Three waves through the night.',
          difficulty: 3, towerSlots: 8, baseHp: 10,
          waves: [
            { preWaveDelay: 3000, enemies: [
              { type: 'saltChild', count: 10, interval: 1200 }
            ]},
            { preWaveDelay: 6000, enemies: [
              { type: 'saltChild',   count: 8, interval: 1200 },
              { type: 'scrapRunner', count: 4, interval: 2000 }
            ]},
            { preWaveDelay: 6000, enemies: [
              { type: 'saltChild',   count: 12, interval: 1000 },
              { type: 'scrapRunner', count: 6,  interval: 1800 }
            ]}
          ],
          materialRewards: {
            killDrops: _NCF_DROPS,
            completionBonus: { plasticScrap: 8, salvagedMetal: 4 }
          }
        },

        // ── L4: THE HULK ──────────────────────────────────────────────────────
        {
          id: 4, name: 'THE HULK',
          description: 'Something bigger arrives. Splash damage is useless against it.',
          difficulty: 4, towerSlots: 8, baseHp: 10,
          waves: [
            { preWaveDelay: 3000, enemies: [
              { type: 'saltChild', count: 10, interval: 1200 }
            ]},
            { preWaveDelay: 6000, enemies: [
              { type: 'driftwoodHulk', count: 1, interval: 0    },
              { type: 'saltChild',     count: 8, interval: 1500 }
            ]},
            { preWaveDelay: 6000, enemies: [
              { type: 'driftwoodHulk', count: 2, interval: 5000 },
              { type: 'scrapRunner',   count: 6, interval: 1500 }
            ]}
          ],
          materialRewards: {
            killDrops: _NCF_DROPS,
            completionBonus: { plasticScrap: 6, salvagedMetal: 8 }
          }
        },

        // ── L5: THE COMMANDER ─────────────────────────────────────────────────
        {
          id: 5, name: 'THE COMMANDER',
          description: 'The Front Commander leads the assault. Hold your ground.',
          difficulty: 5, towerSlots: 8, baseHp: 10,
          waves: [
            { preWaveDelay: 3000, enemies: [
              { type: 'saltChild',   count: 12, interval: 1000 },
              { type: 'scrapRunner', count: 6,  interval: 1500 }
            ]},
            { preWaveDelay: 6000, enemies: [
              { type: 'driftwoodHulk', count: 2,  interval: 4000 },
              { type: 'saltChild',     count: 10, interval: 1200 }
            ]},
            { preWaveDelay: 8000, enemies: [
              { type: 'frontCommander', count: 1,  interval: 0    },
              { type: 'saltChild',      count: 15, interval: 800  },
              { type: 'scrapRunner',    count: 8,  interval: 1200 }
            ]}
          ],
          materialRewards: {
            killDrops: _NCF_DROPS,
            completionBonus: { plasticScrap: 10, salvagedMetal: 8 }
          }
        },

        // ── L6: DRIFT WALL ────────────────────────────────────────────────────
        {
          id: 6, name: 'DRIFT WALL',
          description: 'Four waves. The Front has regrouped.',
          difficulty: 6, towerSlots: 8, baseHp: 10,
          waves: [
            { preWaveDelay: 3000, enemies: [
              { type: 'saltChild',   count: 14, interval: 900  },
              { type: 'scrapRunner', count: 6,  interval: 1500 }
            ]},
            { preWaveDelay: 6000, enemies: [
              { type: 'driftwoodHulk', count: 2,  interval: 4000 },
              { type: 'saltChild',     count: 12, interval: 1000 }
            ]},
            { preWaveDelay: 6000, enemies: [
              { type: 'saltChild',   count: 16, interval: 800  },
              { type: 'scrapRunner', count: 10, interval: 1200 }
            ]},
            { preWaveDelay: 8000, enemies: [
              { type: 'driftwoodHulk', count: 3,  interval: 3500 },
              { type: 'scrapRunner',   count: 8,  interval: 1200 },
              { type: 'saltChild',     count: 10, interval: 1000 }
            ]}
          ],
          materialRewards: {
            killDrops: _NCF_DROPS,
            completionBonus: { plasticScrap: 10, salvagedMetal: 10 }
          }
        },

        // ── L7: DEEP CHANNEL ──────────────────────────────────────────────────
        {
          id: 7, name: 'DEEP CHANNEL',
          description: 'Five waves. A merchant watches the outcome.',
          difficulty: 7, towerSlots: 8, baseHp: 10,
          waves: [
            { preWaveDelay: 3000, enemies: [
              { type: 'saltChild',   count: 14, interval: 800  },
              { type: 'scrapRunner', count: 8,  interval: 1400 }
            ]},
            { preWaveDelay: 6000, enemies: [
              { type: 'driftwoodHulk', count: 3,  interval: 3500 },
              { type: 'saltChild',     count: 12, interval: 900  }
            ]},
            { preWaveDelay: 6000, enemies: [
              { type: 'saltChild',   count: 18, interval: 700  },
              { type: 'scrapRunner', count: 10, interval: 1100 }
            ]},
            { preWaveDelay: 7000, enemies: [
              { type: 'driftwoodHulk',  count: 4,  interval: 3000 },
              { type: 'scrapRunner',    count: 12, interval: 1000 }
            ]},
            { preWaveDelay: 8000, enemies: [
              { type: 'frontCommander', count: 1,  interval: 0    },
              { type: 'saltChild',      count: 18, interval: 700  },
              { type: 'scrapRunner',    count: 10, interval: 1000 }
            ]}
          ],
          materialRewards: {
            killDrops: _NCF_DROPS,
            completionBonus: { plasticScrap: 12, salvagedMetal: 12 }
          }
        },

        // ── L8: THE SARGASSO ──────────────────────────────────────────────────
        {
          id: 8, name: 'THE SARGASSO',
          description: 'The final battle. Victory establishes the island\'s reputation.',
          difficulty: 8, towerSlots: 8, baseHp: 10,
          waves: [
            { preWaveDelay: 3000, enemies: [
              { type: 'saltChild',   count: 16, interval: 700  },
              { type: 'scrapRunner', count: 10, interval: 1200 }
            ]},
            { preWaveDelay: 6000, enemies: [
              { type: 'driftwoodHulk', count: 4,  interval: 3000 },
              { type: 'saltChild',     count: 14, interval: 800  }
            ]},
            { preWaveDelay: 6000, enemies: [
              { type: 'saltChild',   count: 20, interval: 600  },
              { type: 'scrapRunner', count: 14, interval: 900  }
            ]},
            { preWaveDelay: 7000, enemies: [
              { type: 'driftwoodHulk', count: 5,  interval: 2500 },
              { type: 'scrapRunner',   count: 14, interval: 900  }
            ]},
            { preWaveDelay: 9000, enemies: [
              { type: 'frontCommander', count: 2,  interval: 8000 },
              { type: 'saltChild',      count: 20, interval: 600  },
              { type: 'scrapRunner',    count: 14, interval: 900  },
              { type: 'driftwoodHulk',  count: 3,  interval: 3500 }
            ]}
          ],
          materialRewards: {
            killDrops: _NCF_DROPS,
            completionBonus: { plasticScrap: 14, salvagedMetal: 14 }
          }
        }
      ]
    },

    // ── STORYLINES 2-6 — DIFFICULTY SCALING TESTS ─────────────────────────────
    // Enemy counts scaled, HP/speed at base values.
    // Rewards scale proportionally. Not intended for release.

    _buildTestStoryline(2, 'PRESSURE TEST A', 1.4, 1.6),
    _buildTestStoryline(3, 'PRESSURE TEST B', 1.9, 2.2),
    _buildTestStoryline(4, 'PRESSURE TEST C', 2.5, 2.9),
    _buildTestStoryline(5, 'PRESSURE TEST D', 3.2, 3.8),
    _buildTestStoryline(6, 'PRESSURE TEST E', 4.0, 5.0)
  ]
};
