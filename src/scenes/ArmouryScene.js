class ArmouryScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ArmouryScene' });
  }

  create() {
    const { width, height } = this.scale;

    const slotIndex = localStorage.getItem('factower_active_slot');
    const saveKey = `factower_save_${slotIndex}`;
    this.saveData = JSON.parse(localStorage.getItem(saveKey));

    this.add.rectangle(width / 2, height / 2, width, height, 0x0a0c0f);

    // Header
    this.add.rectangle(width / 2, 70, width, 100, 0x111318);
    this.add.rectangle(width / 2, 120, width, 1, 0x252c38);

    const backBtn = this.add.rectangle(44, 70, 72, 48, 0x1a1e26).setInteractive();
    this.add.text(44, 70, '← BACK', {
      fontFamily: 'monospace', fontSize: '14px', color: '#e8a020'
    }).setOrigin(0.5);
    backBtn.on('pointerdown', () => {
      this.cameras.main.fade(200, 0, 0, 0);
      this.time.delayedCall(200, () => this.scene.start('BaseScene'));
    });

    this.add.text(width / 2 + 20, 56, 'ARMOURY', {
      fontFamily: 'monospace', fontSize: '22px', color: '#eef2f8', fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(width / 2 + 20, 84, 'TOWER STOCKPILE', {
      fontFamily: 'monospace', fontSize: '11px', color: '#6a7585', letterSpacing: 2
    }).setOrigin(0.5);

    this.add.text(24, 144, 'AVAILABLE TOWERS', {
      fontFamily: 'monospace', fontSize: '11px', color: '#6a7585', letterSpacing: 3
    });
    this.add.rectangle(width / 2, 162, width - 48, 1, 0x252c38);

    const stockpile = this.saveData?.stockpile || {};
    const towerTypes = ['gunner', 'bomber', 'barricade'];

    towerTypes.forEach((type, i) => {
      const count = stockpile[type] || 0;
      const data = TOWER_DATA[type];
      const y = 230 + i * 120;

      this.add.rectangle(width / 2, y, width - 48, 100, 0x111318);
      this.add.rectangle(width / 2, y, width - 48, 100)
        .setStrokeStyle(1, count > 0 ? data.colour : 0x252c38);

      this.add.rectangle(28, y, 6, 80, count > 0 ? data.colour : 0x252c38);

      this.add.text(52, y - 24, data.name, {
        fontFamily: 'monospace', fontSize: '18px',
        color: count > 0 ? '#eef2f8' : '#252c38', fontStyle: 'bold'
      });

      this.add.text(52, y + 4, `TIER ${data.tier}  ·  DMG ${data.damage}  ·  RNG ${data.range}`, {
        fontFamily: 'monospace', fontSize: '11px', color: count > 0 ? '#6a7585' : '#1a1e26'
      });

      const colourHex = '#' + data.colour.toString(16).padStart(6, '0');
      this.add.text(width - 36, y - 8, `${count}`, {
        fontFamily: 'monospace', fontSize: '32px',
        color: count > 0 ? colourHex : '#252c38', fontStyle: 'bold'
      }).setOrigin(1, 0.5);

      this.add.text(width - 36, y + 22, 'IN STOCK', {
        fontFamily: 'monospace', fontSize: '10px', color: '#6a7585', letterSpacing: 2
      }).setOrigin(1, 0.5);
    });

    const totalTowers = towerTypes.reduce((sum, t) => sum + (stockpile[t] || 0), 0);
    if (totalTowers === 0) {
      this.add.text(width / 2, 590, 'NO TOWERS IN STOCK', {
        fontFamily: 'monospace', fontSize: '14px', color: '#252c38', letterSpacing: 3
      }).setOrigin(0.5);
      this.add.text(width / 2, 620, 'BUILD TOWERS IN THE FACTORY FIRST', {
        fontFamily: 'monospace', fontSize: '11px', color: '#1a1e26', letterSpacing: 1
      }).setOrigin(0.5);
    }

    // Go to dock
    const dockBtn = this.add.rectangle(width / 2, height - 80, width - 48, 72, 0x1a1e26)
      .setInteractive();
    this.add.rectangle(width / 2, height - 80, width - 48, 72)
      .setStrokeStyle(1, 0xe8a020);
    this.add.text(width / 2, height - 80, 'GO TO DOCK  →', {
      fontFamily: 'monospace', fontSize: '16px', color: '#e8a020', fontStyle: 'bold'
    }).setOrigin(0.5);

    dockBtn.on('pointerdown', () => {
      this.cameras.main.fade(200, 0, 0, 0);
      this.time.delayedCall(200, () => this.scene.start('DockScene'));
    });
    dockBtn.on('pointerover', () => dockBtn.setFillStyle(0x252c38));
    dockBtn.on('pointerout', () => dockBtn.setFillStyle(0x1a1e26));
  }
}
