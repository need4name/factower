class CombatScene extends Phaser.Scene {
constructor() {
super({ key: 'CombatScene' });
}

init(data) {
this.storylineId = data.storylineId || 1;
this.levelId     = data.levelId     || 1;
this.levelData   = data.levelData;
this.isEndless   = data.isEndless   || false;
}

create() {
const width = this.scale.width;
// index.html sizes the page to the visible viewport (100dvh), so the
// whole canvas is always on screen and layout can use its full height.
this.H = this.scale.height;
const height = this.H;

this.saveData = SaveManager.load();

// ── Automation foundation (Milestone 0) ─────────────────────────────
// Mark the factory as inactive while the player is in combat. The flag
// is read by FactoryScene; it does nothing visible yet, but later
// milestones will use it to freeze workers/machines during waves.
this.setFactoryActive(false);

// ── State ────────────────────────────────────────────────────────────
this.parts             = 0;
// Base-branch skill upgrades (M7): max HP, damage reduction, fatal save
skillTreeEffects.rebuildFromSaveData(this.saveData);
this.baseHp            = Math.round((this.levelData ? this.levelData.baseHp : 10) * skillTreeEffects.getBaseHpMult());
this.baseHpMax         = this.baseHp;
this.fatalSaves        = skillTreeEffects.getFatalSaveCharges();
this.currentWave       = 0;
this.waveActive        = false;
this.gameOver          = false;
this.placedTowers      = [];
this.activeEnemies     = [];
this.projectiles       = [];   // shots in flight (see updateProjectiles)
this.pickups           = [];   // salvage lying on the road (see dropSalvage)
this.rare              = { plate: 0, engine: 0 };   // rare salvage collected this battle
this.pickupTapped      = false;
this.selectedTowerType = null;
this.killStats         = {};
this.towersUsed        = {};
this.towerTimerEvents  = [];
this.tutorialElements  = null;
this.waveEnemyTotal    = 0;
this.waveEnemyResolved = 0;
this.enemiesEscaped    = 0;
this.upgradePanel      = null;
this.activeTower       = null;
this.previewCircle     = null;
this.previewRing       = null;
this.previewMultText   = null;
this._pausedTweens     = null;
this._uiToast          = null;
this.towerTapped       = false;
this.tutorial         = null;
this._pendingSpawns    = 0;
this.selectedAbility   = null;
this.abilityPreview    = null;
this._startSig         = null;
this.abilityTapped     = false;
this.abilityLast       = {};        // ability key → simNow it was last used
this._upTut           = null;   // one-time 'how to upgrade' lesson (see updateUpgradeTutorial)
this.coach             = null;
this.simNow            = 0;      // tower fire-rate clock (scaled by speed, stops when paused)
this.speed             = 1;
this.paused            = false;
this._modalOpen        = false;
this._confirmedNoTowers = false;
this.time.timeScale = 1; this.tweens.timeScale = 1; this.time.paused = false;

this.towerStats = {};
TOWER_ORDER.forEach(t => { this.towerStats[t] = t === 'barricade' ? { placed: 0 } : { damageDealt: 0, kills: 0 }; });

const stockpile = (this.saveData && this.saveData.stockpile) ? this.saveData.stockpile : {};
this.loadout = {};
TOWER_ORDER.forEach(t => { this.loadout[t] = stockpile[t] || 0; });
this.startingLoadout = { ...this.loadout };

// ── Layout constants — tight to viewport ─────────────────────────────
// Header sits near top, play area fills middle, bottom panel pinned to
// visible viewport bottom (this.H). All vertical anchors derived from H.
this.HY          = 60;                            // header centre y (top edge ~14)
// Bottom panel layout (mirrors drawBottomPanel):
//   tower buttons centre   = H - 62
//   panel top / divider    = H - 124
//   HP strip centre        = H - 162  ← play area must end here
this.PANEL_TOP   = height - 124;
this.HP_STRIP_Y  = height - 162;
this.PLAY_TOP    = this.HY + 50;                  // 110 — just under header
this.PLAY_BOTTOM = this.HP_STRIP_Y - 22;          // gap above HP strip
this.PLAY_LEFT   = 14;
this.PLAY_RIGHT  = width - 14;
this.CT          = this.PLAY_TOP + 4;             // path entry y
this.CB          = this.PLAY_BOTTOM - 4;          // path exit y (BASE)

// ── Build level geometry ─────────────────────────────────────────────
// Path. Level data uses oy values that assume the original 418px tall play
// area (CT=262 → CB=680). Rescale to whatever play area we have now.
const ORIG_PATH_HEIGHT = 418;
const playH            = this.CB - this.CT;
const sy               = playH / ORIG_PATH_HEIGHT;

this.pathPoints = (this.levelData && this.levelData.path)
  ? this.levelData.path.map(p => ({ x: p.x, y: this.CT + p.oy * sy }))
  : [ // fallback S-curve, scaled to current play area
      { x: 195, y: this.CT             },
      { x: 195, y: this.CT +  52 * sy  },
      { x: 75,  y: this.CT +  52 * sy  },
      { x: 75,  y: this.CT + 185 * sy  },
      { x: 310, y: this.CT + 185 * sy  },
      { x: 310, y: this.CT + 308 * sy  },
      { x: 75,  y: this.CT + 308 * sy  },
      { x: 75,  y: this.CT + 375 * sy  },
      { x: 195, y: this.CT + 375 * sy  },
      { x: 195, y: this.CB             }
    ];

// UBZs — scaled vertically to match the rescaled path
this.ubzs = (this.levelData && this.levelData.ubzs)
  ? this.levelData.ubzs.map(z => ({ x: z.x, y: this.CT + z.oy * sy, w: z.w, h: z.h * sy }))
  : [];

// Hotspots — scaled vertically
if (this.isEndless) {
  this.hotspots = this.generateRandomHotspots();
} else {
  this.hotspots = (this.levelData && this.levelData.hotspots)
    ? this.levelData.hotspots.map(h => ({ x: h.x, y: this.CT + h.oy * sy, radius: h.radius, mult: h.mult }))
    : [];
}
// Stash the scale so tutorial-spot hints can use it
this._pathScaleY = sy;

// ── Draw scene ───────────────────────────────────────────────────────
UI.backdrop(this);
UI.fadeIn(this);
Art.ensure(this);
// Boat wakes: one shared emitter, fed from update()
this.wake = this.add.particles(0, 0, 'fx_dot', { lifespan: 800, scale: { start: 0.18, end: 0.7 }, alpha: { start: 0.2, end: 0 }, emitting: false }).setDepth(1.5);
this._wakeAcc = 0;
this.drawHotspots();
this.drawUBZs();
this.drawPath();
this.drawHeader();
this.drawBottomPanel();
this.drawAbilityButtons();
this.setupPlacementInput();

// ── Checks ───────────────────────────────────────────────────────────
const total = this.loadout.gunner + this.loadout.bomber + this.loadout.barricade;
const tutorialDone = this.saveData && this.saveData.tutorials && this.saveData.tutorials.combat1;
if (total === 0) {
  this._modalOpen = true;
  UI.modal(this, {
    title: 'No towers in stock', icon: 'shield', accent: UI.C.amber,
    body: 'You need towers to defend the island. Build them in the Factory, then come back.',
    buttons: [{ label: 'TO THE FACTORY', variant: 'primary', onTap: () => { this.setFactoryActive(true); UI.go(this, 'FactoryScene'); } }]
  });
} else if (this.storylineId === 1 && this.levelId === 1 && !this.isEndless && !tutorialDone) {
  this.startTutorial();
}

}

// ── Random hotspots for endless mode (REQ 3) ─────────────────────────
generateRandomHotspots() {
const count = 2 + Math.floor(Math.random() * 2);
const spots = [];
const playH = this.CB - this.CT;
for (let i = 0; i < count; i++) {
const x    = 65 + Math.random() * 255;
const y    = this.CT + 40 + Math.random() * (playH - 80);
const r    = 44 + Math.random() * 36;
const mult = Math.random() < 0.65 ? 1.1 + Math.random() * 0.22 : 0.78 + Math.random() * 0.12;
spots.push({ x, y, radius: r, mult });
}
return spots;
}

// ── Draw hotspot floor colouring (REQ 3) ─────────────────────────────
drawHotspots() {
const gfx = this.add.graphics().setDepth(0);
this.hotspots.forEach(h => {
const isBoost = h.mult >= 1;
const col     = isBoost ? 0xe8a020 : 0x1a4a8a;
const alpha   = isBoost ? 0.11 : 0.10;
// Soft radial fill — draw concentric circles decreasing in alpha
for (let r = h.radius; r > 0; r -= 8) {
const t = 1 - (r / h.radius);
gfx.fillStyle(col, alpha * (0.3 + t * 0.7));
gfx.fillCircle(h.x, h.y, r);
}
});
}

// ── Draw UBZ floor markings (REQ 2) ──────────────────────────────────
drawUBZs() {
const gfx = this.add.graphics().setDepth(1);
this.ubzs.forEach(z => {
gfx.fillStyle(0x2a1e10, 0.72);
gfx.fillRect(z.x, z.y, z.w, z.h);
gfx.lineStyle(1, 0x4a3820, 0.9);
gfx.strokeRect(z.x, z.y, z.w, z.h);
// Diagonal hatch — properly clipped to rect bounds
gfx.lineStyle(1, 0x3a2a15, 0.5);
// Lines starting on the top edge
for (let sx = 0; sx < z.w; sx += 14) {
const len = Math.min(z.w - sx, z.h);
gfx.lineBetween(z.x + sx, z.y, z.x + sx + len, z.y + len);
}
// Lines starting on the left edge (skip corner already covered)
for (let sy = 14; sy < z.h; sy += 14) {
const len = Math.min(z.h - sy, z.w);
gfx.lineBetween(z.x, z.y + sy, z.x + len, z.y + sy + len);
}
});
// UBZ label on each zone
this.ubzs.forEach(z => {
this.add.text(z.x + z.w / 2, z.y + z.h / 2, 'UBZ', {
fontFamily: 'monospace', fontSize: '9px', color: '#4a3820'
}).setOrigin(0.5).setDepth(1);
});
}

// ── Path collision ────────────────────────────────────────────────────
distToSegment(px, py, ax, ay, bx, by) {
const dx = bx - ax, dy = by - ay;
const lenSq = dx * dx + dy * dy;
if (lenSq === 0) return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);
const t  = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
return Math.sqrt((px - (ax + t * dx)) ** 2 + (py - (ay + t * dy)) ** 2);
}

isOnPath(x, y) {
for (let i = 0; i < this.pathPoints.length - 1; i++) {
const a = this.pathPoints[i], b = this.pathPoints[i + 1];
if (this.distToSegment(x, y, a.x, a.y, b.x, b.y) < 30) return true;
}
return false;
}

isInUBZ(x, y) {
return this.ubzs.some(z => x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h);
}

isOccupied(x, y) {
return this.placedTowers.some(t => Math.sqrt((t.x - x) ** 2 + (t.y - y) ** 2) < 32);
}

isInPlayArea(x, y) {
return x >= this.PLAY_LEFT && x <= this.PLAY_RIGHT &&
y >= this.PLAY_TOP  && y <= this.PLAY_BOTTOM;
}

canPlaceAt(x, y) {
return this.isInPlayArea(x, y) && !this.isOnPath(x, y) && !this.isOccupied(x, y) && !this.isInUBZ(x, y);
}

// ── Power multiplier from hotspots (REQ 3) ───────────────────────────
getPowerMultiplier(x, y) {
let best = 1.0;
this.hotspots.forEach(h => {
const dist = Math.sqrt((x - h.x) ** 2 + (y - h.y) ** 2);
if (dist <= h.radius) {
const t    = 1 - dist / h.radius;
const mult = 1 + (h.mult - 1) * t;
if (Math.abs(mult - 1) > Math.abs(best - 1)) best = mult;
}
});
return best;
}

// ── Input ─────────────────────────────────────────────────────────────

