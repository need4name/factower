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
this._upTut           = null;   // one-time 'how to upgrade' lesson (see updateUpgradeTutorial)
this.coach             = null;
this.simNow            = 0;      // tower fire-rate clock (scaled by speed, stops when paused)
this.speed             = 1;
this.paused            = false;
this._modalOpen        = false;
this._confirmedNoTowers = false;
this.time.timeScale = 1; this.tweens.timeScale = 1; this.time.paused = false;

this.towerStats = {
  gunner:    { damageDealt: 0, kills: 0 },
  bomber:    { damageDealt: 0, kills: 0 },
  barricade: { placed: 0 }
};

const stockpile = (this.saveData && this.saveData.stockpile) ? this.saveData.stockpile : {};
this.loadout = {
  gunner:    stockpile.gunner    || 0,
  bomber:    stockpile.bomber    || 0,
  barricade: stockpile.barricade || 0
};
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
this.drawHotspots();
this.drawUBZs();
this.drawPath();
this.drawHeader();
this.drawBottomPanel();
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
const towerCircle = this.add.circle(x, y, 14, data.colour, 0.9).setDepth(4);
this.add.circle(x, y, 14).setStrokeStyle(2, data.colour).setDepth(4);
const towerLabel = this.add.text(x, y, data.name.substring(0, 3), {
  fontFamily: 'monospace', fontSize: '9px', color: '#eef2f8', fontStyle: 'bold'
}).setOrigin(0.5).setDepth(5);

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
const barrel = type === 'barricade' ? null
  : this.add.rectangle(x, y, type === 'bomber' ? 17 : 19, type === 'bomber' ? 8 : 5, 0xeef2f8, 0.95).setOrigin(0, 0.5).setDepth(4.5).setRotation(-Math.PI / 2);
const tower = { type, x, y, data: towerData, lastFired: -1e9, upgradeTier: 0, mods: [0, 0, 0], towerCircle, towerLabel, tierBadge: null, hitZone, powerMult: mult, barrel };
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
const completed = (this.saveData && this.saveData.completedLevels && this.saveData.completedLevels.storyline1) || [];
return completed.includes(3) || this.isEndless || this.storylineId !== 1 || (BUILD.test && BUILD.allUpgrades);
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
const rowH = 58, h = unlocked ? 64 + paths.length * rowH + 8 : 120;
const cy = this.HP_STRIP_Y - 24 - h / 2, lx = 12 + 18;
items.push(UI.panel(this, width / 2, cy, width - 24, h, { fill: UI.C.surface, stroke: colour, strokeAlpha: 0.7, radius: 16, depth: D }));
const top = cy - h / 2;
items.push(UI.text(this, lx, top + 20, this.titleCase(tower.data.name), 'heading', { size: 17, origin: [0, 0.5], depth: D + 1, color: UI.hex(colour) }));
const rareTxt = Object.keys(this.rare).filter(k => this.rare[k] > 0).map(k => this.rare[k] + ' ' + RARE_PARTS[k].name).join(' \u00b7 ');
items.push(UI.text(this, width - 12 - 18, top + 20, this.parts + ' Parts' + (rareTxt ? ' \u00b7 ' + rareTxt : ''), 'small',
  { size: 11, origin: [1, 0.5], depth: D + 1, color: UI.T.amber }));
let info = 'Scavenger mods \u2014 pick any two paths';
if (tower.powerMult && Math.abs(tower.powerMult - 1) > 0.04) info += '  \u00b7  power zone ' + (tower.powerMult > 1 ? '+' : '') + Math.round((tower.powerMult - 1) * 100) + '%';
items.push(UI.text(this, lx, top + 40, info, 'small', { size: 11, origin: [0, 0.5], depth: D + 1 }));

