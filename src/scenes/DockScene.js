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

    this.add.rectangle(width / 2, TOP + 94, width, 100, 0x161b22).setDepth(10);
    this.add.rectangle(width / 2, TOP + 144, width, 1, 0x334455).setDepth(10);

    const backBtn = this.add.rectangle(44, TOP + 94, 72, 48, 0x1e2530).setInteractive().setDepth(11);
    this.add.text(44, TOP + 94, '<- BACK', {
      fontFamily: 'monospace', fontSize: '14px', color: '#e8a020'
    }).setOrigin(0.5).setDepth(11);
    backBtn.on('pointerdown', () => {
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

    this.contentContainer = null;
    this.currentView      = 'campaigns';
    this.scrollY          = 0;
    this.scrollMinY       = 0;

    // Named scroll handlers so they can be removed cleanly
    this._onDown  = (p) => { this._dragStart = p.y; this._dragBase = this.scrollY; this._dragging = false; };
    this._onMove  = (p) => {
      if (this._dragStart === null || this._dragStart === undefined) return;
      const delta = p.y - this._dragStart;
      if (Math.abs(delta) > 5) this._dragging = true;
      if (!this._dragging) return;
      const clamped = Phaser.Math.Clamp(this._dragBase + delta, this.scrollMinY, 0);
      this.contentContainer.setY(clamped);
      this.scrollY = clamped;
    };
    this._onUp    = () => { this._dragStart = undefined; };
    this._dragStart = undefined;
    this._dragBase  = 0;
    this._dragging  = false;

    this.showCampaignSelect();
  }

  clearContent() {
    if (this.contentContainer) {
      this.contentContainer.destroy(true);
      this.contentContainer = null;
    }
    this.input.off('pointerdown',  this._onDown);
    this.input.off('pointermove',  this._onMove);
    this.input.off('pointerup',    this._onUp);
    this.scrollY    = 0;
    this.scrollMinY = 0;
    this._dragStart = undefined;
    this._dragging  = false;
  }

  enableScroll() {
    this.input.on('pointerdown',  this._onDown);
    this.input.on('pointermove',  this._onMove);
    this.input.on('pointerup',    this._onUp);
  }

  // ── Campaign select ───────────────────────────────────────────────────
  showCampaignSelect() {
    this.clearContent();
    this.currentView = 'campaigns';
    const { width } = this.scale;
    const TOP = 55;

    this.headerTitle.setText('DOCK');
    this.headerSub.setText('SELECT CAMPAIGN');

    this.contentContainer = this.add.container(0, 0).setDepth(5);

    const completedS1  = (this.saveData && this.saveData.completedLevels && this.saveData.completedLevels.storyline1)
      ? this.saveData.completedLevels.storyline1 : [];
    const anyCompleted = completedS1.length > 0;
    const contentTop   = TOP + 162;

    this.addCampaignCard(contentTop + 18, {
      title:    'SALT & PLASTIC',
      tag:      'CAMPAIGN 1  —  8 LEVELS',
      tagCol:   '#e8a020',
      colour:   0xe8a020,
      sub:      'Establish your base. Survive the first raids.',
      progress: completedS1.length + ' / 8 complete',
      unlocked: true,
      onTap:    () => this.showLevelList(LEVEL_DATA.storylines[0])
    });

    this.addCampaignCard(contentTop + 18 + 174, {
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

    // No scrolling needed on campaign select — it fits on screen
  }

  addCampaignCard(y, { title, tag, tagCol, colour, sub, progress, unlocked, onTap }) {
    const { width } = this.scale;
    const cardH  = 156;
    const border = unlocked ? colour : 0x334455;
    const titCol = unlocked ? '#eef2f8' : '#445566';

    const bg   = this.add.rectangle(width / 2, y + cardH / 2, width - 48, cardH, 0x161b22);
    const bdr  = this.add.rectangle(width / 2, y + cardH / 2, width - 48, cardH).setStrokeStyle(2, border);
    const acc  = this.add.rectangle(28, y + cardH / 2, 6, cardH - 16, border);
    const tTag = this.add.text(48, y + 14, tag,   { fontFamily: 'monospace', fontSize: '10px', color: tagCol, letterSpacing: 3 });
    const tTit = this.add.text(48, y + 32, title, { fontFamily: 'monospace', fontSize: '20px', color: titCol, fontStyle: 'bold' });
    const tSub = this.add.text(48, y + 58, sub,   { fontFamily: 'monospace', fontSize: '11px', color: '#8899aa', wordWrap: { width: width - 120 } });
    const tPrg = this.add.text(48, y + cardH - 26, progress, { fontFamily: 'monospace', fontSize: '11px', color: unlocked ? tagCol : '#334455' });

    this.contentContainer.add([bg, bdr, acc, tTag, tTit, tSub, tPrg]);

    if (unlocked && onTap) {
      bg.setInteractive();
      bg.on('pointerup',   () => onTap());
      bg.on('pointerover', () => bg.setFillStyle(0x1e2530));
      bg.on('pointerout',  () => bg.setFillStyle(0x161b22));
      const arrow = this.add.text(width - 32, y + cardH / 2, '->', {
        fontFamily: 'monospace', fontSize: '22px',
        color: '#' + colour.toString(16).padStart(6, '0')
      }).setOrigin(1, 0.5);
      this.contentContainer.add(arrow);
    }
  }

  // ── Endless ───────────────────────────────────────────────────────────
  startEndless() {
    const ids = (this.saveData && this.saveData.completedLevels && this.saveData.completedLevels.storyline1)
      ? this.saveData.completedLevels.storyline1 : [];
    if (ids.length === 0) return;

    const base = LEVEL_DATA.storylines[0].levels.find(l => l.id === ids[Math.floor(Math.random() * ids.length)]);
    if (!base) return;

    const data = Object.assign({}, base, {
      name:         base.name + '  —  ENDLESS',
      baseHp:       10,
      tutorialText: null,
      waves:        this.buildEndlessWaves(6)
    });

    this.cameras.main.fade(200, 0, 0, 0);
    this.time.delayedCall(200, () => {
      this.scene.start('CombatScene', { storylineId: 1, levelId: base.id, levelData: data, isEndless: true });
    });
  }

  buildEndlessWaves(startDiff) {
    const waves = [];
    for (let w = 0; w < 99; w++) {
      const d = startDiff + w;
      const b = Math.floor(6 + d * 1.8);
      const e = [];
      e.push({ type: 'saltChild',   count: Math.max(8, b),                                    interval: Math.max(650,  1600 - d * 40)  });
      if (d >= 2) e.push({ type: 'scrapRunner',   count: Math.max(4, Math.floor(b * 0.6)),    interval: Math.max(800,  1900 - d * 45)  });
      if (d >= 3) e.push({ type: 'driftwoodHulk', count: Math.min(1 + Math.floor((d-3)/3), 6), interval: Math.max(2500, 6000 - d * 150) });
      if (d >= 14 && w % 5 === 4) e.push({ type: 'frontCommander', count: 1, interval: 0 });
      waves.push({ preWaveDelay: w === 0 ? 3000 : 2000, enemies: e });
    }
    return waves;
  }

  // ── Level list ────────────────────────────────────────────────────────
  showLevelList(storyline) {
    this.clearContent();
    this.currentView = 'levels';
    const { width, height } = this.scale;
    const TOP = 55;

    this.headerTitle.setText(storyline.name);
    this.headerSub.setText('ENEMY: ' + storyline.faction.toUpperCase());

    this.contentContainer = this.add.container(0, 0).setDepth(5);

    const completed  = (this.saveData && this.saveData.completedLevels && this.saveData.completedLevels.storyline1)
      ? this.saveData.completedLevels.storyline1 : [];
    const contentTop = TOP + 162;
    const cardH      = 84;
    const cardGap    = 4;
    let   contentY   = 12;

    storyline.levels.forEach((level, i) => {
      const isDone     = completed.includes(level.id);
      const isUnlocked = i === 0 || completed.includes(storyline.levels[i - 1].id);
      this.addLevelCard(level, contentTop + contentY, isUnlocked, isDone, cardH);
      contentY += cardH + cardGap;
    });

    contentY += 20;
    this.scrollMinY = Math.min(0, height - (contentTop + contentY));

    this.enableScroll();
  }

  addLevelCard(level, cardY, isUnlocked, isCompleted, cardH) {
    const { width } = this.scale;
    const colour = isCompleted ? 0x5eba7d : isUnlocked ? 0xe8a020 : 0x334455;
    const titCol = isCompleted ? '#5eba7d' : isUnlocked ? '#eef2f8' : '#445566';

    const bg  = this.add.rectangle(width / 2, cardY + cardH / 2, width - 48, cardH, 0x161b22);
    const bdr = this.add.rectangle(width / 2, cardY + cardH / 2, width - 48, cardH).setStrokeStyle(1, colour);
    const acc = this.add.rectangle(28, cardY + cardH / 2, 5, cardH - 16, colour);

    this.contentContainer.add([bg, bdr, acc]);

    if (isUnlocked || isCompleted) {
      bg.setInteractive();
      bg.on('pointerup', () => {
        if (this._dragging) return;
        this.cameras.main.fade(200, 0, 0, 0);
        this.time.delayedCall(200, () => {
          this.scene.start('CombatScene', { storylineId: 1, levelId: level.id, levelData: level });
        });
      });
      bg.on('pointerover', () => { if (!this._dragging) bg.setFillStyle(0x1e2530); });
      bg.on('pointerout',  () => bg.setFillStyle(0x161b22));
    }

    const totalWaves = level.waves ? level.waves.length : 1;

    const tLvl  = this.add.text(48, cardY + 9,  'LEVEL ' + level.id, { fontFamily: 'monospace', fontSize: '10px', color: '#8899aa', letterSpacing: 3 });
    const tName = this.add.text(48, cardY + 23, level.name,           { fontFamily: 'monospace', fontSize: '15px', color: titCol, fontStyle: 'bold' });
    const tDesc = this.add.text(48, cardY + 44, level.description,    { fontFamily: 'monospace', fontSize: '10px', color: '#556677', wordWrap: { width: width - 200 } });

    this.contentContainer.add([tLvl, tName, tDesc]);

    for (let w = 0; w < 5; w++) {
      this.contentContainer.add(this.add.circle(width - 42 - (4 - w) * 14, cardY + 16, 4, w < totalWaves ? colour : 0x2a3a4a));
    }

    const tW = this.add.text(width - 36, cardY + 28, totalWaves + ' WAVES', { fontFamily: 'monospace', fontSize: '9px', color: '#556677', letterSpacing: 1 }).setOrigin(1, 0);
    this.contentContainer.add(tW);

    if (level.hotspots && level.hotspots.length > 0) {
      const b   = level.hotspots.filter(h => h.mult >= 1).length;
      const d   = level.hotspots.filter(h => h.mult < 1).length;
      const str = (b > 0 ? b + 'B' : '') + (b > 0 && d > 0 ? ' ' : '') + (d > 0 ? d + 'D' : '');
      this.contentContainer.add(this.add.text(width - 36, cardY + 42, str, { fontFamily: 'monospace', fontSize: '9px', color: '#445566' }).setOrigin(1, 0));
    }

    if (isCompleted) {
      this.contentContainer.add(this.add.text(width - 36, cardY + 60, 'v DONE', { fontFamily: 'monospace', fontSize: '9px', color: '#5eba7d', letterSpacing: 1 }).setOrigin(1, 0));
    }
  }
}
