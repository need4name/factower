const MACHINE_TYPES = {
  smelter: {
    key: 'smelter',
    name: 'SMELTER',
    colour: 0xe8a020,
    colourHex: '#e8a020',
    inputItems: ['plasticScrap'],
    outputItem: 'refinedPlastic',
    duration: 12000
  },
  assembly_gunner: {
    key: 'assembly_gunner',
    name: 'ASSEMBLY · GUNNER',
    shortName: 'ASM·GUN',
    colour: 0x3a8fc4,
    colourHex: '#3a8fc4',
    produces: 'gunner',
    duration: 5000,
    depositDuration: 1500
  },
  assembly_bomber: {
    key: 'assembly_bomber',
    name: 'ASSEMBLY · BOMBER',
    shortName: 'ASM·BMB',
    colour: 0xe8a020,
    colourHex: '#e8a020',
    produces: 'bomber',
    duration: 5000,
    depositDuration: 1500
  },
  assembly_barricade: {
    key: 'assembly_barricade',
    name: 'ASSEMBLY · BARRICADE',
    shortName: 'ASM·BAR',
    colour: 0xc43a3a,
    colourHex: '#c43a3a',
    produces: 'barricade',
    duration: 5000,
    depositDuration: 1500
  }
};

const WORKER_COLOURS = [0xe8a020, 0x3a8fc4];
const WORKER_LABELS = ['W1', 'W2'];

class Factory {
  constructor() {
    this.COLS = 5;
    this.ROWS = 5;
    this.grid = Array.from({ length: this.ROWS }, () => Array(this.COLS).fill(null));
    this.workers = [
      this.makeWorker(0, true),
      this.makeWorker(1, false)
    ];
    this.materials = { plasticScrap: 50, salvagedMetal: 50 };
    this.tutorialStep = 0;
    this.tutorialComplete = false;
    this.worker2Introduced = false;
  }

  makeWorker(id, unlocked) {
    return {
      id,
      unlocked,
      state: 'idle',
      station: 'store',
      stationAction: null, // 'deposit' or 'assemble'
      progress: 0,
      inventory: []
    };
  }

  loadFromSave(saveData) {
    if (!saveData) return;
    if (saveData.workers >= 2) this.workers[1].unlocked = true;
    if (saveData.worker2Introduced) this.worker2Introduced = saveData.worker2Introduced;
    if (!saveData.factory) return;
    const f = saveData.factory;
    if (f.grid) this.grid = f.grid;
    if (f.materials) this.materials = f.materials;
    if (typeof f.tutorialStep === 'number') this.tutorialStep = f.tutorialStep;
    if (typeof f.tutorialComplete === 'boolean') this.tutorialComplete = f.tutorialComplete;
  }

  save() {
    const slotIndex = localStorage.getItem('factower_active_slot');
    const saveKey = `factower_save_${slotIndex}`;
    const saveData = JSON.parse(localStorage.getItem(saveKey));
    saveData.factory = {
      grid: this.grid,
      materials: this.materials,
      tutorialStep: this.tutorialStep,
      tutorialComplete: this.tutorialComplete
    };
    saveData.worker2Introduced = this.worker2Introduced;
    localStorage.setItem(saveKey, JSON.stringify(saveData));
  }

  getUnlockedWorkers() {
    return this.workers.filter(w => w.unlocked);
  }

  getWorkerAtStation(stationKey) {
    return this.workers.find(w => w.unlocked && w.station === stationKey && w.state === 'working');
  }

  canPlace(row, col) {
    if (row < 0 || row >= this.ROWS || col < 0 || col >= this.COLS) return false;
    return this.grid[row][col] === null;
  }

  placeMachine(row, col, type) {
    if (!this.canPlace(row, col)) return false;
    const isAssembly = type.startsWith('assembly');
    this.grid[row][col] = {
      type,
      // Assembly benches hold refined plastic waiting for metal
      heldMaterial: isAssembly ? null : undefined
    };
    return true;
  }

