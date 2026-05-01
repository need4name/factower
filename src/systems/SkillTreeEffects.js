// ── SkillTreeEffects.js ──────────────────────────────────────────────────────
// Translates purchased SKILL_TREE nodes into a flat, queryable game-state object.
// This is the single source of truth for all skill-tree-driven gameplay effects.
//
// Architecture:
//   - saveData.skillTree (an object of nodeId -> true) is the persistent record
//     of what the player has purchased.
//   - skillTreeEffects.state is a flat object with multipliers, additives, and
//     unlocks. Other scenes read from this object via getter methods.
//   - state is REBUILT FROM SCRATCH every time saveData changes (purchase, load,
//     respec). This keeps it idempotent — no drift, no migrations.
//
// Usage from other scenes:
//
//   // On scene create:
//   skillTreeEffects.rebuildFromSaveData(this.saveData);
//
//   // Querying:
//   const speed   = skillTreeEffects.getMachineSpeed();         // 0.85 = 15% faster
//   const grid    = skillTreeEffects.getFactoryGrid();          // {rows, cols}
//   const auto    = skillTreeEffects.getAutomationLevel();      // 0|1|2
//   const dmgMult = skillTreeEffects.getTowerDamageMult();      // 1.20 = +20%
//   const archDmg = skillTreeEffects.getArchetypeDamage('gunner'); // 0.30 = +30%
//
// Usage from SkillTreeScene on purchase:
//
//   this.saveData.skillTree[node.id] = true;
//   this.saveData.bolts -= node.cost;
//   skillTreeEffects.applyMechanic(node.mechanic);    // instant feedback
//   localStorage.setItem(saveKey, JSON.stringify(this.saveData));

class SkillTreeEffects {
  constructor() {
    this.state = this.defaultState();
  }

