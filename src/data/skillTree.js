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
        { id: 'FAC_01', name: 'Production Line', tier: 1, col: 1, prereqs: [],         cost: 3,   kind: 'significant',
          effect:   'Gateway. Unlocks the Factory branch. All machines run 5% faster.',
          mechanic: { type: 'machine_speed', value: 0.95 } },

        // T2
        { id: 'FAC_02', name: 'Fast Smelt',     tier: 2, col: 0, prereqs: ['FAC_01'], cost: 6,   kind: 'incremental',
          effect:   'Smelters and processors run 15% faster.',
          mechanic: { type: 'machine_speed_smelter', value: 0.85 } },
        { id: 'FAC_03', name: 'Steady Hands',   tier: 2, col: 1, prereqs: ['FAC_01'], cost: 6,   kind: 'incremental',
          effect:   'Assembly machines run 10% faster.',
          mechanic: { type: 'machine_speed_assembly', value: 0.90 } },
        { id: 'FAC_04', name: 'Good Memory',    tier: 2, col: 2, prereqs: ['FAC_01'], cost: 6,   kind: 'significant',
          effect:   'Workers remember 3 stops instead of 2 — e.g. fetch scrap → load the bench → build the tower.',
          mechanic: { type: 'worker_route_length', value: 1 } },

        // T3
        { id: 'FAC_05', name: 'Refined Process',tier: 3, col: 0, prereqs: ['FAC_02'], cost: 10,  kind: 'significant',
          effect:   'All machines run an additional 15% faster (stacks).',
          mechanic: { type: 'machine_speed', value: 0.85 } },
        { id: 'FAC_06', name: 'Express Belts',  tier: 3, col: 1, prereqs: ['FAC_03'], cost: 10,  kind: 'significant',
          effect:   'Belts move items 40% faster.',
          mechanic: { type: 'belt_speed', value: 0.60 } },
        { id: 'FAC_07', name: 'Quick Hands',     tier: 3, col: 2, prereqs: ['FAC_04'], cost: 10,  kind: 'significant',
          effect:   'Workers collect, load and deliver 20% faster.',
          mechanic: { type: 'worker_task_speed', value: 0.80 } },

        // T4
        { id: 'FAC_08', name: 'Wide Chutes',tier: 4, col: 0, prereqs: ['FAC_05'], cost: 16,  kind: 'significant',
          effect:   'Stores feed their belts twice as fast.',
          mechanic: { type: 'store_feed_speed', value: 0.50 } },
        { id: 'FAC_09', name: 'Partial Auto',   tier: 4, col: 1, prereqs: ['FAC_06'], cost: 16,  kind: 'gamechanger',
          effect:   'Game-changer. Belts, store feeds and self-running machines keep working while you are away from the Factory — even during battles (up to 30 minutes).',
          mechanic: { type: 'automation_level', value: 1 } },
        { id: 'FAC_10', name: 'Foreman',        tier: 4, col: 2, prereqs: ['FAC_07'], cost: 16,  kind: 'gamechanger',
          effect:   'Game-changer. Workers remember 4 stops — fetch, load, build and deliver. One worker can run a whole bench alone.',
          mechanic: { type: 'worker_route_length', value: 1 } },

        // T5 — capstone
        { id: 'FAC_11', name: 'Full Automation',tier: 5, col: 1, prereqs: ['FAC_09'], cost: 25,  kind: 'capstone',
          effect:   'Capstone. Workers on routes keep working while you are away too. The factory never stops.',
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
        { id: 'GAM_01', name: 'Card Counter',   tier: 1, col: 1, prereqs: [],         cost: 3,   kind: 'significant',
          effect:   'Gateway. +5% luck with every merchant — a losing play sometimes gets a second chance.',
          mechanic: { type: 'merchant_luck', value: 0.05, target: 'all' } },

        // T2
        { id: 'GAM_02', name: 'Gut Feel',       tier: 2, col: 0, prereqs: ['GAM_01'], cost: 6,   kind: 'incremental',
          effect:   'Chrome luck +10%: a losing spin is sometimes re-spun for free.',
          mechanic: { type: 'merchant_luck', value: 0.10, target: 'chrome' } },
        { id: 'GAM_03', name: 'Stamina',        tier: 2, col: 1, prereqs: ['GAM_01'], cost: 6,   kind: 'incremental',
          effect:   'Double-Down stays fresh for 8 rounds instead of 5.',
          mechanic: { type: 'merchant_fatigue_threshold', value: 3, target: 'doubledown' } },
        { id: 'GAM_04', name: 'Ricochet Aim',   tier: 2, col: 2, prereqs: ['GAM_01'], cost: 6,   kind: 'incremental',
          effect:   'Ricochet luck +10%: a ball that misses the bucket is sometimes pulled in (+2 hits).',
          mechanic: { type: 'merchant_luck', value: 0.10, target: 'ricochet' } },

        // T3
        { id: 'GAM_05', name: 'Jackpot Sense',  tier: 3, col: 0, prereqs: ['GAM_02'], cost: 10,  kind: 'gamechanger',
          effect:   'Game-changer. Chrome\'s cabinet glows the spin before a jackpot.',
          mechanic: { type: 'merchant_jackpot_tell', value: true, target: 'chrome' } },
        { id: 'GAM_06', name: 'Iron Will',      tier: 3, col: 1, prereqs: ['GAM_03'], cost: 10,  kind: 'significant',
          effect:   'Double-Down cost rises from fatigue are halved.',
          mechanic: { type: 'merchant_fatigue_cost', value: 0.50, target: 'doubledown' } },
        { id: 'GAM_07', name: 'Lucky Bounce',   tier: 3, col: 2, prereqs: ['GAM_04'], cost: 10,  kind: 'gamechanger',
          effect:   'Game-changer. 10% of Ricochet busts are bounced up into the 1-bolt tier.',
          mechanic: { type: 'merchant_redirect', value: 0.10, target: 'ricochet' } },

        // T4
        { id: 'GAM_08', name: 'Chrome Fortune', tier: 4, col: 0, prereqs: ['GAM_05'], cost: 16,  kind: 'significant',
          effect:   'Chrome payouts permanently +20%.',
          mechanic: { type: 'merchant_payout', value: 0.20, target: 'chrome' } },
        { id: 'GAM_09', name: 'All In',         tier: 4, col: 1, prereqs: ['GAM_06'], cost: 16,  kind: 'gamechanger',
          effect:   'Game-changer. All-In on Double-Down: stake your whole nut stack for 5× the bolts.',
          mechanic: { type: 'merchant_all_in', value: true, target: 'doubledown' } },
        { id: 'GAM_10', name: 'Plinko Master',  tier: 4, col: 2, prereqs: ['GAM_07'], cost: 16,  kind: 'significant',
          effect:   'Ricochet payouts permanently +20%.',
          mechanic: { type: 'merchant_payout', value: 0.20, target: 'ricochet' } },

        // T5 — capstone
        { id: 'GAM_11', name: 'House Loses',    tier: 5, col: 1, prereqs: ['GAM_09'], cost: 25,  kind: 'capstone',
          effect:   'Capstone. House edge cut from 30% to 15% — every merchant pays about 21% more.',
          mechanic: { type: 'merchant_house_edge', value: 0.50, target: 'all' } }
      ]
    },

    // ── COMBAT ───────────────────────────────────────────────────────────────
    // Tower bonuses and the parts economy.
    // Col 0 = tower power   Col 1 = parts economy   Col 2 = wave tactics
    {
      id:        'combat',
      name:      'COMBAT',
      desc:      'Tower bonuses and parts economy',
      colour:    0xc43a3a,
      colourHex: '#c43a3a',
      nodes: [
        // T1 — gateway
        { id: 'COM_01', name: 'Drill',   tier: 1, col: 1, prereqs: [],         cost: 3,   kind: 'significant',
          effect:   'Gateway. Unlocks the Combat branch. All towers fire 5% faster.',
          mechanic: { type: 'tower_fire_rate', value: 1.05 } },

        // T2
        { id: 'COM_02', name: 'Sharp Eye',      tier: 2, col: 0, prereqs: ['COM_01'], cost: 6,   kind: 'incremental',
          effect:   'Gunners and Mk IIs deal 10% more damage.',
          mechanic: { type: 'archetype_damage', value: 0.10, target: 'gunner' } },
        { id: 'COM_03', name: 'Scavenge',       tier: 2, col: 1, prereqs: ['COM_01'], cost: 6,   kind: 'incremental',
          effect:   'Salvage you collect is worth 20% more Parts.',
          mechanic: { type: 'parts_drop_multiplier', value: 1.20 } },
        { id: 'COM_04', name: 'Early Caller',  tier: 2, col: 2, prereqs: ['COM_01'], cost: 6,   kind: 'incremental',
          effect:   'Calling a wave EARLY pays 50% more bonus Parts.',
          mechanic: { type: 'early_bonus', value: 0.5 } },

        // T3
        { id: 'COM_05', name: 'Hollow Point',   tier: 3, col: 0, prereqs: ['COM_02'], cost: 10,  kind: 'significant',
          effect:   'Gunner and Mk II rounds have a 20% chance to deal double damage.',
          mechanic: { type: 'archetype_crit', value: 0.20, target: 'gunner' } },
        { id: 'COM_06', name: 'Stock Cache',    tier: 3, col: 1, prereqs: ['COM_03'], cost: 10,  kind: 'significant',
          effect:   'Start every battle with 6 Parts already in hand.',
          mechanic: { type: 'parts_starting_bonus', value: 6 } },
        { id: 'COM_07', name: 'Mark Target',    tier: 3, col: 2, prereqs: ['COM_04'], cost: 10,  kind: 'gamechanger',
          effect:   'Game-changer. The first raider hit each wave is marked: it takes double damage for 4 seconds.',
          mechanic: { type: 'mark_target', value: { multiplier: 2, duration: 4 } } },

        // T4
        { id: 'COM_08', name: 'Cluster Rounds', tier: 4, col: 0, prereqs: ['COM_05'], cost: 16,  kind: 'significant',
          effect:   'Bomber blasts are 25% wider.',
          mechanic: { type: 'archetype_splash', value: 0.25, target: 'bomber' } },
        { id: 'COM_09', name: 'Scrap Magnet',   tier: 4, col: 1, prereqs: ['COM_06'], cost: 16,  kind: 'gamechanger',
          effect:   'Game-changer. Salvage you miss drifts to you by itself, and elite and boss wrecks carry +2 / +5 Parts.',
          mechanic: { type: 'elite_drops', value: { boss: 5, elite: 2 } } },
        { id: 'COM_10', name: 'Suppression',    tier: 4, col: 2, prereqs: ['COM_07'], cost: 16,  kind: 'significant',
          effect:   'Barricades slow raiders 15% more.',
          mechanic: { type: 'archetype_slow', value: 0.15, target: 'barricade' } },

        // T5 — capstone
        { id: 'COM_11', name: 'Overclocked',    tier: 5, col: 1, prereqs: ['COM_09'], cost: 25,  kind: 'capstone',
          effect:   'Capstone. Every tower deals 20% more damage, in every battle.',
          mechanic: { type: 'tower_damage', value: 1.20 } }
      ]
    },

    // ── ECONOMY ──────────────────────────────────────────────────────────────
    // Nuts, materials, rewards and the Market.
    // Col 0 = selling and the Black Market   Col 1 = rewards   Col 2 = costs
    {
      id:        'economy',
      name:      'ECONOMY',
      desc:      'Materials, prices, and Nuts',
      colour:    0xb78a3a,
      colourHex: '#b78a3a',
      nodes: [
        // T1 — gateway
        { id: 'ECO_01', name: 'Market Knowledge', tier: 1, col: 1, prereqs: [],         cost: 3,   kind: 'significant',
          effect:   'Gateway. Unlocks the Economy branch. Towers sell for 10% more Nuts.',
          mechanic: { type: 'sell_price_multiplier', value: 1.10 } },

        // T2
        { id: 'ECO_02', name: 'Sharp Trader',  tier: 2, col: 0, prereqs: ['ECO_01'], cost: 6,   kind: 'incremental',
          effect:   'Towers sell for another 20% more Nuts (stacks).',
          mechanic: { type: 'sell_price_multiplier', value: 1.20 } },
        { id: 'ECO_03', name: 'Eye for Quality',tier: 2, col: 1, prereqs: ['ECO_01'], cost: 6,   kind: 'incremental',
          effect:   'Victories and raids pay 15% more materials.',
          mechanic: { type: 'material_drop_multiplier', value: 1.15 } },
        { id: 'ECO_04', name: 'Bargain Hunter', tier: 2, col: 2, prereqs: ['ECO_01'], cost: 6,   kind: 'incremental',
          effect:   'Factory machines cost 1 less of each material (never below 1).',
          mechanic: { type: 'machine_cost_flat', value: 1 } },

        // T3
        { id: 'ECO_05', name: 'Black Market',  tier: 3, col: 0, prereqs: ['ECO_02'], cost: 10,  kind: 'gamechanger',
          effect:   'Game-changer. A Black Market stall opens in the Market: buy Plastic Scrap and Salvaged Metal with Nuts.',
          mechanic: { type: 'unlock_black_market', value: true } },
        { id: 'ECO_06', name: 'Refined Eye',   tier: 3, col: 1, prereqs: ['ECO_03'], cost: 10,  kind: 'significant',
          effect:   'Every first clear pays 1 extra bolt.',
          mechanic: { type: 'bolt_bonus', value: 1 } },
        { id: 'ECO_07', name: 'Mass Production',tier: 3, col: 2, prereqs: ['ECO_04'], cost: 10,  kind: 'significant',
          effect:   'Raid loot +25%.',
          mechanic: { type: 'raid_loot_mult', value: 1.25 } },

        // T4
        { id: 'ECO_08', name: 'Premium Goods', tier: 4, col: 0, prereqs: ['ECO_05'], cost: 16,  kind: 'significant',
          effect:   'Towers sell for another 30% more Nuts (stacks).',
          mechanic: { type: 'sell_price_multiplier', value: 1.30 } },
        { id: 'ECO_09', name: 'Salvage Ops',   tier: 4, col: 1, prereqs: ['ECO_06'], cost: 16,  kind: 'gamechanger',
          effect:   'Game-changer. Replaying a mission pays full rewards instead of half.',
          mechanic: { type: 'replay_full', value: true } },
        { id: 'ECO_10', name: 'Bulk Trading',  tier: 4, col: 2, prereqs: ['ECO_07'], cost: 16,  kind: 'significant',
          effect:   'Merchant stakes cost 1 Nut less (never below 1).',
          mechanic: { type: 'merchant_cost_flat', value: 1 } },

        // T5 — capstone
        { id: 'ECO_11', name: 'Market Tycoon', tier: 5, col: 1, prereqs: ['ECO_09'], cost: 25,  kind: 'capstone',
          effect:   'Capstone. Nuts from selling towers are doubled, and Black Market prices halve.',
          mechanic: { type: 'nuts_multiplier', value: 2 } }
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
        { id: 'BAS_01', name: 'Island Survey',  tier: 1, col: 1, prereqs: [],         cost: 3,   kind: 'significant',
          effect:   'Gateway. Unlocks the Base branch. Base maximum HP +5%.',
          mechanic: { type: 'base_hp_multiplier', value: 1.05 } },

        // T2
        { id: 'BAS_02', name: 'Grid Plus I',    tier: 2, col: 0, prereqs: ['BAS_01'], cost: 6,   kind: 'significant',
          effect:   'Factory floor expands to 3 rows × 4 columns.',
          mechanic: { type: 'factory_grid', value: { rows: 3, cols: 4 } } },
        { id: 'BAS_03', name: 'Cable Tap',      tier: 2, col: 1, prereqs: ['BAS_01'], cost: 6,   kind: 'incremental',
          effect:   'Lights on the raft: all towers reach 10% further.',
          mechanic: { type: 'tower_range', value: 1.10 } },
        { id: 'BAS_04', name: 'Thick Walls',    tier: 2, col: 2, prereqs: ['BAS_01'], cost: 6,   kind: 'incremental',
          effect:   'Base maximum HP +15%.',
          mechanic: { type: 'base_hp_multiplier', value: 1.15 } },

        // T3
        { id: 'BAS_05', name: 'Grid Plus II',   tier: 3, col: 0, prereqs: ['BAS_02'], cost: 10,  kind: 'significant',
          effect:   'Factory floor expands to 4 × 4.',
          mechanic: { type: 'factory_grid', value: { rows: 4, cols: 4 } } },
        { id: 'BAS_06', name: 'Recycling Plant',tier: 3, col: 1, prereqs: ['BAS_03'], cost: 10,  kind: 'gamechanger',
          effect:   'Game-changer. Every victory also pays 3 Plastic Scrap from the recycling plant.',
          mechanic: { type: 'victory_scrap', value: 3 } },
        { id: 'BAS_07', name: 'Blast Doors',    tier: 3, col: 2, prereqs: ['BAS_04'], cost: 10,  kind: 'significant',
          effect:   'Base takes 1 less damage per enemy hit (minimum 1).',
          mechanic: { type: 'base_damage_reduction', value: 1 } },

        // T4
        { id: 'BAS_08', name: 'Grid Plus III',  tier: 4, col: 0, prereqs: ['BAS_05'], cost: 16,  kind: 'significant',
          effect:   'Factory floor expands to 4 rows × 5 columns.',
          mechanic: { type: 'factory_grid', value: { rows: 4, cols: 5 } } },
        { id: 'BAS_09', name: 'Wind Turbines',  tier: 4, col: 1, prereqs: ['BAS_06'], cost: 16,  kind: 'gamechanger',
          effect:   'Game-changer. The turbines turn again: every factory machine runs 15% faster (stacks).',
          mechanic: { type: 'machine_speed', value: 0.85 } },
        { id: 'BAS_10', name: 'Iron Fortress',  tier: 4, col: 2, prereqs: ['BAS_07'], cost: 16,  kind: 'gamechanger',
          effect:   'Game-changer. Once per level: survive a fatal hit at 1 HP instead of dying.',
          mechanic: { type: 'fatal_save', value: 1 } },

        // T5 — capstone
        { id: 'BAS_11', name: 'Sovereign Territory', tier: 5, col: 1, prereqs: ['BAS_08'], cost: 25,  kind: 'capstone',
          effect:   'Capstone. Factory floor expands to its maximum 5 × 5. The Pirate Island is now sovereign territory.',
          mechanic: { type: 'factory_grid', value: { rows: 5, cols: 5 } } }
      ]
    },

    // ── PIRATE ───────────────────────────────────────────────────────────────
    // Raids: the convoy, its loot and some dirty tricks.
    // Col 0 = turrets   Col 1 = barges and crew   Col 2 = loot and the convoy
    {
      id:        'pirate',
      name:      'PIRATE',
      desc:      'Raids: convoys, loot and dirty tricks',
      colour:    0x8844dd,
      colourHex: '#8844dd',
      nodes: [
        // T1 — gateway
        { id: 'PIR_01', name: 'Sea Legs',       tier: 1, col: 1, prereqs: [],         cost: 3,   kind: 'significant',
          effect:   'Gateway. Unlocks the Pirate branch. Raid barges move 15% faster.',
          mechanic: { type: 'raid_speed', value: 1.15 } },

        // T2
        { id: 'PIR_02', name: 'Low Profile',tier: 2, col: 0, prereqs: ['PIR_01'], cost: 6,   kind: 'incremental',
          effect:   'Enemy turrets in raids see 10% less far.',
          mechanic: { type: 'raid_turret_range', value: 0.90 } },
        { id: 'PIR_03', name: 'Recruiter',      tier: 2, col: 1, prereqs: ['PIR_01'], cost: 6,   kind: 'incremental',
          effect:   'Raids start with 10 more Parts.',
          mechanic: { type: 'raid_parts', value: 10 } },
        { id: 'PIR_04', name: 'Word on the Water', tier: 2, col: 2, prereqs: ['PIR_01'], cost: 6,   kind: 'incremental',
          effect:   'Won raids pay 2 extra bolts.',
          mechanic: { type: 'raid_bolts', value: 2 } },

        // T3
        { id: 'PIR_05', name: 'Bribery',        tier: 3, col: 0, prereqs: ['PIR_02'], cost: 10,  kind: 'gamechanger',
          effect:   'Game-changer. In every raid, the first turret is bribed and never fires.',
          mechanic: { type: 'raid_bribe', value: 1 } },
        { id: 'PIR_06', name: 'Skilled Hands',  tier: 3, col: 1, prereqs: ['PIR_03'], cost: 10,  kind: 'significant',
          effect:   'REPAIR mends barges by 75% instead of 50%.',
          mechanic: { type: 'raid_repair', value: 0.75 } },
        { id: 'PIR_07', name: 'Reputation',     tier: 3, col: 2, prereqs: ['PIR_04'], cost: 10,  kind: 'significant',
          effect:   'Barges have 25% more hull.',
          mechanic: { type: 'raid_unit_hp', value: 1.25 } },

        // T4
        { id: 'PIR_08', name: 'Forged Cert',    tier: 4, col: 0, prereqs: ['PIR_05'], cost: 16,  kind: 'significant',
          effect:   'Turrets take 15% more damage from your barges.',
          mechanic: { type: 'raid_turret_vuln', value: 1.15 } },
        { id: 'PIR_09', name: 'Veteran Crew',   tier: 4, col: 1, prereqs: ['PIR_06'], cost: 16,  kind: 'significant',
          effect:   'Factory workers walk 20% faster.',
          mechanic: { type: 'worker_speed', value: 1.20 } },
        { id: 'PIR_10', name: 'Faction Ally',   tier: 4, col: 2, prereqs: ['PIR_07'], cost: 16,  kind: 'gamechanger',
          effect:   'Game-changer. Barges leave twice as often.',
          mechanic: { type: 'raid_deploy', value: 0.5 } },

        // T5 — capstone
        { id: 'PIR_11', name: 'Pirate King Myth', tier: 5, col: 1, prereqs: ['PIR_10'], cost: 25,  kind: 'capstone',
          effect:   'Capstone. Raid loot is doubled.',
          mechanic: { type: 'raid_loot_mult', value: 2 } }
      ]
    }

  ]
};
