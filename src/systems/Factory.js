// ── Factory.js ────────────────────────────────────────────────────────────────
// Core factory simulation system.
//
// MATERIAL ECONOMY
// ─────────────────
// Materials live in saveData.materials (top-level save key).
// Factory.loadFromSave() reads them in; Factory.save() writes them back.
// Workers deduct from the pool when they COLLECT from a store (1 unit per trip).
// If a store is empty the worker becomes idle — this is the resource gate.
//
// TOWER COSTS (T1)
// ─────────────────
// Gunner:    1 plasticScrap  → collected direct, deposited at assembly, assembled
// Barricade: 1 salvagedMetal → collected direct, deposited at assembly, assembled
// Bomber:    1 plasticScrap  → collected, smelted to refinedPlastic, deposited
//                              at assembly, assembled
//
// Each assembly type has a primaryInput. The worker deposits that one material,
// then assembles. No two-material deposit required.

const TOWER_COSTS = {
  gunner:    { plasticScrap:   1 },
  barricade: { salvagedMetal:  1 },
  bomber:    { plasticScrap:   1 }   // deducted at collection; becomes refined via smelter
};

const MACHINE_TYPES = {
  smelter: {
    key:        'smelter',
    name:       'SMELTER',
    colour:     0xe8a020,
    colourHex:  '#e8a020',
    inputItems: ['plasticScrap'],
    outputItem: 'refinedPlastic',
    duration:   12000
  },
  assembly_gunner: {
    key:          'assembly_gunner',
    name:         'ASSEMBLY \xb7 GUNNER',
    shortName:    'ASM\xb7GUN',
    colour:       0x3a8fc4,
    colourHex:    '#3a8fc4',
    produces:     'gunner',
    primaryInput: 'plasticScrap',   // deposited directly — no smelter needed
    duration:     5000,
    depositDuration: 1500
  },
  assembly_bomber: {
    key:          'assembly_bomber',
    name:         'ASSEMBLY \xb7 BOMBER',
    shortName:    'ASM\xb7BMB',
    colour:       0xe8a020,
    colourHex:    '#e8a020',
    produces:     'bomber',
    primaryInput: 'refinedPlastic', // requires smelter step first
    duration:     5000,
    depositDuration: 1500
  },
  assembly_barricade: {
    key:          'assembly_barricade',
    name:         'ASSEMBLY \xb7 BARRICADE',
    shortName:    'ASM\xb7BAR',
    colour:       0xc43a3a,
    colourHex:    '#c43a3a',
    produces:     'barricade',
    primaryInput: 'salvagedMetal',  // deposited directly — no smelter needed
    duration:     5000,
    depositDuration: 1500
  },
  conveyor: {
    key:        'conveyor',
    name:       'CONVEYOR',
    shortName:  'BELT',
    colour:     0x8899aa,
    colourHex:  '#8899aa',
    isConveyor: true   // distinguishing flag — not a production machine
  }
};

const WORKER_COLOURS = [0xe8a020, 0x3a8fc4];
const WORKER_LABELS  = ['W1', 'W2'];

class Factory {
  constructor() {
    // Grid sized to match FactoryScene's 3x3 visible grid.
    // Older saves persisted a 5x5 grid; FactoryScene cleans those up on load,
    // and loadFromSave() below re-sizes if a smaller saved grid is found.
    this.COLS = 3;
    this.ROWS = 3;
    this.grid = Array.from({ length: this.ROWS }, () => Array(this.COLS).fill(null));

    // ── Items-on-tiles (Milestone 2/3) ────────────────────────────────
    // Parallel 2D array. tileItems[r][c] is null OR a single item string
    // (e.g. 'plasticScrap', 'refinedPlastic'). Used by conveyor belts and
    // worker drop/pickup. One item per tile maximum.
    this.tileItems = Array.from({ length: this.ROWS }, () => Array(this.COLS).fill(null));

    // ── Belt tick timer (Milestone 3) ─────────────────────────────────
    // Conveyors don't tick every frame. Items advance one tile per BELT_TICK_MS
    // so movement is readable on a small grid. Accumulator handles variable delta.
    this.BELT_TICK_MS    = 600;

    // ── Auto-output (Milestone 6) ─────────────────────────────────────
    // Stores drop one item onto the belt below them every STORE_FEED_MS:
    // the scrap store feeds the top-left tile, the metal store the top-right.
    this.STORE_FEED_MS   = 3000;
    this.STORE_FEEDS     = { store_scrap: { row: 0, col: 0, item: 'plasticScrap',  mat: 'plasticScrap'  },
                             store_metal: { row: 0, col: 2, item: 'salvagedMetal', mat: 'salvagedMetal' } };
    this._feedAccumulator = 0;
    // Towers that reached the depository by belt since the scene last asked
    this.deliveries      = [];

    // ── Skill-tree modifiers (Milestone 7) ────────────────────────────
    // Duration multipliers (lower = faster), set by applySkillEffects().
    this.mods = { machine: 1, smelter: 1, assembly: 1, workerTask: 1, belt: 1, feed: 1, auto: 1 };
    this._beltAccumulator = 0;

    this.workers = [
      this.makeWorker(0, true),
      this.makeWorker(1, false)
    ];
    // Materials loaded from saveData — not hardcoded here
    this.materials = { plasticScrap: 0, refinedPlastic: 0, salvagedMetal: 0 };
    this.tutorialStep     = 0;
    this.tutorialComplete = false;
    this.worker2Introduced = false;
  }

