class CombatScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CombatScene' });
  }

  init(data) {
    this.storylineId = data.storylineId || 1;
    this.levelId     = data.levelId     || 1;
    this.levelData   = data.levelData;
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
    this.towerTapped       = false;

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
    this.startingLoadout = { gunner: this.loadout.gunner, bomber: this.loadout.bomber, barricade: this.loadout.barricade };

    this.HY = 200;
    this.CT = 278;
    this.CB = 686;

    this.PLAY_TOP    = this.HY + 68;
    this.PLAY_BOTTOM = height - 156;
    this.PLAY_LEFT   = 14;
    this.PLAY_RIGHT  = width - 14;

    this.pathPoints = [
      { x: 195, y: this.CT        },
      { x: 195, y: this.CT +  70  },
      { x: 60,  y: this.CT +  70  },
      { x: 60,  y: this.CT + 230  },
      { x: 330, y: this.CT + 230  },
      { x: 330, y: this.CT + 360  },
      { x: 60,  y: this.CT + 360  },
      { x: 60,  y: this.CT + 430  },
      { x: 195, y: this.CT + 430  },
      { x: 195, y: this.CB        }
    ];

    this.add.rectangle(width / 2, height / 2, width, height, 0x0d1117);
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

  distToSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.sqrt((px - ax) * (px - ax) + (py - ay) * (py - ay));
    let t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
    return Math.sqrt((px - (ax + t * dx)) * (px - (ax + t * dx)) + (py - (ay + t * dy)) * (py - (ay + t * dy)));
  }

  isOnPath(x, y) {
    for (let i = 0; i < this.pathPoints.length - 1; i++) {
      const a = this.pathPoints[i], b = this.pathPoints[i + 1];
      if (this.distToSegment(x, y, a.x, a.y, b.x, b.y) < 30) return true;
    }
    return false;
  }

  isOccupied(x, y) {
    return this.placedTowers.some(t => Math.sqrt((t.x - x) * (t.x - x) + (t.y - y) * (t.y - y)) < 32);
  }

  isInPlayArea(x, y) {
    return x >= this.PLAY_LEFT && x <= this.PLAY_RIGHT &&
           y >= this.PLAY_TOP  && y <= this.PLAY_BOTTOM;
  }

  canPlaceAt(x, y) {
    return this.isInPlayArea(x, y) && !this.isOnPath(x, y) && !this.isOccupied(x, y);
  }

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
    const colour = valid ? data.colour : 0xc43a3a;

    if (!this.previewCircle) {
      this.previewCircle = this.add.circle(x, y, 14, colour, 0.25).setDepth(15);
      this.previewRing   = this.add.circle(x, y, data.range).setStrokeStyle(1, colour, 0.4).setDepth(15);
    } else {
      this.previewCircle.setPosition(x, y).setFillStyle(colour, 0.25);
      this.previewRing.setPosition(x, y).setStrokeStyle(1, colour, 0.4);
      this.previewRing.setRadius(data.range);
    }
  }

  hidePreview() {
    if (this.previewCircle) { this.previewCircle.destroy(); this.previewCircle = null; }
    if (this.previewRing)   { this.previewRing.destroy();   this.previewRing   = null; }
  }

  placeTower(x, y) {
    if (this.loadout[this.selectedTowerType] <= 0) return;

    const type = this.selectedTowerType;
    const data = TOWER_DATA[type];

    const hitZone = this.add.circle(x, y, 20, 0xffffff, 0).setDepth(10).setInteractive();
    const towerCircle = this.add.circle(x, y, 14, data.colour, 0.9).setDepth(4);
    this.add.circle(x, y, 14).setStrokeStyle(2, data.colour).setDepth(4);
    const towerLabel = this.add.text(x, y, data.name.substring(0, 3), {
      fontFamily: 'monospace', fontSize: '9px', color: '#eef2f8', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(5);

    if (type === 'barricade') {
      this.add.circle(x, y, data.range, data.colour, 0.04).setDepth(2);
      this.add.circle(x, y, data.range).setStrokeStyle(1, data.colour, 0.2).setDepth(2);
      this.towerStats.barricade.placed++;
    } else {
      const ring = this.add.circle(x, y, data.range, data.colour, 0.08).setDepth(2);
      const rb   = this.add.circle(x, y, data.range).setStrokeStyle(1, data.colour, 0.3).setDepth(2);
      this.time.delayedCall(1400, () => { ring.destroy(); rb.destroy(); });
    }

    this.loadout[type]--;
    this.towerButtons[type].countText.setText('x' + this.loadout[type]);
    if (this.loadout[type] === 0) this.towerButtons[type].setFillStyle(0x161b22);
    this.towersUsed[type] = (this.towersUsed[type] || 0) + 1;

    const tower = {
      type, x, y,
      data:        { ...data },
      lastFired:   0,
      upgradeTier: 0,
      towerCircle,
      towerLabel,
      tierBadge:   null,
      hitZone
    };
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

    this.updatePreview(x, y);
  }

  showUpgradePanel(tower) {
    this.dismissUpgradePanel();
    this.activeTower = tower;

    const { width, height } = this.scale;
    const panelH   = 152;
    const panelY   = height - 152 - 10 - panelH / 2;
    const panelTop = panelY - panelH / 2;
    const colour   = tower.data.colour;
    const hex      = '#' + colour.toString(16).padStart(6, '0');
    const path     = TOWER_DATA[tower.type].upgrades.pathA;
    const tier     = tower.upgradeTier;
    const maxTier  = path.tiers.length;
    const items    = [];

    const bg     = this.add.rectangle(width / 2, panelY, width - 24, panelH, 0x080e08).setDepth(18);
    const border = this.add.rectangle(width / 2, panelY, width - 24, panelH).setStrokeStyle(2, colour).setDepth(18);
    items.push(bg, border);

    const tierStr = tier === 0 ? 'BASE' : 'TIER ' + tier;
    items.push(
      this.add.text(28, panelTop + 12, tower.data.name, {
        fontFamily: 'monospace', fontSize: '14px', color: hex, fontStyle: 'bold'
      }).setDepth(19),
      this.add.text(width - 28, panelTop + 12, tierStr, {
        fontFamily: 'monospace', fontSize: '12px', color: tier > 0 ? '#e8a020' : '#445566', fontStyle: 'bold'
      }).setOrigin(1, 0).setDepth(19),
      this.add.text(28, panelTop + 30, 'PATH A: ' + path.name, {
        fontFamily: 'monospace', fontSize: '10px', color: '#556677', letterSpacing: 2
      }).setDepth(19)
    );

    if (tier < maxTier) {
      const nextTier  = path.tiers[tier];
      const canAfford = this.parts >= nextTier.cost;

      items.push(
        this.add.text(28, panelTop + 52, nextTier.label, {
          fontFamily: 'monospace', fontSize: '13px', color: '#eef2f8',
          wordWrap: { width: width - 180 }
        }).setDepth(19),
        this.add.text(28, panelTop + panelH - 40, nextTier.cost + ' PARTS', {
          fontFamily: 'monospace', fontSize: '15px',
          color: canAfford ? '#e8a020' : '#c43a3a', fontStyle: 'bold'
        }).setDepth(19)
      );

      if (!canAfford) {
        items.push(this.add.text(28, panelTop + panelH - 20, 'not enough parts', {
          fontFamily: 'monospace', fontSize: '10px', color: '#445566'
        }).setDepth(19));
      }

      const btnBg  = canAfford ? 0x162616 : 0x161b22;
      const btnBdr = canAfford ? 0x5eba7d : 0x334455;
      const btnTxt = canAfford ? '#5eba7d' : '#445566';
      const btn    = this.add.rectangle(width - 72, panelTop + panelH - 32, 108, 52, btnBg).setInteractive().setDepth(19);
      const btnB   = this.add.rectangle(width - 72, panelTop + panelH - 32, 108, 52).setStrokeStyle(1, btnBdr).setDepth(19);
      const btnL   = this.add.text(width - 72, panelTop + panelH - 32, 'UPGRADE', {
        fontFamily: 'monospace', fontSize: '13px', color: btnTxt, fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(20);
      items.push(btn, btnB, btnL);

      if (canAfford) {
        btn.on('pointerdown', () => this.applyUpgrade(tower));
        btn.on('pointerover', () => btn.setFillStyle(0x1e3a1e));
        btn.on('pointerout',  () => btn.setFillStyle(btnBg));
      }
    } else {
      items.push(this.add.text(width / 2, panelTop + 90, 'FULLY UPGRADED', {
        fontFamily: 'monospace', fontSize: '15px', color: hex, fontStyle: 'bold', letterSpacing: 3
      }).setOrigin(0.5).setDepth(19));
    }

    const ring  = this.add.circle(tower.x, tower.y, tower.data.range, colour, 0.08).setDepth(3);
    const ringB = this.add.circle(tower.x, tower.y, tower.data.range).setStrokeStyle(1, colour, 0.5).setDepth(3);
    items.push(ring, ringB);

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
    const tier = tower.upgradeTier;
    if (tier >= path.tiers.length) return;

    const upgrade = path.tiers[tier];
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
      const burnTimer = this.time.addEvent({
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
      });
      this.towerTimerEvents.push(burnTimer);
    }

    if (tower.tierBadge) tower.tierBadge.destroy();
    tower.tierBadge = this.add.text(tower.x + 11, tower.y - 17, 'T' + tower.upgradeTier, {
      fontFamily: 'monospace', fontSize: '9px', color: '#ffffff', fontStyle: 'bold'
    }).setDepth(6);

    const flash = this.add.circle(tower.x, tower.y, 28, tower.data.colour, 0.45).setDepth(6);
    this.tweens.add({ targets: flash, alpha: 0, scaleX: 2, scaleY: 2, duration: 380, onComplete: () => flash.destroy() });

    this.showUpgradePanel(tower);
  }

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
      this.tutorialElements.forEach(function(e) { e.destroy(); });
      this.tutorialElements = null;
    });
    btn.on('pointerover', () => btn.setFillStyle(0x1e3a1e));
    btn.on('pointerout',  () => btn.setFillStyle(0x162216));
  }

  drawPath() {
    const graphics = this.add.graphics();
    graphics.lineStyle(40, 0x161b22, 1);
    graphics.beginPath();
    graphics.moveTo(this.pathPoints[0].x, this.pathPoints[0].y);
    this.pathPoints.forEach(function(p) { graphics.lineTo(p.x, p.y); });
    graphics.strokePath();

    graphics.lineStyle(40, 0x1e2530, 0.5);
    graphics.beginPath();
    graphics.moveTo(this.pathPoints[0].x, this.pathPoints[0].y);
    this.pathPoints.forEach(function(p) { graphics.lineTo(p.x, p.y); });
    graphics.strokePath();

    this.add.text(195, this.CT + 4, 'v ENTRY', {
      fontFamily: 'monospace', fontSize: '10px', color: '#c43a3a', letterSpacing: 2
    }).setOrigin(0.5);
    this.add.text(195, this.CB - 6, '^ BASE', {
      fontFamily: 'monospace', fontSize: '10px', color: '#3a8fc4', letterSpacing: 2
    }).setOrigin(0.5);
  }

  drawHeader() {
    const { width } = this.scale;
    const HY = this.HY;

    this.add.rectangle(width / 2, HY, width, 98, 0x161b22);
    this.add.rectangle(width / 2, HY + 49, width, 1, 0x334455);

    const barW = width - 48;
    this.add.rectangle(width / 2, HY + 60, barW, 5, 0x1e2530);
    this.hpBarFill = this.add.rectangle(24, HY + 60, barW, 5, 0x5eba7d).setOrigin(0, 0.5);

    const backBtn = this.add.rectangle(36, HY - 18, 54, 28, 0x1e2530).setInteractive();
    this.add.text(36, HY - 18, '<- BACK', { fontFamily: 'monospace', fontSize: '10px', color: '#8899aa' }).setOrigin(0.5);
    backBtn.on('pointerdown', () => {
      if (!this.waveActive) {
        this.hidePreview();
        this.dismissUpgradePanel();
        this.cameras.main.fade(200, 0, 0, 0);
        this.time.delayedCall(200, () => this.scene.start('DockScene'));
      }
    });

    this.add.text(width / 2, HY - 26, this.levelData ? this.levelData.name : 'LEVEL', {
      fontFamily: 'monospace', fontSize: '10px', color: '#8899aa', letterSpacing: 3
    }).setOrigin(0.5);

    this.add.text(82, HY - 26, 'PARTS', { fontFamily: 'monospace', fontSize: '9px', color: '#8899aa', letterSpacing: 2 }).setOrigin(0.5);
    this.partsText = this.add.text(82, HY - 5, '0', { fontFamily: 'monospace', fontSize: '20px', color: '#e8a020', fontStyle: 'bold' }).setOrigin(0.5);

    this.add.text(width - 54, HY - 26, 'BASE HP', { fontFamily: 'monospace', fontSize: '9px', color: '#8899aa', letterSpacing: 1 }).setOrigin(0.5);
    this.hpText = this.add.text(width - 54, HY - 5, '' + this.baseHp, { fontFamily: 'monospace', fontSize: '20px', color: '#5eba7d', fontStyle: 'bold' }).setOrigin(0.5);

    this.waveText = this.add.text(width / 2, HY + 25, 'PLACE TOWERS — THEN START WAVE', {
      fontFamily: 'monospace', fontSize: '11px', color: '#eef2f8', fontStyle: 'bold'
    }).setOrigin(0.5);
  }

  updateHpBar() {
    if (!this.hpBarFill) return;
    const pct = this.baseHp / this.baseHpMax;
    this.hpBarFill.setSize((this.scale.width - 48) * pct, 5);
    this.hpBarFill.setFillStyle(pct > 0.5 ? 0x5eba7d : pct > 0.25 ? 0xe8a020 : 0xc43a3a);
  }

  drawBottomPanel() {
    const { width, height } = this.scale;
    const panelY = height - 152;

    this.add.rectangle(width / 2, height - 76, width, 152, 0x161b22).setDepth(8);
    this.add.rectangle(width / 2, panelY, width, 1, 0x334455).setDepth(8);

    const towerTypes = ['gunner', 'bomber', 'barricade'];
    this.towerButtons = {};

    towerTypes.forEach((type, i) => {
      const data      = TOWER_DATA[type];
      const x         = 52 + i * 96;
      const y         = panelY + 60;
      const colourHex = '#' + data.colour.toString(16).padStart(6, '0');
      const count     = this.loadout[type];
      const active    = count > 0;

      const btn = this.add.rectangle(x, y, 86, 86, active ? 0x1e2530 : 0x161b22).setInteractive().setDepth(9);
      btn.towerType = type;
      this.add.rectangle(x, y, 86, 86).setStrokeStyle(1, active ? data.colour : 0x334455).setDepth(9);
      this.add.circle(x, y - 26, 9, active ? data.colour : 0x334455).setDepth(9);
      this.add.text(x, y + 2, data.name, {
        fontFamily: 'monospace', fontSize: '12px', color: active ? '#eef2f8' : '#556677', fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(9);

      const countText = this.add.text(x, y + 22, 'x' + count, {
        fontFamily: 'monospace', fontSize: '14px', color: active ? colourHex : '#445566'
      }).setOrigin(0.5).setDepth(9);
      btn.countText = countText;
      this.towerButtons[type] = btn;

      btn.on('pointerdown', () => this.selectTower(type));
      btn.on('pointerover', () => { if (this.selectedTowerType !== type) btn.setFillStyle(0x252c38); });
      btn.on('pointerout',  () => { if (this.selectedTowerType !== type) btn.setFillStyle(active ? 0x1e2530 : 0x161b22); });
    });

    this.startWaveBtn = this.add.rectangle(width - 60, panelY + 60, 88, 86, 0x0d1a0d).setInteractive().setDepth(9);
    this.add.rectangle(width - 60, panelY + 60, 88, 86).setStrokeStyle(1, 0x5eba7d).setDepth(9);
    this.startWaveBtnLabel = this.add.text(width - 60, panelY + 48, 'START', { fontFamily: 'monospace', fontSize: '15px', color: '#5eba7d', fontStyle: 'bold' }).setOrigin(0.5).setDepth(9);
    this.startWaveBtnSub   = this.add.text(width - 60, panelY + 68, 'WAVE 1', { fontFamily: 'monospace', fontSize: '11px', color: '#5eba7d' }).setOrigin(0.5).setDepth(9);
    this.startWaveBtn.on('pointerdown', () => this.startNextWave());
    this.startWaveBtn.on('pointerover', () => this.startWaveBtn.setFillStyle(0x162616));
    this.startWaveBtn.on('pointerout',  () => this.startWaveBtn.setFillStyle(0x0d1a0d));
  }

  selectTower(type) {
    if (this.loadout[type] <= 0) return;
    if (this.gameOver) return;
    this.dismissUpgradePanel();
    this.selectedTowerType = type;
    Object.keys(this.towerButtons).forEach(t => {
      this.towerButtons[t].setFillStyle(t === type ? 0x2a3a4a : (this.loadout[t] > 0 ? 0x1e2530 : 0x161b22));
    });
  }

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
          const splashR = tower.data.splashRadius || 100;
          this.activeEnemies.filter(e => {
            if (!e.alive || !e.sprite || !e.sprite.active) return false;
            return Phaser.Math.Distance.Between(target.sprite.x, target.sprite.y, e.sprite.x, e.sprite.y) <= splashR;
          }).forEach(e => this.dealDamage(e, tower.data.damage, 'bomber'));
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
    this.parts += enemy.data.partsReward;
    this.partsText.setText('' + this.parts);
    this.killStats[enemy.type] = (this.killStats[enemy.type] || 0) + 1;
    if (sourceType && this.towerStats[sourceType] && this.towerStats[sourceType].kills !== undefined) {
      this.towerStats[sourceType].kills++;
    }
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

  startNextWave() {
    if (this.waveActive || this.gameOver) return;
    if (this.currentWave >= this.levelData.waves.length) return;

    if (this.tutorialElements) {
      this.tutorialElements.forEach(function(e) { e.destroy(); });
      this.tutorialElements = null;
    }

    const waveData = this.levelData.waves[this.currentWave];
    this.waveActive = true;

    this.startWaveBtn.setAlpha(0.5).disableInteractive();
    this.startWaveBtnLabel.setText('WAVE ' + (this.currentWave + 1));
    this.startWaveBtnSub.setText('ACTIVE');
    this.waveText.setText('WAVE ' + (this.currentWave + 1) + ' of ' + this.levelData.waves.length + ' — STAND BY');
    this.waveText.setStyle({ color: '#e8a020' });

    const { width, height } = this.scale;
    const incoming = this.add.text(width / 2, height / 2 - 40, 'WAVE ' + (this.currentWave + 1) + '\nINCOMING', {
      fontFamily: 'monospace', fontSize: '40px', color: '#c43a3a', fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5).setAlpha(0).setDepth(25);
    this.tweens.add({
      targets: incoming, alpha: 1, duration: 250,
      onComplete: () => {
        this.tweens.add({ targets: incoming, alpha: 0, duration: 500, delay: 600, onComplete: () => incoming.destroy() });
      }
    });

    this.time.delayedCall(waveData.preWaveDelay || 2000, () => {
      this.waveText.setText('WAVE ' + (this.currentWave + 1) + ' of ' + this.levelData.waves.length);
      this.waveText.setStyle({ color: '#eef2f8' });
      this.spawnWave(waveData);
    });
  }

  spawnWave(waveData) {
    let totalDelay = 0;
    this.waveEnemyTotal    = waveData.enemies.reduce(function(s, g) { return s + g.count; }, 0);
    this.waveEnemyResolved = 0;

    waveData.enemies.forEach(group => {
      for (let i = 0; i < group.count; i++) {
        const jitter = group.interval * 0.2 * (Math.random() * 2 - 1);
        const delay  = Math.max(150, group.interval + jitter);
        this.time.delayedCall(totalDelay, () => {
          if (!this.gameOver) this.spawnEnemy(group.type);
        });
        totalDelay += delay;
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

    const enemy = {
      type, data: { ...data }, sprite,
      hp: data.hp, maxHp: data.hp,
      alive: true, pathProgress: 0,
      hpBg, hpFill
    };
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
    this.hpText.setText('' + this.baseHp);
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
        this.time.delayedCall(400, () => this.triggerGameOver(true));
        return;
      }

      this.waveText.setText('WAVE ' + this.currentWave + ' COMPLETE — PLACE MORE TOWERS');
      this.waveText.setStyle({ color: '#eef2f8' });
      this.startWaveBtn.setAlpha(1).setInteractive();
      this.startWaveBtnLabel.setText('START');
      this.startWaveBtnSub.setText('WAVE ' + (this.currentWave + 1));
    });
  }

  triggerGameOver(victory) {
    this.gameOver   = true;
    this.waveActive = false;
    this.hidePreview();
    this.dismissUpgradePanel();
    this.towerTimerEvents.forEach(e => e.remove(false));
    this.towerTimerEvents = [];

    if (victory) this.saveProgress();

    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.88).setDepth(20);

    const titleColour = victory ? '#5eba7d' : '#c43a3a';
    this.add.text(width / 2, 168, victory ? 'VICTORY' : 'BASE LOST', {
      fontFamily: 'monospace', fontSize: '44px', color: titleColour, fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(21);
    this.add.text(width / 2, 216, victory ? 'YOUR SOVEREIGNTY HOLDS' : 'YOUR BASE WAS OVERWHELMED', {
      fontFamily: 'monospace', fontSize: '13px', color: '#8899aa', letterSpacing: 2
    }).setOrigin(0.5).setDepth(21);

    let y = 240;

    const hpColour = this.baseHp > 5 ? '#5eba7d' : this.baseHp > 2 ? '#e8a020' : '#c43a3a';
    this.add.text(28, y, 'BASE HP REMAINING', { fontFamily: 'monospace', fontSize: '10px', color: '#8899aa', letterSpacing: 2 }).setDepth(21);
    this.add.text(28, y + 18, this.baseHp + ' / ' + this.baseHpMax, { fontFamily: 'monospace', fontSize: '22px', color: hpColour, fontStyle: 'bold' }).setDepth(21);
    const barMaxW = width - 56;
    this.add.rectangle(width / 2, y + 56, barMaxW, 8, 0x2a3a4a).setDepth(21);
    this.add.rectangle(28, y + 56, barMaxW * (this.baseHp / this.baseHpMax), 8, Phaser.Display.Color.HexStringToColor(hpColour).color).setOrigin(0, 0.5).setDepth(21);
    y += 76;

    this.add.rectangle(width / 2, y, width - 48, 1, 0x334455).setDepth(21);
    y += 12;
    this.add.text(28, y, 'ESCAPED', { fontFamily: 'monospace', fontSize: '10px', color: '#8899aa', letterSpacing: 2 }).setDepth(21);
    this.add.text(28, y + 16, '' + this.enemiesEscaped, { fontFamily: 'monospace', fontSize: '20px', color: this.enemiesEscaped > 0 ? '#c43a3a' : '#5eba7d', fontStyle: 'bold' }).setDepth(21);
    this.add.text(width / 2 + 10, y, 'PARTS EARNED', { fontFamily: 'monospace', fontSize: '10px', color: '#8899aa', letterSpacing: 2 }).setDepth(21);
    this.add.text(width / 2 + 10, y + 16, '' + this.parts, { fontFamily: 'monospace', fontSize: '20px', color: '#e8a020', fontStyle: 'bold' }).setDepth(21);
    y += 50;

    this.add.rectangle(width / 2, y, width - 48, 1, 0x334455).setDepth(21);
    y += 12;
    this.add.text(28, y, 'TOWER PERFORMANCE', { fontFamily: 'monospace', fontSize: '10px', color: '#8899aa', letterSpacing: 2 }).setDepth(21);
    y += 18;
    ['gunner', 'bomber', 'barricade'].forEach(type => {
      if (!this.towersUsed[type]) return;
      const data      = TOWER_DATA[type];
      const colourHex = '#' + data.colour.toString(16).padStart(6, '0');
      this.add.text(28, y, data.name, { fontFamily: 'monospace', fontSize: '13px', color: colourHex, fontStyle: 'bold' }).setDepth(21);
      if (type === 'barricade') {
        this.add.text(width - 28, y, 'x' + this.towersUsed[type] + ' placed', { fontFamily: 'monospace', fontSize: '12px', color: '#556677' }).setOrigin(1, 0).setDepth(21);
      } else {
        const st = this.towerStats[type];
        this.add.text(width / 2 - 8, y, '' + Math.round(st.damageDealt || 0) + ' dmg', { fontFamily: 'monospace', fontSize: '12px', color: '#eef2f8' }).setOrigin(1, 0).setDepth(21);
        this.add.text(width - 28, y, (st.kills || 0) + ' kills', { fontFamily: 'monospace', fontSize: '12px', color: '#8899aa' }).setOrigin(1, 0).setDepth(21);
      }
      y += 20;
    });

    this.add.rectangle(width / 2, y + 4, width - 48, 1, 0x334455).setDepth(21);
    y += 16;
    const totalKills = Object.values(this.killStats).reduce(function(s, v) { return s + v; }, 0);
    this.add.text(28, y, 'ENEMIES ELIMINATED', { fontFamily: 'monospace', fontSize: '10px', color: '#8899aa', letterSpacing: 2 }).setDepth(21);
    this.add.text(width - 28, y, totalKills + ' TOTAL', { fontFamily: 'monospace', fontSize: '13px', color: '#eef2f8', fontStyle: 'bold' }).setOrigin(1, 0).setDepth(21);
    y += 18;
    Object.entries(this.killStats).forEach(function(entry) {
      const type  = entry[0];
      const count = entry[1];
      const name  = ENEMY_DATA[type] ? ENEMY_DATA[type].name : type.toUpperCase();
      this.add.text(28, y, name, { fontFamily: 'monospace', fontSize: '11px', color: '#556677' }).setDepth(21);
      this.add.text(width - 28, y, 'x' + count, { fontFamily: 'monospace', fontSize: '11px', color: '#eef2f8' }).setOrigin(1, 0).setDepth(21);
      y += 18;
    }.bind(this));

    if (victory && this.levelId === 1) {
      y += 8;
      this.add.rectangle(width / 2, y + 28, width - 48, 56, 0x0d1e2e).setDepth(21);
      this.add.rectangle(width / 2, y + 28, width - 48, 56).setStrokeStyle(1, 0x3a8fc4).setDepth(21);
      this.add.circle(48, y + 28, 14, 0x3a8fc4).setDepth(21);
      this.add.text(48, y + 28, 'W2', { fontFamily: 'monospace', fontSize: '10px', color: '#0d1117', fontStyle: 'bold' }).setOrigin(0.5).setDepth(22);
      this.add.text(72, y + 16, 'NEW RECRUIT', { fontFamily: 'monospace', fontSize: '13px', color: '#3a8fc4', fontStyle: 'bold' }).setDepth(22);
      this.add.text(72, y + 34, 'A second worker awaits at the factory.', { fontFamily: 'monospace', fontSize: '11px', color: '#8899aa' }).setDepth(22);
    }
    if (victory && this.levelId === 2) {
      y += 8;
      this.add.rectangle(width / 2, y + 28, width - 48, 56, 0x1a1200).setDepth(21);
      this.add.rectangle(width / 2, y + 28, width - 48, 56).setStrokeStyle(1, 0xe8a020).setDepth(21);
      this.add.text(28, y + 16, 'FACTORY UNLOCK', { fontFamily: 'monospace', fontSize: '13px', color: '#e8a020', fontStyle: 'bold' }).setDepth(22);
      this.add.text(28, y + 34, 'Bomber and Barricade assembly now available.', { fontFamily: 'monospace', fontSize: '11px', color: '#8899aa' }).setDepth(22);
    }
    if (victory && this.levelId === 8) {
      y += 8;
      this.add.rectangle(width / 2, y + 28, width - 48, 56, 0x1a0a0a).setDepth(21);
      this.add.rectangle(width / 2, y + 28, width - 48, 56).setStrokeStyle(1, 0xc43a3a).setDepth(21);
      this.add.text(28, y + 16, 'NEW THREAT INCOMING', { fontFamily: 'monospace', fontSize: '13px', color: '#c43a3a', fontStyle: 'bold' }).setDepth(22);
      this.add.text(28, y + 34, 'The Limbic Cartel has taken notice.', { fontFamily: 'monospace', fontSize: '11px', color: '#8899aa' }).setDepth(22);
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
    const key = 'storyline' + this.storylineId;
    if (!save.completedLevels[key]) save.completedLevels[key] = [];
    if (!save.completedLevels[key].includes(this.levelId)) save.completedLevels[key].push(this.levelId);

    save.parts = (save.parts || 0) + this.parts;
    save.level = Math.max(save.level || 1, this.levelId + 1);

    if (save.stockpile) {
      Object.keys(this.towersUsed).forEach(type => {
        save.stockpile[type] = Math.max(0, (save.stockpile[type] || 0) - (this.towersUsed[type] || 0));
      });
    }

    if (this.levelId === 1 && !save.workers) save.workers = 2;
    if (this.levelId === 8) save.factionOneComplete = true;

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
