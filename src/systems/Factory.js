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
      _producedTowerType: null
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
    const slotIndex = localStorage.getItem('factower_active_slot');
    const saveKey   = 'factower_save_' + slotIndex;
    const saveData  = JSON.parse(localStorage.getItem(saveKey));

    // Write materials to canonical top-level location
    saveData.materials = {
      plasticScrap:   this.materials.plasticScrap   || 0,
      refinedPlastic: this.materials.refinedPlastic || 0,
      salvagedMetal:  this.materials.salvagedMetal  || 0
    };

    saveData.factory = {
      grid:             this.grid,
      tileItems:        this.tileItems,
      factoryVersion:   2,
      tutorialStep:     this.tutorialStep,
      tutorialComplete: this.tutorialComplete
    };
    saveData.worker2Introduced = this.worker2Introduced;
    localStorage.setItem(saveKey, JSON.stringify(saveData));
  }

  // ── Worker helpers ─────────────────────────────────────────────────────────

  getUnlockedWorkers() {
    return this.workers.filter(w => w.unlocked);
  }

  getWorkerAtStation(stationKey) {
    return this.workers.find(w => w.unlocked && w.station === stationKey && w.state === 'working');
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
        heldMaterial: this.isAssemblyType(type) ? null : undefined
      };
    }
    return true;
  }

  deleteMachine(row, col) {
    if (!this.grid[row] || !this.grid[row][col]) return false;
    const key = row + ',' + col;
    this.workers.forEach(w => {
      if (w.station === key) {
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

  startWorkAt(stationKey, workerId) {
    const w = this.workers[workerId];
    if (!w) return;
    const action = this.getWorkerAction(stationKey, workerId);
    w.station       = stationKey;
    w.state         = 'working';
    w.progress      = 0;
    w.stationAction = action;
  }

  // ── Update loop ────────────────────────────────────────────────────────────

  // ── Belt tick (Milestone 3) ────────────────────────────────────────────
  // Two-phase to avoid order-of-iteration bias:
  //   1. Collect all (from, to) intended moves where source has item, dest is empty
  //   2. Resolve conflicts (multiple belts → same dest) — only one wins, others wait
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
        if (target.row < 0 || target.row >= this.ROWS) continue;
        if (target.col < 0 || target.col >= this.COLS) continue;
        // Destination must be empty (no item there yet)
        if (this.tileItems[target.row][target.col] !== null) continue;
        // Destination must be a conveyor or accept items (assembly bench, smelter)
        // For M3 simplicity: only conveyor → conveyor moves auto-flow.
        // Hand-off to assembly/smelter is handled later (workers still tap).
        const destMachine = this.grid[target.row][target.col];
        if (!destMachine || destMachine.type !== 'conveyor') continue;
        moves.push({ fromR: r, fromC: c, toR: target.row, toC: target.col, item });
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
      if (this.tileItems[mv.toR][mv.toC] !== null) return;
      this.tileItems[mv.fromR][mv.fromC] = null;
      this.tileItems[mv.toR][mv.toC]     = mv.item;
      claimed.add(key);
    });
  }

  update(delta) {
    const completed = [];

    // ── Belt tick (Milestone 3) ──────────────────────────────────────────
    // Conveyors advance their items every BELT_TICK_MS. Accumulator handles
    // variable frame delta. Items only move into empty destination tiles —
    // backed-up belts cause queueing. Multiple ticks per frame are possible
    // if delta is huge (e.g. tab regained focus).
    this._beltAccumulator += delta;
    while (this._beltAccumulator >= this.BELT_TICK_MS) {
      this._beltAccumulator -= this.BELT_TICK_MS;
      this._tickBelts();
    }

    this.workers.forEach(w => {
      if (!w.unlocked || w.state !== 'working') return;

      const station = w.station;
      let duration;

      if (station === 'store_scrap' || station === 'store_metal') {
        duration = 4000;
      } else if (station === 'depository') {
        duration = 2500;
      } else {
        const [r, c] = station.split(',').map(Number);
        const machine = this.getMachineAt(r, c);
        if (!machine) { w.state = 'idle'; return; }

        if (machine.type === 'conveyor') {
          duration = 1500;   // quick drop, similar to deposit
        } else if (machine.type === 'smelter') {
          duration = 12000;
        } else if (this.isAssemblyType(machine.type)) {
          duration = w.stationAction === 'deposit'
            ? MACHINE_TYPES[machine.type].depositDuration
            : MACHINE_TYPES[machine.type].duration;
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
        const item = w.inventory.shift();
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