// ── Input ─────────────────────────────────────────────────────────────
setupPlacementInput() {
this.input.on('pointermove', (pointer) => {
  if (this.selectedAbility && !this.gameOver) {
    const r = this.abilityDefs()[this.selectedAbility].radius;
    if (!this.abilityPreview) this.abilityPreview = this.add.circle(0, 0, r, 0xffffff, 0.08).setStrokeStyle(2, 0xffffff, 0.5).setDepth(6);
    this.abilityPreview.setPosition(pointer.x, pointer.y).setRadius(r);
    return;
  }
  if (!this.selectedTowerType || this.gameOver || this._modalOpen) return;
  if (!this.isInPlayArea(pointer.x, pointer.y)) { this.hidePreview(); return; }
  this.updatePreview(pointer.x, pointer.y);
});

this.input.on('pointerup', (pointer) => {
  if (this.gameOver || this._modalOpen) return;
  // These are scene-wide listeners, so the tutorial's dimmer can't swallow
  // them — ask the coach whether this point is blocked.
  if (this.coach && this.coach.blocks(pointer.x, pointer.y)) return;
  if (this.pickupTapped) { this.pickupTapped = false; return; }   // that tap collected salvage
  if (this.abilityTapped) { this.abilityTapped = false; return; }  // that tap was on an ability button
  if (this.selectedAbility) {
    if (this.isInPlayArea(pointer.x, pointer.y)) this.castAbility(this.selectedAbility, pointer.x, pointer.y);
    return;
  }

  if (this.upgradePanel) {
    if (!this.towerTapped) this.dismissUpgradePanel();
    this.towerTapped = false;
    return;
  }
  if (!this.selectedTowerType) return;
  if (!this.isInPlayArea(pointer.x, pointer.y)) return;
  if (this.canPlaceAt(pointer.x, pointer.y)) this.placeTower(pointer.x, pointer.y);
  else {
    const why = this.isOnPath(pointer.x, pointer.y) ? 'Towers can’t go on the road'
              : this.isInUBZ(pointer.x, pointer.y)  ? 'Unstable ground — can’t build here'
              : this.isOccupied(pointer.x, pointer.y) ? 'Too close to another tower' : 'Can’t build here';
    UI.toast(this, why, 'bad', { y: this.PLAY_TOP + 22 });
  }
});

this.input.on('pointerout', () => this.hidePreview());
}

// Length of road (px) inside a circle — how much of the path a tower reaches
roadCoverage(x, y, r) {
  let len = 0;
  for (let i = 0; i < this.pathPoints.length - 1; i++) {
    const a = this.pathPoints[i], b = this.pathPoints[i + 1];
    const L = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.ceil(L / 6));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      if (Math.hypot(a.x + (b.x - a.x) * t - x, a.y + (b.y - a.y) * t - y) <= r) len += L / n;
    }
  }
  return len;
}

// 0–4 rating: 2× the radius is a straight pass through the ring's centre;
// bends that wrap around a tower score higher.
coverageRating(x, y, r) {
  const ratio = this.roadCoverage(x, y, r) / (2 * r);
  return ratio < 0.15 ? 0 : ratio < 0.7 ? 1 : ratio < 1.2 ? 2 : ratio < 1.7 ? 3 : 4;
}

// ── Preview (REQ 8 — clears on placement) ────────────────────────────

// ── Placement preview: ring + road-coverage meter ─────────────────────
updatePreview(x, y) {
const data  = TOWER_DATA[this.selectedTowerType];
const valid = this.canPlaceAt(x, y);
const mult  = valid ? this.getPowerMultiplier(x, y) : 1;
const range = Math.round(data.range * (Math.abs(mult - 1) > 0.04 ? mult : 1));
const colour = valid ? data.colour : UI.C.red;

if (!this.previewCircle) {
  this.previewCircle = this.add.circle(x, y, 14, colour, 0.35).setDepth(15);
  this.previewRing   = this.add.circle(x, y, range).setDepth(15);
  this.previewMultText = UI.text(this, x, y, '', 'tag', { size: 12, origin: [0.5, 1], depth: 16 })
    .setBackgroundColor('#0a0d12').setPadding(8, 4, 8, 4);
}
this.previewCircle.setPosition(x, y).setFillStyle(colour, 0.35);
this.previewRing.setPosition(x, y).setRadius(range).setFillStyle(colour, 0.07).setStrokeStyle(1.5, colour, 0.6);

let label, col;
if (!valid) {
  label = this.isOnPath(x, y) ? 'ON THE ROAD' : this.isInUBZ(x, y) ? 'UNSTABLE GROUND' : this.isOccupied(x, y) ? 'TOO CLOSE' : 'CAN’T BUILD';
  col = UI.T.red;
} else {
  const r = this.coverageRating(x, y, range);
  label = ['NO ROAD IN RANGE', 'WEAK SPOT', 'OK SPOT', 'GOOD SPOT', 'GREAT SPOT'][r] + '  ' + '▮'.repeat(r) + '▯'.repeat(4 - r);
  col = [UI.T.red, UI.T.amber, UI.T.dim, UI.T.green, UI.T.green][r];
  if (Math.abs(mult - 1) > 0.04) label += '   ' + (mult > 1 ? '+' : '') + Math.round((mult - 1) * 100) + '% POWER';
}
const ly = y - 34 < this.PLAY_TOP + 10 ? y + 48 : y - 24;
this.previewMultText.setText(label).setColor(col).setPosition(Phaser.Math.Clamp(x, 110, this.scale.width - 110), ly);
}

hidePreview() {
if (this.previewCircle)   { this.previewCircle.destroy();   this.previewCircle   = null; }
if (this.previewRing)     { this.previewRing.destroy();     this.previewRing     = null; }
if (this.previewMultText) { this.previewMultText.destroy(); this.previewMultText = null; }
}

// ── Tower placement (REQ 3, 8) ────────────────────────────────────────
placeTower(x, y) {
if (this.loadout[this.selectedTowerType] <= 0) return;

const type = this.selectedTowerType;
const data = TOWER_DATA[type];
const mult = this.getPowerMultiplier(x, y);

// Apply power multiplier to tower stats (REQ 3)
const towerData = { ...data };
if (Math.abs(mult - 1) > 0.04) {
  towerData.damage = Math.round(towerData.damage * mult);
  towerData.range  = Math.round(towerData.range  * mult);
  if (towerData.slowAmount) towerData.slowAmount = parseFloat((towerData.slowAmount / mult).toFixed(3));
}

const hitZone    = this.add.circle(x, y, 20, 0xffffff, 0).setDepth(10).setInteractive();
const art        = Art.tower(this, x, y, type);
const towerCircle = art.base.setDepth(4);
const towerLabel  = art.head.setDepth(4.5).setRotation(-Math.PI / 2);
// Drop-in: the platform lands with a little bounce
[art.base, art.head].forEach(o => { const sc = o.scale; o.setScale(sc * 1.35).setAlpha(0); this.tweens.add({ targets: o, scale: sc, alpha: 1, duration: 220, ease: 'Back.easeOut' }); });

if (type === 'barricade') {
  this.add.circle(x, y, towerData.range, data.colour, 0.04).setDepth(2);
  this.add.circle(x, y, towerData.range).setStrokeStyle(1, data.colour, 0.2).setDepth(2);
  this.towerStats.barricade.placed++;
} else {
  const ring = this.add.circle(x, y, towerData.range, data.colour, 0.08).setDepth(2);
  const rb   = this.add.circle(x, y, towerData.range).setStrokeStyle(1, data.colour, 0.3).setDepth(2);
  this.time.delayedCall(1400, () => { ring.destroy(); rb.destroy(); });
}

// Power multiplier badge on tower
let powerBadge = null;
if (Math.abs(mult - 1) > 0.04) {
  const sign  = mult > 1 ? '+' : '';
  const pct   = sign + Math.round((mult - 1) * 100) + '%';
  const col   = mult > 1 ? '#e8a020' : '#4a8aba';
  powerBadge = this.add.text(x + 15, y - 15, pct, {
    fontFamily: 'monospace', fontSize: '9px', color: col, fontStyle: 'bold'
  }).setDepth(6);
  this.time.delayedCall(2200, () => { if (powerBadge) { this.tweens.add({ targets: powerBadge, alpha: 0, duration: 400, onComplete: () => powerBadge.destroy() }); } });
}

this.loadout[type]--;
if (this.loadout[type] === 0) this.selectedTowerType = null;
this.refreshTowerButtons();
this.towersUsed[type] = (this.towersUsed[type] || 0) + 1;

// A barrel that turns to face whatever the tower is shooting at
const barrel = type === 'barricade' ? null : towerLabel;
if (type === 'barricade') this.tweens.add({ targets: towerLabel, angle: 360, duration: 9000, repeat: -1 });   // the spiked boom turns slowly
const tower = { type, x, y, data: towerData, lastFired: -1e9, upgradeTier: 0, mods: [0, 0, 0], targetMode: 'first', towerCircle, towerLabel, tierBadge: null, hitZone, powerMult: mult, barrel };
this.placedTowers.push(tower);

hitZone.on('pointerup', () => {
  this.towerTapped = true;
  if (this.coach && this.coach.blocks(x, y)) return;
  this.selectedTowerType = null;
  this.refreshTowerButtons();
  this.hidePreview();
  this.showUpgradePanel(tower);
});

if (type !== 'barricade') {
  const timerEvent = this.time.addEvent({ delay: 120, callback: () => this.towerShoot(tower), loop: true });
  this.towerTimerEvents.push(timerEvent);
}

// REQ 8: clear preview after placing — hidePreview not updatePreview
this.hidePreview();

this.tutorialTowerPlaced();
}

// ── Upgrade panel ─────────────────────────────────────────────────────
upgradesUnlocked() {
return Progress.has(this.saveData, 'mods') || this.isEndless || (isTestSave(this.saveData) && BUILD.allUpgrades);
}

// ── Upgrade lesson ────────────────────────────────────────────────────
// The first time upgrades are available and the player can afford one, the
// battle pauses and the Coach walks them through it: tap a tower → spend
// Parts → see what changed.
updateUpgradeTutorial() {
if (this.gameOver || this.tutorial || !this.upgradesUnlocked()) return;
const tuts = (this.saveData && this.saveData.tutorials) || {};
if (tuts.upgrades) return;
this.coach = this.coach || new Coach(this, { depth: 300 });
const ut = this._upTut || (this._upTut = { step: 'wait' });
if (ut.step === 'wait') {
  if (this._modalOpen || this.upgradePanel) return;
  const tower = this.placedTowers.find(t => {
    return [0, 1, 2].some(i => this.canTakePath(t, i) && this.canAffordMod(this.nextMod(t, i)));
  });
  if (!tower) return;
  ut.step = 'tap'; ut.tower = tower;
  this.setPaused(true);
  this.coach.show({ key: 'up-tap', tag: 'NEW: UPGRADES', target: { x: tower.x, y: tower.y, w: 44, h: 44 }, pad: 6, dim: 0.6,
    title: 'Patch up a tower',
    body: 'You\u2019ve salvaged ' + this.parts + ' Parts from wrecked raiders. Bolt them onto a tower to make it stronger. Tap this ' + this.titleCase(tower.data.name) + '.' });
} else if (ut.step === 'tap' && this.upgradePanel && this._upgradeBtn && this._upgradeBtn.isEnabled()) {
  // Any tower they can afford to upgrade will do
  ut.step = 'buy'; ut.tower = this.activeTower;
  const b = this._upgradeBtn;
  this.coach.show({ key: 'up-buy', target: { x: b.x, y: b.y, w: b.bw, h: b.bh }, placement: 'above',
    title: 'Spend the Parts',
    body: 'Each tower has three mod paths and can use any two. Tier-3 mods also need a rare part from an elite wreck.' });
} else if (ut.step === 'buy' && ut.tower.upgradeTier > 0) {
  ut.step = 'done';
  this.dismissUpgradePanel();
  this.coach.show({ key: 'up-done', tag: 'UPGRADED',
    title: 'Stronger already',
    body: 'Upgrades only last for this battle. Keep salvaging Parts and spend them on the towers doing the most work.',
    button: { label: 'BACK TO THE FIGHT', onTap: () => {
      this.coach.hide();
      this.setPaused(false);
      if (this.saveData) { if (!this.saveData.tutorials) this.saveData.tutorials = {}; this.saveData.tutorials.upgrades = true; }
      SaveManager.update(s => { if (!s.tutorials) s.tutorials = {}; s.tutorials.upgrades = true; });
    } } });
} else if (ut.step === 'buy' && !this.upgradePanel) {
  // Closed the panel without buying: point back at the tower
  ut.step = 'wait'; this.coach.hide(); this.setPaused(false);
}
}

// A tower can take mods from any two of its three paths
modPathsUsed(tower) { return tower.mods.filter(t => t > 0).length; }
canTakePath(tower, i) { return tower.mods[i] > 0 || this.modPathsUsed(tower) < 2; }
nextMod(tower, i) { return TOWER_DATA[tower.type].mods[i].tiers[tower.mods[i]] || null; }
canAffordMod(m) { return !!m && this.parts >= m.cost && (!m.rare || this.rare[m.rare] > 0); }

