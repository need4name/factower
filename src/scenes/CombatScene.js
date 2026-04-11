class CombatScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CombatScene' });
  }

  init(data) {
    this.storylineId = data.storylineId || 1;
    this.levelId = data.levelId || 1;
    this.levelData = data.levelData;
  }

  create() {
    const { width, height } = this.scale;

    const slotIndex = localStorage.getItem('factower_active_slot');
    const saveKey = `factower_save_${slotIndex}`;
    this.saveData = JSON.parse(localStorage.getItem(saveKey));

    this.parts = 0;
    this.baseHp = this.levelData?.baseHp || 10;
    this.currentWave = 0;
    this.enemiesAlive = 0;
    this.enemiesSpawned = 0;
    this.waveActive = false;
    this.gameOver = false;
    this.placedTowers = [];
    this.activeEnemies = [];
    this.selectedTowerType = null;
    this.bullets = [];

    const stockpile = this.saveData?.stockpile || {};
    this.loadout = {
      gunner:    stockpile.gunner    || 0,
      bomber:    stockpile.bomber    || 0,
      barricade: stockpile.barricade || 0
    };

    const CT = 148;
    const CB = 730;

    this.pathPoints = [
      { x: 195, y: CT },
      { x: 195, y: CT + 80 },
      { x: 60,  y: CT + 80 },
      { x: 60,  y: CT + 260 },
      { x: 330, y: CT + 260 },
      { x: 330, y: CT + 420 },
      { x: 60,  y: CT + 420 },
      { x: 60,  y: CT + 510 },
      { x: 195, y: CT + 510 },
      { x: 195, y: CB }
    ];

    const allSlots = [
      { x: 320, y: CT + 30  },
      { x: 60,  y: CT + 30  },
      { x: 320, y: CT + 170 },
      { x: 195, y: CT + 170 },
      { x: 320, y: CT + 340 },
      { x: 195, y: CT + 340 },
      { x: 60,  y: CT + 470 },
      { x: 320, y: CT + 470 }
    ];

    const numSlots = this.levelData?.towerSlots || 6;
    this.towerSlotPositions = allSlots.slice(0, numSlots);

    this.add.rectangle(width / 2, height / 2, width, height, 0x0d1117);
    this.drawPath();
    this.drawHeader();
    this.drawTowerSlots();
    this.drawBottomPanel();

    const total = Object.values(this.loadout).reduce((s, v) => s + v, 0);
    if (total === 0) {
      const warn = this.add.rectangle(width / 2, height / 2, width - 48, 160, 0x1a0a0a).setDepth(5);
      this.add.rectangle(width / 2, height / 2, width - 48, 160).setStrokeStyle(1, 0xc43a3a).setDepth(5);
      this.add.text(width / 2, height / 2 - 24, 'NO TOWERS IN STOCK', {
        fontFamily: 'monospace', fontSize: '18px', color: '#c43a3a', fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(6);
      this.add.text(width / 2, height / 2 + 12, 'Build towers in the Factory first', {
        fontFamily: 'monospace', fontSize: '13px', color: '#8899aa'
      }).setOrigin(0.5).setDepth(6);
    }
  }

  drawPath() {
    const graphics = this.add.graphics();

    graphics.lineStyle(42, 0x161b22, 1);
    graphics.beginPath();
    graphics.moveTo(this.pathPoints[0].x, this.pathPoints[0].y);
    this.pathPoints.forEach(p => graphics.lineTo(p.x, p.y));
    graphics.strokePath();

    graphics.lineStyle(38, 0x1a2030, 1);
    graphics.beginPath();
    graphics.moveTo(this.pathPoints[0].x, this.pathPoints[0].y);
    this.pathPoints.forEach(p => graphics.lineTo(p.x, p.y));
    graphics.strokePath();

    this.add.text(195, this.pathPoints[0].y - 14, '▼ ENTRY', {
      fontFamily: 'monospace', fontSize: '10px', color: '#c43a3a', letterSpacing: 2
    }).setOrigin(0.5);
    this.add.text(195, this.pathPoints[this.pathPoints.length - 1].y + 14, '▲ BASE', {
      fontFamily: 'monospace', fontSize: '10px', color: '#3a8fc4', letterSpacing: 2
    }).setOrigin(0.5);
  }

  drawHeader() {
    const { width } = this.scale;

    this.add.rectangle(width / 2, 88, width, 96, 0x161b22);
    this.add.rectangle(width / 2, 136, width, 1, 0x334455);

    const backBtn = this.add.rectangle(44, 88, 64, 52, 0x1e2530).setInteractive();
    this.add.text(44, 88, '← BACK', {
      fontFamily: 'monospace', fontSize: '12px', color: '#8899aa'
    }).setOrigin(0.5);
    backBtn.on('pointerdown', () => {
      if (!this.waveActive) {
        this.cameras.main.fade(200, 0, 0, 0);
        this.time.delayedCall(200, () => this.scene.start('DockScene'));
      } else {
        this.showCombatMessage('Cannot leave during a wave', '#c43a3a');
      }
    });

    this.add.text(width / 2, 68, this.levelData?.name || 'LEVEL', {
      fontFamily: 'monospace', fontSize: '11px', color: '#8899aa', letterSpacing: 3
    }).setOrigin(0.5);

    this.waveText = this.add.text(width / 2, 96, 'PLACE TOWERS · THEN START WAVE', {
      fontFamily: 'monospace', fontSize: '13px', color: '#eef2f8', fontStyle: 'bold'
    }).setOrigin(0.5);

    // Parts counter
    this.add.text(84, 68, 'PARTS', {
      fontFamily: 'monospace', fontSize: '10px', color: '#8899aa', letterSpacing: 2
    }).setOrigin(0.5);
    this.partsText = this.add.text(84, 96, '0', {
      fontFamily: 'monospace', fontSize: '22px', color: '#e8a020', fontStyle: 'bold'
    }).setOrigin(0.5);

    // Base HP
    this.add.text(width - 84, 68, 'BASE HP', {
      fontFamily: 'monospace', fontSize: '10px', color: '#8899aa', letterSpacing: 2
    }).setOrigin(0.5);
    this.hpText = this.add.text(width - 84, 96, `${this.baseHp}`, {
      fontFamily: 'monospace', fontSize: '22px', color: '#5eba7d', fontStyle: 'bold'
    }).setOrigin(0.5);
  }

  drawTowerSlots() {
    this.slotRefs = [];

    this.towerSlotPositions.forEach((pos, i) => {
      const slot = this.add.rectangle(pos.x, pos.y, 50, 50, 0x0d1117).setInteractive();
      this.add.rectangle(pos.x, pos.y, 50, 50).setStrokeStyle(1, 0x334455);
      this.add.text(pos.x, pos.y, `${i + 1}`, {
        fontFamily: 'monospace', fontSize: '13px', color: '#334455', fontStyle: 'bold'
      }).setOrigin(0.5);

      slot.slotIndex = i;
      slot.slotPos = pos;
      slot.occupied = false;

      slot.on('pointerdown', () => this.towerSlotPressed(slot));
      slot.on('pointerover', () => {
        if (!slot.occupied && this.selectedTowerType) slot.setFillStyle(0x1e2530);
      });
      slot.on('pointerout', () => {
        if (!slot.occupied) slot.setFillStyle(0x0d1117);
      });

      this.slotRefs.push(slot);
    });
  }

  drawBottomPanel() {
    const { width, height } = this.scale;
    const panelY = height - 144;

    this.add.rectangle(width / 2, height - 72, width, 144, 0x161b22);
    this.add.rectangle(width / 2, panelY, width, 1, 0x334455);

    const towerTypes = ['gunner', 'bomber', 'barricade'];
    this.towerButtons = {};

    towerTypes.forEach((type, i) => {
      const data = TOWER_DATA[type];
      const x = 52 + i * 96;
      const y = panelY + 56;
      const colourHex = '#' + data.colour.toString(16).padStart(6, '0');
      const count = this.loadout[type];
      const active = count > 0;

      const btn = this.add.rectangle(x, y, 86, 82, active ? 0x1e2530 : 0x161b22).setInteractive();
      btn.towerType = type;
      this.add.rectangle(x, y, 86, 82).setStrokeStyle(1, active ? data.colour : 0x334455);
      this.add.circle(x, y - 24, 9, active ? data.colour : 0x334455);

      this.add.text(x, y + 2, data.name, {
        fontFamily: 'monospace', fontSize: '12px',
        color: active ? '#eef2f8' : '#556677', fontStyle: 'bold'
      }).setOrigin(0.5);

      const countText = this.add.text(x, y + 22, `×${count}`, {
        fontFamily: 'monospace', fontSize: '14px',
        color: active ? colourHex : '#445566'
      }).setOrigin(0.5);

      btn.countText = countText;
      this.towerButtons[type] = btn;

      if (active) {
        btn.on('pointerdown', () => this.selectTower(type));
        btn.on('pointerover', () => {
          if (this.selectedTowerType !== type) btn.setFillStyle(0x252c38);
        });
        btn.on('pointerout', () => {
          if (this.selectedTowerType !== type) btn.setFillStyle(0x1e2530);
        });
      }
    });

    this.startWaveBtn = this.add.rectangle(width - 68, panelY + 56, 98, 82, 0x0d1a0d).setInteractive();
    this.add.rectangle(width - 68, panelY + 56, 98, 82).setStrokeStyle(1, 0x5eba7d);
    this.startWaveBtnLabel = this.add.text(width - 68, panelY + 44, 'START', {
      fontFamily: 'monospace', fontSize: '16px', color: '#5eba7d', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.startWaveBtnSub = this.add.text(width - 68, panelY + 66, 'WAVE 1', {
      fontFamily: 'monospace', fontSize: '11px', color: '#5eba7d'
    }).setOrigin(0.5);

    this.startWaveBtn.on('pointerdown', () => this.startNextWave());
    this.startWaveBtn.on('pointerover', () => this.startWaveBtn.setFillStyle(0x162616));
    this.startWaveBtn.on('pointerout', () => this.startWaveBtn.setFillStyle(0x0d1a0d));
  }

  selectTower(type) {
    if (this.loadout[type] <= 0) return;
    this.selectedTowerType = type;
    Object.keys(this.towerButtons).forEach(t => {
      this.towerButtons[t].setFillStyle(t === type ? 0x2a3a4a : 0x1e2530);
    });
  }

  towerSlotPressed(slot) {
    if (!this.selectedTowerType) return;
    if (slot.occupied) return;
    if (this.loadout[this.selectedTowerType] <= 0) return;

    const data = TOWER_DATA[this.selectedTowerType];
    const pos = slot.slotPos;
    const colourHex = '#' + data.colour.toString(16).padStart(6, '0');

    // Place tower visual
    slot.setFillStyle(data.colour, 0.2);
    this.add.rectangle(pos.x, pos.y, 50, 50).setStrokeStyle(2, data.colour);
    this.add.circle(pos.x, pos.y - 8, 10, data.colour);
    this.add.text(pos.x, pos.y + 12, data.name.substring(0, 3), {
      fontFamily: 'monospace', fontSize: '11px', color: '#eef2f8', fontStyle: 'bold'
    }).setOrigin(0.5);

    // Permanent range ring
    this.add.circle(pos.x, pos.y, data.range, data.colour, 0.04);
    this.add.circle(pos.x, pos.y, data.range)
      .setStrokeStyle(1, data.colour, 0.2);

    slot.occupied = true;
    this.loadout[this.selectedTowerType]--;
    this.towerButtons[this.selectedTowerType].countText.setText(`×${this.loadout[this.selectedTowerType]}`);

    if (this.loadout[this.selectedTowerType] <= 0) {
      this.selectedTowerType = null;
      Object.keys(this.towerButtons).forEach(t => {
        this.towerButtons[t].setFillStyle(0x1e2530);
      });
    }

    const tower = {
      type: this.selectedTowerType || data.key,
      x: pos.x,
      y: pos.y,
      data: { ...data },
      lastFired: 0
    };
    this.placedTowers.push(tower);
  }

  startNextWave() {
    if (this.waveActive || this.gameOver) return;
    if (this.currentWave >= this.levelData.waves.length) return;

    const waveData = this.levelData.waves[this.currentWave];
    this.waveActive = true;
    this.enemiesSpawned = 0;

    this.waveText.setText(`WAVE ${this.currentWave + 1} OF ${this.levelData.waves.length}`);
    this.startWaveBtn.setAlpha(0.4).disableInteractive();
    this.selectedTowerType = null;
    Object.keys(this.towerButtons).forEach(t => {
      this.towerButtons[t].setFillStyle(0x1e2530);
    });

    this.time.delayedCall(waveData.preWaveDelay || 2000, () => {
      this.spawnWave(waveData);
    });
  }

  spawnWave(waveData) {
    let totalDelay = 0;
    let totalCount = 0;

    waveData.enemies.forEach(group => {
      for (let i = 0; i < group.count; i++) {
        this.time.delayedCall(totalDelay, () => {
          if (!this.gameOver) this.spawnEnemy(group.type);
        });
        totalDelay += group.interval;
        totalCount++;
      }
    });

    this.enemiesAlive = totalCount;
  }

  spawnEnemy(type) {
    const data = ENEMY_DATA[type];
    const start = this.pathPoints[0];
    const sprite = this.add.circle(start.x, start.y, data.size, data.colour);

    // Health bar background
    const hpBarBg = this.add.rectangle(start.x, start.y - data.size - 6, 32, 4, 0x334455);
    const hpBar = this.add.rectangle(
      start.x - 16, start.y - data.size - 6, 32, 4, data.colour
    ).setOrigin(0, 0.5);

    const enemy = {
      type, data,
      sprite,
      hpBarBg,
      hpBar,
      hp: data.hp,
      maxHp: data.hp,
      alive: true,
      pathProgress: 0,
      worldX: start.x,
      worldY: start.y
    };

    this.activeEnemies.push(enemy);
    this.moveToWaypoint(enemy, 1);
  }

  moveToWaypoint(enemy, idx) {
    if (!enemy.alive || this.gameOver) return;
    if (idx >= this.pathPoints.length) {
      this.enemyReachedEnd(enemy);
      return;
    }

    const target = this.pathPoints[idx];
    const dist = Phaser.Math.Distance.Between(
      enemy.sprite.x, enemy.sprite.y, target.x, target.y
    );
    enemy.pathProgress = idx;

    this.tweens.add({
      targets: enemy.sprite,
      x: target.x,
      y: target.y,
      duration: (dist / enemy.data.speed) * 1000,
      ease: 'Linear',
      onUpdate: () => {
        if (enemy.alive && enemy.sprite) {
          enemy.worldX = enemy.sprite.x;
          enemy.worldY = enemy.sprite.y;
          // Move health bar with enemy
          if (enemy.hpBarBg) enemy.hpBarBg.setPosition(enemy.sprite.x, enemy.sprite.y - enemy.data.size - 6);
          if (enemy.hpBar) enemy.hpBar.setPosition(enemy.sprite.x - 16, enemy.sprite.y - enemy.data.size - 6);
        }
      },
      onComplete: () => {
        if (enemy.alive) this.moveToWaypoint(enemy, idx + 1);
      }
    });
  }

  fireAtEnemy(tower, target) {
    tower.lastFired = this.time.now;

    // Capture target position at fire time
    const tx = target.worldX;
    const ty = target.worldY;

    const bullet = this.add.circle(tower.x, tower.y, tower.data.range === 0 ? 0 : 5, tower.data.colour);

    // Fast travel — 400ms regardless of distance so bullets feel snappy
    this.tweens.add({
      targets: bullet,
      x: tx,
      y: ty,
      duration: 200,
      ease: 'Linear',
      onComplete: () => {
        bullet.destroy();
        // Deal damage at impact — check enemy still alive and close enough
        if (target.alive) {
          const dist = Phaser.Math.Distance.Between(tx, ty, target.worldX, target.worldY);
          // Allow some tracking tolerance — if enemy moved less than 60px it still counts
          if (dist < 80) {
            this.dealDamage(target, tower.data.damage);
          }
        }
      }
    });
  }

  towerShootUpdate() {
    if (!this.waveActive || this.gameOver) return;

    this.placedTowers.forEach(tower => {
      if (tower.data.range === 0) return; // barricade handled separately
      if (this.time.now - tower.lastFired < tower.data.fireRate) return;

      const inRange = this.activeEnemies.filter(e => {
        if (!e.alive || !e.sprite?.active) return false;
        return Phaser.Math.Distance.Between(tower.x, tower.y, e.worldX, e.worldY) <= tower.data.range;
      });

      if (inRange.length === 0) return;

      // Target furthest along path
      const target = inRange.reduce((best, e) =>
        e.pathProgress > best.pathProgress ? e : best, inRange[0]
      );

      this.fireAtEnemy(tower, target);
    });
  }

  dealDamage(enemy, damage) {
    if (!enemy.alive) return;
    enemy.hp -= damage;

    // Update health bar
    if (enemy.hpBar && enemy.sprite?.active) {
      const pct = Math.max(0, enemy.hp / enemy.maxHp);
      enemy.hpBar.setSize(32 * pct, 4);
      // Colour shifts red as health drops
      if (pct < 0.3) enemy.hpBar.setFillStyle(0xc43a3a);
      else if (pct < 0.6) enemy.hpBar.setFillStyle(0xe8a020);
    }

    if (enemy.sprite?.active) {
      this.tweens.add({ targets: enemy.sprite, alpha: 0.3, duration: 60, yoyo: true });
    }

    if (enemy.hp <= 0) this.killEnemy(enemy);
  }

  killEnemy(enemy) {
    if (!enemy.alive) return;
    enemy.alive = false;
    this.activeEnemies = this.activeEnemies.filter(e => e !== enemy);
    this.enemiesAlive = Math.max(0, this.enemiesAlive - 1);

    this.parts += enemy.data.partsReward;
    this.partsText.setText(`${this.parts}`);

    enemy.hpBarBg?.destroy();
    enemy.hpBar?.destroy();

    if (enemy.sprite?.active) {
      this.tweens.add({
        targets: enemy.sprite,
        alpha: 0, scaleX: 1.8, scaleY: 1.8, duration: 200,
        onComplete: () => enemy.sprite?.destroy()
      });
    }

    this.checkWaveComplete();
  }

  enemyReachedEnd(enemy) {
    if (!enemy.alive) return;
    enemy.alive = false;
    this.activeEnemies = this.activeEnemies.filter(e => e !== enemy);
    this.enemiesAlive = Math.max(0, this.enemiesAlive - 1);

    enemy.hpBarBg?.destroy();
    enemy.hpBar?.destroy();
    enemy.sprite?.destroy();

    this.baseHp -= enemy.data.baseDamage;
    if (this.baseHp < 0) this.baseHp = 0;

    this.hpText.setText(`${this.baseHp}`);
    if (this.baseHp <= 4) this.hpText.setColor('#c43a3a');
    else if (this.baseHp <= 7) this.hpText.setColor('#e8a020');

    // Flash the hp text
    this.tweens.add({
      targets: this.hpText, alpha: 0.2, duration: 100, yoyo: true, repeat: 2
    });

    if (this.baseHp <= 0) {
      this.triggerGameOver(false);
      return;
    }

    this.checkWaveComplete();
  }

  checkWaveComplete() {
    if (!this.waveActive || this.gameOver) return;
    if (this.enemiesAlive > 0) return;

    this.time.delayedCall(1200, () => {
      if (!this.waveActive) return;
      this.waveActive = false;
      this.currentWave++;

      if (this.currentWave >= this.levelData.waves.length) {
        this.time.delayedCall(400, () => this.triggerGameOver(true));
        return;
      }

      this.waveText.setText(`WAVE ${this.currentWave} CLEAR  —  PLACE MORE TOWERS`);
      this.startWaveBtn.setAlpha(1).setInteractive();
      this.startWaveBtnSub.setText(`WAVE ${this.currentWave + 1}`);
    });
  }

  showCombatMessage(text, colour) {
    const { width } = this.scale;
    if (this.combatMsg?.active) this.combatMsg.destroy();
    this.combatMsg = this.add.text(width / 2, 144, text, {
      fontFamily: 'monospace', fontSize: '12px',
      color: colour || '#e8a020',
      backgroundColor: '#161b22',
      padding: { x: 10, y: 5 }
    }).setOrigin(0.5).setDepth(20);
    this.time.delayedCall(2000, () => this.combatMsg?.destroy());
  }

  triggerGameOver(victory) {
    this.gameOver = true;
    this.waveActive = false;

    const { width, height } = this.scale;
    const isFirstVictory = victory && this.levelId === 1;

    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.92).setDepth(10);

    const titleColour = victory ? '#5eba7d' : '#c43a3a';
    const titleText = victory ? 'VICTORY' : 'BASE LOST';
    const subText = victory ? 'YOUR SOVEREIGNTY HOLDS' : 'YOUR BASE WAS OVERWHELMED';

    this.add.text(width / 2, height / 2 - 160, titleText, {
      fontFamily: 'monospace', fontSize: '44px', color: titleColour, fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(11);

    this.add.text(width / 2, height / 2 - 108, subText, {
      fontFamily: 'monospace', fontSize: '14px', color: '#8899aa', letterSpacing: 2
    }).setOrigin(0.5).setDepth(11);

    this.add.text(width / 2, height / 2 - 72, `PARTS EARNED: ${this.parts}`, {
      fontFamily: 'monospace', fontSize: '20px', color: '#e8a020'
    }).setOrigin(0.5).setDepth(11);

    // Parts don't carry over — make this clear
    this.add.text(width / 2, height / 2 - 44, '(parts do not carry over)', {
      fontFamily: 'monospace', fontSize: '11px', color: '#445566'
    }).setOrigin(0.5).setDepth(11);

    if (victory) {
      this.saveProgress();

      if (isFirstVictory) {
        this.add.rectangle(width / 2, height / 2 + 28, width - 48, 130, 0x0d1a22).setDepth(11);
        this.add.rectangle(width / 2, height / 2 + 28, width - 48, 130).setStrokeStyle(1, 0x3a8fc4).setDepth(11);
        this.add.circle(width / 2 - 104, height / 2 + 28, 18, 0x3a8fc4).setDepth(12);
        this.add.text(width / 2 - 104, height / 2 + 28, 'W2', {
          fontFamily: 'monospace', fontSize: '11px', color: '#0d1117', fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(13);
        this.add.text(width / 2 + 10, height / 2 + 14, 'NEW RECRUIT', {
          fontFamily: 'monospace', fontSize: '16px', color: '#3a8fc4', fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(12);
        this.add.text(width / 2 + 10, height / 2 + 40, 'A second worker awaits\nyou at the factory.', {
          fontFamily: 'monospace', fontSize: '11px', color: '#8899aa',
          align: 'center', lineSpacing: 4
        }).setOrigin(0.5).setDepth(12);
      } else {
        this.add.text(width / 2, height / 2 - 10, 'NEXT LEVEL UNLOCKED', {
          fontFamily: 'monospace', fontSize: '13px', color: '#5eba7d', letterSpacing: 2
        }).setOrigin(0.5).setDepth(11);
      }
    } else {
      // Lose — show encouragement and towers remaining info
      this.add.text(width / 2, height / 2 - 6, 'Build more towers and try again', {
        fontFamily: 'monospace', fontSize: '13px', color: '#8899aa'
      }).setOrigin(0.5).setDepth(11);
    }

    const btnY = isFirstVictory ? height / 2 + 130 : height / 2 + 60;
    const btnLabel = victory ? 'RETURN TO BASE' : 'TRY AGAIN';
    const btnColour = victory ? 0xe8a020 : 0xc43a3a;
    const btnColourHex = victory ? '#e8a020' : '#c43a3a';

    const btn = this.add.rectangle(width / 2, btnY, 260, 68, 0x161b22).setInteractive().setDepth(11);
    this.add.rectangle(width / 2, btnY, 260, 68).setStrokeStyle(1, btnColour).setDepth(11);
    this.add.text(width / 2, btnY, btnLabel, {
      fontFamily: 'monospace', fontSize: '18px', color: btnColourHex, fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(12);

    btn.on('pointerdown', () => {
      this.cameras.main.fade(300, 0, 0, 0);
      this.time.delayedCall(300, () => {
        if (victory) {
          this.scene.start('BaseScene');
        } else {
          // Reload the level without consuming more towers
          this.scene.start('CombatScene', {
            storylineId: this.storylineId,
            levelId: this.levelId,
            levelData: this.levelData
          });
        }
      });
    });
    btn.on('pointerover', () => btn.setFillStyle(0x252c38));
    btn.on('pointerout', () => btn.setFillStyle(0x161b22));

    // Also add "return to base" as secondary option on lose
    if (!victory) {
      const baseBtn = this.add.rectangle(width / 2, btnY + 80, 200, 52, 0x0d1117).setInteractive().setDepth(11);
      this.add.rectangle(width / 2, btnY + 80, 200, 52).setStrokeStyle(1, 0x334455).setDepth(11);
      this.add.text(width / 2, btnY + 80, 'RETURN TO BASE', {
        fontFamily: 'monospace', fontSize: '14px', color: '#556677'
      }).setOrigin(0.5).setDepth(12);
      baseBtn.on('pointerdown', () => {
        this.cameras.main.fade(300, 0, 0, 0);
        this.time.delayedCall(300, () => this.scene.start('BaseScene'));
      });
    }
  }

  saveProgress() {
    const slotIndex = localStorage.getItem('factower_active_slot');
    const saveKey = `factower_save_${slotIndex}`;
    const save = JSON.parse(localStorage.getItem(saveKey));

    if (!save.completedLevels) save.completedLevels = {};
    const key = `storyline${this.storylineId}`;
    if (!save.completedLevels[key]) save.completedLevels[key] = [];
    if (!save.completedLevels[key].includes(this.levelId)) {
      save.completedLevels[key].push(this.levelId);
    }

    // Parts do NOT carry over to save
    save.level = Math.max(save.level || 1, this.levelId + 1);

    // Consume towers that were placed
    if (save.stockpile) {
      Object.keys(this.loadout).forEach(type => {
        const used = (this.saveData?.stockpile?.[type] || 0) - this.loadout[type];
        if (used > 0) {
          save.stockpile[type] = Math.max(0, (save.stockpile[type] || 0) - used);
        }
      });
    }

    // Level 1 win unlocks 2nd worker
    if (this.levelId === 1 && !save.workers) {
      save.workers = 2;
    }

    // Level 2 win unlocks Bomber and Barricade
    if (this.levelId === 2) {
      save.unlockedTowers = save.unlockedTowers || [];
      if (!save.unlockedTowers.includes('bomber')) save.unlockedTowers.push('bomber');
      if (!save.unlockedTowers.includes('barricade')) save.unlockedTowers.push('barricade');
    }

    localStorage.setItem(saveKey, JSON.stringify(save));
  }

  update(time, delta) {
    this.towerShootUpdate();
  }
}