  makeWorker(id, unlocked) {
    return {
      id,
      unlocked,
      state:         'idle',
      station:       'store_scrap',
      stationAction: null,
      progress:      0,
      inventory:     [],
      targetStation: null,   // station the worker is walking to (claims it)
      _producedTowerType: null,
      // ── Posted workers (Milestone 5) ──────────────────────────────
      route:      [],        // station keys of the cycle being learned / run
      looping:    false,     // true once the worker repeats the route alone
      routePos:   0,         // index in route of the station last worked
      waitingFor: null       // next route station, while it's blocked
    };
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  loadFromSave(saveData) {
    if (!saveData) return;
    if (saveData.workers >= 2) this.workers[1].unlocked = true;
    if (saveData.worker2Introduced) this.worker2Introduced = saveData.worker2Introduced;

    // Materials: canonical source is saveData.materials (top level).
    // Migration: if old save has factory.materials but no top-level materials, copy across.
    if (saveData.materials && (saveData.materials.plasticScrap !== undefined)) {
      this.materials = {
        plasticScrap:   saveData.materials.plasticScrap   || 0,
        refinedPlastic: saveData.materials.refinedPlastic || 0,
        salvagedMetal:  saveData.materials.salvagedMetal  || 0
      };
    } else if (saveData.factory && saveData.factory.materials) {
      // Legacy migration from old factory.materials format
      this.materials = { ...saveData.factory.materials };
    }

    if (!saveData.factory) return;
    const f = saveData.factory;
    if (f.grid) {
      this.grid = f.grid;
      // If saved grid is a different size, resize ROWS/COLS to match.
      // Older 5x5 saves are tolerated; FactoryScene cleans out-of-bounds
      // machines on load. Fresh 3x3 saves come through with matching size.
      this.ROWS = this.grid.length;
      this.COLS = this.grid[0] ? this.grid[0].length : this.COLS;
    }
    if (f.tileItems) {
      // Restore items-on-tiles. If the persisted array's dimensions don't match
      // the current grid (mid-version transition), reset to fresh empty grid.
      if (f.tileItems.length === this.ROWS && f.tileItems[0] && f.tileItems[0].length === this.COLS) {
        this.tileItems = f.tileItems;
      } else {
        this.tileItems = Array.from({ length: this.ROWS }, () => Array(this.COLS).fill(null));
      }
    } else {
      this.tileItems = Array.from({ length: this.ROWS }, () => Array(this.COLS).fill(null));
    }
    // Restore what each worker was carrying. Materials are deducted from the
    // pool at collection, so dropping carried items on save would destroy them.
    // In-progress work is not resumed — workers come back idle.
    if (Array.isArray(f.workers)) {
      f.workers.forEach((saved, i) => {
        const w = this.workers[i];
        if (!w || !saved) return;
        if (Array.isArray(saved.inventory)) w.inventory = saved.inventory.slice();
        w._producedTowerType = saved.producedTowerType || null;
        if (Array.isArray(saved.route)) w.route = saved.route.slice();
        w.looping  = !!saved.looping && w.route.length >= 2;
        w.routePos = saved.routePos || 0;
      });
    }
    if (typeof f.tutorialStep    === 'number')  this.tutorialStep     = f.tutorialStep;
    if (typeof f.tutorialComplete === 'boolean') this.tutorialComplete = f.tutorialComplete;

    // ── Version migration ─────────────────────────────────────────────────────
    // factoryVersion 1 = old tutorial (smelter-based, 7 steps, now broken)
    // factoryVersion 2 = new tutorial (assembly-only Gunner, 5 steps, state machine)
    // If an old save has tutorialComplete=true but factoryVersion < 2,
    // reset the tutorial so players get the new (correct) flow.
    const savedVersion = f.factoryVersion || 1;
    if (savedVersion < 2 && this.tutorialComplete) {
      this.tutorialComplete = false;
      this.tutorialStep     = 0;
    }
  }

  save() {
    SaveManager.update(saveData => this.writeInto(saveData));
  }

  writeInto(saveData) {
    // Write materials to canonical top-level location
    saveData.materials = {
      plasticScrap:   this.materials.plasticScrap   || 0,
      refinedPlastic: this.materials.refinedPlastic || 0,
      salvagedMetal:  this.materials.salvagedMetal  || 0
    };

    saveData.factory = {
      grid:             this.grid,
      tileItems:        this.tileItems,
      workers:          this.workers.map(w => ({
        inventory:         w.inventory.slice(),
        producedTowerType: w._producedTowerType,
        route:             w.route.slice(),
        looping:           w.looping,
        routePos:          w.routePos
      })),
      factoryVersion:   2,
      lastRun:          Date.now(),   // for catching up time spent away (M7)
      tutorialStep:     this.tutorialStep,
      tutorialComplete: this.tutorialComplete
    };
    saveData.worker2Introduced = this.worker2Introduced;
  }

  // ── Worker helpers ─────────────────────────────────────────────────────────

  getUnlockedWorkers() {
    return this.workers.filter(w => w.unlocked);
  }

  // A station is occupied by a worker working there OR walking to it, so two
  // workers can't both be sent for the same last unit / empty bench.
  getWorkerAtStation(stationKey) {
    return this.workers.find(w => w.unlocked && (
      (w.state === 'working' && w.station === stationKey) ||
      (w.state === 'walking' && w.targetStation === stationKey)
    ));
  }

  isAssemblyType(type) {
    return type && type.startsWith('assembly');
  }

  // ── Grid ───────────────────────────────────────────────────────────────────

  canPlace(row, col) {
    if (row < 0 || row >= this.ROWS || col < 0 || col >= this.COLS) return false;
    return this.grid[row][col] === null;
  }

  placeMachine(row, col, type) {
    if (!this.canPlace(row, col)) return false;
    if (type === 'conveyor') {
      // Default conveyor direction is east (right). Player rotates by tapping.
      this.grid[row][col] = { type, direction: 'E' };
    } else {
      this.grid[row][col] = {
        type,
        // Benches and smelters both hold one input item (smelters via belts, M6)
        heldMaterial: (this.isAssemblyType(type) || type === 'smelter') ? null : undefined
      };
    }
    return true;
  }

  deleteMachine(row, col) {
    if (!this.grid[row] || !this.grid[row][col]) return false;
    const key = row + ',' + col;
    // A route through a removed machine can't be run any more
    this.workers.forEach(w => { if (w.route.includes(key)) this.stopLoop(w.id); });
    this.workers.forEach(w => {
      if (w.station === key && w.state !== 'walking') {
        w.state = 'idle';
        w.progress = 0;
        w.stationAction = null;
      }
    });
    this.grid[row][col] = null;
    // Any item sitting on this tile (e.g. on a deleted conveyor) is lost.
    if (this.tileItems && this.tileItems[row]) this.tileItems[row][col] = null;
    return true;
  }

  getMachineAt(row, col) {
    if (row < 0 || row >= this.ROWS || col < 0 || col >= this.COLS) return null;
    return this.grid[row][col];
  }

  // ── Tile items API (Milestone 2/3) ─────────────────────────────────────────

  getTileItem(row, col) {
    if (row < 0 || row >= this.ROWS || col < 0 || col >= this.COLS) return null;
    return this.tileItems[row][col];
  }

  setTileItem(row, col, item) {
    if (row < 0 || row >= this.ROWS || col < 0 || col >= this.COLS) return false;
    this.tileItems[row][col] = item || null;
    return true;
  }

  // ── Conveyor helpers ───────────────────────────────────────────────────────

  rotateConveyor(row, col) {
    const m = this.getMachineAt(row, col);
    if (!m || m.type !== 'conveyor') return false;
    const order = ['N', 'E', 'S', 'W'];
    const i = order.indexOf(m.direction);
    m.direction = order[(i + 1) % 4];
    return true;
  }

  // Returns the next tile coordinate following a conveyor's direction.
  getConveyorTarget(row, col) {
    const m = this.getMachineAt(row, col);
    if (!m || m.type !== 'conveyor') return null;
    switch (m.direction) {
      case 'N': return { row: row - 1, col };
      case 'S': return { row: row + 1, col };
      case 'E': return { row, col: col + 1 };
      case 'W': return { row, col: col - 1 };
    }
    return null;
  }

  // ── Action system ──────────────────────────────────────────────────────────

  getWorkerAction(stationKey, workerId) {
    const w = this.workers[workerId];
    if (!w) return null;

    // ── Fixed stations ───────────────────────────────────────────────────────

    if (stationKey === 'store_scrap') {
      // Only allow collection if worker is empty AND scrap is available
      return (w.inventory.length === 0 && this.materials.plasticScrap > 0)
        ? 'collect_scrap'
        : null;
    }

    if (stationKey === 'store_metal') {
      // Only allow collection if worker is empty AND metal is available
      return (w.inventory.length === 0 && this.materials.salvagedMetal > 0)
        ? 'collect_metal'
        : null;
    }

    if (stationKey === 'depository') {
      return w.inventory.includes('towerComponent') ? 'deliver' : null;
    }

    // ── Grid machines ────────────────────────────────────────────────────────

    const [r, c] = stationKey.split(',').map(Number);
    const machine = this.getMachineAt(r, c);
    if (!machine) return null;

    // Conveyor: worker can drop their carried item onto the belt if it's empty.
    // Belt then carries the item along its direction over subsequent ticks.
    if (machine.type === 'conveyor') {
      if (w.inventory.length > 0 && this.tileItems[r][c] === null) {
        return 'drop_to_belt';
      }
      // Could also support pick-up later: if belt has item and worker empty.
      return null;
    }

    // Smelter: worker deposits scrap, gets refined plastic out
    if (machine.type === 'smelter') {
      return w.inventory.includes('plasticScrap') ? 'smelt' : null;
    }

    // Assembly: single-deposit per tower type
    // primaryInput defines what material this assembly needs.
    // Step 1 — worker has the material AND machine is empty → deposit
    // Step 2 — machine holds the material AND worker is empty → assemble
    if (this.isAssemblyType(machine.type)) {
      const pri = MACHINE_TYPES[machine.type].primaryInput;

      if (w.inventory.includes(pri) && machine.heldMaterial === null) {
        return 'deposit';
      }
      if (machine.heldMaterial === pri && w.inventory.length === 0) {
        return 'assemble';
      }
      return null;
    }

    return null;
  }

  canWorkerStartAt(stationKey, workerId) {
    const w = this.workers[workerId];
    if (!w || !w.unlocked) return false;
    const action   = this.getWorkerAction(stationKey, workerId);
    if (!action) return false;
    const occupant = this.getWorkerAtStation(stationKey);
    if (occupant && occupant.id !== workerId) return false;
    return true;
  }

  markWalking(stationKey, workerId) {
    const w = this.workers[workerId];
    if (!w) return;
    w.state         = 'walking';
    w.progress      = 0;
    w.targetStation = stationKey;
  }

  // Re-validates on arrival — stock, bench contents or the machine itself may
  // have changed during the walk. Returns false (worker goes idle) if so.
  startWorkAt(stationKey, workerId) {
    const w = this.workers[workerId];
    if (!w) return false;
    if (!this.canWorkerStartAt(stationKey, workerId)) {
      w.state         = 'idle';
      w.progress      = 0;
      w.targetStation = null;
      return false;
    }
    const action = this.getWorkerAction(stationKey, workerId);
    w.targetStation = null;
    w.station       = stationKey;
    w.state         = 'working';
    w.progress      = 0;
    w.stationAction = action;
    return true;
  }

  // ── Posted workers / routes (Milestone 5) ──────────────────────────────────
  // Workers learn a route by watching the player. A cycle starts whenever the
  // player sends a worker to collect from a store; every further job is
  // appended. Sending them back to the same store with the cycle complete
  // (2+ stops) means "do that again" — the worker starts looping on their own.
  // While looping, a job that can't be done yet (store empty, bench busy, belt
  // not delivered) makes them wait in place until it can.

  isSourceAction(action) {
    return action === 'collect_scrap' || action === 'collect_metal';
  }

  stationExists(key) {
    if (key === 'store_scrap' || key === 'store_metal' || key === 'depository') return true;
    const [r, c] = key.split(',').map(Number);
    return !!this.getMachineAt(r, c);
  }

  // Call when the player assigns a job. Returns 'learned' when this
  // assignment completes a route, 'stopped' when it overrides a running one.
  recordAssignment(stationKey, workerId) {
    const w = this.workers[workerId];
    if (!w) return null;
    const action = this.getWorkerAction(stationKey, workerId);
    let result = null;
    if (w.looping) { this.stopLoop(workerId); result = 'stopped'; }
    if (this.isSourceAction(action)) {
      if (!result && w.route.length >= 2 && w.route[0] === stationKey) {
        w.looping = true;
        w.routePos = 0;
        w.waitingFor = null;
        return 'learned';
      }
      w.route = [stationKey];
    } else if (w.route.length > 0) {
      w.route.push(stationKey);
      if (w.route.length > 8) w.route = [];   // too long to be a deliberate cycle
    }
    return result;
  }

  stopLoop(workerId) {
    const w = this.workers[workerId];
    if (!w) return;
    w.looping = false;
    w.route = [];
    w.routePos = 0;
    w.waitingFor = null;
  }

  // For a looping worker who is free, the next station to go to — or null if
  // it can't be done yet (sets waitingFor). Returns { stopped: true } if the
  // route is broken (a machine on it was removed).
  nextLoopStation(workerId) {
    const w = this.workers[workerId];
    if (!w || !w.unlocked || !w.looping || w.route.length < 2) return null;
    if (w.state === 'walking' || w.state === 'working') return null;
    const next = w.route[(w.routePos + 1) % w.route.length];
    if (!this.stationExists(next)) { this.stopLoop(workerId); return { stopped: true }; }
    if (this.canWorkerStartAt(next, workerId)) { w.waitingFor = null; return next; }
    w.waitingFor = next;
    return null;
  }

  advanceLoop(workerId) {
    const w = this.workers[workerId];
    if (w && w.route.length) w.routePos = (w.routePos + 1) % w.route.length;
  }

  // ── Update loop ────────────────────────────────────────────────────────────

  // ── Belt → bench handoff (Milestone 4) ────────────────────────────────
  // A belt feeds whatever machine it points at. An assembly bench accepts the
  // item only if it's the bench's primaryInput, its slot is empty, and no
  // worker is working at / walking to it (a worker deposit in flight would
  // otherwise land on top of the belt's item). Anything else waits on the belt.
  // Smelters don't take belt input yet (planned with smelter output, M6).
  // Input a machine takes from a belt (benches since M4, smelters since M6)
  machineInput(m) {
    if (!m) return null;
    if (this.isAssemblyType(m.type)) return MACHINE_TYPES[m.type].primaryInput;
    if (m.type === 'smelter') return 'plasticScrap';
    return null;
  }

  canBenchAcceptFromBelt(row, col, item) {
    const m = this.getMachineAt(row, col);
    const input = this.machineInput(m);
    if (!input || item !== input) return false;
    if (m.heldMaterial) return false;          // null, or undefined on old smelters
    if (m.autoOutput) return false;            // finished item still waiting to leave
    if (this.getWorkerAtStation(row + ',' + col)) return false;
    return true;
  }

  // Returns the wrong item jammed at the front of a belt feeding this bench,
  // or null. Used by the scene to label the bench "WRONG ITEM".
  getBenchJam(row, col) {
    const m = this.getMachineAt(row, col);
    const pri = this.machineInput(m);
    if (!pri) return null;
    const neighbours = [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]];
    for (const [r, c] of neighbours) {
      const t = this.getConveyorTarget(r, c);
      if (!t || t.row !== row || t.col !== col) continue;
      const item = this.getTileItem(r, c);
      if (item && item !== pri) return item;
    }
    return null;
  }

