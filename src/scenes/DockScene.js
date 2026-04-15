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
      // In level-list view, back goes to campaign select; otherwise to BaseScene
      if (this.currentView === 'levels') {
        this.showCampaignSelect();
      } else {
        this.cameras.main.fade(200, 0, 0, 0);
        this.time.delayedCall(200, () => this.scene.start('BaseScene'));
      }
    });
    backBtn.on('pointerover', () => backBtn.setFillStyle(0x252c38));
    backBtn.on('pointerout',  () => backBtn.setFillStyle(0x1e2530));

    this.headerTitle = this.add.text(width / 2 + 20, TOP + 80, 'DOCK', {
      fontFamily: 'monospace', fontSize: '22px', color: '#eef2f8', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(11);

    this.headerSub = this.add.text(width / 2 + 20, TOP + 108, 'SELECT CAMPAIGN', {
      fontFamily: 'monospace', fontSize: '12px', color: '#8899aa', letterSpacing: 2
    }).setOrigin(0.5).setDepth(11);

    // Scroll state
    this.isDragging     = false;
    this.dragStartY     = null;
    this.dragScrollY    = 0;
    this.scrollCurrentY = 0;
    this.scrollContainer = null;
    this.currentView    = 'campaigns';

    this.showCampaignSelect();
  }

  // ── Clear scrollable content ──────────────────────────────────────────
  clearScrollContent() {
    if (this.scrollContainer) {
      this.scrollContainer.destroy(true);
      this.scrollContainer = null;
    }
    this.input.off('pointerdown');
    this.input.off('pointermove');
    this.input.off('pointerup');
    this.scrollCurrentY = 0;
  }

  // ── Campaign / mode selection ─────────────────────────────────────────
  showCampaignSelect() {
    this.clearScrollContent();
    this.currentView = 'campaigns';
    const { width, height } = this.scale;
    const TOP = 55;

    this.headerTitle.setText('DOCK');
    this.headerSub.setText('SELECT CAMPAIGN');

    const completedS1 = (this.saveData && this.saveData.completedLevels && this.saveData.completedLevels.storyline1)
      ? this.saveData.completedLevels.storyline1 : [];
    const anyCompleted = completedS1.length > 0;

    const contentTop = TOP + 158;
    let y = contentTop + 24;

    // Salt & Plastic card
    this.drawCampaignCard({
      y,
      title:    'SALT & PLASTIC',
      tag:      'CAMPAIGN 1  —  8 LEVELS',
      tagCol:   '#e8a020',
      colour:   0xe8a020,
      sub:      'Establish your base. Survive the first raids.',
      progress: completedS1.length + ' / 8 complete',
      unlocked: true,
      onTap:    () => this.showLevelList(LEVEL_DATA.storylines[0])
    });
    y += 178;

    // Endless mode card
    this.drawCampaignCard({
      y,
      title:    'ENDLESS MODE',
      tag:      'ENDLESS',
      tagCol:   anyCompleted ? '#3a8fc4' : '#334455',
      colour:   anyCompleted ? 0x3a8fc4 : 0x334455,
      sub:      anyCompleted
        ? 'Continuous waves from all unlocked maps.\nPower zones randomised each run.'
        : 'Complete at least one level to unlock.',
      progress: anyCompleted ? completedS1.length + ' maps in pool' : 'LOCKED',
      unlocked: anyCompleted,
      onTap:    anyCompleted ? () => this.startEndless() : null
    });
  }

  drawCampaignCard({ y, title, tag, tagCol, colour, sub, progress, unlocked, onTap }) {
    const { width } = this.scale;
    const cardH = 158;

    const bg     = this.add.rectangle(width / 2, y + cardH / 2, width - 48, cardH, 0x161b22);
    const border = this.add.rectangle(width / 2, y + cardH / 2, width - 48, cardH).setStrokeStyle(2, unlocked ? colour : 0x334455);
    const accent = this.add.rectangle(28, y + cardH / 2, 6, cardH - 16, unlocked ? colour : 0x334455);

    this.add.text(48, y + 14, tag, { fontFamily: 'monospace', fontSize: '10px', color: tagCol, letterSpacing: 3 });
    this.add.text(48, y + 32, title, { fontFamily: 'monospace', fontSize: '20px', color: unlocked ? '#eef2f8' : '#445566', fontStyle: 'bold' });
    this.add.text(48, y + 60, sub, { fontFamily: 'monospace', fontSize: '11px', color: '#8899aa', wordWrap: { width: width - 120 } });
    this.add.text(48, y + cardH - 28, progress, { fontFamily: 'monospace', fontSize: '11px', color: unlocked ? tagCol : '#334455' });

    if (unlocked && onTap) {
      bg.setInteractive();
      bg.on('pointerup', onTap);
      bg.on('pointerover', () => bg.setFillStyle(0x1e2530));
      bg.on('pointerout',  () => bg.setFillStyle(0x161b22));
      this.add.text(width - 32, y + cardH / 2, '->', {
        fontFamily: 'monospace', fontSize: '22px', color: '#' + colour.toString(16).padStart(6, '0')
      }).setOrigin(1, 0.5);
    }
  }

  // ── Endless mode — pick random completed level, generate infinite waves ──
  startEndless() {
    const completedIds = (this.saveData && this.saveData.completedLevels && this.saveData.completedLevels.storyline1)
      ? this.saveData.completedLevels.storyline1 : [];
    if (completedIds.length === 0) return;

    const idx       = Math.floor(Math.random() * completedIds.length);
    const levelId   = completedIds[idx];
    const baseLvl   = LEVEL_DATA.storylines[0].levels.find(l => l.id === levelId);
    if (!baseLvl) return;

    // Build endless level data — copy path/ubzs/hotspots but generate infinite waves
    const endlessData = Object.assign({}, baseLvl, {
      name:      baseLvl.name + '  —  ENDLESS',
      baseHp:    10,
      tutorialText: null,
      // waves generated dynamically in CombatScene when isEndless=true
      waves: this.generateEndlessWaves(6)
    });

    this.cameras.main.fade(200, 0, 0, 0);
    this.time.delayedCall(200, () => {
      this.scene.start('CombatScene', {
        storylineId: 1,
        levelId:     levelId,
        levelData:   endlessData,
        isEndless:   true
      });
    });
  }

  // Generate a large number of escalating endless waves
  generateEndlessWaves(startDifficulty) {
    const waves = [];
    for (let w = 0; w < 99; w++) {
      const diff = startDifficulty + w;
      const base = Math.floor(6 + diff * 1.8);
      const hasHulk  = diff >= 3;
      const hulkCount = hasHulk ? Math.min(1 + Math.floor((diff - 3) / 3), 5) : 0;
      const enemies = [];

      enemies.push({ type: 'saltChild',   count: Math.max(8, base),           interval: Math.max(650, 1600 - diff * 40)  });
      if (diff >= 2) enemies.push({ type: 'scrapRunner', count: Math.max(4, Math.floor(base * 0.6)), interval: Math.max(800, 1900 - diff * 45) });
      if (hasHulk)   enemies.push({ type: 'driftwoodHulk', count: hulkCount,  interval: Math.max(2500, 6000 - diff * 150) });
      if (diff >= 14 && w % 5 === 4) enemies.push({ type: 'frontCommander', count: 1, interval: 0 });

      waves.push({ preWaveDelay: w === 0 ? 3000 : 2000, enemies });
    }
    return waves;
  }

  // ── Level list ────────────────────────────────────────────────────────
  showLevelList(storyline) {
    this.clearScrollContent();
    this.currentView = 'levels';
    const { width, height } = this.scale;
    const TOP = 55;

    this.headerTitle.setText(storyline.name);
    this.headerSub.setText('ENEMY: ' + storyline.faction.toUpperCase());

    this.scrollContainer = this.add.container(0, 0).setDepth(5);
    const contentTop     = TOP + 158;
    let   contentY       = 14;

    const completedLevels = (this.saveData && this.saveData.completedLevels && this.saveData.completedLevels.storyline1)
      ? this.saveData.completedLevels.storyline1 : [];

    const cardH = 80, cardGap = 6;

    storyline.levels.forEach((level, i) => {
      const isCompleted = completedLevels.includes(level.id);
      const isUnlocked  = i === 0 || completedLevels.includes(storyline.levels[i - 1].id);
      const cardY       = contentTop + contentY;
      const items       = this.makeLevelCard(level, cardY, isUnlocked, isCompleted, cardH);
      items.forEach(item => this.scrollContainer.add(item));
      contentY += cardH + cardGap;
    });

    contentY += 28;
    this.contentHeight  = contentY;
    this.scrollMinY     = Math.min(0, height - (contentTop + this.contentHeight));
    this.scrollCurrentY = 0;
    this.dragStartY     = null;
    this.isDragging     = false;

    this.input.on('pointerdown', (p) => {
      this.dragStartY  = p.y;
      this.dragScrollY = this.scrollCurrentY;
      this.isDragging  = false;
    });
    this.input.on('pointermove', (p) => {
      if (this.dragStartY === null) return;
      const delta = p.y - this.dragStartY;
      if (Math.abs(delta) > 6) this.isDragging = true;
      if (!this.isDragging) return;
      const newY = Phaser.Math.Clamp(this.dragScrollY + delta, this.scrollMinY, 0);
      this.scrollContainer.setY(newY);
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
    items.push(bg, border, accent);

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
    items.push(this.add.text(48, cardY + 10, 'LEVEL ' + level.id, { fontFamily: 'monospace', fontSize: '10px', color: '#8899aa', letterSpacing: 3 }));
    items.push(this.add.text(48, cardY + 24, level.name, { fontFamily: 'monospace', fontSize: '15px', color: textColour, fontStyle: 'bold' }));
    items.push(this.add.text(48, cardY + 46, level.description, { fontFamily: 'monospace', fontSize: '10px', color: '#556677', wordWrap: { width: width - 200 } }));

    // Wave dots
    for (let w = 0; w < 5; w++) {
      items.push(this.add.circle(width - 42 - (4 - w) * 14, cardY + 18, 4, w < totalWaves ? colour : 0x2a3a4a));
    }
    items.push(this.add.text(width - 36, cardY + 32, totalWaves + ' WAVES', { fontFamily: 'monospace', fontSize: '9px', color: '#556677', letterSpacing: 1 }).setOrigin(1, 0));

    // Zone hints
    if (level.hotspots && level.hotspots.length > 0) {
      const boosts = level.hotspots.filter(h => h.mult >= 1).length;
      const drains = level.hotspots.filter(h => h.mult < 1).length;
      const str    = (boosts > 0 ? boosts + 'B' : '') + (drains > 0 ? ' ' + drains + 'D' : '');
      items.push(this.add.text(width - 36, cardY + 48, str, { fontFamily: 'monospace', fontSize: '9px', color: '#445566', letterSpacing: 1 }).setOrigin(1, 0));
    }

    if (isCompleted) {
      items.push(this.add.text(width - 36, cardY + 64, 'v DONE', { fontFamily: 'monospace', fontSize: '9px', color: '#5eba7d', letterSpacing: 1 }).setOrigin(1, 0));
    }

    return items;
  }
}