  // ── DEFAULT STATE ──────────────────────────────────────────────────────────
  // Fresh state with every modifier at neutral. Multipliers start at 1,
  // additives start at 0, unlocks start false/0.
  defaultState() {
    return {
      // ── FACTORY ─────────────────────────────────────────────────────────
      machineSpeed:           1.00,   // multiplier on machine duration. 0.85 = 15% faster.
      machineSpeedSmelter:    1.00,   // smelter-specific (stacks with machineSpeed)
      machineSpeedAssembly:   1.00,   // assembly-specific (stacks with machineSpeed)
      workerSpeed:            1.00,   // multiplier on worker movement speed
      conveyorTier:           0,      // 0=none, 1=T1 conveyors unlocked
      workerMaxTier:          1,      // max material tier workers can carry without slowdown
      workerForceTier:        1,      // forces all workers to operate at this tier minimum
      storageCapacity:        1.00,   // multiplier on storage drum capacity
      automationLevel:        0,      // 0=frozen, 1=partial, 2=full

      // ── GAMBLING ────────────────────────────────────────────────────────
      // Per-merchant bonuses keyed by merchant id ('chrome'|'doubledown'|'ricochet').
      // 'all' applies to every merchant (added to each on resolve).
      merchantLuck:           { chrome: 0, doubledown: 0, ricochet: 0 },
      merchantPayout:         { chrome: 0, doubledown: 0, ricochet: 0 },
      merchantHouseEdgeMult:  1.00,   // multiplier on house edge. 0.50 = halved.
      merchantFatigueThreshold: 0,    // additive bonus rolls before fatigue kicks in
      merchantFatigueCostMult: 1.00,  // multiplier on fatigue cost increase
      merchantJackpotTell:    false,  // chrome screen pulses before jackpot
      merchantRedirectChance: 0,      // ricochet auto-redirect chance
      merchantAllInUnlocked:  false,  // doubledown all-in mode

      // ── COMBAT ──────────────────────────────────────────────────────────
      towerFireRate:          1.00,   // multiplier on all towers' fire rate
      towerDamageMult:        1.00,   // multiplier on all towers' base damage
      partsDropMult:          1.00,   // multiplier on parts dropped per kill
      partsStartBonus:        0,      // bonus parts at level start
      waveWarningBonus:       0,      // additive seconds added to wave countdown
      eliteDrops:             { boss: 0, elite: 0 }, // bonus parts on boss/elite kills
      markTarget:             null,   // { multiplier, duration } or null

      // Per-archetype bonuses. Each archetype gets damage/crit/splash/slow buffs.
      archetypeDamage:  { gunner:0, bomber:0, sniper:0, jammer:0, barricade:0, siphon:0 },
      archetypeCrit:    { gunner:0, bomber:0, sniper:0, jammer:0, barricade:0, siphon:0 },
      archetypeSplash:  { gunner:0, bomber:0, sniper:0, jammer:0, barricade:0, siphon:0 },
      archetypeSlow:    { gunner:0, bomber:0, sniper:0, jammer:0, barricade:0, siphon:0 },

      // ── ECONOMY ─────────────────────────────────────────────────────────
      sellPriceMult:          1.00,   // multiplier on tower sell price (in Nuts)
      nutsMult:               1.00,   // multiplier on all Nuts income
      materialDropMult:       1.00,   // multiplier on extra-material chance
      materialQualityChance:  0,      // chance for material drop to upgrade one tier
      machineCostMult:        1.00,   // multiplier on machine build cost
      machineBulkDiscount:    0,      // discount on 3rd+ identical machine
      bulkSellBonus:          0,      // bonus on selling 3+ towers in one transaction
      sellMaterialRefund:     0,      // % of raw materials refunded on sell
      blackMarketUnlocked:    false,  // unlock black market merchant

      // ── BASE ────────────────────────────────────────────────────────────
      factoryGrid:            { rows: 3, cols: 3 }, // factory grid size
      baseHpMult:             1.00,   // multiplier on max base HP
      baseDamageReduction:    0,      // flat damage reduction per hit
      powerCapacity:          0,      // additive power capacity bonus
      fatalSaveCharges:       0,      // once-per-level survive-fatal charges
      unlockedZones:          {},     // { recycling_plant: true, wind_turbines: true, ... }

      // ── PIRATE ──────────────────────────────────────────────────────────
      ioaHeatReduction:       0,      // % reduction on IOA heat gained
      ioaHeatDecayMult:       1.00,   // multiplier on IOA heat decay rate
      ioaDetectionMult:       1.00,   // multiplier on IOA detection rate
      ioaAuditCancels:        0,      // bribery charges (cancel an audit wave)
      workerRecruitBonus:     0,      // additive workers per recruitment mission
      workerStartingTier:     1,      // tier workers START at when recruited
      marketplaceDiscount:    0,      // % off marketplace prices
      reputationPace:         1.00,   // multiplier on storyline reputation gains
      allyMechanicUnlocked:   false,  // unlock faction-ally mechanic
      pirateKingMythActive:   false,  // capstone bundle: dialogue + bonuses
    };
  }

  // ── REBUILD ────────────────────────────────────────────────────────────────
  // Wipes state and re-applies every purchased node. Idempotent — safe to call
  // any time. This is the canonical entry point on scene create / save load.
  rebuildFromSaveData(saveData) {
    this.state = this.defaultState();
    if (!saveData || !saveData.skillTree) return;

    Object.keys(saveData.skillTree).forEach(nodeId => {
      if (!saveData.skillTree[nodeId]) return; // ignore false / unset
      const node = this.findNodeById(nodeId);
      if (node && node.mechanic) this.applyMechanic(node.mechanic);
    });
  }

