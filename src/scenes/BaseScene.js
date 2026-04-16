class BaseScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BaseScene' });
  }

  create() {
    const { width, height } = this.scale;
    const TOP = 55;

    const slotIndex = localStorage.getItem('factower_active_slot');
    const saveKey   = 'factower_save_' + slotIndex;
    this.saveData   = JSON.parse(localStorage.getItem(saveKey));

    this.add.rectangle(width / 2, height / 2, width, height, 0x0d1117);

    // Header Background
    this.add.rectangle(width / 2, TOP + 50, width, 100, 0x161b22);
    this.add.rectangle(width / 2, TOP + 100, width, 1, 0x334455);

    // Identity
    this.add.text(24, TOP + 18, 'THE PIRATE KING', {
      fontFamily: 'monospace', fontSize: '11px', color: '#8899aa', letterSpacing: 3
    });
    this.add.text(24, TOP + 38, 'YOUR ISLAND', {
      fontFamily: 'monospace', fontSize: '22px', color: '#eef2f8', fontStyle: 'bold'
    });

    // --- NEW CURRENCY DISPLAY ---
    const nuts = this.saveData.nuts || 0;
    const bolts = this.saveData.bolts || 0;
    this.add.text(width / 2 + 10, TOP + 46, `${nuts} NUTS  /  ${bolts} BOLTS`, {
      fontFamily: 'monospace', fontSize: '10px', color: '#8899aa', letterSpacing: 1
    }).setOrigin(0.5);
    // ----------------------------

    // Power Score
    const powerScore = (this.saveData && this.saveData.powerScore) ? this.saveData.powerScore : 0;
    this.add.text(width - 24, TOP + 18, 'POWER', {
      fontFamily: 'monospace', fontSize: '11px', color: '#8899aa', letterSpacing: 3
    }).setOrigin(1, 0);
    this.add.text(width - 24, TOP + 36, '' + powerScore, {
      fontFamily: 'monospace', fontSize: '24px', color: '#e8a020', fontStyle: 'bold'
    }).setOrigin(1, 0);

    this.add.text(width / 2, TOP + 122, 'SELECT ZONE', {
      fontFamily: 'monospace', fontSize: '11px', color: '#8899aa', letterSpacing: 5
    }).setOrigin(0.5);

    this.createZone(0, 'FACTORY FLOOR', 'PRODUCE TOWERS',   '#3a8fc4', true,  TOP + 220);
    this.createZone(1, 'ARMOURY',       'MANAGE STOCKPILE', '#5eba7d', true,  TOP + 340);
    this.createZone(2, 'DOCK',          'LAUNCH MISSIONS',  '#e8a020', true,  TOP + 460);
    this.createZone(3, 'MARKETPLACE',   'UNLOCK VIA STORY', '#445566', false, TOP + 560);
    this.createZone(4, 'WORKER HOUSING','UNLOCK VIA STORY', '#445566', false, TOP + 630);
    this.createZone(5, 'POWER',         'UNLOCK VIA STORY', '#445566', false, TOP + 700);
  }

  createZone(index, title, subtitle, colour, unlocked, y) {
    const { width } = this.scale;
    const zoneH = unlocked ? 100 : 60;
    const col   = Phaser.Display.Color.HexStringToColor(colour).color;

    const bg = this.add.rectangle(width / 2, y, width - 48, zoneH, 0x161b22);
    this.add.rectangle(width / 2, y, width - 48, zoneH).setStrokeStyle(1, unlocked ? col : 0x222d3a);

    if (unlocked) {
      bg.setInteractive();
      this.add.rectangle(28, y, 6, zoneH - 16, col);
      this.add.text(50, y - 18, title,    { fontFamily: 'monospace', fontSize: '18px', color: '#eef2f8', fontStyle: 'bold' });
      this.add.text(50, y + 10, subtitle, { fontFamily: 'monospace', fontSize: '12px', color: '#8899aa', letterSpacing: 2 });
      this.add.text(width - 32, y, '→',  { fontFamily: 'monospace', fontSize: '20px', color: colour }).setOrigin(0.5);
      bg.on('pointerdown', () => this.enterZone(index));
      bg.on('pointerover', () => bg.setFillStyle(0x1e2530));
      bg.on('pointerout',  () => bg.setFillStyle(0x161b22));
    } else {
      this.add.text(width / 2, y - 8,  title,            { fontFamily: 'monospace', fontSize: '13px', color: '#445566', fontStyle: 'bold' }).setOrigin(0.5);
      this.add.text(width / 2, y + 10, 'UNLOCK VIA STORY', { fontFamily: 'monospace', fontSize: '10px', color: '#2a3a4a', letterSpacing: 2 }).setOrigin(0.5);
    }
  }

  enterZone(index) {
    this.cameras.main.flash(150, 0, 0, 0);
    this.time.delayedCall(150, () => {
      if      (index === 0) this.scene.start('FactoryScene');
      else if (index === 1) this.scene.start('ArmouryScene');
      else if (index === 2) this.scene.start('DockScene');
    });
  }
}
