// ── FactoryScene.js ───────────────────────────────────────────────────────────
// Factory floor. Workers carry materials between stations to produce towers:
//   store → (smelter) → assembly bench → depository → Armoury stockpile.
// Conveyors (Milestone 3/4) can carry items between belts and into benches.
//
// First visit runs a spotlight tutorial (see Coach.js) that walks the player
// through building their first towers and explains why each step matters.

class FactoryScene extends Phaser.Scene {
constructor() { super({ key: 'FactoryScene' }); }

// ── Automation foundation (Milestone 1) ─────────────────────────────
// Single source of truth for "should the factory be ticking right now?"
// Today this is just a read of saveData.factoryActive (set by CombatScene).
// Later milestones will OR in skill-tree perks like "Factory During Waves".
shouldFactoryRun() {
  if (!this.saveData) return true;
  return this.saveData.factoryActive !== false;   // default true for legacy saves
}

create() {
  const width = this.scale.width;
  this.H = this.scale.height;
  const height = this.H;

  this.saveData = SaveManager.load();

  this._workerWalkTweens = {};
  this._lastFactoryRun   = this.shouldFactoryRun();

  // ── Dev resource floor (Milestone 3 — testing aid) ──────────────────
  // Plentiful materials on every visit so belts/machines can be iterated on
  // without farming combat. Revisit when balancing — production play should
  // make players earn materials.
  const DEV_FLOOR = { plasticScrap: 50, salvagedMetal: 50 };
  if (!this.saveData.materials) this.saveData.materials = { plasticScrap: 0, refinedPlastic: 0, salvagedMetal: 0 };
  let toppedUp = false;
  ['plasticScrap', 'salvagedMetal'].forEach(k => {
    if ((this.saveData.materials[k] || 0) < DEV_FLOOR[k]) { this.saveData.materials[k] = DEV_FLOOR[k]; toppedUp = true; }
  });
  if (toppedUp) SaveManager.update(s => { s.materials = Object.assign(s.materials || {}, this.saveData.materials); });

  // ── Build costs (consumed when placing a machine on a tile) ──────────
  // Everything available before Salvaged Metal costs scrap only
  this.MACHINE_BUILD_COSTS = {
    smelter:            { plasticScrap: 2, salvagedMetal: 2 },
    assembly_gunner:    { plasticScrap: 2 },
    assembly_bomber:    { plasticScrap: 2, salvagedMetal: 2 },
    assembly_barricade: { plasticScrap: 1, salvagedMetal: 2 },
    assembly_gunner2:   { plasticScrap: 2, salvagedMetal: 3 },
    assembly_siphon:    { plasticScrap: 3, salvagedMetal: 3 },
    conveyor:           { plasticScrap: 1 }
  };

  this.factory = new Factory();
  this.factory.loadFromSave(this.saveData);

  // ── Skill tree (M7): speeds + floor size from purchased upgrades ─────
  skillTreeEffects.rebuildFromSaveData(this.saveData);
  this.factory.applySkillEffects(skillTreeEffects);

  // ── Layout ───────────────────────────────────────────────────────────
  // The floor grows with Grid Plus upgrades (up to 5x5); tiles shrink to fit.
  this.COLS    = this.factory.COLS;
  this.ROWS    = this.factory.ROWS;
  const gridSpace = (height - 16 - 88 - 12) - (UI.HEADER_H + 14 + 66 + 16) - (14 + 52 + 44);
  this.TILE    = Math.min(88, Math.floor((width - 56) / this.COLS), Math.floor(gridSpace / this.ROWS));
  this.TS      = this.TILE / 88;     // text scale for machine labels
  this.GX      = (width - this.TILE * this.COLS) / 2;
  this.STORE_H = 66;
  this.STORE_Y = UI.HEADER_H + 14 + this.STORE_H / 2;
  // Salvaged Metal appears later in the story. Until then the scrap store
  // fills the whole pick-up strip; afterwards the two share it.
  this.metalUnlocked = this.isMetalUnlocked();
  this.factory.metalUnlocked = this.metalUnlocked;
  this.beltsUnlocked   = Progress.has(this.saveData, 'belts');
  this.smelterUnlocked = Progress.has(this.saveData, 'smelter');
  this.STORE_W = (width - 32 - 10) / 2;
  this.SCRAP_W = this.metalUnlocked ? this.STORE_W : width - 32;
  this.SCRAP_X = 16 + this.SCRAP_W / 2;
  this.METAL_X = width - 16 - this.STORE_W / 2;
  this.GY      = this.STORE_Y + this.STORE_H / 2 + 16;
  this.DEPOT_H = 52;
  this.DEPOT_Y = this.GY + this.ROWS * this.TILE + 14 + this.DEPOT_H / 2;
  this.LF_W    = 112;                                  // Lost & Found sits beside the Depository
  this.DEPOT_W = width - 32 - 8 - this.LF_W;
  this.DEPOT_X = 16 + this.DEPOT_W / 2;
  this.LF_X    = width - 16 - this.LF_W / 2;
  this.STATUS_Y = this.DEPOT_Y + this.DEPOT_H / 2 + 30;
  this.TOOL_H  = 88;
  this.TOOL_Y  = height - 16 - this.TOOL_H / 2;
  this.WORKER_SPEED = 80 * skillTreeEffects.getWorkerSpeed();

  this.placingMachine     = null;
  this.deleteMode         = false;
  this.progressBars       = {};
  this.machineSprites     = {};
  this.machineStatusTexts = {};
  this.workerSprites      = {};
  this.workerLabels       = {};
  this.workerMenuActive   = false;
  this._asmMenuOpen       = false;
  this._asmGunnerRect     = null;
  this._itemSprites       = {};
  // Phaser reuses the scene object between visits, so every per-visit flag
  // must be reset here or it leaks in from the previous visit.
  this.tutorialActive     = false;
  this._introDone         = false;
  this.routeGfx           = null;
  this._workerMenu        = null;
  this._routeSig          = null;
  this._statusSig         = null;
  this._matSig            = null;
  this._autosaveAcc       = 0;

  this.unlockedAssemblyTypes = this.getUnlockedAssemblyTypes();

  UI.backdrop(this);
  UI.fadeIn(this);
  this.hdr = UI.header(this, {
    title: 'FACTORY', sub: 'BUILD YOUR TOWERS', accent: UI.C.blue,
    onBack: () => this.leave('BaseScene'),
    chips: [{ kind: 'towers', value: this.stockTotal() }]
  });

  this.drawFixedStations();
  this.drawGrid();
  this.drawMachines();
  this.drawWorkers();
  this.drawToolbar();
  this.drawStatusBar();

  this.catchUpAway();

  this.coach = new Coach(this);
  this.events.once('shutdown', () => this.coach.destroy());

  if (!this.factory.tutorialComplete) {
    this.tutorialActive = true;
  } else {
    this.checkWorker2Recruitment();
    this.checkNewTowerTutorials();
  }
}

// ── Partial Auto / Full Automation (M7) ──────────────────────────────────
// Fast-forward the factory for the time since it was last saved, if the
// skill tree lets it run while you're away (up to 30 minutes).
catchUpAway() {
  const level = skillTreeEffects.getAutomationLevel();
  const last  = this.saveData.factory && this.saveData.factory.lastRun;
  if (level < 1 || !last || !this.factory.tutorialComplete) return;
  const away = Math.min(Date.now() - last, 30 * 60 * 1000);
  if (away < 5000) return;
  const before = { scrap: this.factory.materials.plasticScrap, metal: this.factory.materials.salvagedMetal };
  this.factory.catchUp(away, level >= 2);
  const towers = this.factory.takeDeliveries();
  towers.forEach(t => this.addTowerToStockpile(t, true));
  this.factory.save();
  this.drawMachines();
  this.updateStatus();
  this.updateMaterialDisplay();
  if (!towers.length) return;
  const mins = Math.max(1, Math.round(away / 60000));
  const used = (before.scrap - this.factory.materials.plasticScrap) + (before.metal - this.factory.materials.salvagedMetal);
  const byType = {};
  towers.forEach(t => { byType[t] = (byType[t] || 0) + 1; });
  const list = Object.entries(byType).map(([t, n]) => n + ' ' + t.charAt(0).toUpperCase() + t.slice(1) + (n === 1 ? '' : 's')).join(', ');
  this.time.delayedCall(300, () => UI.modal(this, {
    title: 'While you were away', icon: 'factory', accent: UI.C.green,
    body: 'The factory kept running for ' + mins + ' minute' + (mins === 1 ? '' : 's') + ' and built ' + list + ' (' + used + ' materials used). They\u2019re in the Armoury.',
    buttons: [{ label: 'NICE', variant: 'primary', colour: UI.C.green }]
  }));
}

leave(sceneKey) {
  this.factory.save();
  UI.go(this, sceneKey);
}

stockTotal() {
  return Object.values((this.saveData && this.saveData.stockpile) || {}).reduce((a, b) => a + b, 0);
}

// ── Per-tower unlock cards ─────────────────────────────────────────────────
// One-time explanation for each newly unlocked tower type.
checkNewTowerTutorials() {
  if (!this.saveData.flags) this.saveData.flags = {};
  if (!this.saveData.flags.towerTutorialsSeen) this.saveData.flags.towerTutorialsSeen = {};
  const seen = this.saveData.flags.towerTutorialsSeen;
  // One card per visit; the next one shows on the following visit
  const next = ['barricade', 'bomber', 'gunner2', 'siphon'].find(t => this.unlockedAssemblyTypes.includes('assembly_' + t) && !seen[t]);
  if (next) this.time.delayedCall(350, () => this.showTowerUnlockBanner(next));
}

showTowerUnlockBanner(towerType) {
  const cfg = {
    barricade: { colour: UI.C.red, title: 'Barricade unlocked',
      body: 'Barricades slow every raider in their field. They need 1 Salvaged Metal each — no smelter required, the bench takes metal directly.' },
    gunner2: { colour: 0x2fb6d6, title: 'Gunner Mk II unlocked',
      body: 'SALV tech: heavier rounds and longer reach. Mk II benches take 1 Salvaged Metal per tower.' },
    siphon: { colour: UI.C.purple, title: 'Siphon unlocked',
      body: 'Borga\u2019s beam drains raiders, and anything that dies in it drops double salvage straight into your Parts. Siphon benches take Refined Plastic from a Smelter.' },
    bomber: { colour: UI.C.amber, title: 'Bomber unlocked',
      body: 'Bombers hit everything in a blast. They need Refined Plastic: build a Smelter, smelt Plastic Scrap, then load the refined plastic into a Bomber bench.' }
  }[towerType];
  if (!cfg) return;
  UI.modal(this, {
    title: cfg.title, body: cfg.body, icon: 'star', accent: cfg.colour,
    buttons: [{ label: 'GOT IT', variant: 'primary', colour: cfg.colour, onTap: () => {
      this.saveData.flags.towerTutorialsSeen[towerType] = true;
      // Write only the flag into the latest save — this.saveData is a create()-time snapshot
      SaveManager.update(latest => {
        if (!latest.flags) latest.flags = {};
        if (!latest.flags.towerTutorialsSeen) latest.flags.towerTutorialsSeen = {};
        latest.flags.towerTutorialsSeen[towerType] = true;
      });
      const more = ['barricade', 'bomber', 'gunner2', 'siphon'].find(t => this.unlockedAssemblyTypes.includes('assembly_' + t) && !this.saveData.flags.towerTutorialsSeen[t]);
      if (more) this.time.delayedCall(250, () => this.showTowerUnlockBanner(more));
    } }]
  });
}

isMetalUnlocked() { return Progress.has(this.saveData, 'metal'); }

getUnlockedAssemblyTypes() {
  const types = ['assembly_gunner'];
  if (Progress.has(this.saveData, 'bomber'))    types.push('assembly_bomber');
  if (Progress.has(this.saveData, 'barricade')) types.push('assembly_barricade');
  if (Progress.has(this.saveData, 'gunner2'))   types.push('assembly_gunner2');
  if (Progress.has(this.saveData, 'siphon'))    types.push('assembly_siphon');
  return types;
}

checkWorker2Recruitment() {
  const w2 = this.factory.workers[1];
  if (w2.unlocked && !this.factory.worker2Introduced && this.factory.tutorialComplete) {
    this.factory.worker2Introduced = true;
    this.factory.save();
    UI.modal(this, {
      title: 'A new recruit arrives', icon: 'star', accent: UI.C.blue,
      body: 'Word of your victory spread. W2 has joined the factory — with two workers you can run two jobs at once. When you tap a station you’ll choose who goes.',
      buttons: [{ label: 'WELCOME THEM', variant: 'primary', colour: UI.C.blue }]
    });
  }
}

// ── Fixed stations ─────────────────────────────────────────────────────────
drawFixedStations() {
  const { width } = this.scale;
  const mkStore = (key, x, name, colour, icon, w) => {
    const y = this.STORE_Y, h = this.STORE_H;
    const panel = UI.panel(this, x, y, w, h, { fill: UI.C.surface, stroke: colour, strokeAlpha: 0.55, radius: 14 });
    const lx = x - w / 2 + 14;
    const disc = this.add.graphics();
    disc.fillStyle(colour, 0.16); disc.fillCircle(lx + 14, y, 16);
    UI.icon(this, lx + 14, y, icon, 14, colour);
    UI.text(this, lx + 38, y - 12, name, 'label', { size: 10.5, origin: [0, 0.5], color: UI.hex(colour) });
    const count = UI.text(this, lx + 38, y + 10, '0', 'number', { size: 22, origin: [0, 0.5] });
    const zone = this.add.zone(x, y, w, h).setInteractive();
    zone.on('pointerdown', () => panel.setAlpha(0.75));
    zone.on('pointerout',  () => panel.setAlpha(1));
    zone.on('pointerup',   () => { panel.setAlpha(1); this.stationTapped(key); });
    this.progressBars[key] = this.add.rectangle(x - w / 2 + 10, y + h / 2 - 6, 1, 4, colour).setOrigin(0, 0.5).setAlpha(0);
    this.progressBars[key]._maxW = w - 20;
    return count;
  };
  this.scrapCountTxt = mkStore('store_scrap', this.SCRAP_X, 'PLASTIC SCRAP', UI.C.blue, 'scrap', this.SCRAP_W);
  this.metalCountTxt = this.metalUnlocked ? mkStore('store_metal', this.METAL_X, 'SALVAGED METAL', UI.C.green, 'metal', this.STORE_W) : null;

  // Depository
  const dw = this.DEPOT_W, dy = this.DEPOT_Y, dx = this.DEPOT_X;
  const dPanel = UI.panel(this, dx, dy, dw, this.DEPOT_H, { fill: UI.C.surface, stroke: UI.C.red, strokeAlpha: 0.55, radius: 14 });
  UI.icon(this, 16 + 24, dy, 'shield', 16, UI.C.red);
  UI.text(this, 16 + 42, dy - 9, 'DEPOSITORY', 'label', { size: 11, origin: [0, 0.5], color: UI.T.red });
  UI.text(this, 16 + 42, dy + 9, 'Towers go to the Armoury', 'small', { size: 11.5, origin: [0, 0.5] });
  const dz = this.add.zone(dx, dy, dw, this.DEPOT_H).setInteractive();
  dz.on('pointerdown', () => dPanel.setAlpha(0.75));
  dz.on('pointerout',  () => dPanel.setAlpha(1));
  dz.on('pointerup',   () => { dPanel.setAlpha(1); this.stationTapped('depository'); });
  this.progressBars['depository'] = this.add.rectangle(16 + 10, dy + this.DEPOT_H / 2 - 6, 1, 4, UI.C.red).setOrigin(0, 0.5).setAlpha(0);
  this.progressBars['depository']._maxW = dw - 20;

  // Lost & Found: holds the last item a worker put down to take a new job
  const lx = this.LF_X, lw = this.LF_W;
  this.lfPanel = UI.panel(this, lx, dy, lw, this.DEPOT_H, { fill: UI.C.surface, stroke: UI.C.steel, strokeAlpha: 0.4, radius: 14 });
  UI.text(this, lx - lw / 2 + 12, dy - 10, 'LOST & FOUND', 'label', { size: 9.5, origin: [0, 0.5], color: UI.T.dim, ls: 1 });
  this.lfDot  = this.add.circle(lx - lw / 2 + 19, dy + 10, 6, 0xffffff).setVisible(false);
  this.lfText = UI.text(this, lx - lw / 2 + 12, dy + 10, 'empty', 'small', { size: 11.5, origin: [0, 0.5], color: UI.T.faint });
  const lz = this.add.zone(lx, dy, lw, this.DEPOT_H).setInteractive();
  lz.on('pointerdown', () => this.lfPanel.setAlpha(0.75));
  lz.on('pointerout',  () => this.lfPanel.setAlpha(1));
  lz.on('pointerup',   () => { this.lfPanel.setAlpha(1); this.stationTapped('lostfound'); });
  this.progressBars['lostfound'] = this.add.rectangle(lx - lw / 2 + 10, dy + this.DEPOT_H / 2 - 6, 1, 4, UI.C.steel).setOrigin(0, 0.5).setAlpha(0);
  this.progressBars['lostfound']._maxW = lw - 20;
  this._lfSig = undefined;
  this.updateLostFound();

  this.updateMaterialDisplay();
}

updateLostFound() {
  if (!this.lfText) return;
  const item = this.factory.lostFound;
  this._lfSig = item;
  const colours = { plasticScrap: UI.C.blue, salvagedMetal: UI.C.green, refinedPlastic: UI.C.amber };
  this.lfDot.setVisible(!!item).setFillStyle(colours[item] || 0xffffff);
  this.lfText.setText(item ? this.itemName(item) : 'empty').setX(this.LF_X - this.LF_W / 2 + (item ? 30 : 12)).setColor(item ? UI.T.text : UI.T.faint);
}

updateMaterialDisplay() {
  const scrap = this.factory.getMaterialCount('plasticScrap');
  const metal = this.factory.getMaterialCount('salvagedMetal');
  if (this.scrapCountTxt) this.scrapCountTxt.setText('' + scrap).setColor(scrap > 0 ? UI.T.text : UI.T.faint);
  if (this.metalCountTxt) this.metalCountTxt.setText('' + metal).setColor(metal > 0 ? UI.T.text : UI.T.faint);
}

// ── Build cost helpers ─────────────────────────────────────────────────────
canAffordBuild(cost) {
  if (!cost) return true;
  return this.factory.getMaterialCount('plasticScrap') >= (cost.plasticScrap || 0)
      && this.factory.getMaterialCount('salvagedMetal') >= (cost.salvagedMetal || 0);
}

// Deducts a build cost from the live Factory's materials, then saves.
// (Never factory.loadFromSave() here — that would reset the grid and wipe
// the machine that was just placed.)
spendBuildCost(cost) {
  if (!cost) return;
  Object.entries(cost).forEach(([k, v]) => {
    this.factory.materials[k] = Math.max(0, (this.factory.materials[k] || 0) - v);
  });
  this.factory.save();
  Object.assign(this.saveData.materials, this.factory.materials);
  this.updateMaterialDisplay();
}

// Returns materials to stock (used when deleting a machine).
refundBuildCost(cost) {
  if (!cost) return;
  Object.entries(cost).forEach(([k, v]) => {
    this.factory.materials[k] = (this.factory.materials[k] || 0) + v;
  });
  this.factory.save();
  Object.assign(this.saveData.materials, this.factory.materials);
  this.updateMaterialDisplay();
}

formatCost(cost) {
  if (!cost) return '';
  const parts = [];
  if (cost.plasticScrap)  parts.push(cost.plasticScrap  + ' scrap');
  if (cost.salvagedMetal) parts.push(cost.salvagedMetal + ' metal');
  return parts.join(' + ');
}

// ── Grid ───────────────────────────────────────────────────────────────────
tileCentre(row, col) {
  return { x: this.GX + col * this.TILE + this.TILE / 2, y: this.GY + row * this.TILE + this.TILE / 2 };
}

drawGrid() {
  const g = this.add.graphics();
  // Floor plate
  UI.drawPanel(g, this.GX + this.TILE * this.COLS / 2, this.GY + this.TILE * this.ROWS / 2, this.TILE * this.COLS + 8, this.TILE * this.ROWS + 8,
    { fill: 0x0e131a, stroke: UI.C.lineSoft, radius: 14 });
  this.tileGfx = {};
  for (let row = 0; row < this.ROWS; row++) for (let col = 0; col < this.COLS; col++) {
    const { x, y } = this.tileCentre(row, col);
    const t = this.add.graphics();
    this.tileGfx[row + ',' + col] = t;
    this.drawTile(row, col, false);
    const zone = this.add.zone(x, y, this.TILE - 4, this.TILE - 4).setInteractive();
    zone.on('pointerup',   () => this.tileTapped(row, col));
    zone.on('pointerover', () => { if (this.placingMachine && !this.factory.getMachineAt(row, col)) this.drawTile(row, col, true); });
    zone.on('pointerout',  () => this.drawTile(row, col, false));
  }
  this.drawAutoMarkers();
}

// M6: show where the stores feed belts and where belts deliver. Small
// chevrons in the gaps above / below the grid, so the rules are visible.
drawAutoMarkers() {
  const g = this.add.graphics().setDepth(1);
  const chevron = (x, y, col, a) => {
    g.lineStyle(2, col, a);
    g.beginPath(); g.moveTo(x - 6, y - 3); g.lineTo(x, y + 3); g.lineTo(x + 6, y - 3); g.strokePath();
  };
  const top = this.GY - 8, bottom = this.GY + this.ROWS * this.TILE + 7;
  Object.keys(this.factory.STORE_FEEDS).forEach(key => {
    if (key === 'store_metal' && !this.metalUnlocked) return;
    const f = this.factory.feedTile(key);
    const x = this.tileCentre(f.row, f.col).x;
    chevron(x, top, key === 'store_scrap' ? UI.C.blue : UI.C.green, 0.9);
  });
  for (let c = 0; c < this.COLS; c++) chevron(this.tileCentre(this.ROWS - 1, c).x, bottom, UI.C.red, 0.55);
}

// One-time explanation of what belts do, shown when the first belt is placed
showBeltGuide() {
  if (this.saveData.flags && this.saveData.flags.beltGuideSeen) return;
  if (!this.saveData.flags) this.saveData.flags = {};
  this.saveData.flags.beltGuideSeen = true;
  SaveManager.update(s => { if (!s.flags) s.flags = {}; s.flags.beltGuideSeen = true; });
  UI.modal(this, {
    title: 'How belts work', icon: 'chevron', accent: UI.C.steel,
    body: 'Items move along the arrows. Hold a belt to turn it.\n\n' +
          (this.metalUnlocked ? '• A belt on the top-left tile is fed scrap by the store above it; top-right is fed metal.\n'
                              : '• A belt on the top-left tile is fed scrap by the store above it.\n') +
          '• A belt pointing into a bench or smelter loads it.\n' +
          '• A loaded machine with a belt leading away works by itself and puts its output on that belt.\n' +
          '• A bottom-row belt pointing down delivers towers to the Depository.\n\n' +
          'Chain them and the factory runs with no workers at all.',
    buttons: [{ label: 'GOT IT', variant: 'primary' }]
  });
}

drawTile(row, col, hot) {
  const t = this.tileGfx && this.tileGfx[row + ',' + col];
  if (!t) return;
  const { x, y } = this.tileCentre(row, col);
  const empty = !this.factory.getMachineAt(row, col);
  t.clear();
  t.fillStyle(hot ? 0x1f2b3a : UI.C.surface, 1);
  t.fillRoundedRect(x - this.TILE / 2 + 3, y - this.TILE / 2 + 3, this.TILE - 6, this.TILE - 6, 10);
  if (empty && this.placingMachine) {
    t.lineStyle(1.5, UI.C.amber, hot ? 0.9 : 0.35);
    t.strokeRoundedRect(x - this.TILE / 2 + 3, y - this.TILE / 2 + 3, this.TILE - 6, this.TILE - 6, 10);
  }
}

refreshTiles() {
  for (let r = 0; r < this.ROWS; r++) for (let c = 0; c < this.COLS; c++) this.drawTile(r, c, false);
}

tileTapped(row, col) {
  // Delete mode wins over everything; empty tiles do nothing.
  if (this.deleteMode) {
    if (this.factory.getMachineAt(row, col)) this.confirmDelete(row, col);
    return;
  }

  if (this.placingMachine) {
    if (this.factory.getMachineAt(row, col)) return;
    if (this.placingMachine === 'assembly') { this.showAssemblyTypeMenu(row, col); return; }
    const type = this.placingMachine;
    const cost = this.MACHINE_BUILD_COSTS[type];
    if (cost && !this.canAffordBuild(cost)) {
      this.showMessage('Need ' + this.formatCost(cost) + ' to build a ' + type, 'bad');
      return;
    }
    if (this.factory.placeMachine(row, col, type)) {
      if (cost) this.spendBuildCost(cost);
      this.drawMachineAt(row, col, type);
      this.factory.save();
      this.setPlacing(null);
      if (type === 'conveyor' && !this.tutorialActive) this.showBeltGuide();
    }
    return;
  }

  if (this.factory.getMachineAt(row, col)) this.openWorkerMenu(row + ',' + col);
}

// ── Assembly type picker ───────────────────────────────────────────────────
showAssemblyTypeMenu(targetRow, targetCol) {
  if (this.workerMenuActive) return;
  this.workerMenuActive = true;
  this._asmMenuOpen = true;
  const { width } = this.scale;
  const height = this.H;
  const items = [];
  const D = 120;

  const dim = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7).setInteractive().setDepth(D);
  items.push(dim);
  const types = [
    { key: 'assembly_gunner',    name: 'Gunner',    colour: UI.C.blue,  needs: '1 Plastic Scrap per tower' },
    { key: 'assembly_bomber',    name: 'Bomber',    colour: UI.C.amber, needs: '1 Refined Plastic per tower (smelter)' },
    { key: 'assembly_barricade', name: 'Barricade', colour: UI.C.red,   needs: '1 Salvaged Metal per tower' },
    { key: 'assembly_gunner2',   name: 'Gunner Mk II', colour: 0x2fb6d6, needs: '1 Salvaged Metal per tower' },
    { key: 'assembly_siphon',    name: 'Siphon',    colour: UI.C.purple, needs: '1 Refined Plastic per tower (smelter)' }
  ].filter(t => this.unlockedAssemblyTypes.includes(t.key) || ['assembly_gunner', 'assembly_bomber', 'assembly_barricade'].includes(t.key));
  const rowH = 84, sheetH = 70 + types.length * (rowH + 10) + 70;
  const top = height - sheetH - 12;
  items.push(UI.panel(this, width / 2, top + sheetH / 2, width - 24, sheetH, { fill: UI.C.surface, stroke: UI.C.line, radius: 18, depth: D + 1 }));
  items.push(UI.text(this, 12 + 22, top + 22, 'Which tower will this bench build?', 'heading', { size: 17, depth: D + 2 }));
  items.push(UI.text(this, 12 + 22, top + 46, 'A bench builds one tower type. Building it costs materials.', 'small', { size: 12, depth: D + 2 }));

