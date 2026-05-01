// ── skillTree.js ─────────────────────────────────────────────────────────────
// Global SKILL_TREE data. Six branches × 11 nodes each = 66 nodes total.
// Maps to the GDD: Factory · Gambling · Combat · Economy · Base · Pirate.
//
// Node IDs follow the convention: <BRANCH>_NN (e.g. FAC_07, GAM_03).
// Cost tiers:  T1=10  T2=25  T3=50  T4=100  T5=200
// Node kinds: 'incremental' | 'significant' | 'gamechanger' | 'capstone'
//
// Each node has two effect fields:
//   effect    — string. Human-readable. Read by SkillTreeScene to render the
//               node-detail panel. Keep these concrete with numbers.
//   mechanic  — object. { type, value }. Read by SkillTreeEffects.js to apply
//               the node's actual game-state changes.
//
// Layout per branch:
//   T1 (col 1)         — gateway, must be purchased before the rest unlocks
//   T2 (col 0, 1, 2)   — three parallel paths begin here
//   T3 (col 0, 1, 2)   — depth in each path
//   T4 (col 0, 1, 2)   — gamechangers
//   T5 (col 1)         — capstone

const SKILL_TREE = {
  branches: [

    // ── FACTORY ──────────────────────────────────────────────────────────────
    // Production speed, automation, worker capability.
    // Col 0 = processing speed   Col 1 = automation   Col 2 = worker capability
    {
      id:        'factory',
      name:      'FACTORY',
      desc:      'Production speed and automation',
      colour:    0x3a8fc4,
      colourHex: '#3a8fc4',
      nodes: [
        // T1 — gateway
        { id: 'FAC_01', name: 'Production Line', tier: 1, col: 1, prereqs: [],         cost: 10,  kind: 'significant',
          effect:   'Gateway. Unlocks the Factory branch. All machines run 5% faster.',
          mechanic: { type: 'machine_speed', value: 0.95 } },

        // T2
        { id: 'FAC_02', name: 'Fast Smelt',     tier: 2, col: 0, prereqs: ['FAC_01'], cost: 25,  kind: 'incremental',
          effect:   'Smelters and processors run 15% faster.',
          mechanic: { type: 'machine_speed_smelter', value: 0.85 } },
        { id: 'FAC_03', name: 'Steady Hands',   tier: 2, col: 1, prereqs: ['FAC_01'], cost: 25,  kind: 'incremental',
          effect:   'Assembly machines run 10% faster.',
          mechanic: { type: 'machine_speed_assembly', value: 0.90 } },
        { id: 'FAC_04', name: 'Strong Backs',   tier: 2, col: 2, prereqs: ['FAC_01'], cost: 25,  kind: 'incremental',
          effect:   'Workers carry materials 15% faster.',
          mechanic: { type: 'worker_speed', value: 1.15 } },

        // T3
        { id: 'FAC_05', name: 'Refined Process',tier: 3, col: 0, prereqs: ['FAC_02'], cost: 50,  kind: 'significant',
          effect:   'All machines run an additional 15% faster (stacks).',
          mechanic: { type: 'machine_speed', value: 0.85 } },
        { id: 'FAC_06', name: 'Conveyor Stub',  tier: 3, col: 1, prereqs: ['FAC_03'], cost: 50,  kind: 'significant',
          effect:   'Unlocks Tier 1 conveyor belts. Place them between machines to remove worker steps.',
          mechanic: { type: 'unlock_conveyor', value: 1 } },
        { id: 'FAC_07', name: 'Apprentice',     tier: 3, col: 2, prereqs: ['FAC_04'], cost: 50,  kind: 'significant',
          effect:   'Workers handle Tier 2 materials at full speed (no weight slowdown).',
          mechanic: { type: 'worker_tier', value: 2 } },

        // T4
        { id: 'FAC_08', name: 'Peak Throughput',tier: 4, col: 0, prereqs: ['FAC_05'], cost: 100, kind: 'significant',
          effect:   'Storage drums hold 50% more material before bottlenecking.',
          mechanic: { type: 'storage_capacity', value: 1.50 } },
        { id: 'FAC_09', name: 'Partial Auto',   tier: 4, col: 1, prereqs: ['FAC_06'], cost: 100, kind: 'gamechanger',
          effect:   'Game-changer. Conveyor lines run during waves (T1 and T2 materials only).',
          mechanic: { type: 'automation_level', value: 1 } },
        { id: 'FAC_10', name: 'Heavy Hauler',   tier: 4, col: 2, prereqs: ['FAC_07'], cost: 100, kind: 'significant',
          effect:   'Workers can carry T4 materials (Helix Conduit Wire, MIL-Certified Chips).',
          mechanic: { type: 'worker_tier', value: 4 } },

        // T5 — capstone
        { id: 'FAC_11', name: 'Full Automation',tier: 5, col: 1, prereqs: ['FAC_09'], cost: 200, kind: 'capstone',
          effect:   'Capstone. All conveyor lines run continuously. The factory never freezes.',
          mechanic: { type: 'automation_level', value: 2 } }
      ]
    },

    // ── GAMBLING ─────────────────────────────────────────────────────────────
    // Merchant luck, payouts, house edge. Col-per-merchant: Chrome, DoubleDown, Ricochet.
    // Col 0 = Chrome   Col 1 = DoubleDown   Col 2 = Ricochet
    {
      id:        'gambling',
      name:      'GAMBLING',
      desc:      'Merchant odds and payouts',
      colour:    0xe8a020,
      colourHex: '#e8a020',
      nodes: [
        // T1 — gateway
        { id: 'GAM_01', name: 'Card Counter',   tier: 1, col: 1, prereqs: [],         cost: 10,  kind: 'significant',
          effect:   'Gateway. Unlocks the Gambling branch. Base luck stat +5% on every merchant.',
          mechanic: { type: 'merchant_luck', value: 0.05, target: 'all' } },

        // T2
        { id: 'GAM_02', name: 'Gut Feel',       tier: 2, col: 0, prereqs: ['GAM_01'], cost: 25,  kind: 'incremental',
          effect:   'Chrome merchant base luck stat +10%.',
          mechanic: { type: 'merchant_luck', value: 0.10, target: 'chrome' } },
        { id: 'GAM_03', name: 'Stamina',        tier: 2, col: 1, prereqs: ['GAM_01'], cost: 25,  kind: 'incremental',
          effect:   'DoubleDown fatigue penalties start after 8 rolls instead of 5.',
          mechanic: { type: 'merchant_fatigue_threshold', value: 3, target: 'doubledown' } },
        { id: 'GAM_04', name: 'Ricochet Aim',   tier: 2, col: 2, prereqs: ['GAM_01'], cost: 25,  kind: 'incremental',
          effect:   'Ricochet bounces favour higher-payout slots by 10%.',
          mechanic: { type: 'merchant_luck', value: 0.10, target: 'ricochet' } },

        // T3
        { id: 'GAM_05', name: 'Jackpot Sense',  tier: 3, col: 0, prereqs: ['GAM_02'], cost: 50,  kind: 'gamechanger',
          effect:   'Game-changer. Chrome screen pulses amber the roll before a jackpot spin.',
          mechanic: { type: 'merchant_jackpot_tell', value: true, target: 'chrome' } },
        { id: 'GAM_06', name: 'Iron Will',      tier: 3, col: 1, prereqs: ['GAM_03'], cost: 50,  kind: 'significant',
          effect:   'DoubleDown roll cost increases from fatigue are halved.',
          mechanic: { type: 'merchant_fatigue_cost', value: 0.50, target: 'doubledown' } },
        { id: 'GAM_07', name: 'Lucky Bounce',   tier: 3, col: 2, prereqs: ['GAM_04'], cost: 50,  kind: 'gamechanger',
          effect:   'Game-changer. Ricochet auto-redirects 10% of misses into a winning slot.',
          mechanic: { type: 'merchant_redirect', value: 0.10, target: 'ricochet' } },

        // T4
        { id: 'GAM_08', name: 'Chrome Fortune', tier: 4, col: 0, prereqs: ['GAM_05'], cost: 100, kind: 'significant',
          effect:   'Chrome payouts permanently +20%.',
          mechanic: { type: 'merchant_payout', value: 0.20, target: 'chrome' } },
        { id: 'GAM_09', name: 'All In',         tier: 4, col: 1, prereqs: ['GAM_06'], cost: 100, kind: 'gamechanger',
          effect:   'Game-changer. Unlocks All-In mode on DoubleDown: bet your entire Nut stack for a 5× payout chance.',
          mechanic: { type: 'merchant_all_in', value: true, target: 'doubledown' } },
        { id: 'GAM_10', name: 'Plinko Master',  tier: 4, col: 2, prereqs: ['GAM_07'], cost: 100, kind: 'significant',
          effect:   'Ricochet payouts permanently +20%.',
          mechanic: { type: 'merchant_payout', value: 0.20, target: 'ricochet' } },

        // T5 — capstone
        { id: 'GAM_11', name: 'House Loses',    tier: 5, col: 1, prereqs: ['GAM_09'], cost: 200, kind: 'capstone',
          effect:   'Capstone. House edge cut from 30% to 15% across all three merchants.',
          mechanic: { type: 'merchant_house_edge', value: 0.50, target: 'all' } }
      ]
    },

    // ── COMBAT ───────────────────────────────────────────────────────────────
    // Tower bonuses, parts economy, wave-management edges.
    // Col 0 = tower power   Col 1 = parts economy   Col 2 = wave / strategic
    {
      id:        'combat',
      name:      'COMBAT',
      desc:      'Tower bonuses and parts economy',
      colour:    0xc43a3a,
      colourHex: '#c43a3a',
      nodes: [
        // T1 — gateway
        { id: 'COM_01', name: 'Field Manual',   tier: 1, col: 1, prereqs: [],         cost: 10,  kind: 'significant',
          effect:   'Gateway. Unlocks the Combat branch. All towers fire 5% faster.',
          mechanic: { type: 'tower_fire_rate', value: 1.05 } },

        // T2
        { id: 'COM_02', name: 'Sharp Eye',      tier: 2, col: 0, prereqs: ['COM_01'], cost: 25,  kind: 'incremental',
          effect:   'Gunner damage +10%.',
          mechanic: { type: 'archetype_damage', value: 0.10, target: 'gunner' } },
        { id: 'COM_03', name: 'Scavenge',       tier: 2, col: 1, prereqs: ['COM_01'], cost: 25,  kind: 'incremental',
          effect:   'Enemy kills grant 10% more Parts.',
          mechanic: { type: 'parts_drop_multiplier', value: 1.10 } },
        { id: 'COM_04', name: 'Early Warning',  tier: 2, col: 2, prereqs: ['COM_01'], cost: 25,  kind: 'incremental',
          effect:   'Wave countdown timer increased by 3 seconds.',
          mechanic: { type: 'wave_warning_bonus', value: 3 } },

        // T3
        { id: 'COM_05', name: 'Hollow Point',   tier: 3, col: 0, prereqs: ['COM_02'], cost: 50,  kind: 'significant',
          effect:   'Gunner shots have a 20% chance to deal double damage.',
          mechanic: { type: 'archetype_crit', value: 0.20, target: 'gunner' } },
        { id: 'COM_06', name: 'Stock Cache',    tier: 3, col: 1, prereqs: ['COM_03'], cost: 50,  kind: 'significant',
          effect:   'Start each combat level with +1 bonus Part.',
          mechanic: { type: 'parts_starting_bonus', value: 1 } },
        { id: 'COM_07', name: 'Mark Target',    tier: 3, col: 2, prereqs: ['COM_04'], cost: 50,  kind: 'gamechanger',
          effect:   'Game-changer. The first enemy hit each wave takes 2× damage for 3 seconds.',
          mechanic: { type: 'mark_target', value: { multiplier: 2, duration: 3 } } },

        // T4
        { id: 'COM_08', name: 'Cluster Rounds', tier: 4, col: 0, prereqs: ['COM_05'], cost: 100, kind: 'significant',
          effect:   'Bomber splash radius +25%.',
          mechanic: { type: 'archetype_splash', value: 0.25, target: 'bomber' } },
        { id: 'COM_09', name: 'Scrap Magnet',   tier: 4, col: 1, prereqs: ['COM_06'], cost: 100, kind: 'gamechanger',
          effect:   'Game-changer. Boss kills drop an additional 5 bonus Parts. Elite kills drop +2.',
          mechanic: { type: 'elite_drops', value: { boss: 5, elite: 2 } } },
        { id: 'COM_10', name: 'Suppression',    tier: 4, col: 2, prereqs: ['COM_07'], cost: 100, kind: 'significant',
          effect:   'Barricades slow enemies in their range by an additional 15%.',
          mechanic: { type: 'archetype_slow', value: 0.15, target: 'barricade' } },

        // T5 — capstone
        { id: 'COM_11', name: 'Overclocked',    tier: 5, col: 1, prereqs: ['COM_09'], cost: 200, kind: 'capstone',
          effect:   'Capstone. All towers deal +20% damage permanently across every level.',
          mechanic: { type: 'tower_damage', value: 1.20 } }
      ]
    },

    // ── ECONOMY ──────────────────────────────────────────────────────────────
    // Material handling, sell prices, Nuts income.
    // Col 0 = sell prices / Nuts   Col 1 = material drops / quality   Col 2 = bulk operations
    {
      id:        'economy',
      name:      'ECONOMY',
      desc:      'Materials, prices, and Nuts',
      colour:    0xb78a3a,
      colourHex: '#b78a3a',
      nodes: [
        // T1 — gateway
        { id: 'ECO_01', name: 'Market Knowledge', tier: 1, col: 1, prereqs: [],         cost: 10,  kind: 'significant',
          effect:   'Gateway. Unlocks the Economy branch. Selling towers grants 10% more Nuts.',
          mechanic: { type: 'sell_price_multiplier', value: 1.10 } },

        // T2
        { id: 'ECO_02', name: 'Sharp Trader',  tier: 2, col: 0, prereqs: ['ECO_01'], cost: 25,  kind: 'incremental',
          effect:   'Selling towers grants an additional 20% Nuts (stacks).',
          mechanic: { type: 'sell_price_multiplier', value: 1.20 } },
        { id: 'ECO_03', name: 'Eye for Quality',tier: 2, col: 1, prereqs: ['ECO_01'], cost: 25,  kind: 'incremental',
          effect:   '10% chance to find an extra material with each pickup.',
          mechanic: { type: 'material_drop_multiplier', value: 1.10 } },
        { id: 'ECO_04', name: 'Bargain Hunter', tier: 2, col: 2, prereqs: ['ECO_01'], cost: 25,  kind: 'incremental',
          effect:   'Machine build costs reduced by 10%.',
          mechanic: { type: 'machine_cost_multiplier', value: 0.90 } },

        // T3
        { id: 'ECO_05', name: 'Black Market',  tier: 3, col: 0, prereqs: ['ECO_02'], cost: 50,  kind: 'gamechanger',
          effect:   'Game-changer. Unlocks the Black Market Contact — purchase rare materials directly with Nuts.',
          mechanic: { type: 'unlock_black_market', value: true } },
        { id: 'ECO_06', name: 'Refined Eye',   tier: 3, col: 1, prereqs: ['ECO_03'], cost: 50,  kind: 'significant',
          effect:   '15% chance for material drops to be one tier higher than expected.',
          mechanic: { type: 'material_quality_chance', value: 0.15 } },
        { id: 'ECO_07', name: 'Mass Production',tier: 3, col: 2, prereqs: ['ECO_04'], cost: 50,  kind: 'significant',
          effect:   'Building 3 or more of the same machine: each additional one is 25% off.',
          mechanic: { type: 'machine_bulk_discount', value: 0.25 } },

        // T4
        { id: 'ECO_08', name: 'Premium Goods', tier: 4, col: 0, prereqs: ['ECO_05'], cost: 100, kind: 'significant',
          effect:   'All sell prices +30% on top of existing bonuses.',
          mechanic: { type: 'sell_price_multiplier', value: 1.30 } },
        { id: 'ECO_09', name: 'Salvage Ops',   tier: 4, col: 1, prereqs: ['ECO_06'], cost: 100, kind: 'gamechanger',
          effect:   'Game-changer. Selling a tower returns 50% of its raw materials in addition to Nuts.',
          mechanic: { type: 'sell_material_refund', value: 0.50 } },
        { id: 'ECO_10', name: 'Bulk Trading',  tier: 4, col: 2, prereqs: ['ECO_07'], cost: 100, kind: 'significant',
          effect:   'Selling 3 or more towers in one transaction: each tower gives +30% Nuts.',
          mechanic: { type: 'bulk_sell_bonus', value: 0.30 } },

        // T5 — capstone
        { id: 'ECO_11', name: 'Market Tycoon', tier: 5, col: 1, prereqs: ['ECO_09'], cost: 200, kind: 'capstone',
          effect:   'Capstone. All Nuts income permanently doubled.',
          mechanic: { type: 'nuts_multiplier', value: 2.0 } }
      ]
    },

    // ── BASE ─────────────────────────────────────────────────────────────────
    // Factory grid expansion, power infrastructure, base defence.
    // Col 0 = grid expansion   Col 1 = power infrastructure   Col 2 = base defence
    {
      id:        'base',
      name:      'BASE',
      desc:      'Island expansion and power',
      colour:    0x5eba7d,
      colourHex: '#5eba7d',
      nodes: [
        // T1 — gateway
        { id: 'BAS_01', name: 'Island Survey',  tier: 1, col: 1, prereqs: [],         cost: 10,  kind: 'significant',
          effect:   'Gateway. Unlocks the Base branch. Base maximum HP +5%.',
          mechanic: { type: 'base_hp_multiplier', value: 1.05 } },

        // T2
        { id: 'BAS_02', name: 'Grid Plus I',    tier: 2, col: 0, prereqs: ['BAS_01'], cost: 25,  kind: 'significant',
          effect:   'Factory grid expands to 3×4. One extra row of placeable tiles.',
          mechanic: { type: 'factory_grid', value: { rows: 3, cols: 4 } } },
        { id: 'BAS_03', name: 'Cable Tap',      tier: 2, col: 1, prereqs: ['BAS_01'], cost: 25,  kind: 'incremental',
          effect:   'Underwater Cable Siphon power output +20%.',
          mechanic: { type: 'power_capacity', value: 20 } },
        { id: 'BAS_04', name: 'Thick Walls',    tier: 2, col: 2, prereqs: ['BAS_01'], cost: 25,  kind: 'incremental',
          effect:   'Base maximum HP +15%.',
          mechanic: { type: 'base_hp_multiplier', value: 1.15 } },

        // T3
        { id: 'BAS_05', name: 'Grid Plus II',   tier: 3, col: 0, prereqs: ['BAS_02'], cost: 50,  kind: 'significant',
          effect:   'Factory grid expands to 4×4.',
          mechanic: { type: 'factory_grid', value: { rows: 4, cols: 4 } } },
        { id: 'BAS_06', name: 'Recycling Plant',tier: 3, col: 1, prereqs: ['BAS_03'], cost: 50,  kind: 'gamechanger',
          effect:   'Game-changer. Unlocks the Plastic Recycling Plant zone. Output scales with factory waste.',
          mechanic: { type: 'unlock_zone', value: 'recycling_plant' } },
        { id: 'BAS_07', name: 'Blast Doors',    tier: 3, col: 2, prereqs: ['BAS_04'], cost: 50,  kind: 'significant',
          effect:   'Base takes 1 less damage per enemy hit (minimum 1).',
          mechanic: { type: 'base_damage_reduction', value: 1 } },

        // T4
        { id: 'BAS_08', name: 'Grid Plus III',  tier: 4, col: 0, prereqs: ['BAS_05'], cost: 100, kind: 'significant',
          effect:   'Factory grid expands to 4×5.',
          mechanic: { type: 'factory_grid', value: { rows: 4, cols: 5 } } },
        { id: 'BAS_09', name: 'Wind Turbines',  tier: 4, col: 1, prereqs: ['BAS_06'], cost: 100, kind: 'gamechanger',
          effect:   'Game-changer. Unlocks Offshore Wind Turbines as a separate map. Major power boost between maintenance missions.',
          mechanic: { type: 'unlock_zone', value: 'wind_turbines' } },
        { id: 'BAS_10', name: 'Iron Fortress',  tier: 4, col: 2, prereqs: ['BAS_07'], cost: 100, kind: 'gamechanger',
          effect:   'Game-changer. Once per level: survive a fatal hit at 1 HP instead of dying.',
          mechanic: { type: 'fatal_save', value: 1 } },

        // T5 — capstone
        { id: 'BAS_11', name: 'Sovereign Territory', tier: 5, col: 1, prereqs: ['BAS_08'], cost: 200, kind: 'capstone',
          effect:   'Capstone. Factory grid expands to its maximum 5×5. The Pirate Island is now sovereign noncontinuous territory.',
          mechanic: { type: 'factory_grid', value: { rows: 5, cols: 5 } } }
      ]
    },

    // ── PIRATE ───────────────────────────────────────────────────────────────
    // IOA resistance, recruitment quality, faction reputation.
    // Col 0 = IOA resistance   Col 1 = recruitment / workers   Col 2 = reputation / faction
    {
      id:        'pirate',
      name:      'PIRATE',
      desc:      'IOA resistance and reputation',
      colour:    0x8844dd,
      colourHex: '#8844dd',
      nodes: [
        // T1 — gateway
        { id: 'PIR_01', name: 'Off-Grid',       tier: 1, col: 1, prereqs: [],         cost: 10,  kind: 'significant',
          effect:   'Gateway. Unlocks the Pirate branch. IOA heat from power siphoning reduced by 25%.',
          mechanic: { type: 'ioa_heat_reduction', value: 0.25 } },

        // T2
        { id: 'PIR_02', name: 'Light Footprint',tier: 2, col: 0, prereqs: ['PIR_01'], cost: 25,  kind: 'incremental',
          effect:   'IOA heat decay between waves accelerated by 25%.',
          mechanic: { type: 'ioa_heat_decay', value: 1.25 } },
        { id: 'PIR_03', name: 'Recruiter',      tier: 2, col: 1, prereqs: ['PIR_01'], cost: 25,  kind: 'incremental',
          effect:   'Recruitment missions yield +1 worker.',
          mechanic: { type: 'worker_recruit_bonus', value: 1 } },
        { id: 'PIR_04', name: 'Word on the Water', tier: 2, col: 2, prereqs: ['PIR_01'], cost: 25, kind: 'incremental',
          effect:   'Marketplace prices reduced by 10%.',
          mechanic: { type: 'marketplace_discount', value: 0.10 } },

        // T3
        { id: 'PIR_05', name: 'Bribery',        tier: 3, col: 0, prereqs: ['PIR_02'], cost: 50,  kind: 'gamechanger',
          effect:   'Game-changer. Once per campaign: cancel an incoming IOA audit wave for 50 Nuts.',
          mechanic: { type: 'ioa_audit_cancel', value: 1 } },
        { id: 'PIR_06', name: 'Skilled Hands',  tier: 3, col: 1, prereqs: ['PIR_03'], cost: 50,  kind: 'significant',
          effect:   'Recruited workers start at Engineer tier instead of Recruit tier.',
          mechanic: { type: 'worker_starting_tier', value: 2 } },
        { id: 'PIR_07', name: 'Reputation',     tier: 3, col: 2, prereqs: ['PIR_04'], cost: 50,  kind: 'significant',
          effect:   'Friendly factions react to you 20% earlier in storyline progression.',
          mechanic: { type: 'reputation_pace', value: 1.20 } },

        // T4
        { id: 'PIR_08', name: 'Forged Cert',    tier: 4, col: 0, prereqs: ['PIR_05'], cost: 100, kind: 'significant',
          effect:   'IOA detection rate halved. Audit waves trigger only at maximum heat.',
          mechanic: { type: 'ioa_detection', value: 0.50 } },
        { id: 'PIR_09', name: 'Veteran Crew',   tier: 4, col: 1, prereqs: ['PIR_06'], cost: 100, kind: 'significant',
          effect:   'All workers — recruited or starting — operate at Engineer tier speed permanently.',
          mechanic: { type: 'worker_force_tier', value: 2 } },
        { id: 'PIR_10', name: 'Faction Ally',   tier: 4, col: 2, prereqs: ['PIR_07'], cost: 100, kind: 'gamechanger',
          effect:   'Game-changer. One enemy faction can become a temporary ally during specific story missions.',
          mechanic: { type: 'unlock_ally_mechanic', value: true } },

        // T5 — capstone
        { id: 'PIR_11', name: 'Pirate King Myth', tier: 5, col: 1, prereqs: ['PIR_10'], cost: 200, kind: 'capstone',
          effect:   'Capstone. Reputation maxed. All merchants give a 10% discount, IOA heat decay doubled, and unique storyline dialogue unlocks.',
          mechanic: { type: 'pirate_king_myth', value: true } }
      ]
    }

  ]
};
