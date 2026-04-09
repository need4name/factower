const MACHINE_TYPES = {
  smelter: {
    key: 'smelter',
    name: 'SMELTER',
    colour: 0xe8a020,
    colourHex: '#e8a020',
    inputItems: ['plasticScrap'],
    outputItem: 'refinedPlastic',
    duration: 8500
  },
  assembly: {
    key: 'assembly',
    name: 'ASSEMBLY BENCH',
    colour: 0x5eba7d,
    colourHex: '#5eba7d',
    inputItems: ['refinedPlastic', 'salvagedMetal'],
    outputItem: 'towerComponent',
    duration: 3500
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
      progress: 0,
      inventory: []
    };
  }

  loadFromSave(saveData) {
    if (!saveData) return;

    // Unlock worker 2 if save says so
    if (saveData.workers >= 2) {
      this.workers[1].unlocked = true;
    }

    if (saveData.worker2Introduced) {
      this.worker2Introduced = saveData.worker2Introduced;
    }

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

  getWorker(id) {
    return this.workers[id];
  }

  getUnlockedWorkers() {
    return this.workers.filter(w => w.unlocked);
  }

  getIdleWorkers() {
    return this.workers.filter(w => w.unlocked && w.state !== 'walking' && w.state !== 'working');
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
    this.grid[row][col] = { type };
    return true;
  }

  deleteMachine(row, col) {
    if (!this.grid[row] || !this.grid[row][col]) return false;
    const key = `${row},${col}`;
    this.workers.forEach(w => {
      if (w.station === key) {
        w.state = 'idle';
        w.progress = 0;
      }
    });
    this.grid[row][col] = null;
    return true;
  }

  getMachineAt(row, col) {
    if (row < 0 || row >= this.ROWS || col < 0 || col >= this.COLS) return null;
    return this.grid[row][col];
  }

  canWorkerStartAt(stationKey, workerId) {
    const w = this.workers[workerId];
    if (!w || !w.unlocked) return false;

    // Check station not already occupied by another worker
    const occupant = this.getWorkerAtStation(stationKey);
    if (occupant && occupant.id !== workerId) return false;

    if (stationKey === 'store') return w.inventory.length === 0;
    if (stationKey === 'depository') return w.inventory.includes('towerComponent');

    const [r, c] = stationKey.split(',').map(Number);
    const machine = this.getMachineAt(r, c);
    if (!machine) return false;
    return MACHINE_TYPES[machine.type].inputItems.every(i => w.inventory.includes(i));
  }

  startWorkAt(stationKey, workerId) {
    const w = this.workers[workerId];
    if (!w) return;
    w.station = stationKey;
    w.state = 'working';
    w.progress = 0;
  }

  // Returns array of worker ids that completed work this tick
  update(delta) {
    const completed = [];

    this.workers.forEach(w => {
      if (!w.unlocked || w.state !== 'working') return;

      const station = w.station;
      let duration;

      if (station === 'store') {
        duration = 5000;
      } else if (station === 'depository') {
        duration = 3000;
      } else {
        const [r, c] = station.split(',').map(Number);
        const machine = this.getMachineAt(r, c);
        if (!machine) { w.state = 'idle'; return; }
        duration = MACHINE_TYPES[machine.type].duration;
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
      w.inventory = ['plasticScrap', 'salvagedMetal'];
    } else if (station === 'depository') {
      w.inventory = [];
    } else {
      const [r, c] = station.split(',').map(Number);
      const machine = this.getMachineAt(r, c);
      if (!machine) return;
      const mt = MACHINE_TYPES[machine.type];
      mt.inputItems.forEach(item => {
        const idx = w.inventory.indexOf(item);
        if (idx !== -1) w.inventory.splice(idx, 1);
      });
      w.inventory.push(mt.outputItem);
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
