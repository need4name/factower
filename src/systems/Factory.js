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
      station: 'store_scrap',
      stationAction: null,
      progress: 0,
      inventory: [],
      _producedTowerType: null
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

  isAssemblyType(type) {
    return type && type.startsWith('assembly');
  }

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

  getWorkerAction(stationKey, workerId) {
    const w = this.workers[workerId];
    if (!w) return null;

    if (stationKey === 'store_scrap') {
      return w.inventory.length === 0 ? 'collect_scrap' : null;
    }
    if (stationKey === 'store_metal') {
      return w.inventory.length === 0 ? 'collect_metal' : null;
    }
    if (stationKey === 'depository') {
      return w.inventory.includes('towerComponent') ? 'deliver' : null;
    }

    const [r, c] = stationKey.split(',').map(Number);
    const machine = this.getMachineAt(r, c);
    if (!machine) return null;

    if (machine.type === 'smelter') {
      return w.inventory.includes('plasticScrap') ? 'smelt' : null;
    }

    if (this.isAssemblyType(machine.type)) {
      if (w.inventory.includes('refinedPlastic') && machine.heldMaterial === null) {
        return 'deposit';
      }
      if (w.inventory.includes('salvagedMetal') && machine.heldMaterial === 'refinedPlastic') {
        return 'assemble';
      }
      return null;
    }

    return null;
  }

  canWorkerStartAt(stationKey, workerId) {
    const w = this.workers[workerId];
    if (!w || !w.unlocked) return false;
    const action = this.getWorkerAction(stationKey, workerId);
    if (!action) return false;
    const occupant = this.getWorkerAtStation(stationKey);
    if (occupant && occupant.id !== workerId) return false;
    return true;
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

    if (station === 'store_scrap') {
      w.inventory = ['plasticScrap'];
      return;
    }
    if (station === 'store_metal') {
      w.inventory = ['salvagedMetal'];
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
      w.inventory = w.inventory.filter(i => i !== 'plasticScrap');
      w.inventory.push('refinedPlastic');
      return;
    }

    if (this.isAssemblyType(machine.type)) {
      if (w.stationAction === 'deposit') {
        w.inventory = w.inventory.filter(i => i !== 'refinedPlastic');
        machine.heldMaterial = 'refinedPlastic';
        return;
      }
      if (w.stationAction === 'assemble') {
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
}
