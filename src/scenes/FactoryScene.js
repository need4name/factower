class FactoryScene extends Phaser.Scene {
  constructor() {
    super({ key: 'FactoryScene' });
  }

  create() {
    const { width, height } = this.scale;

    // Load save
    const slotIndex = localStorage.getItem('factower_active_slot');
    const saveKey = `factower_save_${slotIndex}`;
    this.saveData = JSON.parse(localStorage.getItem(saveKey));

    // Factory logic
    this.factory = new Factory();
    this.factory.loadFromSave(this.saveData);

    // Layout constants
    this.TILE = 52;
    this.COLS = 5;
    this.ROWS = 7;
    this.GX = (width - this.TILE * this.COLS) / 2;
    this.GY = 172;
    this.STORE_Y = 134;
    this.DEPOT_Y = this.GY + this.ROWS * this.TILE + 24;
    this.WORKER_SPEED = 80; // px per second

    // State
    this.placingMachine = null;
    this.deleteMode = false;
    this.workerSprite = null;
    this.progressBars = {};
    this.machineSprites = {};
    this.longPressTimer = null;
    this.tutorialOverlay = null;

    // Draw everything
    this.drawBackground();
    this.drawHeader();
    this.drawFixedStations();
    this.drawGrid();
    this.drawMachines();
    this.drawWorker();
    this.drawBottomPanel();
    this.drawWorkerStatus();

    // Tutorial or normal mode
    if (!this.factory.tutorialComplete) {
      this.startTutorial();
    }
  }

  drawBackground() {
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x0d1117);
  }

  drawHeader() {
    const { width } = this.scale;

    this.add.rectangle(width / 2, 55, width, 90, 0x161b22);
    this.add.rectangle(width / 2, 100, width, 1, 0x334455);

    const backBtn = this.add.rectangle(40, 55, 64, 44, 0x1e2530).setInteractive();
    this.add.text(40, 55, '← BACK', {
      fontFamily: 'monospace', fontSize: '13px', color: '#e8a020'
    }).setOrigin(0.5);
    backBtn.on('pointerdown', () => {
      this.factory.save();
      this.cameras.main.fade(200, 0, 0, 0);
      this.time.delayedCall(200, () => this.scene.start('BaseScene'));
    });
    backBtn.on('pointerover', () => backBtn.setFillStyle(0x252c38));
    backBtn.on('pointerout', () => backBtn.setFillStyle(0x1e2530));

    this.add.text(width / 2 + 20, 42, 'FACTORY FLOOR', {
      fontFamily: 'monospace', fontSize: '18px', color: '#eef2f8', fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(width / 2 + 20, 68, 'BUILD YOUR TOWERS', {
      fontFamily: 'monospace', fontSize: '11px', color: '#8899aa', letterSpacing: 2
    }).setOrigin(0.5);
  }

  drawFixedStations() {
    const { width } = this.scale;
    const storeX = width / 2;

    // Store
    const storeBg = this.add.rectangle(storeX, this.STORE_Y, width - 48, 40, 0x161b22)
      .setInteractive();
    this.add.rectangle(storeX, this.STORE_Y, width - 48, 40)
      .setStrokeStyle(2, 0x3a8fc4);
    this.add.text(storeX, this.STORE_Y, '📦  RAW MATERIAL STORE', {
      fontFamily: 'monospace', fontSize: '12px', color: '#3a8fc4', fontStyle: 'bold'
    }).setOrigin(0.5);
    storeBg.stationKey = 'store';
    storeBg.on('pointerdown', () => this.stationTapped('store'));
    storeBg.on('pointerover', () => storeBg.setFillStyle(0x1e2d3a));
    storeBg.on('pointerout', () => storeBg.setFillStyle(0x161b22));
    this.storeRef = storeBg;

    // Depository
    const depotBg = this.add.rectangle(storeX, this.DEPOT_Y, width - 48, 40, 0x161b22)
      .setInteractive();
    this.add.rectangle(storeX, this.DEPOT_Y, width - 48, 40)
      .setStrokeStyle(2, 0xc43a3a);
    this.add.text(storeX, this.DEPOT_Y, '🏴  DEPOSITORY', {
      fontFamily: 'monospace', fontSize: '12px', color: '#c43a3a', fontStyle: 'bold'
    }).setOrigin(0.5);
    depotBg.stationKey = 'depository';
    depotBg.on('pointerdown', () => this.stationTapped('depository'));
    depotBg.on('pointerover', () => depotBg.setFillStyle(0x2a1a1a));
    depotBg.on('pointerout', () => depotBg.setFillStyle(0x161b22));
    this.depotRef = depotBg;

    // Progress bars for fixed stations
    this.progressBars['store'] = this.add.rectangle(
      this.scale.width / 2, this.STORE_Y + 22, 0, 4, 0x3a8fc4
    );
    this.progressBars['depository'] = this.add.rectangle(
      this.scale.width / 2, this.DEPOT_Y + 22, 0, 4, 0xc43a3a
    );
  }

  drawGrid() {
    for (let row = 0; row < this.ROWS; row++) {
      for (let col = 0; col < this.COLS; col++) {
        const x = this.GX + col * this.TILE + this.TILE / 2;
        const y = this.GY + row * this.TILE + this.TILE / 2;

        const tile = this.add.rectangle(x, y, this.TILE - 2, this.TILE - 2, 0x161b22)
          .setInteractive();
        this.add.rectangle(x, y, this.TILE - 2, this.TILE - 2)
          .setStrokeStyle(1, 0x2a3a4a);

        tile.gridRow = row;
        tile.gridCol = col;

        tile.on('pointerdown', () => this.tileTapped(tile, row, col));
        tile.on('pointerover', () => {
          if (this.placingMachine && !this.factory.getMachineAt(row, col)) {
            tile.setFillStyle(0x1e2d3a);
          }
        });
        tile.on('pointerout', () => {
          if (!this.factory.getMachineAt(row, col)) tile.setFillStyle(0x161b22);
        });
      }
    }
  }

  drawMachines() {
    // Clear existing machine sprites
    Object.values(this.machineSprites).forEach(s => s && s.destroy && s.destroy());
    this.machineSprites = {};

    for (let row = 0; row < this.ROWS; row++) {
      for (let col = 0; col < this.COLS; col++) {
        const machine = this.factory.getMachineAt(row, col);
        if (machine) this.drawMachineAt(row, col, machine.type);
      }
    }
  }

  drawMachineAt(row, col, type) {
    const mt = MACHINE_TYPES[type];
    const x = this.GX + col * this.TILE + this.TILE / 2;
    const y = this.GY + row * this.TILE + this.TILE / 2;
    const key = `${row},${col}`;

    const bg = this.add.rectangle(x, y, this.TILE - 2, this.TILE - 2, mt.colour, 0.15);
    this.add.rectangle(x, y, this.TILE - 2, this.TILE - 2).setStrokeStyle(2, mt.colour);

    const label = type === 'smelter' ? 'SML' : 'ASM';
    const text = this.add.text(x, y - 4, label, {
      fontFamily: 'monospace', fontSize: '13px', color: mt.colourHex, fontStyle: 'bold'
    }).setOrigin(0.5);

    // Progress bar
    const barBg = this.add.rectangle(x, y + this.TILE / 2 - 5, this.TILE - 4, 5, 0x2a3a4a);
    const bar = this.add.rectangle(
      x - (this.TILE - 4) / 2, y + this.TILE / 2 - 5,
      0, 5, mt.colour
    ).setOrigin(0, 0.5);

    this.progressBars[key] = bar;
    this.machineSprites[key] = { bg, text, barBg, bar };

    // Long press to delete
    let pressTimer = null;
    bg.setInteractive();
    bg.on('pointerdown', () => {
      if (this.deleteMode) {
        pressTimer = this.time.delayedCall(600, () => {
          this.confirmDelete(row, col);
        });
      }
    });
    bg.on('pointerup', () => { if (pressTimer) pressTimer.remove(); });
    bg.on('pointerout', () => { if (pressTimer) pressTimer.remove(); });
  }

  drawWorker() {
    const { width } = this.scale;
    const startX = width / 2;
    const startY = this.STORE_Y;

    this.workerSprite = this.add.circle(startX, startY, 14, 0xe8a020);
    this.workerLabel = this.add.text(startX, startY, 'W1', {
      fontFamily: 'monospace', fontSize: '10px', color: '#0d1117', fontStyle: 'bold'
    }).setOrigin(0.5);

    // Depth so worker appears above machines
    this.workerSprite.setDepth(10);
    this.workerLabel.setDepth(11);
  }

  drawBottomPanel() {
    const { width, height } = this.scale;
    const panelY = this.DEPOT_Y + 30;
    const panelHeight = height - panelY;

    this.add.rectangle(width / 2, panelY + panelHeight / 2, width, panelHeight, 0x161b22);
    this.add.rectangle(width / 2, panelY, width, 1, 0x334455);

    // Machine buttons (shown during tutorial/placement mode)
    this.smelterBtn = this.add.rectangle(80, panelY + 48, 120, 72, 0x1e2530).setInteractive();
    this.add.rectangle(80, panelY + 48, 120, 72).setStrokeStyle(1, 0xe8a020);
    this.add.circle(80, panelY + 28, 8, 0xe8a020);
    this.add.text(80, panelY + 52, 'SMELTER', {
      fontFamily: 'monospace', fontSize: '11px', color: '#eef2f8', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.add.text(80, panelY + 68, 'SCRAP→REFINED', {
      fontFamily: 'monospace', fontSize: '9px', color: '#8899aa'
    }).setOrigin(0.5);
    this.smelterBtn.on('pointerdown', () => this.selectPlacingMachine('smelter'));
    this.smelterBtn.on('pointerover', () => this.smelterBtn.setFillStyle(0x252c38));
    this.smelterBtn.on('pointerout', () => this.smelterBtn.setFillStyle(this.placingMachine === 'smelter' ? 0x2a3a4a : 0x1e2530));

    this.assemblyBtn = this.add.rectangle(230, panelY + 48, 120, 72, 0x1e2530).setInteractive();
    this.add.rectangle(230, panelY + 48, 120, 72).setStrokeStyle(1, 0x5eba7d);
    this.add.circle(230, panelY + 28, 8, 0x5eba7d);
    this.add.text(230, panelY + 52, 'ASSEMBLY', {
      fontFamily: 'monospace', fontSize: '11px', color: '#eef2f8', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.add.text(230, panelY + 68, 'REFINED→TOWER', {
      fontFamily: 'monospace', fontSize: '9px', color: '#8899aa'
    }).setOrigin(0.5);
    this.assemblyBtn.on('pointerdown', () => this.selectPlacingMachine('assembly'));
    this.assemblyBtn.on('pointerover', () => this.assemblyBtn.setFillStyle(0x252c38));
    this.assemblyBtn.on('pointerout', () => this.assemblyBtn.setFillStyle(this.placingMachine === 'assembly' ? 0x2a3a4a : 0x1e2530));

    // Delete mode toggle
    this.deleteModeBtn = this.add.rectangle(348, panelY + 48, 72, 72, 0x1e2530).setInteractive();
    this.add.rectangle(348, panelY + 48, 72, 72).setStrokeStyle(1, 0x554444);
    this.add.text(348, panelY + 44, '🗑', {
      fontFamily: 'monospace', fontSize: '18px', color: '#aa4444'
    }).setOrigin(0.5);
    this.add.text(348, panelY + 66, 'DELETE', {
      fontFamily: 'monospace', fontSize: '9px', color: '#aa4444'
    }).setOrigin(0.5);
    this.deleteModeBtn.on('pointerdown', () => this.toggleDeleteMode());
  }

  drawWorkerStatus() {
    const { width, height } = this.scale;
    const y = height - 24;

    this.workerStatusText = this.add.text(width / 2, y, '', {
      fontFamily: 'monospace', fontSize: '11px', color: '#8899aa'
    }).setOrigin(0.5).setDepth(5);

    this.updateWorkerStatus();
  }

  updateWorkerStatus() {
    if (!this.workerStatusText) return;
    const w = this.factory.worker;
    const inv = this.factory.getInventoryDisplay();
    const state = w.state.toUpperCase();
    this.workerStatusText.setText(`WORKER: ${state}  ·  CARRYING: ${inv}`);
  }

  selectPlacingMachine(type) {
    this.placingMachine = this.placingMachine === type ? null : type;
    this.deleteMode = false;
    this.smelterBtn.setFillStyle(this.placingMachine === 'smelter' ? 0x2a3a4a : 0x1e2530);
    this.assemblyBtn.setFillStyle(this.placingMachine === 'assembly' ? 0x2a3a4a : 0x1e2530);
    this.deleteModeBtn.setFillStyle(0x1e2530);
  }

  toggleDeleteMode() {
    this.deleteMode = !this.deleteMode;
    this.placingMachine = null;
    this.deleteModeBtn.setFillStyle(this.deleteMode ? 0x3a2020 : 0x1e2530);
    this.smelterBtn.setFillStyle(0x1e2530);
    this.assemblyBtn.setFillStyle(0x1e2530);

    if (this.deleteMode) {
      this.showMessage('DELETE MODE — Hold any machine to delete it', '#c43a3a');
    }
  }

  tileTapped(tile, row, col) {
    if (!this.placingMachine) return;
    if (this.factory.getMachineAt(row, col)) return;

    const placed = this.factory.placeMachine(row, col, this.placingMachine);
    if (placed) {
      this.drawMachineAt(row, col, this.placingMachine);
      this.factory.save();

      if (!this.factory.tutorialComplete) {
        this.advanceTutorial(`placed_${this.placingMachine}`);
      }

      this.placingMachine = null;
      this.smelterBtn.setFillStyle(0x1e2530);
      this.assemblyBtn.setFillStyle(0x1e2530);
    }
  }

  stationTapped(stationKey) {
    if (this.placingMachine || this.deleteMode) return;

    const w = this.factory.worker;

    // If worker is already working here, do nothing
    if (w.station === stationKey && w.state === 'working') return;

    // Check if worker can work here
    if (!this.factory.canWorkerStartAt(stationKey)) {
      let reason = '';
      if (stationKey === 'store' && w.inventory.length > 0) {
        reason = 'Worker is carrying items — deliver them first';
      } else if (stationKey === 'depository' && !w.inventory.includes('towerComponent')) {
        reason = 'No finished tower to deliver';
      } else {
        reason = 'Worker needs the right materials first';
      }
      this.showMessage(reason, '#c43a3a');
      return;
    }

    // Walk worker to station
    this.walkWorkerTo(stationKey, () => {
      this.factory.startWorkAt(stationKey);
      this.updateWorkerStatus();
      if (!this.factory.tutorialComplete) {
        this.advanceTutorial(`assigned_${stationKey}`);
      }
    });
  }

  machineStationTapped(stationKey) {
    if (this.placingMachine || this.deleteMode) return;

    const [r, c] = stationKey.split(',').map(Number);
    const machine = this.factory.getMachineAt(r, c);
    if (!machine) return;

    const w = this.factory.worker;
    if (w.station === stationKey && w.state === 'working') return;

    if (!this.factory.canWorkerStartAt(stationKey)) {
      const mt = MACHINE_TYPES[machine.type];
      this.showMessage(`Need: ${mt.inputItems.join(' + ')} to use ${mt.name}`, '#c43a3a');
      return;
    }

    this.walkWorkerTo(stationKey, () => {
      this.factory.startWorkAt(stationKey);
      this.updateWorkerStatus();
      if (!this.factory.tutorialComplete) {
        this.advanceTutorial(`assigned_${stationKey}`);
      }
    });
  }

  // Make tile taps also handle machine assignment
  tileTapped(tile, row, col) {
    if (this.placingMachine) {
      if (this.factory.getMachineAt(row, col)) return;
      const placed = this.factory.placeMachine(row, col, this.placingMachine);
      if (placed) {
        this.drawMachineAt(row, col, this.placingMachine);
        this.factory.save();
        if (!this.factory.tutorialComplete) {
          this.advanceTutorial(`placed_${this.placingMachine}`);
        }
        this.placingMachine = null;
        this.smelterBtn.setFillStyle(0x1e2530);
        this.assemblyBtn.setFillStyle(0x1e2530);
      }
      return;
    }

    // Tap existing machine to assign worker
    const machine = this.factory.getMachineAt(row, col);
    if (machine) {
      this.machineStationTapped(`${row},${col}`);
    }
  }

  confirmDelete(row, col) {
    const machine = this.factory.getMachineAt(row, col);
    if (!machine) return;

    const mt = MACHINE_TYPES[machine.type];
    const { width, height } = this.scale;

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6).setDepth(20);
    const box = this.add.rectangle(width / 2, height / 2, width - 60, 160, 0x161b22).setDepth(21);
    this.add.rectangle(width / 2, height / 2, width - 60, 160).setStrokeStyle(1, 0xc43a3a).setDepth(21);

    this.add.text(width / 2, height / 2 - 44, `DELETE ${mt.name}?`, {
      fontFamily: 'monospace', fontSize: '18px', color: '#eef2f8', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(22);

    this.add.text(width / 2, height / 2 - 14, 'This cannot be undone.', {
      fontFamily: 'monospace', fontSize: '12px', color: '#8899aa'
    }).setOrigin(0.5).setDepth(22);

    const confirmBtn = this.add.rectangle(width / 2 - 72, height / 2 + 40, 120, 44, 0x3a1010).setInteractive().setDepth(22);
    this.add.rectangle(width / 2 - 72, height / 2 + 40, 120, 44).setStrokeStyle(1, 0xc43a3a).setDepth(22);
    this.add.text(width / 2 - 72, height / 2 + 40, 'DELETE', {
      fontFamily: 'monospace', fontSize: '14px', color: '#c43a3a', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(23);

    const cancelBtn = this.add.rectangle(width / 2 + 72, height / 2 + 40, 120, 44, 0x1e2530).setInteractive().setDepth(22);
    this.add.rectangle(width / 2 + 72, height / 2 + 40, 120, 44).setStrokeStyle(1, 0x334455).setDepth(22);
    this.add.text(width / 2 + 72, height / 2 + 40, 'CANCEL', {
      fontFamily: 'monospace', fontSize: '14px', color: '#8899aa', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(23);

    const dismiss = () => {
      overlay.destroy(); box.destroy();
      confirmBtn.destroy(); cancelBtn.destroy();
    };

    confirmBtn.on('pointerdown', () => {
      dismiss();
      const key = `${row},${col}`;
      if (this.machineSprites[key]) {
        Object.values(this.machineSprites[key]).forEach(s => s && s.destroy && s.destroy());
        delete this.machineSprites[key];
        delete this.progressBars[key];
      }
      this.factory.deleteMachine(row, col);
      this.factory.save();
      this.updateWorkerStatus();
    });

    cancelBtn.on('pointerdown', dismiss);
  }

  getStationPixelPos(stationKey) {
    const { width } = this.scale;
    if (stationKey === 'store') return { x: width / 2, y: this.STORE_Y };
    if (stationKey === 'depository') return { x: width / 2, y: this.DEPOT_Y };
    const [r, c] = stationKey.split(',').map(Number);
    return {
      x: this.GX + c * this.TILE + this.TILE / 2,
      y: this.GY + r * this.TILE + this.TILE / 2
    };
  }

  walkWorkerTo(stationKey, onComplete) {
    if (!this.workerSprite) return;

    // Cancel any existing work
    if (this.factory.worker.state === 'working') {
      this.factory.worker.state = 'idle';
      this.factory.worker.progress = 0;
    }

    const target = this.getStationPixelPos(stationKey);
    const dist = Phaser.Math.Distance.Between(
      this.workerSprite.x, this.workerSprite.y, target.x, target.y
    );
    const duration = (dist / this.WORKER_SPEED) * 1000;

    this.tweens.killTweensOf(this.workerSprite);
    this.tweens.killTweensOf(this.workerLabel);

    this.factory.worker.state = 'walking';
    this.updateWorkerStatus();

    this.tweens.add({
      targets: [this.workerSprite, this.workerLabel],
      x: target.x,
      y: target.y,
      duration: Math.max(duration, 100),
      ease: 'Linear',
      onComplete: () => {
        if (onComplete) onComplete();
        this.updateWorkerStatus();
      }
    });
  }

  showMessage(text, colour) {
    const { width } = this.scale;
    const msg = this.add.text(width / 2, 108, text, {
      fontFamily: 'monospace', fontSize: '11px', color: colour || '#e8a020',
      backgroundColor: '#0d1117', padding: { x: 8, y: 4 }
    }).setOrigin(0.5).setDepth(15);

    this.time.delayedCall(2500, () => {
      if (msg && msg.active) msg.destroy();
    });
  }

  // ─── TUTORIAL ──────────────────────────────────────────────

  startTutorial() {
    this.tutorialSteps = [
      { key: 'welcome', text: 'FACTORY TUTORIAL\n\nThis is your factory floor.\nYou have 1 worker to start.\n\nFollow the instructions to\nbuild your first tower.', action: 'tap_continue' },
      { key: 'place_smelter', text: 'STEP 1 — PLACE A SMELTER\n\nTap the SMELTER button below,\nthen tap any empty grid tile.', action: 'wait_place_smelter' },
      { key: 'place_assembly', text: 'STEP 2 — PLACE AN ASSEMBLY BENCH\n\nTap ASSEMBLY below,\nthen tap any empty grid tile.', action: 'wait_place_assembly' },
      { key: 'assign_store', text: 'STEP 3 — COLLECT MATERIALS\n\nTap the RAW MATERIAL STORE\nto send your worker to collect.', action: 'wait_assign_store' },
      { key: 'working_store', text: 'COLLECTING MATERIALS...\n\nWatch the progress bar.\nYour worker is gathering\nplastic scrap and salvaged metal.', action: 'wait_store_done' },
      { key: 'assign_smelter', text: 'STEP 4 — SMELT THE SCRAP\n\nTap the SMELTER tile\nto send your worker to process\nthe plastic scrap.', action: 'wait_assign_smelter' },
      { key: 'working_smelter', text: 'SMELTING IN PROGRESS...\n\nThe smelter turns plastic scrap\ninto refined plastic.\nWatch the progress bar.', action: 'wait_smelter_done' },
      { key: 'assign_assembly', text: 'STEP 5 — BUILD THE TOWER\n\nTap the ASSEMBLY BENCH tile\nto send your worker to\nassemble the tower.', action: 'wait_assign_assembly' },
      { key: 'working_assembly', text: 'ASSEMBLING TOWER...\n\nCombining refined plastic\nand salvaged metal.\nYour tower is almost ready!', action: 'wait_assembly_done' },
      { key: 'assign_depot', text: 'STEP 6 — DELIVER THE TOWER\n\nTap the DEPOSITORY\nto deliver your finished tower\nto the armoury.', action: 'wait_assign_depository' },
      { key: 'working_depot', text: 'DELIVERING...\n\nYour worker is storing\nthe tower in the armoury.', action: 'wait_depot_done' },
      { key: 'complete', text: 'TOWER READY! 🏴\n\nYour first tower is in\nthe armoury.\n\nHead to the DOCK to\nfight your first battle!', action: 'tap_to_dock' }
    ];

    this.currentTutStep = this.factory.tutorialStep;
    this.showTutorialStep(this.currentTutStep);
  }

  showTutorialStep(stepIndex) {
    if (stepIndex >= this.tutorialSteps.length) {
      this.completeTutorial();
      return;
    }

    const step = this.tutorialSteps[stepIndex];
    if (!step) return;

    this.clearTutorialOverlay();

    const { width, height } = this.scale;

    // Semi-transparent overlay at top
    const overlayBg = this.add.rectangle(width / 2, 520, width - 32, 200, 0x0d1117, 0.95)
      .setDepth(30);
    this.add.rectangle(width / 2, 520, width - 32, 200)
      .setStrokeStyle(1, 0xe8a020).setDepth(30);

    const textObj = this.add.text(width / 2, 460, step.text, {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#eef2f8',
      align: 'center',
      lineSpacing: 6
    }).setOrigin(0.5).setDepth(31);

    this.tutorialElements = [overlayBg, textObj];

    if (step.action === 'tap_continue') {
      const btn = this.add.rectangle(width / 2, 570, 180, 44, 0x1e2d1e).setInteractive().setDepth(31);
      this.add.rectangle(width / 2, 570, 180, 44).setStrokeStyle(1, 0x5eba7d).setDepth(31);
      const btnText = this.add.text(width / 2, 570, 'CONTINUE →', {
        fontFamily: 'monospace', fontSize: '14px', color: '#5eba7d', fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(32);
      this.tutorialElements.push(btn, btnText);
      btn.on('pointerdown', () => {
        this.currentTutStep++;
        this.factory.tutorialStep = this.currentTutStep;
        this.showTutorialStep(this.currentTutStep);
      });
    }

    if (step.action === 'tap_to_dock') {
      const btn = this.add.rectangle(width / 2, 570, 220, 44, 0x1a2210).setInteractive().setDepth(31);
      this.add.rectangle(width / 2, 570, 220, 44).setStrokeStyle(1, 0xe8a020).setDepth(31);
      const btnText = this.add.text(width / 2, 570, 'GO TO DOCK →', {
        fontFamily: 'monospace', fontSize: '14px', color: '#e8a020', fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(32);
      this.tutorialElements.push(btn, btnText);
      btn.on('pointerdown', () => {
        this.completeTutorial();
        this.factory.save();
        this.cameras.main.fade(200, 0, 0, 0);
        this.time.delayedCall(200, () => this.scene.start('DockScene'));
      });
    }
  }

  clearTutorialOverlay() {
    if (this.tutorialElements) {
      this.tutorialElements.forEach(e => { if (e && e.active) e.destroy(); });
    }
    this.tutorialElements = [];
  }

  advanceTutorial(event) {
    const step = this.tutorialSteps[this.currentTutStep];
    if (!step) return;

    const shouldAdvance = {
      'wait_place_smelter': event === 'placed_smelter',
      'wait_place_assembly': event === 'placed_assembly',
      'wait_assign_store': event === 'assigned_store',
      'wait_assign_smelter': (key => {
        // Any smelter tile
        if (!event.startsWith('assigned_')) return false;
        const stKey = event.replace('assigned_', '');
        if (stKey === 'store' || stKey === 'depository') return false;
        const [r, c] = stKey.split(',').map(Number);
        const m = this.factory.getMachineAt(r, c);
        return m && m.type === 'smelter';
      })(),
      'wait_assign_assembly': (key => {
        if (!event.startsWith('assigned_')) return false;
        const stKey = event.replace('assigned_', '');
        if (stKey === 'store' || stKey === 'depository') return false;
        const [r, c] = stKey.split(',').map(Number);
        const m = this.factory.getMachineAt(r, c);
        return m && m.type === 'assembly';
      })(),
      'wait_assign_depository': event === 'assigned_depository',
    };

    if (shouldAdvance[step.action]) {
      this.currentTutStep++;
      this.factory.tutorialStep = this.currentTutStep;
      this.showTutorialStep(this.currentTutStep);
    }
  }

  tutorialWorkCompleted(station) {
    const step = this.tutorialSteps[this.currentTutStep];
    if (!step) return;

    const advance = {
      'wait_store_done': station === 'store',
      'wait_smelter_done': station !== 'store' && station !== 'depository' &&
        (() => {
          const [r, c] = station.split(',').map(Number);
          const m = this.factory.getMachineAt(r, c);
          return m && m.type === 'smelter';
        })(),
      'wait_assembly_done': station !== 'store' && station !== 'depository' &&
        (() => {
          const [r, c] = station.split(',').map(Number);
          const m = this.factory.getMachineAt(r, c);
          return m && m.type === 'assembly';
        })(),
      'wait_depot_done': station === 'depository',
    };

    if (advance[step.action]) {
      this.currentTutStep++;
      this.factory.tutorialStep = this.currentTutStep;
      this.showTutorialStep(this.currentTutStep);
    }
  }

  completeTutorial() {
    this.factory.tutorialComplete = true;
    this.factory.tutorialStep = 0;
    this.clearTutorialOverlay();
    this.factory.save();
  }

  // ─── UPDATE LOOP ────────────────────────────────────────────

  update(time, delta) {
    const completed = this.factory.update(delta);

    // Update all progress bars
    const w = this.factory.worker;

    // Fixed station bars
    ['store', 'depository'].forEach(key => {
      const bar = this.progressBars[key];
      if (!bar) return;
      const maxW = this.scale.width - 48;
      if (w.station === key && w.state === 'working') {
        const pos = this.getStationPixelPos(key);
        bar.setPosition(pos.x - maxW / 2 + (maxW * w.progress) / 2, bar.y);
        bar.setSize(maxW * w.progress, 4);
      } else {
        bar.setSize(0, 4);
      }
    });

    // Machine bars
    for (let row = 0; row < this.ROWS; row++) {
      for (let col = 0; col < this.COLS; col++) {
        const key = `${row},${col}`;
        const bar = this.progressBars[key];
        if (!bar) continue;
        const maxW = this.TILE - 4;
        if (w.station === key && w.state === 'working') {
          bar.setSize(maxW * w.progress, 5);
        } else {
          bar.setSize(0, 5);
        }
      }
    }

    // Update worker label position
    if (this.workerLabel && this.workerSprite) {
      this.workerLabel.setPosition(this.workerSprite.x, this.workerSprite.y);
    }

    // Handle work completion
    if (completed) {
      this.updateWorkerStatus();

      // If tower delivered to depository, update armoury stockpile
      if (w.station === 'depository') {
        this.addTowerToStockpile('gunner');
      }

      // Tutorial progress
      if (!this.factory.tutorialComplete) {
        this.tutorialWorkCompleted(w.station);
      }
    }
  }

  addTowerToStockpile(towerType) {
    const slotIndex = localStorage.getItem('factower_active_slot');
    const saveKey = `factower_save_${slotIndex}`;
    const save = JSON.parse(localStorage.getItem(saveKey));

    if (!save.stockpile) save.stockpile = { gunner: 0, bomber: 0, barricade: 0 };
    save.stockpile[towerType] = (save.stockpile[towerType] || 0) + 1;

    localStorage.setItem(saveKey, JSON.stringify(save));
    this.saveData = save;

    this.showMessage(`GUNNER TOWER added to Armoury!`, '#5eba7d');
    this.factory.save();
  }
}
