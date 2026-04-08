class DockScene extends Phaser.Scene {
  constructor() {
    super({ key: 'DockScene' });
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

    this.add.text(width / 2 + 20, 56, 'DOCK', {
      fontFamily: 'monospace', fontSize: '22px', color: '#eef2f8', fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(width / 2 + 20, 84, 'SELECT CAMPAIGN', {
      fontFamily: 'monospace', fontSize: '11px', color: '#6a7585', letterSpacing: 2
    }).setOrigin(0.5);

    const powerScore = this.saveData?.powerScore || 0;
    this.add.text(width / 2, 148, `YOUR POWER SCORE: ${powerScore}`, {
      fontFamily: 'monospace', fontSize: '12px', color: '#e8a020', letterSpacing: 2
    }).setOrigin(0.5);

    this.add.rectangle(width / 2, 170, width - 48, 1, 0x252c38);

    this.drawStoryline(LEVEL_DATA.storylines[0]);
  }

  drawStoryline(storyline) {
    const { width } = this.scale;
    let y = 196;

    this.add.text(24, y, storyline.name, {
      fontFamily: 'monospace', fontSize: '18px', color: '#eef2f8', fontStyle: 'bold'
    });
    y += 28;

    this.add.text(24, y, storyline.description, {
      fontFamily: 'monospace', fontSize: '11px', color: '#6a7585'
    });
    y += 22;

    this.add.text(24, y, `ENEMY FACTION: ${storyline.faction.toUpperCase()}`, {
      fontFamily: 'monospace', fontSize: '11px', color: '#c43a3a', letterSpacing: 1
    });
    y += 28;

    this.add.rectangle(width / 2, y, width - 48, 1, 0x252c38);
    y += 16;

    const completedLevels = this.saveData?.completedLevels?.storyline1 || [];

    storyline.levels.forEach((level, i) => {
      const isCompleted = completedLevels.includes(level.id);
      const isUnlocked = i === 0 || completedLevels.includes(storyline.levels[i - 1].id);
      this.drawLevel(level, y, isUnlocked, isCompleted);
      y += 106;
    });
  }

  drawLevel(level, y, isUnlocked, isCompleted) {
    const { width } = this.scale;
    const colour = isCompleted ? 0x5eba7d : isUnlocked ? 0xe8a020 : 0x252c38;
    const textColour = isCompleted ? '#5eba7d' : isUnlocked ? '#eef2f8' : '#252c38';

    const bg = this.add.rectangle(width / 2, y + 42, width - 48, 94, 0x111318);
    this.add.rectangle(width / 2, y + 42, width - 48, 94).setStrokeStyle(1, colour);

    this.add.rectangle(28, y + 42, 6, 74, colour);

    this.add.text(52, y + 14, `LEVEL ${level.id}`, {
      fontFamily: 'monospace', fontSize: '10px', color: '#6a7585', letterSpacing: 3
    });

    this.add.text(52, y + 32, level.name, {
      fontFamily: 'monospace', fontSize: '16px', color: textColour, fontStyle: 'bold'
    });

    this.add.text(52, y + 56, level.description, {
      fontFamily: 'monospace', fontSize: '10px', color: '#6a7585',
      wordWrap: { width: 240 }
    });

    // Difficulty dots
    for (let d = 0; d < 5; d++) {
      this.add.circle(
        width - 60 + d * 12, y + 22,
        5,
        d < level.difficulty ? colour : 0x252c38
      );
    }

    // Waves count
    this.add.text(width - 36, y + 50, `${level.waves.length}W`, {
      fontFamily: 'monospace', fontSize: '12px', color: '#6a7585'
    }).setOrigin(0.5);

    if (isCompleted) {
      this.add.text(width - 36, y + 72, '✓', {
        fontFamily: 'monospace', fontSize: '16px', color: '#5eba7d'
      }).setOrigin(0.5);
    }

    if (isUnlocked) {
      bg.setInteractive();
      bg.on('pointerdown', () => this.startLevel(level));
      bg.on('pointerover', () => bg.setFillStyle(0x1a1e26));
      bg.on('pointerout', () => bg.setFillStyle(0x111318));
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