  // ── APPLY SINGLE MECHANIC ──────────────────────────────────────────────────
  // Mutates this.state based on a mechanic { type, value, target? }.
  // Called either from rebuildFromSaveData (during load) or directly from
  // SkillTreeScene.purchaseNode (for instant in-session feedback).
  applyMechanic(m) {
    if (!m || !m.type) return;
    const s = this.state;

    switch (m.type) {

      // ── FACTORY ─────────────────────────────────────────────────────────
      case 'machine_speed':           s.machineSpeed *= m.value; break;
      case 'machine_speed_smelter':   s.machineSpeedSmelter *= m.value; break;
      case 'machine_speed_assembly':  s.machineSpeedAssembly *= m.value; break;
      case 'worker_speed':            s.workerSpeed *= m.value; break;
      case 'unlock_conveyor':         s.conveyorTier = Math.max(s.conveyorTier, m.value); break;
      case 'worker_tier':             s.workerMaxTier = Math.max(s.workerMaxTier, m.value); break;
      case 'worker_force_tier':       s.workerForceTier = Math.max(s.workerForceTier, m.value); break;
      case 'storage_capacity':        s.storageCapacity *= m.value; break;
      case 'automation_level':        s.automationLevel = Math.max(s.automationLevel, m.value); break;

      // ── GAMBLING ────────────────────────────────────────────────────────
      case 'merchant_luck':
        if (m.target === 'all') {
          s.merchantLuck.chrome     += m.value;
          s.merchantLuck.doubledown += m.value;
          s.merchantLuck.ricochet   += m.value;
        } else {
          s.merchantLuck[m.target] += m.value;
        }
        break;
      case 'merchant_payout':
        if (m.target === 'all') {
          s.merchantPayout.chrome     += m.value;
          s.merchantPayout.doubledown += m.value;
          s.merchantPayout.ricochet   += m.value;
        } else {
          s.merchantPayout[m.target] += m.value;
        }
        break;
      case 'merchant_house_edge':       s.merchantHouseEdgeMult *= m.value; break;
      case 'merchant_fatigue_threshold': s.merchantFatigueThreshold += m.value; break;
      case 'merchant_fatigue_cost':     s.merchantFatigueCostMult *= m.value; break;
      case 'merchant_jackpot_tell':     s.merchantJackpotTell = !!m.value; break;
      case 'merchant_redirect':         s.merchantRedirectChance += m.value; break;
      case 'merchant_all_in':           s.merchantAllInUnlocked = !!m.value; break;

      // ── COMBAT ──────────────────────────────────────────────────────────
      case 'tower_fire_rate':         s.towerFireRate *= m.value; break;
      case 'tower_damage':            s.towerDamageMult *= m.value; break;
      case 'parts_drop_multiplier':   s.partsDropMult *= m.value; break;
      case 'parts_starting_bonus':    s.partsStartBonus += m.value; break;
      case 'wave_warning_bonus':      s.waveWarningBonus += m.value; break;
      case 'archetype_damage':        s.archetypeDamage[m.target] += m.value; break;
      case 'archetype_crit':          s.archetypeCrit[m.target] += m.value; break;
      case 'archetype_splash':        s.archetypeSplash[m.target] += m.value; break;
      case 'archetype_slow':          s.archetypeSlow[m.target] += m.value; break;
      case 'mark_target':             s.markTarget = m.value; break;
      case 'elite_drops':
        s.eliteDrops.boss  = Math.max(s.eliteDrops.boss,  m.value.boss  || 0);
        s.eliteDrops.elite = Math.max(s.eliteDrops.elite, m.value.elite || 0);
        break;

      // ── ECONOMY ─────────────────────────────────────────────────────────
      case 'sell_price_multiplier':   s.sellPriceMult *= m.value; break;
      case 'nuts_multiplier':         s.nutsMult *= m.value; break;
      case 'material_drop_multiplier': s.materialDropMult *= m.value; break;
      case 'material_quality_chance': s.materialQualityChance += m.value; break;
      case 'machine_cost_multiplier': s.machineCostMult *= m.value; break;
      case 'machine_bulk_discount':   s.machineBulkDiscount = Math.max(s.machineBulkDiscount, m.value); break;
      case 'bulk_sell_bonus':         s.bulkSellBonus = Math.max(s.bulkSellBonus, m.value); break;
      case 'sell_material_refund':    s.sellMaterialRefund = Math.max(s.sellMaterialRefund, m.value); break;
      case 'unlock_black_market':     s.blackMarketUnlocked = !!m.value; break;

      // ── BASE ────────────────────────────────────────────────────────────
      case 'factory_grid':
        // Take the bigger grid. Order-of-application doesn't matter.
        const newSize = m.value.rows * m.value.cols;
        const curSize = s.factoryGrid.rows * s.factoryGrid.cols;
        if (newSize > curSize) s.factoryGrid = { rows: m.value.rows, cols: m.value.cols };
        break;
      case 'base_hp_multiplier':      s.baseHpMult *= m.value; break;
      case 'base_damage_reduction':   s.baseDamageReduction += m.value; break;
      case 'power_capacity':          s.powerCapacity += m.value; break;
      case 'fatal_save':              s.fatalSaveCharges = Math.max(s.fatalSaveCharges, m.value); break;
      case 'unlock_zone':             s.unlockedZones[m.value] = true; break;

      // ── PIRATE ──────────────────────────────────────────────────────────
      case 'ioa_heat_reduction':      s.ioaHeatReduction += m.value; break;
      case 'ioa_heat_decay':          s.ioaHeatDecayMult *= m.value; break;
      case 'ioa_detection':           s.ioaDetectionMult *= m.value; break;
      case 'ioa_audit_cancel':        s.ioaAuditCancels += m.value; break;
      case 'worker_recruit_bonus':    s.workerRecruitBonus += m.value; break;
      case 'worker_starting_tier':    s.workerStartingTier = Math.max(s.workerStartingTier, m.value); break;
      case 'marketplace_discount':    s.marketplaceDiscount += m.value; break;
      case 'reputation_pace':         s.reputationPace *= m.value; break;
      case 'unlock_ally_mechanic':    s.allyMechanicUnlocked = !!m.value; break;

      // ── PIRATE KING MYTH (capstone bundle) ──────────────────────────────
      // Bundles three effects: 10% merchant discount, 2× IOA heat decay,
      // and a flag that unlocks unique storyline dialogue.
      case 'pirate_king_myth':
        s.pirateKingMythActive  = true;
        s.marketplaceDiscount   += 0.10;
        s.ioaHeatDecayMult      *= 2.00;
        break;

      default:
        console.warn('[SkillTreeEffects] Unknown mechanic type:', m.type);
    }
  }