showUpgradePanel(tower) {
this.dismissUpgradePanel();
this.activeTower = tower;
const width = this.scale.width;
const colour = tower.data.colour;
const paths = TOWER_DATA[tower.type].mods;
const items = [];
const D = 18;

items.push(this.add.circle(tower.x, tower.y, tower.data.range, colour, 0.10).setDepth(3));
items.push(this.add.circle(tower.x, tower.y, tower.data.range).setStrokeStyle(2, colour, 0.6).setDepth(3));

const unlocked = this.upgradesUnlocked();
const modsAt   = Progress.levelName(UNLOCKS.mods.at);
const rowH = 58, h = unlocked ? 64 + paths.length * rowH + 8 : 120;
const cy = this.HP_STRIP_Y - 24 - h / 2, lx = 12 + 18;
items.push(UI.panel(this, width / 2, cy, width - 24, h, { fill: UI.C.surface, stroke: colour, strokeAlpha: 0.7, radius: 16, depth: D }));
const top = cy - h / 2;
items.push(UI.text(this, lx, top + 20, this.titleCase(tower.data.name), 'heading', { size: 17, origin: [0, 0.5], depth: D + 1, color: UI.hex(colour) }));
const rareTxt = Object.keys(this.rare).filter(k => this.rare[k] > 0).map(k => this.rare[k] + ' ' + RARE_PARTS[k].name).join(' \u00b7 ');
if (tower.type !== 'barricade') {
  const modes = ['first', 'strong', 'close', 'last'];
  items.push(UI.button(this, width - 12 - 16 - 56, top + 22, 112, 30, {
    label: 'AIM: ' + (tower.targetMode || 'first').toUpperCase(), variant: 'outline', colour: colour, size: 11, depth: D + 2,
    onTap: () => { this.towerTapped = true; tower.targetMode = modes[(modes.indexOf(tower.targetMode || 'first') + 1) % modes.length]; this.showUpgradePanel(tower); }
  }));
}
let info = this.parts + ' Parts' + (rareTxt ? ' \u00b7 ' + rareTxt : '') + '  \u00b7  mods: pick any two paths';
if (tower.powerMult && Math.abs(tower.powerMult - 1) > 0.04) info += '  \u00b7  power zone ' + (tower.powerMult > 1 ? '+' : '') + Math.round((tower.powerMult - 1) * 100) + '%';
items.push(UI.text(this, lx, top + 40, info, 'small', { size: 11, origin: [0, 0.5], depth: D + 1 }));

this._upgradeBtn = null;
if (!unlocked) {
  items.push(UI.text(this, lx, top + 74, 'Mods unlock after ' + modsAt + '. Then you can bolt salvaged Parts onto towers mid-battle.', 'small',
    { size: 12, wrap: width - 64, depth: D + 1 }));
} else {
  paths.forEach((path, i) => {
    const ry = top + 64 + i * rowH + rowH / 2;
    const tier = tower.mods[i], next = this.nextMod(tower, i);
    const open = this.canTakePath(tower, i);
    if (i > 0) items.push(this.add.rectangle(width / 2, ry - rowH / 2, width - 56, 1, UI.C.lineSoft).setDepth(D + 1));
    items.push(UI.text(this, lx, ry - 11, path.name, 'tag', { size: 10.5, origin: [0, 0.5], depth: D + 1, color: open ? UI.T.dim : UI.T.faint }));
    for (let k = 0; k < 3; k++) items.push(this.add.circle(lx + 104 + k * 11, ry - 11, 3.5, k < tier ? colour : UI.C.line).setDepth(D + 1));
    const desc = !next ? 'Fully modded' : !open ? 'Two paths already in use' : next.name + ': ' + next.label + (next.rare ? '  (needs ' + RARE_PARTS[next.rare].name + ')' : '');
    items.push(UI.text(this, lx, ry + 9, desc, 'small', { size: 11, origin: [0, 0.5], depth: D + 1, wrap: width - 150, color: open && next ? UI.T.text : UI.T.faint }));
    if (next && open) {
      const ok = this.canAffordMod(next);
      const btn = UI.button(this, width - 12 - 16 - 44, ry, 88, 40, {
        label: next.cost + ' P' + (next.rare ? ' +\u2605' : ''), variant: ok ? 'primary' : 'secondary', colour: UI.C.amber,
        disabled: !ok, depth: D + 2, size: 13, onTap: () => this.applyUpgrade(tower, i)
      });
      items.push(btn);
      if (ok && !this._upgradeBtn) this._upgradeBtn = btn;
    }
  });
}
// Panel swallows taps so they don't fall through to the map
const shield = this.add.zone(width / 2, cy, width - 24, h).setInteractive().setDepth(D);
shield.on('pointerup', () => { this.towerTapped = true; });
items.push(shield);
this.upgradePanel = items;
}

dismissUpgradePanel() {
if (this.upgradePanel) {
this.upgradePanel.forEach(e => { if (e && e.destroy) e.destroy(); });
this.upgradePanel = null;
}
this.activeTower = null;
}

applyUpgrade(tower, pathIdx) {
if (!tower) return;
const i = pathIdx || 0;
const m = this.nextMod(tower, i);
if (!m || !this.canTakePath(tower, i) || !this.canAffordMod(m)) return;

this.parts -= m.cost;
if (m.rare) this.rare[m.rare]--;
this.partsText.setText('' + this.parts);
tower.mods[i]++;
tower.upgradeTier++;

const d = tower.data;
if (m.fireRate     !== undefined) d.fireRate     = m.fireRate;
if (m.damageBonus  !== undefined) d.damage      += m.damageBonus;
if (m.rangeBonus   !== undefined) d.range       += m.rangeBonus;
if (m.splashRadius !== undefined) d.splashRadius = m.splashRadius;
if (m.slowAmount   !== undefined) d.slowAmount   = m.slowAmount;
if (m.pierce)      d.pierce      = (d.pierce || 0) + m.pierce;
if (m.scatter)     d.scatter     = m.scatter;
if (m.doubleShot)  d.doubleShot  = true;
if (m.napalm)      d.napalm      = m.napalm;
if (m.armourBonus) d.armourBonus = m.armourBonus;
if (m.dps)         d.dps         = m.dps;
if (m.beams)       d.beams       = m.beams;

if (m.burnDps) {
  d.burnDps = m.burnDps;
  if (!tower.burnEvent) {
    // Spike strip: damage everything in the field twice a second (ignores armour)
    tower.burnEvent = this.time.addEvent({
      delay: 500, loop: true,
      callback: () => {
        if (!this.waveActive || this.gameOver) return;
        this.activeEnemies.forEach(enemy => {
          if (!enemy.alive || !enemy.sprite || !enemy.sprite.active) return;
          if (Phaser.Math.Distance.Between(tower.x, tower.y, enemy.sprite.x, enemy.sprite.y) <= d.range) {
            this.dealDamage(enemy, d.burnDps * 0.5, 'barricade', { trueDamage: true });
          }
        });
      }
    });
    this.towerTimerEvents.push(tower.burnEvent);
  }
}

if (tower.tierBadge) tower.tierBadge.destroy();
tower.tierBadge = UI.text(this, tower.x + 13, tower.y - 19, '+' + tower.upgradeTier, 'tag', { size: 10, color: UI.T.amber, depth: 6 });

const flash = this.add.circle(tower.x, tower.y, 28, d.colour, 0.45).setDepth(6);
this.tweens.add({ targets: flash, alpha: 0, scaleX: 2, scaleY: 2, duration: 380, onComplete: () => flash.destroy() });
UI.toast(this, m.name + ' fitted', 'good', { y: this.PLAY_TOP + 22, duration: 1400 });

this.showUpgradePanel(tower);
}

// ── Level 1 tutorial system (REQ 9) ──────────────────────────────────

// ── Level 1 tutorial ──────────────────────────────────────────────────
// Spotlight-guided first battle (see Coach.js). Explains the road, the
// base, range rings and why placement matters, then hands over control.
startTutorial() {
  this.tutorial = { step: 'intro', placed: 0 };
  this.coach = this.coach || new Coach(this, { depth: 300 });
  this.events.once('shutdown', () => this.coach && this.coach.destroy());
}

tutorialSpot(i) {
  const spots = this.levelData.tutorialSpots || [];
  const s = spots[i];
  return s ? { x: s.x, y: this.CT + s.oy * this._pathScaleY } : null;
}

updateTutorial() {
  const t = this.tutorial;
  if (!t || !this.coach) return;
  if (this.upgradePanel || this._modalOpen) { this.coach.hide(); return; }
  const width = this.scale.width;
  const gun = this.towerButtons.gunner;
  const need = Math.min(this.levelData.recommendedTowers || 2, this.startingLoadout.gunner);

  if (t.step === 'intro') {
    this.coach.show({ key: 'intro', tag: 'FIRST BATTLE', title: 'Defend the island',
      body: 'Raiders walk the road from the top of the map down to your BASE. Each one that gets through costs 2 base HP — you have ' + this.baseHpMax + '. Lose it all and the island falls.\n\nYour towers fire automatically at anything inside their range ring.',
      button: { label: 'GOT IT', onTap: () => { t.step = 'place'; this.coach.hide(); } } });
    return;
  }
  if (t.step === 'place') {
    if (t.placed >= need || this.loadout.gunner <= 0) { t.step = 'start'; return; }
    const n = t.placed + 1;
    if (this.selectedTowerType !== 'gunner') {
      this.coach.show({ key: 'select' + n, step: n, total: need + 1, target: { x: gun.x, y: gun.y, w: gun.w, h: gun.h },
        title: n === 1 ? 'Pick up a Gunner' : 'Now the second Gunner',
        body: n === 1 ? 'Tap GUNNER. These are the towers you built in the Factory.' : 'One tower can’t cover the whole road. Tap GUNNER again.' });
      return;
    }
    const spot = this.tutorialSpot(t.placed) || { x: width / 2, y: (this.PLAY_TOP + this.PLAY_BOTTOM) / 2 };
    this.coach.show({ key: 'place' + n, step: n, total: need + 1, target: { x: spot.x, y: spot.y, w: 76, h: 76 }, pad: 6, dim: 0.55,
      title: n === 1 ? 'Place it where the road bends' : 'Cover the other bend',
      body: n === 1 ? 'The road doubles back here, so raiders stay in range for longer. Tap the highlighted spot. The coverage meter shows how much road a spot can reach.'
                    : 'Spread your towers out so raiders are under fire for as much of the road as possible.' });
    return;
  }
  if (t.step === 'start') {
    const b = this.startWaveBtn;
    this.coach.show({ key: 'start', step: need + 1, total: need + 1, target: { x: b.x, y: b.y, w: b.bw, h: b.bh },
      title: 'Start the wave', body: 'Towers can’t be moved once placed. When you’re ready, send the raiders in. Use 1× / 2× at the top to change speed.' });
  }
}

tutorialTowerPlaced() {
  if (!this.tutorial || this.tutorial.step !== 'place') return;
  this.tutorial.placed++;
}

tutorialWaveStarted() {
  if (!this.tutorial) return;
  this.tutorial = null;
  if (this.coach) this.coach.hide();
  SaveManager.update(s => { if (!s.tutorials) s.tutorials = {}; s.tutorials.combat1 = true; });
}


// ── Scene drawing ─────────────────────────────────────────────────────

