class DockScene extends Phaser.Scene {
  constructor() {
    super({ key: 'DockScene' });
  }

  create() {
    this.saveData = SaveManager.load() || {};
    UI.backdrop(this);
    UI.fadeIn(this);

    this.hdr = UI.header(this, {
      title: 'DOCK', sub: 'CHOOSE A MISSION', accent: UI.C.red,
      onBack: () => {
        if (this.currentView === 'levels') this.showCampaignSelect();
        else UI.go(this, 'BaseScene');
      },
      chips: [{ kind: 'towers', value: this.stockTotal() }]
    });

    this.contentContainer = null;
    this.currentView      = 'campaigns';
    this.scrollY          = 0;
    this.scrollMinY       = 0;

    // Drag-to-scroll for the level list
    this._onDown  = (p) => { if (p.y < UI.HEADER_H) return; this._dragStart = p.y; this._dragBase = this.scrollY; this._dragging = false; };
    this._onMove  = (p) => {
      if (this._dragStart === undefined || !this.contentContainer) return;
      const delta = p.y - this._dragStart;
      if (Math.abs(delta) > 8) this._dragging = true;
      if (!this._dragging) return;
      const clamped = Phaser.Math.Clamp(this._dragBase + delta, this.scrollMinY, 0);
      this.contentContainer.setY(clamped);
      this.scrollY = clamped;
    };
    this._onUp    = () => { this._dragStart = undefined; this.time.delayedCall(0, () => { this._dragging = false; }); };
    this._dragStart = undefined;
    this._dragging  = false;

    this.showCampaignSelect();
  }

  stockTotal() {
    return Object.values(this.saveData.stockpile || {}).reduce((a, b) => a + b, 0);
  }

  completedS1() {
    return (this.saveData.completedLevels && this.saveData.completedLevels.storyline1) || [];
  }

