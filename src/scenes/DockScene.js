class DockScene extends Phaser.Scene {
  constructor() {
    super({ key: 'DockScene' });
  }

  create() {
    const { width, height } = this.scale;

    const slotIndex = localStorage.getItem('factower_active_slot');
    const saveKey = `factower_save_${slotIndex}`;
    this.saveData = JSON.parse(localStorage.getItem(saveKey));

    this.add.rectangle(width / 2, height / 2, width, height, 0x0d1117);

    this.add.rectangle(width / 2, 144, width, 100, 0x161b22);
    this.add.rectangle(width / 2, 194, width, 1, 0x334455);

    const backBtn = this.add.rectangle(44, 144, 72, 48, 0x1e2530).setInteractive();
    this.add.text(44, 144, '← BACK', {
      fontFamily: 'monospace', fontSize: '14px', color: '#e8a020'
    }).setOrigin(0.5);
    backBtn.on('pointerdown', () => {
      this.cameras.main.fade(200, 0, 0, 0);
      this.time.delayedCall(200, () => this.scene.start('BaseScene'));
    });
    backBtn.on('pointerover', () => backBtn.setFillStyle(0x252c38));
    backBtn.on('pointerout', () => backBtn.setFillStyle(0x1e2530));

    this.add.text(width / 2 + 20, 130, 'DOCK', {
      fontFamily: 'monospace', fontSize: '22px', color: '#eef2f8', fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(width / 2 + 20, 158, 'SELECT CAMPAIGN', {
      fontFamily: 'monospace', fontSize: '12px', color: '#8899aa', letterSpacing: 2
    }).setOrigin(0.5);

    const powerScore = this.saveData?.powerScore || 0;
    this.add.text(width / 2, 218, `YOUR POWER SCORE: ${powerScore}`, {
      fontFamily: 'monospace', fontSize: '13px', color: '#e8a020', letterSpacing: 2
    }).setOrigin(0.5);

    this.add.rectangle(width / 2, 240, width - 48, 1, 0x334455);

    this.drawStoryline(LEVEL_DATA.storylines[0]);
  }

  drawStoryline(storyline) {
    const { width } = this.scale;
    let y = 266;

    this.add.text(24, y, storyline.name, {
      fontFamily: 'monospace', fontSize: '20px', color: '#eef2f8', fontStyle: 'bold'
    });
    y += 30;

    this.add.text(24, y, storyline.description, {
      fontFamily: 'monospace', fontSize: '12px', color: '#8899aa'
    });
    y += 24;

    this.add.text(24, y, `ENEMY: ${storyline.faction.toUpperCase()}`, {
      fontFamily: 'monospace', fontSize: '12px', color: '#c43a3a', letterSpacing: 1
    });
    y += 30;

    this.add.rectangle(width / 2, y, width - 48, 1, 0x334455);
    y += 16;

    const completedLevels = this.saveData?.completedLevels?.storyline1 || [];

    storyline.levels.forEach((level, i) => {
      const isCompleted = completedLevels.includes(level.id);
      const isUnlocked = i === 0 || completedLevels.includes(storyline.levels[i - 1].id);
      this.drawLevel(level, y, isUnlocked, isCompleted);
      y += 110;
    });
  }

  drawLevel(level, y, isUnlocked, isCompleted) {
    const { width } = this.scale;
    const colour = isCompleted ? 0x5eba7d : isUnlocked ? 0xe8a020 : 0x334455;
    const textColour = isCompleted ? '#5eba7d' : isUnlocked ? '#eef2f8' : '#445566';

    const bg = this.add.rectangle(width / 2, y + 44, width - 48, 98, 0x161b22);
    this.add.rectangle(width / 2, y + 44, width - 48, 98).setStrokeStyle(1, colour);
    this.add.rectangle(28, y + 44, 6, 78, colour);

    this.add.text(52, y + 14, `LEVEL ${level.id}`, {
      fontFamily: 'monospace', fontSize: '10px', color: '#8899aa', letterSpacing: 3
    });

    this.add.text(52, y + 32, level.name, {
      fontFamily: 'monospace', fontSize: '18px', color: textColour, fontStyle: 'bold'
    });

    this.add.text(52, y + 58, level.description, {
      fontFamily: 'monospace', fontSize: '11px', color: '#8899aa',
      wordWrap: { width: 240 }
    });

    for (let d = 0; d < 5; d++) {
      this.add.circle(
        width - 60 + d * 13, y + 26, 5,
        d < level.difficulty ? colour : 0x2a3a4a
      );
    }

    this.add.text(width - 36, y + 56, `${level.waves.length} WAVES`, {
      fontFamily: 'monospace', fontSize: '11px', color: '#8899aa'
    }).setOrigin(0.5);

    if (isCompleted) {
      this.add.text(width - 36, y + 78, '✓ DONE', {
        fontFamily: 'monospace', fontSize: '11px', color: '#5eba7d'
      }).setOrigin(0.5);
    }

    if (isUnlocked) {
      bg.setInteractive();
      bg.on('pointerdown', () => this.startLevel(level));
      bg.on('pointerover', () => bg.setFillStyle(0x1e2530));
      bg.on('pointerout', () => bg.setFillStyle(0x161b22));
    }
  }

  startLevel(level) {
    this.cameras.main.flash(200, 232, 160, 32);
    this.time.delayedCall(250, () => {
      this.scene.start('CombatScene', {
        storylineId: 1,
        levelId: level.id,
        levelData: level
      });
    });
  }
}
