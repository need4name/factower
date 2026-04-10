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
    this.ROWS = 5;
    this.GX = (width - this.TILE * this.COLS) / 2;
    this.HEADER_Y = 184;
    this.STORE_Y = 268;
    this.GY = 312;
    this.DEPOT_Y = this.GY + this.ROWS * this.TILE + 28;
    this.PANEL_Y = this.DEPOT_Y + 52;
    this.WORKER_SPEED = 80;

    this.placingMachine = null;
    this.progressBars = {};
    this.machineSprites = {};
    this.workerSprites = {};
    this.workerLabels = {};
    this.msgText = null;
    this.tutorialStrip = null;
    this.workerMenuActive = false;

    this.add.rectangle(width / 2, height / 2, width, height, 0x0d1117);

    this.drawHeader();
    this.drawFixedStations();
    this.drawGrid();
    this.drawMachines();
    this.drawWorkers();
    this.drawBottomPanel();
    this.drawStatusBar();

    if (!this.factory.tutorialComplete) {
      this.startTutorial();
    } else {
      this.checkWorker2Recruitment();
    }
  }

  checkWorker2Recruitment() {
    const w2 = this.factory.workers[1];
    if (w2.unlocked && !this.factory.worker2Introduced && this.factory.tutorialComplete) {
      this.factory.worker2Introduced = true;
      this.factory.save();
      this.showRecruitmentBanner();
    }
  }

  showRecruitmentBanner() {
    const { width, height } = this.scale;
    const all = [];

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7).setDepth(50);
    const box = this.add.rectangle(width / 2, height / 2, width - 48, 220, 0x161b22).setDepth(51);
    const boxBorder = this.add.rectangle(width / 2, height / 2, width - 48, 220).setStrokeStyle(1, 0x3a8fc4).setDepth(51);
    const dot = this.add.circle(width / 2, height / 2 - 72, 20, 0x3a8fc4).setDepth(52);
    const dotLabel = this.add.text(width / 2, height / 2 - 72, 'W2', {
      fontFamily: 'monospace', fontSize: '11px', color: '#0d1117', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(53);
    const title = this.add.text(width / 2, height / 2 - 36, 'NEW RECRUIT', {
      fontFamily: 'monospace', fontSize: '22px', color: '#3a8fc4', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(52);
    const body = this.add.text(width / 2, height / 2 + 2, 'Word of your victory spread.\nA second worker has arrived\nand is ready to be assigned.', {
      fontFamily: 'monospace', fontSize: '13px', color: '#eef2f8',
      align: 'center', lineSpacing: 5
    }).setOrigin(0.5).setDepth(52);
    const btn = this.add.rectangle(width / 2, height / 2 + 76, 200, 48, 0x1e2d3a).setInteractive().setDepth(52);
    const btnBorder = this.add.rectangle(width / 2, height / 2 + 76, 200, 48).setStrokeStyle(1, 0x3a8fc4).setDepth(52);
    const btnLabel = this.add.text(width / 2, height / 2 + 76, 'WELCOME THEM', {
      fontFamily: 'monospace', fontSize: '15px', color: '#3a8fc4', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(53);

    all.push(overlay, box, boxBorder, dot, dotLabel, title, body, btn, btnBorder, btnLabel);

    btn.on('pointerdown', () => {
      all.forEach(e => e?.destroy?.());
      this.drawWorkers();
      this.showMessage('W2 assigned to factory. Tap any station to assign them.', '#3a8fc4');
    });
    btn.on('pointerover', () => btn.setFillStyle(0x253545));
    btn.on('pointerout', () => btn.setFillStyle(0x1e2d3a));
  }

  drawHeader() {
    const { width } = this.scale;

    this.add.rectangle(width / 2, this.HEADER_Y, width, 88, 0x161b22);
    this.add.rectangle(width / 2, this.HEADER_Y + 44, width, 1, 0x334455);

    const backBtn = this.add.rectangle(52, this.HEADER_Y, 84, 56, 0x1e2530)
      .setInteractive().setDepth(5);
    this.add.text(52, this.HEADER_Y, '← BACK', {
      fontFamily: 'monospace', fontSize: '14px', color: '#e8a020'
    }).setOrigin(0.5).setDepth(6);
    backBtn.on('pointerdown', () => {
      this.factory.save();
      this.cameras.main.fade(200, 0, 0, 0);
      this.time.delayedCall(200, () => this.scene.start('BaseScene'));
    });
    backBtn.on('pointerover', () => backBtn.setFillStyle(0x252c38));
    backBtn.on('pointerout', () => backBtn.setFillStyle(0x1e2530));

    this.add.text(width / 2 + 28, this.HEADER_Y - 14, 'FACTORY FLOOR', {
      fontFamily: 'monospace', fontSize: '17px', color: '#eef2f8', fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(width / 2 + 28, this.HEADER_Y + 12, 'BUILD YOUR TOWERS', {
      fontFamily: 'monospace', fontSize: '11px', color: '#8899aa', letterSpacing: 2
    }).setOrigin(0.5);
  }

  drawFixedStations() {
    const { width } = this.scale;
    const cx = width / 2;

    const storeBg = this.add.rectangle(cx, this.STORE_Y, width - 48, 40, 0x161b22).setInteractive();
    this.add.rectangle(cx, this.STORE_Y, width - 48, 40).setStrokeStyle(2, 0x3a8fc4);
    this.add.text(cx, this.STORE_Y, 'RAW MATERIAL STORE  —  TAP TO COLLECT', {
      fontFamily: 'monospace', fontSize: '11px', color: '#3a8fc4', fontStyle: 'bold'
    }).setOrigin(0.5);
    storeBg.on('pointerdown', () => this.stationTapped('store'));
    storeBg.on('pointerover', () => storeBg.setFillStyle(0x1e2d3a));
    storeBg.on('pointerout', () => storeBg.setFillStyle(0x161b22));
    this.progressBars['store'] = this.add.rectangle(24, this.STORE_Y + 22, 0, 4, 0x3a8fc4).setOrigin(0, 0.5);

    const depotBg = this.add.rectangle(cx, this.DEPOT_Y, width - 48, 40, 0x161b22).setInteractive();
    this.add.rectangle(cx, this.DEPOT_Y, width - 48, 40).setStrokeStyle(2, 0xc43a3a);
    this.add.text(cx, this.DEPOT_Y, 'DEPOSITORY  —  TAP TO DELIVER', {
      fontFamily: 'monospace', fontSize: '11px', color: '#c43a3a', fontStyle: 'bold'
    }).setOrigin(0.5);
    depotBg.on('pointerdown', () => this.stationTapped('depository'));
    depotBg.on('pointerover', () => depotBg.setFillStyle(0x2a1a1a));
    depotBg.on('pointerout', () => depotBg.setFillStyle(0x161b22));
    this.progressBars['depository'] = this.add.rectangle(24, this.DEPOT_Y + 22, 0, 4, 0xc43a3a).setOrigin(0, 0.5);
  }

  drawGrid() {
    for (let row = 0; row < this.ROWS; row++) {
      for (let col = 0; col < this.COLS; col++) {
        const x = this.GX + col * this.TILE + this.TILE / 2;
        const y = this.GY + row * this.TILE + this.TILE / 2;

        const tile = this.add.rectangle(x, y, this.TILE - 2, this.TILE - 2, 0x161b22).setInteractive();
        this.add.rectangle(x, y, this.TILE - 2, this.TILE - 2).setStrokeStyle(1, 0x2a3a4a);

        tile.gridRow = row;
        tile.gridCol = col;

        tile.on('pointerdown', () => this.tileTapped(tile, row, col));
        tile.on('pointerover', () => {
          if (this.placingMachine && !this.factory.getMachineAt(row, col)) tile.setFillStyle(0x1e2d3a);
        });
        tile.on('pointerout', () => {
          if (!this.factory.getMachineAt(row, col)) tile.setFillStyle(0x161b22);
        });
      }
    }
  }

  tileTapped(tile, row, col) {
    if (this.placingMachine) {
      if (this.factory.getMachineAt(row, col)) return;
      if (this.factory.placeMachine(row, col, this.placingMachine)) {
        this.drawMachineAt(row, col, this.placingMachine);
        this.factory.save();
        if (!this.factory.tutorialComplete) this.advanceTutorial(`placed_${this.placingMachine}`);
        this.placingMachine = null;
        this.smelterBtn?.setFillStyle(0x1e2530);
        this.assemblyBtn?.setFillStyle(0x1e2530);
      }
      return;
    }

    const machine = this.factory.getMachineAt(row, col);
    if (!machine) return;
    this.openWorkerMenu(`${row},${col}`);
  }

  stationTapped(stationKey) {
    if (this.placingMachine) return;
    this.openWorkerMenu(stationKey);
  }

  openWorkerMenu(stationKey) {
    if (this.workerMenuActive) return;

    const unlocked = this.factory.getUnlockedWorkers();

    if (unlocked.length === 1) {
      this.tryAssignWorker(0, stationKey);
      return;
    }

    this.workerMenuActive = true;
    const pos = this.getStationPos(stationKey);
    const { width } = this.scale;
    const menuY = pos.y > 500 ? pos.y - 80 : pos.y + 80;
    const menuElements = [];

    const dismissZone = this.add.rectangle(width / 2, this.scale.height / 2, width, this.scale.height, 0x000000, 0.01)
      .setInteractive().setDepth(29);
    menuElements.push(dismissZone);

    const menuBg = this.add.rectangle(width / 2, menuY, 260, 80, 0x161b22).setDepth(30);
    const menuBorder = this.add.rectangle(width / 2, menuY, 260, 80).setStrokeStyle(1, 0x334455).setDepth(30);
    menuElements.push(menuBg, menuBorder);

    const headerTxt = this.add.text(width / 2, menuY - 28, 'ASSIGN WORKER', {
      fontFamily: 'monospace', fontSize: '10px', color: '#8899aa', letterSpacing: 3
    }).setOrigin(0.5).setDepth(31);
    menuElements.push(headerTxt);

    const dismiss = () => {
      menuElements.forEach(e => { try { e?.destroy?.(); } catch(err) {} });
      this.workerMenuActive = false;
    };

    unlocked.forEach((w, i) => {
      const btnX = width / 2 - 56 + i * 116;
      const canWork = this.factory.canWorkerStartAt(stationKey, w.id);
      const workerColour = WORKER_COLOURS[w.id];
      const colourHex = '#' + workerColour.toString(16).padStart(6, '0');

      const btn = this.add.rectangle(btnX, menuY + 8, 104, 52, canWork ? 0x1e2530 : 0x161b22).setDepth(31);
      const btnBorder = this.add.rectangle(btnX, menuY + 8, 104, 52).setStrokeStyle(1, canWork ? workerColour : 0x334455).setDepth(31);
      const dot = this.add.circle(btnX - 28, menuY + 8, 10, canWork ? workerColour : 0x334455).setDepth(32);
      const dotLabel = this.add.text(btnX - 28, menuY + 8, WORKER_LABELS[w.id], {
        fontFamily: 'monospace', fontSize: '10px', color: '#0d1117', fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(33);
      const stateText = w.state === 'working' ? 'BUSY' : w.state === 'walking' ? 'MOVING' : 'IDLE';
      const stateTxt = this.add.text(btnX + 4, menuY, stateText, {
        fontFamily: 'monospace', fontSize: '11px',
        color: canWork ? colourHex : '#445566', fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(32);
      const invTxt = this.add.text(btnX + 4, menuY + 18, this.factory.getInventoryDisplay(w.id), {
        fontFamily: 'monospace', fontSize: '9px', color: '#556677'
      }).setOrigin(0.5).setDepth(32);

      menuElements.push(btn, btnBorder, dot, dotLabel, stateTxt, invTxt);

      if (canWork) {
        btn.setInteractive();
        btn.on('pointerdown', () => {
          dismiss();
          this.tryAssignWorker(w.id, stationKey);
        });
        btn.on('pointerover', () => btn.setFillStyle(0x252c38));
        btn.on('pointerout', () => btn.setFillStyle(0x1e2530));
      }
    });

    dismissZone.on('pointerdown', dismiss);
  }

  tryAssignWorker(workerId, stationKey) {
    if (!this.factory.canWorkerStartAt(stationKey, workerId)) {
      const w = this.factory.workers[workerId];
      if (stationKey === 'store' && w.inventory.length > 0) {
        this.showMessage(`W${workerId + 1}: Deliver items first`, '#c43a3a');
      } else if (stationKey === 'depository') {
        this.showMessage(`W${workerId + 1}: No finished tower to deliver`, '#c43a3a');
      } else {
        const parts = stationKey.split(',').map(Number);
        const machine = this.factory.getMachineAt(parts[0], parts[1]);
        if (machine) {
          this.showMessage(`W${workerId + 1}: Need ${MACHINE_TYPES[machine.type].inputItems.join(' + ')}`, '#c43a3a');
        }
      }
      return;
    }

    this.walkWorkerTo(workerId, stationKey, () => {
      this.factory.startWorkAt(stationKey, workerId);
      this.updateStatus();
      if (!this.factory.tutorialComplete) this.advanceTutorial(`assigned_${stationKey}`);
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

    let timer = null;
    let pressing = false;
    bg.setInteractive();
    bg.on('pointerdown', () => {
      pressing = true;
      timer = this.time.delayedCall(700, () => {
        pressing = false;
        this.confirmDelete(row, col);
      });
    });
    bg.on('pointerup', () => {
      timer?.remove(); timer = null;
      if (pressing) {
        pressing = false;
        this.tileTapped(null, row, col);
      }
    });
    bg.on('pointerout', () => { timer?.remove(); timer = null; pressing = false; });
  }

  drawWorkers() {
    Object.values(this.workerSprites).forEach(s => s?.destroy?.());
    Object.values(this.workerLabels).forEach(s => s?.destroy?.());
    this.workerSprites = {};
    this.workerLabels = {};

    this.factory.getUnlockedWorkers().forEach(w => {
      const col = Phaser.Math.Between(0, this.COLS - 1);
      const row = Phaser.Math.Between(0, this.ROWS - 1);
      const startX = this.GX + col * this.TILE + this.TILE / 2;
      const startY = this.GY + row * this.TILE + this.TILE / 2;

      const sprite = this.add.circle(startX, startY, 14, WORKER_COLOURS[w.id]).setDepth(10);
      const label = this.add.text(startX, startY, WORKER_LABELS[w.id], {
        fontFamily: 'monospace', fontSize: '9px', color: '#0d1117', fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(11);
      this.workerSprites[w.id] = sprite;
      this.workerLabels[w.id] = label;
    });
  }

  drawBottomPanel() {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, (this.PANEL_Y + height) / 2, width, height - this.PANEL_Y, 0x161b22);
    this.add.rectangle(width / 2, this.PANEL_Y, width, 1, 0x334455);

    const btnY = this.PANEL_Y + 56;

    this.smelterBtn = this.add.rectangle(78, btnY, 128, 84, 0x1e2530).setInteractive();
    this.add.rectangle(78, btnY, 128, 84).setStrokeStyle(1, 0xe8a020);
    this.add.circle(78, btnY - 28, 9, 0xe8a020);
    this.add.text(78, btnY + 4, 'SMELTER', {
      fontFamily: 'monospace', fontSize: '13px', color: '#eef2f8', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.add.text(78, btnY + 24, 'SCRAP→REFINED', {
      fontFamily: 'monospace', fontSize: '10px', color: '#8899aa'
    }).setOrigin(0.5);
    this.smelterBtn.on('pointerdown', () => this.selectPlacing('smelter'));
    this.smelterBtn.on('pointerover', () => this.smelterBtn.setFillStyle(0x252c38));
    this.smelterBtn.on('pointerout', () => {
      this.smelterBtn.setFillStyle(this.placingMachine === 'smelter' ? 0x2a3a4a : 0x1e2530);
    });

    this.assemblyBtn = this.add.rectangle(228, btnY, 128, 84, 0x1e2530).setInteractive();
    this.add.rectangle(228, btnY, 128, 84).setStrokeStyle(1, 0x5eba7d);
    this.add.circle(228, btnY - 28, 9, 0x5eba7d);
    this.add.text(228, btnY + 4, 'ASSEMBLY', {
      fontFamily: 'monospace', fontSize: '13px', color: '#eef2f8', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.add.text(228, btnY + 24, 'REFINED→TOWER', {
      fontFamily: 'monospace', fontSize: '10px', color: '#8899aa'
    }).setOrigin(0.5);
    this.assemblyBtn.on('pointerdown', () => this.selectPlacing('assembly'));
    this.assemblyBtn.on('pointerover', () => this.assemblyBtn.setFillStyle(0x252c38));
    this.assemblyBtn.on('pointerout', () => {
      this.assemblyBtn.setFillStyle(this.placingMachine === 'assembly' ? 0x2a3a4a : 0x1e2530);
    });

    const delBtn = this.add.rectangle(346, btnY, 80, 84, 0x1e2530).setInteractive();
    this.add.rectangle(346, btnY, 80, 84).setStrokeStyle(1, 0x553333);
    this.add.text(346, btnY - 10, 'DEL', {
      fontFamily: 'monospace', fontSize: '16px', color: '#aa4444', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.add.text(346, btnY + 14, 'HOLD', {
      fontFamily: 'monospace', fontSize: '10px', color: '#aa4444'
    }).setOrigin(0.5);
    this.add.text(346, btnY + 28, 'MACHINE', {
      fontFamily: 'monospace', fontSize: '10px', color: '#aa4444'
    }).setOrigin(0.5);
    delBtn.on('pointerdown', () => this.showMessage('Hold any machine to delete it', '#c43a3a'));
  }

  drawStatusBar() {
    const { width, height } = this.scale;
    this.statusText = this.add.text(width / 2, height - 16, '', {
      fontFamily: 'monospace', fontSize: '11px', color: '#8899aa'
    }).setOrigin(0.5).setDepth(5);
    this.updateStatus();
  }

  selectPlacing(type) {
    this.placingMachine = this.placingMachine === type ? null : type;
    this.smelterBtn?.setFillStyle(this.placingMachine === 'smelter' ? 0x2a3a4a : 0x1e2530);
    this.assemblyBtn?.setFillStyle(this.placingMachine === 'assembly' ? 0x2a3a4a : 0x1e2530);
    if (this.placingMachine) {
      this.showMessage(`Tap an empty tile to place ${this.placingMachine.toUpperCase()}`, '#e8a020');
    }
  }

  walkWorkerTo(workerId, stationKey, onComplete) {
    const sprite = this.workerSprites[workerId];
    const label = this.workerLabels[workerId];
    if (!sprite) return;

    const target = this.getStationPos(stationKey);
    const dist = Phaser.Math.Distance.Between(sprite.x, sprite.y, target.x, target.y);

    this.factory.workers[workerId].state = 'walking';
    this.factory.workers[workerId].progress = 0;
    this.updateStatus();

    this.tweens.killTweensOf(sprite);
    this.tweens.killTweensOf(label);

    this.tweens.add({
      targets: [sprite, label],
      x: target.x, y: target.y,
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
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.75).setDepth(40);
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
    const all = [overlay, box, title, sub, confirmBtn, cancelBtn];
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
    this.msgText = this.add.text(width / 2, this.HEADER_Y + 52, text, {
      fontFamily: 'monospace', fontSize: '12px',
      color: colour || '#e8a020',
      backgroundColor: '#161b22',
      padding: { x: 10, y: 5 }
    }).setOrigin(0.5).setDepth(20);
    this.time.delayedCall(2500, () => { if (this.msgText?.active) this.msgText.destroy(); });
  }

  updateStatus() {
    if (!this.statusText) return;
    const parts = this.factory.getUnlockedWorkers().map(w =>
      `W${w.id + 1}: ${w.state.toUpperCase()}`
    );
    this.statusText.setText(parts.join('  ·  '));
  }

  startTutorial() {
    const { width } = this.scale;
    this.currentTutStep = this.factory.tutorialStep || 0;

    this.tutorialStrip = this.add.text(width / 2, this.HEADER_Y + 52, '', {
      fontFamily: 'monospace', fontSize: '12px',
      color: '#e8a020',
      backgroundColor: '#1a1408',
      padding: { x: 10, y: 6 },
      align: 'center',
      wordWrap: { width: width - 40 }
    }).setOrigin(0.5).setDepth(25);

    this.updateTutorialStrip();
  }

  getTutorialMessage(step) {
    const msgs = [
      'TUTORIAL (1/6): Tap SMELTER below then tap an empty grid tile to place it.',
      'TUTORIAL (2/6): Tap ASSEMBLY below then tap another empty tile.',
      'TUTORIAL (3/6): Tap the RAW MATERIAL STORE to collect materials.',
      'TUTORIAL: Collecting materials — please wait...',
      'TUTORIAL (4/6): Materials ready! Tap the SMELTER tile to process scrap.',
      'TUTORIAL: Smelting — please wait...',
      'TUTORIAL (5/6): Smelting done! Tap the ASSEMBLY BENCH tile to build tower.',
      'TUTORIAL: Assembling — please wait...',
      'TUTORIAL (6/6): Tower ready! Tap the DEPOSITORY to deliver it.',
      'TUTORIAL: Delivering — please wait...',
      'TUTORIAL COMPLETE! Tower added to Armoury. Go to the DOCK to fight!'
    ];
    return msgs[step] || '';
  }

  updateTutorialStrip() {
    if (!this.tutorialStrip) return;
    this.tutorialStrip.setText(this.getTutorialMessage(this.currentTutStep));
    if (this.currentTutStep >= 10) {
      this.time.delayedCall(2000, () => this.completeTutorial());
    }
  }

  advanceTutorial(event) {
    const step = this.currentTutStep;
    const stationKey = event.startsWith('assigned_') ? event.replace('assigned_', '') : '';

    const isSmelterKey = (key) => {
      if (!key || key === 'store' || key === 'depository') return false;
      const [r, c] = key.split(',').map(Number);
      return this.factory.getMachineAt(r, c)?.type === 'smelter';
    };
    const isAssemblyKey = (key) => {
      if (!key || key === 'store' || key === 'depository') return false;
      const [r, c] = key.split(',').map(Number);
      return this.factory.getMachineAt(r, c)?.type === 'assembly';
    };

    const should =
      (step === 0 && event === 'placed_smelter') ||
      (step === 1 && event === 'placed_assembly') ||
      (step === 2 && event === 'assigned_store') ||
      (step === 4 && isSmelterKey(stationKey)) ||
      (step === 6 && isAssemblyKey(stationKey)) ||
      (step === 8 && event === 'assigned_depository');

    if (should) {
      this.currentTutStep++;
      this.factory.tutorialStep = this.currentTutStep;
      this.updateTutorialStrip();
    }
  }

  tutorialWorkCompleted(station) {
    const step = this.currentTutStep;

    const isSmelter = () => {
      if (!station || station === 'store' || station === 'depository') return false;
      return this.factory.getMachineAt(...station.split(',').map(Number))?.type === 'smelter';
    };
    const isAssembly = () => {
      if (!station || station === 'store' || station === 'depository') return false;
      return this.factory.getMachineAt(...station.split(',').map(Number))?.type === 'assembly';
    };

    const should =
      (step === 3 && station === 'store') ||
      (step === 5 && isSmelter()) ||
      (step === 7 && isAssembly()) ||
      (step === 9 && station === 'depository');

    if (should) {
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

    const { width, height } = this.scale;
    const all = [];

    const banner = this.add.rectangle(width / 2, height / 2, width - 48, 180, 0x161b22).setDepth(35);
    const bannerBorder = this.add.rectangle(width / 2, height / 2, width - 48, 180).setStrokeStyle(1, 0x5eba7d).setDepth(35);
    const title = this.add.text(width / 2, height / 2 - 52, 'TOWER BUILT!', {
      fontFamily: 'monospace', fontSize: '24px', color: '#5eba7d', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(36);
    const body = this.add.text(width / 2, height / 2 - 16, 'Your first GUNNER is in the Armoury.\nHead to the DOCK to fight\nyour first battle.', {
      fontFamily: 'monospace', fontSize: '13px', color: '#eef2f8',
      align: 'center', lineSpacing: 5
    }).setOrigin(0.5).setDepth(36);
    const dockBtn = this.add.rectangle(width / 2, height / 2 + 64, 220, 48, 0x1a2210).setInteractive().setDepth(36);
    const dockBtnBorder = this.add.rectangle(width / 2, height / 2 + 64, 220, 48).setStrokeStyle(1, 0xe8a020).setDepth(36);
    const dockBtnLabel = this.add.text(width / 2, height / 2 + 64, 'GO TO DOCK →', {
      fontFamily: 'monospace', fontSize: '16px', color: '#e8a020', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(37);

    all.push(banner, bannerBorder, title, body, dockBtn, dockBtnBorder, dockBtnLabel);

    dockBtn.on('pointerdown', () => {
      all.forEach(e => e?.destroy?.());
      this.factory.save();
      this.cameras.main.fade(200, 0, 0, 0);
      this.time.delayedCall(200, () => this.scene.start('DockScene'));
    });
    dockBtn.on('pointerover', () => dockBtn.setFillStyle(0x253318));
    dockBtn.on('pointerout', () => dockBtn.setFillStyle(0x1a2210));
  }

  update(time, delta) {
    const completedWorkers = this.factory.update(delta);
    const barW = this.scale.width - 48;

    this.factory.getUnlockedWorkers().forEach(w => {
      const sprite = this.workerSprites[w.id];
      const label = this.workerLabels[w.id];
      if (sprite && label) label.setPosition(sprite.x, sprite.y);
    });

    const updateBar = (stationKey, maxW, barH) => {
      const bar = this.progressBars[stationKey];
      if (!bar) return;
      const workingWorker = this.factory.workers.find(
        w => w.unlocked && w.station === stationKey && w.state === 'working'
      );
      bar.setSize(workingWorker ? maxW * workingWorker.progress : 0, barH);
    };

    updateBar('store', barW, 4);
    updateBar('depository', barW, 4);

    for (let r = 0; r < this.ROWS; r++) {
      for (let c = 0; c < this.COLS; c++) {
        updateBar(`${r},${c}`, this.TILE - 4, 5);
      }
    }

    completedWorkers.forEach(workerId => {
      this.updateStatus();
      const w = this.factory.workers[workerId];
      if (w.station === 'depository') {
        this.addTowerToStockpile('gunner');
      }
      if (!this.factory.tutorialComplete) {
        this.tutorialWorkCompleted(w.station);
      }
    });
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