  const close = () => {
    items.forEach(e => e && e.destroy && e.destroy());
    this.workerMenuActive = false;
    this._asmMenuOpen = false;
    this._asmGunnerRect = null;
  };

  types.forEach((t, i) => {
    const unlocked = this.unlockedAssemblyTypes.includes(t.key);
    const cost     = this.MACHINE_BUILD_COSTS[t.key];
    const afford   = this.canAffordBuild(cost);
    const ok       = unlocked && afford;
    const cy = top + 70 + i * (rowH + 10) + rowH / 2;
    const w = width - 56, lx = 28 + 18;
    const p = UI.panel(this, width / 2, cy, w, rowH, {
      fill: ok ? UI.C.surface2 : 0x10151c, stroke: ok ? t.colour : UI.C.lineSoft, strokeAlpha: ok ? 0.7 : 1,
      accent: unlocked ? t.colour : undefined, radius: 14, depth: D + 2
    });
    items.push(p,
      UI.text(this, lx, cy - 22, t.name, 'heading', { size: 18, origin: [0, 0.5], depth: D + 3, color: unlocked ? UI.T.text : UI.T.faint }),
      UI.text(this, lx, cy + 2, unlocked ? t.needs : 'Unlocks after ' + Progress.levelName(UNLOCKS[t.key.replace('assembly_', '')].at), 'small', { size: 12, origin: [0, 0.5], depth: D + 3, color: unlocked ? UI.T.mute : UI.T.faint }),
      UI.text(this, lx, cy + 24, unlocked ? 'Build: ' + this.formatCost(cost) + (afford ? '' : '  — not enough') : '', 'label',
        { size: 11, origin: [0, 0.5], depth: D + 3, color: afford ? UI.hex(t.colour) : UI.T.red }));
    if (!unlocked) items.push(UI.icon(this, width / 2 + w / 2 - 26, cy, 'lock', 15, 0x465163).setDepth(D + 3));
    if (t.key === 'assembly_gunner') this._asmGunnerRect = { x: width / 2, y: cy, w, h: rowH };
    if (!ok) return;
    items.push(UI.icon(this, width / 2 + w / 2 - 24, cy, 'chevron', 13, t.colour).setDepth(D + 3));
    const z = this.add.zone(width / 2, cy, w, rowH).setInteractive().setDepth(D + 4);
    items.push(z);
    z.on('pointerup', () => {
      close();
      this.setPlacing(null);
      if (!this.canAffordBuild(cost)) { this.showMessage('Need ' + this.formatCost(cost) + ' to build', 'bad'); return; }
      if (this.factory.placeMachine(targetRow, targetCol, t.key)) {
        this.spendBuildCost(cost);
        this.drawMachineAt(targetRow, targetCol, t.key);
        this.factory.save();
      }
    });
  });