this._upgradeBtn = null;
if (!unlocked) {
  items.push(UI.text(this, lx, top + 74, 'Mods unlock after Level 3. Then you can bolt salvaged Parts onto towers mid-battle.', 'small',
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
drawPath() {
const g = this.add.graphics().setDepth(1);
const stroke = (w, col, a) => {
  g.lineStyle(w, col, a);
  g.beginPath();
  g.moveTo(this.pathPoints[0].x, this.pathPoints[0].y);
  this.pathPoints.forEach(p => g.lineTo(p.x, p.y));
  g.strokePath();
};
// Rounded joints: a disc at every corner so bends don't look notched
const joints = (r, col) => { g.fillStyle(col, 1); this.pathPoints.forEach(p => g.fillCircle(p.x, p.y, r)); };
joints(23, 0x26303d); stroke(46, 0x26303d, 1);     // kerb
joints(20, 0x161d27); stroke(40, 0x161d27, 1);     // road surface
stroke(2, 0x2c3746, 1);                            // centre line

// Direction chevrons along the road
const cg = this.add.graphics().setDepth(1);
cg.lineStyle(2, 0x3a4658, 1);
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
UI.text(this, start.x + 28, this.CT + 10, 'RAIDERS ENTER', 'tag', { size: 10, origin: [0, 0.5], color: UI.T.red, depth: 2 });
const exitPt = this.pathPoints[this.pathPoints.length - 1];
UI.text(this, exitPt.x + 28, this.CB - 10, 'YOUR BASE', 'tag', { size: 10, origin: [0, 0.5], color: UI.T.blue, depth: 2 });
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

// Tower buttons
const types = ['gunner', 'bomber', 'barricade'];
const gap = 8, startW = 96;
const bw = (width - 32 - startW - gap * types.length) / types.length;
const by = this.PANEL_TOP + 58, bh = 92;
this.towerButtons = {};
types.forEach((type, i) => {
  const d = TOWER_DATA[type];
  const x = 16 + bw / 2 + i * (bw + gap);
  const c = this.add.container(x, by).setDepth(10);
  const bg = this.add.graphics();
  const disc = this.add.graphics();
  const name = UI.text(this, 0, 10, this.titleCase(d.name), 'tag', { size: 12.5, origin: 0.5, color: UI.T.text });
  const countText = UI.text(this, 0, 30, 'x' + this.loadout[type], 'number', { size: 15, origin: 0.5 });
  const zone = this.add.zone(0, 0, bw, bh).setInteractive();
  c.add([bg, disc, name, countText, zone]);
  const btn = { container: c, countText, x, y: by, w: bw, h: bh, type };
  btn.draw = () => {
    const has = this.loadout[type] > 0, sel = this.selectedTowerType === type;
    UI.drawPanel(bg, 0, 0, bw, bh, { fill: sel ? 0x1d2734 : (has ? UI.C.surface : 0x10151c),
      stroke: sel ? d.colour : (has ? UI.C.line : UI.C.lineSoft), strokeWidth: sel ? 2 : 1, radius: 14 });
    disc.clear();
    disc.fillStyle(has ? d.colour : UI.C.line, has ? 1 : 0.6); disc.fillCircle(0, -20, 11);
    disc.lineStyle(2, 0x0a0d12, 1); disc.strokeCircle(0, -20, 11);
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
this.startWaveBtn = UI.button(this, sx, by, startW, bh, {
  label: 'START', sub: 'WAVE 1', variant: 'success', size: 17, depth: 10, onTap: () => this.startNextWave()
});
this.startWaveBtn.y = by;
}

refreshTowerButtons() {
  Object.values(this.towerButtons).forEach(b => b.draw());
}

titleCase(str) { return String(str).toLowerCase().replace(/\b\w/g, c => c.toUpperCase()); }

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
this.selectedTowerType = type;
this.refreshTowerButtons();
}

// ── Combat ────────────────────────────────────────────────────────────
getSpeedModifier(enemy) {
let modifier = 1.0;
this.placedTowers.forEach(tower => {
if (tower.type !== 'barricade') return;
if (Phaser.Math.Distance.Between(tower.x, tower.y, enemy.sprite.x, enemy.sprite.y) <= tower.data.range) {
modifier = Math.min(modifier, tower.data.slowAmount);
}
});
return modifier;
}

towerShoot(tower) {
if (!this.waveActive || this.gameOver) return;
if (tower.type === 'barricade') return;
if (this.simNow - tower.lastFired < tower.data.fireRate) return;

const inRange = this.activeEnemies.filter(e => {
  if (!e.alive || !e.sprite || !e.sprite.active) return false;
  return Phaser.Math.Distance.Between(tower.x, tower.y, e.sprite.x, e.sprite.y) <= tower.data.range;
});
if (inRange.length === 0) return;

const target = inRange.reduce((best, e) => e.pathProgress > best.pathProgress ? e : best, inRange[0]);
tower.lastFired = this.simNow;

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
UI.modal(this, {
  title: 'New raider: ' + d.card.title, icon: 'shield', accent: d.colour,
  body: d.card.trait + '\n\n' + d.card.body,
  buttons: [{ label: types.length > 1 ? 'NEXT' : 'GOT IT', variant: 'primary', colour: UI.C.red, onTap: () => {
    this._modalOpen = false;
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
this.spawnPickup(x, y, { parts: enemy.data.partsReward });
const rare = enemy.data.rareDrop || (Math.random() < 0.03 ? (Math.random() < 0.5 ? 'plate' : 'engine') : null);
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

// opts.pierce ignores that much armour; opts.trueDamage ignores it all (burns)
dealDamage(enemy, damage, sourceType, opts) {
if (!enemy.alive) return;
const o = opts || {};
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
if (enemy.hpBg)   { enemy.hpBg.destroy();   enemy.hpBg   = null; }
if (enemy.hpFill) { enemy.hpFill.destroy();  enemy.hpFill = null; }
if (enemy.sprite && enemy.sprite.active) {
this.tweens.add({
targets: enemy.sprite, alpha: 0, scaleX: 1.8, scaleY: 1.8, duration: 200,
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
this.time.delayedCall(500, () => {
  if (this.gameOver) return;
  this.waveText.setText('Wave ' + (this.currentWave + 1) + ' of ' + total + ' — hold the line').setColor(UI.T.dim);
  this.spawnWave(waveData);
});
}

// REQ 10: Irregular rhythm — burst spawning with variable gaps
spawnWave(waveData) {
let totalDelay = 0;
this.waveEnemyTotal    = waveData.enemies.reduce((s, g) => s + g.count, 0);
this.waveEnemyResolved = 0;

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

spawnEnemy(type) {
const data   = ENEMY_DATA[type];
const start  = this.pathPoints[0];
const sprite = this.add.circle(start.x, start.y, data.size, data.colour).setDepth(7);
const barW   = Math.max(data.size * 2.5, 22);
const hpBg   = this.add.rectangle(start.x, start.y - data.size - 7, barW, 4, 0x2a3a4a).setDepth(8);
const hpFill = this.add.rectangle(start.x - barW / 2, start.y - data.size - 7, barW, 4, 0x5eba7d).setOrigin(0, 0.5).setDepth(8);

const traits = data.traits || [];
if (traits.includes('armoured')) sprite.setStrokeStyle(3, 0xdfe6ee, 0.9);
if (traits.includes('healer')) {
  const aura = this.add.circle(start.x, start.y, data.heal.radius, 0x52c47f, 0.06).setStrokeStyle(1, 0x52c47f, 0.35).setDepth(5);
  sprite.aura = aura;
}
const enemy = { type, data: { ...data }, sprite, hp: data.hp, maxHp: data.hp, alive: true, pathProgress: 0, hpBg, hpFill,
  lastHeal: this.simNow, burnDps: 0, burnUntil: 0 };
this.activeEnemies.push(enemy);
this.moveToWaypoint(enemy, 1);

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

checkWaveComplete() {
if (!this.waveActive || this.gameOver) return;
if (this.waveEnemyResolved < this.waveEnemyTotal) return;

this.time.delayedCall(1200, () => {
  if (!this.waveActive) return;
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
  this.startWaveBtn.setEnabled(true).setLabel('START', 'WAVE ' + (this.currentWave + 1));
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
const perf = ['gunner', 'bomber', 'barricade'].filter(t => this.towersUsed[t]).map(t => {
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
  if (this.storylineId === 1 && this.levelId === 1) unlocks.push('New recruit — W2 joins the Factory.', 'The Market and Uplink are open.');
  if (this.storylineId === 1 && this.levelId === 2) unlocks.push('Bomber and Barricade benches are available in the Factory.');
  if (this.storylineId === 1 && this.levelId === 3) unlocks.push('Tower upgrades — tap a placed tower mid-battle to spend Parts.');
  if (this.levelId === 8) unlocks.push('A new threat stirs: the Limbic Cartel has taken notice.');
  if (this.storylineId === 1 && !this.isEndless && this.firstClear) {
    Merchants.recruitedBy(this.levelId).forEach(m => unlocks.push('New merchant — ' + m.name + ' (' + m.tag.toLowerCase() + ') has set up shop in the Market.'));
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
  const next = !this.isEndless && LEVEL_DATA.storylines[0].levels.find(l => l.id === this.levelId + 1);
  UI.button(this, width - 16 - (width - 32 - 172) / 2, by, width - 32 - 172, 54, {
    label: next ? 'NEXT MISSION' : 'TO THE DOCK', variant: 'primary', colour: UI.C.green, depth: D + 3,
    onTap: () => leave('DockScene')
  });
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
// Per-kill drops (trickle) + level completion bonus (bulk).
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

    if (completionBonus) {
      this.materialEarned.plasticScrap  += completionBonus.plasticScrap  || 0;
      this.materialEarned.salvagedMetal += completionBonus.salvagedMetal || 0;
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
}
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
}

}
