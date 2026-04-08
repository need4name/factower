class FactoryScene extends Phaser.Scene {
  constructor() {
    super({ key: 'FactoryScene' });
  }

  create() {
    const { width, height } = this.scale;

    const slotIndex = localStorage.getItem('factower_active_slot');
    const saveKey = `factower_save_${slotIndex}`;
    this.saveData = JSON.parse(localStorage.getItem(saveKey));

    this.tileSize = 60;
    this.gridCols = 5;
    this.gridRows = 7;
    this.gridOffsetX = (width - this.tileSize * this.gridCols) / 2;
    this.gridOffsetY = 180;

    this.grid = Array.from({ length: this.gridRows }, () =>
      Array(this.gridCols).fill(null)
    );

    this.selectedMachine = null;
    this.selectedColour = null;

    // Background
    this.add.rectangle(width / 2, height / 2, width, height, 0x0a0c0f);

    // Header bar
    this.add.rectangle(width / 2, 70, width, 100, 0x111318);
    this.add.rectangle(width / 2, 120, width, 1, 0x252c38);

    // Back button — large enough to tap
    const backBtn = this.add.rectangle(44, 70, 72, 48, 0x1a1e26)
      .setInteractive();
    this.add.text(44, 70, '← BACK', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#e8a020'
    }).setOrigin(0.5);

    backBtn.on('pointerdown', () => {
      this.cameras.main.fade(200, 0, 0, 0);
      this.time.delayedCall(200, () => {
        this.scene.start('BaseScene');
      });
    });

    // Title
    this.add.text(width / 2 + 20, 58, 'FACTORY FLOOR', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#eef2f8',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(width / 2 + 20, 84, 'PLACE MACHINES · TAP TO BUILD', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#6a7585',
      letterSpacing: 1
    }).setOrigin(0.5);

    // Grid label
    this.add.text(width / 2, 148, 'SELECT A MACHINE BELOW THEN TAP A TILE', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#6a7585',
      letterSpacing: 1
    }).setOrigin(0.5);

    this.drawGrid();
    this.drawMachinePanel();
  }

  drawGrid() {
    for (let row = 0; row < this.gridRows; row++) {
      for (let col = 0; col < this.gridCols; col++) {
        const x = this.gridOffsetX + col * this.tileSize + this.tileSize / 2;
        const y = this.gridOffsetY + row * this.tileSize + this.tileSize / 2;

        const tile = this.add.rectangle(
          x, y,
          this.tileSize - 3,
          this.tileSize - 3,
          0x111318
        ).setInteractive();

        this.add.rectangle(x, y, this.tileSize - 3, this.tileSize - 3)
          .setStrokeStyle(1, 0x1a1e26);

        tile.gridRow = row;
        tile.gridCol = col;

        this.grid[row][col] = { tile, machine: null };

        tile.on('pointerdown', () => this.tilePressed(tile, row, col));
        tile.on('pointerover', () => {
          if (this.grid[row][col].machine === null && this.selectedMachine) {
            tile.setFillStyle(0x1a1e26);
          }
        });
        tile.on('pointerout', () => {
          if (this.grid[row][col].machine === null) {
            tile.setFillStyle(0x111318);
          }
        });
      }
    }
  }

  drawMachinePanel() {
    const { width, height } = this.scale;
    const panelY = height - 148;

    this.add.rectangle(width / 2, height - 74, width, 148, 0x111318);
    this.add.rectangle(width / 2, panelY, width, 1, 0x252c38);

    this.add.text(width / 2, panelY + 14, 'SELECT MACHINE TO PLACE', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#6a7585',
      letterSpacing: 3
    }).setOrigin(0.5);

    const machines = [
      { key: 'depository', label: 'DEPOSITORY', sub: 'STORES MATERIALS', colour: 0x3a8fc4 },
      { key: 'smelter',    label: 'SMELTER',    sub: 'PROCESSES SCRAP',  colour: 0xe8a020 },
      { key: 'assembly',   label: 'ASSEMBLY',   sub: 'BUILDS TOWERS',    colour: 0x5eba7d },
    ];

    machines.forEach((m, i) => {
      const x = 72 + i * 116;
      const y = panelY + 76;

      const btn = this.add.rectangle(x, y, 104, 80, 0x1a1e26)
        .setInteractive();
      btn.machineKey = m.key;
      btn.machineColour = m.colour;

      this.add.rectangle(x, y, 104, 80).setStrokeStyle(1, 0x252c38);

      this.add.circle(x, y - 22, 10, m.colour);

      this.add.text(x, y + 4, m.label, {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#eef2f8',
        fontStyle: 'bold'
      }).setOrigin(0.5);

      this.add.text(x, y + 22, m.sub, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#6a7585'
      }).setOrigin(0.5);

      btn.on('pointerdown', () => this.selectMachine(m.key, m.colour));
      btn.on('pointerover', () => {
        if (this.selectedMachine !== m.key) btn.setFillStyle(0x252c38);
      });
      btn.on('pointerout', () => {
        if (this.selectedMachine !== m.key) btn.setFillStyle(0x1a1e26);
      });
    });
  }

  selectMachine(key, colour) {
    this.selectedMachine = key;
    this.selectedColour = colour;

    this.children.list.forEach(child => {
      if (child.machineKey) {
        child.setFillStyle(
          child.machineKey === key ? 0x2a3040 : 0x1a1e26
        );
      }
    });
  }

  tilePressed(tile, row, col) {
    if (!this.selectedMachine) return;
    if (this.grid[row][col].machine !== null) return;

    const x = this.gridOffsetX + col * this.tileSize + this.tileSize / 2;
    const y = this.gridOffsetY + row * this.tileSize + this.tileSize / 2;

    tile.setFillStyle(this.selectedColour, 0.15);

    this.add.rectangle(x, y, this.tileSize - 3, this.tileSize - 3)
      .setStrokeStyle(2, this.selectedColour);

    this.add.text(x, y, this.selectedMachine.substring(0, 3).toUpperCase(), {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#eef2f8',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.grid[row][col].machine = this.selectedMachine;
  }
}