// ── Road ──────────────────────────────────────────────────────────────
// The battle map: fused-plastic raft decking with water channels cut through
// it. Raiders sail the channels; towers stand on the decking.
drawPath() {
const map = Art.drawMap(this, this.pathPoints, { x: this.PLAY_LEFT, y: this.PLAY_TOP, w: this.PLAY_RIGHT - this.PLAY_LEFT, h: this.PLAY_BOTTOM - this.PLAY_TOP }, this.storylineId);
this.waterFx = map.water;
this._mapTheme = map.theme;

// Direction chevrons along the road
const cg = this.add.graphics().setDepth(1.3);
cg.lineStyle(2, this._mapTheme.glint, 0.3);
for (let i = 0; i < this.pathPoints.length - 1; i++) {
  const a = this.pathPoints[i], b = this.pathPoints[i + 1];
  const L = Math.hypot(b.x - a.x, b.y - a.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
  for (let d = 30; d < L - 16; d += 56) {
    const x = a.x + Math.cos(ang) * d, y = a.y + Math.sin(ang) * d;
    const bx = Math.cos(ang), by = Math.sin(ang), px = -by, py = bx;
    cg.beginPath(); cg.moveTo(x - bx * 5 + px * 6, y - by * 5 + py * 6); cg.lineTo(x + bx * 3, y + by * 3); cg.lineTo(x - bx * 5 - px * 6, y - by * 5 - py * 6); cg.strokePath();
  }
}

const start = this.pathPoints[0];
const startRight = start.x > this.scale.width - 130;
UI.text(this, start.x + (startRight ? -28 : 28), this.CT + 10, 'RAIDERS ENTER', 'tag', { size: 10, origin: [startRight ? 1 : 0, 0.5], color: UI.T.red, depth: 2 });
const exitPt = this.pathPoints[this.pathPoints.length - 1];
const baseRight = exitPt.x > this.scale.width - 110;   // keep the label on screen
UI.text(this, exitPt.x + (baseRight ? -28 : 28), this.CB - 10, 'YOUR BASE', 'tag', { size: 10, origin: [baseRight ? 1 : 0, 0.5], color: UI.T.blue, depth: 2 });
}

// ── Header redesign (REQ 7) ───────────────────────────────────────────
// Row 1: BACK | level name | wave X/Y
// Row 2: ◈ parts counter  (prominent, left)
// HP bar near BASE at the bottom (drawn in drawBottomPanel)

// ── HUD header ────────────────────────────────────────────────────────
// Back (abort) · level name + wave · speed toggle · parts
drawHeader() {
const width = this.scale.width;
const H = this.PLAY_TOP - 6;
const g = this.add.graphics().setDepth(12);
g.fillStyle(UI.C.bg, 0.94); g.fillRect(0, 0, width, H);
g.fillStyle(UI.C.line, 1);  g.fillRect(0, H - 1, width, 1);

// Back → abort confirm
const back = UI.button(this, 36, 40, 44, 44, { variant: 'secondary', radius: 22, depth: 13, onTap: () => this.showAbortConfirm() });
back.add(UI.icon(this, -1, 0, 'back', 14, 0xeef2f7));

UI.text(this, 70, 30, this.levelData ? this.titleCase(this.levelData.name) : 'Level', 'heading', { size: 17, origin: [0, 0.5], depth: 13 });
this.waveIndicator = UI.text(this, 70, 52, 'WAVE 0 / ' + this.levelData.waves.length, 'label', { size: 11, origin: [0, 0.5], depth: 13 });

// Parts chip (spend on upgrades mid-battle)
this.partsText = UI.chip(this, 0, 40, 'parts', 0, { depth: 13 });
this.partsText.x = width - 16 - this.partsText.cw / 2;

// Speed toggle
this.speedBtn = UI.button(this, this.partsText.x - this.partsText.cw / 2 - 30, 40, 48, 34, {
  label: '1×', variant: 'secondary', size: 14, radius: 17, depth: 13, onTap: () => this.toggleSpeed()
});

// Status line
this.waveText = UI.text(this, width / 2, 84, 'Place your towers, then start the wave', 'small',
  { size: 12, origin: 0.5, color: UI.T.dim, depth: 13 });
}

// ── Bottom panel (REQ 7 — HP near base) ──────────────────────────────

// ── Bottom panel: base HP + tower picker + start ───────────────────────
drawBottomPanel() {
const width = this.scale.width;
const height = this.H;

// Base HP strip
const hy = this.HP_STRIP_Y;
const strip = this.add.graphics().setDepth(9);
strip.fillStyle(UI.C.bg, 0.94); strip.fillRect(0, hy - 20, width, height - hy + 20);
strip.fillStyle(UI.C.line, 1);  strip.fillRect(0, hy - 20, width, 1);
UI.icon(this, 28, hy, 'shield', 15, UI.C.blue).setDepth(10);
UI.text(this, 44, hy, 'BASE', 'label', { size: 11, origin: [0, 0.5], depth: 10 });
this.hpText = UI.text(this, width - 16, hy, this.baseHp + ' / ' + this.baseHpMax, 'number', { size: 15, origin: [1, 0.5], depth: 10, color: UI.T.green });
this.hpBarX = 92; this.hpBarW = width - 16 - 64 - this.hpBarX;
this.hpBarBg = this.add.graphics().setDepth(10);
this.hpBarBg.fillStyle(UI.C.surface2, 1); this.hpBarBg.fillRoundedRect(this.hpBarX, hy - 5, this.hpBarW, 10, 5);
this.hpBarFill = this.add.graphics().setDepth(10);
this.updateHpBar();

// Tower buttons — one per tower type brought into this battle. Up to 3
// sit in one row; more wrap into two compact rows.
let types = TOWER_ORDER.filter(t => this.startingLoadout[t] > 0);
if (!types.length) types = ['gunner'];
const gap = 8, startW = 96;
const compact = types.length > 3;
const perRow = compact ? Math.ceil(types.length / 2) : types.length;
const bw = (width - 32 - startW - gap * perRow) / perRow;
const bh = compact ? 50 : 92;
const by = this.PANEL_TOP + 58;
this.towerButtons = {};
types.forEach((type, i) => {
  const d = TOWER_DATA[type];
  const row = compact ? Math.floor(i / perRow) : 0, col = compact ? i % perRow : i;
  const x = 16 + bw / 2 + col * (bw + gap);
  const y = compact ? this.PANEL_TOP + 8 + bh / 2 + row * (bh + 8) : by;
  const c = this.add.container(x, y).setDepth(10);
  const bg = this.add.graphics();
  const disc = this.add.graphics();
  const label = compact ? (d.short || this.titleCase(d.name)) : this.titleCase(d.name);
  const name = UI.text(this, compact ? -bw / 2 + 28 : 0, compact ? -8 : 10, label, 'tag', { size: compact ? 11 : 12.5, origin: compact ? [0, 0.5] : 0.5, color: UI.T.text });
  const countText = UI.text(this, compact ? -bw / 2 + 28 : 0, compact ? 9 : 30, 'x' + this.loadout[type], 'number', { size: compact ? 13 : 15, origin: compact ? [0, 0.5] : 0.5 });
  const zone = this.add.zone(0, 0, bw, bh).setInteractive();
  // The tower's own turret art as its icon
  const ix = compact ? -bw / 2 + 15 : 0, iy = compact ? 0 : -20, isz = compact ? 0.5 : 0.65;
  const icon = this.add.image(ix, iy, 'twr_head_' + type).setScale(isz / Art.RES * 1.6).setRotation(-Math.PI / 2);
  c.add([bg, disc, icon, name, countText, zone]);
  const btn = { container: c, countText, x, y, w: bw, h: bh, type };
  btn.draw = () => {
    const has = this.loadout[type] > 0, sel = this.selectedTowerType === type;
    UI.drawPanel(bg, 0, 0, bw, bh, { fill: sel ? 0x1d2734 : (has ? UI.C.surface : 0x10151c),
      stroke: sel ? d.colour : (has ? UI.C.line : UI.C.lineSoft), strokeWidth: sel ? 2 : 1, radius: compact ? 10 : 14 });
    disc.clear();
    const dx = compact ? -bw / 2 + 15 : 0, dy = compact ? 0 : -20, r = compact ? 11 : 15;
    disc.fillStyle(0x0b0f14, 1); disc.fillCircle(dx, dy, r);
    disc.lineStyle(1.5, has ? d.colour : UI.C.line, has ? 0.8 : 0.5); disc.strokeCircle(dx, dy, r);
    icon.setAlpha(has ? 1 : 0.35);
    name.setColor(has ? UI.T.text : UI.T.faint);
    countText.setText('x' + this.loadout[type]).setColor(has ? UI.hex(d.colour) : UI.T.faint);
  };
  // Legacy callers set fills / count text directly; route them to draw()
  btn.setFillStyle = () => btn.draw();
  btn.draw();
  zone.on('pointerdown', () => this.selectTower(type));
  this.towerButtons[type] = btn;
});

// Start wave
const sx = width - 16 - startW / 2;
this.startWaveBtn = UI.button(this, sx, by, startW, 92, {
  label: 'START', sub: 'WAVE 1', variant: 'success', size: 17, depth: 10,
  onTap: () => this.waveActive ? this.callWaveEarly() : this.startNextWave()
});
this.startWaveBtn.y = by;
}

refreshTowerButtons() {
  Object.values(this.towerButtons).forEach(b => b.draw());
}

titleCase(str) { return UI.titleCase(str); }

toggleSpeed() {
  this.speed = this.speed === 2 ? 1 : 2;
  this.applyTimeScale();
  this.speedBtn.setLabel(this.speed + '×');
  this.speedBtn.setVariant(this.speed === 2 ? 'primary' : 'secondary');
}

// Game speed and pause both act on Phaser's clock + tweens, plus our own
// simNow (tower fire-rate clock — Phaser's time.now ignores timeScale).
applyTimeScale() {
  const scale = this.speed || 1;
  this.time.timeScale = scale;
  this.tweens.timeScale = scale;
}

// Pauses the tweens that exist right now (enemy movement, shots, effects)
// rather than the whole tween manager, so the pause dialog itself can still
// animate in and its buttons still respond.
setPaused(paused) {
  this.paused = paused;
  this.time.paused = paused;
  if (paused) {
    this._pausedTweens = this.tweens.getTweens().filter(t => t.isPlaying());
    this._pausedTweens.forEach(t => t.pause());
  } else {
    (this._pausedTweens || []).forEach(t => { if (t.isPaused()) t.resume(); });
    this._pausedTweens = null;
  }
}

updateHpBar() {
if (!this.hpBarFill) return;
const pct = Math.max(0, this.baseHp / this.baseHpMax);
const col = pct > 0.5 ? UI.C.green : pct > 0.25 ? UI.C.amber : UI.C.red;
this.hpBarFill.clear();
if (pct > 0) { this.hpBarFill.fillStyle(col, 1); this.hpBarFill.fillRoundedRect(this.hpBarX, this.HP_STRIP_Y - 5, Math.max(10, this.hpBarW * pct), 10, 5); }
if (this.hpText) this.hpText.setText(this.baseHp + ' / ' + this.baseHpMax).setColor(UI.hex(col));
}

selectTower(type) {
if (this.loadout[type] <= 0) {
  if (!this.gameOver) UI.toast(this, 'No ' + this.titleCase(TOWER_DATA[type].name) + 's left — build more in the Factory', 'warn');
  return;
}
if (this.gameOver) return;
this.dismissUpgradePanel();
this.selectedAbility = null;
if (this.abilityPreview) { this.abilityPreview.destroy(); this.abilityPreview = null; }
this.selectedTowerType = type;
this.refreshTowerButtons();
}

// ── Combat ────────────────────────────────────────────────────────────
getSpeedModifier(enemy) {
let modifier = 1.0;
if (enemy.netUntil && enemy.netUntil > this.simNow) modifier = 0.15;
this.placedTowers.forEach(tower => {
if (tower.type !== 'barricade') return;
if (Phaser.Math.Distance.Between(tower.x, tower.y, enemy.sprite.x, enemy.sprite.y) <= tower.data.range) {
modifier = Math.min(modifier, tower.data.slowAmount);
}
});
return modifier;
}

// ── Siphon ────────────────────────────────────────────────────────────
// Beams lock onto up to `beams` raiders in range and drain dps from each.
// Raiders that die in a beam drop double salvage, collected automatically.
siphonTick(tower) {
const d = tower.data;
const now = this.simNow;
const dt = Math.min(500, now - (tower.lastTick || now));
tower.lastTick = now;
if (!tower.beamGfx) tower.beamGfx = this.add.graphics().setDepth(6);
const g = tower.beamGfx;
g.clear();
const inRange = this.activeEnemies.filter(e => e.alive && e.sprite && e.sprite.active &&
  Phaser.Math.Distance.Between(tower.x, tower.y, e.sprite.x, e.sprite.y) <= d.range);
if (!inRange.length) return;
const first = this.pickTarget(tower, inRange);
const targets = [first].concat(inRange.filter(e => e !== first).slice(0, (d.beams || 1) - 1));
if (tower.barrel) tower.barrel.setRotation(Phaser.Math.Angle.Between(tower.x, tower.y, first.sprite.x, first.sprite.y));
targets.forEach(e => {
  const flick = 0.55 + Math.random() * 0.35;
  g.lineStyle(4, 0x9d7ff0, flick * 0.5); g.lineBetween(tower.x, tower.y, e.sprite.x, e.sprite.y);
  g.lineStyle(1.5, 0xe9ddff, flick);     g.lineBetween(tower.x, tower.y, e.sprite.x, e.sprite.y);
  e.siphonedUntil = now + 300;
  this.dealDamage(e, (d.dps || 12) * dt / 1000, 'siphon', { pierce: 2, beam: true });
});
}

// Target priority, set per tower from its panel
pickTarget(tower, list) {
const prog = e => {
  const nxt = this.pathPoints[e.moveTargetIdx] || this.pathPoints[this.pathPoints.length - 1];
  return (e.moveTargetIdx || 0) * 10000 - Phaser.Math.Distance.Between(e.sprite.x, e.sprite.y, nxt.x, nxt.y);
};
const by = {
  first:  (a, b) => prog(b) - prog(a),
  last:   (a, b) => prog(a) - prog(b),
  strong: (a, b) => b.hp - a.hp,
  close:  (a, b) => Phaser.Math.Distance.Between(tower.x, tower.y, a.sprite.x, a.sprite.y) - Phaser.Math.Distance.Between(tower.x, tower.y, b.sprite.x, b.sprite.y)
}[tower.targetMode || 'first'];
return list.slice().sort(by)[0];
}

towerShoot(tower) {
if (!this.waveActive || this.gameOver) { if (tower.beamGfx) tower.beamGfx.clear(); return; }
if (tower.type === 'barricade') return;
if (tower.type === 'siphon') return this.siphonTick(tower);
const rate = tower.data.fireRate;
if (this.simNow - tower.lastFired < rate) return;

const inRange = this.activeEnemies.filter(e => {
  if (!e.alive || !e.sprite || !e.sprite.active) return false;
  return Phaser.Math.Distance.Between(tower.x, tower.y, e.sprite.x, e.sprite.y) <= tower.data.range;
});
if (inRange.length === 0) return;

const target = this.pickTarget(tower, inRange);
// Keep the cadence on slow frames: step lastFired by the fire rate rather
// than snapping it to now, and fire again this frame if still behind.
// After an idle spell it restarts from now.
const behind = this.simNow - tower.lastFired >= rate * 3;
tower.lastFired = behind ? this.simNow : tower.lastFired + rate;
if (!behind && this.simNow - tower.lastFired >= rate && !tower._refire) {
  tower._refire = true; this.towerShoot(tower); tower._refire = false;
}

// Aim the barrel and kick it back a little
const ang = Phaser.Math.Angle.Between(tower.x, tower.y, target.sprite.x, target.sprite.y);
if (tower.barrel) {
  tower.barrel.setRotation(ang);
  const bx = tower.x - Math.cos(ang) * 3, by = tower.y - Math.sin(ang) * 3;
  this.tweens.add({ targets: tower.barrel, x: { from: bx, to: tower.x }, y: { from: by, to: tower.y }, duration: 90 });
}
// Shots home in on the raider's current position, so they never land
// behind a moving target. If it dies mid-flight the shot picks the
// nearest other raider, or fizzles.
const mx = tower.x + Math.cos(ang) * 16, my = tower.y + Math.sin(ang) * 16;
const bullet = this.add.circle(mx, my, tower.type === 'bomber' ? 6 : 3.5, tower.type === 'bomber' ? tower.data.colour : 0xfff2c4).setDepth(7);
this.projectiles.push({ bullet, target, tower, speed: tower.type === 'bomber' ? 340 : 700 });
if (tower.data.doubleShot) {
  // Double barrel: a second round at the next raider in range (or the same one)
  const second = inRange.find(e => e !== target) || target;
  const b2 = this.add.circle(mx, my, 3.5, 0xfff2c4).setDepth(7);
  this.time.delayedCall(70, () => this.projectiles.push({ bullet: b2, target: second, tower, speed: 700 }));
}
}

updateProjectiles(dt) {
if (!this.projectiles.length) return;
this.projectiles = this.projectiles.filter(p => {
  if (!p.bullet.active) return false;
  if (!p.target.alive || !p.target.sprite || !p.target.sprite.active) {
    const near = this.activeEnemies.filter(e => e.alive && e.sprite && e.sprite.active)
      .map(e => ({ e, d: Phaser.Math.Distance.Between(p.bullet.x, p.bullet.y, e.sprite.x, e.sprite.y) }))
      .filter(o => o.d < 90).sort((a, b) => a.d - b.d)[0];
    if (!near) { this.fizzle(p.bullet); return false; }
    p.target = near.e;
  }
  const tx = p.target.sprite.x, ty = p.target.sprite.y;
  const d = Phaser.Math.Distance.Between(p.bullet.x, p.bullet.y, tx, ty);
  const step = p.speed * dt / 1000;
  if (d <= step + (p.target.data.size || 8) * 0.5) {
    p.bullet.destroy();
    this.projectileHit(p.tower, p.target);
    return false;
  }
  p.bullet.x += (tx - p.bullet.x) / d * step;
  p.bullet.y += (ty - p.bullet.y) / d * step;
  return true;
});
}

fizzle(bullet) {
this.tweens.add({ targets: bullet, alpha: 0, scale: 0.3, duration: 120, onComplete: () => bullet.destroy() });
}

projectileHit(tower, target) {
if (!target.alive) return;
const d = tower.data;
const tx = target.sprite.x, ty = target.sprite.y;
const hitOpts = { pierce: d.pierce || 0 };
const dmgFor = (e) => d.damage + ((d.armourBonus && e.data.armour) ? d.armourBonus : 0);
if (tower.type === 'bomber') {
  const splashR = d.splashRadius || 80;
  this.activeEnemies.filter(e => {
    if (!e.alive || !e.sprite || !e.sprite.active) return false;
    return Phaser.Math.Distance.Between(tx, ty, e.sprite.x, e.sprite.y) <= splashR;
  }).forEach(e => {
    if (d.napalm) { e.burnDps = Math.max(e.burnDps, d.napalm); e.burnUntil = this.simNow + 3000; }
    this.dealDamage(e, dmgFor(e), 'bomber', hitOpts);
  });
  const flash = this.add.circle(tx, ty, splashR, d.napalm ? 0xe5534b : 0xe8a020, 0.28).setDepth(6);
  this.tweens.add({ targets: flash, alpha: 0, scaleX: 1.5, scaleY: 1.5, duration: 280, onComplete: () => flash.destroy() });
} else {
  // Small spark where the round lands
  const spark = this.add.circle(tx, ty, 5, 0xfff2c4, 0.9).setDepth(8);
  this.tweens.add({ targets: spark, alpha: 0, scale: 2, duration: 140, onComplete: () => spark.destroy() });
  if (d.scatter) {
    // Shrapnel: the nearest other raider takes a share
    const other = this.activeEnemies.filter(e => e !== target && e.alive && e.sprite && e.sprite.active)
      .map(e => ({ e, dd: Phaser.Math.Distance.Between(tx, ty, e.sprite.x, e.sprite.y) })).filter(o => o.dd < 60)
      .sort((a, b) => a.dd - b.dd)[0];
    if (other) this.dealDamage(other.e, Math.round(dmgFor(other.e) * d.scatter), tower.type, hitOpts);
  }
  this.dealDamage(target, dmgFor(target), tower.type, hitOpts);
}
}

// One card per new raider: what it does and what beats it
introduceRaiders(types, done) {
const type = types[0], d = ENEMY_DATA[type];
if (!this.saveData.seenEnemies) this.saveData.seenEnemies = {};
this.saveData.seenEnemies[type] = true;
SaveManager.update(s => { if (!s.seenEnemies) s.seenEnemies = {}; s.seenEnemies[type] = true; });
this._modalOpen = true;
this.hidePreview();
const midWave = this.waveActive;
if (midWave) this.setPaused(true);
UI.modal(this, {
  title: 'New raider: ' + d.card.title, icon: 'shield', accent: d.colour,
  body: d.card.trait + '\n\n' + d.card.body,
  buttons: [{ label: types.length > 1 ? 'NEXT' : 'GOT IT', variant: 'primary', colour: UI.C.red, onTap: () => {
    this._modalOpen = false;
    if (midWave) this.setPaused(false);
    if (types.length > 1) this.time.delayedCall(120, () => this.introduceRaiders(types.slice(1), done));
    else done();
  } }]
});
}

// ── Salvage ───────────────────────────────────────────────────────────
// Wrecked raiders leave salvage on the road. Tap it to collect Parts before
// it sinks. Elites also drop a rare part (needed for tier-3 mods).
dropSalvage(enemy) {
const x = enemy.sprite.x, y = enemy.sprite.y;
const rare = enemy.data.rareDrop || (Math.random() < 0.03 ? (Math.random() < 0.5 ? 'plate' : 'engine') : null);
if (enemy.siphonedUntil && enemy.siphonedUntil > this.simNow) {
  // Siphoned: double salvage, straight into Parts — nothing to tap
  const n = enemy.data.partsReward * 2;
  this.parts += n; this.partsText.setText('' + this.parts);
  if (rare) this.rare[rare]++;
  const t = UI.text(this, x, y - 12, '+' + n + (rare ? ' +\u2605' : ''), 'tag', { size: 12, origin: 0.5, color: '#c9b6ff', depth: 12 });
  this.tweens.add({ targets: t, y: y - 38, alpha: 0, duration: 700, onComplete: () => t.destroy() });
  return;
}
this.spawnPickup(x, y, { parts: enemy.data.partsReward });
if (rare) this.spawnPickup(x + 18, y - 10, { rare });
if (!this.salvageHintShown && !(this.saveData && this.saveData.tutorials && this.saveData.tutorials.salvage) && !this.tutorial) {
  this.salvageHintShown = true;
  UI.toast(this, 'Tap the salvage on the road to collect Parts before it sinks', 'info', { y: this.PLAY_TOP + 22, duration: 3500 });
}
}

spawnPickup(x, y, what) {
const isRare = !!what.rare;
const col = isRare ? RARE_PARTS[what.rare].colour : UI.C.amber;
const c = this.add.container(x, y).setDepth(9);
const g = this.add.graphics();
g.fillStyle(0x0a0d12, 0.85); g.fillCircle(0, 0, isRare ? 11 : 9);
g.lineStyle(2, col, 1); g.strokeCircle(0, 0, isRare ? 11 : 9);
const ic = UI.icon(this, 0, 0, isRare ? 'star' : 'gear', isRare ? 11 : 10, col);
c.add([g, ic]);
const zone = this.add.zone(x, y, 48, 48).setInteractive().setDepth(11);
const p = { c, zone, born: this.simNow, life: isRare ? 10000 : 7000, what, x, y };
zone.on('pointerdown', () => { this.pickupTapped = true; this.collectPickup(p); });
this.tweens.add({ targets: c, y: y - 3, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
c.setScale(0.2); this.tweens.add({ targets: c, scale: 1, duration: 180, ease: 'Back.easeOut' });
this.pickups.push(p);
}

collectPickup(p) {
if (p.done) return;
p.done = true;
p.zone.destroy();
let label;
if (p.what.rare) { this.rare[p.what.rare]++; label = '+1 ' + RARE_PARTS[p.what.rare].name; }
else { this.parts += p.what.parts; this.partsText.setText('' + this.parts); label = '+' + p.what.parts; }
const t = UI.text(this, p.c.x, p.c.y - 12, label, 'tag', { size: 12, origin: 0.5, color: p.what.rare ? UI.hex(RARE_PARTS[p.what.rare].colour) : UI.T.amber, depth: 12 });
this.tweens.add({ targets: t, y: t.y - 26, alpha: 0, duration: 650, onComplete: () => t.destroy() });
this.tweens.killTweensOf(p.c);
this.tweens.add({ targets: p.c, scale: 1.5, alpha: 0, duration: 160, onComplete: () => p.c.destroy() });
if (this.saveData && (!this.saveData.tutorials || !this.saveData.tutorials.salvage)) {
  if (!this.saveData.tutorials) this.saveData.tutorials = {};
  this.saveData.tutorials.salvage = true;
  SaveManager.update(s => { if (!s.tutorials) s.tutorials = {}; s.tutorials.salvage = true; });
}
if (this.upgradePanel && this.activeTower) this.showUpgradePanel(this.activeTower);
}

// Uncollected salvage sinks; healers patch up raiders; burning raiders burn
updateBattleTicks() {
this.pickups = this.pickups.filter(p => {
  if (p.done) return false;
  const age = this.simNow - p.born;
  if (age > p.life) {
    p.zone.destroy(); this.tweens.killTweensOf(p.c);
    this.tweens.add({ targets: p.c, alpha: 0, scale: 0.4, duration: 250, onComplete: () => p.c.destroy() });
    return false;
  }
  if (age > p.life - 2000) p.c.setAlpha(0.35 + 0.65 * Math.abs(Math.sin(age / 120)));   // blinking: about to sink
  return true;
});
this.activeEnemies.forEach(e => {
  if (!e.alive || !e.sprite || !e.sprite.active) return;
  if (e.sprite.aura) e.sprite.aura.setPosition(e.sprite.x, e.sprite.y);
  this.shieldTick(e);
  const h = e.data.heal;
  if (h && this.simNow - e.lastHeal >= h.every) {
    e.lastHeal = this.simNow;
    let healed = false;
    this.activeEnemies.forEach(o => {
      if (!o.alive || o === e || o.hp >= o.maxHp || !o.sprite) return;
      if (Phaser.Math.Distance.Between(e.sprite.x, e.sprite.y, o.sprite.x, o.sprite.y) > h.radius) return;
      o.hp = Math.min(o.maxHp, o.hp + h.amount); healed = true;
      const plus = UI.text(this, o.sprite.x, o.sprite.y - 14, '+', 'title', { size: 16, origin: 0.5, color: UI.T.green, depth: 12 });
      this.tweens.add({ targets: plus, y: plus.y - 14, alpha: 0, duration: 500, onComplete: () => plus.destroy() });
    });
    if (healed && e.sprite.aura) this.tweens.add({ targets: e.sprite.aura, alpha: { from: 1, to: 0.4 }, duration: 300 });
  }
  if (e.burnUntil > this.simNow && e.burnDps > 0) {
    e._burnAcc = (e._burnAcc || 0) + this._tickDt;
    if (e._burnAcc >= 500) { e._burnAcc -= 500; this.dealDamage(e, e.burnDps * 0.5, 'bomber', { trueDamage: true }); }
  }
});
}

// Shields recharge (fully, over a second) once a raider goes untouched for
// shield.regen ms; projectors top up allies; spawners launch boats.
shieldTick(e) {
const sd = e.data.shield;
if (sd && e.shield < e.maxShield && this.simNow - e.lastHitAt >= sd.regen) {
  e.shield = Math.min(e.maxShield, e.shield + e.maxShield * this._tickDt / 1000);
}
if (e.ring) {
  e.ring.setPosition(e.sprite.x, e.sprite.y);
  e.ring.setAlpha(e.shield > 0 ? 0.3 + 0.7 * e.shield / Math.max(1, e.maxShield) : 0);
}
const a = e.data.shieldAura;
if (a && this.simNow - e.lastHeal >= a.every) {
  e.lastHeal = this.simNow;
  this.activeEnemies.forEach(o => {
    if (!o.alive || o === e || !o.sprite) return;
    if (Phaser.Math.Distance.Between(e.sprite.x, e.sprite.y, o.sprite.x, o.sprite.y) > a.radius) return;
    o.maxShield = Math.max(o.maxShield || 0, a.amount);
    o.shield = Math.min(o.maxShield, (o.shield || 0) + a.amount);
    this.addShieldRing(o);
  });
  if (e.sprite.aura) this.tweens.add({ targets: e.sprite.aura, alpha: { from: 1, to: 0.4 }, duration: 300 });
}
const sp = e.data.spawn;
if (sp) {
  const enraged = e.hp < e.maxHp * 0.5;
  if (enraged && !e.enraged) {
    e.enraged = true;
    UI.toast(this, (e.data.card ? e.data.card.title : 'The flagship') + ' is listing — Skiffs pouring out!', 'warn', { y: this.PLAY_TOP + 26 });
  }
  if (this.simNow - e.lastSpawn >= (enraged ? sp.enragedEvery : sp.every)) {
    e.lastSpawn = this.simNow;
    for (let i = 0; i < sp.count; i++) {
      this.waveEnemyTotal++;
      this.spawnEnemy(sp.type, { x: e.sprite.x + (i - (sp.count - 1) / 2) * 14, y: e.sprite.y, idx: e.moveTargetIdx || 1 });
    }
  }
}
}

// opts.pierce ignores that much armour; opts.trueDamage ignores it all (burns);
// opts.beam (Siphon) goes straight through shields
dealDamage(enemy, damage, sourceType, opts) {
if (!enemy.alive) return;
const o = opts || {};
enemy.lastHitAt = this.simNow;
// Shields soak the hit before armour; beams and burns slip past them
if (enemy.shield > 0 && !o.trueDamage && !o.beam) {
  const soak = Math.min(enemy.shield, damage);
  enemy.shield -= soak; damage -= soak;
  if (enemy.shield <= 0) { enemy.shield = 0; this.shieldBreak(enemy); }
  if (damage <= 0) return;
}
const armour = o.trueDamage ? 0 : Math.max(0, (enemy.data.armour || 0) - (o.pierce || 0));
if (armour > 0) damage = Math.max(1, damage - armour);
enemy.hp -= damage;
if (sourceType && this.towerStats[sourceType] && this.towerStats[sourceType].damageDealt !== undefined) {
this.towerStats[sourceType].damageDealt += damage;
}
if (enemy.sprite && enemy.sprite.active) {
this.tweens.add({ targets: enemy.sprite, alpha: 0.3, duration: 60, yoyo: true });
}
if (enemy.hp <= 0) this.killEnemy(enemy, sourceType);
}

// Wreck effect: a ring of foam and a few bits of debris
splash(x, y, size, colour) {
const ring = this.add.image(x, y, 'fx_ring').setScale(size / 32).setAlpha(0.7).setDepth(6.5);
this.tweens.add({ targets: ring, scale: size / 10, alpha: 0, duration: 520, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
const n = size > 16 ? 8 : 5;
for (let i = 0; i < n; i++) {
  const a = Math.random() * Math.PI * 2, d = size * (0.8 + Math.random() * 1.2);
  const chip = this.add.image(x, y, 'fx_chip').setTint(i % 2 ? colour : 0xdfe6ee).setScale(0.35 + Math.random() * 0.4).setDepth(6.6);
  this.tweens.add({ targets: chip, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, angle: Math.random() * 360, alpha: 0,
    duration: 380 + Math.random() * 260, ease: 'Quad.easeOut', onComplete: () => chip.destroy() });
}
}

shieldBreak(enemy) {
if (!enemy.sprite || !enemy.sprite.active) return;
const pop = this.add.circle(enemy.sprite.x, enemy.sprite.y, enemy.data.size + 5, 0x7fe3ff, 0).setStrokeStyle(3, 0x7fe3ff, 1).setDepth(9);
this.tweens.add({ targets: pop, scale: 1.8, alpha: 0, duration: 260, onComplete: () => pop.destroy() });
}

killEnemy(enemy, sourceType) {
if (!enemy.alive) return;
enemy.alive = false;
this.activeEnemies = this.activeEnemies.filter(e => e !== enemy);
this.dropSalvage(enemy);
this.killStats[enemy.type] = (this.killStats[enemy.type] || 0) + 1;
if (sourceType && this.towerStats[sourceType] && this.towerStats[sourceType].kills !== undefined) {
this.towerStats[sourceType].kills++;
}
if (enemy.sprite && enemy.sprite.aura) { enemy.sprite.aura.destroy(); enemy.sprite.aura = null; }
if (enemy.ring) { enemy.ring.destroy(); enemy.ring = null; }
if (enemy.hpBg)   { enemy.hpBg.destroy();   enemy.hpBg   = null; }
if (enemy.hpFill) { enemy.hpFill.destroy();  enemy.hpFill = null; }
if (enemy.sprite && enemy.sprite.active) {
this.splash(enemy.sprite.x, enemy.sprite.y, enemy.data.size, enemy.data.colour);
if (enemy.turnTween) enemy.turnTween.stop();
// Sink: list over, shrink and fade
this.tweens.add({
targets: enemy.sprite, alpha: 0, scaleX: enemy.sprite.scaleX * 0.6, scaleY: enemy.sprite.scaleY * 0.6,
rotation: enemy.sprite.rotation + 0.6, duration: 420, ease: 'Quad.easeIn',
onComplete: () => { if (enemy.sprite) enemy.sprite.destroy(); }
});
}
if (this.upgradePanel && this.activeTower) this.showUpgradePanel(this.activeTower);
this.waveEnemyResolved++;
this.checkWaveComplete();
}

// ── Wave management ───────────────────────────────────────────────────

startNextWave() {
if (this.waveActive || this.gameOver) return;
if (this.currentWave >= this.levelData.waves.length) return;
if (this.placedTowers.length === 0 && this.currentWave === 0 && !this._confirmedNoTowers) {
  UI.modal(this, {
    title: 'Start with no towers?', icon: 'shield', accent: UI.C.amber,
    body: 'Nothing is defending the road yet. Pick a tower below and tap the map to place it first.',
    buttons: [{ label: 'PLACE TOWERS', variant: 'primary' },
              { label: 'START ANYWAY', variant: 'secondary', onTap: () => { this._confirmedNoTowers = true; this.startNextWave(); } }]
  });
  return;
}

// First time a raider with a trait shows up, introduce it before the wave
const upcoming = this.levelData.waves[this.currentWave];
const seen = (this.saveData && this.saveData.seenEnemies) || {};
const fresh = [...new Set(upcoming.enemies.map(g => g.type))]
  .filter(t => !seen[t] && ENEMY_DATA[t] && (ENEMY_DATA[t].traits || []).length && ENEMY_DATA[t].card);
if (fresh.length) { this.introduceRaiders(fresh, () => this.startNextWave()); return; }

if (this.tutorial) this.tutorialWaveStarted();

this.hidePreview();
this.dismissUpgradePanel();
this.selectedTowerType = null;
this.refreshTowerButtons();

const waveData = this.levelData.waves[this.currentWave];
const total = this.levelData.waves.length;
this.waveActive = true;

this.startWaveBtn.setEnabled(false).setLabel('WAVE ' + (this.currentWave + 1), 'IN PROGRESS');
this.waveIndicator.setText('WAVE ' + (this.currentWave + 1) + ' / ' + total);
this.waveText.setText('Raiders incoming…').setColor(UI.T.amber);

const width = this.scale.width;
const banner = UI.text(this, width / 2, this.H / 2 - 60, 'WAVE ' + (this.currentWave + 1), 'hero', { size: 48, origin: 0.5, color: UI.T.red, depth: 25 });
const sub = UI.text(this, width / 2, this.H / 2 - 18, 'INCOMING', 'label', { size: 14, origin: 0.5, color: UI.T.red, depth: 25, ls: 6 });
[banner, sub].forEach(t => t.setAlpha(0));
this.tweens.add({ targets: [banner, sub], alpha: 1, duration: 220,
  onComplete: () => this.tweens.add({ targets: [banner, sub], alpha: 0, duration: 450, delay: 650, onComplete: () => { banner.destroy(); sub.destroy(); } }) });

// The player pressed START, so raiders arrive as the banner fades — no
// long silent wait (preWaveDelay in the level data is ignored)
this._awaitingSpawn = true;     // no calling early until this wave is under way
this.time.delayedCall(500, () => {
  this._awaitingSpawn = false;
  if (this.gameOver) return;
  this.waveText.setText('Wave ' + (this.currentWave + 1) + ' of ' + total + ' — hold the line').setColor(UI.T.dim);
  this.spawnWave(waveData);
});
}

// REQ 10: Irregular rhythm — burst spawning with variable gaps
// accumulate: a wave called early adds to the one still on the road
spawnWave(waveData, accumulate) {
let totalDelay = 0;
const n = waveData.enemies.reduce((s, g) => s + g.count, 0);
if (accumulate) this.waveEnemyTotal += n;
else { this.waveEnemyTotal = n; this.waveEnemyResolved = 0; }
this._pendingSpawns = (this._pendingSpawns || 0) + n;

waveData.enemies.forEach(group => {
  let i = 0;
  while (i < group.count) {
    // 28% chance of burst: 2-3 enemies very close together
    const canBurst  = (i + 2) < group.count;
    const doBurst   = canBurst && Math.random() < 0.28;
    const burstSize = doBurst ? (Math.random() < 0.5 ? 2 : 3) : 1;

    for (let b = 0; b < burstSize && i < group.count; b++, i++) {
      const burstOffset = b > 0 ? 120 + Math.random() * 280 : 0;
      const spawnDelay  = totalDelay + burstOffset;
      this.time.delayedCall(spawnDelay, () => {
        this._pendingSpawns--;
        if (!this.gameOver) this.spawnEnemy(group.type);
      });
    }

    // Gap after this cluster: longer after burst, irregular otherwise
    if (doBurst) {
      totalDelay += group.interval * (1.3 + Math.random() * 0.9);
    } else {
      // Irregular: sometimes short (0.55x), sometimes long (1.45x)
      const r = Math.random();
      const gapMult = r < 0.2 ? 0.45 + Math.random() * 0.2
                    : r < 0.8 ? 0.75 + Math.random() * 0.5
                    : 1.3    + Math.random() * 0.6;
      totalDelay += Math.max(140, group.interval * gapMult);
    }
  }
});

}

// from = { x, y, idx }: start mid-path (boats launched by a spawner boss)
spawnEnemy(type, from) {
const data   = ENEMY_DATA[type];
const start  = from || this.pathPoints[0];
const sprite = Art.boat(this, start.x, start.y, type).setDepth(7);
const barW   = Math.max(data.size * 2.5, 22);
const hpBg   = this.add.rectangle(start.x, start.y - data.size - 7, barW, 4, 0x2a3a4a).setDepth(8);
const hpFill = this.add.rectangle(start.x - barW / 2, start.y - data.size - 7, barW, 4, 0x5eba7d).setOrigin(0, 0.5).setDepth(8);

const traits = data.traits || [];
if (traits.includes('healer')) {
  const aura = this.add.circle(start.x, start.y, data.heal.radius, 0x52c47f, 0.06).setStrokeStyle(1, 0x52c47f, 0.35).setDepth(5);
  sprite.aura = aura;
}
if (data.shieldAura) {
  sprite.aura = this.add.circle(start.x, start.y, data.shieldAura.radius, 0x7fe3ff, 0.05).setStrokeStyle(1, 0x7fe3ff, 0.35).setDepth(5);
}
// hpScale (per level) toughens hulls and shields without new waves
const k = (this.levelData && this.levelData.hpScale) || 1;
const shield = data.shield ? Math.round(data.shield.hp * k) : 0, hp = Math.round(data.hp * k);
const enemy = { type, data: { ...data }, sprite, hp, maxHp: hp, alive: true, pathProgress: 0, hpBg, hpFill,
  lastHeal: this.simNow, burnDps: 0, burnUntil: 0, shield, maxShield: shield, lastHitAt: 0, lastSpawn: this.simNow };
if (shield) this.addShieldRing(enemy);
this.activeEnemies.push(enemy);
this.moveToWaypoint(enemy, from ? from.idx : 1);

}

addShieldRing(enemy) {
if (enemy.ring || !enemy.sprite) return;
enemy.ring = this.add.circle(enemy.sprite.x, enemy.sprite.y, enemy.data.size + 4, 0x7fe3ff, 0.12).setStrokeStyle(2, 0x7fe3ff, 0.95).setDepth(8);
}

moveToWaypoint(enemy, idx) {
if (!enemy.alive || this.gameOver) return;
if (idx >= this.pathPoints.length) { this.enemyReachedEnd(enemy); return; }

const target         = this.pathPoints[idx];
const dist           = Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, target.x, target.y);
enemy.pathProgress   = idx;
enemy.moveTargetIdx  = idx;
enemy.lastSpeedMod   = this.getSpeedModifier(enemy);

if (enemy.moveTween) { enemy.moveTween.stop(); enemy.moveTween = null; }

// Turn the bow toward the next waypoint (the short way round)
const heading = Math.atan2(target.y - enemy.sprite.y, target.x - enemy.sprite.x);
if (dist > 1) {
  if (enemy.turnTween) enemy.turnTween.stop();
  const cur = enemy.sprite.rotation;
  enemy.turnTween = this.tweens.add({ targets: enemy.sprite, rotation: cur + Phaser.Math.Angle.Wrap(heading - cur), duration: enemy.moveTween === undefined ? 1 : 180 });
}

enemy.moveTween = this.tweens.add({
  targets: enemy.sprite, x: target.x, y: target.y,
  duration: (dist / (enemy.data.speed * enemy.lastSpeedMod)) * 1000, ease: 'Linear',
  onComplete: () => {
    enemy.moveTween = null;
    if (enemy.alive) this.moveToWaypoint(enemy, idx + 1);
  }
});

}

enemyReachedEnd(enemy) {
if (!enemy.alive) return;
enemy.alive = false;
this.activeEnemies = this.activeEnemies.filter(e => e !== enemy);
this.enemiesEscaped++;
if (enemy.sprite && enemy.sprite.aura) { enemy.sprite.aura.destroy(); enemy.sprite.aura = null; }
if (enemy.ring) { enemy.ring.destroy(); enemy.ring = null; }
if (enemy.hpBg)   { enemy.hpBg.destroy();   enemy.hpBg   = null; }
if (enemy.hpFill) { enemy.hpFill.destroy();  enemy.hpFill = null; }
if (enemy.sprite) enemy.sprite.destroy();

this.baseHp -= Math.max(1, enemy.data.baseDamage - skillTreeEffects.getBaseDamageReduction());
if (this.baseHp <= 0 && this.fatalSaves > 0) {
  // Iron Fortress: survive one fatal hit per level at 1 HP
  this.fatalSaves--;
  this.baseHp = 1;
  UI.toast(this, 'Iron Fortress held — the base survives at 1 HP', 'warn', { y: this.PLAY_TOP + 26 });
}
if (this.baseHp < 0) this.baseHp = 0;
this.updateHpBar();
this.cameras.main.shake(140, 0.007);

if (this.baseHp <= 0) { this.triggerGameOver(false); return; }
this.waveEnemyResolved++;
this.checkWaveComplete();

}

// ── Abilities ─────────────────────────────────────────────────────────
// Two tools on cooldowns: tap the button, then tap the map.
abilityDefs() {
return {
  flare: { name: 'FLARE', icon: 'star', colour: UI.C.amber, radius: 70, cooldown: 25000,
           hint: 'Tap the road to drop a flare barrage' },
  net:   { name: 'NET',   icon: 'shield', colour: 0x8fb3c9, radius: 80, cooldown: 20000,
           hint: 'Tap the road to throw a cargo net' }
};
}

drawAbilityButtons() {
this.abilityBtns = {};
if (!Progress.has(this.saveData, 'abilities') && !this.isEndless) return;
const width = this.scale.width;
Object.entries(this.abilityDefs()).forEach(([key, a], i) => {
  // Bottom-right, unless the road ends there — then bottom-left
  const end = this.pathPoints[this.pathPoints.length - 1];
  const x = end.x > width - 110 ? 34 : width - 34, y = this.PLAY_BOTTOM - 34 - i * 62;
  const c = this.add.container(x, y).setDepth(11);
  const ring = this.add.graphics();
  const ic = UI.icon(this, 0, -4, a.icon, 15, a.colour);
  const lbl = UI.text(this, 0, 14, a.name, 'tag', { size: 8.5, origin: 0.5, color: UI.T.dim });
  const cd = UI.text(this, 0, -4, '', 'number', { size: 14, origin: 0.5, color: UI.T.text });
  const zone = this.add.zone(0, 0, 54, 54).setInteractive();
  c.add([ring, ic, lbl, cd, zone]);
  zone.on('pointerdown', () => {
    this.abilityTapped = true;
    if (this.gameOver || this.abilityCooldownLeft(key) > 0) return;
    this.selectedTowerType = null; this.refreshTowerButtons(); this.hidePreview(); this.dismissUpgradePanel();
    this.selectedAbility = this.selectedAbility === key ? null : key;
    if (this.selectedAbility) UI.toast(this, a.hint, 'info', { y: this.PLAY_TOP + 22, duration: 1600 });
    this._abSig = null;
  });
  this.abilityBtns[key] = { c, ring, ic, cd, a };
});
}

abilityCooldownLeft(key) {
const last = this.abilityLast[key];
if (last === undefined) return 0;
return Math.max(0, this.abilityDefs()[key].cooldown - (this.simNow - last));
}

updateAbilityButtons() {
if (!this.abilityBtns) return;
Object.entries(this.abilityBtns).forEach(([key, b]) => {
  const left = this.abilityCooldownLeft(key), sel = this.selectedAbility === key;
  const sig = Math.ceil(left / 1000) + (sel ? 's' : '');
  if (b.sig === sig) return;
  b.sig = sig;
  const frac = left / b.a.cooldown;
  b.ring.clear();
  b.ring.fillStyle(sel ? 0x1d2734 : UI.C.surface, 0.95); b.ring.fillCircle(0, 0, 25);
  b.ring.lineStyle(sel ? 3 : 2, left > 0 ? UI.C.line : b.a.colour, 1); b.ring.strokeCircle(0, 0, 25);
  if (left > 0) {
    b.ring.lineStyle(3, b.a.colour, 0.9);
    b.ring.beginPath(); b.ring.arc(0, 0, 25, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - frac)); b.ring.strokePath();
  }
  b.ic.setAlpha(left > 0 ? 0.25 : 1);
  b.cd.setText(left > 0 ? String(Math.ceil(left / 1000)) : '');
});
}

castAbility(key, x, y) {
const a = this.abilityDefs()[key];
this.selectedAbility = null;
this.abilityLast[key] = this.simNow;
if (this.abilityPreview) { this.abilityPreview.destroy(); this.abilityPreview = null; }
if (key === 'flare') {
  // A short whistle, then a blast that ignores some armour
  const mark = this.add.circle(x, y, a.radius, UI.C.amber, 0.12).setStrokeStyle(2, UI.C.amber, 0.7).setDepth(6);
  this.tweens.add({ targets: mark, alpha: 0.5, duration: 150, yoyo: true, repeat: 1 });
  this.time.delayedCall(600, () => {
    mark.destroy();
    if (this.gameOver) return;
    const boom = this.add.circle(x, y, a.radius, 0xffd27a, 0.55).setDepth(8);
    this.tweens.add({ targets: boom, alpha: 0, scale: 1.25, duration: 320, onComplete: () => boom.destroy() });
    this.cameras.main.shake(120, 0.004);
    this.activeEnemies.slice().forEach(e => {
      if (!e.alive || !e.sprite) return;
      if (Phaser.Math.Distance.Between(x, y, e.sprite.x, e.sprite.y) <= a.radius) this.dealDamage(e, 45, 'flare', { pierce: 3 });
    });
  });
} else {
  // Cargo net: raiders inside barely move for a few seconds
  const net = this.add.circle(x, y, a.radius, 0x8fb3c9, 0.14).setStrokeStyle(2, 0x8fb3c9, 0.8).setDepth(3);
  this.tweens.add({ targets: net, alpha: 0, delay: 3200, duration: 800, onComplete: () => net.destroy() });
  this.activeEnemies.forEach(e => {
    if (!e.alive || !e.sprite) return;
    if (Phaser.Math.Distance.Between(x, y, e.sprite.x, e.sprite.y) <= a.radius) { e.netUntil = this.simNow + 4000; this.moveToWaypoint(e, e.moveTargetIdx); }
  });
}
}

// ── Call the next wave early ──────────────────────────────────────────
// Once the current wave has finished arriving, START becomes CALL EARLY:
// the next wave comes straight away and pays bonus Parts for the risk.
earlyBonus() { return 4 + this.activeEnemies.filter(e => e.alive).length; }

canCallEarly() {
return this.waveActive && !this.gameOver && !this.tutorial && !this._awaitingSpawn && this._pendingSpawns <= 0
  && this.currentWave + 1 < this.levelData.waves.length;
}

callWaveEarly() {
if (!this.canCallEarly()) return;
const nextIdx = this.currentWave + 1;
const next = this.levelData.waves[nextIdx];
const seen = (this.saveData && this.saveData.seenEnemies) || {};
const fresh = [...new Set(next.enemies.map(g => g.type))]
  .filter(t => !seen[t] && ENEMY_DATA[t] && (ENEMY_DATA[t].traits || []).length && ENEMY_DATA[t].card);
if (fresh.length) { this.introduceRaiders(fresh, () => this.callWaveEarly()); return; }
const bonus = this.earlyBonus();
this.parts += bonus;
this.partsText.setText('' + this.parts);
this.currentWave = nextIdx;
this.waveIndicator.setText('WAVE ' + (nextIdx + 1) + ' / ' + this.levelData.waves.length);
UI.toast(this, 'Wave ' + (nextIdx + 1) + ' called early  +' + bonus + ' Parts', 'good', { y: this.PLAY_TOP + 22, duration: 1600 });
this.spawnWave(next, true);
}

updateStartButton() {
if (!this.startWaveBtn || this.gameOver) return;
let sig;
if (!this.waveActive) return;
if (this.canCallEarly()) sig = 'early' + this.earlyBonus();
else sig = 'busy' + this.currentWave;
if (sig === this._startSig) return;
this._startSig = sig;
if (this.canCallEarly()) this.startWaveBtn.setEnabled(true).setVariant('primary', UI.C.amber).setLabel('EARLY', '+' + this.earlyBonus() + ' PARTS');
else this.startWaveBtn.setEnabled(false).setVariant('success').setLabel('WAVE ' + (this.currentWave + 1), 'IN PROGRESS');
}

checkWaveComplete() {
if (!this.waveActive || this.gameOver) return;
if (this.waveEnemyResolved < this.waveEnemyTotal || this._pendingSpawns > 0) return;

this.time.delayedCall(1200, () => {
  if (!this.waveActive) return;
  // A wave called early in the meantime keeps this one going
  if (this.waveEnemyResolved < this.waveEnemyTotal || this._pendingSpawns > 0) return;
  this.waveActive = false;
  this.currentWave++;
  if (this.currentWave >= this.levelData.waves.length) {
    this.time.delayedCall(400, () => this.triggerGameOver(true));
    return;
  }
  this._showWaveFlavour(this.currentWave);
  const left = Object.values(this.loadout).reduce((a, b) => a + b, 0);
  this.waveText.setText('Wave ' + this.currentWave + ' cleared' + (left > 0 ? ' — place more towers if you have them' : ''))
    .setColor(UI.T.green);
  this._startSig = null;
  this.startWaveBtn.setEnabled(true).setVariant('success').setLabel('START', 'WAVE ' + (this.currentWave + 1));
});
}

_showWaveFlavour(wavesDone) {
const { width } = this.scale;
const lines = [
'They pulled back. More are coming.',
'Salvage what you can. They won’t stop.',
'Your line held — this time.',
'The ocean gives them more every tide.',
'Reload. Reinforce. Survive.',
'Intel says four more waves. Intel is optimistic.',
'Whoever sent them is watching.',
'The plastic holds. For now.'
];
UI.toast(this, lines[(wavesDone - 1) % lines.length], 'warn', { y: this.PLAY_TOP + 26, duration: 2600 });
}

// ── Game over ─────────────────────────────────────────────────────────

// ── Game over / results ───────────────────────────────────────────────
triggerGameOver(victory) {
this.gameOver   = true;
this.waveActive = false;
this.hidePreview();
this.dismissUpgradePanel();
if (this.coach) this.coach.hide();
this.towerTimerEvents.forEach(e => e.remove(false));
this.towerTimerEvents = [];
this.speed = 1; this.applyTimeScale();

if (victory) this.saveProgress();

const width = this.scale.width, height = this.H;
const D = 40;
this.add.rectangle(width / 2, height / 2, width, height, UI.C.bg, 1).setInteractive().setDepth(D);
UI.backdrop(this).setDepth(D);
const accent = victory ? UI.C.green : UI.C.red;

UI.text(this, width / 2, 74, victory ? 'VICTORY' : 'BASE LOST', 'hero', { size: 44, origin: 0.5, color: UI.hex(accent), depth: D + 1 });
UI.text(this, width / 2, 112, victory ? 'The island holds.' : 'The raiders broke through.', 'body', { size: 14, origin: 0.5, depth: D + 1 });

// Stat tiles
const kills = Object.values(this.killStats).reduce((s, v) => s + v, 0);
const tiles = [['BASE HP', this.baseHp + '/' + this.baseHpMax], ['RAIDERS DOWN', String(kills)], ['ESCAPED', String(this.enemiesEscaped)]];
const tw = (width - 32 - 16) / 3;
tiles.forEach(([k, v], i) => {
  const x = 16 + tw / 2 + i * (tw + 8);
  UI.panel(this, x, 168, tw, 70, { fill: UI.C.surface, stroke: UI.C.line, radius: 12, depth: D + 1 });
  UI.text(this, x, 156, v, 'number', { size: 22, origin: 0.5, depth: D + 2 });
  UI.text(this, x, 182, k, 'label', { size: 10, origin: 0.5, depth: D + 2 });
});

let y = 222;
const card = (title, lines, colour) => {
  const body = UI.text(this, 32, 0, lines, 'body', { size: 13, wrap: width - 64, depth: D + 2 });
  const h = 40 + body.height + 14;
  UI.panel(this, width / 2, y + h / 2, width - 32, h, { fill: UI.C.surface, stroke: colour, strokeAlpha: 0.6, accent: colour, radius: 14, depth: D + 1 });
  UI.text(this, 32, y + 20, title, 'tag', { size: 11, origin: [0, 0.5], color: UI.hex(colour), depth: D + 2 });
  body.setY(y + 36);
  y += h + 10;
};

// Tower performance
const perf = TOWER_ORDER.filter(t => this.towersUsed[t]).map(t => {
  const st = this.towerStats[t];
  return this.titleCase(TOWER_DATA[t].name) + ' ×' + this.towersUsed[t] + (t === 'barricade' ? ' — slowed raiders' : ' — ' + Math.round(st.damageDealt || 0) + ' dmg, ' + (st.kills || 0) + ' kills');
});
card('YOUR TOWERS', perf.length ? perf.join('\n') : 'No towers were placed.', UI.C.blue);

if (victory) {
  const m = this.materialEarned || {};
  const got = [];
  if (m.plasticScrap)  got.push('+' + m.plasticScrap + ' Plastic Scrap');
  if (m.salvagedMetal) got.push('+' + m.salvagedMetal + ' Salvaged Metal');
  got.push('+' + this.parts + ' Parts');
  if (this.boltsEarned) got.push('+' + this.boltsEarned + ' Bolt' + (this.boltsEarned === 1 ? '' : 's') + ' for the Uplink');
  card('REWARDS', got.join('\n') + '\nTowers placed this battle are used up.', UI.C.green);

  const unlocks = [];
  const lkey = Progress.key(this.storylineId, this.levelId);
  if (!this.isEndless && this.firstClear) {
    Progress.unlocksAt(lkey).forEach(u => unlocks.push(u.label));
    Merchants.recruitedBy(lkey).forEach(m => { if (m.id !== 'chrome') unlocks.push('New merchant \u2014 ' + m.name + ' (' + m.tag.toLowerCase() + ') has set up shop in the Market.'); });
    Object.keys(STORYLINE_GATES).forEach(sid => {
      if ((STORYLINE_GATES[sid] || []).includes(lkey)) unlocks.push('New story: ' + Progress.storyline(+sid).short + ' \u2014 ' + Progress.storyline(+sid).title + '.');
    });
    const stl = Progress.storyline(this.storylineId);
    if (stl && stl.levels[stl.levels.length - 1].id === this.levelId) unlocks.unshift(stl.short + ' complete \u2014 ' + stl.title + '.');
  }
  if (this.merchantsRested) unlocks.push('Your merchants have rested — fresh payouts at the Market.');
  if (unlocks.length) card('UNLOCKED', unlocks.join('\n'), UI.C.amber);
} else {
  card('TRY THIS', 'Place towers beside bends where the road doubles back — the coverage meter shows good spots.\nYour towers go back to the Armoury when you lose, so you can retry straight away.', UI.C.amber);
}

// Actions
const by = height - 46;
const leave = (key, data) => { this.setFactoryActive(true); UI.go(this, key, data); };
if (victory) {
  UI.button(this, 16 + 80, by, 160, 54, { label: 'BASE', variant: 'secondary', depth: D + 3, onTap: () => leave('BaseScene') });
  const st = Progress.storyline(this.storylineId);
  const next = !this.isEndless && st && st.levels.find(l => l.id === this.levelId + 1 && !l.soon);
  UI.button(this, width - 16 - (width - 32 - 172) / 2, by, width - 32 - 172, 54, {
    label: next ? 'NEXT MISSION' : 'TO THE DOCK', variant: 'primary', colour: UI.C.green, depth: D + 3,
    onTap: () => leave('DockScene')
  });
  // The story moves on: play this level's closing scene over the results
  const akey = Progress.key(this.storylineId, this.levelId) + '.after';
  if (!this.isEndless && Story.has(akey)) this.time.delayedCall(700, () => Story.play(this, akey));
} else {
  UI.button(this, 16 + 80, by, 160, 54, { label: 'BASE', variant: 'secondary', depth: D + 3, onTap: () => leave('BaseScene') });
  UI.button(this, width - 16 - (width - 32 - 172) / 2, by, width - 32 - 172, 54, {
    label: 'RETRY', variant: 'primary', colour: UI.C.amber, depth: D + 3,
    onTap: () => leave('CombatScene', { storylineId: this.storylineId, levelId: this.levelId, levelData: this.levelData, isEndless: this.isEndless })
  });
}
}

// ── Automation foundation (Milestone 0) ────────────────────────────
// Single source of truth for the factory's active state. Reads, mutates,
// writes back. Used on combat entry (false) and all three exits (true).
setFactoryActive(active) {
  SaveManager.update(save => { save.factoryActive = !!active; });
  if (this.saveData) this.saveData.factoryActive = !!active;
}

// ── Abort-mission confirmation (Milestone 0) ───────────────────────
// Replaces the silent BACK exit with a confirm dialog. Cancel returns
// to combat with no state change. Confirm clears factoryActive and
// fades to DockScene.

// ── Abort-mission confirmation ─────────────────────────────────────
// The battle pauses while the dialog is open.
showAbortConfirm() {
  if (this.gameOver || this._modalOpen) return;
  this._modalOpen = true;
  this.setPaused(true);
  UI.modal(this, {
    title: 'Abandon the mission?', icon: 'back', accent: UI.C.red,
    body: 'Nothing from this attempt is saved. All your towers go back to the Armoury, so you can try again later.',
    buttons: [
      { label: 'KEEP FIGHTING', variant: 'secondary', onTap: () => { this._modalOpen = false; this.setPaused(false); } },
      { label: 'ABANDON', variant: 'danger', onTap: () => {
        this.hidePreview(); this.dismissUpgradePanel();
        this.setPaused(false);
        this.setFactoryActive(true);
        UI.go(this, 'DockScene');
      } }
    ]
  });
}

saveProgress() {
const save      = SaveManager.load();

if (!save.completedLevels) save.completedLevels = {};
const key = this.isEndless ? 'endless' : 'storyline' + this.storylineId;
if (!save.completedLevels[key]) save.completedLevels[key] = [];
this.firstClear = !save.completedLevels[key].includes(this.levelId);
if (this.firstClear) save.completedLevels[key].push(this.levelId);

save.parts = (save.parts || 0) + this.parts;
// Bolts for winning — the main way to afford Uplink upgrades. A first clear
// pays more; replays and endless runs pay a little.
this.boltsEarned = (this.firstClear && !this.isEndless) ? 2 + this.levelId : 1;
save.bolts = (save.bolts || 0) + this.boltsEarned;
save.level = Math.max(save.level || 1, this.levelId + 1);

if (save.stockpile) {
  Object.keys(this.towersUsed).forEach(type => {
    save.stockpile[type] = Math.max(0, (save.stockpile[type] || 0) - (this.towersUsed[type] || 0));
  });
}

// ── Material rewards ──────────────────────────────────────────────────────
// Elite kill drops + a small scrap trickle + level completion bonus (bulk).
// Every tower costs one material, so this income is the tower budget.
// Stored on this.materialEarned for display in triggerGameOver.
this.materialEarned = { plasticScrap: 0, salvagedMetal: 0 };

if (!this.isEndless && typeof LEVEL_DATA !== 'undefined') {
  const storyline = LEVEL_DATA.storylines.find(s => s.id === this.storylineId);
  const levelData = storyline ? storyline.levels.find(l => l.id === this.levelId) : null;

  if (levelData && levelData.materialRewards) {
    const { killDrops, completionBonus } = levelData.materialRewards;

    if (killDrops && this.killStats) {
      Object.entries(this.killStats).forEach(function(entry) {
        const type  = entry[0];
        const count = entry[1];
        const drops = killDrops[type] || {};
        this.materialEarned.plasticScrap  += (drops.plasticScrap  || 0) * count;
        this.materialEarned.salvagedMetal += (drops.salvagedMetal || 0) * count;
      }.bind(this));
    }

    // Scrap trickle: one Plastic Scrap per 15 raiders sunk, so long levels
    // pay a little more than short ones
    const sunk = Object.values(this.killStats || {}).reduce((t, n) => t + n, 0);
    this.materialEarned.plasticScrap += Math.floor(sunk / 15);

    // Bulk reward; replays pay half
    if (completionBonus) {
      const k = this.firstClear ? 1 : 0.5;
      this.materialEarned.plasticScrap  += Math.ceil((completionBonus.plasticScrap  || 0) * k);
      this.materialEarned.salvagedMetal += Math.ceil((completionBonus.salvagedMetal || 0) * k);
    }
  }
}

if (!save.materials) save.materials = { plasticScrap: 0, refinedPlastic: 0, salvagedMetal: 0 };
save.materials.plasticScrap  = (save.materials.plasticScrap  || 0) + this.materialEarned.plasticScrap;
save.materials.salvagedMetal = (save.materials.salvagedMetal || 0) + this.materialEarned.salvagedMetal;
// ─────────────────────────────────────────────────────────────────────────

if (this.levelId === 1 && this.storylineId === 1 && !save.workers) save.workers = 2;
// Merchants recover while you're away fighting — fatigue would otherwise only
// ever grow, making the Market steadily worse to use.
this.merchantsRested = Object.values(save.merchantFatigue || {}).some(v => v > 0);
save.merchantFatigue = { chrome: 0, ricochet: 0, doubleDown: 0 };
if (this.levelId === 8 && this.storylineId === 1) save.factionOneComplete = true;

SaveManager.write(save);

}

update(time, delta) {
if (!this.paused && !this.gameOver) {
  this.simNow += delta * (this.speed || 1);
  this._tickDt = delta * (this.speed || 1);
  this.updateProjectiles(this._tickDt);
  this.updateBattleTicks();
  // Wakes behind every boat (Helix craft hover, so theirs is fainter)
  this._wakeAcc += this._tickDt;
  if (this._wakeAcc >= 110) {
    this._wakeAcc = 0;
    this.activeEnemies.forEach(e => {
      if (!e.alive || !e.sprite || !e.sprite.active) return;
      const r = e.sprite.rotation, back = e.data.size * 1.3;
      this.wake.emitParticleAt(e.sprite.x - Math.cos(r) * back, e.sprite.y - Math.sin(r) * back, 1);
    });
  }
}
if (this.waterFx && !this.paused) { this.waterFx.tilePositionX += delta * 0.012; this.waterFx.tilePositionY -= delta * 0.02; }
this._slowTick = ((this._slowTick || 0) + 1);

this.activeEnemies.forEach(enemy => {
  if (!enemy.alive || !enemy.sprite || !enemy.sprite.active) return;
  const x = enemy.sprite.x, y = enemy.sprite.y;
  const barW = Math.max(enemy.data.size * 2.5, 22);
  const barY = y - enemy.data.size - 7;
  if (enemy.hpBg) enemy.hpBg.setPosition(x, barY);
  if (enemy.hpFill) {
    const pct = Math.max(0, enemy.hp / enemy.maxHp);
    enemy.hpFill.setPosition(x - barW / 2, barY);
    enemy.hpFill.setSize(barW * pct, 4);
    enemy.hpFill.setFillStyle(pct > 0.5 ? UI.C.green : pct > 0.25 ? UI.C.amber : UI.C.red);
  }
  // Barricade slow — re-evaluate every 8 frames
  if (this._slowTick % 8 === 0 && enemy.moveTween && enemy.moveTargetIdx !== undefined) {
    const mod = this.getSpeedModifier(enemy);
    if (Math.abs(mod - (enemy.lastSpeedMod || 1)) > 0.02) this.moveToWaypoint(enemy, enemy.moveTargetIdx);
  }
});

this.updateTutorial();
this.updateUpgradeTutorial();
this.updateStartButton();
this.updateAbilityButtons();
}

}
