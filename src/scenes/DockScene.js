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

    this.headerTitle = this.add.text(width / 2 + 20, TOP + 80, 'DOCK', {
      fontFamily: 'monospace', fontSize: '22px', color: '#eef2f8', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(11);
    this.headerSub = this.add.text(width / 2 + 20, TOP + 108, 'SELECT CAMPAIGN', {
      fontFamily: 'monospace', fontSize: '12px', color: '#8899aa', letterSpacing: 2
    }).setOrigin(0.5).setDepth(11);

    // Content container
    this.contentContainer = null;
    this.showStorylineSelection();
  }

  clearContent() {
    if (this.contentContainer) {
      this.contentContainer.destroy(true);
      this.contentContainer = null;
    }
    this.isDragging   = false;
    this.dragStartY   = null;
    this.dragScrollY  = 0;
    this.scrollCurrentY = 0;
  }

  // ── View 1: Storyline / mode selection ───────────────────────────────
  showStorylineSelection() {
    this.clearContent();
    const { width, height } = this.scale;
    const TOP = 55;
    const contentTop = TOP + 158;

    this.headerTitle.setText('DOCK');
    this.headerSub.setText('SELECT CAMPAIGN');

    const completedS1 = (this.saveData && this.saveData.completedLevels && this.saveData.completedLevels.storyline1)
      ? this.saveData.completedLevels.storyline1 : [];
    const anyCompleted = completedS1.length > 0;

    let y = contentTop + 20;

    // Salt & Plastic card
    this.drawModeCard({
      y,
      title:       'SALT & PLASTIC',
      subtitle:    'Establish your base. Survive the first raids.',
      tag:         'CAMPAIGN 1  ·  8 LEVELS',
      tagColour:   '#e8a020',
      colour:      0xe8a020,
      progress:    completedS1.length + ' / 8 complete',
      unlocked:    true,
      onTap: () => this.showLevelList(LEVEL_DATA.storylines[0])
    });
    y += 175;

    // Endless mode card
    this.drawModeCard({
      y,
      title:       'ENDLESS MODE',
      subtitle:    anyCompleted
        ? 'Random maps from completed levels. Randomised power zones.'
        : 'Complete at least one level to unlock.',
      tag:         'ENDLESS',
      tagColour:   anyCompleted ? '#3a8fc4' : '#334455',
      colour:      anyCompleted ? 0x3a8fc4 : 0x334455,
      progress:    anyCompleted ? completedS1.length + ' maps available' : 'LOCKED',
      unlocked:    anyCompleted,
      onTap: anyCompleted ? () => this.startEndless() : null
    });
  }

  drawModeCard({ y, title, subtitle, tag, tagColour, colour, progress, unlocked, onTap }) {
    const { width } = this.scale;
    const cardH = 155;
    const items = [];

    const bg     = this.add.rectangle(width / 2, y + cardH / 2, width - 48, cardH, 0x161b22);
    const border = this.add.rectangle(width / 2, y + cardH / 2, width - 48, cardH).setStrokeStyle(2, unlocked ? colour : 0x334455);
    const accent = this.add.rectangle(28, y + cardH / 2, 6, cardH - 16, unlocked ? colour : 0x334455);
    items.push(bg, border, accent);

    items.push(this.add.text(48, y + 14, tag, {
      fontFamily: 'monospace', fontSize: '10px', color: tagColour, letterSpacing: 3
    }));
    items.push(this.add.text(48, y + 32, title, {
      fontFamily: 'monospace', fontSize: '20px', color: unlocked ? '#eef2f8' : '#445566', fontStyle: 'bold'
    }));
    items.push(this.add.text(48, y + 58, subtitle, {
      fontFamily: 'monospace', fontSize: '11px', color: '#8899aa', wordWrap: { width: width - 120 }
    }));
    items.push(this.add.text(48, y + cardH - 28, progress, {
      fontFamily: 'monospace', fontSize: '11px', color: unlocked ? tagColour : '#334455'
    }));

    if (unlocked && onTap) {
      bg.setInteractive();
      bg.on('pointerup', onTap);
      bg.on('pointerover', () => bg.setFillStyle(0x1e2530));
      bg.on('pointerout',  () => bg.setFillStyle(0x161b22));
      items.push(this.add.text(width - 32, y + cardH / 2, '->', {
        fontFamily: 'monospace', fontSize: '22px', color: '#' + colour.toString(16).padStart(6, '0')
      }).setOrigin(1, 0.5));
    }
  }

  // ── Start endless mode ────────────────────────────────────────────────
  startEndless() {
    const completed = (this.saveData && this.saveData.completedLevels && this.saveData.completedLevels.storyline1)
      ? this.saveData.completedLevels.storyline1 : [];
    if (completed.length === 0) return;

    // Pick random completed level
    const idx       = Math.floor(Math.random() * completed.length);
    const levelId   = completed[idx];
    const storyline = LEVEL_DATA.storylines[0];
    const levelData = storyline.levels.find(l => l.id === levelId);
    if (!levelData) return;

    this.cameras.main.fade(200, 0, 0, 0);
    this.time.delayedCall(200, () => {
      this.scene.start('CombatScene', {
        storylineId: 1,
        levelId:     levelData.id,
        levelData:   levelData,
        isEndless:   true
      });
    });
  }

  // ── View 2: Level list for a storyline ───────────────────────────────
  showLevelList(storyline) {
    this.clearContent();
    const { width, height } = this.scale;
    const TOP = 55;

    this.headerTitle.setText(storyline.name);
    this.headerSub.setText('ENEMY: ' + storyline.faction.toUpperCase());

    // Container for scroll
    this.contentContainer = this.add.container(0, 0).setDepth(5);
    const contentTop      = TOP + 158;
    this.scrollCurrentY   = 0;

    const completedLevels = (this.saveData && this.saveData.completedLevels && this.saveData.completedLevels.storyline1)
      ? this.saveData.completedLevels.storyline1 : [];

    let contentY = 8;

    // Back to campaign select — inside scroll area
    const backCard = this.add.rectangle(width / 2, contentTop + contentY + 20, width - 48, 40, 0x161b22).setInteractive();
    this.add.rectangle(width / 2, contentTop + contentY + 20, width - 48, 40).setStrokeStyle(1, 0x334455);
    this.add.text(28, contentTop + contentY + 20, '<- ALL CAMPAIGNS', {
      fontFamily: 'monospace', fontSize: '12px', color: '#8899aa'
    }).setOrigin(0, 0.5);
    this.contentContainer.add([backCard]);
    backCard.on('pointerup', () => { if (!this.isDragging) this.showStorylineSelection(); });
    backCard.on('pointerover', () => backCard.setFillStyle(0x1e2530));
    backCard.on('pointerout',  () => backCard.setFillStyle(0x161b22));
    contentY += 54;

    const cardH = 78, cardGap = 6;

    storyline.levels.forEach((level, i) => {
      const isCompleted = completedLevels.includes(level.id);
      const isUnlocked  = i === 0 || completedLevels.includes(storyline.levels[i - 1].id);
      const cardY       = contentTop + contentY;
      const items       = this.makeLevelCard(level, cardY, isUnlocked, isCompleted, cardH);
      items.forEach(item => this.contentContainer.add(item));
      contentY += cardH + cardGap;
    });

    contentY += 24;
    this.contentHeight = contentY;
    this.scrollMinY    = Math.min(0, height - (contentTop + this.contentHeight));

    // Touch scroll handlers
    this.input.on('pointerdown', (p) => { this.dragStartY = p.y; this.dragScrollY = this.scrollCurrentY; this.isDragging = false; });
    this.input.on('pointermove', (p) => {
      if (this.dragStartY === null) return;
      const delta = p.y - this.dragStartY;
      if (Math.abs(delta) > 6) this.isDragging = true;
      if (!this.isDragging) return;
      const newY = Phaser.Math.Clamp(this.dragScrollY + delta, this.scrollMinY, 0);
      this.contentContainer.setY(newY);
      this.scrollCurrentY = newY;
    });
    this.input.on('pointerup', () => { this.dragStartY = null; });
  }

  makeLevelCard(level, cardY, isUnlocked, isCompleted, cardH) {
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

    // Wave dots
    for (let w = 0; w < 5; w++) {
      items.push(this.add.circle(width - 36 - (4 - w) * 14, cardY + 18, 4, w < totalWaves ? colour : 0x2a3a4a));
    }
    items.push(this.add.text(width - 36, cardY + 32, totalWaves + ' WAVES', { fontFamily: 'monospace', fontSize: '9px', color: '#556677', letterSpacing: 1 }).setOrigin(1, 0));

    if (level.hotspots && level.hotspots.length > 0) {
      const boosts  = level.hotspots.filter(h => h.mult >= 1).length;
      const drains  = level.hotspots.filter(h => h.mult < 1).length;
      const zoneStr = (boosts > 0 ? boosts + ' boost' : '') + (boosts > 0 && drains > 0 ? ' · ' : '') + (drains > 0 ? drains + ' drain' : '');
      items.push(this.add.text(width - 36, cardY + 46, zoneStr, { fontFamily: 'monospace', fontSize: '9px', color: '#445566', letterSpacing: 1 }).setOrigin(1, 0));
    }

    if (isCompleted) {
      items.push(this.add.text(width - 36, cardY + 60, 'v DONE', { fontFamily: 'monospace', fontSize: '9px', color: '#5eba7d', letterSpacing: 1 }).setOrigin(1, 0));
    }

    return items;
  }
}