  // ── Belt tick (Milestone 3) ────────────────────────────────────────────
  // Two-phase to avoid order-of-iteration bias:
  //   1. Collect all (from, to) intended moves where source has item, dest is empty
  //   2. Resolve conflicts (multiple belts → same belt or bench) — only one wins, others wait
  //   3. Apply the surviving moves atomically
  _tickBelts() {
    const moves = [];
    for (let r = 0; r < this.ROWS; r++) {
      for (let c = 0; c < this.COLS; c++) {
        const m = this.grid[r][c];
        if (!m || m.type !== 'conveyor') continue;
        const item = this.tileItems[r][c];
        if (!item) continue;
        const target = this.getConveyorTarget(r, c);
        if (!target) continue;
        // Bottom-row belt pointing down delivers finished towers to the depository (M6)
        if (target.row === this.ROWS && this.isTowerItem(item)) {
          moves.push({ fromR: r, fromC: c, toR: -1, toC: c, item, toDepot: true });
          continue;
        }
        if (target.row < 0 || target.row >= this.ROWS) continue;
        if (target.col < 0 || target.col >= this.COLS) continue;
        const destMachine = this.grid[target.row][target.col];
        if (!destMachine) continue;
        if (destMachine.type === 'conveyor') {
          // Belt → belt: destination tile must be empty
          if (this.tileItems[target.row][target.col] !== null) continue;
          moves.push({ fromR: r, fromC: c, toR: target.row, toC: target.col, item, intoBench: false });
        } else if (this.canBenchAcceptFromBelt(target.row, target.col, item)) {
          // Belt → bench (M4): item goes into the bench's held slot
          moves.push({ fromR: r, fromC: c, toR: target.row, toC: target.col, item, intoBench: true });
        }
      }
    }

    // Resolve conflicts: if two belts want the same destination, first wins.
    // Survivors are applied; losers stay where they are.
    const claimed = new Set();
    moves.forEach(mv => {
      const key = mv.toR + ',' + mv.toC;
      if (claimed.has(key)) return;
      // Verify source still has the item and dest is still empty
      // (could have been claimed by an earlier move in this same phase)
      if (this.tileItems[mv.fromR][mv.fromC] !== mv.item) return;
      if (mv.toDepot) {
        this.tileItems[mv.fromR][mv.fromC] = null;
        this.deliveries.push(this.towerTypeOf(mv.item));
        return;
      }
      if (!mv.intoBench && this.tileItems[mv.toR][mv.toC] !== null) return;
      this.tileItems[mv.fromR][mv.fromC] = null;
      if (mv.intoBench) this.grid[mv.toR][mv.toC].heldMaterial = mv.item;
      else              this.tileItems[mv.toR][mv.toC] = mv.item;
      claimed.add(key);
    });
  }