  items.push(UI.button(this, width / 2, top + sheetH - 38, width - 56, 46, {
    label: 'CANCEL', variant: 'ghost', depth: D + 3, onTap: () => { close(); this.setPlacing(null); }
  }));
}

// ── Worker station interaction ─────────────────────────────────────────────
stationTapped(stationKey) {
  if (this.placingMachine || this.deleteMode) return;
  this.openWorkerMenu(stationKey);
}

openWorkerMenu(stationKey) {
  if (this.workerMenuActive) return;
  const unlocked = this.factory.getUnlockedWorkers();
  if (unlocked.length === 1) { this.tryAssignWorker(0, stationKey); return; }

  this.workerMenuActive = true;
  const { width } = this.scale;
  const height = this.H;
  const pos = this.getStationPos(stationKey);
  const D = 110;
  const menuH = 128, menuW = width - 48;
  const menuY = pos.y > height / 2 ? pos.y - 96 : pos.y + 96;
  const items = [];
  const dismissZone = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.35).setInteractive().setDepth(D);
  items.push(dismissZone);
  items.push(UI.panel(this, width / 2, menuY, menuW, menuH, { fill: UI.C.surface, stroke: UI.C.line, radius: 16, depth: D + 1 }));
  items.push(UI.text(this, width / 2, menuY - menuH / 2 + 18, 'WHO SHOULD GO?', 'label', { size: 11, origin: 0.5, depth: D + 2 }));
  const dismiss = () => { items.forEach(e => e && e.destroy && e.destroy()); this.workerMenuActive = false; this._workerMenu = null; };
  // Remembered so update() can rebuild the menu the moment a worker frees up
  this._workerMenu = { key: stationKey, sig: this.workerMenuSig(stationKey), dismiss };
  // When nobody can act here, say how to get unstuck instead of a dead menu
  const anyCan = unlocked.some(w => this.factory.canWorkerStartAt(stationKey, w.id) || this.factory.canStartIfEmpty(stationKey, w.id));
  const fullHands = !anyCan && unlocked.some(w => this.factory.whyCantWork(stationKey, w.id) === 'Hands full');
  items.push(UI.text(this, width / 2, menuY + menuH / 2 - 12,
    fullHands ? 'Tip: tap a store to put a carried item back' : 'Tap outside to close', 'small',
    { size: fullHands ? 11 : 10, origin: 0.5, depth: D + 2, color: fullHands ? UI.T.amber : UI.T.faint }));

  const bw = (menuW - 36) / 2;
  unlocked.forEach((w, i) => {
    const bx = width / 2 + (i === 0 ? -1 : 1) * (bw / 2 + 6);
    const by = menuY + 6;
    const direct  = this.factory.canWorkerStartAt(stationKey, w.id);
    const canWork = direct || this.factory.canStartIfEmpty(stationKey, w.id);
    const wc = WORKER_COLOURS[w.id];
    const p = UI.panel(this, bx, by, bw, 62, { fill: canWork ? UI.C.surface2 : 0x10151c, stroke: canWork ? wc : UI.C.lineSoft, radius: 12, depth: D + 2 });
    const dot = this.add.circle(bx - bw / 2 + 24, by, 13, canWork ? wc : UI.C.line).setDepth(D + 3);
    const lbl = UI.text(this, bx - bw / 2 + 24, by, WORKER_LABELS[w.id], 'tag', { size: 10, origin: 0.5, color: UI.T.dark, depth: D + 4 });
    const st  = UI.text(this, bx - bw / 2 + 46, by - 10, this.workerStateLabel(w, true), 'bodyB', { size: 13, origin: [0, 0.5], depth: D + 3, color: canWork ? UI.T.text : UI.T.faint });
    const sub = direct ? this.factory.getInventoryDisplay(w.id)
              : canWork ? (w.inventory[0] === 'towerComponent' ? 'Tower → Armoury first' : 'Drops ' + this.itemName(w.inventory[0]) + ' in Lost & Found')
              : this.factory.whyCantWork(stationKey, w.id);
    const inv = UI.text(this, bx - bw / 2 + 46, by + 10, sub, 'small', { size: 11, origin: [0, 0.5], depth: D + 3, wrap: bw - 54, color: canWork ? UI.T.mute : UI.T.amber });
    items.push(p, dot, lbl, st, inv);
    if (canWork) {
      const z = this.add.zone(bx, by, bw, 62).setInteractive().setDepth(D + 5);
      z.on('pointerup', () => { dismiss(); this.tryAssignWorker(w.id, stationKey); });
      items.push(z);
    }
  });
  dismissZone.on('pointerup', dismiss);
}

