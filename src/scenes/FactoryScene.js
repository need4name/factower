class FactoryScene extends Phaser.Scene {
  constructor() {
    super({ key: 'FactoryScene' });
  }

  create() {
    const { width, height } = this.scale;

    const slotIndex = localStorage.getItem('factower_active_slot');
    const saveKey = `factower_save_${slotIndex}`;
    this.saveData = JSON.parse(localStorage.getItem(saveKey));

    this.factory = new Factory();
    this.factory.loadFromSave(this.saveData);

    this.TILE = 52;
    this.COLS = 5;
    this.ROWS = 7;
    this.GX = (width - this.TILE * this.COLS) / 2;
    this.GY = 200;
    this.STORE_Y = 160;
    this.DEPOT_Y = this.GY + this.ROWS * this.TILE + 28;
    this.WORKER_SPEED = 80;

    this.placingMachine = null;
    this.deleteMode = false;
    this.workerSprite = null;
    this.workerLabel = null;
    this.progressBars = {};
    this.machineSprites = {};
    this.tutorialElements = [];

    this.add.rectangle(width / 2, height / 2, width, height, 0x0d1117);

    this.drawHeader();
    this.drawFixedStations();
    this.drawGrid();
    this.drawMachines();
    this.drawWorker();
    this.drawBottomPanel();
    this.drawWorkerStatus();

    if (!this.factory.tutorialComplete) {
      this.startTutorial();
    }
  }

  drawHeader() {
    const { width } = this.scale;

    this.add.rectangle(width / 2, 68, width, 96, 0x161b22);
    this.add.rectangle(width / 2, 116, width, 1, 0x334455);

    const backBtn = this.add.rectangle(48, 68, 76, 52, 0x1e2530)
      .setInteractive()
      .setDepth(5);
    this.add.text(48, 68, '← BACK', {
      fontFamily: 'monospace', fontSize: '14px', color: '#e8a020'
    }).setOrigin(0.5).setDepth(6);

    backBtn.on('pointerdown', () => {
      this.factory.save();
      this.cameras.main.fade(200, 0, 0, 0);
      this.time.delayedCall(200, () => this.scene.start('BaseScene'));
    });
    backBtn.on('pointerover', () => backBtn.setFillStyle(0x252c38));
    backBtn.on('pointerout', () => backBtn.setFillStyle(0x1e2530));

    this.add.text(width / 2 + 24, 52, 'FACTORY FLOOR', {
      fontFamily: 'monospace', fontSize: '18px', color: '#eef2f8', fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(width / 2 + 24, 78, 'BUILD YOUR TOWERS', {
      fontFamily: 'monospace', fontSize: '11px', color: '#8899aa', letterSpacing: 2
    }).setOrigin(0.5);
  }

  drawFixedStations() {
    const { width } = this.scale;
    const cx = width / 2;

    const storeBg = this.add.rectangle(cx, this.STORE_Y, width - 48, 44, 0x161b22)
      .setInteractive();
    this.add.rectangle(cx, this.STORE_Y, width - 48, 44)
      .setStrokeStyle(2, 0x3a8fc4);
    this.add.text(cx, this.STORE_Y, 'RAW MATERIAL STORE', {
      fontFamily: 'monospace', fontSize: '13px', color: '#3a8fc4', fontStyle: 'bold'
    }).setOrigin(0.5);
    storeBg.on('pointerdown', () => this.stationTapped('store'));
    storeBg.on('pointerover', () => storeBg.setFillStyle(0x1e2d3a));
    storeBg.on('pointerout', () => storeBg.setFillStyle(0x161b22));

    const depotBg = this.add.rectangle(cx, this.DEPOT_Y, width - 48, 44, 0x161b22)
      .setInteractive();
    this.add.rectangle(cx, this.DEPOT_Y, width - 48, 44)
      .setStrokeStyle(2, 0xc43a3a);
    this.add.text(cx, this.DEPOT_Y, 'DEPOSITORY', {
      fontFamily: 'monospace', fontSize: '13px', color: '#c43a3a', fontStyle: 'bold'
    }).setOrigin(0.5);
    depotBg.on('pointerdown', () => this.stationTapped('depository'));
    depotBg.on('pointerover', () => depotBg.setFillStyle(0x2a1a1a));
    depotBg.on('pointerout', () => depotBg.setFillStyle(0x161b22));

    this.progressBars['store'] = this.add.rectangle(
      24, this.STORE_Y + 24, 0, 4, 0x3a8fc4
    ).setOrigin(0, 0.5);
    this.progressBars['depository'] = this.add.rectangle(
      24, this.DEPOT_Y + 24, 0, 4, 0xc43a3a
    ).setOrigin(0, 0.5);
  }

  drawGrid() {
    for (let row = 0; row < this.ROWS; row++) {
      for (let col = 0; col < this.COLS; col++) {
        const x = this.GX + col * this.TILE + this.TILE / 2;
        const y = this.GY + row * this.TILE + this.TILE / 2;

        const tile = this.add.rectangle(
          x, y, this.TILE - 2, this.TILE - 2, 0x161b22
        ).setInteractive();

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
          if (!this.factory.getMachineAt(row, col)) {
            tile.setFillStyle(0x161b22);
          }
        });
      }
    }
  }

  tileTapped(tile, row, col) {
    // PLACE mode
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

    // ASSIGN mode — tap existing machine to send worker
    const machine = this.factory.getMachineAt(row, col);
    if (machine) {
      const stationKey = `${row},${col}`;
      const w = this.factory.worker;
      if (w.station === stationKey && w.state === 'working') return;

      if (!this.factory.canWorkerStartAt(stationKey)) {
        const mt = MACHINE_TYPES[machine.type];
        this.showMessage(`Need: ${mt.inputItems.join(' + ')} in inventory first`, '#c43a3a');
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
  }

  drawMachines() {
    Object.values(this.machineSprites).forEach(s => {
      if (s) Object.values(s).forEach(o => o && o.destroy && o.destroy());
    });
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

    const barBg = this.add.rectangle(
      x, y + this.TILE / 2 - 5, this.TILE - 4, 5, 0x2a3a4a
    );
    const bar = this.add.rectangle(
      x - (this.TILE - 4) / 2, y + this.TILE / 2 - 5, 0, 5, mt.colour
    ).setOrigin(0, 0.5);

    this.progressBars[key] = bar;
    this.machineSprites[key] = { bg, text, barBg, bar };

    // Long press to delete
    let pressTimer = null;
    bg.setInteractive();
    bg.on('pointerdown', () => {
      pressTimer = this.time.delayedCall(600, () => this.confirmDelete(row, col));
    });
    bg.on('pointerup', () => { if (pressTimer) { pressTimer.remove(); pressTimer = null; } });
    bg.on('pointerout', () => { if (pressTimer) { pressTimer.remove(); pressTimer = null; } });
  }

  drawWorker() {
    const { width } = this.scale;
    this.workerSprite = this.add.circle(width / 2, this.STORE_Y, 16, 0xe8a020).setDepth(10);
    this.workerLabel = this.add.text(width / 2, this.STORE_Y, 'W1', {
      fontFamily: 'monospace', fontSize: '10px', color: '#0d1117', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(11);
  }

  drawBottomPanel() {
    const { width, height } = this.scale;
    const panelY = this.DEPOT_Y + 28;

    this.add.rectangle(width / 2, height - 60, width, height - panelY, 0x161b22);
    this.add.rectangle(width / 2, panelY, width, 1, 0x334455);

    this.smelterBtn = this.add.rectangle(80, panelY + 52, 128, 80, 0x1e2530).setInteractive();
    this.add.rectangle(80, panelY + 52, 128, 80).setStrokeStyle(1, 0xe8a020);
    this.add.circle(80, panelY + 26, 10, 0xe8a020);
    this.add.text(80, panelY + 54, 'SMELTER', {
      fontFamily: 'monospace', fontSize: '13px', color: '#eef2f8', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.add.text(80, panelY + 74, 'SCRAP→REFINED', {
      fontFamily: 'monospace', fontSize: '10px', color: '#8899aa'
    }).setOrigin(0.5);
    this.smelterBtn.on('pointerdown', () => this.selectPlacingMachine('smelter'));
    this.smelterBtn.on('pointerover', () => this.smelterBtn.setFillStyle(0x252c38));
    this.smelterBtn.on('pointerout', () => {
      this.smelterBtn.setFillStyle(this.placingMachine === 'smelter' ? 0x2a3a4a : 0x1e2530);
    });

    this.assemblyBtn = this.add.rectangle(230, panelY + 52, 128, 80, 0x1e2530).setInteractive();
    this.add.rectangle(230, panelY + 52, 128, 80).setStrokeStyle(1, 0x5eba7d);
    this.add.circle(230, panelY + 26, 10, 0x5eba7d);
    this.add.text(230, panelY + 54, 'ASSEMBLY', {
      fontFamily: 'monospace', fontSize: '13px', color: '#eef2f8', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.add.text(230, panelY + 74, 'REFINED→TOWER', {
      fontFamily: 'monospace', fontSize: '10px', color: '#8899aa'
    }).setOrigin(0.5);
    this.assemblyBtn.on('pointerdown', () => this.selectPlacingMachine('assembly'));
    this.assemblyBtn.on('pointerover', () => this.assemblyBtn.setFillStyle(0x252c38));
    this.assemblyBtn.on('pointerout', () => {
      this.assemblyBtn.setFillStyle(this.placingMachine === 'assembly' ? 0x2a3a4a : 0x1e2530);
    });

    this.deleteModeBtn = this.add.rectangle(348, panelY + 52, 80, 80, 0x1e2530).setInteractive();
    this.add.rectangle(348, panelY + 52, 80, 80).setStrokeStyle(1, 0x554444);
    this.add.text(348, panelY + 44, 'DEL', {
      fontFamily: 'monospace', fontSize: '16px', color: '#aa4444', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.add.text(348, panelY + 66, 'HOLD', {
      fontFamily: 'monospace', fontSize: '10px', color: '#aa4444'
    }).setOrigin(0.5);
    this.add.text(348, panelY + 80, 'MACHINE', {
      fontFamily: 'monospace', fontSize: '10px', color: '#aa4444'
    }).setOrigin(0.5);
    this.deleteModeBtn.on('pointerdown', () => this.showMessage('HOLD any machine tile to delete it', '#c43a3a'));
  }

  drawWorkerStatus() {
    const { width, height } = this.scale;
    this.workerStatusText = this.add.text(width / 2, height - 14, '', {
      fontFamily: 'monospace', fontSize: '11px', color: '#8899aa'
    }).setOrigin(0.5).setDepth(5);
    this.updateWorkerStatus();
  }

  updateWorkerStatus() {
    if (!this.workerStatusText) return;
    const w = this.factory.worker;
    const inv = this.factory.getInventoryDisplay();
    this.workerStatusText.setText(`W1: ${w.state.toUpperCase()}  ·  ${inv}`);
  }

  selectPlacingMachine(type) {
    this.placingMachine = this.placingMachine === type ? null : type;
    this.deleteMode = false;
    this.smelterBtn.setFillStyle(this.placingMachine === 'smelter' ? 0x2a3a4a : 0x1e2530);
    this.assemblyBtn.setFillStyle(this.placingMachine === 'assembly' ? 0x2a3a4a : 0x1e2530);
  }

  stationTapped(stationKey) {
    if (this.placingMachine) return;

    const w = this.factory.worker;
    if (w.station === stationKey && w.state === 'working') return;

    if (!this.factory.canWorkerStartAt(stationKey)) {
      if (stationKey === 'store' && w.inventory.length > 0) {
        this.showMessage('Worker carrying items — deliver them first', '#c43a3a');
      } else if (stationKey === 'depository') {
        this.showMessage('No finished tower to deliver yet', '#c43a3a');
      } else {
        this.showMessage('Worker needs the right materials first', '#c43a3a');
      }
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

  confirmDelete(row, col) {
    const machine = this.factory.getMachineAt(row, col);
    if (!machine) return;

    const mt = MACHINE_TYPES[machine.type];
    const { width, height } = this.scale;

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7).setDepth(20);
    const box = this.add.rectangle(width / 2, height / 2, width - 60, 180, 0x161b22).setDepth(21);
    this.add.rectangle(width / 2, height / 2, width - 60, 180).setStrokeStyle(1, 0xc43a3a).setDepth(21);

    this.add.text(width / 2, height / 2 - 52, `DELETE ${mt.name}?`, {
      fontFamily: 'monospace', fontSize: '18px', color: '#eef2f8', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(22);

    this.add.text(width / 2, height / 2 - 20, 'This cannot be undone.', {
      fontFamily: 'monospace', fontSize: '13px', color: '#8899aa'
    }).setOrigin(0.5).setDepth(22);

    const confirmBtn = this.add.rectangle(width / 2 - 80, height / 2 + 44, 130, 50, 0x3a1010).setInteractive().setDepth(22);
    this.add.rectangle(width / 2 - 80, height / 2 + 44, 130, 50).setStrokeStyle(1, 0xc43a3a).setDepth(22);
    this.add.text(width / 2 - 80, height / 2 + 44, 'DELETE', {
      fontFamily: 'monospace', fontSize: '15px', color: '#c43a3a', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(23);

    const cancelBtn = this.add.rectangle(width / 2 + 80, height / 2 + 44, 130, 50, 0x1e2530).setInteractive().setDepth(22);
    this.add.rectangle(width / 2 + 80, height / 2 + 44, 130, 50).setStrokeStyle(1, 0x334455).setDepth(22);
    this.add.text(width / 2 + 80, height / 2 + 44, 'CANCEL', {
      fontFamily: 'monospace', fontSize: '15px', color: '#8899aa', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(23);

    const allElements = [overlay, box, confirmBtn, cancelBtn];
    const dismiss = () => allElements.forEach(e => e.destroy());

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

    if (this.factory.worker.state === 'working') {
      this.factory.worker.state = 'idle';
      this.factory.worker.progress = 0;
    }

    const target = this.getStationPixelPos(stationKey);
    const dist = Phaser.Math.Distance.Between(
      this.workerSprite.x, this.workerSprite.y, target.x, target.y
    );
    const duration = Math.max((dist / this.WORKER_SPEED) * 1000, 100);

    this.tweens.killTweensOf(this.workerSprite);
    this.tweens.killTweensOf(this.workerLabel);

    this.factory.worker.state = 'walking';
    this.updateWorkerStatus();

    this.tweens.add({
      targets: [this.workerSprite, this.workerLabel],
      x: target.x, y: target.y,
      duration,
      ease: 'Linear',
      onComplete: () => {
        if (onComplete) onComplete();
        this.updateWorkerStatus();
      }
    });
  }

  showMessage(text, colour) {
    const { width } = this.scale;
    const msg = this.add.text(width / 2, 126, text, {
      fontFamily: 'monospace', fontSize: '12px',
      color: colour || '#e8a020',
      backgroundColor: '#0d1117',
      padding: { x: 10, y: 5 }
    }).setOrigin(0.5).setDepth(15);

    this.time.delayedCall(2500, () => { if (msg?.active) msg.destroy(); });
  }

  // ── TUTORIAL ────────────────────────────────────────────────

  startTutorial() {
    this.tutorialSteps = [
      {
        key: 'welcome',
        text: 'FACTORY TUTORIAL\n\nThis is your factory floor.\nYou have 1 worker to start.\n\nFollow the steps to build\nyour first tower.',
        action: 'tap_continue'
      },
      {
        key: 'place_smelter',
        text: 'STEP 1 — PLACE A SMELTER\n\nTap SMELTER below,\nthen tap an empty grid tile.',
        action: 'wait_place_smelter'
      },
      {
        key: 'place_assembly',
        text: 'STEP 2 — PLACE AN ASSEMBLY BENCH\n\nTap ASSEMBLY below,\nthen tap an empty grid tile.\n\nTip: place it below the smelter.',
        action: 'wait_place_assembly'
      },
      {
        key: 'assign_store',
        text: 'STEP 3 — COLLECT MATERIALS\n\nTap the RAW MATERIAL STORE\nto send your worker to collect.',
        action: 'wait_assign_store'
      },
      {
        key: 'working_store',
        text: 'COLLECTING...\n\nWatch the progress bar.\nYour worker is gathering\nplastic scrap and salvaged metal.',
        action: 'wait_store_done'
      },
      {
        key: 'assign_smelter',
        text: 'STEP 4 — SMELT THE SCRAP\n\nTap the SMELTER tile\nto process the plastic scrap.',
        action: 'wait_assign_smelter'
      },
      {
        key: 'working_smelter',
        text: 'SMELTING...\n\nPlastic scrap is being refined.\nWatch the progress bar.',
        action: 'wait_smelter_done'
      },
      {
        key: 'assign_assembly',
        text: 'STEP 5 — BUILD THE TOWER\n\nTap the ASSEMBLY BENCH tile\nto assemble your tower.',
        action: 'wait_assign_assembly'
      },
      {
        key: 'working_assembly',
        text: 'ASSEMBLING...\n\nCombining refined plastic\nand salvaged metal.\nAlmost done!',
        action: 'wait_assembly_done'
      },
      {
        key: 'assign_depot',
        text: 'STEP 6 — DELIVER THE TOWER\n\nTap the DEPOSITORY\nto store your finished tower.',
        action: 'wait_assign_depository'
      },
      {
        key: 'working_depot',
        text: 'DELIVERING...\n\nYour worker is storing\nthe tower in the armoury.',
        action: 'wait_depot_done'
      },
      {
        key: 'complete',
        text: 'TOWER COMPLETE!\n\nYour first tower is ready.\nHead to the DOCK to fight\nyour first battle!',
        action: 'tap_to_dock'
      }
    ];

    this.currentTutStep = this.factory.tutorialStep || 0;
    this.showTutorialStep(this.currentTutStep);
  }

  showTutorialStep(stepIndex) {
    if (stepIndex >= this.tutorialSteps.length) {
      this.completeTutorial();
      return;
    }

    this.clearTutorialOverlay();

    const step = this.tutorialSteps[stepIndex];
    const { width, height } = this.scale;

    // Position at bottom so it doesn't block the grid
    const boxY = height - 170;

    const overlayBg = this.add.rectangle(width / 2, boxY, width - 24, 240, 0x0d1117, 0.96)
      .setDepth(30);
    this.add.rectangle(width / 2, boxY, width - 24, 240)
      .setStrokeStyle(1, 0xe8a020).setDepth(30);

    const textObj = this.add.text(width / 2, boxY - 60, step.text, {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#eef2f8',
      align: 'center',
      lineSpacing: 5,
      wordWrap: { width: width - 60 }
    }).setOrigin(0.5).setDepth(31);

    this.tutorialElements = [overlayBg, textObj];

    if (step.action === 'tap_continue') {
      const btn = this.add.rectangle(width / 2, boxY + 88, 200, 48, 0x1e2d1e)
        .setInteractive().setDepth(31);
      this.add.rectangle(width / 2, boxY + 88, 200, 48)
        .setStrokeStyle(1, 0x5eba7d).setDepth(31);
      const btnTxt = this.add.text(width / 2, boxY + 88, 'CONTINUE →', {
        fontFamily: 'monospace', fontSize: '15px', color: '#5eba7d', fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(32);
      this.tutorialElements.push(btn, btnTxt);
      btn.on('pointerdown', () => {
        this.currentTutStep++;
        this.factory.tutorialStep = this.currentTutStep;
        this.showTutorialStep(this.currentTutStep);
      });
    }

    if (step.action === 'tap_to_dock') {
      const btn = this.add.rectangle(width / 2, boxY + 88, 240, 48, 0x1a2210)
        .setInteractive().setDepth(31);
      this.add.rectangle(width / 2, boxY + 88, 240, 48)
        .setStrokeStyle(1, 0xe8a020).setDepth(31);
      const btnTxt = this.add.text(width / 2, boxY + 88, 'GO TO DOCK →', {
        fontFamily: 'monospace', fontSize: '15px', color: '#e8a020', fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(32);
      this.tutorialElements.push(btn, btnTxt);
      btn.on('pointerdown', () => {
        this.completeTutorial();
        this.factory.save();
        this.cameras.main.fade(200, 0, 0, 0);
        this.time.delayedCall(200, () => this.scene.start('DockScene'));
      });
    }

    // For wait steps, show a small dismissible hint strip instead of a blocking overlay
    if (!['tap_continue', 'tap_to_dock'].includes(step.action)) {
      const hintY = height - 48;
      const hint = this.add.text(width / 2, hintY, step.text.split('\n')[0], {
        fontFamily: 'monospace', fontSize: '12px', color: '#e8a020',
        backgroundColor: '#161b22', padding: { x: 10, y: 6 }
      }).setOrigin(0.5).setDepth(32);
      this.tutorialElements.push(hint);

      // Destroy the blocking overlay for wait steps
      overlayBg.destroy();
      textObj.destroy();
      this.tutorialElements = this.tutorialElements.filter(e => e !== overlayBg && e !== textObj);
    }
  }

  clearTutorialOverlay() {
    if (this.tutorialElements) {
      this.tutorialElements.forEach(e => { if (e?.active) e.destroy(); });
    }
    this.tutorialElements = [];
  }

  advanceTutorial(event) {
    const step = this.tutorialSteps[this.currentTutStep];
    if (!step) return;

    const isSmelterStation = (key) => {
      if (!key || key === 'store' || key === 'depository') return false;
      const [r, c] = key.split(',').map(Number);
      const m = this.factory.getMachineAt(r, c);
      return m && m.type === 'smelter';
    };

    const isAssemblyStation = (key) => {
      if (!key || key === 'store' || key === 'depository') return false;
      const [r, c] = key.split(',').map(Number);
      const m = this.factory.getMachineAt(r, c);
      return m && m.type === 'assembly';
    };

    const stationKey = event.startsWith('assigned_') ? event.replace('assigned_', '') : '';

    const shouldAdvance =
      (step.action === 'wait_place_smelter' && event === 'placed_smelter') ||
      (step.action === 'wait_place_assembly' && event === 'placed_assembly') ||
      (step.action === 'wait_assign_store' && event === 'assigned_store') ||
      (step.action === 'wait_assign_smelter' && isSmelterStation(stationKey)) ||
      (step.action === 'wait_assign_assembly' && isAssemblyStation(stationKey)) ||
      (step.action === 'wait_assign_depository' && event === 'assigned_depository');

    if (shouldAdvance) {
      this.currentTutStep++;
      this.factory.tutorialStep = this.currentTutStep;
      this.showTutorialStep(this.currentTutStep);
    }
  }

  tutorialWorkCompleted(station) {
    const step = this.tutorialSteps[this.currentTutStep];
    if (!step) return;

    const isSmelter = () => {
      if (!station || station === 'store' || station === 'depository') return false;
      const [r, c] = station.split(',').map(Number);
      const m = this.factory.getMachineAt(r, c);
      return m && m.type === 'smelter';
    };

    const isAssembly = () => {
      if (!station || station === 'store' || station === 'depository') return false;
      const [r, c] = station.split(',').map(Number);
      const m = this.factory.getMachineAt(r, c);
      return m && m.type === 'assembly';
    };

    const shouldAdvance =
      (step.action === 'wait_store_done' && station === 'store') ||
      (step.action === 'wait_smelter_done' && isSmelter()) ||
      (step.action === 'wait_assembly_done' && isAssembly()) ||
      (step.action === 'wait_depot_done' && station === 'depository');

    if (shouldAdvance) {
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

  // ── UPDATE LOOP ─────────────────────────────────────────────

  update(time, delta) {
    const completed = this.factory.update(delta);
    const w = this.factory.worker;
    const maxBarW = this.scale.width - 48;

    // Fixed station progress bars
    ['store', 'depository'].forEach(key => {
      const bar = this.progressBars[key];
      if (!bar) return;
      if (w.station === key && w.state === 'working') {
        bar.setSize(maxBarW * w.progress, 4);
      } else {
        bar.setSize(0, 4);
      }
    });

    // Machine progress bars
    for (let row = 0; row < this.ROWS; row++) {
      for (let col = 0; col < this.COLS; col++) {
        const key = `${row},${col}`;
        const bar = this.progressBars[key];
        if (!bar) continue;
        if (w.station === key && w.state === 'working') {
          bar.setSize((this.TILE - 4) * w.progress, 5);
        } else {
          bar.setSize(0, 5);
        }
      }
    }

    // Keep label on worker
    if (this.workerLabel && this.workerSprite) {
      this.workerLabel.setPosition(this.workerSprite.x, this.workerSprite.y);
    }

    if (completed) {
      this.updateWorkerStatus();

      if (w.station === 'depository') {
        this.addTowerToStockpile('gunner');
      }

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

    this.showMessage('GUNNER added to Armoury!', '#5eba7d');
    this.factory.save();
  }
}