  // ── Auto-output (Milestone 6) ──────────────────────────────────────────
  // Finished towers travel on belts as 'tower:<type>' items.
  isTowerItem(item) { return typeof item === 'string' && item.startsWith('tower:'); }
  towerTypeOf(item) { return item.slice(6) || 'gunner'; }

  // An adjacent belt the machine can push its output onto: one that doesn't
  // point back into the machine and whose tile is empty. Order: E, S, W, N.
  getOutputBelt(row, col) {
    for (const [dr, dc] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
      const r = row + dr, c = col + dc;
      const m = this.getMachineAt(r, c);
      if (!m || m.type !== 'conveyor') continue;
      const t = this.getConveyorTarget(r, c);
      if (t && t.row === row && t.col === col) continue;   // that one feeds us
      if (this.tileItems[r][c] !== null) continue;
      return { row: r, col: c };
    }
    return null;
  }

  hasOutputBelt(row, col) {
    for (const [dr, dc] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
      const m = this.getMachineAt(row + dr, col + dc);
      if (!m || m.type !== 'conveyor') continue;
      const t = this.getConveyorTarget(row + dr, col + dc);
      if (!(t && t.row === row && t.col === col)) return true;
    }
    return false;
  }

  // Feed tiles: top-left for scrap, top-right (of the current width) for metal
  feedTile(storeKey) {
    return storeKey === 'store_scrap' ? { row: 0, col: 0 } : { row: 0, col: this.COLS - 1 };
  }