// What the worker menu shows for a station; when this changes, the open menu is redrawn
workerMenuSig(stationKey) {
  return this.factory.getUnlockedWorkers().map(w =>
    (this.factory.canWorkerStartAt(stationKey, w.id) ? 'a' : this.factory.canStartIfEmpty(stationKey, w.id) ? 'd' : 'n') +
    this.workerStateLabel(w, true) + w.inventory.join()).join('|');
}

workerStateLabel(w, short) {
  if (w.state === 'working') return 'Busy';
  if (w.state === 'walking' || w.state === 'moving') return 'On the way';
  if (w.waitingFor === 'destination') return short ? 'Holding ' + this.itemName(w.inventory[0]) : 'Holding ' + this.itemName(w.inventory[0]) + ' — tap where it goes';
  if (w.job && w.waitingFor) return 'Waiting: ' + this.stationName(w.waitingFor);
  return w.job ? 'Ready' : 'Idle';
}

// One line describing a worker's remembered route
jobLabel(w) {
  const j = w.job;
  if (!j || !j.stops.length) return null;
  const st = j.stops;
  if (st.length === 2 && st[0].action === 'assemble' && st[1].action === 'deliver') return 'Runs the ' + this.stationName(st[0].station);
  const parts = st.map(x => this.stopLabel(x));
  return (st.length < 2 ? 'Next stop? ' : '') + parts.join(' → ');
}

stopLabel(stop) {
  switch (stop.action) {
    case 'collect_scrap':   return 'scrap';
    case 'collect_metal':   return 'metal';
    case 'collect_refined': return 'smelter';
    case 'deposit':         return 'load ' + this.stationName(stop.station).replace(' bench', '');
    case 'drop_to_belt':    return 'belt';
    case 'assemble':        return 'build';
    case 'deliver':         return 'deliver';
  }
  return stop.action;
}

itemName(item) { return ITEM_NAMES[item] || 'item'; }

stationName(key) {
  if (key === 'store_scrap') return this.factory.getMaterialCount('plasticScrap') > 0 ? 'scrap store' : 'out of scrap';
  if (key === 'store_metal') return this.factory.getMaterialCount('salvagedMetal') > 0 ? 'metal store' : 'out of metal';
  if (key === 'depository')  return 'depository';
  if (key === 'lostfound')   return 'lost & found';
  if (!key || !key.includes(',')) return 'station';
  const [r, c] = key.split(',').map(Number);
  const m = this.factory.getMachineAt(r, c);
  return m ? this.machineLabel(m.type).toLowerCase() + (this.factory.isAssemblyType(m.type) ? ' bench' : '') : 'missing machine';
}

// ── Jobs ───────────────────────────────────────────────────────────────────
// Each worker remembers one job (see Factory.jobStep). A free worker with a
// job walks to their next stop on their own.
runJobs() {
  this.factory.getUnlockedWorkers().forEach(w => {
    const step = this.factory.jobStep(w.id);
    if (!step) return;
    if (step.stopped) {
      this.showMessage(WORKER_LABELS[w.id] + ': job stopped — a machine on it was removed', 'warn');
      this.factory.save();
      this.updateStatus();
      return;
    }
    if (step.act) {
      this.walkWorkerTo(w.id, step.station, () => {
        this.factory.startWorkAt(step.station, w.id);
        this.updateStatus();
      });
    } else {
      this.factory.markMoving(step.station, w.id);
      this.moveSpriteTo(w.id, step.station, () => { this.factory.arrive(w.id, step.station); this.updateStatus(); });
    }
  });
}