  titleCase(str) { return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()); }

  clearContent() {
    if (this.contentContainer) { this.contentContainer.destroy(true); this.contentContainer = null; }
    this.input.off('pointerdown', this._onDown);
    this.input.off('pointermove', this._onMove);
    this.input.off('pointerup',   this._onUp);
    this.scrollY = 0; this.scrollMinY = 0;
    this._dragStart = undefined; this._dragging = false;
  }

  enableScroll() {
    this.input.on('pointerdown', this._onDown);
    this.input.on('pointermove', this._onMove);
    this.input.on('pointerup',   this._onUp);
  }

  // ── Campaign list ──────────────────────────────────────────────────────
  showCampaignSelect() {
    this.clearContent();
    this.currentView = 'campaigns';
    this.hdr.title.setText('DOCK');
    this.hdr.sub.setText('CHOOSE A MISSION');
    this.contentContainer = this.add.container(0, 0).setDepth(5);

    const done = this.completedS1();
    const s1 = LEVEL_DATA.storylines[0];
    let y = UI.HEADER_H + 24;

    y = this.addCampaignCard(y, {
      tag: 'CAMPAIGN 1  ·  ' + s1.levels.length + ' LEVELS', title: 'Salt & Plastic', colour: UI.C.amber,
      body: s1.description + ' Enemy: ' + s1.faction + '.',
      progress: done.length / s1.levels.length, progressLabel: done.length + ' / ' + s1.levels.length + ' cleared',
      unlocked: true, onTap: () => this.showLevelList(s1)
    });

    const anyDone = done.length > 0;
    this.addCampaignCard(y + 14, {
      tag: 'ENDLESS', title: 'Endless Raids', colour: UI.C.blue,
      body: anyDone ? 'Waves keep coming on a map you have cleared. Power zones change every run. How long can you hold?'
                    : 'Clear Level 1 of Salt & Plastic to unlock.',
      progressLabel: anyDone ? done.length + ' map' + (done.length === 1 ? '' : 's') + ' in the pool' : null,
      unlocked: anyDone, onTap: anyDone ? () => this.launch(null, true) : null
    });
  }

  addCampaignCard(top, c) {
    const { width } = this.scale;
    const w = width - 32, lx = 16 + 20;
    const items = [];
    const tagT   = UI.text(this, lx, top + 18, c.tag, 'tag', { size: 11, color: c.unlocked ? UI.hex(c.colour) : UI.T.faint });
    const titleT = UI.text(this, lx, top + 36, c.title, 'title', { size: 24, color: c.unlocked ? UI.T.text : UI.T.faint });
    const bodyT  = UI.text(this, lx, top + 70, c.body, 'body', { size: 13, wrap: w - 80, color: c.unlocked ? UI.T.dim : UI.T.faint });
    let h = 70 + bodyT.height + 18;
    if (c.progressLabel) h += 30;
    const panel = UI.panel(this, width / 2, top + h / 2, w, h, {
      fill: UI.C.surface, stroke: c.unlocked ? c.colour : UI.C.lineSoft, strokeAlpha: c.unlocked ? 0.55 : 1,
      accent: c.unlocked ? c.colour : undefined, radius: 16
    });
    items.push(panel, tagT, titleT, bodyT);
    if (c.progressLabel) {
      const py = top + h - 26;
      if (c.progress !== undefined) {
        const bar = this.add.graphics();
        bar.fillStyle(UI.C.surface2, 1); bar.fillRoundedRect(lx, py - 3, 140, 6, 3);
        bar.fillStyle(c.colour, 1);     bar.fillRoundedRect(lx, py - 3, Math.max(6, 140 * c.progress), 6, 3);
        items.push(bar, UI.text(this, lx + 152, py, c.progressLabel, 'small', { origin: [0, 0.5] }));
      } else {
        items.push(UI.text(this, lx, py, c.progressLabel, 'small', { origin: [0, 0.5] }));
      }
    }
    if (c.unlocked) {
      items.push(UI.icon(this, width - 16 - 24, top + h / 2, 'chevron', 14, c.colour));
      const zone = this.add.zone(width / 2, top + h / 2, w, h).setInteractive();
      let pressed = false;
      zone.on('pointerdown', () => { pressed = true; panel.setAlpha(0.8); });
      zone.on('pointerout',  () => { pressed = false; panel.setAlpha(1); });
      zone.on('pointerup',   () => { panel.setAlpha(1); if (pressed && c.onTap) c.onTap(); pressed = false; });
      items.push(zone);
    } else {
      items.push(UI.icon(this, width - 16 - 24, top + h / 2, 'lock', 15, 0x465163));
    }
    this.contentContainer.add(items);
    return top + h;
  }

  // ── Level list ─────────────────────────────────────────────────────────
  showLevelList(storyline) {
    this.clearContent();
    this.currentView = 'levels';
    const { height } = this.scale;
    this.hdr.title.setText(storyline.name);
    this.hdr.sub.setText('VS ' + storyline.faction.toUpperCase());
    this.contentContainer = this.add.container(0, 0).setDepth(5);

    const done = this.completedS1();
    let y = UI.HEADER_H + 16;
    storyline.levels.forEach((level, i) => {
      const isDone     = done.includes(level.id);
      const isUnlocked = i === 0 || done.includes(storyline.levels[i - 1].id);
      const isNext     = isUnlocked && !isDone;
      y = this.addLevelCard(level, y, isUnlocked, isDone, isNext) + 10;
    });
    this.scrollMinY = Math.min(0, height - (y + 20));
    this.enableScroll();
  }


  addLevelCard(level, top, unlocked, done, isNext) {
    const { width } = this.scale;
    const w = width - 32;
    const colour = done ? UI.C.green : unlocked ? UI.C.amber : UI.C.line;
    const items = [];
    const bx = 16 + 34, lx = bx + 34, textW = w - (lx - 16) - 40;

    // Text first, so the card can grow to fit the description
    const waves  = level.waves ? level.waves.length : 1;
    const enemyN = (level.waves || []).reduce((s, wv) => s + wv.enemies.reduce((a, g) => a + g.count, 0), 0);
    const titleT = UI.text(this, lx, top + 16, this.titleCase(level.name), 'heading', { size: 17, color: unlocked ? UI.T.text : UI.T.faint });
    const descT  = UI.text(this, lx, top + 40, unlocked ? level.description : 'Clear the previous level to unlock.', 'small',
      { size: 12, wrap: textW, color: unlocked ? UI.T.mute : UI.T.faint });
    const metaT  = UI.text(this, lx, top + 46 + descT.height, waves + ' wave' + (waves === 1 ? '' : 's') + '  ·  ' + enemyN + ' raiders', 'label',
      { size: 11, color: unlocked ? UI.T.dim : UI.T.faint });
    const h = Math.max(92, 46 + descT.height + 16 + 16);
    const cy = top + h / 2;

    const panel = UI.panel(this, width / 2, cy, w, h, {
      fill: unlocked ? UI.C.surface : 0x10151c, stroke: isNext ? UI.C.amber : UI.C.lineSoft,
      strokeAlpha: isNext ? 0.8 : 1, radius: 14, glow: isNext ? UI.C.amber : undefined
    });
    items.push(panel);

    const badge = this.add.graphics();
    badge.fillStyle(colour, unlocked ? 0.16 : 0.5); badge.fillRoundedRect(bx - 20, cy - 20, 40, 40, 10);
    items.push(badge);
    if (done)            items.push(UI.icon(this, bx, cy, 'check', 16, UI.C.green));
    else if (!unlocked)  items.push(UI.icon(this, bx, cy, 'lock', 15, 0x465163));
    else                 items.push(UI.text(this, bx, cy, String(level.id), 'number', { size: 20, origin: 0.5, color: UI.T.amber }));

    items.push(titleT, descT, metaT);
    if (isNext) items.push(UI.text(this, width - 16 - 16, top + 16, 'NEXT', 'tag', { size: 10, origin: [1, 0] }));
    if (unlocked) items.push(UI.icon(this, width - 16 - 22, cy + 6, 'chevron', 13, 0x6f7b8d));

    if (unlocked) {
      const zone = this.add.zone(width / 2, cy, w, h).setInteractive();
      let pressed = false;
      zone.on('pointerdown', () => { pressed = true; });
      zone.on('pointerout',  () => { pressed = false; });
      zone.on('pointerup',   () => { if (pressed && !this._dragging) this.showBriefing(level); pressed = false; });
      items.push(zone);
    }
    this.contentContainer.add(items);
    return top + h;
  }

  // ── Mission briefing ───────────────────────────────────────────────────
  // Shows who is coming and what you're bringing, so the player can make an
  // informed choice — and can't launch into a fight with zero towers.
  showBriefing(level) {
    const stock = this.saveData.stockpile || {};
    const total = this.stockTotal();
    const counts = {};
    (level.waves || []).forEach(wv => wv.enemies.forEach(g => { counts[g.type] = (counts[g.type] || 0) + g.count; }));
    const enemyLines = Object.entries(counts).map(([t, n]) => n + ' × ' + this.titleCase(ENEMY_DATA[t] ? ENEMY_DATA[t].name : t)).join('\n');
    const towers = ['gunner', 'bomber', 'barricade'].filter(t => stock[t] > 0)
      .map(t => stock[t] + ' ' + this.titleCase(TOWER_DATA[t].name)).join(',  ') || 'none';
    const rec = level.recommendedTowers;

    let body = 'Incoming:\n' + enemyLines + '\n\nYour towers: ' + towers;
    if (rec && total < rec) body += '\n\nRecommended: at least ' + rec + ' towers.';

    const buttons = total > 0
      ? [{ label: 'CANCEL', variant: 'secondary' }, { label: 'LAUNCH', variant: 'primary', colour: UI.C.red, onTap: () => this.launch(level, false) }]
      : [{ label: 'CANCEL', variant: 'secondary' }, { label: 'BUILD TOWERS', variant: 'primary', colour: UI.C.blue, onTap: () => UI.go(this, 'FactoryScene') }];
    if (total === 0) body += '\n\nYou have no towers. Build some in the Factory first.';

    UI.modal(this, {
      title: 'Level ' + level.id + ' — ' + this.titleCase(level.name),
      body, icon: 'anchor', accent: total > 0 ? UI.C.red : UI.C.blue,
      buttons, dismissOnBackdrop: true
    });
  }

  launch(level, endless) {
    if (endless) {
      const ids = this.completedS1();
      if (ids.length === 0) return;
      const base = LEVEL_DATA.storylines[0].levels.find(l => l.id === ids[Math.floor(Math.random() * ids.length)]);
      if (!base) return;
      const data = Object.assign({}, base, {
        name: base.name + '  —  ENDLESS', baseHp: 10, tutorial: null, waves: this.buildEndlessWaves(6)
      });
      UI.go(this, 'CombatScene', { storylineId: 1, levelId: base.id, levelData: data, isEndless: true });
      return;
    }
    UI.go(this, 'CombatScene', { storylineId: 1, levelId: level.id, levelData: level });
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
}
