// 4 branches, 15 nodes each = 60 total.
// Cost curve: Cost(n) = round(10 * n^1.6), using the node's tier position.
// Effects are placeholder strings for now — wired to combat/factory in later sessions.
// Node kinds: 'incremental' (small stat), 'significant' (meaningful spike),
// 'gamechanger' (new mechanic), 'capstone' (tree endpoint).

const SKILL_TREE = {
  branches: [
    // ── OVERCLOCKED ARSENAL ──────────────────────────────────────────────
    {
      id:       'arsenal',
      name:     'OVERCLOCKED ARSENAL',
      tag:      'TOWER COMBAT',
      colour:   0xc43a3a,
      colourHex:'#c43a3a',
      desc:     'Damage, range, fire rate.\nDominates boss fights.',
      nodes: [
        // Tier 1 — entry (2 nodes, no prereqs)
        { id: 'ars_01', tier: 1, col: 0, name: 'LIVE FIRE',        effect: '+5% GUNNER damage',      kind: 'incremental', cost: 10,  prereqs: [] },
        { id: 'ars_02', tier: 1, col: 2, name: 'LONG BARRELS',     effect: '+5% GUNNER range',       kind: 'incremental', cost: 10,  prereqs: [] },
        // Tier 2
        { id: 'ars_03', tier: 2, col: 0, name: 'RAPID CYCLING',    effect: '+8% GUNNER fire rate',   kind: 'incremental', cost: 30,  prereqs: ['ars_01'] },
        { id: 'ars_04', tier: 2, col: 1, name: 'DENSE SHRAPNEL',   effect: '+12% BOMBER damage',     kind: 'significant', cost: 30,  prereqs: ['ars_01', 'ars_02'] },
        { id: 'ars_05', tier: 2, col: 2, name: 'GUIDANCE CHIP',    effect: '+10% BOMBER splash',     kind: 'significant', cost: 30,  prereqs: ['ars_02'] },
        // Tier 3
        { id: 'ars_06', tier: 3, col: 0, name: 'CLUSTER ROUNDS',   effect: 'GUNNER hits pierce 2',   kind: 'gamechanger', cost: 52,  prereqs: ['ars_03'] },
        { id: 'ars_07', tier: 3, col: 1, name: 'HEAVY PLATING',    effect: '+15% tower HP',          kind: 'significant', cost: 52,  prereqs: ['ars_04'] },
        { id: 'ars_08', tier: 3, col: 2, name: 'FLAK ROUNDS',      effect: 'BOMBER ignores armour',  kind: 'gamechanger', cost: 52,  prereqs: ['ars_05'] },
        // Tier 4
        { id: 'ars_09', tier: 4, col: 0, name: 'LIVE WIRE',        effect: '+10% all tower damage',  kind: 'significant', cost: 76,  prereqs: ['ars_06', 'ars_07'] },
        { id: 'ars_10', tier: 4, col: 2, name: 'COOLING LOOP',     effect: '+10% all fire rate',     kind: 'significant', cost: 76,  prereqs: ['ars_07', 'ars_08'] },
        // Tier 5
        { id: 'ars_11', tier: 5, col: 0, name: 'SPOTTER DRONE',    effect: '+8% range all towers',   kind: 'incremental', cost: 103, prereqs: ['ars_09'] },
        { id: 'ars_12', tier: 5, col: 1, name: 'CHAIN LIGHTNING',  effect: 'GUNNER hits bounce 1x',  kind: 'gamechanger', cost: 103, prereqs: ['ars_09', 'ars_10'] },
        { id: 'ars_13', tier: 5, col: 2, name: 'VOLATILE CORE',    effect: 'BOMBER splash +25%',     kind: 'significant', cost: 103, prereqs: ['ars_10'] },
        // Tier 6
        { id: 'ars_14', tier: 6, col: 1, name: 'SINGULARITY CORE', effect: 'Adjacent towers +15%',   kind: 'gamechanger', cost: 133, prereqs: ['ars_12'] },
        // Tier 7 — capstone
        { id: 'ars_15', tier: 7, col: 1, name: 'OVERLOAD',         effect: 'Final wave: +50% dmg',   kind: 'capstone',    cost: 167, prereqs: ['ars_14'] }
      ]
    },

    // ── SUPPLY CHAIN MASTERY ─────────────────────────────────────────────
    {
      id:       'supply',
      name:     'SUPPLY CHAIN MASTERY',
      tag:      'FACTORY / PRODUCTION',
      colour:   0x3a8fc4,
      colourHex:'#3a8fc4',
      desc:     'Production throughput.\nDominates long levels.',
      nodes: [
        { id: 'sup_01', tier: 1, col: 0, name: 'FAST HANDS',        effect: '+5% worker speed',        kind: 'incremental', cost: 10,  prereqs: [] },
        { id: 'sup_02', tier: 1, col: 2, name: 'TIGHT LOOPS',       effect: '-5% scrap consumption',   kind: 'incremental', cost: 10,  prereqs: [] },
        { id: 'sup_03', tier: 2, col: 0, name: 'LONG SHIFTS',       effect: '+10% worker speed',       kind: 'significant', cost: 30,  prereqs: ['sup_01'] },
        { id: 'sup_04', tier: 2, col: 1, name: 'SMELTER TUNING',    effect: 'Smelter 15% faster',      kind: 'significant', cost: 30,  prereqs: ['sup_01', 'sup_02'] },
        { id: 'sup_05', tier: 2, col: 2, name: 'STOCK MGMT',        effect: '-10% metal cost',         kind: 'significant', cost: 30,  prereqs: ['sup_02'] },
        { id: 'sup_06', tier: 3, col: 0, name: 'PARALLEL WORK',     effect: 'Workers skip idle ticks', kind: 'gamechanger', cost: 52,  prereqs: ['sup_03'] },
        { id: 'sup_07', tier: 3, col: 1, name: 'BULK ASSEMBLY',     effect: '+1 tower per craft',      kind: 'gamechanger', cost: 52,  prereqs: ['sup_04'] },
        { id: 'sup_08', tier: 3, col: 2, name: 'EFFICIENCY',        effect: '+20% conveyor speed',     kind: 'significant', cost: 52,  prereqs: ['sup_05'] },
        { id: 'sup_09', tier: 4, col: 0, name: 'AUTO-FEED',         effect: 'Smelter auto-pulls',      kind: 'gamechanger', cost: 76,  prereqs: ['sup_06', 'sup_07'] },
        { id: 'sup_10', tier: 4, col: 2, name: 'PRECISE CUTS',      effect: '-15% all material cost',  kind: 'significant', cost: 76,  prereqs: ['sup_07', 'sup_08'] },
        { id: 'sup_11', tier: 5, col: 0, name: 'NIGHT SHIFT',       effect: '+15% overall output',     kind: 'significant', cost: 103, prereqs: ['sup_09'] },
        { id: 'sup_12', tier: 5, col: 1, name: 'AUTO-ASSEMBLER',    effect: 'Auto-craft GUNNER',       kind: 'gamechanger', cost: 103, prereqs: ['sup_09', 'sup_10'] },
        { id: 'sup_13', tier: 5, col: 2, name: 'MATERIAL DRIFT',    effect: 'Scraps regen passively',  kind: 'gamechanger', cost: 103, prereqs: ['sup_10'] },
        { id: 'sup_14', tier: 6, col: 1, name: 'BLUEPRINT SYS',     effect: 'Save 2 factory presets',  kind: 'gamechanger', cost: 133, prereqs: ['sup_12'] },
        { id: 'sup_15', tier: 7, col: 1, name: 'INDUSTRIAL SCALE',  effect: '2x production cap',       kind: 'capstone',    cost: 167, prereqs: ['sup_14'] }
      ]
    },

    // ── BLACK MARKET NETWORK ─────────────────────────────────────────────
    {
      id:       'market',
      name:     'BLACK MARKET NETWORK',
      tag:      'ECONOMY / GAMBLING',
      colour:   0xe8a020,
      colourHex:'#e8a020',
      desc:     'Nut & Bolt rates, merchant odds.\nCompounding long-term returns.',
      nodes: [
        { id: 'mkt_01', tier: 1, col: 0, name: 'HAGGLER',          effect: '+1 Nut per tower sold',     kind: 'incremental', cost: 10,  prereqs: [] },
        { id: 'mkt_02', tier: 1, col: 2, name: 'SLEIGHT',          effect: '-5% Chrome fatigue',        kind: 'incremental', cost: 10,  prereqs: [] },
        { id: 'mkt_03', tier: 2, col: 0, name: 'SCRAP KING',       effect: '+10% Nut value',            kind: 'significant', cost: 30,  prereqs: ['mkt_01'] },
        { id: 'mkt_04', tier: 2, col: 1, name: 'LOADED DICE',      effect: '+5% all merchant odds',     kind: 'significant', cost: 30,  prereqs: ['mkt_01', 'mkt_02'] },
        { id: 'mkt_05', tier: 2, col: 2, name: 'FRESH STOCK',      effect: '-8% all fatigue',           kind: 'significant', cost: 30,  prereqs: ['mkt_02'] },
        { id: 'mkt_06', tier: 3, col: 0, name: 'NUT JAR+',         effect: 'Nut cap +250',              kind: 'significant', cost: 52,  prereqs: ['mkt_03'] },
        { id: 'mkt_07', tier: 3, col: 1, name: 'PITY CIRCUIT',     effect: 'Pity timer -2 spins',       kind: 'gamechanger', cost: 52,  prereqs: ['mkt_04'] },
        { id: 'mkt_08', tier: 3, col: 2, name: 'HOUSE RULES',      effect: 'Free first roll per wave',  kind: 'gamechanger', cost: 52,  prereqs: ['mkt_05'] },
        { id: 'mkt_09', tier: 4, col: 0, name: 'DOUBLE-DIP',       effect: 'Sell buyback window 5s',    kind: 'significant', cost: 76,  prereqs: ['mkt_06', 'mkt_07'] },
        { id: 'mkt_10', tier: 4, col: 2, name: 'GILDED TAP',       effect: '+10% all Bolt wins',        kind: 'significant', cost: 76,  prereqs: ['mkt_07', 'mkt_08'] },
        { id: 'mkt_11', tier: 5, col: 0, name: 'NUT JAR++',        effect: 'Nut cap +500',              kind: 'significant', cost: 103, prereqs: ['mkt_09'] },
        { id: 'mkt_12', tier: 5, col: 1, name: 'WEIGHTED REELS',   effect: 'Chrome jackpot +50%',       kind: 'gamechanger', cost: 103, prereqs: ['mkt_09', 'mkt_10'] },
        { id: 'mkt_13', tier: 5, col: 2, name: 'INSURANCE',        effect: 'Refund 20% on bust',        kind: 'gamechanger', cost: 103, prereqs: ['mkt_10'] },
        { id: 'mkt_14', tier: 6, col: 1, name: 'CRYPTO MINING',    effect: '+1 Bolt per wave won',      kind: 'gamechanger', cost: 133, prereqs: ['mkt_12'] },
        { id: 'mkt_15', tier: 7, col: 1, name: 'KING OF KINGS',    effect: '+25% all merchant payouts', kind: 'capstone',    cost: 167, prereqs: ['mkt_14'] }
      ]
    },

    // ── FORTIFICATION PROTOCOL ───────────────────────────────────────────
    {
      id:       'fortify',
      name:     'FORTIFICATION PROTOCOL',
      tag:      'BASE DEFENCE',
      colour:   0x5eba7d,
      colourHex:'#5eba7d',
      desc:     'Base HP, repair, barriers.\nThe safety net branch.',
      nodes: [
        { id: 'frt_01', tier: 1, col: 0, name: 'SANDBAGS',         effect: '+1 base HP',                kind: 'incremental', cost: 10,  prereqs: [] },
        { id: 'frt_02', tier: 1, col: 2, name: 'SCRAP WALLS',      effect: '+5% barricade range',       kind: 'incremental', cost: 10,  prereqs: [] },
        { id: 'frt_03', tier: 2, col: 0, name: 'STEEL PLATING',    effect: '+2 base HP',                kind: 'significant', cost: 30,  prereqs: ['frt_01'] },
        { id: 'frt_04', tier: 2, col: 1, name: 'DEEPER FIELD',     effect: 'Barricade slow -0.05',      kind: 'significant', cost: 30,  prereqs: ['frt_01', 'frt_02'] },
        { id: 'frt_05', tier: 2, col: 2, name: 'BUTTRESS',         effect: '+8% barricade range',       kind: 'significant', cost: 30,  prereqs: ['frt_02'] },
        { id: 'frt_06', tier: 3, col: 0, name: 'REINFORCED',       effect: '+3 base HP',                kind: 'significant', cost: 52,  prereqs: ['frt_03'] },
        { id: 'frt_07', tier: 3, col: 1, name: 'FIELD GENERATOR',  effect: 'Barricades stack 1.5x',     kind: 'gamechanger', cost: 52,  prereqs: ['frt_04'] },
        { id: 'frt_08', tier: 3, col: 2, name: 'WIDE NET',         effect: '+12% barricade range',      kind: 'significant', cost: 52,  prereqs: ['frt_05'] },
        { id: 'frt_09', tier: 4, col: 0, name: 'AUTO-REPAIR',      effect: 'Regen 1 HP per wave',       kind: 'gamechanger', cost: 76,  prereqs: ['frt_06', 'frt_07'] },
        { id: 'frt_10', tier: 4, col: 2, name: 'FIRST RESPONDER',  effect: 'Restore 2 HP per level',    kind: 'significant', cost: 76,  prereqs: ['frt_07', 'frt_08'] },
        { id: 'frt_11', tier: 5, col: 0, name: 'BULWARK',          effect: '+5 base HP',                kind: 'significant', cost: 103, prereqs: ['frt_09'] },
        { id: 'frt_12', tier: 5, col: 1, name: 'QUANTUM FIREWALL', effect: 'Immune first hit per wave', kind: 'gamechanger', cost: 103, prereqs: ['frt_09', 'frt_10'] },
        { id: 'frt_13', tier: 5, col: 2, name: 'WARDING CIRCLE',   effect: 'Enemies near base -10%',    kind: 'gamechanger', cost: 103, prereqs: ['frt_10'] },
        { id: 'frt_14', tier: 6, col: 1, name: 'LAST STAND',       effect: 'At 1 HP: towers +40%',      kind: 'gamechanger', cost: 133, prereqs: ['frt_12'] },
        { id: 'frt_15', tier: 7, col: 1, name: 'SOVEREIGN',        effect: '+50% base HP',              kind: 'capstone',    cost: 167, prereqs: ['frt_14'] }
      ]
    }
  ]
};
