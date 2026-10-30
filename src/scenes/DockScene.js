class DockScene extends Phaser.Scene {
  constructor() {
    super({ key: 'DockScene' });
  }

  create() {
    this.saveData = applyTestStock() || SaveManager.load() || {};
    this.chartBg = null; this.contentContainer = null;   // scene objects are reused between visits
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


  titleCase(str) { return UI.titleCase(str); }

  clearContent() {
    if (this.contentContainer) { this.contentContainer.destroy(true); this.contentContainer = null; }
    if (this.chartBg) { this.chartBg.forEach(o => o.destroy()); this.chartBg = null; }
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
  // One card per storyline. Stories open as the story progresses; within a
  // story, levels unlock in order plus any cross-story requirements.
  showCampaignSelect() {
    this.clearContent();
    this.currentView = 'campaigns';
    this.hdr.title.setText('DOCK');
    this.hdr.sub.setText('CHOOSE A MISSION');
    this.contentContainer = this.add.container(0, 0).setDepth(5);
    const { height } = this.scale;
    const colours = { 1: UI.C.amber, 2: UI.C.green, 3: UI.C.purple, 4: UI.C.red };
    let y = UI.HEADER_H + 18;
    LEVEL_DATA.storylines.forEach(st => {
      const open = Progress.storylineOpen(this.saveData, st.id);
      const built = st.levels.filter(l => !l.soon);
      const doneN = st.levels.filter(l => Progress.done(this.saveData, Progress.key(st.id, l.id))).length;
      const gate = (STORYLINE_GATES[st.id] || [])[0];
      y = this.addCampaignCard(y, {
        tag: st.short.toUpperCase() + '  \u00b7  ' + st.levels.length + ' LEVELS', title: st.title, colour: colours[st.id] || UI.C.amber,
        body: open ? st.description + '  Enemy: ' + st.faction + '.' : 'Opens after ' + Progress.levelName(gate) + '.',
        progress: doneN / st.levels.length,
        progressLabel: open ? doneN + ' / ' + st.levels.length + ' cleared' + (built.length < st.levels.length ? '  \u00b7  ' + (st.levels.length - built.length) + ' coming soon' : '') : null,
        unlocked: open, onTap: () => this.showLevelList(st)
      }) + 12;
    });
    const anyDone = this.endlessPool().length > 0;
    y = this.addCampaignCard(y, {
      tag: 'ENDLESS', title: 'Endless Raids', colour: UI.C.blue,
      body: anyDone ? 'Waves keep coming on a map you have cleared. Power zones change every run. How long can you hold?'
                    : 'Clear a defence level to unlock.',
      unlocked: anyDone, onTap: anyDone ? () => this.launch(null, true) : null
    }) + 12;
    this.scrollMinY = Math.min(0, height - (y + 20));
    this.enableScroll();
  }

  endlessPool() {
    let pool = [];
    LEVEL_DATA.storylines.forEach(st => st.levels.forEach(l => {
      if (l.soon || l.type === 'raid' || !l.waves) return;
      if (Progress.done(this.saveData, Progress.key(st.id, l.id)) || (isTestSave(this.saveData) && BUILD.allLevels)) pool.push(l);
    }));
    return pool;
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
      zone.on('pointerup',   () => { panel.setAlpha(1); if (pressed && c.onTap && !UI.blocked(this)) c.onTap(); pressed = false; });
      items.push(zone);
    } else {
      items.push(UI.icon(this, width - 16 - 24, top + h / 2, 'lock', 15, 0x465163));
    }
    this.contentContainer.add(items);
    return top + h;
  }

  // ── Level list ─────────────────────────────────────────────────────────
  // A sea chart: each mission is an island on a dotted voyage route, from the
  // top down. Tap one for its briefing.
  showLevelList(storyline) {
    this.clearContent();
    this.currentView = 'levels';
    const { width, height } = this.scale;
    this.hdr.title.setText(storyline.title.toUpperCase());
    this.hdr.sub.setText(storyline.short.toUpperCase() + '  \u00b7  VS ' + storyline.faction.toUpperCase());
    Art.ensure(this);
    const T = Art.theme(storyline.id), R = Art.RES;
    // Sea behind the chart (stays put while the chart scrolls)
    const top = UI.HEADER_H;
    const sea = this.add.graphics().setDepth(1);
    sea.fillStyle(T.waterDeep, 1); sea.fillRect(0, top, width, height - top);
    const waves = this.add.tileSprite(width / 2, top + (height - top) / 2, width * R, (height - top) * R, 'water').setScale(1 / R)
      .setTint(T.glint).setAlpha(0.18).setDepth(1);
    this.chartBg = [sea, waves];
    this.contentContainer = this.add.container(0, 0).setDepth(5);

    const gap = 92, y0 = top + 64;
    const nodes = storyline.levels.map((level, i) => {
      const isDone = Progress.done(this.saveData, Progress.key(storyline.id, level.id));
      const lock = Progress.levelLock(this.saveData, storyline.id, level);
      return { level, isDone, lock, x: i % 2 ? width - 92 : 92, y: y0 + i * gap };
    });
    const next = nodes.find(n => !n.lock && !n.isDone);

    // Route: solid where you've sailed, dotted ahead
    const route = this.add.graphics();
    for (let i = 0; i < nodes.length - 1; i++) {
      const a = nodes[i], b = nodes[i + 1], sailed = a.isDone && b.isDone;
      const len = Math.hypot(b.x - a.x, b.y - a.y), steps = Math.floor(len / 10);
      for (let k = 0; k < steps; k++) {
        if (!sailed && k % 2) continue;
        const t0 = k / steps, t1 = (k + (sailed ? 1 : 0.6)) / steps;
        route.lineStyle(sailed ? 3 : 2, sailed ? T.glint : 0x8b9bb0, sailed ? 0.8 : 0.45);
        route.lineBetween(a.x + (b.x - a.x) * t0, a.y + (b.y - a.y) * t0, a.x + (b.x - a.x) * t1, a.y + (b.y - a.y) * t1);
      }
    }
    this.contentContainer.add(route);
    nodes.forEach(n => this.addChartNode(storyline, n, n === next, T));
    const endY = y0 + (nodes.length - 1) * gap + 70;
    this.scrollMinY = Math.min(0, height - (endY + 20));
    this.enableScroll();
  }

  addChartNode(storyline, n, isNext, T) {
    const { width } = this.scale;
    const { level, isDone, lock, x, y } = n;
    const unlocked = !lock, raid = level.type === 'raid';
    const items = [];
    // The island: a round patch of raft with a rim
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.35); g.fillCircle(x + 2, y + 4, 27);
    g.fillStyle(unlocked ? T.deck : 0x1a1f27, 1); g.fillCircle(x, y, 26);
    g.lineStyle(3, isDone ? UI.C.green : raid && unlocked ? UI.C.red : unlocked ? UI.C.amber : 0x3a4452, unlocked ? 1 : 0.8);
    g.strokeCircle(x, y, 26);
    if (level.boss && unlocked) { g.lineStyle(2, UI.C.red, 0.7); g.strokeCircle(x, y, 32); }
    items.push(g);
    if (isDone)        items.push(UI.icon(this, x, y, 'check', 18, UI.C.green));
    else if (!unlocked) items.push(UI.icon(this, x, y, 'lock', 16, 0x6f7b8d));
    else if (raid)     items.push(UI.icon(this, x, y, 'anchor', 18, UI.C.red));
    else if (level.boss) items.push(UI.icon(this, x, y, 'star', 18, UI.C.red));
    else               items.push(UI.text(this, x, y, String(level.id), 'number', { size: 20, origin: 0.5, color: UI.T.amber }));
    if (isNext) {
      const ring = this.add.circle(x, y, 30, UI.C.amber, 0).setStrokeStyle(3, UI.C.amber, 0.9);
      this.tweens.add({ targets: ring, scale: 1.35, alpha: 0, duration: 1200, repeat: -1 });
      items.push(ring);
    }

    // Label on the open side of the island
    const right = x < width / 2, lx = right ? x + 40 : x - 40, wrap = width - 92 - 40 - 24;
    const raidTxt = raid ? 'RAID  \u00b7  ' + (level.turrets || []).length + ' turrets' : null;
    const waves = level.waves ? level.waves.length : 0;
    const meta = level.soon ? 'COMING SOON' : !unlocked ? lock.toUpperCase() : isDone ? 'CLEARED' : raidTxt
      || (waves + ' waves' + (level.boss ? '  \u00b7  BOSS' : '') + (level.recommendedTowers ? '  \u00b7  ' + level.recommendedTowers + ' towers' : ''));
    const name = UI.text(this, lx, y - 10, this.titleCase(level.name), 'heading', { size: 16, origin: [right ? 0 : 1, 0.5], color: unlocked ? UI.T.text : UI.T.faint });
    const metaT = UI.text(this, lx, y + 12, meta, 'label', { size: 10, origin: [right ? 0 : 1, 0.5], wrap, align: right ? 'left' : 'right',
      color: !unlocked ? UI.T.faint : isDone ? UI.T.green : raid ? UI.T.red : UI.T.dim });
    items.push(name, metaT);
    if (isNext) items.push(UI.text(this, lx + (right ? name.width + 8 : -name.width - 8), y - 10, 'NEXT', 'tag', { size: 10, origin: [right ? 0 : 1, 0.5], color: UI.T.amber }));

    if (unlocked) {
      const zx = right ? x - 30 : lx - Math.max(name.width, metaT.width), zw = 30 + 40 + Math.max(name.width, metaT.width) + 10;
      const zone = this.add.zone(zx + zw / 2 - (right ? 0 : 0), y, zw, 70).setInteractive();
      let pressed = false;
      zone.on('pointerdown', () => { pressed = true; });
      zone.on('pointerout',  () => { pressed = false; });
      zone.on('pointerup',   () => { if (pressed && !this._dragging && !UI.blocked(this)) this.showBriefing(storyline, level); pressed = false; });
      items.push(zone);
    }
    this.contentContainer.add(items);
  }

  // ── Mission briefing ───────────────────────────────────────────────────
  // Shows who is coming and what you're bringing, so the player can make an
  // informed choice — and can't launch into a fight with zero towers.
  showBriefing(storyline, level) {
    if (level.type === 'raid') return this.showRaidBriefing(storyline, level);
    const stock = this.saveData.stockpile || {};
    const total = this.stockTotal();
    const counts = {};
    (level.waves || []).forEach(wv => wv.enemies.forEach(g => { counts[g.type] = (counts[g.type] || 0) + g.count; }));
    const enemyLines = Object.entries(counts).map(([t, n]) => n + ' × ' + this.titleCase(ENEMY_DATA[t] ? ENEMY_DATA[t].name : t)).join('\n');
    const towers = TOWER_ORDER.filter(t => stock[t] > 0)
      .map(t => stock[t] + ' ' + this.titleCase(TOWER_DATA[t].name)).join(',  ') || 'none';
    const rec = level.recommendedTowers;

    let body = 'Incoming:\n' + enemyLines + '\n\nYour towers: ' + towers;
    if (rec) body += '\n\nRecommended: ' + rec + ' towers' + (total < rec ? ' \u2014 you have ' + total + '.' : '.');

    const buttons = total > 0
      ? [{ label: 'CANCEL', variant: 'secondary' }, { label: 'LAUNCH', variant: 'primary', colour: UI.C.red, onTap: () => this.launch(level, false, storyline) }]
      : [{ label: 'CANCEL', variant: 'secondary' }, { label: 'BUILD TOWERS', variant: 'primary', colour: UI.C.blue, onTap: () => UI.go(this, 'FactoryScene') }];
    if (total === 0) body += '\n\nYou have no towers. Build some in the Factory first.';

    UI.modal(this, {
      title: (storyline.id === 1 ? 'Level ' : storyline.short + '.') + level.id + ' — ' + this.titleCase(level.name),
      body, icon: 'anchor', accent: total > 0 ? UI.C.red : UI.C.blue,
      buttons, dismissOnBackdrop: true
    });
  }

  showRaidBriefing(storyline, level) {
    const stock = this.saveData.stockpile || {};
    const total = this.stockTotal();
    const kinds = {};
    (level.turrets || []).forEach(t => { kinds[t.kind] = (kinds[t.kind] || 0) + 1; });
    const towers = TOWER_ORDER.filter(t => stock[t] > 0)
      .map(t => stock[t] + ' ' + this.titleCase(TOWER_DATA[t].name)).join(',  ') || 'none';
    const loot = level.loot ? '+' + (level.loot.plasticScrap || 0) + ' scrap, +' + (level.loot.salvagedMetal || 0) + ' metal' : '';
    const body = 'An attack. Your towers ride out on carts along the road \u2014 they fire as they go. Wreck the core at the end.\n\n' +
      'Defences: ' + Object.entries(kinds).map(([k, n]) => n + ' ' + (RAID_TURRETS[k] || {}).name + (n === 1 ? '' : 's')).join(', ') + '\n' +
      'Loot: ' + loot + '\nYour towers: ' + towers + '\n\nTowers that get wrecked are lost. The rest come home.';
    UI.modal(this, {
      title: 'Raid \u2014 ' + this.titleCase(level.name), body, icon: 'anchor', accent: UI.C.red,
      buttons: total > 0 ? [{ label: 'CANCEL', variant: 'secondary' }, { label: 'RAID', variant: 'primary', colour: UI.C.red, onTap: () => this.launch(level, false, storyline) }]
                         : [{ label: 'CANCEL', variant: 'secondary' }, { label: 'BUILD TOWERS', variant: 'primary', colour: UI.C.blue, onTap: () => UI.go(this, 'FactoryScene') }],
      dismissOnBackdrop: true
    });
  }

  launch(level, endless, storyline) {
    if (endless) {
      const pool = this.endlessPool();
      if (!pool.length) return;
      const base = pool[Math.floor(Math.random() * pool.length)];
      const sid = LEVEL_DATA.storylines.find(st => st.levels.includes(base)).id;
      const data = Object.assign({}, base, {
        name: base.name + '  —  ENDLESS', baseHp: 10, tutorial: null, waves: this.buildEndlessWaves(6)
      });
      UI.go(this, 'CombatScene', { storylineId: sid, levelId: base.id, levelData: data, isEndless: true });
      return;
    }
    const sid = (storyline && storyline.id) || 1;
    const scene = level.type === 'raid' ? 'RaidScene' : 'CombatScene';
    const go = () => UI.go(this, scene, { storylineId: sid, levelId: level.id, levelData: level });
    // The story scene leading into this level (once)
    const bkey = Progress.key(sid, level.id) + '.before';
    if (Story.has(bkey)) Story.play(this, bkey, go); else go();
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