  // ── LOOKUP HELPER ──────────────────────────────────────────────────────────
  // Walks SKILL_TREE and returns the node matching the given id, or null.
  findNodeById(nodeId) {
    if (typeof SKILL_TREE === 'undefined') return null;
    for (let i = 0; i < SKILL_TREE.branches.length; i++) {
      const b = SKILL_TREE.branches[i];
      for (let j = 0; j < b.nodes.length; j++) {
        if (b.nodes[j].id === nodeId) return b.nodes[j];
      }
    }
    return null;
  }

  // ── GETTERS ────────────────────────────────────────────────────────────────
  // Use these from other scenes — never access this.state directly. The getter
  // layer means we can change internal storage later without breaking consumers.

  // Factory
  getMachineSpeed()           { return this.state.machineSpeed; }
  getMachineSpeedSmelter()    { return this.state.machineSpeed * this.state.machineSpeedSmelter; }
  getMachineSpeedAssembly()   { return this.state.machineSpeed * this.state.machineSpeedAssembly; }
  getWorkerSpeed()            { return this.state.workerSpeed; }
  getConveyorTier()           { return this.state.conveyorTier; }
  getWorkerMaxTier()          { return Math.max(this.state.workerMaxTier, this.state.workerForceTier); }
  getStorageCapacity()        { return this.state.storageCapacity; }
  getAutomationLevel()        { return this.state.automationLevel; }
  isAutomationUnlocked()      { return this.state.automationLevel >= 1; }
  isFullAutomation()          { return this.state.automationLevel >= 2; }

