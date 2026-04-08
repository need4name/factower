class SaveScene extends Phaser.Scene {
  constructor() {
    super({ key: 'SaveScene' });
  }

  create() {
    const { width, height } = this.scale;

    // Background
    this.add.rectangle(width / 2, height / 2, width, height, 0x0a0c0f);

    // Title
    this.add.text(width / 2, 80, 'SELECT SAVE', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#6a7585',
      letterSpacing: 6
    }).setOrigin(0.5);

    this.add.text(width / 2, 110, 'FACTOWER', {
      fontFamily: 'monospace',
      fontSize: '32px',
      color: '#e8a020',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Divider
    this.add.rectangle(width / 2, 145, width - 48, 1, 0x252c38);

    // Draw the three save slots
    const slots = [0, 1, 2];
    const slotStartY = 220;
    const slotSpacing = 180;

    slots.forEach((i) => {
      this.createSlot(i, width / 2, slotStartY + i * slotSpacing, width);
    });

    // Version tag
    this.add.text(width / 2, height - 40, 'v0.1 — MVP', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#252c38'
    }).setOrigin(0.5);
  }

  createSlot(index, x, y, width) {
    const saveKey = `factower_save_${index}`;
    const saveData = localStorage.getItem(saveKey);
    const isEmpty = saveData === null;

    // Slot background
    const bg = this.add.rectangle(x, y, width - 48, 140, 0x111318)
      .setInteractive({ useHandCursor: true });

    // Slot border
    this.add.rectangle(x, y, width - 48, 140)
      .setStrokeStyle(1, isEmpty ? 0x252c38 : 0xe8a020);

    // Slot number
    this.add.text(x - (width - 48) / 2 + 20, y - 50, `SLOT ${index + 1}`, {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#6a7585',
      letterSpacing: 4
    });

    if (isEmpty) {
      // Empty slot
      this.add.text(x, y - 8, 'NEW GAME', {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#c8d0dc',
        fontStyle: 'bold'
      }).setOrigin(0.5);

      this.add.text(x, y + 24, 'NO DATA', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#252c38',
        letterSpacing: 3
      }).setOrigin(0.5);

    } else {
      // Saved game — parse and display data
      const data = JSON.parse(saveData);

      this.add.text(x, y - 16, data.playerName || 'THE PIRATE KING', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#e8a020',
        fontStyle: 'bold'
      }).setOrigin(0.5);

      this.add.text(x, y + 14, `STORYLINE ${data.storyline || 1}  ·  LEVEL ${data.level || 1}`, {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#6a7585',
        letterSpacing: 2
      }).setOrigin(0.5);

      this.add.text(x, y + 38, `POWER SCORE: ${data.powerScore || 0}`, {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#3a8fc4',
        letterSpacing: 2
      }).setOrigin(0.5);
    }

    // Tap handler
    bg.on('pointerdown', () => {
      this.selectSlot(index, isEmpty);
    });

    // Press feedback
    bg.on('pointerover', () => {
      bg.setFillStyle(0x1a1e26);
    });
    bg.on('pointerout', () => {
      bg.setFillStyle(0x111318);
    });
  }

  selectSlot(index, isEmpty) {
    const saveKey = `factower_save_${index}`;

    if (isEmpty) {
      // Create new save
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
    gunner: 3,
    bomber: 2,
    barricade: 2
  },
  nuts: 0,
  bolts: 0,
  parts: 0,
  completedLevels: {},
  createdAt: Date.now()
};
      localStorage.setItem(saveKey, JSON.stringify(newSave));
    }

    // Store active slot and move to base scene
    localStorage.setItem('factower_active_slot', index);

    // Flash feedback then transition
    this.cameras.main.flash(200, 232, 160, 32);
    this.time.delayedCall(250, () => {
      // Placeholder — will go to BaseScene once built
      this.scene.start('BaseScene');
    });
  }
}