  _feedStores() {
    Object.entries(this.STORE_FEEDS).forEach(([key, base]) => {
      const f = Object.assign({}, base, this.feedTile(key));
      const m = this.getMachineAt(f.row, f.col);
      if (!m || m.type !== 'conveyor') return;
      if (this.tileItems[f.row][f.col] !== null) return;
      if ((this.materials[f.mat] || 0) <= 0) return;
      this.materials[f.mat]--;
      this.tileItems[f.row][f.col] = f.item;
    });
  }

  // Loaded benches/smelters with an outgoing belt process on their own and
  // push the result onto that belt. A worker at the machine takes priority.
  _tickMachines(delta) {
    for (let r = 0; r < this.ROWS; r++) for (let c = 0; c < this.COLS; c++) {
      const m = this.grid[r][c];
      if (!m || !this.machineInput(m)) continue;
      const busy = this.workers.some(w => w.unlocked && w.state === 'working' && w.station === r + ',' + c);
      if (busy) { m.autoProgress = 0; continue; }
      if (m.autoOutput) {                     // finished; waiting for room on a belt
        const out = this.getOutputBelt(r, c);
        if (out) { this.tileItems[out.row][out.col] = m.autoOutput; m.autoOutput = null; }
        continue;
      }
      if (!m.heldMaterial || !this.hasOutputBelt(r, c)) { m.autoProgress = 0; continue; }
      const duration = this.machineDuration(m) * this.mods.auto;
      m.autoProgress = (m.autoProgress || 0) + delta / duration;
      if (m.autoProgress < 1) continue;
      m.autoProgress = 0;
      m.heldMaterial = null;
      m.autoOutput = m.type === 'smelter' ? 'refinedPlastic' : 'tower:' + MACHINE_TYPES[m.type].produces;
      const out = this.getOutputBelt(r, c);
      if (out) { this.tileItems[out.row][out.col] = m.autoOutput; m.autoOutput = null; }
    }
  }