// Faint dotted line along each haul job, in the worker's colour
drawJobs() {
  const sig = this.factory.workers.map(w => w.job ? JSON.stringify(w.job) : '').join('|');
  if (sig === this._routeSig) return;
  this._routeSig = sig;
  if (!this.routeGfx) this.routeGfx = this.add.graphics().setDepth(6);
  const g = this.routeGfx;
  g.clear();
  this.factory.getUnlockedWorkers().forEach(w => {
    const j = w.job;
    if (!j || j.stops.length < 2) return;
    const col = WORKER_COLOURS[w.id];
    const pts = j.stops.map(x => this.getStationPos(x.station, w.id));
    pts.forEach((a, i) => {
      const b = pts[(i + 1) % pts.length];
      const d = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y), n = Math.floor(d / 12);
      for (let k = 1; k < n; k++) {
        const t = k / n;
        g.fillStyle(col, 0.55); g.fillCircle(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, 2.5);
      }
    });
  });
}

confirmStopJob(workerId) {
  const w = this.factory.workers[workerId];
  if (!w || !w.job) return;
  UI.modal(this, {
    title: 'Stop ' + WORKER_LABELS[workerId] + '’s job?', icon: 'pause', accent: UI.C.amber,
    body: WORKER_LABELS[workerId] + ': ' + this.jobLabel(w) + '.\n\nStopped workers finish what they’re doing and wait for orders. Giving them any new order also replaces their job.',
    buttons: [{ label: 'KEEP GOING' }, { label: 'STOP JOB', variant: 'primary', onTap: () => {
      this.factory.stopJob(workerId); this.factory.save(); this.updateStatus();
    } }]
  });
}

tryAssignWorker(workerId, stationKey) {
  const W = 'W' + (workerId + 1) + ': ';
  // Carrying something that gets in the way of this order? Put it down in
  // Lost & Found (finished towers go straight to the Armoury).
  if (!this.factory.canWorkerStartAt(stationKey, workerId) && this.factory.canStartIfEmpty(stationKey, workerId)) {
    const d = this.factory.dropToLostFound(workerId);
    if (d && d.tower) this.showMessage(W + 'sent the finished ' + d.tower + ' to the Armoury first', 'good');
    else if (d) this.showMessage(W + 'put the ' + this.itemName(d.item) + ' in Lost & Found' + (d.displaced ? ' (the ' + this.itemName(d.displaced) + ' there went back to stock)' : ''), 'info');
    this.updateLostFound();
  }
  if (!this.factory.canWorkerStartAt(stationKey, workerId)) {
    const w = this.factory.workers[workerId];
    if (stationKey === 'store_scrap' || stationKey === 'store_metal') {
      const mat = stationKey === 'store_scrap' ? 'plasticScrap' : 'salvagedMetal';
      const name = stationKey === 'store_scrap' ? 'Plastic Scrap' : 'Salvaged Metal';
      if (this.factory.getMaterialCount(mat) <= 0) this.showMessage(W + 'no ' + name + ' left — win battles to earn more', 'bad');
      else if (w.inventory.length > 0) this.showMessage(W + 'hands are full — this store doesn’t take what they’re carrying', 'warn');
      else this.showMessage(W + 'someone is already collecting here', 'warn');
    } else if (stationKey === 'depository') {
      this.showMessage(W + 'nothing finished to deliver yet', 'warn');
    } else {
      const [r, c] = stationKey.split(',').map(Number);
      const machine = this.factory.getMachineAt(r, c);
      if (machine && machine.type === 'conveyor') {
        if (w.inventory.length === 0) this.showMessage(W + 'carry an item first, then drop it on the belt', 'warn');
        else if (this.factory.getTileItem(r, c) !== null) this.showMessage(W + 'this belt tile is occupied', 'warn');
        else this.showMessage(W + 'can’t drop on the belt right now', 'bad');
      } else if (machine && this.factory.isAssemblyType(machine.type)) {
        const pri = MACHINE_TYPES[machine.type].primaryInput;
        const nice = { plasticScrap: 'Plastic Scrap', refinedPlastic: 'Refined Plastic', salvagedMetal: 'Salvaged Metal' }[pri] || pri;
        if (machine.heldMaterial === null && !w.inventory.includes(pri)) this.showMessage(W + 'this bench needs ' + nice + ' — collect some first', 'warn');
        else if (machine.heldMaterial === pri && w.inventory.length > 0) this.showMessage(W + 'hands full — tap the store to put the item back, then assemble', 'warn');
        else this.showMessage(W + 'someone is already working this bench', 'warn');
      } else if (machine && machine.type === 'smelter') {
        this.showMessage(W + 'bring Plastic Scrap to smelt', 'warn');
      } else {
        this.showMessage(W + 'can’t work here right now', 'bad');
      }
    }
    return;
  }

  const change = this.factory.setJobFromAssignment(stationKey, workerId);
  const w = this.factory.workers[workerId];
  const L = WORKER_LABELS[workerId];
  if (!this.tutorialActive) {
    if (change === 'loop' || change === 'extend') this.showMessage(L + ' remembers: ' + this.jobLabel(w), 'good');
    else if (change === 'operate') this.showMessage(L + ' now runs this bench — they’ll build whatever is brought to it', 'good');
    else if (change === 'full') this.showMessage(L + ' can only remember ' + this.factory.routeLength + ' stops — this starts a new route', 'info');
  }

  this.walkWorkerTo(workerId, stationKey, () => {
    if (!this.factory.startWorkAt(stationKey, workerId)) {
      this.showMessage(W + 'station no longer available', 'warn');
    }
    this.updateStatus();
  });
}

// ── Machine rendering ──────────────────────────────────────────────────────
drawMachines() {
  Object.values(this.machineSprites).forEach(group => { if (group) Object.values(group).forEach(s => s && s.destroy && s.destroy()); });
  this.machineSprites = {};
  this.machineStatusTexts = {};
  for (let row = 0; row < this.ROWS; row++) for (let col = 0; col < this.COLS; col++) {
    const m = this.factory.getMachineAt(row, col);
    if (m) this.drawMachineAt(row, col, m.type);
  }
}

machineLabel(type) {
  return { smelter: 'SMELTER', conveyor: 'BELT', assembly_gunner: 'GUNNER', assembly_bomber: 'BOMBER', assembly_barricade: 'BARRICADE', assembly_gunner2: 'MK II', assembly_siphon: 'SIPHON' }[type] || type.toUpperCase();
}

drawMachineAt(row, col, type) {
  const mt = MACHINE_TYPES[type];
  if (!mt) return;
  const { x, y } = this.tileCentre(row, col);
  const key = row + ',' + col;
  const isConveyor = type === 'conveyor';
  const machine = this.factory.getMachineAt(row, col);
  const s = this.TILE - 8;

  const bg = this.add.graphics().setDepth(2);
  bg.fillStyle(mt.colour, isConveyor ? 0.08 : 0.14);
  bg.fillRoundedRect(x - s / 2, y - s / 2, s, s, 10);
  bg.lineStyle(isConveyor ? 1 : 1.5, mt.colour, isConveyor ? 0.5 : 0.85);
  bg.strokeRoundedRect(x - s / 2, y - s / 2, s, s, 10);

  let lbl, sub = null, barBg = null, bar = null, statusTxt = null, icon = null;
  if (isConveyor) {
    // Belt chevrons pointing along the direction of travel
    const ang = { N: -Math.PI / 2, E: 0, S: Math.PI / 2, W: Math.PI }[machine?.direction || 'E'];
    icon = this.add.graphics({ x, y }).setDepth(3).setRotation(ang);
    icon.lineStyle(3, mt.colour, 0.9);
    [-12, 4].forEach(off => { icon.beginPath(); icon.moveTo(off, -10); icon.lineTo(off + 10, 0); icon.lineTo(off, 10); icon.strokePath(); });
    lbl = UI.text(this, x, y + s / 2 - 10, this.TILE >= 80 ? 'HOLD TO TURN' : '', 'label', { size: 8.5, origin: 0.5, color: UI.T.faint, ls: 0.5, depth: 3 });
  } else {
    const isAsm = this.factory.isAssemblyType(type);
    const ts = this.TS;
    lbl = UI.text(this, x, y - 14 * ts, this.machineLabel(type), 'tag', { size: (type === 'assembly_barricade' ? 11 : 12.5) * ts, origin: 0.5, color: mt.colourHex, depth: 3, ls: ts < 0.9 ? 0.5 : 1.5 });
    sub = UI.text(this, x, y + 2 * ts, this.TILE >= 80 ? (isAsm ? 'BENCH' : 'SCRAP → REF') : '', 'label', { size: 9, origin: 0.5, color: UI.T.mute, ls: 1, depth: 3 });
    statusTxt = UI.text(this, x, y + 20 * ts, '', 'tag', { size: 10, origin: 0.5, color: UI.T.green, depth: 3 });
    barBg = this.add.rectangle(x, y + s / 2 - 8, s - 16, 4, UI.C.line).setDepth(3);
    bar = this.add.rectangle(x - (s - 16) / 2, y + s / 2 - 8, 0, 4, mt.colour).setOrigin(0, 0.5).setDepth(3);
    bar._maxW = s - 16;
    this.progressBars[key] = bar;
    this.machineStatusTexts[key] = statusTxt;
  }
  this.machineSprites[key] = { bg, lbl, sub, barBg, bar, statusTxt, icon };
  this.drawTile(row, col, false);

  // Input: tap = interact; long-press a belt = rotate it
  const zone = this.add.zone(x, y, s, s).setInteractive().setDepth(4);
  this.machineSprites[key].zone = zone;
  let timer = null, pressing = false, longPressed = false;
  zone.on('pointerdown', () => {
    pressing = true; longPressed = false;
    if (isConveyor && !this.deleteMode) {
      timer = this.time.delayedCall(450, () => {
        longPressed = true; pressing = false;
        this.factory.rotateConveyor(row, col);
        this.factory.save();
        this.redrawMachineAt(row, col);
      });
    }
  });
  zone.on('pointerup', () => {
    if (timer) { timer.remove(); timer = null; }
    if (pressing && !longPressed) this.tileTapped(row, col);
    pressing = false;
  });
  zone.on('pointerout', () => {
    if (timer) { timer.remove(); timer = null; }
    pressing = false; longPressed = false;
  });
}