  // Gambling
  getMerchantLuck(merchant)   { return this.state.merchantLuck[merchant]   || 0; }
  getMerchantPayout(merchant) { return this.state.merchantPayout[merchant] || 0; }
  getMerchantHouseEdgeMult()  { return this.state.merchantHouseEdgeMult; }
  getMerchantFatigueThreshold() { return this.state.merchantFatigueThreshold; }
  getMerchantFatigueCostMult() { return this.state.merchantFatigueCostMult; }
  hasMerchantJackpotTell()    { return this.state.merchantJackpotTell; }
  getMerchantRedirectChance() { return this.state.merchantRedirectChance; }
  isMerchantAllInUnlocked()   { return this.state.merchantAllInUnlocked; }

  // Combat
  getTowerFireRate()          { return this.state.towerFireRate; }
  getTowerDamageMult()        { return this.state.towerDamageMult; }
  getPartsDropMult()          { return this.state.partsDropMult; }
  getPartsStartBonus()        { return this.state.partsStartBonus; }
  getWaveWarningBonus()       { return this.state.waveWarningBonus; }
  getArchetypeDamage(t)       { return this.state.archetypeDamage[t]  || 0; }
  getArchetypeCrit(t)         { return this.state.archetypeCrit[t]    || 0; }
  getArchetypeSplash(t)       { return this.state.archetypeSplash[t]  || 0; }
  getArchetypeSlow(t)         { return this.state.archetypeSlow[t]    || 0; }
  getMarkTarget()             { return this.state.markTarget; }
  getEliteDropBonus()         { return this.state.eliteDrops.elite; }
  getBossDropBonus()          { return this.state.eliteDrops.boss; }

  // Economy
  getSellPriceMult()          { return this.state.sellPriceMult; }
  getNutsMult()               { return this.state.nutsMult; }
  getMaterialDropMult()       { return this.state.materialDropMult; }
  getMaterialQualityChance()  { return this.state.materialQualityChance; }
  getMachineCostMult()        { return this.state.machineCostMult; }
  getMachineBulkDiscount()    { return this.state.machineBulkDiscount; }
  getBulkSellBonus()          { return this.state.bulkSellBonus; }
  getSellMaterialRefund()     { return this.state.sellMaterialRefund; }
  isBlackMarketUnlocked()     { return this.state.blackMarketUnlocked; }

  // Base
  getFactoryGrid()            { return { ...this.state.factoryGrid }; }
  getBaseHpMult()             { return this.state.baseHpMult; }
  getBaseDamageReduction()    { return this.state.baseDamageReduction; }
  getPowerCapacityBonus()     { return this.state.powerCapacity; }
  getFatalSaveCharges()       { return this.state.fatalSaveCharges; }
  isZoneUnlocked(zoneId)      { return !!this.state.unlockedZones[zoneId]; }

  // Pirate
  getIoaHeatReduction()       { return this.state.ioaHeatReduction; }
  getIoaHeatDecayMult()       { return this.state.ioaHeatDecayMult; }
  getIoaDetectionMult()       { return this.state.ioaDetectionMult; }
  getIoaAuditCancels()        { return this.state.ioaAuditCancels; }
  getWorkerRecruitBonus()     { return this.state.workerRecruitBonus; }
  getWorkerStartingTier()     { return this.state.workerStartingTier; }
  getMarketplaceDiscount()    { return this.state.marketplaceDiscount; }
  getReputationPace()         { return this.state.reputationPace; }
  isAllyMechanicUnlocked()    { return this.state.allyMechanicUnlocked; }
  isPirateKingMythActive()    { return this.state.pirateKingMythActive; }
}

// Single global instance — scenes import implicitly via window scope.
const skillTreeEffects = new SkillTreeEffects();
