class BaseScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BaseScene' });
  }

  create() {
    const { width, height } = this.scale;

    const slotIndex = localStorage.getItem('factower_active_slot');
    const saveKey = `factower_save_${slotIndex}`;
    this.saveData = JSON.parse(localStorage.getItem(saveKey));

    this.add.rectangle(width / 2, height / 2, width, height, 0x0a0c0f);

    for (let i = 0; i < 20; i++) {
      this.add.rectangle(width / 2, 100 + i * 40, width, 1, 0x111318);
    }

    this.add.rectangle(width / 2, 70, width, 80, 0x111318);
    this.add.rectangle(width / 2, 110, width, 1, 0x252c38);

    this.add.text(24, 40, 'THE PIRATE KING', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#6a7585',
      letterSpacing: 3
    });

    this.add.text(24, 60, 'YOUR ISLAND', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#eef2f8',
      fontStyle: 'bold'
    });

    const powerScore = this.saveData?.powerScore || 0;

    this.add.text(width - 24, 40, 'POWER', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#6a7585',
      letterSpacing: 3
    }).setOrigin(1, 0);

    this.add.text(width - 24, 58, `${powerScore}`, {
      fontFamily: 'monospace',
      fontSize: '22px',
      color: '#e8a020',
      fontStyle: 'bold'
    }).setOrigin(1, 0);

    this.add.rectangle(width / 2, 120, width, 1, 0x252c38);

    this.add.text(width / 2, 142, 'SELECT ZONE', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#6a7585',
      letterSpacing: 5
    }).setOrigin(0.5);

    this.createZone(0, 'FACTORY FLOOR', 'PRODUCE TOWERS', '#3a8fc4', true, 240);
    this.createZone(1, 'ARMOURY', 'MANAGE STOCKPILE', '#5eba7d', true, 360);
    this.createZone(2, 'DOCK', 'LAUNCH MISSIONS', '#e8a020', true, 480);
    this.createZone(3, 'MARKETPLACE', 'LOCKED', '#252c38', false, 580);
    this.createZone(4, 'WORKER HOUSING', 'LOCKED', '#252c38', false, 650);
    this.createZone(5, 'POWER', 'LOCKED', '#252c38', false, 720);
  }

  createZone(index, title, subtitle, colour, unlocked, y) {
    const { width } = this.scale;
    const zoneHeight = unlocked ? 100 : 60;
    const zoneWidth = width - 48;

    const bg = this.add.rectangle(width / 2, y, zoneWidth, zoneHeight, 0x111318);

    if (unlocked) {
      bg.setInteractive({ useHandCursor: true });

      this.add.rectangle(width / 2, y, zoneWidth, zoneHeight)
        .setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(colour).color);

      this.add.rectangle(
        24 + 3, y, 6, zoneHeight - 16,
        Phaser.Display.Color.HexStringToColor(colour).color
      );

      this.add.text(48, y - 18, title, {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#eef2f8',
        fontStyle: 'bold'
      });

      this.add.text(48, y + 8, subtitle, {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#6a7585',
        letterSpacing: 2
      });

      this.add.text(width - 36, y - 6, '→', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: colour
      }).setOrigin(0.5);

      bg.on('pointerdown', () => this.enterZone(index));
      bg.on('pointerover', () => bg.setFillStyle(0x1a1e26));
      bg.on('pointerout', () => bg.setFillStyle(0x111318));

    } else {
      this.add.rectangle(width / 2, y, zoneWidth, zoneHeight)
        .setStrokeStyle(1, 0x1a1e26);

      this.add.text(width / 2, y - 8, title, {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#252c38',
        fontStyle: 'bold'
      }).setOrigin(0.5);

      this.add.text(width / 2, y + 10, 'UNLOCK VIA STORY', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#1a1e26',
        letterSpacing: 2
      }).setOrigin(0.5);
    }
  }

  enterZone(index) {
    this.cameras.main.flash(150, 0, 0, 0);
    this.time.delayedCall(150, () => {
      switch(index) {
  case 0:
    this.scene.start('FactoryScene');
    break;
  ccase 1:
  this.scene.start('ArmouryScene');
  break;
case 2:
  this.scene.start('DockScene');
  break;
}
      }
    });
  }
}
