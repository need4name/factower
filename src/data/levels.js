// ── levels.js ─────────────────────────────────────────────────────────────────
// Level data for all storylines.
// materialRewards defines what players earn:
//   killDrops     — materials per enemy kill (small, anti-hardlock trickle)
//   completionBonus — bulk reward on level victory
//
// Campaign structure (see progression.js for keys, gates and unlocks):
//   storyline 1  Prologue            p1..p7
//   storyline 2  Story 1 · SALV      s1-1..
//   storyline 3  Story 2 · Borga     s2-1..
//   storyline 4  Story 3 · Helix     s3-1..
// Levels marked soon: true are planned but not built yet (shown locked).
// type: 'raid' levels are offensive — your towers roll out as a convoy
// against enemy turrets (RaidScene).
// path points use x 0..390 and oy 0..418 (rescaled to the play area);
// a level without a path uses the default S-curve.

// ── Shared kill drop tables ────────────────────────────────────────────────────

const _NCF_DROPS = {
  saltChild:      { plasticScrap: 1 },
  scrapRunner:    { plasticScrap: 1 },
  driftwoodHulk:  { salvagedMetal: 2 },
  frontCommander: { plasticScrap: 2, salvagedMetal: 3 }
};
const _SALV_DROPS = {
  salvSkiff:  { plasticScrap: 1 },
  salvCutter: { salvagedMetal: 2 },
  saltChild:  { plasticScrap: 1 },
  scrapRunner:{ plasticScrap: 1 }
};

// Compact helpers: _W(_g('saltChild', 8, 1500), ...) is a wave; _P([x, oy], ...) a path
const _g = (type, count, interval) => ({ type, count, interval });
const _W = (...enemies) => ({ enemies });
const _P = (...pts) => pts.map(([x, oy]) => ({ x, oy }));

// ── Main level data ────────────────────────────────────────────────────────────