  // Towers delivered by belt since the last call (scene adds them to the stockpile)
  takeDeliveries() {
    const d = this.deliveries;
    this.deliveries = [];
    return d;
  }

  // ── Skill tree (Milestone 7) ───────────────────────────────────────────────
  // Pulls speed modifiers and grid size from the skill-tree effects object.
  applySkillEffects(fx) {
    if (!fx) return;
    this.mods = {
      machine:    fx.getMachineSpeed(),
      smelter:    fx.state.machineSpeedSmelter,
      assembly:   fx.state.machineSpeedAssembly,
      workerTask: fx.getWorkerTaskSpeed(),
      belt:       fx.getBeltSpeed(),
      feed:       fx.getStoreFeedSpeed(),
      auto:       fx.getAutoSpeed()
    };
    const g = fx.getFactoryGrid();
    this.setSize(g.rows, g.cols);
  }

  // Resize the floor to rows × cols. Machines outside the new bounds (only
  // possible for very old 5x5 saves) are removed; their tiles are dropped.
  setSize(rows, cols) {
    const removed = [];
    for (let r = 0; r < this.grid.length; r++) for (let c = 0; c < (this.grid[r] || []).length; c++) {
      if ((r >= rows || c >= cols) && this.grid[r][c]) removed.push({ row: r, col: c, machine: this.grid[r][c] });
    }
    const grid = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => (this.grid[r] && this.grid[r][c]) || null));
    const items = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => (this.tileItems[r] && this.tileItems[r][c]) || null));
    this.grid = grid; this.tileItems = items; this.ROWS = rows; this.COLS = cols;
    return removed;
  }

  // Durations, scaled by the skill tree
  machineDuration(m) {
    const base = m.type === 'smelter' ? MACHINE_TYPES.smelter.duration : MACHINE_TYPES[m.type].duration;
    const typeMod = m.type === 'smelter' ? this.mods.smelter : this.mods.assembly;
    return base * this.mods.machine * typeMod;
  }

  // ── Running while away (Milestone 7: Partial Auto / Full Automation) ──────
  // Fast-forwards the factory by ms. Automated parts (store feeds, belts,
  // self-running machines) always run; workers only when withWorkers, and
  // then only those on routes (walks take a fixed time off-screen).
  catchUp(ms, withWorkers) {
    const step = 250, OFFSCREEN_WALK_MS = 1500;
    const towersBefore = this.deliveries.length;
    for (let t = 0; t < ms; t += step) {
      const done = this.update(step, { workers: withWorkers });
      done.forEach(id => {
        const w = this.workers[id];
        if (w.station === 'depository') { this.deliveries.push(w._producedTowerType || 'gunner'); w._producedTowerType = null; }
      });
      if (!withWorkers) continue;
      this.workers.forEach(w => {
        if (w._offWalk !== undefined) {
          w._offWalk -= step;
          if (w._offWalk <= 0) { const k = w._offTarget; delete w._offWalk; delete w._offTarget; this.startWorkAt(k, w.id); }
          return;
        }
        const next = this.nextLoopStation(w.id);
        if (!next || next.stopped) return;
        this.advanceLoop(w.id);
        this.markWalking(next, w.id);
        w._offWalk = OFFSCREEN_WALK_MS; w._offTarget = next;
      });
    }
    // Anyone mid-walk when the catch-up ends goes back to waiting; the scene
    // picks their route up again.
    this.workers.forEach(w => { if (w._offWalk !== undefined) { delete w._offWalk; delete w._offTarget; w.state = 'waiting'; w.targetStation = null; w.routePos = (w.routePos - 1 + w.route.length) % (w.route.length || 1); } });
    return this.deliveries.length - towersBefore;
  }

  update(delta, opts) {
    const completed = [];
    const runWorkers = !opts || opts.workers !== false;

    this._feedAccumulator += delta;
    while (this._feedAccumulator >= this.STORE_FEED_MS * this.mods.feed) {
      this._feedAccumulator -= this.STORE_FEED_MS * this.mods.feed;
      this._feedStores();
    }
    this._tickMachines(delta);

    // ── Belt tick (Milestone 3) ──────────────────────────────────────────
    // Conveyors advance their items every BELT_TICK_MS. Accumulator handles
    // variable frame delta. Items only move into empty destination tiles —
    // backed-up belts cause queueing. Multiple ticks per frame are possible
    // if delta is huge (e.g. tab regained focus).
    this._beltAccumulator += delta;
    while (this._beltAccumulator >= this.BELT_TICK_MS * this.mods.belt) {
      this._beltAccumulator -= this.BELT_TICK_MS * this.mods.belt;
      this._tickBelts();
    }

    this.workers.forEach(w => {
      if (!runWorkers || !w.unlocked || w.state !== 'working') return;

      const station = w.station;
      let duration;

      if (station === 'store_scrap' || station === 'store_metal') {
        duration = 4000 * this.mods.workerTask;
      } else if (station === 'depository') {
        duration = 2500 * this.mods.workerTask;
      } else {
        const [r, c] = station.split(',').map(Number);
        const machine = this.getMachineAt(r, c);
        if (!machine) { w.state = 'idle'; return; }

        if (machine.type === 'conveyor') {
          duration = 1500 * this.mods.workerTask;   // quick drop, similar to deposit
        } else if (machine.type === 'smelter') {
          duration = this.machineDuration(machine);
        } else if (this.isAssemblyType(machine.type)) {
          duration = w.stationAction === 'deposit'
            ? MACHINE_TYPES[machine.type].depositDuration * this.mods.workerTask
            : this.machineDuration(machine);
        } else {
          duration = 5000;
        }
      }

      w.progress += delta / duration;

      if (w.progress >= 1) {
        w.progress = 1;
        w.state    = 'waiting';
        this.completeWorkAt(station, w.id);
        completed.push(w.id);
      }
    });

    return completed;
  }

  // ── Work completion ────────────────────────────────────────────────────────

  completeWorkAt(station, workerId) {
    const w = this.workers[workerId];
    if (!w) return;

    // ── Fixed station completions ────────────────────────────────────────────

    if (station === 'store_scrap') {
      // Deduct 1 unit from the material pool
      this.materials.plasticScrap = Math.max(0, this.materials.plasticScrap - 1);
      w.inventory = ['plasticScrap'];
      return;
    }

    if (station === 'store_metal') {
      this.materials.salvagedMetal = Math.max(0, this.materials.salvagedMetal - 1);
      w.inventory = ['salvagedMetal'];
      return;
    }

    if (station === 'depository') {
      w.inventory = [];
      return;
    }

    // ── Machine completions ──────────────────────────────────────────────────

    const [r, c] = station.split(',').map(Number);
    const machine = this.getMachineAt(r, c);
    if (!machine) return;

    // Conveyor drop: take first item from worker, place on tile.
    if (machine.type === 'conveyor') {
      if (w.inventory.length > 0 && this.tileItems[r][c] === null) {
        let item = w.inventory.shift();
        // A finished tower dropped on a belt travels as 'tower:<type>' (M6)
        if (item === 'towerComponent') { item = 'tower:' + (w._producedTowerType || 'gunner'); w._producedTowerType = null; }
        this.tileItems[r][c] = item;
      }
      return;
    }

    // Smelter: consume scrap, output refined plastic
    if (machine.type === 'smelter') {
      w.inventory = w.inventory.filter(i => i !== 'plasticScrap');
      w.inventory.push('refinedPlastic');
      return;
    }

    // Assembly — single-deposit flow:
    // deposit: worker hands over primaryInput to machine
    // assemble: machine produces towerComponent from held material
    if (this.isAssemblyType(machine.type)) {
      const pri = MACHINE_TYPES[machine.type].primaryInput;

      if (w.stationAction === 'deposit') {
        if (machine.heldMaterial !== null) return;   // slot filled meanwhile — keep item
        w.inventory = w.inventory.filter(i => i !== pri);
        machine.heldMaterial = pri;
        return;
      }

      if (w.stationAction === 'assemble') {
        machine.heldMaterial = null;
        w.inventory.push('towerComponent');
        w._producedTowerType = MACHINE_TYPES[machine.type].produces;
        return;
      }
    }
  }

  // ── Display helpers ────────────────────────────────────────────────────────

  getInventoryDisplay(workerId) {
    const w = this.workers[workerId];
    if (!w || w.inventory.length === 0) return 'EMPTY';
    const labels = {
      plasticScrap:   'SCRAP',
      salvagedMetal:  'METAL',
      refinedPlastic: 'REFINED',
      towerComponent: 'TOWER \u2605'
    };
    return w.inventory.map(i => labels[i] || i.toUpperCase()).join(' + ');
  }

  getMaterialCount(type) {
    return this.materials[type] || 0;
  }
}
