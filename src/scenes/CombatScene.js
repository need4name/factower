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
    this.waveActive = false;
    this.gameOver = false;
    this.placedTowers = [];
    this.activeEnemies = [];
    this.selectedTowerType = null;

    // Use real stockpile — no free towers
    const stockpile = this.saveData?.stockpile || {};
    this.loadout = {
      gunner:    stockpile.gunner    || 0,
      bomber:    stockpile.bomber    || 0,
      barricade: stockpile.barricade || 0
    };

    const CT = 110;
    const CB = 700;

    this.pathPoints = [
      { x: 195, y: CT },
      { x: 195, y: CT + 80 },
      { x: 60,  y: CT + 80 },
      { x: 60,  y: CT + 260 },
      { x: 330, y: CT + 260 },
      { x: 330, y: CT + 440 },
      { x: 60,  y: CT + 440 },
      { x: 60,  y: CT + 530 },
      { x: 195, y: CT + 530 },
      { x: 195, y: CB }
    ];

    const allSlots = [
      { x: 330, y: CT + 40 },
      { x: 60,  y: CT + 40 },
      { x: 330, y: CT + 170 },
      { x: 195, y: CT + 170 },
      { x: 150, y: CT + 170 },
      { x: 195, y: CT + 350 },
      { x: 150, y: CT + 350 },
      { x: 265, y: CT + 350 }
    ];

    const numSlots = this.levelData?.towerSlots || 6;
    this.towerSlotPositions = allSlots.slice(0, numSlots);

    this.add.rectangle(width / 2, height / 2, width, height, 0x0d1117);
    this.drawPath();
    this.drawHeader();
    this.drawTowerSlots();
    this.drawBottomPanel();

    // If no towers warn the player
    const total = Object.values(this.loadout).reduce((s, v) => s + v, 0);
    if (total === 0) {
      this.add.rectangle(width / 2, height / 2, width - 48, 160, 0x1a0a0a);
      this.add.rectangle(width / 2, height / 2, width - 48, 160)
        .setStrokeStyle(1, 0xc43a3a);
      this.add.text(width / 2, height / 2 - 24, 'NO TOWERS IN STOCK', {
        fontFamily: 'monospace', fontSize: '18px', color: '#c43a3a', fontStyle: 'bold'
      }).setOrigin(0.5);
      this.add.text(width / 2, height / 2 + 12, 'Build towers in the Factory first', {
        fontFamily: 'monospace', fontSize: '13px', color: '#8899aa'
      }).setOrigin(0.5);
    }
  }

  drawPath() {
    const graphics = this.add.graphics();
    graphics.lineStyle(40, 0x161b22, 1);
    graphics.beginPath();
    graphics.moveTo(this.pathPoints[0].x, this.pathPoints[0].y);
    this.pathPoints.forEach(p => graphics.lineTo(p.x, p.y));
    graphics.strokePath();

    graphics.lineStyle(40, 0x1e2530, 0.5);
    graphics.beginPath();
    graphics.moveTo(this.pathPoints[0].x, this.pathPoints[0].y);
    this.pathPoints.forEach(p => graphics.lineTo(p.x, p.y));
    graphics.strokePath();

    this.add.text(195, 114, '▼ ENTRY', {
      fontFamily: 'monospace', fontSize: '10px', color: '#c43a3a', letterSpacing: 2
    }).setOrigin(0.5);

    this.add.text(195, 696, '▲ BASE', {
      fontFamily: 'monospace', fontSize: '10px', color: '#3a8fc4', letterSpacing: 2
    }).setOrigin(0.5);
  }

  drawHeader() {
    const { width } = this.scale;

    this.add.rectangle(width / 2, 52, width, 80, 0x161b22);
    this.add.rectangle(width / 2, 92, width, 1, 0x334455);

    const backBtn = this.add.rectangle(40, 52, 60, 44, 0x1e2530).setInteractive();
    this.add.text(40, 52, '← BACK', {
      fontFamily: 'monospace', fontSize: '12px', color: '#8899aa'
    }).setOrigin(0.5);
    backBtn.on('pointerdown', () => {
      if (!this.waveActive) {
        this.cameras.main.fade(200, 0, 0, 0);
        this.time.delayedCall(200, () => this.scene.start('DockScene'));
      }
    });

    this.add.text(width / 2, 34, this.levelData?.name || 'LEVEL', {
      fontFamily: 'monospace', fontSize: '11px', color: '#8899aa', letterSpacing: 3
    }).setOrigin(0.5);

    this.waveText = this.add.text(width / 2, 60, 'PLACE TOWERS · THEN START WAVE', {
      fontFamily: 'monospace', fontSize: '13px', color: '#eef2f8', fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(80, 32, 'PARTS', {
      fontFamily: 'monospace', fontSize: '10px', color: '#8899aa', letterSpacing: 2
    }).setOrigin(0.5);
    this.partsText = this.add.text(80, 58, '0', {
      fontFamily: 'monospace', fontSize: '22px', color: '#e8a020', fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(width - 80, 32, 'BASE HP', {
      fontFamily: 'monospace', fontSize: '10px', color: '#8899aa', letterSpacing: 2
    }).setOrigin(0.5);
    this.hpText = this.add.text(width - 80, 58, `${this.baseHp}`, {
      fontFamily: 'monospace', fontSize: '22px', color: '#5eba7d', fontStyle: 'bold'
    }).setOrigin(0.5);
  }

  drawTowerSlots() {
    this.slotRefs = [];

    this.towerSlotPositions.forEach((pos, i) => {
      const slot = this.add.rectangle(pos.x, pos.y, 48, 48, 0x0d1117).setInteractive();
      this.add.rectangle(pos.x, pos.y, 48, 48).setStrokeStyle(1, 0x334455);
      this.add.text(pos.x, pos.y, `${i + 1}`, {
        fontFamily: 'monospace', fontSize: '13px', color: '#445566', fontStyle: 'bold'
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

      const btn = this.add.rectangle(x, y, 86, 82, active ? 0x1e2530 : 0x161b22)
        .setInteractive();
      btn.towerType = type;
      this.add.rectangle(x, y, 86, 82)
        .setStrokeStyle(1, active ? data.colour : 0x334455);

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

    this.startWaveBtn = this.add.rectangle(width - 68, panelY + 56, 98, 82, 0x0d1a0d)
      .setInteractive();
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

    slot.setFillStyle(data.colour, 0.15);
    this.add.rectangle(pos.x, pos.y, 48, 48).setStrokeStyle(2, data.colour);
    this.add.circle(pos.x, pos.y - 6, 9, data.colour);
    this.add.text(pos.x, pos.y + 12, data.name.substring(0, 3), {
      fontFamily: 'monospace', fontSize: '11px', color: '#eef2f8', fontStyle: 'bold'
    }).setOrigin(0.5);

    const ring = this.add.circle(pos.x, pos.y, data.range, data.colour, 0.06);
    this.add.circle(pos.x, pos.y, data.range).setStrokeStyle(1, data.colour, 0.25);
    this.time.delayedCall(1200, () => ring.destroy());

    slot.occupied = true;
    this.loadout[this.selectedTowerType]--;
    this.towerButtons[this.selectedTowerType].countText.setText(`×${this.loadout[this.selectedTowerType]}`);

    const tower = {
      type: this.selectedTowerType,
      x: pos.x,
      y: pos.y,
      data: { ...data },
      lastFired: 0
    };
    this.placedTowers.push(tower);

    this.time.addEvent({
      delay: 120,
      callback: () => this.towerShoot(tower),
      loop: true
    });
  }

  towerShoot(tower) {
    if (!this.waveActive || this.gameOver) return;
    if (this.time.now - tower.lastFired < tower.data.fireRate) return;
    if (tower.data.range === 0) return;

    const inRange = this.activeEnemies.filter(e => {
      if (!e.alive || !e.sprite?.active) return false;
      return Phaser.Math.Distance.Between(tower.x, tower.y, e.sprite.x, e.sprite.y) <= tower.data.range;
    });

    if (inRange.length === 0) return;

    const target = inRange.reduce((best, e) =>
      e.pathProgress > best.pathProgress ? e : best, inRange[0]
    );

    tower.lastFired = this.time.now;

    const bullet = this.add.circle(tower.x, tower.y, 5, tower.data.colour);
    this.tweens.add({
      targets: bullet,
      x: target.sprite.x,
      y: target.sprite.y,
      duration: 160,
      onComplete: () => {
        bullet.destroy();
        if (target.alive) this.dealDamage(target, tower.data.damage);
      }
    });
  }

  dealDamage(enemy, damage) {
    if (!enemy.alive) return;
    enemy.hp -= damage;
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

    if (enemy.sprite?.active) {
      this.tweens.add({
        targets: enemy.sprite,
        alpha: 0, scaleX: 1.8, scaleY: 1.8, duration: 200,
        onComplete: () => { if (enemy.sprite) enemy.sprite.destroy(); }
      });
    }
    this.checkWaveComplete();
  }

  startNextWave() {
    if (this.waveActive || this.gameOver) return;
    if (this.currentWave >= this.levelData.waves.length) return;

    const waveData = this.levelData.waves[this.currentWave];
    this.waveActive = true;
    this.waveText.setText(`WAVE ${this.currentWave + 1} OF ${this.levelData.waves.length}`);
    this.startWaveBtn.setAlpha(0.4).disableInteractive();
    this.selectedTowerType = null;

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

    const enemy = { type, data, sprite, hp: data.hp, alive: true, pathProgress: 0 };
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
    const dist = Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, target.x, target.y);
    enemy.pathProgress = idx;

    this.tweens.add({
      targets: enemy.sprite,
      x: target.x, y: target.y,
      duration: (dist / enemy.data.speed) * 1000,
      ease: 'Linear',
      onComplete: () => { if (enemy.alive) this.moveToWaypoint(enemy, idx + 1); }
    });
  }

  enemyReachedEnd(enemy) {
    if (!enemy.alive) return;
    enemy.alive = false;
    this.activeEnemies = this.activeEnemies.filter(e => e !== enemy);
    this.enemiesAlive = Math.max(0, this.enemiesAlive - 1);
    if (enemy.sprite) enemy.sprite.destroy();

    this.baseHp -= enemy.data.baseDamage;
    if (this.baseHp < 0) this.baseHp = 0;
    this.hpText.setText(`${this.baseHp}`);
    if (this.baseHp <= 3) this.hpText.setColor('#c43a3a');

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

      this.waveText.setText(`WAVE ${this.currentWave} COMPLETE  —  UPGRADE YOUR TOWERS`);
      this.startWaveBtn.setAlpha(1).setInteractive();
      this.startWaveBtnSub.setText(`WAVE ${this.currentWave + 1}`);
    });
  }

  triggerGameOver(victory) {
    this.gameOver = true;
    this.waveActive = false;

    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8);

    const titleColour = victory ? '#5eba7d' : '#c43a3a';
    const titleText = victory ? 'VICTORY' : 'BASE LOST';
    const subText = victory ? 'YOUR SOVEREIGNTY HOLDS' : 'YOUR BASE WAS OVERWHELMED';

    this.add.text(width / 2, height / 2 - 110, titleText, {
      fontFamily: 'monospace', fontSize: '44px', color: titleColour, fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2 - 58, subText, {
      fontFamily: 'monospace', fontSize: '14px', color: '#8899aa', letterSpacing: 2
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2 - 18, `PARTS EARNED: ${this.parts}`, {
      fontFamily: 'monospace', fontSize: '20px', color: '#e8a020'
    }).setOrigin(0.5);

    if (victory) {
      this.saveProgress();
      this.add.text(width / 2, height / 2 + 18, 'NEXT LEVEL UNLOCKED', {
        fontFamily: 'monospace', fontSize: '13px', color: '#5eba7d', letterSpacing: 2
      }).setOrigin(0.5);
    }

    const btn = this.add.rectangle(width / 2, height / 2 + 110, 260, 68, 0x161b22)
      .setInteractive();
    this.add.rectangle(width / 2, height / 2 + 110, 260, 68).setStrokeStyle(1, 0xe8a020);
    this.add.text(width / 2, height / 2 + 110, 'RETURN TO BASE', {
      fontFamily: 'monospace', fontSize: '18px', color: '#e8a020', fontStyle: 'bold'
    }).setOrigin(0.5);

    btn.on('pointerdown', () => {
      this.cameras.main.fade(300, 0, 0, 0);
      this.time.delayedCall(300, () => this.scene.start('BaseScene'));
    });
    btn.on('pointerover', () => btn.setFillStyle(0x252c38));
    btn.on('pointerout', () => btn.setFillStyle(0x161b22));
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

    save.parts = (save.parts || 0) + this.parts;
    save.level = Math.max(save.level || 1, this.levelId + 1);

    // Reward: winning Level 1 unlocks a 2nd worker
    if (this.levelId === 1 && !save.workers) {
      save.workers = 2;
    }

    localStorage.setItem(saveKey, JSON.stringify(save));
  }


    if (!save.completedLevels) save.completedLevels = {};
    const key = `storyline${this.storylineId}`;
    if (!save.completedLevels[key]) save.completedLevels[key] = [];
    if (!save.completedLevels[key].includes(this.levelId)) {
      save.completedLevels[key].push(this.levelId);
    }

    save.parts = (save.parts || 0) + this.parts;
    save.level = Math.max(save.level || 1, this.levelId + 1);

    localStorage.setItem(saveKey, JSON.stringify(save));
  }
}