const LEVEL_DATA = {
  storylines: [

    // ── PROLOGUE — WASHED UP ──────────────────────────────────────────────────
    {
      id: 1, name: 'PROLOGUE', short: 'Prologue', title: 'Washed Up',
      description: 'A raft, a dead wind turbine and a man called Tim. Survive the Front.',
      faction: 'Non-Continuous Front',
      levels: [
        { id: 1, name: 'WASHED UP',
          description: 'A Front scouting party probes the raft. Two well-placed Gunners will hold them.',
          difficulty: 1, baseHp: 10,
          // Tuned with a headless sim: no towers or one tower always loses, two
          // badly placed Gunners lose, two Gunners near the bends win every time.
          recommendedTowers: 2,
          tutorialSpots: [{ x: 170, oy: 336 }, { x: 230, oy: 244 }],
          waves: [ _W(_g('saltChild', 4, 2600)), _W(_g('saltChild', 6, 2200)) ],
          materialRewards: { killDrops: _NCF_DROPS, completionBonus: { plasticScrap: 6, salvagedMetal: 0 } } },

        { id: 2, name: 'THEY CAME BACK',
          description: 'The Front never takes one beating when it can take two.',
          difficulty: 2, baseHp: 10,
          path: _P([195, 0], [195, 40], [320, 40], [320, 140], [70, 140], [70, 250], [320, 250], [320, 360], [195, 360], [195, 418]),
          waves: [ _W(_g('saltChild', 8, 1500)), _W(_g('saltChild', 6, 1500), _g('scrapRunner', 3, 2500)) ],
          materialRewards: { killDrops: _NCF_DROPS, completionBonus: { plasticScrap: 8, salvagedMetal: 4 } } },

        { id: 3, name: 'HOLD THE RAFT',
          description: 'A bigger crew. Grab the salvage from their wrecks.',
          difficulty: 3, baseHp: 10,
          path: _P([60, 0], [60, 330], [170, 330], [170, 90], [280, 90], [280, 330], [330, 330], [330, 418]),
          waves: [ _W(_g('saltChild', 10, 1200)),
                   _W(_g('saltChild', 8, 1200), _g('scrapRunner', 4, 2000)),
                   _W(_g('saltChild', 12, 1000), _g('scrapRunner', 6, 1800)) ],
          materialRewards: { killDrops: _NCF_DROPS, completionBonus: { plasticScrap: 8, salvagedMetal: 4 } } },

        { id: 4, name: 'FIRST RAID', type: 'raid',
          description: 'Take the fight to the Front. Roll your towers into their camp and wreck its core.',
          difficulty: 4,
          path: _P([195, 0], [195, 70], [80, 70], [80, 200], [310, 200], [310, 330], [195, 330], [195, 418]),
          turrets: [ { x: 140, oy: 30, kind: 'gun' }, { x: 30, oy: 140, kind: 'gun' }, { x: 200, oy: 250, kind: 'gun' },
                     { x: 360, oy: 270, kind: 'gun' }, { x: 120, oy: 370, kind: 'heavy' } ],
          core: { hp: 420 },
          loot: { plasticScrap: 18, salvagedMetal: 10 } },

        { id: 5, name: 'RETALIATION',
          description: 'You hit their camp. Now the Front comes with everything.',
          difficulty: 5, baseHp: 12,
          path: _P([350, 0], [350, 80], [40, 80], [40, 200], [350, 200], [350, 320], [40, 320], [40, 418]),
          waves: [ _W(_g('saltChild', 14, 900), _g('scrapRunner', 6, 1500)),
                   _W(_g('saltChild', 12, 1000), _g('scrapRunner', 6, 1300)),
                   _W(_g('saltChild', 16, 800), _g('scrapRunner', 10, 1200), _g('bilgeRat', 8, 220)),
                   _W(_g('scrapRunner', 10, 1100), _g('saltChild', 14, 900), _g('bilgeRat', 10, 220)) ],
          materialRewards: { killDrops: _NCF_DROPS, completionBonus: { plasticScrap: 10, salvagedMetal: 8 } } },

        { id: 6, name: 'SOMETHING BIGGER',
          description: 'Armoured raiders. Someone is equipping the Front.',
          difficulty: 6, baseHp: 12,
          path: _P([195, 0], [195, 120], [60, 120], [60, 300], [195, 300], [195, 180], [330, 180], [330, 418]),
          waves: [ _W(_g('saltChild', 10, 1200)),
                   _W(_g('driftwoodHulk', 1, 0), _g('saltChild', 8, 1500)),
                   _W(_g('driftwoodHulk', 2, 5000), _g('scrapRunner', 6, 1500)) ],
          materialRewards: { killDrops: _NCF_DROPS, completionBonus: { plasticScrap: 8, salvagedMetal: 10 } } },

        { id: 7, name: 'THE FRONT COMMANDER',
          description: 'Their boss leads the assault. Bring it down and the Front scatters.',
          difficulty: 7, baseHp: 14, boss: true,
          path: _P([195, 0], [195, 52], [315, 52], [315, 185], [80, 185], [80, 308], [315, 308], [315, 375], [195, 375], [195, 418]),
          waves: [ _W(_g('saltChild', 12, 1000), _g('scrapRunner', 6, 1500)),
                   _W(_g('driftwoodHulk', 2, 4000), _g('saltChild', 10, 1200), _g('bilgeRat', 8, 220)),
                   _W(_g('frontCommander', 1, 0), _g('saltChild', 15, 800), _g('scrapRunner', 8, 1200)) ],
          materialRewards: { killDrops: _NCF_DROPS, completionBonus: { plasticScrap: 12, salvagedMetal: 10 } } }
      ]
    },

    // ── STORY 1 — THE SALV COLLECTIVE ─────────────────────────────────────────
    {
      id: 2, name: 'STORY 1', short: 'Story 1', title: 'The SALV Collective',
      description: 'The local pirate federation has noticed your raft. Friend or threat?',
      faction: 'SALV Collective',
      levels: [
        { id: 1, name: 'SUPPLY RUN', type: 'raid',
          description: 'Raid the Salt Children’s stash before the SALV arrive.',
          difficulty: 8,
          path: _P([60, 0], [60, 120], [330, 120], [330, 240], [60, 240], [60, 360], [250, 360], [250, 418]),
          turrets: [ { x: 160, oy: 70, kind: 'gun' }, { x: 260, oy: 170, kind: 'gun' }, { x: 370, oy: 60, kind: 'gun' },
                     { x: 150, oy: 290, kind: 'heavy' }, { x: 20, oy: 300, kind: 'gun' }, { x: 320, oy: 330, kind: 'heavy' } ],
          core: { hp: 420 },
          loot: { plasticScrap: 24, salvagedMetal: 16 } },

        { id: 2, name: 'STRANGE SAILS',
          description: 'Bigger hulls, better guns. The SALV are testing you.',
          difficulty: 9, baseHp: 14,
          path: _P([100, 0], [100, 150], [290, 150], [290, 270], [100, 270], [100, 418]),
          waves: [ _W(_g('salvSkiff', 8, 1300)),
                   _W(_g('salvSkiff', 10, 1100), _g('salvCutter', 2, 4000)),
                   _W(_g('salvCutter', 3, 3000), _g('salvSkiff', 12, 900)) ],
          materialRewards: { killDrops: _SALV_DROPS, completionBonus: { plasticScrap: 12, salvagedMetal: 12 } } },

        { id: 3, name: 'KEEP THEM OFF',
          description: 'The SALV come in force. Keep them off the raft.',
          difficulty: 10, baseHp: 15,
          path: _P([330, 0], [330, 100], [60, 100], [60, 210], [200, 210], [200, 320], [330, 320], [330, 418]),
          waves: [ _W(_g('salvSkiff', 12, 900)),
                   _W(_g('salvCutter', 3, 3000), _g('salvSkiff', 10, 1000)),
                   _W(_g('salvSkiff', 16, 700), _g('salvCutter', 2, 3500)),
                   _W(_g('salvCutter', 5, 2500), _g('salvSkiff', 14, 800)) ],
          materialRewards: { killDrops: _SALV_DROPS, completionBonus: { plasticScrap: 14, salvagedMetal: 14 } } },

        { id: 4, name: 'BROKEN TRUST', soon: true, requires: ['s2-2'],
          description: 'Umbaji visits and sees the Front recruits on your raft.' },
        { id: 5, name: 'UMBAJI’S REVENGE', soon: true,
          description: 'Wave after wave, each worse than the last.' },
        { id: 6, name: 'THE SIPHON', soon: true,
          description: 'Borga shares a secret learned fighting with the Front.' }
      ]
    },

    // ── STORY 2 — BORGA ───────────────────────────────────────────────────────
    {
      id: 3, name: 'STORY 2', short: 'Story 2', title: 'Borga',
      description: 'Expeditions, a starving crew, and a voice on the radio.',
      faction: 'SALV Collective · IOA',
      levels: [
        { id: 1, name: 'EXPEDITION', type: 'raid', soon: true, description: 'Scavenge for the new Gunner’s parts.' },
        { id: 2, name: 'THE STARVING', type: 'raid', soon: true, description: 'A stranded Front crew, close to death.' },
        { id: 3, name: 'SALV STRIKE', soon: true, requires: ['s1-6'], description: 'The SALV hit back.' },
        { id: 4, name: 'PAYBACK', type: 'raid', soon: true, description: 'Take the fight to Umbaji.' },
        { id: 5, name: 'THE VOICE', soon: true, requires: ['s3-2'], description: 'Someone from the IOA wants something.' },
        { id: 6, name: 'PRESSURE', soon: true, requires: ['s3-3'], description: 'Why is Helix moving the Front?' },
        { id: 7, name: 'UMBAJI', soon: true, boss: true, description: 'End the SALV raids for good.' }
      ]
    },

    // ── STORY 3 — HELIX ───────────────────────────────────────────────────────
    {
      id: 4, name: 'STORY 3', short: 'Story 3', title: 'Helix',
      description: 'The Front keeps fleeing from the west. Something is driving them.',
      faction: 'Non-Continuous Front · Helix',
      levels: [
        { id: 1, name: 'ROGUE FRONT', soon: true, description: 'A rogue Front crew spots the siphon.' },
        { id: 2, name: 'THE RADIO', soon: true, description: 'A stronger attack — and a radio.' },
        { id: 3, name: 'ONE WORD', soon: true, description: 'A prisoner says only: Helix.' },
        { id: 4, name: 'ADVANCE FORCE', soon: true, description: 'The fleeing Front, and what follows them.' }
      ]
    }
  ]
};
