class BaseScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BaseScene' });
  }

  create() {
    const { width, height } = this.scale;

    const slotIndex = localStorage.getItem('factower_active_slot');
    const saveKey = `factower_save_${slotIndex}`;
    this.saveData = JSON.parse(localStorage.getItem(saveKey));

    this.add.rectangle(width / 2, height / 2, width, height, 0x0d1117);

    this.add.rectangle(width / 2, 70, width, 100, 0x161b22);
    this.add.rectangle(width / 2, 120, width, 1, 0x334455);

    this.add.text(24, 38, 'THE PIRATE KING', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#8899aa',
      letterSpacing: 3
    });

    this.add.text(24, 58, 'YOUR ISLAND', {
      fontFamily: 'monospace',
      fontSize: '22px',
      color: '#eef2f8',
      fontStyle: 'bold'
    });

    const powerScore = this.saveData?.powerScore || 0;

    this.add.text(width - 24, 38, 'POWER', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#8899aa',
      letterSpacing: 3
    }).setOrigin(1, 0);

    this.add.text(width - 24, 56, `${powerScore}`, {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#e8a020',
      fontStyle: 'bold'
    }).setOrigin(1, 0);

    this.add.text(width / 2, 142, 'SELECT ZONE', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#8899aa',
      letterSpacing: 5
    }).setOrigin(0.5);

    this.createZone(0, 'FACTORY FLOOR', 'PRODUCE TOWERS', '#3a8fc4', true, 240);
    this.createZone(1, 'ARMOURY', 'MANAGE STOCKPILE', '#5eba7d', true, 360);
    this.createZone(2, 'DOCK', 'LAUNCH MISSIONS', '#e8a020', true, 480);
    this.createZone(3, 'MARKETPLACE', 'LOCKED', '#445566', false, 580);
    this.createZone(4, 'WORKER HOUSING', 'LOCKED', '#445566', false, 650);
    this.createZone(5, 'POWER', 'LOCKED', '#445566', false, 720);
  }

  createZone(index, title, subtitle, colour, unlocked, y) {
    const { width } = this.scale;
    const zoneHeight = unlocked ? 100 : 60;
    const zoneWidth = width - 48;

    const bg = this.add.rectangle(width / 2, y, zoneWidth, zoneHeight, 0x161b22);

    if (unlocked) {
      bg.setInteractive();

      this.add.rectangle(width / 2, y, zoneWidth, zoneHeight)
        .setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(colour).color);

      this.add.rectangle(
        28, y, 6, zoneHeight - 16,
        Phaser.Display.Color.HexStringToColor(colour).color
      );

      this.add.text(50, y - 18, title, {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#eef2f8',
        fontStyle: 'bold'
      });

      this.add.text(50, y + 10, subtitle, {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#8899aa',
        letterSpacing: 2
      });

      this.add.text(width - 32, y, '→', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: colour
      }).setOrigin(0.5);

      bg.on('pointerdown', () => this.enterZone(index));
      bg.on('pointerover', () => bg.setFillStyle(0x1e2530));
      bg.on('pointerout', () => bg.setFillStyle(0x161b22));

    } else {
      this.add.rectangle(width / 2, y, zoneWidth, zoneHeight)
        .setStrokeStyle(1, 0x222d3a);

      this.add.text(width / 2, y - 8, title, {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#445566',
        fontStyle: 'bold'
      }).setOrigin(0.5);

      this.add.text(width / 2, y + 10, 'UNLOCK VIA STORY', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#2a3a4a',
        letterSpacing: 2
      }).setOrigin(0.5);
    }
  }

  enterZone(index) {
    this.cameras.main.flash(150, 0, 0, 0);
    this.time.delayedCall(150, () => {
      switch (index) {
        case 0:
          this.scene.start('FactoryScene');
          break;
        case 1:
          this.scene.start('ArmouryScene');
          break;
        case 2:
          this.scene.start('DockScene');
          break;
      }
    });
  }
}