destroyMachineSprites(key) {
  if (!this.machineSprites[key]) return;
  Object.values(this.machineSprites[key]).forEach(s => s && s.destroy && s.destroy());
  delete this.machineSprites[key];
  delete this.progressBars[key];
  delete this.machineStatusTexts[key];
}

redrawMachineAt(row, col) {
  this.destroyMachineSprites(row + ',' + col);
  const m = this.factory.getMachineAt(row, col);
  if (m) this.drawMachineAt(row, col, m.type);
}

// ── Workers ────────────────────────────────────────────────────────────────
// Workers wait beside the grid until given a job.
workerHome(id) {
  return { x: Math.max(18, this.GX - 28), y: this.GY + 30 + id * 46 };
}

drawWorkers() {
  Object.values(this.workerSprites).forEach(s => s && s.destroy && s.destroy());
  Object.values(this.workerLabels).forEach(s => s && s.destroy && s.destroy());
  this.workerSprites = {};
  this.workerLabels  = {};
  this.factory.getUnlockedWorkers().forEach(w => {
    const home = this.workerHome(w.id);
    const sprite = this.add.circle(home.x, home.y, 15, WORKER_COLOURS[w.id]).setDepth(10).setStrokeStyle(2, 0x0a0d12);
    const label  = UI.text(this, home.x, home.y, WORKER_LABELS[w.id], 'tag', { size: 10, origin: 0.5, color: UI.T.dark, depth: 11 });
    this.workerSprites[w.id] = sprite;
    this.workerLabels[w.id]  = label;
  });
}

// ── Toolbar ────────────────────────────────────────────────────────────────
drawToolbar() {
  const { width } = this.scale;
  const y = this.TOOL_Y, h = this.TOOL_H;
  const g = this.add.graphics();
  g.fillStyle(UI.C.bg, 0.95); g.fillRect(0, y - h / 2 - 12, width, h + 40);
  g.fillStyle(UI.C.line, 1);  g.fillRect(0, y - h / 2 - 12, width, 1);

  const gap = 8, n = 4, bw = (width - 32 - gap * (n - 1)) / n;
  const tools = [
    { key: 'assembly', name: 'BENCH',    sub: 'builds towers', icon: 'factory', colour: UI.C.green },
    { key: 'conveyor', name: 'BELT',     sub: this.beltsUnlocked ? this.formatShort(this.MACHINE_BUILD_COSTS.conveyor) : 'locked', icon: this.beltsUnlocked ? 'chevron' : 'lock', colour: this.beltsUnlocked ? UI.C.steel : 0x465163, locked: !this.beltsUnlocked, unlock: 'belts' },
    { key: 'smelter',  name: 'SMELTER',  sub: this.smelterUnlocked ? this.formatShort(this.MACHINE_BUILD_COSTS.smelter) : 'locked', icon: this.smelterUnlocked ? 'gear' : 'lock', colour: this.smelterUnlocked ? UI.C.amber : 0x465163, locked: !this.smelterUnlocked, unlock: 'smelter' },
    { key: 'delete',   name: 'REMOVE',   sub: 'refunds cost', icon: 'trash', colour: UI.C.red }
  ];
  this.toolButtons = {};
  tools.forEach((t, i) => {
    const x = 16 + bw / 2 + i * (bw + gap);
    const c = this.add.container(x, y);
    const bg = this.add.graphics();
    const disc = this.add.graphics();
    disc.fillStyle(t.colour, 0.16); disc.fillCircle(0, -18, 15);
    const ic = UI.icon(this, 0, -18, t.icon, 14, t.colour);
    const nm = UI.text(this, 0, 9, t.name, 'tag', { size: 12, origin: 0.5, color: UI.T.text });
    const sb = UI.text(this, 0, 26, t.sub, 'small', { size: 10, origin: 0.5, color: UI.T.mute });
    const zone = this.add.zone(0, 0, bw, h).setInteractive();
    c.add([bg, disc, ic, nm, sb, zone]);
    const draw = (active) => {
      UI.drawPanel(bg, 0, 0, bw, h, {
        fill: active ? 0x1d2734 : UI.C.surface, stroke: active ? t.colour : UI.C.line, strokeWidth: active ? 2 : 1, radius: 14
      });
    };
    draw(false);
    zone.on('pointerdown', () => c.setScale(0.96));
    zone.on('pointerout',  () => c.setScale(1));
    zone.on('pointerup',   () => {
      c.setScale(1);
      if (t.locked) { this.showMessage(t.name.charAt(0) + t.name.slice(1).toLowerCase() + 's unlock after ' + Progress.levelName(UNLOCKS[t.unlock].at), 'info'); return; }
      if (t.key === 'delete') this.toggleDeleteMode();
      else this.setPlacing(this.placingMachine === t.key ? null : t.key);
    });
    this.toolButtons[t.key] = { container: c, draw, x, y, w: bw, h };
  });
}

formatShort(cost) {
  const p = [];
  if (cost.plasticScrap)  p.push(cost.plasticScrap + 'S');
  if (cost.salvagedMetal) p.push(cost.salvagedMetal + 'M');
  return p.join(' + ');
}

refreshToolbar() {
  if (!this.toolButtons) return;
  Object.entries(this.toolButtons).forEach(([k, b]) => b.draw(k === 'delete' ? this.deleteMode : this.placingMachine === k));
}

setPlacing(type) {
  this.placingMachine = type;
  if (type && this.deleteMode) this.deleteMode = false;
  this.refreshToolbar();
  this.refreshTiles();
  if (!type || this.tutorialActive) return;   // the tutorial explains placement itself
  if (type === 'assembly')      this.showMessage('Tap an empty tile — then choose which tower it builds', 'info');
  else if (type === 'conveyor') this.showMessage('Tap an empty tile to lay a belt (' + this.formatCost(this.MACHINE_BUILD_COSTS.conveyor) + ')', 'info');
  else                          this.showMessage('Tap an empty tile to build a ' + type + ' (' + this.formatCost(this.MACHINE_BUILD_COSTS[type]) + ')', 'info');
}

// ── Delete mode ────────────────────────────────────────────────────────────
toggleDeleteMode() {
  this.deleteMode = !this.deleteMode;
  if (this.deleteMode) this.placingMachine = null;
  this.refreshToolbar();
  this.refreshTiles();
  if (this.deleteMode) this.showMessage('Remove mode — tap a machine to remove it', 'bad');
}

exitDeleteMode() {
  if (!this.deleteMode) return;
  this.deleteMode = false;
  this.refreshToolbar();
}

confirmDelete(row, col) {
  const machine = this.factory.getMachineAt(row, col);
  if (!machine) return;
  const mt = MACHINE_TYPES[machine.type];
  if (!mt) return;
  const refund = this.MACHINE_BUILD_COSTS[machine.type];

  UI.modal(this, {
    title: 'Remove this ' + this.machineLabel(machine.type).toLowerCase() + (this.factory.isAssemblyType(machine.type) ? ' bench' : '') + '?',
    body: refund ? 'You get back ' + this.formatCost(refund) + ', plus anything loaded in it.' : 'Anything loaded in it is returned to stock.',
    icon: 'trash', accent: UI.C.red,
    buttons: [{ label: 'CANCEL' }, { label: 'REMOVE', variant: 'danger', onTap: () => this.executeDelete(row, col, machine) }]
  });
}

executeDelete(row, col, machine) {
  // Guard against a stale dialog: if the machine is already gone (or the tile
  // now holds a different one) a second confirm must not refund again.
  if (this.factory.getMachineAt(row, col) !== machine) return;
  this.destroyMachineSprites(row + ',' + col);

  // Whatever sits IN the machine (bench slot, item on a belt) goes back to
  // stock; refined plastic has no store so it refunds as the scrap it came
  // from. Workers' own inventories are untouched. Factory.deleteMachine resets
  // anyone working here; anyone walking here re-validates on arrival.
  const contents = { plasticScrap: 0, salvagedMetal: 0 };
  const refundItem = item => {
    if (item === 'plasticScrap' || item === 'refinedPlastic') contents.plasticScrap++;
    else if (item === 'salvagedMetal') contents.salvagedMetal++;
  };
  if (machine.heldMaterial) refundItem(machine.heldMaterial);
  // Finished towers sitting on the tile (or waiting to leave a bench) aren't
  // lost — they go straight to the Armoury
  [this.factory.getTileItem(row, col), machine.autoOutput].forEach(item => {
    if (this.factory.isTowerItem(item)) this.addTowerToStockpile(this.factory.towerTypeOf(item));
    else refundItem(item);
  });

  this.factory.deleteMachine(row, col);
  this.factory.save();
  this.drawTile(row, col, false);

  const build = this.MACHINE_BUILD_COSTS[machine.type] || {};
  const total = {
    plasticScrap:  (build.plasticScrap  || 0) + contents.plasticScrap,
    salvagedMetal: (build.salvagedMetal || 0) + contents.salvagedMetal
  };
  if (total.plasticScrap > 0 || total.salvagedMetal > 0) {
    this.refundBuildCost(total);
    this.showMessage('Refunded ' + this.formatCost(total), 'good');
  }
  // Leave remove mode so the next tap can't delete something by accident
  this.exitDeleteMode();
}

// ── Status / messages ──────────────────────────────────────────────────────
drawStatusBar() {
  this.statusItems = [];
  this.updateStatus();
}

