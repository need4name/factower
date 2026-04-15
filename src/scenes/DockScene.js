class DockScene extends Phaser.Scene {
  constructor() {
    super({ key: 'DockScene' });
  }

  create() {
    const { width, height } = this.scale;
    const TOP = 55;

    const slotIndex = localStorage.getItem('factower_active_slot');
    const saveKey   = 'factower_save_' + slotIndex;
    this.saveData   = JSON.parse(localStorage.getItem(saveKey));

    this.add.rectangle(width / 2, height / 2, width, height, 0x0d1117);

    // Fixed header
    this.add.rectangle(width / 2, TOP + 94, width, 100, 0x161b22).setDepth(10);
    this.add.rectangle(width / 2, TOP + 144, width, 1, 0x334455).setDepth(10);

    const backBtn = this.add.rectangle(44, TOP + 94, 72, 48, 0x1e2530).setInteractive().setDepth(11);
    this.add.text(44, TOP + 94, '<- BACK', {
      fontFamily: 'monospace', fontSize: '14px', color: '#e8a020'
    }).setOrigin(0.5).setDepth(11);
    backBtn.on('pointerdown', () => {
      this.cameras.main.fade(200, 0, 0, 0);
      this.time.delayedCall(200, () => this.scene.start('BaseScene'));
    });
    backBtn.on('pointerover', () => backBtn.setFillStyle(0x252c38));
    backBtn.on('pointerout',  () => backBtn.setFillStyle(0x1e2530));

    this.add.text(width / 2 + 20, TOP + 80, 'DOCK', {
      fontFamily: 'monospace', fontSize: '22px', color: '#eef2f8', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(11);
    this.add.text(width / 2 + 20, TOP + 108, 'SELECT CAMPAIGN', {
      fontFamily: 'monospace', fontSize: '12px', color: '#8899aa', letterSpacing: 2
    }).setOrigin(0.5).setDepth(11);

    // Scrollable content
    this.scrollContainer  = this.add.container(0, 0).setDepth(5);
    this.scrollCurrentY   = 0;
    this.dragStartY       = null;
    this.dragScrollY      = 0;
    this.isDragging       = false;
    const contentTop      = TOP + 155;

    let contentY = 0;

    const powerScore = (this.saveData && this.saveData.powerScore) ? this.saveData.powerScore : 0;
    const psText     = this.add.text(width / 2, contentTop + contentY + 14, 'YOUR POWER SCORE: ' + powerScore, {
      fontFamily: 'monospace', fontSize: '13px', color: '#e8a020', letterSpacing: 2
    }).setOrigin(0.5);
    const psDivider  = this.add.rectangle(width / 2, contentTop + contentY + 32, width - 48, 1, 0x334455);
    this.scrollContainer.add([psText, psDivider]);
    contentY += 46;

    const storyline = LEVEL_DATA.storylines[0];
    const snText    = this.add.text(24, contentTop + contentY + 8,  storyline.name, { fontFamily: 'monospace', fontSize: '20px', color: '#eef2f8', fontStyle: 'bold' });
    const sdText    = this.add.text(24, contentTop + contentY + 36, storyline.description, { fontFamily: 'monospace', fontSize: '12px', color: '#8899aa' });
    const sfText    = this.add.text(24, contentTop + contentY + 58, 'ENEMY: ' + storyline.faction.toUpperCase(), { fontFamily: 'monospace', fontSize: '12px', color: '#c43a3a', letterSpacing: 1 });
    const sdiv      = this.add.rectangle(width / 2, contentTop + contentY + 82, width - 48, 1, 0x334455);
    this.scrollContainer.add([snText, sdText, sfText, sdiv]);
    contentY += 92;

    const completedLevels = (this.saveData && this.saveData.completedLevels && this.saveData.completedLevels.storyline1)
      ? this.saveData.completedLevels.storyline1 : [];

    const cardH   = 76;
    const cardGap = 6;

    storyline.levels.forEach((level, i) => {
      const isCompleted = completedLevels.includes(level.id);
      const isUnlocked  = i === 0 || completedLevels.includes(storyline.levels[i - 1].id);
      const cardY       = contentTop + contentY;
      const items       = this.makeCard(level, cardY, isUnlocked, isCompleted, cardH);
      items.forEach(item => this.scrollContainer.add(item));
      contentY += cardH + cardGap;
    });

    contentY += 24;
    this.contentHeight  = contentY;
    this.scrollMinY     = Math.min(0, height - (contentTop + this.contentHeight));

    this.input.on('pointerdown', (pointer) => {
      this.dragStartY  = pointer.y;
      this.dragScrollY = this.scrollCurrentY;
      this.isDragging  = false;
    });
    this.input.on('pointermove', (pointer) => {
      if (this.dragStartY === null) return;
      const delta = pointer.y - this.dragStartY;
      if (Math.abs(delta) > 6) this.isDragging = true;
      if (!this.isDragging) return;
      const newY = Phaser.Math.Clamp(this.dragScrollY + delta, this.scrollMinY, 0);
      this.scrollContainer.setY(newY);
      this.scrollCurrentY = newY;
    });
    this.input.on('pointerup', () => { this.dragStartY = null; });
  }

  makeCard(level, cardY, isUnlocked, isCompleted, cardH) {
    const { width } = this.scale;
    const items      = [];
    const colour     = isCompleted ? 0x5eba7d : isUnlocked ? 0xe8a020 : 0x334455;
    const textColour = isCompleted ? '#5eba7d' : isUnlocked ? '#eef2f8' : '#445566';

    const bg     = this.add.rectangle(width / 2, cardY + cardH / 2, width - 48, cardH, 0x161b22);
    const border = this.add.rectangle(width / 2, cardY + cardH / 2, width - 48, cardH).setStrokeStyle(1, colour);
    const accent = this.add.rectangle(28, cardY + cardH / 2, 5, cardH - 16, colour);

    if (isUnlocked || isCompleted) {
      bg.setInteractive();
      bg.on('pointerup', () => {
        if (this.isDragging) return;
        this.cameras.main.fade(200, 0, 0, 0);
        this.time.delayedCall(200, () => {
          this.scene.start('CombatScene', { storylineId: 1, levelId: level.id, levelData: level });
        });
      });
      bg.on('pointerover', () => { if (!this.isDragging) bg.setFillStyle(0x1e2530); });
      bg.on('pointerout',  () => bg.setFillStyle(0x161b22));
    }

    const totalWaves = level.waves ? level.waves.length : 1;
    items.push(bg, border, accent);
    items.push(this.add.text(48, cardY + 10, 'LEVEL ' + level.id, { fontFamily: 'monospace', fontSize: '10px', color: '#8899aa', letterSpacing: 3 }));
    items.push(this.add.text(48, cardY + 24, level.name, { fontFamily: 'monospace', fontSize: '15px', color: textColour, fontStyle: 'bold' }));
    items.push(this.add.text(48, cardY + 44, level.description, { fontFamily: 'monospace', fontSize: '10px', color: '#556677', wordWrap: { width: width - 180 } }));
    for (let w = 0; w < 5; w++) {
      items.push(this.add.circle(width - 36 - (4 - w) * 14, cardY + 18, 4, w < totalWaves ? colour : 0x2a3a4a));
    }
    items.push(this.add.text(width - 36, cardY + 30, totalWaves + ' WAVES', { fontFamily: 'monospace', fontSize: '9px', color: '#556677', letterSpacing: 1 }).setOrigin(1, 0));
    if (isCompleted) {
      items.push(this.add.text(width - 36, cardY + 48, 'v DONE', { fontFamily: 'monospace', fontSize: '9px', color: '#5eba7d', letterSpacing: 1 }).setOrigin(1, 0));
    }
    return items;
  }
}
