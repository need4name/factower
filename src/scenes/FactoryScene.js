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
  }
};

const WORKER_COLOURS = [0xe8a020, 0x3a8fc4];
const WORKER_LABELS  = ['W1', 'W2'];

class Factory {
  constructor() {
    this.COLS = 5;
    this.ROWS = 5;
    this.grid = Array.from({ length: this.ROWS }, () => Array(this.COLS).fill(null));
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
    if (f.grid) this.grid = f.grid;
    if (typeof f.tutorialStep    === 'number')  this.tutorialStep     = f.tutorialStep;
    if (typeof f.tutorialComplete === 'boolean') this.tutorialComplete = f.tutorialComplete;
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
    this.grid[row][col] = {
      type,
      heldMaterial: this.isAssemblyType(type) ? null : undefined
    };
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
    return true;
  }

  getMachineAt(row, col) {
    if (row < 0 || row >= this.ROWS || col < 0 || col >= this.COLS) return null;
    return this.grid[row][col];
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

  update(delta) {
    const completed = [];

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

        if (machine.type === 'smelter') {
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
