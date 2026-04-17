// ── skillTree.js ─────────────────────────────────────────────────────────────
// Global SKILL_TREE data. Four branches × 15 nodes each = 60 nodes total.
// Effects are placeholder strings — wired up per feature phase.
// Node kinds: 'incremental' | 'significant' | 'gamechanger' | 'capstone'
// Cost tiers: T1=10, T2=25, T3=50, T4=100, T5=200

const SKILL_TREE = {
  branches: [

    // ── ARSENAL ───────────────────────────────────────────────────────────────
    {
      id:        'arsenal',
      name:      'ARSENAL',
      desc:      'Overclocked offensive systems',
      colour:    0xc43a3a,
      colourHex: '#c43a3a',
      nodes: [
        // T1
        { id: 'ARM_01', name: 'Sharp Eye',     tier: 1, col: 0, prereqs: [], cost: 10,  kind: 'incremental', effect: 'Gunner damage +10%.' },
        { id: 'ARM_02', name: 'Quick Mag',     tier: 1, col: 1, prereqs: [], cost: 10,  kind: 'incremental', effect: 'Gunner fires 10% faster.' },
        { id: 'ARM_03', name: 'Thick Slug',    tier: 1, col: 2, prereqs: [], cost: 10,  kind: 'incremental', effect: 'Barricade slow intensity +10%.' },
        // T2
        { id: 'ARM_04', name: 'Hollow Point',  tier: 2, col: 0, prereqs: ['ARM_01'], cost: 25,  kind: 'significant', effect: 'Gunner shots have a 20% chance to deal double damage.' },
        { id: 'ARM_05', name: 'Burst Fire',    tier: 2, col: 1, prereqs: ['ARM_02'], cost: 25,  kind: 'significant', effect: 'Gunner fires an extra shot per attack cycle.' },
        { id: 'ARM_06', name: 'Sticky Web',    tier: 2, col: 2, prereqs: ['ARM_03'], cost: 25,  kind: 'significant', effect: 'Barricade slow radius +25%.' },
        // T3
        { id: 'ARM_07', name: 'Armour Crack',  tier: 3, col: 0, prereqs: ['ARM_04'], cost: 50,  kind: 'significant', effect: 'All towers deal +15% extra damage to enemies above 50% HP.' },
        { id: 'ARM_08', name: 'Cluster Rounds',tier: 3, col: 1, prereqs: ['ARM_05'], cost: 50,  kind: 'significant', effect: 'Bomber splash radius +20%.' },
        { id: 'ARM_09', name: 'Snare Field',   tier: 3, col: 2, prereqs: ['ARM_06'], cost: 50,  kind: 'gamechanger', effect: 'Barricade deals 2 DPS burn damage to all enemies within its range.' },
        // T4
        { id: 'ARM_10', name: 'Shredder',      tier: 4, col: 0, prereqs: ['ARM_07'], cost: 100, kind: 'significant', effect: 'Gunner damage +20% additional.' },
        { id: 'ARM_11', name: 'Chain React',   tier: 4, col: 1, prereqs: ['ARM_08'], cost: 100, kind: 'gamechanger', effect: 'Bomber explosions chain to the nearest enemy within 60px.' },
        { id: 'ARM_12', name: 'Dead Zone',     tier: 4, col: 2, prereqs: ['ARM_09'], cost: 100, kind: 'significant', effect: 'Two overlapping barricade fields reduce enemy speed to near-zero.' },
        // T5
        { id: 'ARM_13', name: 'Overclocked',   tier: 5, col: 0, prereqs: ['ARM_10'], cost: 200, kind: 'capstone',    effect: 'All towers deal +25% damage permanently.' },
        { id: 'ARM_14', name: 'Minefield',     tier: 5, col: 1, prereqs: ['ARM_11'], cost: 200, kind: 'gamechanger', effect: 'Bombers leave a mine at their last hit position. Detonates on the next enemy to pass.' },
        { id: 'ARM_15', name: 'Suppression',   tier: 5, col: 2, prereqs: ['ARM_12'], cost: 200, kind: 'capstone',    effect: 'Any enemy inside a barricade field moves at 15% speed regardless of stacking.' },
      ]
    },

    // ── SUPPLY ────────────────────────────────────────────────────────────────
    {
      id:        'supply',
      name:      'SUPPLY',
      desc:      'Factory and resource efficiency',
      colour:    0x3a8fc4,
      colourHex: '#3a8fc4',
      nodes: [
        // T1
        { id: 'SUP_01', name: 'Fast Smelt',    tier: 1, col: 0, prereqs: [], cost: 10,  kind: 'incremental', effect: 'Smelter processes materials 15% faster.' },
        { id: 'SUP_02', name: 'Stock Cache',   tier: 1, col: 1, prereqs: [], cost: 10,  kind: 'incremental', effect: 'Start each combat level with +1 bonus part.' },
        { id: 'SUP_03', name: 'Scavenge',      tier: 1, col: 2, prereqs: [], cost: 10,  kind: 'incremental', effect: 'Enemy kills grant +10% more parts.' },
        // T2
        { id: 'SUP_04', name: 'Double Shift',  tier: 2, col: 0, prereqs: ['SUP_01'], cost: 25,  kind: 'significant', effect: 'All factory workers operate 20% faster.' },
        { id: 'SUP_05', name: 'War Chest',     tier: 2, col: 1, prereqs: ['SUP_02'], cost: 25,  kind: 'significant', effect: 'Parts cap per combat level +50%.' },
        { id: 'SUP_06', name: 'Scrap Magnet',  tier: 2, col: 2, prereqs: ['SUP_03'], cost: 25,  kind: 'significant', effect: 'Boss kills drop an additional 5 bonus parts.' },
        // T3
        { id: 'SUP_07', name: 'Assembly Line', tier: 3, col: 0, prereqs: ['SUP_04'], cost: 50,  kind: 'significant', effect: 'Assembly machines have a 50% chance to produce 2 towers instead of 1.' },
        { id: 'SUP_08', name: 'Overstocked',   tier: 3, col: 1, prereqs: ['SUP_05'], cost: 50,  kind: 'gamechanger', effect: 'Carry up to 3 unused towers from the previous level into the next.' },
        { id: 'SUP_09', name: 'Deep Salvage',  tier: 3, col: 2, prereqs: ['SUP_06'], cost: 50,  kind: 'significant', effect: 'Scavenging station produces +20% more raw material.' },
        // T4
        { id: 'SUP_10', name: 'Peak Output',   tier: 4, col: 0, prereqs: ['SUP_07'], cost: 100, kind: 'significant', effect: 'Factory runs automatically for 30 seconds after each wave clear.' },
        { id: 'SUP_11', name: 'Arsenal Reserve',tier:4, col: 1, prereqs: ['SUP_08'], cost: 100, kind: 'gamechanger', effect: 'Endless mode starts with double the normal tower loadout.' },
        { id: 'SUP_12', name: 'Reclaim',       tier: 4, col: 2, prereqs: ['SUP_09'], cost: 100, kind: 'significant', effect: 'Selling a tower in the Armoury returns 50% of its raw materials.' },
        // T5
        { id: 'SUP_13', name: 'Infinite Works',tier: 5, col: 0, prereqs: ['SUP_10'], cost: 200, kind: 'capstone',    effect: 'Factory produces all tower types at 2× speed permanently.' },
        { id: 'SUP_14', name: 'Deep Stores',   tier: 5, col: 1, prereqs: ['SUP_11'], cost: 200, kind: 'capstone',    effect: 'Tower stockpile cap raised to 20 of each type.' },
        { id: 'SUP_15', name: 'Full Reclaim',  tier: 5, col: 2, prereqs: ['SUP_12'], cost: 200, kind: 'gamechanger', effect: 'Selling a tower refunds 100% of materials AND grants 1 bonus Nut.' },
      ]
    },

    // ── NETWORK ───────────────────────────────────────────────────────────────
    {
      id:        'network',
      name:      'NETWORK',
      desc:      'Black market economy and gambling',
      colour:    0xe8a020,
      colourHex: '#e8a020',
      nodes: [
        // T1
        { id: 'NET_01', name: 'Gut Feel',      tier: 1, col: 0, prereqs: [], cost: 10,  kind: 'incremental', effect: 'Chrome merchant base luck stat +5%.' },
        { id: 'NET_02', name: 'Loaded Dice',   tier: 1, col: 1, prereqs: [], cost: 10,  kind: 'incremental', effect: 'Merchant fatigue resets 10% faster after each wave.' },
        { id: 'NET_03', name: 'Hot Streak',    tier: 1, col: 2, prereqs: [], cost: 10,  kind: 'incremental', effect: 'Winning 3 Bolts or more in a row grants 1 free roll.' },
        // T2
        { id: 'NET_04', name: 'House Favour',  tier: 2, col: 0, prereqs: ['NET_01'], cost: 25,  kind: 'significant', effect: 'Pity timer on Chrome triggers 2 rounds earlier.' },
        { id: 'NET_05', name: 'Stamina',       tier: 2, col: 1, prereqs: ['NET_02'], cost: 25,  kind: 'significant', effect: 'Fatigue penalties start after 8 rolls instead of 5.' },
        { id: 'NET_06', name: 'Momentum',      tier: 2, col: 2, prereqs: ['NET_03'], cost: 25,  kind: 'significant', effect: 'Each consecutive winning roll improves the next payout by 5%.' },
        // T3
        { id: 'NET_07', name: 'Jackpot Sense', tier: 3, col: 0, prereqs: ['NET_04'], cost: 50,  kind: 'gamechanger', effect: 'Screen pulses amber the roll before a jackpot spin on Chrome.' },
        { id: 'NET_08', name: 'Iron Will',     tier: 3, col: 1, prereqs: ['NET_05'], cost: 50,  kind: 'significant', effect: 'Roll cost increase from fatigue is halved.' },
        { id: 'NET_09', name: 'Double Down',   tier: 3, col: 2, prereqs: ['NET_06'], cost: 50,  kind: 'significant', effect: 'Option to bet 2× Nuts on any roll for 2× payout.' },
        // T4
        { id: 'NET_10', name: 'Lucky Break',   tier: 4, col: 0, prereqs: ['NET_07'], cost: 100, kind: 'gamechanger', effect: 'Once per session: a failed roll returns the roll cost in full.' },
        { id: 'NET_11', name: 'Second Wind',   tier: 4, col: 1, prereqs: ['NET_08'], cost: 100, kind: 'significant', effect: 'The first roll after each wave clear is always at base cost.' },
        { id: 'NET_12', name: 'All In',        tier: 4, col: 2, prereqs: ['NET_09'], cost: 100, kind: 'gamechanger', effect: 'Unlocks All-In mode: bet your entire Nut stack for a 5× payout chance.' },
        // T5
        { id: 'NET_13', name: 'Fortune',       tier: 5, col: 0, prereqs: ['NET_10'], cost: 200, kind: 'capstone',    effect: 'Bolt payouts across all merchants permanently +20%.' },
        { id: 'NET_14', name: 'Tireless',      tier: 5, col: 1, prereqs: ['NET_11'], cost: 200, kind: 'capstone',    effect: 'Merchants never reach maximum fatigue level.' },
        { id: 'NET_15', name: 'House Loses',   tier: 5, col: 2, prereqs: ['NET_12'], cost: 200, kind: 'capstone',    effect: 'House edge reduced from 30% to 15% across all merchants.' },
      ]
    },

    // ── FORTRESS ──────────────────────────────────────────────────────────────
    {
      id:        'fortress',
      name:      'FORTRESS',
      desc:      'Base defence and zone control',
      colour:    0x5eba7d,
      colourHex: '#5eba7d',
      nodes: [
        // T1
        { id: 'FOR_01', name: 'Thick Walls',   tier: 1, col: 0, prereqs: [], cost: 10,  kind: 'incremental', effect: 'Base maximum HP +10%.' },
        { id: 'FOR_02', name: 'Early Warning', tier: 1, col: 1, prereqs: [], cost: 10,  kind: 'incremental', effect: 'Wave countdown timer increased by 3 seconds.' },
        { id: 'FOR_03', name: 'Scrap Wall',    tier: 1, col: 2, prereqs: [], cost: 10,  kind: 'incremental', effect: 'Towers placed in boost zones gain +10% extra power multiplier.' },
        // T2
        { id: 'FOR_04', name: 'Blast Doors',   tier: 2, col: 0, prereqs: ['FOR_01'], cost: 25,  kind: 'significant', effect: 'Base takes 1 less damage per enemy hit (minimum 1).' },
        { id: 'FOR_05', name: 'Scout Drones',  tier: 2, col: 1, prereqs: ['FOR_02'], cost: 25,  kind: 'significant', effect: 'Enemies are briefly highlighted 2 seconds before the wave begins.' },
        { id: 'FOR_06', name: 'Fortified Line',tier: 2, col: 2, prereqs: ['FOR_03'], cost: 25,  kind: 'significant', effect: 'Towers in boost zones gain an additional +10% damage bonus.' },
        // T3
        { id: 'FOR_07', name: 'Iron Fortress', tier: 3, col: 0, prereqs: ['FOR_04'], cost: 50,  kind: 'gamechanger', effect: 'Once per level: survive a fatal hit with 1 HP instead of dying.' },
        { id: 'FOR_08', name: 'Overwatch',     tier: 3, col: 1, prereqs: ['FOR_05'], cost: 50,  kind: 'gamechanger', effect: 'The first enemy each wave takes double damage for 3 seconds.' },
        { id: 'FOR_09', name: 'Deep Roots',    tier: 3, col: 2, prereqs: ['FOR_06'], cost: 50,  kind: 'significant', effect: 'All power zone multipliers apply with an additional +5% bonus.' },
        // T4
        { id: 'FOR_10', name: 'Bulwark',       tier: 4, col: 0, prereqs: ['FOR_07'], cost: 100, kind: 'significant', effect: 'Base maximum HP +25% additional.' },
        { id: 'FOR_11', name: 'Killzone',      tier: 4, col: 1, prereqs: ['FOR_08'], cost: 100, kind: 'gamechanger', effect: 'Designate one 80px killzone per level that deals 3 DPS to all enemies inside.' },
        { id: 'FOR_12', name: 'Prime Position',tier: 4, col: 2, prereqs: ['FOR_09'], cost: 100, kind: 'significant', effect: 'Boost zone radius increased by 15%.' },
        // T5
        { id: 'FOR_13', name: 'Last Stand',    tier: 5, col: 0, prereqs: ['FOR_10'], cost: 200, kind: 'capstone',    effect: 'When base HP falls to 25% or below, all tower damage +30%.' },
        { id: 'FOR_14', name: 'Free Barricade',tier: 5, col: 1, prereqs: ['FOR_11'], cost: 200, kind: 'capstone',    effect: 'Each level begins with one barricade pre-placed at the base entrance for free.' },
        { id: 'FOR_15', name: 'Perfect Spot',  tier: 5, col: 2, prereqs: ['FOR_12'], cost: 200, kind: 'gamechanger', effect: 'Towers placed inside a boost zone receive double the power multiplier.' },
      ]
    }

  ]
};