class FactoryScene extends Phaser.Scene {
  constructor() {
    super({ key: 'FactoryScene' });
  }

  create() {
    const { width, height } = this.scale;

    // Load save data
    const slotIndex = localStorage.getItem('factower_active_slot');
    const saveKey = `factower_save_${slotIndex}`;
    this.saveData = JSON.parse(localStorage.getItem(saveKey));

    // Grid config
    this.tileSize = 64;
    this.gridCols = 5;
    this.gridRows = 8;
    this.gridOffsetX = (width - this.tileSize * this.gridCols) / 2;
    this.gridOffsetY = 160;

    // Track placed machines
    this.grid = Array.from({ length: this.gridRows }, () => Array(this.gridCols).fill(null));

    // Selected machine type to place
    this.selectedMachine = null;

    // Background
    this.add.rectangle(width / 2, height / 2, width, height, 0x0a0c0f);

    // Header
    this.add.rectangle(width / 2, 52, width, 80, 0x111318);
    this.add.rectangle(width / 2, 92, width, 1, 0x252c38);

    this.add.text(width / 2, 30, 'FACTORY FLOOR', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#6a7585',
      letterSpacing: 4
    }).setOrigin(0.5);

    this.add.text(width / 2, 52, 'PRODUCE TOWERS', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#eef2f8',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Back button
    const backBtn = this.add.text(24, 52, '← BACK', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#6a7585',
      letterSpacing: 2
    }).setOrigin(0, 0.5).setInteractive();

    backBtn.on('pointerdown', () => {
      this.cameras.main.fade(200, 0, 0, 0);
      this.time.delayedCall(200, () => {
        this.scene.start('BaseScene');
      });
    });

    // Draw grid
    this.drawGrid();

    // Machine selector panel at bottom
    this.drawMachinePanel();
  }

  drawGrid() {
    const { width } = this.scale;

    // Grid label
    this.add.text(width / 2, 130, 'FACTORY FLOOR — TAP TILE TO PLACE', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#6a7585',
      letterSpacing: 2
    }).setOrigin(0.5);

    for (let row = 0; row < this.gridRows; row++) {
      for (let col = 0; col < this.gridCols; col++) {
        const x = this.gridOffsetX + col * this.tileSize + this.tileSize / 2;
        const y = this.gridOffsetY + row * this.tileSize + this.tileSize / 2;

        // Tile background
        const tile = this.add.rectangle(x, y, this.tileSize - 2, this.tileSize - 2, 0x111318)
          .setInteractive();

        // Tile border
        this.add.rectangle(x, y, this.tileSize - 2, this.tileSize - 2)
          .setStrokeStyle(1, 0x1a1e26);

        // Store grid reference on tile
        tile.gridRow = row;
        tile.gridCol = col;

        tile.on('pointerdown', () => this.tilePressed(tile, row, col));
        tile.on('pointerover', () => {
          if (this.grid[row][col] === null && this.selectedMachine) {
            tile.setFillStyle(0x1a1e26);
          }
        });
        tile.on('pointerout', () => {
          if (this.grid[row][col] === null) {
            tile.setFillStyle(0x111318);
          }
        });

        // Store tile reference
        this.grid[row][col] = { tile, machine: null };
      }
    }
  }

  drawMachinePanel() {
    const { width, height } = this.scale;
    const panelY = height - 160;

    // Panel background
    this.add.rectangle(width / 2, height - 100, width, 200, 0x111318);
    this.add.rectangle(width / 2, panelY, width, 1, 0x252c38);

    this.add.text(width / 2, panelY + 16, 'SELECT MACHINE', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#6a7585',
      letterSpacing: 4
    }).setOrigin(0.5);

    // MVP machines — Scavenger Rig and Assembly Bench only for now
    const machines = [
      { key: 'scavenger', label: 'SCAVENGER', sub: 'EXTRACTS MATERIALS', colour: 0x3a8fc4 },
      { key: 'smelter', label: 'SMELTER', sub: 'PROCESSES SCRAP', colour: 0xe8a020 },
      { key: 'assembly', label: 'ASSEMBLY', sub: 'BUILDS TOWERS', colour: 0x5eba7d },
    ];

    machines.forEach((m, i) => {
      const x = 60 + i * 110;
      const y = panelY + 70;

      const btn = this.add.rectangle(x, y, 96, 72, 0x1a1e26)
        .setInteractive();

      this.add.rectangle(x, y, 96, 72).setStrokeStyle(1, 0x252c38);

      // Colour dot
      this.add.circle(x, y - 18, 8, m.colour);

      this.add.text(x, y + 4, m.label, {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: '#c8d0dc',
        letterSpacing: 1
      }).setOrigin(0.5);

      this.add.text(x, y + 18, m.sub, {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#6a7585'
      }).setOrigin(0.5);

      btn.machineKey = m.key;
      btn.machineColour = m.colour;

      btn.on('pointerdown', () => this.selectMachine(m.key, m.colour, btn));
      btn.on('pointerover', () => btn.setFillStyle(0x252c38));
      btn.on('pointerout', () => {
        if (this.selectedMachine !== m.key) btn.setFillStyle(0x1a1e26);
      });
    });
  }

  selectMachine(key, colour, btn) {
    this.selectedMachine = key;
    this.selectedColour = colour;

    // Visual feedback — highlight selected
    this.children.list.forEach(child => {
      if (child.machineKey) {
        child.setFillStyle(child.machineKey === key ? 0x252c38 : 0x1a1e26);
      }
    });
  }

  tilePressed(tile, row, col) {
    if (!this.selectedMachine) return;
    if (this.grid[row][col].machine !== null) return;

    // Place machine on tile
    const x = this.gridOffsetX + col * this.tileSize + this.tileSize / 2;
    const y = this.gridOffsetY + row * this.tileSize + this.tileSize / 2;

    // Colour fill
    tile.setFillStyle(this.selectedColour, 0.2);
    this.add.rectangle(x, y, this.tileSize - 2, this.tileSize - 2)
      .setStrokeStyle(2, this.selectedColour);

    // Machine label
    this.add.text(x, y, this.selectedMachine.substring(0, 3).toUpperCase(), {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#eef2f8'
    }).setOrigin(0.5);

    // Mark grid cell as occupied
    this.grid[row][col].machine = this.selectedMachine;
  }
}
