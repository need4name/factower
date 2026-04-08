class ArmouryScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ArmouryScene' });
  }

  create() {
    const { width, height } = this.scale;

    const slotIndex = localStorage.getItem('factower_active_slot');
    const saveKey = `factower_save_${slotIndex}`;
    this.saveData = JSON.parse(localStorage.getItem(saveKey));

    this.add.rectangle(width / 2, height / 2, width, height, 0x0d1117);

    this.add.rectangle(width / 2, 70, width, 100, 0x161b22);
    this.add.rectangle(width / 2, 120, width, 1, 0x334455);

    const backBtn = this.add.rectangle(44, 70, 72, 48, 0x1e2530).setInteractive();
    this.add.text(44, 70, '← BACK', {
      fontFamily: 'monospace', fontSize: '14px', color: '#e8a020'
    }).setOrigin(0.5);
    backBtn.on('pointerdown', () => {
      this.cameras.main.fade(200, 0, 0, 0);
      this.time.delayedCall(200, () => this.scene.start('BaseScene'));
    });
    backBtn.on('pointerover', () => backBtn.setFillStyle(0x252c38));
    backBtn.on('pointerout', () => backBtn.setFillStyle(0x1e2530));

    this.add.text(width / 2 + 20, 56, 'ARMOURY', {
      fontFamily: 'monospace', fontSize: '22px', color: '#eef2f8', fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(width / 2 + 20, 84, 'TOWER STOCKPILE', {
      fontFamily: 'monospace', fontSize: '12px', color: '#8899aa', letterSpacing: 2
    }).setOrigin(0.5);

    this.add.text(24, 144, 'AVAILABLE TOWERS', {
      fontFamily: 'monospace', fontSize: '12px', color: '#8899aa', letterSpacing: 3
    });
    this.add.rectangle(width / 2, 164, width - 48, 1, 0x334455);

    const stockpile = this.saveData?.stockpile || {};
    const towerTypes = ['gunner', 'bomber', 'barricade'];

    towerTypes.forEach((type, i) => {
      const count = stockpile[type] || 0;
      const data = TOWER_DATA[type];
      const y = 240 + i * 130;
      const colourHex = '#' + data.colour.toString(16).padStart(6, '0');
      const active = count > 0;

      this.add.rectangle(width / 2, y, width - 48, 110, 0x161b22);
      this.add.rectangle(width / 2, y, width - 48, 110)
        .setStrokeStyle(1, active ? data.colour : 0x334455);

      this.add.rectangle(28, y, 6, 86, active ? data.colour : 0x334455);

      this.add.text(52, y - 28, data.name, {
        fontFamily: 'monospace', fontSize: '20px',
        color: active ? '#eef2f8' : '#556677', fontStyle: 'bold'
      });

      this.add.text(52, y + 4, `TIER ${data.tier}`, {
        fontFamily: 'monospace', fontSize: '12px',
        color: active ? '#8899aa' : '#334455'
      });

      this.add.text(52, y + 24, `DMG ${data.damage}  ·  RNG ${data.range}`, {
        fontFamily: 'monospace', fontSize: '12px',
        color: active ? '#8899aa' : '#334455'
      });

      this.add.text(width - 36, y - 8, `${count}`, {
        fontFamily: 'monospace', fontSize: '36px',
        color: active ? colourHex : '#334455', fontStyle: 'bold'
      }).setOrigin(1, 0.5);

      this.add.text(width - 36, y + 28, 'IN STOCK', {
        fontFamily: 'monospace', fontSize: '10px',
        color: active ? '#8899aa' : '#334455', letterSpacing: 2
      }).setOrigin(1, 0.5);
    });

    const totalTowers = towerTypes.reduce((sum, t) => sum + (stockpile[t] || 0), 0);
    if (totalTowers === 0) {
      this.add.text(width / 2, 620, 'NO TOWERS IN STOCK', {
        fontFamily: 'monospace', fontSize: '16px', color: '#445566', letterSpacing: 3
      }).setOrigin(0.5);
      this.add.text(width / 2, 652, 'BUILD TOWERS IN THE FACTORY FIRST', {
        fontFamily: 'monospace', fontSize: '12px', color: '#334455', letterSpacing: 1
      }).setOrigin(0.5);
    }

    const dockBtn = this.add.rectangle(width / 2, height - 80, width - 48, 72, 0x1a2210)
      .setInteractive();
    this.add.rectangle(width / 2, height - 80, width - 48, 72)
      .setStrokeStyle(1, 0x5eba7d);
    this.add.text(width / 2, height - 80, 'GO TO DOCK  →', {
      fontFamily: 'monospace', fontSize: '18px', color: '#5eba7d', fontStyle: 'bold'
    }).setOrigin(0.5);

    dockBtn.on('pointerdown', () => {
      this.cameras.main.fade(200, 0, 0, 0);
      this.time.delayedCall(200, () => this.scene.start('DockScene'));
    });
    dockBtn.on('pointerover', () => dockBtn.setFillStyle(0x223318));
    dockBtn.on('pointerout', () => dockBtn.setFillStyle(0x1a2210));
  }
}