  deleteMachine(row, col) {
    if (!this.grid[row] || !this.grid[row][col]) return false;
    const key = `${row},${col}`;
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

  isAssemblyType(type) {
    return type && type.startsWith('assembly');
  }

  // Determine what action a worker would do at this station
  getWorkerAction(stationKey, workerId) {
    const w = this.workers[workerId];
    if (!w) return null;

    if (stationKey === 'store') {
      if (w.inventory.length > 0) return null;
      return 'collect';
    }

    if (stationKey === 'depository') {
      if (w.inventory.includes('towerComponent')) return 'deliver';
      return null;
    }

    const [r, c] = stationKey.split(',').map(Number);
    const machine = this.getMachineAt(r, c);
    if (!machine) return null;

    if (machine.type === 'smelter') {
      if (w.inventory.includes('plasticScrap')) return 'smelt';
      return null;
    }

    if (this.isAssemblyType(machine.type)) {
      // Worker has refined plastic — deposit it
      if (w.inventory.includes('refinedPlastic') && machine.heldMaterial === null) {
        return 'deposit';
      }
      // Worker has salvaged metal and bench has refined plastic — assemble
      if (w.inventory.includes('salvagedMetal') && machine.heldMaterial === 'refinedPlastic') {
        return 'assemble';
      }
      return null;
    }

    return null;
  }

  canWorkerStartAt(stationKey, workerId) {
    const action = this.getWorkerAction(stationKey, workerId);
    if (!action) return false;

    // Check station not already occupied by another working worker
    const occupant = this.getWorkerAtStation(stationKey);
    if (occupant && occupant.id !== workerId) return false;

    return true;
  }

  // What should the store give this worker?
  getStoreRequest(workerId) {
    const w = this.workers[workerId];
    if (w.inventory.length > 0) return null;
    // Default: collect scrap (first trip)
    return 'plasticScrap';
  }

  // Force store to give salvaged metal instead
  setStoreRequestMetal(workerId) {
    this.workers[workerId]._nextStoreItem = 'salvagedMetal';
  }

  startWorkAt(stationKey, workerId) {
    const w = this.workers[workerId];
    if (!w) return;
    const action = this.getWorkerAction(stationKey, workerId);
    w.station = stationKey;
    w.state = 'working';
    w.progress = 0;
    w.stationAction = action;
  }

  update(delta) {
    const completed = [];

    this.workers.forEach(w => {
      if (!w.unlocked || w.state !== 'working') return;

      const station = w.station;
      let duration;

      if (station === 'store') {
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
          duration = w.stationAction === 'deposit' ? 1500 : 5000;
        } else {
          duration = 5000;
        }
      }

      w.progress += delta / duration;

      if (w.progress >= 1) {
        w.progress = 1;
        w.state = 'waiting';
        this.completeWorkAt(station, w.id);
        completed.push(w.id);
      }
    });

    return completed;
  }

  completeWorkAt(station, workerId) {
    const w = this.workers[workerId];
    if (!w) return;

    if (station === 'store') {
      // Give what was requested
      const item = w._nextStoreItem || 'plasticScrap';
      w._nextStoreItem = null;
      w.inventory = [item];
      return;
    }

    if (station === 'depository') {
      w.inventory = [];
      return;
    }

    const [r, c] = station.split(',').map(Number);
    const machine = this.getMachineAt(r, c);
    if (!machine) return;

    if (machine.type === 'smelter') {
      // Scrap → Refined Plastic
      w.inventory = w.inventory.filter(i => i !== 'plasticScrap');
      w.inventory.push('refinedPlastic');
      return;
    }

    if (this.isAssemblyType(machine.type)) {
      if (w.stationAction === 'deposit') {
        // Deposit refined plastic into bench
        w.inventory = w.inventory.filter(i => i !== 'refinedPlastic');
        machine.heldMaterial = 'refinedPlastic';
        return;
      }

      if (w.stationAction === 'assemble') {
        // Consume metal + held plastic, produce tower
        w.inventory = w.inventory.filter(i => i !== 'salvagedMetal');
        machine.heldMaterial = null;
        w.inventory.push('towerComponent');
        w._producedTowerType = MACHINE_TYPES[machine.type].produces;
        return;
      }
    }
  }

  getInventoryDisplay(workerId) {
    const w = this.workers[workerId];
    if (!w || w.inventory.length === 0) return 'EMPTY';
    return w.inventory.map(i => ({
      plasticScrap: 'SCRAP',
      salvagedMetal: 'METAL',
      refinedPlastic: 'REFINED',
      towerComponent: 'TOWER ★'
    }[i] || i.toUpperCase())).join(' + ');
  }

  getMachineStatusText(row, col) {
    const machine = this.getMachineAt(row, col);
    if (!machine) return '';
    if (this.isAssemblyType(machine.type)) {
      if (machine.heldMaterial === 'refinedPlastic') return '+ REFINED';
      return 'EMPTY';
    }
    return '';
  }
}
