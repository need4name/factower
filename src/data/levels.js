// ── levels.js ─────────────────────────────────────────────────────────────────
// Level data for all storylines.
// Every tower costs one material, so materialRewards is the tower budget:
//   killDrops       — materials from elite kills
//   completionBonus — bulk reward on victory (half on replays), sized so a
//                     first clear pays for roughly the next level's
//                     recommendedTowers
// recommendedTowers is the tower count the level is tuned for (headless sim:
// that many towers wins with HP to spare; a few fewer usually loses).
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

// Only bosses drop materials (other elites drop rare parts for mods);
// ordinary raiders add to the scrap trickle (one Plastic Scrap per 15
// sunk, see CombatScene.saveProgress).
const _NCF_DROPS   = { frontCommander: { plasticScrap: 1, salvagedMetal: 1 } };
const _HELIX_DROPS = { helixSpearhead: { plasticScrap: 2, salvagedMetal: 2 } };
const _SALV_DROPS  = { umbajiFlagship: { plasticScrap: 2, salvagedMetal: 2 } };

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
          difficulty: 1, recommendedTowers: 2, baseHp: 10,
          // Tuned with a headless sim: no towers or one tower always loses, two
          // badly placed Gunners lose, two Gunners near the bends win every time.
          tutorialSpots: [{ x: 170, oy: 336 }, { x: 230, oy: 244 }],
          waves: [ _W(_g('saltChild', 4, 2600)), _W(_g('saltChild', 6, 2200)) ],
          materialRewards: { killDrops: _NCF_DROPS, completionBonus: { plasticScrap: 7, salvagedMetal: 0 } } },

        { id: 2, name: 'THEY CAME BACK',
          description: 'The Front never takes one beating when it can take two.',
          difficulty: 2, recommendedTowers: 3, baseHp: 10,
          path: _P([195, 0], [195, 40], [320, 40], [320, 140], [70, 140], [70, 250], [320, 250], [320, 360], [195, 360], [195, 418]),
          waves: [ _W(_g('saltChild', 8, 1500)), _W(_g('saltChild', 6, 1500), _g('scrapRunner', 3, 2500)) ],
          materialRewards: { killDrops: _NCF_DROPS, completionBonus: { plasticScrap: 4, salvagedMetal: 4 } } },

        { id: 3, name: 'HOLD THE RAFT',
          description: 'A bigger crew. Grab the salvage from their wrecks.',
          difficulty: 3, recommendedTowers: 4, baseHp: 10,
          path: _P([60, 0], [60, 330], [170, 330], [170, 90], [280, 90], [280, 330], [330, 330], [330, 418]),
          waves: [ _W(_g('saltChild', 10, 1200)),
                   _W(_g('saltChild', 8, 1200), _g('scrapRunner', 4, 2000)),
                   _W(_g('saltChild', 12, 1000), _g('scrapRunner', 6, 1800)) ],
          materialRewards: { killDrops: _NCF_DROPS, completionBonus: { plasticScrap: 3, salvagedMetal: 1 } } },

        { id: 4, name: 'FIRST RAID', type: 'raid',
          description: 'Take the fight to the Front. Roll your towers into their camp and wreck its core.',
          difficulty: 4, recommendedTowers: 4,
          path: _P([195, 0], [195, 70], [80, 70], [80, 200], [310, 200], [310, 330], [195, 330], [195, 418]),
          turrets: [ { x: 140, oy: 30, kind: 'gun' }, { x: 30, oy: 140, kind: 'gun' }, { x: 200, oy: 250, kind: 'gun' },
                     { x: 360, oy: 270, kind: 'gun' }, { x: 120, oy: 370, kind: 'heavy' } ],
          core: { hp: 420 },
          loot: { plasticScrap: 7, salvagedMetal: 6 } },

        { id: 5, name: 'RETALIATION',
          description: 'You hit their camp. Now the Front comes with everything.',
          difficulty: 5, recommendedTowers: 5, baseHp: 12,
          path: _P([350, 0], [350, 80], [40, 80], [40, 200], [350, 200], [350, 320], [40, 320], [40, 418]),
          waves: [ _W(_g('saltChild', 14, 900), _g('scrapRunner', 6, 1500)),
                   _W(_g('saltChild', 12, 1000), _g('scrapRunner', 6, 1300)),
                   _W(_g('saltChild', 16, 800), _g('scrapRunner', 10, 1200), _g('bilgeRat', 8, 220)),
                   _W(_g('scrapRunner', 10, 1100), _g('saltChild', 14, 900), _g('bilgeRat', 10, 220)) ],
          materialRewards: { killDrops: _NCF_DROPS, completionBonus: { plasticScrap: 2, salvagedMetal: 1 } } },

        { id: 6, name: 'SOMETHING BIGGER',
          description: 'Armoured raiders. Someone is equipping the Front.',
          difficulty: 6, recommendedTowers: 5, hpScale: 0.96, baseHp: 12,
          path: _P([195, 0], [195, 120], [60, 120], [60, 300], [195, 300], [195, 180], [330, 180], [330, 418]),
          waves: [ _W(_g('saltChild', 10, 1200)),
                   _W(_g('driftwoodHulk', 1, 0), _g('saltChild', 8, 1500)),
                   _W(_g('driftwoodHulk', 2, 5000), _g('scrapRunner', 6, 1500)) ],
          materialRewards: { killDrops: _NCF_DROPS, completionBonus: { plasticScrap: 5, salvagedMetal: 2 } } },

        { id: 7, name: 'THE FRONT COMMANDER',
          description: 'Their boss leads the assault. Bring it down and the Front scatters.',
          difficulty: 7, recommendedTowers: 6, hpScale: 0.9, baseHp: 14, boss: true,
          path: _P([195, 0], [195, 52], [315, 52], [315, 185], [80, 185], [80, 308], [315, 308], [315, 375], [195, 375], [195, 418]),
          waves: [ _W(_g('saltChild', 12, 1000), _g('scrapRunner', 6, 1500)),
                   _W(_g('driftwoodHulk', 2, 4000), _g('saltChild', 10, 1200), _g('bilgeRat', 8, 220)),
                   _W(_g('frontCommander', 1, 0), _g('saltChild', 15, 800), _g('scrapRunner', 8, 1200)) ],
          materialRewards: { killDrops: _NCF_DROPS, completionBonus: { plasticScrap: 2, salvagedMetal: 1 } } }
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
          difficulty: 8, recommendedTowers: 5,
          path: _P([60, 0], [60, 120], [330, 120], [330, 240], [60, 240], [60, 360], [250, 360], [250, 418]),
          turrets: [ { x: 160, oy: 70, kind: 'gun' }, { x: 260, oy: 170, kind: 'gun' }, { x: 370, oy: 60, kind: 'gun' },
                     { x: 150, oy: 290, kind: 'heavy' }, { x: 20, oy: 300, kind: 'gun' }, { x: 320, oy: 330, kind: 'heavy' } ],
          turretScale: 1.0,
          core: { hp: 420 },
          loot: { plasticScrap: 3, salvagedMetal: 2 } },

        { id: 2, name: 'STRANGE SAILS',
          description: 'Bigger hulls, better guns. The SALV are testing you.',
          difficulty: 9, recommendedTowers: 6, hpScale: 0.88, baseHp: 14,
          path: _P([100, 0], [100, 150], [290, 150], [290, 270], [100, 270], [100, 418]),
          waves: [ _W(_g('salvSkiff', 8, 1300)),
                   _W(_g('salvSkiff', 10, 1100), _g('salvCutter', 2, 4000)),
                   _W(_g('salvCutter', 3, 3000), _g('salvSkiff', 12, 900)) ],
          materialRewards: { killDrops: _SALV_DROPS, completionBonus: { plasticScrap: 5, salvagedMetal: 2 } } },

        { id: 3, name: 'KEEP THEM OFF',
          description: 'The SALV come in force. Keep them off the raft.',
          difficulty: 10, recommendedTowers: 7, hpScale: 1.09, baseHp: 15,
          path: _P([330, 0], [330, 100], [60, 100], [60, 210], [200, 210], [200, 320], [330, 320], [330, 418]),
          waves: [ _W(_g('salvSkiff', 12, 900)),
                   _W(_g('salvCutter', 3, 3000), _g('salvSkiff', 10, 1000)),
                   _W(_g('salvSkiff', 16, 700), _g('salvCutter', 2, 3500)),
                   _W(_g('salvCutter', 5, 2500), _g('salvSkiff', 14, 800)) ],
          materialRewards: { killDrops: _SALV_DROPS, completionBonus: { plasticScrap: 9, salvagedMetal: 6 } } },

        { id: 4, name: 'BROKEN TRUST', requires: ['s2-2'],
          description: 'Umbaji sees the Front recruits on your raft. The SALV want a lesson taught.',
          difficulty: 11, recommendedTowers: 7, hpScale: 2.17, baseHp: 15,
          path: _P([40, 0], [40, 90], [350, 90], [350, 190], [130, 190], [130, 300], [350, 300], [350, 418]),
          waves: [ _W(_g('salvSkiff', 12, 900), _g('salvCutter', 2, 3500)),
                   _W(_g('salvCutter', 4, 2600), _g('salvSkiff', 12, 850)),
                   _W(_g('salvRam', 1, 0), _g('salvSkiff', 14, 800)),
                   _W(_g('salvCutter', 5, 2200), _g('salvSkiff', 16, 700)) ],
          materialRewards: { killDrops: _SALV_DROPS, completionBonus: { plasticScrap: 2, salvagedMetal: 3 } } },

        { id: 5, name: 'UMBAJI’S REVENGE',
          description: 'Wave after wave, each worse than the last.',
          difficulty: 12, recommendedTowers: 7, hpScale: 1.47, baseHp: 16,
          path: _P([195, 0], [195, 60], [40, 60], [40, 360], [350, 360], [350, 160], [195, 160], [195, 418]),
          waves: [ _W(_g('salvSkiff', 16, 750)),
                   _W(_g('salvCutter', 5, 2200), _g('salvSkiff', 12, 800)),
                   _W(_g('salvRam', 2, 6000), _g('salvSkiff', 16, 700)),
                   _W(_g('salvCutter', 6, 2000), _g('salvRam', 1, 0), _g('salvSkiff', 18, 650)),
                   _W(_g('salvRam', 3, 5000), _g('salvCutter', 6, 1800), _g('salvSkiff', 20, 600)) ],
          materialRewards: { killDrops: _SALV_DROPS, completionBonus: { plasticScrap: 1, salvagedMetal: 2 } } },

        { id: 6, name: 'THE SIPHON', boss: true,
          description: 'Umbaji throws everything at the raft. Borga has a secret that might just turn it.',
          difficulty: 13, recommendedTowers: 8, hpScale: 1.45, baseHp: 18,
          path: _P([60, 0], [60, 140], [330, 140], [330, 40], [200, 40], [200, 280], [60, 280], [60, 380], [330, 380], [330, 418]),
          waves: [ _W(_g('salvSkiff', 18, 700), _g('salvCutter', 3, 2600)),
                   _W(_g('salvRam', 2, 5000), _g('salvSkiff', 16, 700)),
                   _W(_g('salvCutter', 8, 1600), _g('salvSkiff', 18, 600)),
                   _W(_g('salvRam', 4, 4000), _g('salvCutter', 6, 1800), _g('salvSkiff', 22, 550)) ],
          materialRewards: { killDrops: _SALV_DROPS, completionBonus: { plasticScrap: 5, salvagedMetal: 5 } } }
      ]
    },

    // ── STORY 2 — BORGA ───────────────────────────────────────────────────────
    {
      id: 3, name: 'STORY 2', short: 'Story 2', title: 'Borga',
      description: 'Expeditions, a starving crew, and a voice on the radio.',
      faction: 'SALV Collective · IOA',
      levels: [
        { id: 1, name: 'EXPEDITION', type: 'raid',
          description: 'Raid a SALV salvage yard for the metal the Mk II needs.',
          difficulty: 10, recommendedTowers: 8,
          path: _P([330, 0], [330, 110], [60, 110], [60, 230], [330, 230], [330, 350], [150, 350], [150, 418]),
          turrets: [ { x: 200, oy: 60, kind: 'gun' }, { x: 15, oy: 170, kind: 'salvo' }, { x: 200, oy: 175, kind: 'gun' },
                     { x: 375, oy: 290, kind: 'salvo' }, { x: 230, oy: 290, kind: 'gun' }, { x: 60, oy: 340, kind: 'heavy' } ],
          turretScale: 1.4,
          core: { hp: 520 },
          loot: { plasticScrap: 2, salvagedMetal: 2 } },

        { id: 2, name: 'THE STARVING', type: 'raid',
          description: 'A Salt Children reef. Something else is out there too.',
          difficulty: 11, recommendedTowers: 8,
          path: _P([40, 0], [40, 80], [200, 80], [200, 200], [40, 200], [40, 320], [350, 320], [350, 418]),
          turrets: [ { x: 120, oy: 30, kind: 'gun' }, { x: 260, oy: 140, kind: 'gun' }, { x: 120, oy: 140, kind: 'gun' },
                     { x: 120, oy: 260, kind: 'salvo' }, { x: 250, oy: 270, kind: 'gun' }, { x: 300, oy: 370, kind: 'heavy' } ],
          turretScale: 1.35,
          core: { hp: 560 },
          loot: { plasticScrap: 3, salvagedMetal: 4 } },

        { id: 3, name: 'SALV STRIKE', requires: ['s1-6'],
          description: 'The SALV hit back while your best are away.',
          difficulty: 14, recommendedTowers: 8, hpScale: 1.2, baseHp: 18,
          path: _P([350, 0], [350, 120], [40, 120], [40, 250], [260, 250], [260, 418]),
          waves: [ _W(_g('salvSkiff', 20, 650)),
                   _W(_g('salvCutter', 6, 2000), _g('salvSkiff', 16, 650)),
                   _W(_g('salvRam', 3, 4000), _g('salvCutter', 6, 1800)),
                   _W(_g('salvRam', 3, 3500), _g('salvCutter', 8, 1500), _g('salvSkiff', 24, 500)) ],
          materialRewards: { killDrops: _SALV_DROPS, completionBonus: { plasticScrap: 2, salvagedMetal: 3 } } },

        { id: 4, name: 'PAYBACK', type: 'raid',
          description: 'Umbaji keeps endangering your people. Hit his outpost.',
          difficulty: 15, recommendedTowers: 8,
          path: _P([195, 0], [195, 50], [350, 50], [350, 170], [40, 170], [40, 290], [350, 290], [350, 370], [195, 370], [195, 418]),
          turrets: [ { x: 280, oy: 10, kind: 'gun' }, { x: 260, oy: 110, kind: 'salvo' }, { x: 120, oy: 110, kind: 'gun' },
                     { x: 120, oy: 230, kind: 'salvo' }, { x: 280, oy: 230, kind: 'heavy' }, { x: 260, oy: 340, kind: 'salvo' },
                     { x: 100, oy: 360, kind: 'heavy' } ],
          turretScale: 1.3,
          core: { hp: 700 },
          loot: { plasticScrap: 2, salvagedMetal: 2 } },

        { id: 5, name: 'THE VOICE', requires: ['s3-2'],
          description: 'A voice on the radio asks you to end Umbaji. The SALV don’t wait for your answer.',
          difficulty: 16, recommendedTowers: 9, hpScale: 1.41, baseHp: 18,
          path: _P([40, 0], [40, 200], [195, 200], [195, 40], [350, 40], [350, 418]),
          waves: [ _W(_g('salvSkiff', 22, 600), _g('salvCutter', 4, 2200)),
                   _W(_g('salvRam', 3, 3500), _g('salvSkiff', 20, 600)),
                   _W(_g('salvCutter', 10, 1300), _g('salvRam', 2, 5000)),
                   _W(_g('salvRam', 5, 3000), _g('salvCutter', 8, 1400), _g('salvSkiff', 26, 450)) ],
          materialRewards: { killDrops: _SALV_DROPS, completionBonus: { plasticScrap: 2, salvagedMetal: 3 } } },
        { id: 6, name: 'PRESSURE', requires: ['s3-3'],
          description: 'You press the voice about Helix. The SALV press the raft.',
          difficulty: 17, recommendedTowers: 9, hpScale: 1.46, baseHp: 18,
          path: _P([350, 0], [350, 70], [120, 70], [120, 180], [300, 180], [300, 290], [60, 290], [60, 418]),
          waves: [ _W(_g('salvSkiff', 22, 550), _g('scrapRunner', 12, 700)),
                   _W(_g('salvCutter', 8, 1500), _g('saltChild', 20, 450)),
                   _W(_g('salvRam', 4, 3200), _g('salvSkiff', 20, 550), _g('bilgeRat', 18, 160)),
                   _W(_g('salvRam', 5, 2800), _g('salvCutter', 10, 1200), _g('salvSkiff', 26, 420)) ],
          materialRewards: { killDrops: _SALV_DROPS, completionBonus: { plasticScrap: 1, salvagedMetal: 2 } } },

        { id: 7, name: 'UMBAJI', boss: true,
          description: 'Umbaji sails his flagship at the raft. End the SALV raids for good.',
          difficulty: 19, recommendedTowers: 10, hpScale: 1.35, baseHp: 20,
          path: _P([40, 0], [40, 100], [350, 100], [350, 210], [40, 210], [40, 320], [350, 320], [350, 418]),
          waves: [ _W(_g('salvSkiff', 24, 500), _g('salvCutter', 6, 1800)),
                   _W(_g('salvRam', 4, 3000), _g('salvCutter', 8, 1400)),
                   _W(_g('salvCutter', 10, 1100), _g('salvSkiff', 28, 420), _g('salvRam', 3, 4000)),
                   _W(_g('umbajiFlagship', 1, 0), _g('salvCutter', 8, 2200), _g('salvRam', 2, 9000)) ],
          materialRewards: { killDrops: _SALV_DROPS, completionBonus: { plasticScrap: 1, salvagedMetal: 2 } } }
      ]
    },

    // ── STORY 3 — HELIX ───────────────────────────────────────────────────────
    {
      id: 4, name: 'STORY 3', short: 'Story 3', title: 'Helix',
      description: 'The Front keeps fleeing from the west. Something is driving them.',
      faction: 'Non-Continuous Front · Helix',
      levels: [
        { id: 1, name: 'ROGUE FRONT',
          description: 'A rogue Front crew has heard about the siphon.',
          difficulty: 14, recommendedTowers: 8, hpScale: 1.62, baseHp: 18,
          path: _P([195, 0], [195, 90], [40, 90], [40, 220], [350, 220], [350, 340], [120, 340], [120, 418]),
          waves: [ _W(_g('saltChild', 20, 600), _g('scrapRunner', 10, 900)),
                   _W(_g('driftwoodHulk', 3, 3500), _g('bilgeRat', 14, 200)),
                   _W(_g('scrapRunner', 16, 700), _g('driftwoodHulk', 3, 3000), _g('bilgeRat', 14, 200)),
                   _W(_g('frontCommander', 1, 0), _g('driftwoodHulk', 4, 2500), _g('saltChild', 20, 500)) ],
          materialRewards: { killDrops: _NCF_DROPS, completionBonus: { plasticScrap: 1, salvagedMetal: 2 } } },

        { id: 2, name: 'THE RADIO',
          description: 'An even stronger Front attack. Someone wants you to have something.',
          difficulty: 15, recommendedTowers: 8, hpScale: 1.41, baseHp: 18,
          path: _P([350, 0], [350, 300], [195, 300], [195, 80], [40, 80], [40, 418]),
          waves: [ _W(_g('saltChild', 24, 500), _g('bilgeRat', 16, 180)),
                   _W(_g('driftwoodHulk', 5, 2600), _g('scrapRunner', 16, 650)),
                   _W(_g('frontCommander', 1, 0), _g('bilgeRat', 20, 160), _g('scrapRunner', 14, 650)),
                   _W(_g('frontCommander', 2, 8000), _g('driftwoodHulk', 6, 2200), _g('saltChild', 24, 450), _g('bilgeRat', 20, 160)) ],
          materialRewards: { killDrops: _NCF_DROPS, completionBonus: { plasticScrap: 1, salvagedMetal: 2 } } },
        { id: 3, name: 'ONE WORD',
          description: 'Another Front crew running from the west. Take one alive.',
          difficulty: 16, recommendedTowers: 9, hpScale: 2.63, baseHp: 18,
          path: _P([60, 0], [60, 120], [330, 120], [330, 40], [195, 40], [195, 260], [330, 260], [330, 380], [60, 380], [60, 418]),
          waves: [ _W(_g('scrapRunner', 20, 550), _g('saltChild', 16, 500)),
                   _W(_g('driftwoodHulk', 5, 2400), _g('bilgeRat', 20, 150)),
                   _W(_g('frontCommander', 1, 0), _g('scrapRunner', 18, 550), _g('driftwoodHulk', 4, 2600)),
                   _W(_g('frontCommander', 2, 7000), _g('driftwoodHulk', 6, 2000), _g('bilgeRat', 24, 140), _g('scrapRunner', 16, 600)) ],
          materialRewards: { killDrops: _NCF_DROPS, completionBonus: { plasticScrap: 1, salvagedMetal: 2 } } },

        { id: 4, name: 'ADVANCE FORCE', boss: true,
          description: 'The fleeing Front, and what follows them.',
          difficulty: 18, recommendedTowers: 10, hpScale: 1.8, baseHp: 18,
          path: _P([195, 0], [195, 70], [350, 70], [350, 200], [195, 200], [195, 300], [40, 300], [40, 160], [110, 160], [110, 418]),
          waves: [ _W(_g('saltChild', 8, 1400), _g('scrapRunner', 5, 1800)),
                   _W(_g('helixDrone', 16, 650)),
                   _W(_g('helixTrooper', 8, 1600), _g('helixDrone', 16, 600)),
                   _W(_g('helixWarden', 2, 6000), _g('helixTrooper', 8, 1400), _g('helixDrone', 18, 500)),
                   _W(_g('helixSpearhead', 1, 0), _g('helixWarden', 2, 7000), _g('helixTrooper', 10, 1200), _g('helixDrone', 20, 450)) ],
          materialRewards: { killDrops: _HELIX_DROPS, completionBonus: { plasticScrap: 1, salvagedMetal: 2 } } }
      ]
    }
  ]
};