updateStatus() {
  if (!this.statusItems) return;
  this.statusItems.forEach(e => e.destroy());
  this.statusItems = [];
  const workers = this.factory.getUnlockedWorkers();
  const { width } = this.scale;
  const w = (width - 32 - (workers.length - 1) * 8) / workers.length;
  workers.forEach((wk, i) => {
    const x = 16 + w / 2 + i * (w + 8), y = this.STATUS_Y;
    const job = this.jobLabel(wk);
    const p = UI.panel(this, x, y, w, 44, { fill: UI.C.surface, stroke: job ? WORKER_COLOURS[wk.id] : UI.C.lineSoft, strokeAlpha: job ? 0.6 : 1, radius: 10 });
    const dot = this.add.circle(x - w / 2 + 16, y, 8, WORKER_COLOURS[wk.id]);
    const carry = wk.inventory.length && wk.waitingFor !== 'destination' ? '  ·  ' + this.factory.getInventoryDisplay(wk.id).toLowerCase() : '';
    const t1 = UI.text(this, x - w / 2 + 30, y - 8, WORKER_LABELS[wk.id] + '  ' + this.workerStateLabel(wk, true) + carry,
      'small', { size: 11.5, origin: [0, 0.5], color: UI.T.text });
    const t2 = UI.text(this, x - w / 2 + 30, y + 9, job || 'No job — tap a station', 'small',
      { size: 10.5, origin: [0, 0.5], color: job ? UI.T.mute : UI.T.faint });
    [t1, t2].forEach(t => { if (t.width > w - (job ? 70 : 38)) t.setScale((w - (job ? 70 : 38)) / t.width, 1); });
    this.statusItems.push(p, dot, t1, t2);
    if (job) {
      // Tap a worker's status to stop their job
      this.statusItems.push(UI.text(this, x + w / 2 - 10, y, 'STOP', 'tag', { size: 10, origin: [1, 0.5], color: UI.T.amber }));
      const z = this.add.zone(x, y, w, 44).setInteractive();
      z.on('pointerup', () => this.confirmStopJob(wk.id));
      this.statusItems.push(z);
    }
  });
  this.updateMaterialDisplay();
}

// Accepts a kind ('info'|'good'|'bad'|'warn') or a legacy hex colour.
showMessage(text, kind) {
  const legacy = { '#c43a3a': 'bad', '#5eba7d': 'good', '#e8a020': 'warn', '#3a8fc4': 'info' };
  UI.toast(this, text, legacy[kind] || kind || 'info', { y: UI.HEADER_H + 26, depth: 400 });
}

// Where a worker stands to use a station — beside its label, not on top of it
getStationPos(stationKey, workerId) {
  const off = workerId === 1 ? -26 : 0;     // W2 stands beside W1, never on top
  if (stationKey === 'store_scrap') return { x: 16 + this.STORE_W - 26 + off, y: this.STORE_Y };
  if (stationKey === 'store_metal') return { x: this.METAL_X + this.STORE_W / 2 - 26 + off, y: this.STORE_Y };
  if (stationKey === 'depository')  return { x: this.DEPOT_X + this.DEPOT_W / 2 - 30 + off, y: this.DEPOT_Y };
  if (stationKey === 'lostfound')   return { x: this.LF_X + this.LF_W / 2 - 22 + off, y: this.DEPOT_Y };
  const [r, c] = stationKey.split(',').map(Number);
  const t = this.tileCentre(r, c);
  return { x: t.x + this.TILE / 2 - 20 + off * 0.7, y: t.y + this.TILE / 2 - 20 };
}

// ── Navigation ─────────────────────────────────────────────────────────────
walkWorkerTo(workerId, stationKey, onComplete) {
  const sprite = this.workerSprites[workerId];
  const label  = this.workerLabels[workerId];
  if (!sprite) return;

  this.factory.markWalking(stationKey, workerId);
  this.updateStatus();
  this.moveSpriteTo(workerId, stationKey, onComplete);
}

// Tween a worker's sprite to a station (no claim — used for walking over to
// wait somewhere, and by walkWorkerTo)
moveSpriteTo(workerId, stationKey, onComplete) {
  const sprite = this.workerSprites[workerId];
  const label  = this.workerLabels[workerId];
  if (!sprite) return;
  const target = this.getStationPos(stationKey, workerId);
  const dist   = Phaser.Math.Distance.Between(sprite.x, sprite.y, target.x, target.y);

  this.tweens.killTweensOf(sprite);
  this.tweens.killTweensOf(label);

  const walkTween = this.tweens.add({
    targets: [sprite, label],
    x: target.x, y: target.y,
    duration: Math.max((dist / this.WORKER_SPEED) * 1000, 80),
    ease: 'Sine.easeInOut',
    onComplete: () => {
      this._workerWalkTweens[workerId] = null;
      if (onComplete) onComplete();
      this.updateStatus();
    }
  });
  // Tracked per worker so the combat freeze can pause/resume just walks
  this._workerWalkTweens[workerId] = walkTween;
  if (!this.shouldFactoryRun()) walkTween.pause();
}

// ── Tutorial ───────────────────────────────────────────────────────────────
// Derived from live factory state every frame, so it can never desync: each
// call works out what the player should do next and points the Coach at it.
// The first tower is fully guided (everything else dimmed and blocked); the
// rest needed for Level 1 get lighter hints so the player does it themselves.
towersNeeded() {
  const l1 = LEVEL_DATA.storylines[0].levels[0];
  return (l1 && l1.recommendedTowers) || 2;
}

updateTutorial() {
  if (!this.tutorialActive || this._uiLeaving) return;
  const need  = this.towersNeeded();
  const stock = this.stockTotal();
  if (stock >= need) { this.finishTutorial(); return; }
  if (this.workerMenuActive && !this._asmMenuOpen) { this.coach.hide(); return; }

  const guided = stock === 0;
  const mode   = guided ? 'block' : 'hint';
  const hintBottom = this.TOOL_Y - this.TOOL_H / 2 - 22;
  const w      = this.factory.workers[0];
  const tag    = guided ? null : 'TOWER ' + (stock + 1) + ' OF ' + need;
  const step   = (n) => guided ? { step: n, total: 6 } : { tag, cardBottom: hintBottom, finger: false };

  // Find the first assembly bench
  let bench = null, benchKey = null;
  for (let r = 0; r < this.ROWS && !bench; r++) for (let c = 0; c < this.COLS && !bench; c++) {
    const m = this.factory.getMachineAt(r, c);
    if (m && this.factory.isAssemblyType(m.type)) { bench = m; benchKey = r + ',' + c; }
  }
  const benchRect = () => { const [r, c] = benchKey.split(',').map(Number); const p = this.tileCentre(r, c); return { x: p.x, y: p.y, w: this.TILE - 8, h: this.TILE - 8 }; };
  const tb = this.toolButtons.assembly;

  if (guided && !this._introDone && !bench) {
    this.coach.show({
      key: 'intro', tag: 'THE FACTORY',
      title: 'Towers are built here',
      body: 'Raiders will soon land on your island. Towers stop them — and every tower starts on this factory floor.\n\nYour worker, W1, carries materials between stations. You tell W1 where to go by tapping a station.',
      button: { label: 'SHOW ME', onTap: () => { this._introDone = true; this.coach.hide(); },
        secondary: { label: 'SKIP', onTap: () => this.skipTutorial() } }
    });
    return;
  }

  if (!bench) {
    if (this._asmMenuOpen && this._asmGunnerRect) {
      this.coach.show(Object.assign({ key: 'pick', mode: 'block', target: this._asmGunnerRect, title: 'Choose Gunner',
        body: 'Gunners fire fast single shots and need just 1 Plastic Scrap each. Other tower types unlock as you win battles.' }, step(2)));
    } else if (this.placingMachine === 'assembly') {
      const g = { x: this.GX + this.TILE * this.COLS / 2, y: this.GY + this.TILE * this.ROWS / 2, w: this.TILE * this.COLS, h: this.TILE * this.ROWS };
      this.coach.show(Object.assign({ key: 'tile', mode, target: g, placement: 'below', finger: false, title: 'Pick a spot on the floor',
        body: 'Tap any empty tile. The bench will sit there permanently (you can remove it later for a full refund).' }, step(1)));
    } else {
      this.coach.show(Object.assign({ key: 'bench', mode, target: { x: tb.x, y: tb.y, w: tb.w, h: tb.h }, title: 'Build an Assembly Bench',
        body: 'Benches turn raw materials into towers. Tap BENCH to start building one.' }, step(1)));
    }
    return;
  }

  const busy = w.state === 'walking' || w.state === 'working' || w.state === 'moving';
  const total = 6;
  const stepN = (n) => guided ? { step: n, total } : { tag, cardBottom: hintBottom, finger: false };

  const st = (w.job && w.job.stops) || [];
  const isHaul = st.length === 2 && st[0].action === 'collect_scrap' && st[1].station === benchKey;
  const runsBench = st.length >= 2 && st.some(x => x.action === 'assemble' && x.station === benchKey) && st.some(x => x.action === 'deliver');
  const holdingTower = w.inventory.includes('towerComponent');
  const holdingScrap = w.inventory.includes('plasticScrap');

  // W1 now runs the bench (build → deliver): let them work
  if (runsBench) {
    this.coach.show({ key: 'runs', mode: 'hint', tag: tag || 'NICE', cardBottom: hintBottom,
      title: 'W1 runs the bench now',
      body: 'They build whatever is loaded and deliver it. Later, W2 can fetch scrap for them.' });
    return;
  }
  if (holdingTower && !busy) {
    this.coach.show(Object.assign({ key: 'deliver', mode, target: { x: this.DEPOT_X, y: this.DEPOT_Y, w: this.DEPOT_W, h: this.DEPOT_H },
      title: 'Deliver the tower',
      body: 'Tap the Depository. Towers go from there to your Armoury \u2014 and W1 will remember build \u2192 deliver, so they keep running the bench.' }, stepN(6)));
    return;
  }
  // Remembered A → B: back with more scrap, but the bench is still full
  if (isHaul && bench.heldMaterial && holdingScrap && !busy) {
    this.coach.show(Object.assign({ key: 'build', mode, target: benchRect(), title: 'Now build it',
      body: 'W1 remembered the trip and fetched more scrap \u2014 but nobody is building. Tap the bench: W1 builds the Gunner and loads the new scrap.' }, stepN(5)));
    return;
  }
  if (isHaul) {
    this.coach.show({ key: 'haul', mode: 'hint', tag: guided ? 'STEP 4 / 6' : tag, cardBottom: hintBottom,
      title: 'W1 remembers: scrap \u2192 bench',
      body: 'Workers repeat the last two stops you give them. W1 will keep fetching scrap for the bench.' });
    return;
  }
  if (holdingScrap && !busy) {
    this.coach.show(Object.assign({ key: 'deposit', mode, target: benchRect(), title: 'Bring it to the bench',
      body: 'Tap the Gunner bench to load the scrap.' }, stepN(4)));
    return;
  }
  if (bench.heldMaterial && !w.inventory.length && !busy) {
    this.coach.show(Object.assign({ key: 'assemble', mode, target: benchRect(), title: 'Build the tower',
      body: 'The bench is loaded. Tap it and W1 will put the Gunner together.' }, stepN(5)));
    return;
  }
  if (!busy && !w.inventory.length) {
    this.coach.show(Object.assign({ key: 'collect', mode, target: { x: this.SCRAP_X, y: this.STORE_Y, w: this.SCRAP_W, h: this.STORE_H },
      title: 'Fetch Plastic Scrap',
      body: 'Every tower is made from materials. Tap the scrap store and W1 will walk over and pick some up.' }, stepN(3)));
    return;
  }

  // Worker is walking or working — explain what's happening, block nothing
  const doing = { collect_scrap: 'W1 is picking up scrap\u2026', deposit: 'W1 is loading the bench\u2026',
    assemble: 'W1 is building the Gunner\u2026', deliver: 'W1 is delivering the tower\u2026' }[w.stationAction] || 'W1 is on the way\u2026';
  const label = w.state === 'working' ? doing : 'W1 is on the way\u2026';
  this.coach.show({ key: 'wait:' + label, mode: 'hint', tag: tag || 'WORKING', title: label,
    body: 'Watch the progress bar fill.', cardBottom: hintBottom });
}

