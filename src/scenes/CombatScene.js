// ── Minimal seeded Perlin noise (no external deps) ────────────────────
// Classic gradient noise, 2D, deterministic from seed.
const PerlinNoise = (() => {
  function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function lerp(a, b, t) { return a + t * (b - a); }
  function grad(hash, x, y) {
    const h = hash & 3;
    const u = h < 2 ? x : y;
    const v = h < 2 ? y : x;
    return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
  }
  function buildPerm(seed) {
    const p = [];
    for (let i = 0; i < 256; i++) p[i] = i;
    let s = seed || 1;
    for (let i = 255; i > 0; i--) {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      const j = ((s >>> 0) % (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    return [...p, ...p];
  }
  return {
    noise(x, y, seed) {
      const perm = buildPerm(seed);
      const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
      const xf = x - Math.floor(x), yf = y - Math.floor(y);
      const u = fade(xf), v = fade(yf);
      const a = perm[X] + Y, b = perm[X + 1] + Y;
      return lerp(
        lerp(grad(perm[a],     xf,     yf),     grad(perm[b],     xf - 1, yf),     u),
        lerp(grad(perm[a + 1], xf,     yf - 1), grad(perm[b + 1], xf - 1, yf - 1), u),
        v
      );
    }
  };
})();

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
    const { width, height } = this.scale;

    const slotIndex = localStorage.getItem('factower_active_slot');
    const saveKey   = 'factower_save_' + slotIndex;
    this.saveData   = JSON.parse(localStorage.getItem(saveKey));

    this.parts             = 0;
    this.baseHp            = this.levelData ? this.levelData.baseHp : 10;
    this.baseHpMax         = this.baseHp;
    this.currentWave       = 0;
    this.waveActive        = false;
    this.gameOver          = false;
    this.placedTowers      = [];
    this.activeEnemies     = [];
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
    this.towerTapped       = false;
    this.tutorialPhase     = null;
    this.tutorialOverlays  = [];

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

    this.HY          = 188;
    this.CT          = 262;
    this.CB          = 680;
    this.PLAY_TOP    = 265;
    this.PLAY_BOTTOM = height - 165;
    this.PLAY_LEFT   = 14;
    this.PLAY_RIGHT  = width - 14;

    // Build path
    this.pathPoints = (this.levelData && this.levelData.path)
      ? this.levelData.path.map(p => ({ x: p.x, y: this.CT + p.oy }))
      : [
          { x: 195, y: this.CT        },
          { x: 195, y: this.CT + 55   },
          { x: 72,  y: this.CT + 55   },
          { x: 72,  y: this.CT + 190  },
          { x: 312, y: this.CT + 190  },
          { x: 312, y: this.CT + 310  },
          { x: 72,  y: this.CT + 310  },
          { x: 72,  y: this.CT + 378  },
          { x: 195, y: this.CT + 378  },
          { x: 195, y: this.CB        }
        ];

    // UBZs
    this.ubzs = (this.levelData && this.levelData.ubzs)
      ? this.levelData.ubzs.map(z => ({ x: z.x, y: this.CT + z.oy, w: z.w, h: z.h }))
      : [];

    // Hotspot seed: levelId for storyline (deterministic), random for endless
    this.noiseSeed = this.isEndless ? Math.floor(Math.random() * 99999) : this.levelId * 137;

    // Hotspots from level data (used for placement multipliers), or generate for endless
    this.hotspots = (this.levelData && this.levelData.hotspots && !this.isEndless)
      ? this.levelData.hotspots.map(h => ({ x: h.x, y: this.CT + h.oy, radius: h.radius, mult: h.mult }))
      : this.generateHotspotsFromNoise();

    this.add.rectangle(width / 2, height / 2, width, height, 0x0d1117);
    this.drawNoiseField();
    this.drawUBZs();
    this.drawPath();
    this.drawHeader();
    this.drawBottomPanel();
    this.setupPlacementInput();

    const total = this.loadout.gunner + this.loadout.bomber + this.loadout.barricade;
    if (total === 0) {
      this.add.rectangle(width / 2, height / 2, width - 48, 160, 0x1a0a0a).setDepth(20);
      this.add.rectangle(width / 2, height / 2, width - 48, 160).setStrokeStyle(1, 0xc43a3a).setDepth(20);
      this.add.text(width / 2, height / 2 - 24, 'NO TOWERS IN STOCK', {
        fontFamily: 'monospace', fontSize: '18px', color: '#c43a3a', fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(21);
      this.add.text(width / 2, height / 2 + 12, 'Build towers in the Factory first', {
        fontFamily: 'monospace', fontSize: '13px', color: '#8899aa'
      }).setOrigin(0.5).setDepth(21);
    } else if (this.levelData && this.levelData.tutorialText) {
      this.showTutorialHint();
    }
  }

  // ── Generate hotspot data from Perlin noise ──────────────────────────
  generateHotspotsFromNoise() {
    const spots = [];
    const candidates = [
      { x: 90,  oy: 80  }, { x: 195, oy: 80  }, { x: 295, oy: 80  },
      { x: 90,  oy: 175 }, { x: 195, oy: 175 }, { x: 295, oy: 175 },
      { x: 90,  oy: 270 }, { x: 195, oy: 270 }, { x: 295, oy: 270 },
      { x: 90,  oy: 355 }, { x: 195, oy: 355 }, { x: 295, oy: 355 }
    ];
    candidates.forEach(c => {
      const nx   = c.x / 120;
      const ny   = (this.CT + c.oy) / 220;
      const n    = PerlinNoise.noise(nx, ny, this.noiseSeed);
      if (Math.abs(n) > 0.18) {
        spots.push({
          x:      c.x,
          y:      this.CT + c.oy,
          radius: 52 + Math.abs(n) * 30,
          mult:   n > 0 ? 1.10 + n * 0.55 : 0.88 + n * 0.38
        });
      }
    });
    return spots;
  }

  // ── Draw Perlin noise power field (REQ: visible, more obvious) ───────
  drawNoiseField() {
    const { width }  = this.scale;
    const gfx        = this.add.graphics().setDepth(0);
    const CELL       = 14;   // pixel resolution of each noise cell
    const playW      = this.PLAY_RIGHT - this.PLAY_LEFT;
    const playH      = this.PLAY_BOTTOM - this.PLAY_TOP;
    const cols       = Math.ceil(playW / CELL);
    const rows       = Math.ceil(playH / CELL);
    const SCALE      = 0.048; // noise frequency — lower = larger patches

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const px = this.PLAY_LEFT + col * CELL;
        const py = this.PLAY_TOP  + row * CELL;

        // Accumulate octaves for richer look
        const nx = col * SCALE;
        const ny = row * SCALE;
        let n  = PerlinNoise.noise(nx,       ny,       this.noiseSeed);
        n += 0.5 * PerlinNoise.noise(nx * 2, ny * 2,   this.noiseSeed + 1);
        n += 0.25 * PerlinNoise.noise(nx * 4, ny * 4,  this.noiseSeed + 2);
        n /= 1.75;

        if (n > 0.14) {
          // Boost zone — amber/gold
          const t     = Math.min(1, (n - 0.14) / 0.35);
          const alpha = 0.08 + t * 0.20;
          gfx.fillStyle(0xe8a020, alpha);
          gfx.fillRect(px, py, CELL, CELL);
        } else if (n < -0.14) {
          // Drain zone — blue
          const t     = Math.min(1, (-n - 0.14) / 0.35);
          const alpha = 0.07 + t * 0.18;
          gfx.fillStyle(0x1a5a9a, alpha);
          gfx.fillRect(px, py, CELL, CELL);
        }
      }
    }

    // Sync hotspots to the noise field for multiplier accuracy
    // (re-sample noise at each hotspot centre to get true mult)
    this.hotspots = this.hotspots.map(h => {
      const col = (h.x - this.PLAY_LEFT) / (this.PLAY_RIGHT - this.PLAY_LEFT) * (Math.ceil((this.PLAY_RIGHT - this.PLAY_LEFT) / CELL));
      const row = (h.y - this.PLAY_TOP)  / (this.PLAY_BOTTOM - this.PLAY_TOP)  * (Math.ceil((this.PLAY_BOTTOM - this.PLAY_TOP)  / CELL));
      const nx  = col * SCALE;
      const ny  = row * SCALE;
      let n  = PerlinNoise.noise(nx, ny, this.noiseSeed);
      n += 0.5  * PerlinNoise.noise(nx * 2, ny * 2, this.noiseSeed + 1);
      n += 0.25 * PerlinNoise.noise(nx * 4, ny * 4, this.noiseSeed + 2);
      n /= 1.75;
      return { ...h, noiseMult: n > 0.14 ? (1.0 + Math.min(1, (n - 0.14) / 0.35) * 0.28) : n < -0.14 ? (1.0 - Math.min(1, (-n - 0.14) / 0.35) * 0.22) : 1.0 };
    });
  }

  // ── Draw UBZ zones ───────────────────────────────────────────────────
  drawUBZs() {
    const gfx = this.add.graphics().setDepth(1);
    this.ubzs.forEach(z => {
      // Dark fill
      gfx.fillStyle(0x1e160a, 0.85);
      gfx.fillRect(z.x, z.y, z.w, z.h);
      // Border
      gfx.lineStyle(1, 0x4a3820, 0.9);
      gfx.strokeRect(z.x, z.y, z.w, z.h);
      // Diagonal hatch
      gfx.lineStyle(1, 0x2e2010, 0.55);
      for (let i = -z.h; i < z.w; i += 12) {
        const x1 = z.x + Math.max(0, i),      y1 = z.y + Math.max(0, -i);
        const x2 = z.x + Math.min(z.w, i + z.h), y2 = z.y + Math.min(z.h, z.h + i > z.h ? z.h : z.h - Math.max(0, -i) + Math.max(0, i + z.h - z.w));
        if (x1 !== x2 || y1 !== y2) gfx.lineBetween(x1, y1, x2, y2);
      }
      // UBZ label centred
      this.add.text(z.x + z.w / 2, z.y + z.h / 2, 'UBZ', {
        fontFamily: 'monospace', fontSize: '9px', color: '#4a3820', fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(1);
    });
  }

  // ── Get power multiplier at a position from the noise field ──────────
  getPowerMultiplier(x, y) {
    const playW  = this.PLAY_RIGHT - this.PLAY_LEFT;
    const playH  = this.PLAY_BOTTOM - this.PLAY_TOP;
    const CELL   = 14;
    const SCALE  = 0.048;
    const col    = (x - this.PLAY_LEFT) / CELL;
    const row    = (y - this.PLAY_TOP)  / CELL;
    const nx     = col * SCALE;
    const ny     = row * SCALE;
    let n  = PerlinNoise.noise(nx,       ny,       this.noiseSeed);
    n += 0.5  * PerlinNoise.noise(nx * 2, ny * 2,  this.noiseSeed + 1);
    n += 0.25 * PerlinNoise.noise(nx * 4, ny * 4,  this.noiseSeed + 2);
    n /= 1.75;
    if (n > 0.14)  return 1.0 + Math.min(1, (n - 0.14)  / 0.35) * 0.28;
    if (n < -0.14) return 1.0 - Math.min(1, (-n - 0.14) / 0.35) * 0.22;
    return 1.0;
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

  // ── Input ─────────────────────────────────────────────────────────────
  setupPlacementInput() {
    this.input.on('pointermove', (pointer) => {
      if (!this.selectedTowerType || this.gameOver) return;
      if (!this.isInPlayArea(pointer.x, pointer.y)) { this.hidePreview(); return; }
      this.updatePreview(pointer.x, pointer.y);
    });

    this.input.on('pointerup', (pointer) => {
      if (this.gameOver) return;
      if (this.upgradePanel) {
        if (!this.towerTapped) this.dismissUpgradePanel();
        this.towerTapped = false;
        return;
      }
      if (!this.selectedTowerType) return;
      if (!this.isInPlayArea(pointer.x, pointer.y)) return;
      if (this.canPlaceAt(pointer.x, pointer.y)) this.placeTower(pointer.x, pointer.y);
    });

    this.input.on('pointerout', () => this.hidePreview());
  }

  updatePreview(x, y) {
    const data   = TOWER_DATA[this.selectedTowerType];
    const valid  = this.canPlaceAt(x, y);
    const mult   = valid ? this.getPowerMultiplier(x, y) : 1;
    const colour = valid ? data.colour : 0xc43a3a;

    if (!this.previewCircle) {
      this.previewCircle = this.add.circle(x, y, 14, colour, 0.25).setDepth(15);
      this.previewRing   = this.add.circle(x, y, data.range).setStrokeStyle(1, colour, 0.4).setDepth(15);
    } else {
      this.previewCircle.setPosition(x, y).setFillStyle(colour, 0.25);
      this.previewRing.setPosition(x, y).setStrokeStyle(1, colour, 0.4);
      this.previewRing.setRadius(data.range);
    }

    if (this.previewMultText) { this.previewMultText.destroy(); this.previewMultText = null; }
    if (valid && Math.abs(mult - 1) > 0.04) {
      const sign = mult > 1 ? '+' : '';
      this.previewMultText = this.add.text(x + 18, y - 18, sign + Math.round((mult - 1) * 100) + '%', {
        fontFamily: 'monospace', fontSize: '11px', color: mult > 1 ? '#e8a020' : '#4a8aba', fontStyle: 'bold'
      }).setDepth(16);
    }
  }

  hidePreview() {
    if (this.previewCircle)   { this.previewCircle.destroy();   this.previewCircle   = null; }
    if (this.previewRing)     { this.previewRing.destroy();     this.previewRing     = null; }
    if (this.previewMultText) { this.previewMultText.destroy(); this.previewMultText = null; }
  }

  // ── Tower placement ───────────────────────────────────────────────────
  placeTower(x, y) {
    if (this.loadout[this.selectedTowerType] <= 0) return;

    const type = this.selectedTowerType;
    const data = TOWER_DATA[type];
    const mult = this.getPowerMultiplier(x, y);

    const towerData = { ...data };
    if (Math.abs(mult - 1) > 0.04) {
      towerData.damage = Math.round(towerData.damage * mult);
      towerData.range  = Math.round(towerData.range  * mult);
      if (towerData.slowAmount) towerData.slowAmount = parseFloat((towerData.slowAmount / mult).toFixed(3));
    }

    const hitZone     = this.add.circle(x, y, 20, 0xffffff, 0).setDepth(10).setInteractive();
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

    if (Math.abs(mult - 1) > 0.04) {
      const sign = mult > 1 ? '+' : '';
      const badge = this.add.text(x + 15, y - 15, sign + Math.round((mult - 1) * 100) + '%', {
        fontFamily: 'monospace', fontSize: '9px', color: mult > 1 ? '#e8a020' : '#4a8aba', fontStyle: 'bold'
      }).setDepth(6);
      this.time.delayedCall(2200, () => {
        if (badge) this.tweens.add({ targets: badge, alpha: 0, duration: 400, onComplete: () => badge.destroy() });
      });
    }

    this.loadout[type]--;
    this.towerButtons[type].countText.setText('x' + this.loadout[type]);
    if (this.loadout[type] === 0) this.towerButtons[type].setFillStyle(0x161b22);
    this.towersUsed[type] = (this.towersUsed[type] || 0) + 1;

    const tower = { type, x, y, data: towerData, lastFired: 0, upgradeTier: 0, towerCircle, towerLabel, tierBadge: null, hitZone, powerMult: mult };
    this.placedTowers.push(tower);

    hitZone.on('pointerup', () => {
      this.towerTapped = true;
      this.selectedTowerType = null;
      Object.keys(this.towerButtons).forEach(t => {
        this.towerButtons[t].setFillStyle(this.loadout[t] > 0 ? 0x1e2530 : 0x161b22);
      });
      this.hidePreview();
      this.showUpgradePanel(tower);
    });

    if (type !== 'barricade') {
      const timerEvent = this.time.addEvent({ delay: 120, callback: () => this.towerShoot(tower), loop: true });
      this.towerTimerEvents.push(timerEvent);
    }

    this.hidePreview();

    if (this.tutorialPhase === 'showPlacement' && this.levelId === 1 && this.storylineId === 1) {
      const opt = this.levelData.tutorialOptimalSpot;
      if (opt) {
        const dist = Math.sqrt((x - opt.x) ** 2 + (y - (this.CT + opt.oy)) ** 2);
        if (dist < 90) this.advanceTutorialPhase('highlightStart');
      }
    }
  }

  // ── Upgrade panel ─────────────────────────────────────────────────────
  showUpgradePanel(tower) {
    this.dismissUpgradePanel();
    this.activeTower = tower;

    const { width, height } = this.scale;
    const panelH   = 158;
    const panelY   = height - 165 - panelH / 2 - 4;
    const panelTop = panelY - panelH / 2;
    const colour   = tower.data.colour;
    const hex      = '#' + colour.toString(16).padStart(6, '0');
    const path     = TOWER_DATA[tower.type].upgrades.pathA;
    const tier     = tower.upgradeTier;
    const maxTier  = path.tiers.length;
    const items    = [];

    const bg    = this.add.rectangle(width / 2, panelY, width - 24, panelH, 0x060c06).setDepth(18);
    const bdr   = this.add.rectangle(width / 2, panelY, width - 24, panelH).setStrokeStyle(2, colour).setDepth(18);
    // Range ring (REQ 5)
    const ring  = this.add.circle(tower.x, tower.y, tower.data.range, colour, 0.10).setDepth(3);
    const ringB = this.add.circle(tower.x, tower.y, tower.data.range).setStrokeStyle(2, colour, 0.6).setDepth(3);
    items.push(bg, bdr, ring, ringB);

    const tierStr = tier === 0 ? 'BASE' : 'TIER ' + tier;
    items.push(
      this.add.text(28, panelTop + 10, tower.data.name, { fontFamily: 'monospace', fontSize: '14px', color: hex, fontStyle: 'bold' }).setDepth(19),
      this.add.text(width - 28, panelTop + 10, tierStr, { fontFamily: 'monospace', fontSize: '12px', color: tier > 0 ? '#e8a020' : '#445566', fontStyle: 'bold' }).setOrigin(1, 0).setDepth(19),
      this.add.text(28, panelTop + 28, 'PATH A: ' + path.name, { fontFamily: 'monospace', fontSize: '10px', color: '#556677', letterSpacing: 2 }).setDepth(19)
    );

    if (tower.powerMult && Math.abs(tower.powerMult - 1) > 0.04) {
      const sign = tower.powerMult > 1 ? '+' : '';
      const col  = tower.powerMult > 1 ? '#e8a020' : '#4a8aba';
      items.push(this.add.text(28, panelTop + 44, 'POWER ZONE ' + sign + Math.round((tower.powerMult - 1) * 100) + '%', {
        fontFamily: 'monospace', fontSize: '10px', color: col
      }).setDepth(19));
    }

    const completed       = (this.saveData && this.saveData.completedLevels && this.saveData.completedLevels.storyline1) ? this.saveData.completedLevels.storyline1 : [];
    const upgradesUnlocked = completed.includes(3) || this.isEndless || this.storylineId !== 1;

    if (!upgradesUnlocked) {
      items.push(
        this.add.text(width / 2, panelTop + 88, 'UPGRADES LOCKED', { fontFamily: 'monospace', fontSize: '14px', color: '#556677', fontStyle: 'bold', letterSpacing: 2 }).setOrigin(0.5).setDepth(19),
        this.add.text(width / 2, panelTop + 112, 'Complete Level 3 to unlock', { fontFamily: 'monospace', fontSize: '11px', color: '#334455' }).setOrigin(0.5).setDepth(19)
      );
    } else if (tier < maxTier) {
      const next      = path.tiers[tier];
      const canAfford = this.parts >= next.cost;
      items.push(
        this.add.text(28, panelTop + 55, next.label, { fontFamily: 'monospace', fontSize: '13px', color: '#eef2f8', wordWrap: { width: width - 180 } }).setDepth(19),
        this.add.text(28, panelTop + panelH - 42, next.cost + ' PARTS', { fontFamily: 'monospace', fontSize: '15px', color: canAfford ? '#e8a020' : '#c43a3a', fontStyle: 'bold' }).setDepth(19)
      );
      if (!canAfford) items.push(this.add.text(28, panelTop + panelH - 22, 'not enough parts', { fontFamily: 'monospace', fontSize: '10px', color: '#445566' }).setDepth(19));

      const bgCol = canAfford ? 0x162616 : 0x161b22;
      const btn   = this.add.rectangle(width - 72, panelTop + panelH - 32, 108, 52, bgCol).setInteractive().setDepth(19);
      const btnB  = this.add.rectangle(width - 72, panelTop + panelH - 32, 108, 52).setStrokeStyle(1, canAfford ? 0x5eba7d : 0x334455).setDepth(19);
      const btnL  = this.add.text(width - 72, panelTop + panelH - 32, 'UPGRADE', { fontFamily: 'monospace', fontSize: '13px', color: canAfford ? '#5eba7d' : '#445566', fontStyle: 'bold' }).setOrigin(0.5).setDepth(20);
      items.push(btn, btnB, btnL);
      if (canAfford) {
        btn.on('pointerdown', () => this.applyUpgrade(tower));
        btn.on('pointerover', () => btn.setFillStyle(0x1e3a1e));
        btn.on('pointerout',  () => btn.setFillStyle(bgCol));
      }
    } else {
      items.push(this.add.text(width / 2, panelTop + 90, 'FULLY UPGRADED', { fontFamily: 'monospace', fontSize: '15px', color: hex, fontStyle: 'bold', letterSpacing: 3 }).setOrigin(0.5).setDepth(19));
    }

    this.upgradePanel = items;
  }

  dismissUpgradePanel() {
    if (this.upgradePanel) {
      this.upgradePanel.forEach(e => { if (e && e.destroy) e.destroy(); });
      this.upgradePanel = null;
    }
    this.activeTower = null;
  }

  applyUpgrade(tower) {
    if (!tower) return;
    const path = TOWER_DATA[tower.type].upgrades.pathA;
    if (tower.upgradeTier >= path.tiers.length) return;
    const upgrade = path.tiers[tower.upgradeTier];
    if (this.parts < upgrade.cost) return;

    this.parts -= upgrade.cost;
    this.partsText.setText('' + this.parts);
    tower.upgradeTier++;

    if (upgrade.fireRate     !== undefined) tower.data.fireRate     = upgrade.fireRate;
    if (upgrade.damageBonus  !== undefined) tower.data.damage      += upgrade.damageBonus;
    if (upgrade.rangeBonus   !== undefined) tower.data.range       += upgrade.rangeBonus;
    if (upgrade.splashRadius !== undefined) tower.data.splashRadius = upgrade.splashRadius;
    if (upgrade.slowAmount   !== undefined) tower.data.slowAmount   = upgrade.slowAmount;

    if (upgrade.burnDps) {
      tower.data.burnDps = upgrade.burnDps;
      this.towerTimerEvents.push(this.time.addEvent({
        delay: 500,
        callback: () => {
          if (!this.waveActive || this.gameOver) return;
          this.activeEnemies.forEach(enemy => {
            if (!enemy.alive || !enemy.sprite || !enemy.sprite.active) return;
            if (Phaser.Math.Distance.Between(tower.x, tower.y, enemy.sprite.x, enemy.sprite.y) <= tower.data.range) {
              this.dealDamage(enemy, upgrade.burnDps * 0.5, 'barricade');
            }
          });
        },
        loop: true
      }));
    }

    if (tower.tierBadge) tower.tierBadge.destroy();
    tower.tierBadge = this.add.text(tower.x + 12, tower.y - 18, 'T' + tower.upgradeTier, {
      fontFamily: 'monospace', fontSize: '9px', color: '#ffffff', fontStyle: 'bold'
    }).setDepth(6);

    const flash = this.add.circle(tower.x, tower.y, 28, tower.data.colour, 0.45).setDepth(6);
    this.tweens.add({ targets: flash, alpha: 0, scaleX: 2, scaleY: 2, duration: 380, onComplete: () => flash.destroy() });
    this.showUpgradePanel(tower);
  }

  // ── Tutorial ──────────────────────────────────────────────────────────
  showTutorialHint() {
    const { width, height } = this.scale;

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6).setDepth(30);
    const card    = this.add.rectangle(width / 2, height / 2, width - 48, 192, 0x0a160a).setDepth(31);
    const border  = this.add.rectangle(width / 2, height / 2, width - 48, 192).setStrokeStyle(1, 0x5eba7d).setDepth(31);
    const label   = this.add.text(width / 2, height / 2 - 74, 'LEVEL ' + this.levelId + ' — ' + (this.levelData.name || ''), {
      fontFamily: 'monospace', fontSize: '10px', color: '#5eba7d', letterSpacing: 2
    }).setOrigin(0.5).setDepth(32);
    const hint = this.add.text(width / 2, height / 2 - 16, this.levelData.tutorialText, {
      fontFamily: 'monospace', fontSize: '12px', color: '#eef2f8',
      align: 'center', wordWrap: { width: width - 96 }, lineSpacing: 5
    }).setOrigin(0.5).setDepth(32);
    const btn    = this.add.rectangle(width / 2, height / 2 + 68, 220, 44, 0x162216).setInteractive().setDepth(32);
    const btnBdr = this.add.rectangle(width / 2, height / 2 + 68, 220, 44).setStrokeStyle(1, 0x5eba7d).setDepth(32);
    const btnTxt = this.add.text(width / 2, height / 2 + 68, 'PLACE YOUR TOWERS', {
      fontFamily: 'monospace', fontSize: '13px', color: '#5eba7d', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(33);

    this.tutorialElements = [overlay, card, border, label, hint, btn, btnBdr, btnTxt];
    btn.on('pointerdown', () => {
      this.tutorialElements.forEach(e => e.destroy());
      this.tutorialElements = null;
      if (this.levelId === 1 && this.storylineId === 1) this.advanceTutorialPhase('highlightGunner');
    });
    btn.on('pointerover', () => btn.setFillStyle(0x1e3a1e));
    btn.on('pointerout',  () => btn.setFillStyle(0x162216));
  }

  advanceTutorialPhase(phase) {
    this.tutorialOverlays.forEach(e => { if (e && e.destroy) e.destroy(); });
    this.tutorialOverlays = [];
    this.tutorialPhase = phase;
    const { width, height } = this.scale;

    if (phase === 'highlightGunner') {
      const btn  = this.towerButtons['gunner'];
      if (!btn) return;
      const ring = this.add.circle(btn.x, btn.y, 50).setStrokeStyle(3, 0x5eba7d).setDepth(25);
      const txt  = this.add.text(width / 2, height - 200, 'TAP GUNNER TO SELECT IT', {
        fontFamily: 'monospace', fontSize: '13px', color: '#5eba7d', fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(25);
      this.tweens.add({ targets: ring, scaleX: 1.2, scaleY: 1.2, alpha: 0.5, duration: 700, yoyo: true, repeat: -1 });
      this.tutorialOverlays = [ring, txt];
    } else if (phase === 'showPlacement') {
      const opt  = this.levelData.tutorialOptimalSpot;
      if (!opt) return;
      const ox = opt.x, oy = this.CT + opt.oy;
      const dot  = this.add.circle(ox, oy, 22).setStrokeStyle(3, 0x5eba7d).setDepth(25);
      const dot2 = this.add.circle(ox, oy, 8, 0x5eba7d, 0.9).setDepth(25);
      const txt  = this.add.text(width / 2, this.PLAY_TOP + 20, 'PLACE YOUR TOWER HERE', {
        fontFamily: 'monospace', fontSize: '13px', color: '#5eba7d', fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(25);
      this.tweens.add({ targets: [dot, dot2], scaleX: 1.3, scaleY: 1.3, alpha: 0.6, duration: 600, yoyo: true, repeat: -1 });
      this.tutorialOverlays = [dot, dot2, txt];
    } else if (phase === 'highlightStart') {
      const ring = this.add.circle(this.startWaveBtn.x, this.startWaveBtn.y, 55).setStrokeStyle(3, 0x5eba7d).setDepth(25);
      const txt  = this.add.text(width / 2, height - 200, 'NOW START THE WAVE', {
        fontFamily: 'monospace', fontSize: '13px', color: '#5eba7d', fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(25);
      this.tweens.add({ targets: ring, scaleX: 1.2, scaleY: 1.2, alpha: 0.5, duration: 700, yoyo: true, repeat: -1 });
      this.tutorialOverlays = [ring, txt];
    }
  }

  // ── Scene drawing ─────────────────────────────────────────────────────
  drawPath() {
    const gfx = this.add.graphics();
    gfx.lineStyle(40, 0x161b22, 1);
    gfx.beginPath();
    gfx.moveTo(this.pathPoints[0].x, this.pathPoints[0].y);
    this.pathPoints.forEach(p => gfx.lineTo(p.x, p.y));
    gfx.strokePath();
    gfx.lineStyle(40, 0x1e2530, 0.5);
    gfx.beginPath();
    gfx.moveTo(this.pathPoints[0].x, this.pathPoints[0].y);
    this.pathPoints.forEach(p => gfx.lineTo(p.x, p.y));
    gfx.strokePath();

    this.add.text(this.pathPoints[0].x, this.CT + 4, 'v ENTRY', { fontFamily: 'monospace', fontSize: '10px', color: '#c43a3a', letterSpacing: 2 }).setOrigin(0.5);
    this.add.text(195, this.CB - 6, '^ BASE', { fontFamily: 'monospace', fontSize: '10px', color: '#3a8fc4', letterSpacing: 2 }).setOrigin(0.5);
  }

  drawHeader() {
    const { width } = this.scale;
    const HY = this.HY;

    this.add.rectangle(width / 2, HY, width, 92, 0x161b22);
    this.add.rectangle(width / 2, HY + 46, width, 1, 0x334455);

    const backBtn = this.add.rectangle(34, HY - 18, 52, 26, 0x1e2530).setInteractive();
    this.add.text(34, HY - 18, '<- BACK', { fontFamily: 'monospace', fontSize: '10px', color: '#8899aa' }).setOrigin(0.5);
    backBtn.on('pointerdown', () => {
      if (!this.waveActive) {
        this.hidePreview(); this.dismissUpgradePanel();
        this.cameras.main.fade(200, 0, 0, 0);
        this.time.delayedCall(200, () => this.scene.start('DockScene'));
      }
    });

    this.add.text(width / 2, HY - 22, this.levelData ? this.levelData.name : 'LEVEL', { fontFamily: 'monospace', fontSize: '10px', color: '#8899aa', letterSpacing: 3 }).setOrigin(0.5);
    this.waveIndicator = this.add.text(width - 14, HY - 22, '', { fontFamily: 'monospace', fontSize: '10px', color: '#445566' }).setOrigin(1, 0.5);

    // Parts — amber diamond + number
    const gfx = this.add.graphics();
    gfx.fillStyle(0xe8a020, 1);
    gfx.fillRect(20, HY + 3, 10, 10);
    this.partsText = this.add.text(36, HY + 8, '0', { fontFamily: 'monospace', fontSize: '18px', color: '#e8a020', fontStyle: 'bold' }).setOrigin(0, 0.5);
    this.add.text(36, HY + 24, 'PARTS', { fontFamily: 'monospace', fontSize: '9px', color: '#556677', letterSpacing: 2 }).setOrigin(0, 0.5);

    this.waveText = this.add.text(width / 2, HY + 16, 'PLACE TOWERS — THEN START WAVE', { fontFamily: 'monospace', fontSize: '10px', color: '#eef2f8', fontStyle: 'bold' }).setOrigin(0.5);
  }

  drawBottomPanel() {
    const { width, height } = this.scale;

    // HP strip just above tower buttons
    const hpStripY = height - 162;
    this.add.rectangle(width / 2, hpStripY, width, 38, 0x10180f);
    this.add.rectangle(width / 2, hpStripY - 19, width, 1, 0x334455).setDepth(9);
    this.add.circle(28, hpStripY, 8, 0x3a8fc4).setDepth(9);
    this.add.text(28, hpStripY, 'B', { fontFamily: 'monospace', fontSize: '8px', color: '#0d1117', fontStyle: 'bold' }).setOrigin(0.5).setDepth(9);
    this.add.text(44, hpStripY - 6, 'BASE HP', { fontFamily: 'monospace', fontSize: '9px', color: '#8899aa', letterSpacing: 1 }).setDepth(9);
    this.hpText = this.add.text(44, hpStripY + 7, this.baseHp + ' / ' + this.baseHpMax, { fontFamily: 'monospace', fontSize: '13px', color: '#5eba7d', fontStyle: 'bold' }).setDepth(9);
    const barX = 118, barW = width - 132;
    this.add.rectangle(barX + barW / 2, hpStripY, barW, 10, 0x1e2530).setDepth(9);
    this.hpBarFill = this.add.rectangle(barX, hpStripY, barW, 10, 0x5eba7d).setOrigin(0, 0.5).setDepth(9);

    // Tower buttons
    const panelY = height - 124;
    this.add.rectangle(width / 2, height - 62, width, 124, 0x161b22).setDepth(8);
    this.add.rectangle(width / 2, panelY, width, 1, 0x334455).setDepth(8);

    const towerTypes = ['gunner', 'bomber', 'barricade'];
    this.towerButtons = {};

    towerTypes.forEach((type, i) => {
      const data      = TOWER_DATA[type];
      const x         = 50 + i * 94;
      const y         = panelY + 52;
      const colourHex = '#' + data.colour.toString(16).padStart(6, '0');
      const count     = this.loadout[type];
      const active    = count > 0;

      const btn = this.add.rectangle(x, y, 82, 80, active ? 0x1e2530 : 0x161b22).setInteractive().setDepth(9);
      btn.towerType = type;
      this.add.rectangle(x, y, 82, 80).setStrokeStyle(1, active ? data.colour : 0x334455).setDepth(9);
      this.add.circle(x, y - 23, 8, active ? data.colour : 0x334455).setDepth(9);
      this.add.text(x, y + 2, data.name, { fontFamily: 'monospace', fontSize: '11px', color: active ? '#eef2f8' : '#556677', fontStyle: 'bold' }).setOrigin(0.5).setDepth(9);
      const countText = this.add.text(x, y + 20, 'x' + count, { fontFamily: 'monospace', fontSize: '13px', color: active ? colourHex : '#445566' }).setOrigin(0.5).setDepth(9);
      btn.countText = countText;
      this.towerButtons[type] = btn;

      btn.on('pointerdown', () => this.selectTower(type));
      btn.on('pointerover', () => { if (this.selectedTowerType !== type) btn.setFillStyle(0x252c38); });
      btn.on('pointerout',  () => { if (this.selectedTowerType !== type) btn.setFillStyle(active ? 0x1e2530 : 0x161b22); });
    });

    this.startWaveBtn = this.add.rectangle(width - 56, panelY + 52, 84, 80, 0x0d1a0d).setInteractive().setDepth(9);
    this.add.rectangle(width - 56, panelY + 52, 84, 80).setStrokeStyle(1, 0x5eba7d).setDepth(9);
    this.startWaveBtnLabel = this.add.text(width - 56, panelY + 40, 'START', { fontFamily: 'monospace', fontSize: '14px', color: '#5eba7d', fontStyle: 'bold' }).setOrigin(0.5).setDepth(9);
    this.startWaveBtnSub   = this.add.text(width - 56, panelY + 60, 'WAVE 1', { fontFamily: 'monospace', fontSize: '10px', color: '#5eba7d' }).setOrigin(0.5).setDepth(9);
    this.startWaveBtn.on('pointerdown', () => this.startNextWave());
    this.startWaveBtn.on('pointerover', () => this.startWaveBtn.setFillStyle(0x162616));
    this.startWaveBtn.on('pointerout',  () => this.startWaveBtn.setFillStyle(0x0d1a0d));
  }

  updateHpBar() {
    if (!this.hpBarFill) return;
    const pct = this.baseHp / this.baseHpMax;
    this.hpBarFill.setSize((this.scale.width - 132) * pct, 10);
    this.hpBarFill.setFillStyle(pct > 0.5 ? 0x5eba7d : pct > 0.25 ? 0xe8a020 : 0xc43a3a);
  }

  selectTower(type) {
    if (this.loadout[type] <= 0 || this.gameOver) return;
    this.dismissUpgradePanel();
    this.selectedTowerType = type;
    Object.keys(this.towerButtons).forEach(t => {
      this.towerButtons[t].setFillStyle(t === type ? 0x2a3a4a : (this.loadout[t] > 0 ? 0x1e2530 : 0x161b22));
    });
    if (this.tutorialPhase === 'highlightGunner' && type === 'gunner') this.advanceTutorialPhase('showPlacement');
  }

  // ── Combat ────────────────────────────────────────────────────────────
  getSpeedModifier(enemy) {
    let mod = 1.0;
    this.placedTowers.forEach(t => {
      if (t.type !== 'barricade') return;
      if (Phaser.Math.Distance.Between(t.x, t.y, enemy.sprite.x, enemy.sprite.y) <= t.data.range)
        mod = Math.min(mod, t.data.slowAmount);
    });
    return mod;
  }

  towerShoot(tower) {
    if (!this.waveActive || this.gameOver) return;
    if (tower.type === 'barricade') return;
    if (this.time.now - tower.lastFired < tower.data.fireRate) return;

    const inRange = this.activeEnemies.filter(e => {
      if (!e.alive || !e.sprite || !e.sprite.active) return false;
      return Phaser.Math.Distance.Between(tower.x, tower.y, e.sprite.x, e.sprite.y) <= tower.data.range;
    });
    if (inRange.length === 0) return;

    const target = inRange.reduce((best, e) => e.pathProgress > best.pathProgress ? e : best, inRange[0]);
    tower.lastFired = this.time.now;

    const bullet = this.add.circle(tower.x, tower.y, tower.type === 'bomber' ? 7 : 5, tower.data.colour).setDepth(7);
    this.tweens.add({
      targets: bullet, x: target.sprite.x, y: target.sprite.y, duration: 160,
      onComplete: () => {
        bullet.destroy();
        if (!target.alive) return;
        if (tower.type === 'bomber') {
          const splashR = tower.data.splashRadius || 80;
          this.activeEnemies.filter(e => e.alive && e.sprite && e.sprite.active &&
            Phaser.Math.Distance.Between(target.sprite.x, target.sprite.y, e.sprite.x, e.sprite.y) <= splashR
          ).forEach(e => this.dealDamage(e, tower.data.damage, 'bomber'));
          const flash = this.add.circle(target.sprite.x, target.sprite.y, splashR, 0xe8a020, 0.28).setDepth(6);
          this.tweens.add({ targets: flash, alpha: 0, scaleX: 1.5, scaleY: 1.5, duration: 280, onComplete: () => flash.destroy() });
        } else {
          this.dealDamage(target, tower.data.damage, tower.type);
        }
      }
    });
  }

  dealDamage(enemy, damage, sourceType) {
    if (!enemy.alive) return;
    enemy.hp -= damage;
    if (sourceType && this.towerStats[sourceType] && this.towerStats[sourceType].damageDealt !== undefined)
      this.towerStats[sourceType].damageDealt += damage;
    if (enemy.sprite && enemy.sprite.active)
      this.tweens.add({ targets: enemy.sprite, alpha: 0.3, duration: 60, yoyo: true });
    if (enemy.hp <= 0) this.killEnemy(enemy, sourceType);
  }

  killEnemy(enemy, sourceType) {
    if (!enemy.alive) return;
    enemy.alive = false;
    this.activeEnemies = this.activeEnemies.filter(e => e !== enemy);
    this.parts += enemy.data.partsReward;
    this.partsText.setText('' + this.parts);
    this.killStats[enemy.type] = (this.killStats[enemy.type] || 0) + 1;
    if (sourceType && this.towerStats[sourceType] && this.towerStats[sourceType].kills !== undefined)
      this.towerStats[sourceType].kills++;
    if (enemy.hpBg)   { enemy.hpBg.destroy();   enemy.hpBg   = null; }
    if (enemy.hpFill) { enemy.hpFill.destroy();  enemy.hpFill = null; }
    if (enemy.sprite && enemy.sprite.active)
      this.tweens.add({ targets: enemy.sprite, alpha: 0, scaleX: 1.8, scaleY: 1.8, duration: 200, onComplete: () => { if (enemy.sprite) enemy.sprite.destroy(); } });
    if (this.upgradePanel && this.activeTower) this.showUpgradePanel(this.activeTower);
    this.waveEnemyResolved++;
    this.checkWaveComplete();
  }

  // ── Wave management ───────────────────────────────────────────────────
  startNextWave() {
    if (this.waveActive || this.gameOver) return;
    if (this.currentWave >= this.levelData.waves.length) return;

    if (this.tutorialElements) { this.tutorialElements.forEach(e => e.destroy()); this.tutorialElements = null; }
    if (this.tutorialPhase === 'highlightStart') this.advanceTutorialPhase('complete');
    this.hidePreview();
    this.dismissUpgradePanel();
    this.selectedTowerType = null;
    Object.keys(this.towerButtons).forEach(t => this.towerButtons[t].setFillStyle(this.loadout[t] > 0 ? 0x1e2530 : 0x161b22));

    const waveData = this.levelData.waves[this.currentWave];
    this.waveActive = true;

    this.startWaveBtn.setAlpha(0.5).disableInteractive();
    this.startWaveBtnLabel.setText('WAVE ' + (this.currentWave + 1));
    this.startWaveBtnSub.setText('ACTIVE');
    this.waveText.setText('WAVE ' + (this.currentWave + 1) + ' of ' + this.levelData.waves.length);
    this.waveText.setStyle({ color: '#e8a020' });
    if (this.waveIndicator) this.waveIndicator.setText('WAVE ' + (this.currentWave + 1) + '/' + this.levelData.waves.length);

    const { width, height } = this.scale;
    const inc = this.add.text(width / 2, height / 2 - 50, 'WAVE ' + (this.currentWave + 1) + '\nINCOMING', {
      fontFamily: 'monospace', fontSize: '38px', color: '#c43a3a', fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5).setAlpha(0).setDepth(25);
    this.tweens.add({ targets: inc, alpha: 1, duration: 250, onComplete: () => {
      this.tweens.add({ targets: inc, alpha: 0, duration: 500, delay: 600, onComplete: () => inc.destroy() });
    }});

    this.time.delayedCall(waveData.preWaveDelay || 2000, () => {
      this.waveText.setText('WAVE ' + (this.currentWave + 1) + ' of ' + this.levelData.waves.length);
      this.waveText.setStyle({ color: '#eef2f8' });
      this.spawnWave(waveData);
    });
  }

  spawnWave(waveData) {
    let totalDelay = 0;
    this.waveEnemyTotal    = waveData.enemies.reduce((s, g) => s + g.count, 0);
    this.waveEnemyResolved = 0;

    waveData.enemies.forEach(group => {
      let i = 0;
      while (i < group.count) {
        const canBurst  = (i + 2) < group.count;
        const doBurst   = canBurst && Math.random() < 0.28;
        const burstSize = doBurst ? (Math.random() < 0.5 ? 2 : 3) : 1;

        for (let b = 0; b < burstSize && i < group.count; b++, i++) {
          const delay = totalDelay + (b > 0 ? 120 + Math.random() * 260 : 0);
          this.time.delayedCall(delay, () => { if (!this.gameOver) this.spawnEnemy(group.type); });
        }

        if (doBurst) {
          totalDelay += group.interval * (1.3 + Math.random() * 0.9);
        } else {
          const r = Math.random();
          totalDelay += Math.max(140, group.interval * (r < 0.2 ? 0.45 + Math.random() * 0.2 : r < 0.8 ? 0.75 + Math.random() * 0.5 : 1.3 + Math.random() * 0.6));
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
    const enemy  = { type, data: { ...data }, sprite, hp: data.hp, maxHp: data.hp, alive: true, pathProgress: 0, hpBg, hpFill };
    this.activeEnemies.push(enemy);
    this.moveToWaypoint(enemy, 1);
  }

  moveToWaypoint(enemy, idx) {
    if (!enemy.alive || this.gameOver) return;
    if (idx >= this.pathPoints.length) { this.enemyReachedEnd(enemy); return; }
    const target = this.pathPoints[idx];
    const dist   = Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, target.x, target.y);
    enemy.pathProgress = idx;
    this.tweens.add({
      targets: enemy.sprite, x: target.x, y: target.y,
      duration: (dist / (enemy.data.speed * this.getSpeedModifier(enemy))) * 1000, ease: 'Linear',
      onComplete: () => { if (enemy.alive) this.moveToWaypoint(enemy, idx + 1); }
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

    this.baseHp -= enemy.data.baseDamage;
    if (this.baseHp < 0) this.baseHp = 0;
    this.hpText.setText(this.baseHp + ' / ' + this.baseHpMax);
    if (this.baseHp <= 3) this.hpText.setStyle({ color: '#c43a3a' });
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
        if (this.isEndless) {
          // Endless: keep going — add the next generated wave
          const nextWave = this.generateNextEndlessWave(this.currentWave);
          this.levelData.waves.push(nextWave);
        } else {
          this.time.delayedCall(400, () => this.triggerGameOver(true));
          return;
        }
      }

      this.waveText.setText('WAVE ' + this.currentWave + ' COMPLETE — PLACE MORE TOWERS');
      this.waveText.setStyle({ color: '#eef2f8' });
      this.startWaveBtn.setAlpha(1).setInteractive();
      this.startWaveBtnLabel.setText('START');
      this.startWaveBtnSub.setText('WAVE ' + (this.currentWave + 1));
    });
  }

  // Generate the next endless wave on-the-fly so it's truly infinite
  generateNextEndlessWave(waveNumber) {
    const diff     = waveNumber + 4;
    const base     = Math.floor(6 + diff * 1.8);
    const hasHulk  = diff >= 3;
    const enemies  = [];
    enemies.push({ type: 'saltChild',   count: Math.max(8, base), interval: Math.max(650, 1600 - diff * 40) });
    if (diff >= 2) enemies.push({ type: 'scrapRunner', count: Math.max(4, Math.floor(base * 0.6)), interval: Math.max(800, 1900 - diff * 45) });
    if (hasHulk)   enemies.push({ type: 'driftwoodHulk', count: Math.min(1 + Math.floor((diff - 3) / 3), 6), interval: Math.max(2500, 6000 - diff * 150) });
    if (diff >= 14 && waveNumber % 5 === 4) enemies.push({ type: 'frontCommander', count: 1, interval: 0 });
    return { preWaveDelay: 2200, enemies };
  }

  // ── Game over ─────────────────────────────────────────────────────────
  triggerGameOver(victory) {
    this.gameOver = true; this.waveActive = false;
    this.hidePreview(); this.dismissUpgradePanel();
    this.tutorialOverlays.forEach(e => { if (e && e.destroy) e.destroy(); });
    this.towerTimerEvents.forEach(e => e.remove(false));
    this.towerTimerEvents = [];

    if (victory) this.saveProgress();

    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.88).setDepth(20);

    const tc = victory ? '#5eba7d' : '#c43a3a';
    this.add.text(width / 2, 172, victory ? 'VICTORY' : 'BASE LOST', { fontFamily: 'monospace', fontSize: '44px', color: tc, fontStyle: 'bold' }).setOrigin(0.5).setDepth(21);
    this.add.text(width / 2, 220, victory ? 'YOUR SOVEREIGNTY HOLDS' : 'YOUR BASE WAS OVERWHELMED', { fontFamily: 'monospace', fontSize: '13px', color: '#8899aa', letterSpacing: 2 }).setOrigin(0.5).setDepth(21);

    let y = 248;

    const hc = this.baseHp > 5 ? '#5eba7d' : this.baseHp > 2 ? '#e8a020' : '#c43a3a';
    this.add.text(28, y, 'BASE HP REMAINING', { fontFamily: 'monospace', fontSize: '10px', color: '#8899aa', letterSpacing: 2 }).setDepth(21);
    this.add.text(28, y + 18, this.baseHp + ' / ' + this.baseHpMax, { fontFamily: 'monospace', fontSize: '22px', color: hc, fontStyle: 'bold' }).setDepth(21);
    const bw = width - 56;
    this.add.rectangle(width / 2, y + 56, bw, 8, 0x2a3a4a).setDepth(21);
    this.add.rectangle(28, y + 56, bw * (this.baseHp / this.baseHpMax), 8, Phaser.Display.Color.HexStringToColor(hc).color).setOrigin(0, 0.5).setDepth(21);
    y += 76;

    this.add.rectangle(width / 2, y, width - 48, 1, 0x334455).setDepth(21); y += 12;
    this.add.text(28, y, 'ESCAPED', { fontFamily: 'monospace', fontSize: '10px', color: '#8899aa', letterSpacing: 2 }).setDepth(21);
    this.add.text(28, y + 16, '' + this.enemiesEscaped, { fontFamily: 'monospace', fontSize: '20px', color: this.enemiesEscaped > 0 ? '#c43a3a' : '#5eba7d', fontStyle: 'bold' }).setDepth(21);
    this.add.text(width / 2 + 10, y, 'PARTS EARNED', { fontFamily: 'monospace', fontSize: '10px', color: '#8899aa', letterSpacing: 2 }).setDepth(21);
    this.add.text(width / 2 + 10, y + 16, '' + this.parts, { fontFamily: 'monospace', fontSize: '20px', color: '#e8a020', fontStyle: 'bold' }).setDepth(21);
    y += 50;

    if (this.isEndless) {
      this.add.rectangle(width / 2, y, width - 48, 1, 0x334455).setDepth(21); y += 12;
      this.add.text(28, y, 'WAVES SURVIVED', { fontFamily: 'monospace', fontSize: '10px', color: '#8899aa', letterSpacing: 2 }).setDepth(21);
      this.add.text(width - 28, y, '' + this.currentWave, { fontFamily: 'monospace', fontSize: '20px', color: '#3a8fc4', fontStyle: 'bold' }).setOrigin(1, 0).setDepth(21);
      y += 36;
    }

    this.add.rectangle(width / 2, y, width - 48, 1, 0x334455).setDepth(21); y += 12;
    this.add.text(28, y, 'TOWER PERFORMANCE', { fontFamily: 'monospace', fontSize: '10px', color: '#8899aa', letterSpacing: 2 }).setDepth(21); y += 18;
    ['gunner', 'bomber', 'barricade'].forEach(type => {
      if (!this.towersUsed[type]) return;
      const d  = TOWER_DATA[type];
      const ch = '#' + d.colour.toString(16).padStart(6, '0');
      this.add.text(28, y, d.name, { fontFamily: 'monospace', fontSize: '13px', color: ch, fontStyle: 'bold' }).setDepth(21);
      if (type === 'barricade') {
        this.add.text(width - 28, y, 'x' + this.towersUsed[type] + ' placed', { fontFamily: 'monospace', fontSize: '12px', color: '#556677' }).setOrigin(1, 0).setDepth(21);
      } else {
        const st = this.towerStats[type];
        this.add.text(width / 2 - 8, y, Math.round(st.damageDealt || 0) + ' dmg', { fontFamily: 'monospace', fontSize: '12px', color: '#eef2f8' }).setOrigin(1, 0).setDepth(21);
        this.add.text(width - 28, y, (st.kills || 0) + ' kills', { fontFamily: 'monospace', fontSize: '12px', color: '#8899aa' }).setOrigin(1, 0).setDepth(21);
      }
      y += 20;
    });

    this.add.rectangle(width / 2, y + 4, width - 48, 1, 0x334455).setDepth(21); y += 16;
    const totalKills = Object.values(this.killStats).reduce((s, v) => s + v, 0);
    this.add.text(28, y, 'ENEMIES ELIMINATED', { fontFamily: 'monospace', fontSize: '10px', color: '#8899aa', letterSpacing: 2 }).setDepth(21);
    this.add.text(width - 28, y, totalKills + ' TOTAL', { fontFamily: 'monospace', fontSize: '13px', color: '#eef2f8', fontStyle: 'bold' }).setOrigin(1, 0).setDepth(21);
    y += 18;
    Object.entries(this.killStats).forEach(function(entry) {
      const name = ENEMY_DATA[entry[0]] ? ENEMY_DATA[entry[0]].name : entry[0].toUpperCase();
      this.add.text(28, y, name, { fontFamily: 'monospace', fontSize: '11px', color: '#556677' }).setDepth(21);
      this.add.text(width - 28, y, 'x' + entry[1], { fontFamily: 'monospace', fontSize: '11px', color: '#eef2f8' }).setOrigin(1, 0).setDepth(21);
      y += 18;
    }.bind(this));

    if (!this.isEndless) {
      if (victory && this.levelId === 1 && this.storylineId === 1) {
        y += 8;
        this.add.rectangle(width / 2, y + 28, width - 48, 56, 0x0d1e2e).setDepth(21);
        this.add.rectangle(width / 2, y + 28, width - 48, 56).setStrokeStyle(1, 0x3a8fc4).setDepth(21);
        this.add.circle(48, y + 28, 14, 0x3a8fc4).setDepth(21);
        this.add.text(48, y + 28, 'W2', { fontFamily: 'monospace', fontSize: '10px', color: '#0d1117', fontStyle: 'bold' }).setOrigin(0.5).setDepth(22);
        this.add.text(72, y + 16, 'NEW RECRUIT', { fontFamily: 'monospace', fontSize: '13px', color: '#3a8fc4', fontStyle: 'bold' }).setDepth(22);
        this.add.text(72, y + 34, 'A second worker awaits at the factory.', { fontFamily: 'monospace', fontSize: '11px', color: '#8899aa' }).setDepth(22);
        y += 64;
      }
      if (victory && this.levelId === 2 && this.storylineId === 1) {
        y += 8;
        this.add.rectangle(width / 2, y + 28, width - 48, 56, 0x1a1200).setDepth(21);
        this.add.rectangle(width / 2, y + 28, width - 48, 56).setStrokeStyle(1, 0xe8a020).setDepth(21);
        this.add.text(28, y + 16, 'FACTORY UNLOCK', { fontFamily: 'monospace', fontSize: '13px', color: '#e8a020', fontStyle: 'bold' }).setDepth(22);
        this.add.text(28, y + 34, 'Bomber and Barricade assembly now available.', { fontFamily: 'monospace', fontSize: '11px', color: '#8899aa' }).setDepth(22);
        y += 64;
      }
      if (victory && this.levelId === 3 && this.storylineId === 1) {
        y += 8;
        this.add.rectangle(width / 2, y + 32, width - 48, 64, 0x0a1a08).setDepth(21);
        this.add.rectangle(width / 2, y + 32, width - 48, 64).setStrokeStyle(1, 0x5eba7d).setDepth(21);
        this.add.text(28, y + 12, 'UPGRADES UNLOCKED', { fontFamily: 'monospace', fontSize: '13px', color: '#5eba7d', fontStyle: 'bold' }).setDepth(22);
        this.add.text(28, y + 32, 'Tap any placed tower during combat', { fontFamily: 'monospace', fontSize: '11px', color: '#8899aa' }).setDepth(22);
        this.add.text(28, y + 48, 'to spend PARTS and increase its power.', { fontFamily: 'monospace', fontSize: '11px', color: '#8899aa' }).setDepth(22);
        y += 72;
      }
      if (victory && this.levelId === 8) {
        y += 8;
        this.add.rectangle(width / 2, y + 28, width - 48, 56, 0x1a0a0a).setDepth(21);
        this.add.rectangle(width / 2, y + 28, width - 48, 56).setStrokeStyle(1, 0xc43a3a).setDepth(21);
        this.add.text(28, y + 16, 'NEW THREAT INCOMING', { fontFamily: 'monospace', fontSize: '13px', color: '#c43a3a', fontStyle: 'bold' }).setDepth(22);
        this.add.text(28, y + 34, 'The Limbic Cartel has taken notice.', { fontFamily: 'monospace', fontSize: '11px', color: '#8899aa' }).setDepth(22);
      }
    }

    const btnY = height - 80;
    const btn  = this.add.rectangle(width / 2, btnY, 260, 68, 0x161b22).setInteractive().setDepth(22);
    this.add.rectangle(width / 2, btnY, 260, 68).setStrokeStyle(1, 0xe8a020).setDepth(22);
    this.add.text(width / 2, btnY, 'RETURN TO BASE', { fontFamily: 'monospace', fontSize: '18px', color: '#e8a020', fontStyle: 'bold' }).setOrigin(0.5).setDepth(23);
    btn.on('pointerdown', () => { this.cameras.main.fade(300, 0, 0, 0); this.time.delayedCall(300, () => this.scene.start('BaseScene')); });
    btn.on('pointerover', () => btn.setFillStyle(0x252c38));
    btn.on('pointerout',  () => btn.setFillStyle(0x161b22));
  }

  saveProgress() {
    const slotIndex = localStorage.getItem('factower_active_slot');
    const saveKey   = 'factower_save_' + slotIndex;
    const save      = JSON.parse(localStorage.getItem(saveKey));
    if (!save.completedLevels) save.completedLevels = {};
    const key = this.isEndless ? 'endless' : 'storyline' + this.storylineId;
    if (!save.completedLevels[key]) save.completedLevels[key] = [];
    if (!save.completedLevels[key].includes(this.levelId)) save.completedLevels[key].push(this.levelId);
    save.parts = (save.parts || 0) + this.parts;
    save.level = Math.max(save.level || 1, this.levelId + 1);
    if (save.stockpile) {
      Object.keys(this.towersUsed).forEach(type => {
        save.stockpile[type] = Math.max(0, (save.stockpile[type] || 0) - (this.towersUsed[type] || 0));
      });
    }
    if (this.levelId === 1 && this.storylineId === 1 && !save.workers) save.workers = 2;
    if (this.levelId === 8 && this.storylineId === 1) save.factionOneComplete = true;
    localStorage.setItem(saveKey, JSON.stringify(save));
  }

  update() {
    this.activeEnemies.forEach(enemy => {
      if (!enemy.alive || !enemy.sprite || !enemy.sprite.active) return;
      const x    = enemy.sprite.x;
      const y    = enemy.sprite.y;
      const barW = Math.max(enemy.data.size * 2.5, 22);
      const barY = y - enemy.data.size - 7;
      if (enemy.hpBg) enemy.hpBg.setPosition(x, barY);
      if (enemy.hpFill) {
        const pct = Math.max(0, enemy.hp / enemy.maxHp);
        enemy.hpFill.setPosition(x - barW / 2, barY);
        enemy.hpFill.setSize(barW * pct, 4);
        enemy.hpFill.setFillStyle(pct > 0.5 ? 0x5eba7d : pct > 0.25 ? 0xe8a020 : 0xc43a3a);
      }
    });
  }
}
