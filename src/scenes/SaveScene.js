class SaveScene extends Phaser.Scene {
  constructor() {
    super({ key: 'SaveScene' });
  }

  create() {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x0d1117);

    this.add.text(width / 2, 60, 'FACTOWER', {
      fontFamily: 'monospace',
      fontSize: '36px',
      color: '#e8a020',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(width / 2, 98, 'SELECT SAVE SLOT', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#8899aa',
      letterSpacing: 4
    }).setOrigin(0.5);

    this.add.rectangle(width / 2, 118, width - 48, 1, 0x334455);

    this.createSlot(0, width / 2, 230, width);
    this.createSlot(1, width / 2, 420, width);
    this.createSlot(2, width / 2, 610, width);

    this.add.text(width / 2, height - 40, 'v0.1 — MVP', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#334455'
    }).setOrigin(0.5);
  }

  createSlot(index, x, y, width) {
    const saveKey = `factower_save_${index}`;
    const saveData = localStorage.getItem(saveKey);
    const isEmpty = saveData === null;

    const bg = this.add.rectangle(x, y, width - 48, 150, 0x161b22)
      .setInteractive();

    this.add.rectangle(x, y, width - 48, 150)
      .setStrokeStyle(1, isEmpty ? 0x334455 : 0xe8a020);

    this.add.text(x - (width - 48) / 2 + 20, y - 58, `SLOT ${index + 1}`, {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#556677',
      letterSpacing: 4
    });

    if (isEmpty) {
      this.add.text(x, y - 10, 'NEW GAME', {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#ccd6e0',
        fontStyle: 'bold'
      }).setOrigin(0.5);

      this.add.text(x, y + 24, 'NO DATA', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#334455',
        letterSpacing: 3
      }).setOrigin(0.5);

    } else {
      const data = JSON.parse(saveData);

      this.add.text(x, y - 28, data.playerName || 'THE PIRATE KING', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#e8a020',
        fontStyle: 'bold'
      }).setOrigin(0.5);

      this.add.text(x, y + 4, `STORYLINE ${data.storyline || 1}  ·  LEVEL ${data.level || 1}`, {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#8899aa',
        letterSpacing: 2
      }).setOrigin(0.5);

      this.add.text(x, y + 28, `POWER SCORE: ${data.powerScore || 0}`, {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#3a8fc4',
        letterSpacing: 2
      }).setOrigin(0.5);

      const delBtn = this.add.rectangle(x + (width - 48) / 2 - 36, y - 54, 56, 28, 0x2a1a1a)
        .setInteractive();
      this.add.rectangle(x + (width - 48) / 2 - 36, y - 54, 56, 28)
        .setStrokeStyle(1, 0x552222);
      this.add.text(x + (width - 48) / 2 - 36, y - 54, 'DELETE', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#aa4444',
        letterSpacing: 1
      }).setOrigin(0.5);

      delBtn.on('pointerdown', () => this.deleteSlot(index));
      delBtn.on('pointerover', () => delBtn.setFillStyle(0x3a1a1a));
      delBtn.on('pointerout', () => delBtn.setFillStyle(0x2a1a1a));
    }

    bg.on('pointerdown', () => this.selectSlot(index, isEmpty));
    bg.on('pointerover', () => bg.setFillStyle(0x1e2530));
    bg.on('pointerout', () => bg.setFillStyle(0x161b22));
  }

  deleteSlot(index) {
    localStorage.removeItem(`factower_save_${index}`);
    this.cameras.main.fade(200, 0, 0, 0);
    this.time.delayedCall(200, () => this.scene.restart());
  }

  selectSlot(index, isEmpty) {
    const saveKey = `factower_save_${index}`;

    if (isEmpty) {
      const newSave = {
        slot: index,
        playerName: 'THE PIRATE KING',
        storyline: 1,
        level: 1,
        powerScore: 0,
        materials: {
          plasticScrap: 0,
          refinedPlastic: 0,
          salvagedMetal: 0
        },
        stockpile: {
          gunner: 0,
          bomber: 0,
          barricade: 0
        },
        nuts: 0,
        bolts: 0,
        parts: 0,
        completedLevels: {},
        createdAt: Date.now()
      };
      localStorage.setItem(saveKey, JSON.stringify(newSave));
    }

    localStorage.setItem('factower_active_slot', index);
    this.cameras.main.flash(200, 232, 160, 32);
    this.time.delayedCall(250, () => {
      this.scene.start('BaseScene');
    });
  }
}
