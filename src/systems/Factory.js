const MACHINE_TYPES = {
  smelter: {
    key: 'smelter',
    name: 'SMELTER',
    colour: 0xe8a020,
    colourHex: '#e8a020',
    inputItems: ['plasticScrap'],
    outputItem: 'refinedPlastic',
    duration: 20000
  },
  assembly: {
    key: 'assembly',
    name: 'ASSEMBLY BENCH',
    colour: 0x5eba7d,
    colourHex: '#5eba7d',
    inputItems: ['refinedPlastic', 'salvagedMetal'],
    outputItem: 'towerComponent',
    duration: 20000
  }
};

class Factory {
  constructor() {
    this.COLS = 5;
    this.ROWS = 7;
    this.grid = Array.from({ length: this.ROWS }, () => Array(this.COLS).fill(null));
    this.resetWorker();
    this.materials = { plasticScrap: 50, salvagedMetal: 50 };
    this.tutorialStep = 0;
    this.tutorialComplete = false;
  }

  resetWorker() {
    this.worker = {
      state: 'idle',
      station: 'store',
      progress: 0,
      inventory: []
    };
  }

  loadFromSave(saveData) {
    if (!saveData || !saveData.factory) return;
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
    localStorage.setItem(saveKey, JSON.stringify(saveData));
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
    if (this.worker.station === `${row},${col}`) this.resetWorker();
    this.grid[row][col] = null;
    return true;
  }

  getMachineAt(row, col) {
    if (row < 0 || row >= this.ROWS || col < 0 || col >= this.COLS) return null;
    return this.grid[row][col];
  }

  canWorkerStartAt(stationKey) {
    if (stationKey === 'store') return this.worker.inventory.length === 0;
    if (stationKey === 'depository') return this.worker.inventory.includes('towerComponent');
    const [r, c] = stationKey.split(',').map(Number);
    const machine = this.getMachineAt(r, c);
    if (!machine) return false;
    return MACHINE_TYPES[machine.type].inputItems.every(i => this.worker.inventory.includes(i));
  }

  startWorkAt(stationKey) {
    this.worker.station = stationKey;
    this.worker.state = 'working';
    this.worker.progress = 0;
  }

  // Returns true if work completed this tick
  update(delta) {
    if (this.worker.state !== 'working') return false;

    const station = this.worker.station;
    let duration;

    if (station === 'store') {
      duration = 5000;
    } else if (station === 'depository') {
      duration = 3000;
    } else {
      const [r, c] = station.split(',').map(Number);
      const machine = this.getMachineAt(r, c);
      if (!machine) { this.worker.state = 'idle'; return false; }
      duration = MACHINE_TYPES[machine.type].duration;
    }

    this.worker.progress += delta / duration;

    if (this.worker.progress >= 1) {
      this.worker.progress = 1;
      this.worker.state = 'waiting';
      this.completeWorkAt(station);
      return true;
    }

    return false;
  }

  completeWorkAt(station) {
    if (station === 'store') {
      this.worker.inventory = ['plasticScrap', 'salvagedMetal'];
    } else if (station === 'depository') {
      this.worker.inventory = [];
    } else {
      const [r, c] = station.split(',').map(Number);
      const machine = this.getMachineAt(r, c);
      if (!machine) return;
      const mt = MACHINE_TYPES[machine.type];
      mt.inputItems.forEach(item => {
        const idx = this.worker.inventory.indexOf(item);
        if (idx !== -1) this.worker.inventory.splice(idx, 1);
      });
      this.worker.inventory.push(mt.outputItem);
    }
  }

  getInventoryDisplay() {
    if (this.worker.inventory.length === 0) return 'EMPTY';
    return this.worker.inventory.map(i => ({
      plasticScrap: 'SCRAP',
      salvagedMetal: 'METAL',
      refinedPlastic: 'REFINED',
      towerComponent: 'TOWER ★'
    }[i] || i.toUpperCase())).join(' + ');
  }
}
