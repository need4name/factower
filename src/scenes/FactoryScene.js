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

    // Layout — fitted to 844px portrait
    this.TILE = 52;
    this.COLS = 5;
    this.ROWS = 5;
    this.GX = (width - this.TILE * this.COLS) / 2;
    this.STORE_Y = 148;
    this.GY = 192;
    this.DEPOT_Y = this.GY + this.ROWS * this.TILE + 28;
    this.PANEL_Y = this.DEPOT_Y + 52;
    this.WORKER_SPEED = 80;

    this.placingMachine = null;
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
    this.drawStatusBar();

    if (!this.factory.tutorialComplete) {
      this.startTutorial();
    }
  }

  // ── LAYOUT ──────────────────────────────────────────────────

  drawHeader() {
    const { width } = this.scale;

    this.add.rectangle(width / 2, 64, width, 88, 0x161b22);
    this.add.rectangle(width / 2, 108, width, 1, 0x334455);

    // Back button — large tap target
    const backBtn = this.add.rectangle(52, 64, 84, 56, 0x1e2530)
      .setInteractive().setDepth(5);
    this.add.text(52, 64, '← BACK', {
      fontFamily: 'monospace', fontSize: '14px', color: '#e8a020'
    }).setOrigin(0.5).setDepth(6);
    backBtn.on('pointerdown', () => {
      this.factory.save();
      this.cameras.main.fade(200, 0, 0, 0);
      this.time.delayedCall(200, () => this.scene.start('BaseScene'));
    });
    backBtn.on('pointerover', () => backBtn.setFillStyle(0x252c38));
    backBtn.on('pointerout', () => backBtn.setFillStyle(0x1e2530));

    this.add.text(width / 2 + 28, 50, 'FACTORY FLOOR', {
      fontFamily: 'monospace', fontSize: '17px', color: '#eef2f8', fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(width / 2 + 28, 76, 'BUILD YOUR TOWERS', {
      fontFamily: 'monospace', fontSize: '11px', color: '#8899aa', letterSpacing: 2
    }).setOrigin(0.5);
  }

  drawFixedStations() {
    const { width } = this.scale;
    const cx = width / 2;

    // Store
    const storeBg = this.add.rectangle(cx, this.STORE_Y, width - 48, 40, 0x161b22)
      .setInteractive();
    this.add.rectangle(cx, this.STORE_Y, width - 48, 40)
      .setStrokeStyle(2, 0x3a8fc4);
    this.add.text(cx, this.STORE_Y, 'RAW MATERIAL STORE  —  TAP TO COLLECT', {
      fontFamily: 'monospace', fontSize: '11px', color: '#3a8fc4', fontStyle: 'bold'
    }).setOrigin(0.5);
    storeBg.on('pointerdown', () => this.stationTapped('store'));
    storeBg.on('pointerover', () => storeBg.setFillStyle(0x1e2d3a));
    storeBg.on('pointerout', () => storeBg.setFillStyle(0x161b22));

    // Store progress bar
    this.progressBars['store'] = this.add.rectangle(
      24, this.STORE_Y + 22, 0, 4, 0x3a8fc4
    ).setOrigin(0, 0.5);

    // Depository
    const depotBg = this.add.rectangle(cx, this.DEPOT_Y, width - 48, 40, 0x161b22)
      .setInteractive();
    this.add.rectangle(cx, this.DEPOT_Y, width - 48, 40)
      .setStrokeStyle(2, 0xc43a3a);
    this.add.text(cx, this.DEPOT_Y, 'DEPOSITORY  —  TAP TO DELIVER', {
      fontFamily: 'monospace', fontSize: '11px', color: '#c43a3a', fontStyle: 'bold'
    }).setOrigin(0.5);
    depotBg.on('pointerdown', () => this.stationTapped('depository'));
    depotBg.on('pointerover', () => depotBg.setFillStyle(0x2a1a1a));
    depotBg.on('pointerout', () => depotBg.setFillStyle(0x161b22));

    // Depository progress bar
    this.progressBars['depository'] = this.add.rectangle(
      24, this.DEPOT_Y + 22, 0, 4, 0xc43a3a
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
          if (!this.factory.getMachineAt(row, col)) tile.setFillStyle(0x161b22);
        });
      }
    }
  }

  tileTapped(tile, row, col) {
    // Placing a machine
    if (this.placingMachine) {
      if (this.factory.getMachineAt(row, col)) return;
      if (this.factory.placeMachine(row, col, this.placingMachine)) {
        this.drawMachineAt(row, col, this.placingMachine);
        this.factory.save();
        if (!this.factory.tutorialComplete) {
          this.advanceTutorial(`placed_${this.placingMachine}`);
        }
        this.placingMachine = null;
        this.smelterBtn?.setFillStyle(0x1e2530);
        this.assemblyBtn?.setFillStyle(0x1e2530);
      }
      return;
    }

    // Assigning worker to machine
    const machine = this.factory.getMachineAt(row, col);
    if (!machine) return;

    const stationKey = `${row},${col}`;
    const w = this.factory.worker;

    if (w.station === stationKey && w.state === 'working') {
      this.showMessage('Worker already here', '#8899aa');
      return;
    }

    if (!this.factory.canWorkerStartAt(stationKey)) {
      this.showMessage(
        `Need: ${MACHINE_TYPES[machine.type].inputItems.join(' + ')} in inventory`,
        '#c43a3a'
      );
      return;
    }

    this.walkWorkerTo(stationKey, () => {
      this.factory.startWorkAt(stationKey);
      this.updateStatus();
      if (!this.factory.tutorialComplete) {
        this.advanceTutorial(`assigned_${stationKey}`);
      }
    });
  }

  stationTapped(stationKey) {
    if (this.placingMachine) return;

    const w = this.factory.worker;
    if (w.station === stationKey && w.state === 'working') {
      this.showMessage('Worker already here', '#8899aa');
      return;
    }

    if (!this.factory.canWorkerStartAt(stationKey)) {
      if (stationKey === 'store' && w.inventory.length > 0) {
        this.showMessage('Deliver items first before collecting more', '#c43a3a');
      } else if (stationKey === 'depository') {
        this.showMessage('No finished tower to deliver yet', '#c43a3a');
      } else {
        this.showMessage('Worker needs the right materials first', '#c43a3a');
      }
      return;
    }

    this.walkWorkerTo(stationKey, () => {
      this.factory.startWorkAt(stationKey);
      this.updateStatus();
      if (!this.factory.tutorialComplete) {
        this.advanceTutorial(`assigned_${stationKey}`);
      }
    });
  }

  drawMachines() {
    Object.values(this.machineSprites).forEach(group => {
      if (group) Object.values(group).forEach(s => s?.destroy?.());
    });
    this.machineSprites = {};

    for (let row = 0; row < this.ROWS; row++) {
      for (let col = 0; col < this.COLS; col++) {
        const m = this.factory.getMachineAt(row, col);
        if (m) this.drawMachineAt(row, col, m.type);
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
    const lbl = this.add.text(x, y - 4, type === 'smelter' ? 'SML' : 'ASM', {
      fontFamily: 'monospace', fontSize: '13px', color: mt.colourHex, fontStyle: 'bold'
    }).setOrigin(0.5);

    const barBg = this.add.rectangle(x, y + this.TILE / 2 - 5, this.TILE - 4, 5, 0x2a3a4a);
    const bar = this.add.rectangle(
      x - (this.TILE - 4) / 2, y + this.TILE / 2 - 5, 0, 5, mt.colour
    ).setOrigin(0, 0.5);

    this.progressBars[key] = bar;
    this.machineSprites[key] = { bg, lbl, barBg, bar };

    // Long press to delete
    let timer = null;
    bg.setInteractive();
    bg.on('pointerdown', () => {
      timer = this.time.delayedCall(700, () => this.confirmDelete(row, col));
    });
    bg.on('pointerup', () => { timer?.remove(); timer = null; });
    bg.on('pointerout', () => { timer?.remove(); timer = null; });
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

    this.add.rectangle(width / 2, height - 56, width, height - this.PANEL_Y, 0x161b22);
    this.add.rectangle(width / 2, this.PANEL_Y, width, 1, 0x334455);

    const btnY = this.PANEL_Y + 52;

    this.smelterBtn = this.add.rectangle(78, btnY, 128, 80, 0x1e2530).setInteractive();
    this.add.rectangle(78, btnY, 128, 80).setStrokeStyle(1, 0xe8a020);
    this.add.circle(78, btnY - 26, 9, 0xe8a020);
    this.add.text(78, btnY + 2, 'SMELTER', {
      fontFamily: 'monospace', fontSize: '13px', color: '#eef2f8', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.add.text(78, btnY + 22, 'SCRAP→REFINED', {
      fontFamily: 'monospace', fontSize: '10px', color: '#8899aa'
    }).setOrigin(0.5);
    this.smelterBtn.on('pointerdown', () => this.selectPlacing('smelter'));
    this.smelterBtn.on('pointerover', () => this.smelterBtn.setFillStyle(0x252c38));
    this.smelterBtn.on('pointerout', () => {
      this.smelterBtn.setFillStyle(this.placingMachine === 'smelter' ? 0x2a3a4a : 0x1e2530);
    });

    this.assemblyBtn = this.add.rectangle(228, btnY, 128, 80, 0x1e2530).setInteractive();
    this.add.rectangle(228, btnY, 128, 80).setStrokeStyle(1, 0x5eba7d);
    this.add.circle(228, btnY - 26, 9, 0x5eba7d);
    this.add.text(228, btnY + 2, 'ASSEMBLY', {
      fontFamily: 'monospace', fontSize: '13px', color: '#eef2f8', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.add.text(228, btnY + 22, 'REFINED→TOWER', {
      fontFamily: 'monospace', fontSize: '10px', color: '#8899aa'
    }).setOrigin(0.5);
    this.assemblyBtn.on('pointerdown', () => this.selectPlacing('assembly'));
    this.assemblyBtn.on('pointerover', () => this.assemblyBtn.setFillStyle(0x252c38));
    this.assemblyBtn.on('pointerout', () => {
      this.assemblyBtn.setFillStyle(this.placingMachine === 'assembly' ? 0x2a3a4a : 0x1e2530);
    });

    // Delete instructions button
    const delBtn = this.add.rectangle(346, btnY, 80, 80, 0x1e2530).setInteractive();
    this.add.rectangle(346, btnY, 80, 80).setStrokeStyle(1, 0x553333);
    this.add.text(346, btnY - 8, 'DEL', {
      fontFamily: 'monospace', fontSize: '16px', color: '#aa4444', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.add.text(346, btnY + 16, 'HOLD', {
      fontFamily: 'monospace', fontSize: '10px', color: '#aa4444'
    }).setOrigin(0.5);
    delBtn.on('pointerdown', () => this.showMessage('HOLD any machine tile to delete it', '#c43a3a'));
  }

  drawStatusBar() {
    const { width, height } = this.scale;
    this.statusText = this.add.text(width / 2, height - 10, '', {
      fontFamily: 'monospace', fontSize: '11px', color: '#8899aa'
    }).setOrigin(0.5).setDepth(5);
    this.updateStatus();
  }

  // ── ACTIONS ─────────────────────────────────────────────────

  selectPlacing(type) {
    this.placingMachine = this.placingMachine === type ? null : type;
    this.smelterBtn?.setFillStyle(this.placingMachine === 'smelter' ? 0x2a3a4a : 0x1e2530);
    this.assemblyBtn?.setFillStyle(this.placingMachine === 'assembly' ? 0x2a3a4a : 0x1e2530);
    if (this.placingMachine) {
      this.showMessage(`Tap an empty tile to place ${this.placingMachine.toUpperCase()}`, '#e8a020');
    }
  }

  walkWorkerTo(stationKey, onComplete) {
    const target = this.getStationPos(stationKey);
    const dist = Phaser.Math.Distance.Between(
      this.workerSprite.x, this.workerSprite.y, target.x, target.y
    );

    this.factory.worker.state = 'walking';
    this.factory.worker.progress = 0;
    this.updateStatus();

    this.tweens.killTweensOf(this.workerSprite);
    this.tweens.killTweensOf(this.workerLabel);

    this.tweens.add({
      targets: [this.workerSprite, this.workerLabel],
      x: target.x,
      y: target.y,
      duration: Math.max((dist / this.WORKER_SPEED) * 1000, 80),
      ease: 'Linear',
      onComplete: () => {
        if (onComplete) onComplete();
        this.updateStatus();
      }
    });
  }

  getStationPos(stationKey) {
    const { width } = this.scale;
    if (stationKey === 'store') return { x: width / 2, y: this.STORE_Y };
    if (stationKey === 'depository') return { x: width / 2, y: this.DEPOT_Y };
    const [r, c] = stationKey.split(',').map(Number);
    return {
      x: this.GX + c * this.TILE + this.TILE / 2,
      y: this.GY + r * this.TILE + this.TILE / 2
    };
  }

  confirmDelete(row, col) {
    const machine = this.factory.getMachineAt(row, col);
    if (!machine) return;
    const mt = MACHINE_TYPES[machine.type];
    const { width, height } = this.scale;

    const els = [];
    const bg = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.75).setDepth(40);
    const box = this.add.rectangle(width / 2, height / 2, width - 60, 170, 0x161b22).setDepth(41);
    this.add.rectangle(width / 2, height / 2, width - 60, 170).setStrokeStyle(1, 0xc43a3a).setDepth(41);
    const title = this.add.text(width / 2, height / 2 - 48, `DELETE ${mt.name}?`, {
      fontFamily: 'monospace', fontSize: '18px', color: '#eef2f8', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(42);
    const sub = this.add.text(width / 2, height / 2 - 18, 'This cannot be undone.', {
      fontFamily: 'monospace', fontSize: '13px', color: '#8899aa'
    }).setOrigin(0.5).setDepth(42);

    const confirmBtn = this.add.rectangle(width / 2 - 80, height / 2 + 44, 130, 48, 0x3a1010).setInteractive().setDepth(42);
    this.add.rectangle(width / 2 - 80, height / 2 + 44, 130, 48).setStrokeStyle(1, 0xc43a3a).setDepth(42);
    this.add.text(width / 2 - 80, height / 2 + 44, 'DELETE', {
      fontFamily: 'monospace', fontSize: '15px', color: '#c43a3a', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(43);

    const cancelBtn = this.add.rectangle(width / 2 + 80, height / 2 + 44, 130, 48, 0x1e2530).setInteractive().setDepth(42);
    this.add.rectangle(width / 2 + 80, height / 2 + 44, 130, 48).setStrokeStyle(1, 0x334455).setDepth(42);
    this.add.text(width / 2 + 80, height / 2 + 44, 'CANCEL', {
      fontFamily: 'monospace', fontSize: '15px', color: '#8899aa', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(43);

    const all = [bg, box, title, sub, confirmBtn, cancelBtn];
    const dismiss = () => all.forEach(e => e?.destroy());

    confirmBtn.on('pointerdown', () => {
      dismiss();
      const key = `${row},${col}`;
      if (this.machineSprites[key]) {
        Object.values(this.machineSprites[key]).forEach(s => s?.destroy?.());
        delete this.machineSprites[key];
        delete this.progressBars[key];
      }
      this.factory.deleteMachine(row, col);
      this.factory.save();
    });
    cancelBtn.on('pointerdown', dismiss);
  }

  showMessage(text, colour) {
    const { width } = this.scale;
    this.msgText?.destroy();
    this.msgText = this.add.text(width / 2, 116, text, {
      fontFamily: 'monospace', fontSize: '12px',
      color: colour || '#e8a020',
      backgroundColor: '#161b22',
      padding: { x: 10, y: 5 }
    }).setOrigin(0.5).setDepth(20);
    this.time.delayedCall(2500, () => { if (this.msgText?.active) this.msgText.destroy(); });
  }

  updateStatus() {
    if (!this.statusText) return;
    const w = this.factory.worker;
    const inv = this.factory.getInventoryDisplay();
    this.statusText.setText(`W1: ${w.state.toUpperCase()}  ·  CARRYING: ${inv}`);
  }

  // ── TUTORIAL ────────────────────────────────────────────────
  // Simple approach: one persistent instruction strip, no blocking overlays

  startTutorial() {
    const { width } = this.scale;

    // Single tutorial strip — non-blocking, sits just below header
    this.tutorialStrip = this.add.text(width / 2, 120, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#e8a020',
      backgroundColor: '#1a1408',
      padding: { x: 10, y: 6 },
      align: 'center',
      wordWrap: { width: width - 40 }
    }).setOrigin(0.5).setDepth(25);

    this.currentTutStep = this.factory.tutorialStep || 0;
    this.updateTutorialStrip();
  }

  updateTutorialStrip() {
    if (!this.tutorialStrip) return;

    const steps = [
      'TUTORIAL: Tap SMELTER below, then tap an empty grid tile to place it.',
      'TUTORIAL: Tap ASSEMBLY below, then tap an empty grid tile to place it below the smelter.',
      'TUTORIAL: Tap the RAW MATERIAL STORE to send your worker to collect materials.',
      'TUTORIAL: Tap the SMELTER tile to smelt your plastic scrap.',
      'TUTORIAL: Tap the ASSEMBLY BENCH tile to build your tower.',
      'TUTORIAL: Tap the DEPOSITORY to deliver your finished tower.',
      'TUTORIAL COMPLETE! Tower added to Armoury. Head to the DOCK to fight.'
    ];

    const msg = steps[this.currentTutStep] || '';
    this.tutorialStrip.setText(msg);

    if (this.currentTutStep >= steps.length) {
      this.completeTutorial();
    }
  }

  advanceTutorial(event) {
    const step = this.currentTutStep;

    const isSmelter = (key) => {
      if (!key || key === 'store' || key === 'depository') return false;
      const [r, c] = key.split(',').map(Number);
      const m = this.factory.getMachineAt(r, c);
      return m?.type === 'smelter';
    };

    const isAssembly = (key) => {
      if (!key || key === 'store' || key === 'depository') return false;
      const [r, c] = key.split(',').map(Number);
      const m = this.factory.getMachineAt(r, c);
      return m?.type === 'assembly';
    };

    const stationKey = event.startsWith('assigned_') ? event.replace('assigned_', '') : '';

    const advance =
      (step === 0 && event === 'placed_smelter') ||
      (step === 1 && event === 'placed_assembly') ||
      (step === 2 && event === 'assigned_store') ||
      (step === 3 && isSmelter(stationKey)) ||
      (step === 4 && isAssembly(stationKey)) ||
      (step === 5 && event === 'assigned_depository');

    if (advance) {
      this.currentTutStep++;
      this.factory.tutorialStep = this.currentTutStep;
      this.updateTutorialStrip();
    }
  }

  tutorialWorkCompleted(station) {
    const step = this.currentTutStep;

    const isSmelter = () => {
      if (!station || station === 'store' || station === 'depository') return false;
      const [r, c] = station.split(',').map(Number);
      return this.factory.getMachineAt(r, c)?.type === 'smelter';
    };

    const isAssembly = () => {
      if (!station || station === 'store' || station === 'depository') return false;
      const [r, c] = station.split(',').map(Number);
      return this.factory.getMachineAt(r, c)?.type === 'assembly';
    };

    const advance =
      (step === 3 && isSmelter()) ||
      (step === 4 && isAssembly()) ||
      (step === 6 && station === 'depository');

    if (advance) {
      this.currentTutStep++;
      this.factory.tutorialStep = this.currentTutStep;
      this.updateTutorialStrip();
    }
  }

  completeTutorial() {
    this.factory.tutorialComplete = true;
    this.factory.tutorialStep = 0;
    this.factory.save();
    this.tutorialStrip?.destroy();
    this.tutorialStrip = null;
  }

  // ── UPDATE LOOP ─────────────────────────────────────────────

  update(time, delta) {
    const completed = this.factory.update(delta);
    const w = this.factory.worker;
    const barW = this.scale.width - 48;

    // Fixed station bars
    ['store', 'depository'].forEach(key => {
      const bar = this.progressBars[key];
      if (!bar) return;
      bar.setSize(
        (w.station === key && w.state === 'working') ? barW * w.progress : 0,
        4
      );
    });

    // Machine bars
    for (let r = 0; r < this.ROWS; r++) {
      for (let c = 0; c < this.COLS; c++) {
        const key = `${r},${c}`;
        const bar = this.progressBars[key];
        if (!bar) continue;
        bar.setSize(
          (w.station === key && w.state === 'working') ? (this.TILE - 4) * w.progress : 0,
          5
        );
      }
    }

    // Keep worker label on worker sprite
    if (this.workerLabel && this.workerSprite) {
      this.workerLabel.setPosition(this.workerSprite.x, this.workerSprite.y);
    }

    if (completed) {
      this.updateStatus();

      if (w.station === 'depository') {
        this.addTowerToStockpile('gunner');
      }

      if (!this.factory.tutorialComplete) {
        this.tutorialWorkCompleted(w.station);
      }
    }
  }

  addTowerToStockpile(type) {
    const slotIndex = localStorage.getItem('factower_active_slot');
    const saveKey = `factower_save_${slotIndex}`;
    const save = JSON.parse(localStorage.getItem(saveKey));
    if (!save.stockpile) save.stockpile = { gunner: 0, bomber: 0, barricade: 0 };
    save.stockpile[type] = (save.stockpile[type] || 0) + 1;
    localStorage.setItem(saveKey, JSON.stringify(save));
    this.saveData = save;
    this.showMessage(`${type.toUpperCase()} added to Armoury!`, '#5eba7d');
    this.factory.save();
  }
}