skipTutorial() {
  this.coach.hide();
  this.tutorialActive = false;
  this.factory.tutorialComplete = true;
  this.factory.save();
}

finishTutorial() {
  this.tutorialActive = false;
  this.coach.hide();
  this.factory.tutorialComplete = true;
  this.factory.tutorialStep     = 0;
  this.factory.save();
  const need = this.towersNeeded();
  UI.modal(this, {
    title: 'Ready for the first raid', icon: 'check', accent: UI.C.green,
    body: 'You have ' + need + ' Gunners in the Armoury. W1 keeps running the bench while you\u2019re here \u2014 keep it fed with scrap and it keeps building.\n\nHead to the Dock to defend the island.',
    buttons: [
      { label: 'STAY HERE', variant: 'secondary' },
      { label: 'TO THE DOCK', variant: 'primary', colour: UI.C.red, onTap: () => this.leave('DockScene') }
    ]
  });
}

// ── Update loop ────────────────────────────────────────────────────────────
update(time, delta) {
  const running = this.shouldFactoryRun();

  // Propagate freeze/unfreeze to in-flight walk tweens only
  if (running !== this._lastFactoryRun) {
    Object.values(this._workerWalkTweens).forEach(t => {
      if (!t || t.progress >= 1) return;
      running ? t.resume() : t.pause();
    });
    this._lastFactoryRun = running;
  }

  const completedWorkers = running ? this.factory.update(delta) : [];
  completedWorkers.forEach(workerId => {
    const w = this.factory.workers[workerId];
    if (w.station === 'depository') {
      const towerType = w._producedTowerType || 'gunner';
      w._producedTowerType = null;
      this.addTowerToStockpile(towerType);
    }
  });
  if (completedWorkers.length > 0) { this.factory.save(); this.updateStatus(); }
  // M6: towers delivered by belt; stores feeding belts change material counts
  const delivered = running ? this.factory.takeDeliveries() : [];
  delivered.forEach(t => this.addTowerToStockpile(t));
  const matSig = this.factory.materials.plasticScrap + '/' + this.factory.materials.salvagedMetal;
  if (matSig !== this._matSig) { this._matSig = matSig; this.updateMaterialDisplay(); }
  // Automated lines change state without worker events, so save every few seconds
  this._autosaveAcc = (this._autosaveAcc || 0) + delta;
  if (this._autosaveAcc > 4000) { this._autosaveAcc = 0; if (running) this.factory.save(); }
  if (running) this.runJobs();
  const statusSig = this.factory.workers.map(w => w.state + JSON.stringify(w.job) + (w.waitingFor || '') + w.inventory.join()).join('|');
  if (statusSig !== this._statusSig) { this._statusSig = statusSig; this.updateStatus(); }
  this.drawJobs();
  if (this.factory.lostFound !== this._lfSig) this.updateLostFound();

  this.factory.getUnlockedWorkers().forEach(w => {
    const sprite = this.workerSprites[w.id], label = this.workerLabels[w.id];
    if (sprite && label) label.setPosition(sprite.x, sprite.y);
  });

  const updateBar = (key) => {
    const bar = this.progressBars[key];
    if (!bar) return;
    const ww = this.factory.workers.find(w => w.unlocked && w.station === key && w.state === 'working');
    let prog = ww ? ww.progress : 0;
    if (!prog && key.includes(',')) {          // M6: machine working by itself
      const [r, c] = key.split(',').map(Number);
      const m = this.factory.getMachineAt(r, c);
      prog = (m && m.autoProgress) || 0;
    }
    if (prog > 0) bar.setSize(Math.max(1, bar._maxW * Math.min(1, prog)), 4).setAlpha(1);
    else bar.setAlpha(0);
  };
  updateBar('store_scrap');
  updateBar('store_metal');
  updateBar('depository');
  updateBar('lostfound');

  for (let r = 0; r < this.ROWS; r++) for (let c = 0; c < this.COLS; c++) {
    const key = r + ',' + c;
    updateBar(key);
    const machine = this.factory.getMachineAt(r, c);
    const statusTxt = this.machineStatusTexts[key];
    if (statusTxt && machine && this.factory.machineInput(machine)) {
      // A belt pointing in with the wrong material jams the feed (M4);
      // AUTO = loaded with a belt to output onto (M6); FULL = output belt blocked
      const jam  = this.factory.getBenchJam(r, c);
      const auto = this.factory.hasOutputBelt(r, c);
      const smelter = machine.type === 'smelter';
      const ready = machine.autoOutput && smelter && !auto;     // refined plastic waiting to be collected
      const text = jam ? 'WRONG ITEM' : ready ? 'READY' : machine.autoOutput ? 'OUTPUT FULL'
                 : machine.heldMaterial ? (smelter ? 'SMELTING' : auto ? 'AUTO' : 'LOADED') : '';
      if (statusTxt.text !== text) statusTxt.setText(text).setColor(jam || (machine.autoOutput && !ready) ? UI.T.red : ready ? UI.T.amber : UI.T.green);
    }
  }

  this._renderTileItems();
  if (this._workerMenu && this.workerMenuActive) {
    const m = this._workerMenu;
    if (this.workerMenuSig(m.key) !== m.sig) { m.dismiss(); this.openWorkerMenu(m.key); }
  }
  this.updateTutorial();
}

_renderTileItems() {
  if (!this._itemSprites) this._itemSprites = {};
  const colours = { plasticScrap: UI.C.blue, salvagedMetal: UI.C.green, refinedPlastic: UI.C.amber, towerComponent: 0xffffff };
  for (let r = 0; r < this.ROWS; r++) for (let c = 0; c < this.COLS; c++) {
    const key = r + ',' + c;
    const item = this.factory.getTileItem(r, c);
    const existing = this._itemSprites[key];
    if (item) {
      const { x, y } = this.tileCentre(r, c);
      const isTower = this.factory.isTowerItem(item);
      const colour = isTower ? (TOWER_DATA[this.factory.towerTypeOf(item)] || {}).colour || 0xffffff : (colours[item] || 0xffffff);
      if (!existing) this._itemSprites[key] = this.add.circle(x, y, 9, colour).setDepth(8);
      this._itemSprites[key].setPosition(x, y).setFillStyle(colour).setRadius(isTower ? 12 : 9)
        .setStrokeStyle(isTower ? 3 : 2, isTower ? 0xffffff : 0x0a0d12);
    } else if (existing) {
      existing.destroy();
      delete this._itemSprites[key];
    }
  }
}

addTowerToStockpile(type, quiet) {
  this.saveData = SaveManager.update(save => {
    if (!save.stockpile) save.stockpile = { gunner: 0, bomber: 0, barricade: 0 };
    save.stockpile[type] = (save.stockpile[type] || 0) + 1;
  }) || this.saveData;
  this.hdr.chips.towers.setValue(this.stockTotal()).pulse();
  if (!quiet) this.showMessage(type.charAt(0).toUpperCase() + type.slice(1) + ' added to the Armoury', 'good');
  this.factory.save();
}
}
