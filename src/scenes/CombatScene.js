class CombatScene extends Phaser.Scene {
constructor() {
super({ key: ‘CombatScene’ });
}

init(data) {
this.storylineId = data.storylineId || 1;
this.levelId     = data.levelId     || 1;
this.levelData   = data.levelData;
}

create() {
const { width, height } = this.scale;

```
const slotIndex = localStorage.getItem('factower_active_slot');
const saveKey   = `factower_save_${slotIndex}`;
this.saveData   = JSON.parse(localStorage.getItem(saveKey));

this.parts           = 0;
this.baseHp          = this.levelData?.baseHp || 10;
this.baseHpMax       = this.baseHp;
this.currentWave     = 0;
this.waveActive      = false;
this.gameOver        = false;
this.placedTowers    = [];
this.activeEnemies   = [];
this.selectedTowerType = null;
this.killStats       = {};
this.towersUsed      = {};
this.towerTimerEvents  = [];   // FIX: store refs so loops can be stopped
this.tutorialElements  = null;
this.waveEnemyTotal    = 0;    // FIX: pre-counted so no race condition
this.waveEnemyResolved = 0;

const stockpile = this.saveData?.stockpile || {};
this.loadout = {
  gunner:    stockpile.gunner    || 0,
  bomber:    stockpile.bomber    || 0,
  barricade: stockpile.barricade || 0
};
this.startingLoadout = { ...this.loadout };

const CT = 110;
const CB = 700;

this.pathPoints = [
  { x: 195, y: CT        },
  { x: 195, y: CT +  80  },
  { x: 60,  y: CT +  80  },
  { x: 60,  y: CT + 260  },
  { x: 330, y: CT + 260  },
  { x: 330, y: CT + 440  },
  { x: 60,  y: CT + 440  },
  { x: 60,  y: CT + 530  },
  { x: 195, y: CT + 530  },
  { x: 195, y: CB        }
];

const allSlots = [
  { x: 330, y: CT +  40 },
  { x: 60,  y: CT +  40 },
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

const total = Object.values(this.loadout).reduce((s, v) => s + v, 0);
if (total === 0) {
  this.add.rectangle(width / 2, height / 2, width - 48, 160, 0x1a0a0a).setDepth(20);
  this.add.rectangle(width / 2, height / 2, width - 48, 160).setStrokeStyle(1, 0xc43a3a).setDepth(20);
  this.add.text(width / 2, height / 2 - 24, 'NO TOWERS IN STOCK', {
    fontFamily: 'monospace', fontSize: '18px', color: '#c43a3a', fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(21);
  this.add.text(width / 2, height / 2 + 12, 'Build towers in the Factory first', {
    fontFamily: 'monospace', fontSize: '13px', color: '#8899aa'
  }).setOrigin(0.5).setDepth(21);
} else if (this.levelData?.tutorialText) {
  this.showTutorialHint();
}
```

}

// ─── Tutorial hint overlay ────────────────────────────────────────────────

showTutorialHint() {
const { width, height } = this.scale;
const text = this.levelData.tutorialText;

```
const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6).setDepth(30);
const card    = this.add.rectangle(width / 2, height / 2, width - 48, 192, 0x0a160a).setDepth(31);
const border  = this.add.rectangle(width / 2, height / 2, width - 48, 192).setStrokeStyle(1, 0x5eba7d).setDepth(31);

const label = this.add.text(width / 2, height / 2 - 74, `LEVEL ${this.levelId} — ${this.levelData.name || ''}`, {
  fontFamily: 'monospace', fontSize: '10px', color: '#5eba7d', letterSpacing: 2
}).setOrigin(0.5).setDepth(32);

const hint = this.add.text(width / 2, height / 2 - 16, text, {
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
  this.tutorialElements?.forEach(e => e?.destroy());
  this.tutorialElements = null;
});
btn.on('pointerover', () => btn.setFillStyle(0x1e3a1e));
btn.on('pointerout',  () => btn.setFillStyle(0x162216));
```

}

// ─── Scene drawing ────────────────────────────────────────────────────────

drawPath() {
const graphics = this.add.graphics();
graphics.lineStyle(40, 0x161b22, 1);
graphics.beginPath();
graphics.moveTo(this.pathPoints[0].x, this.pathPoints[0].y);
this.pathPoints.forEach(p => graphics.lineTo(p.x, p.y));
graphics.strokePath();

```
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
```

}

drawHeader() {
const { width } = this.scale;

```
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
```

}

drawTowerSlots() {
this.slotRefs = [];

```
this.towerSlotPositions.forEach((pos, i) => {
  const slot = this.add.rectangle(pos.x, pos.y, 48, 48, 0x0d1117).setInteractive();
  this.add.rectangle(pos.x, pos.y, 48, 48).setStrokeStyle(1, 0x334455);
  this.add.text(pos.x, pos.y, `${i + 1}`, {
    fontFamily: 'monospace', fontSize: '13px', color: '#445566', fontStyle: 'bold'
  }).setOrigin(0.5);

  slot.slotIndex = i;
  slot.slotPos   = pos;
  slot.occupied  = false;

  slot.on('pointerdown', () => this.towerSlotPressed(slot));
  slot.on('pointerover', () => { if (!slot.occupied && this.selectedTowerType) slot.setFillStyle(0x1e2530); });
  slot.on('pointerout',  () => { if (!slot.occupied) slot.setFillStyle(0x0d1117); });

  this.slotRefs.push(slot);
});
```

}

drawBottomPanel() {
const { width, height } = this.scale;
const panelY = height - 144;

```
this.add.rectangle(width / 2, height - 72, width, 144, 0x161b22);
this.add.rectangle(width / 2, panelY, width, 1, 0x334455);

const towerTypes = ['gunner', 'bomber', 'barricade'];
this.towerButtons = {};

towerTypes.forEach((type, i) => {
  const data      = TOWER_DATA[type];
  const x         = 52 + i * 96;
  const y         = panelY + 56;
  const colourHex = '#' + data.colour.toString(16).padStart(6, '0');
  const count     = this.loadout[type];
  const active    = count > 0;

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
    btn.on('pointerover', () => { if (this.selectedTowerType !== type) btn.setFillStyle(0x252c38); });
    btn.on('pointerout',  () => { if (this.selectedTowerType !== type) btn.setFillStyle(0x1e2530); });
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
this.startWaveBtn.on('pointerout',  () => this.startWaveBtn.setFillStyle(0x0d1a0d));
```

}

// ─── Tower placement ──────────────────────────────────────────────────────

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

```
const type = this.selectedTowerType;
const data = TOWER_DATA[type];
const pos  = slot.slotPos;

slot.setFillStyle(data.colour, 0.15);
this.add.rectangle(pos.x, pos.y, 48, 48).setStrokeStyle(2, data.colour);
this.add.circle(pos.x, pos.y - 6, 9, data.colour);
this.add.text(pos.x, pos.y + 12, data.name.substring(0, 3), {
  fontFamily: 'monospace', fontSize: '11px', color: '#eef2f8', fontStyle: 'bold'
}).setOrigin(0.5);

// Range / slow-field indicator
if (type === 'barricade') {
  // Persistent slow-field ring — stays on screen
  this.add.circle(pos.x, pos.y, data.range, data.colour, 0.04);
  this.add.circle(pos.x, pos.y, data.range).setStrokeStyle(1, data.colour, 0.25);
} else {
  const ring = this.add.circle(pos.x, pos.y, data.range, data.colour, 0.06);
  this.add.circle(pos.x, pos.y, data.range).setStrokeStyle(1, data.colour, 0.25);
  this.time.delayedCall(1200, () => ring.destroy());
}

slot.occupied = true;
this.loadout[type]--;
this.towerButtons[type].countText.setText(`×${this.loadout[type]}`);
this.towersUsed[type] = (this.towersUsed[type] || 0) + 1;

const tower = { type, x: pos.x, y: pos.y, data: { ...data }, lastFired: 0 };
this.placedTowers.push(tower);

// Barricade is passive — no shoot loop
if (type !== 'barricade') {
  const timerEvent = this.time.addEvent({
    delay: 120,
    callback: () => this.towerShoot(tower),
    loop: true
  });
  this.towerTimerEvents.push(timerEvent); // FIX: store ref
}
```

}

// ─── Barricade slow ───────────────────────────────────────────────────────

// Returns a speed multiplier (0–1) for an enemy based on nearby barricades.
// Multiple barricades don’t stack — the most severe applies.
getSpeedModifier(enemy) {
let modifier = 1.0;
this.placedTowers.forEach(tower => {
if (tower.type !== ‘barricade’) return;
const dist = Phaser.Math.Distance.Between(tower.x, tower.y, enemy.sprite.x, enemy.sprite.y);
if (dist <= tower.data.range) {
modifier = Math.min(modifier, tower.data.slowAmount);
}
});
return modifier;
}

// ─── Combat ───────────────────────────────────────────────────────────────

towerShoot(tower) {
if (!this.waveActive || this.gameOver) return;
if (tower.type === ‘barricade’) return; // passive — handled in moveToWaypoint
if (this.time.now - tower.lastFired < tower.data.fireRate) return;

```
const inRange = this.activeEnemies.filter(e => {
  if (!e.alive || !e.sprite?.active) return false;
  return Phaser.Math.Distance.Between(tower.x, tower.y, e.sprite.x, e.sprite.y) <= tower.data.range;
});
if (inRange.length === 0) return;

// Priority target: furthest along the path
const target = inRange.reduce((best, e) => e.pathProgress > best.pathProgress ? e : best, inRange[0]);
tower.lastFired = this.time.now;

const bulletSize = tower.type === 'bomber' ? 7 : 5;
const bullet = this.add.circle(tower.x, tower.y, bulletSize, tower.data.colour);

this.tweens.add({
  targets: bullet,
  x: target.sprite.x,
  y: target.sprite.y,
  duration: 160,
  onComplete: () => {
    bullet.destroy();
    if (!target.alive) return;

    if (tower.type === 'bomber') {
      // FIX: apply splash damage to all enemies within splashRadius
      const splashR = tower.data.splashRadius || 50;
      const splashTargets = this.activeEnemies.filter(e => {
        if (!e.alive || !e.sprite?.active) return false;
        return Phaser.Math.Distance.Between(target.sprite.x, target.sprite.y, e.sprite.x, e.sprite.y) <= splashR;
      });
      splashTargets.forEach(e => this.dealDamage(e, tower.data.damage));

      // Splash visual
      const flash = this.add.circle(target.sprite.x, target.sprite.y, splashR, 0xe8a020, 0.28);
      this.tweens.add({
        targets: flash, alpha: 0, scaleX: 1.5, scaleY: 1.5, duration: 280,
        onComplete: () => flash.destroy()
      });
    } else {
      this.dealDamage(target, tower.data.damage);
    }
  }
});
```

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

```
this.parts += enemy.data.partsReward;
this.partsText.setText(`${this.parts}`);
this.killStats[enemy.type] = (this.killStats[enemy.type] || 0) + 1;

// Destroy HP bars
enemy.hpBg?.destroy();   enemy.hpBg   = null;
enemy.hpFill?.destroy(); enemy.hpFill = null;

if (enemy.sprite?.active) {
  this.tweens.add({
    targets: enemy.sprite,
    alpha: 0, scaleX: 1.8, scaleY: 1.8, duration: 200,
    onComplete: () => { enemy.sprite?.destroy(); }
  });
}

this.waveEnemyResolved++;
this.checkWaveComplete();
```

}

// ─── Wave management ──────────────────────────────────────────────────────

startNextWave() {
if (this.waveActive || this.gameOver) return;
if (this.currentWave >= this.levelData.waves.length) return;

```
// Dismiss tutorial overlay if still showing
if (this.tutorialElements) {
  this.tutorialElements.forEach(e => e?.destroy());
  this.tutorialElements = null;
}

const waveData = this.levelData.waves[this.currentWave];
this.waveActive = true;
this.waveText.setText(`WAVE ${this.currentWave + 1} OF ${this.levelData.waves.length}`);
this.startWaveBtn.setAlpha(0.4).disableInteractive();
this.selectedTowerType = null;

this.time.delayedCall(waveData.preWaveDelay || 2000, () => {
  this.spawnWave(waveData);
});
```

}

spawnWave(waveData) {
let totalDelay = 0;

```
// FIX: pre-count total enemies so wave-complete check has no race condition
this.waveEnemyTotal    = waveData.enemies.reduce((sum, g) => sum + g.count, 0);
this.waveEnemyResolved = 0;

waveData.enemies.forEach(group => {
  for (let i = 0; i < group.count; i++) {
    this.time.delayedCall(totalDelay, () => {
      if (!this.gameOver) this.spawnEnemy(group.type);
    });
    totalDelay += group.interval;
  }
});
```

}

spawnEnemy(type) {
const data  = ENEMY_DATA[type];
const start = this.pathPoints[0];
const sprite = this.add.circle(start.x, start.y, data.size, data.colour);

```
// HP bars — updated every frame in update()
const barW   = Math.max(data.size * 2.5, 22);
const hpBg   = this.add.rectangle(start.x, start.y - data.size - 7, barW, 4, 0x2a3a4a).setDepth(5);
const hpFill = this.add.rectangle(
  start.x - barW / 2, start.y - data.size - 7, barW, 4, 0x5eba7d
).setOrigin(0, 0.5).setDepth(6);

const enemy = {
  type,
  data:       { ...data },
  sprite,
  hp:         data.hp,
  maxHp:      data.hp,
  alive:      true,
  pathProgress: 0,
  hpBg,
  hpFill
};
this.activeEnemies.push(enemy);
this.moveToWaypoint(enemy, 1);
```

}

moveToWaypoint(enemy, idx) {
if (!enemy.alive || this.gameOver) return;
if (idx >= this.pathPoints.length) {
this.enemyReachedEnd(enemy);
return;
}

```
const target = this.pathPoints[idx];
const dist   = Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, target.x, target.y);
enemy.pathProgress = idx;

// FIX: apply barricade slow — checked at each waypoint transition
const speedMod      = this.getSpeedModifier(enemy);
const effectiveSpeed = enemy.data.speed * speedMod;

this.tweens.add({
  targets:  enemy.sprite,
  x:        target.x,
  y:        target.y,
  duration: (dist / effectiveSpeed) * 1000,
  ease:     'Linear',
  onComplete: () => { if (enemy.alive) this.moveToWaypoint(enemy, idx + 1); }
});
```

}

enemyReachedEnd(enemy) {
if (!enemy.alive) return;
enemy.alive = false;
this.activeEnemies = this.activeEnemies.filter(e => e !== enemy);

```
enemy.hpBg?.destroy();   enemy.hpBg   = null;
enemy.hpFill?.destroy(); enemy.hpFill = null;

if (enemy.sprite) enemy.sprite.destroy();

this.baseHp -= enemy.data.baseDamage;
if (this.baseHp < 0) this.baseHp = 0;
this.hpText.setText(`${this.baseHp}`);
if (this.baseHp <= 3) this.hpText.setColor('#c43a3a');

if (this.baseHp <= 0) {
  this.triggerGameOver(false);
  return;
}

this.waveEnemyResolved++;
this.checkWaveComplete();
```

}

checkWaveComplete() {
if (!this.waveActive || this.gameOver) return;
// FIX: compare against pre-counted total — no race condition
if (this.waveEnemyResolved < this.waveEnemyTotal) return;

```
this.time.delayedCall(1200, () => {
  if (!this.waveActive) return;
  this.waveActive = false;
  this.currentWave++;

  if (this.currentWave >= this.levelData.waves.length) {
    this.time.delayedCall(400, () => this.triggerGameOver(true));
    return;
  }

  this.waveText.setText(`WAVE ${this.currentWave} COMPLETE  —  PLACE MORE TOWERS`);
  this.startWaveBtn.setAlpha(1).setInteractive();
  this.startWaveBtnSub.setText(`WAVE ${this.currentWave + 1}`);
});
```

}

// ─── Game over ────────────────────────────────────────────────────────────

triggerGameOver(victory) {
this.gameOver  = true;
this.waveActive = false;

```
// FIX: stop all tower shoot loops
this.towerTimerEvents.forEach(e => e.remove(false));
this.towerTimerEvents = [];

if (victory) this.saveProgress();

const { width, height } = this.scale;

this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.85);

const titleColour = victory ? '#5eba7d' : '#c43a3a';
const titleText   = victory ? 'VICTORY'  : 'BASE LOST';
const subText     = victory ? 'YOUR SOVEREIGNTY HOLDS' : 'YOUR BASE WAS OVERWHELMED';

this.add.text(width / 2, 130, titleText, {
  fontFamily: 'monospace', fontSize: '44px', color: titleColour, fontStyle: 'bold'
}).setOrigin(0.5);
this.add.text(width / 2, 184, subText, {
  fontFamily: 'monospace', fontSize: '13px', color: '#8899aa', letterSpacing: 2
}).setOrigin(0.5);

const statsY = 224;
this.add.rectangle(width / 2, statsY + 120, width - 48, 240, 0x161b22);
this.add.rectangle(width / 2, statsY + 120, width - 48, 240).setStrokeStyle(1, 0x334455);

const hpColour = this.baseHp > 5 ? '#5eba7d' : this.baseHp > 2 ? '#e8a020' : '#c43a3a';
this.add.text(32, statsY + 12, 'BASE HP REMAINING', { fontFamily: 'monospace', fontSize: '10px', color: '#8899aa', letterSpacing: 2 });
this.add.text(32, statsY + 30, `${this.baseHp} / ${this.baseHpMax}`, { fontFamily: 'monospace', fontSize: '22px', color: hpColour, fontStyle: 'bold' });

const barMaxW = width - 64;
this.add.rectangle(width / 2, statsY + 66, barMaxW, 8, 0x2a3a4a);
this.add.rectangle(
  32, statsY + 66,
  barMaxW * (this.baseHp / this.baseHpMax), 8,
  Phaser.Display.Color.HexStringToColor(hpColour).color
).setOrigin(0, 0.5);

this.add.rectangle(width / 2, statsY + 90, width - 48, 1, 0x334455);
this.add.text(32, statsY + 100, 'PARTS EARNED', { fontFamily: 'monospace', fontSize: '10px', color: '#8899aa', letterSpacing: 2 });
this.add.text(width - 32, statsY + 100, `${this.parts}`, { fontFamily: 'monospace', fontSize: '18px', color: '#e8a020', fontStyle: 'bold' }).setOrigin(1, 0);
this.add.text(width - 32, statsY + 122, '(parts do not carry over)', { fontFamily: 'monospace', fontSize: '10px', color: '#445566' }).setOrigin(1, 0);

this.add.rectangle(width / 2, statsY + 148, width - 48, 1, 0x334455);
this.add.text(32, statsY + 158, 'ENEMIES ELIMINATED', { fontFamily: 'monospace', fontSize: '10px', color: '#8899aa', letterSpacing: 2 });
const totalKills = Object.values(this.killStats).reduce((s, v) => s + v, 0);
this.add.text(width - 32, statsY + 158, `${totalKills} TOTAL`, { fontFamily: 'monospace', fontSize: '13px', color: '#eef2f8', fontStyle: 'bold' }).setOrigin(1, 0);
let killY = statsY + 176;
Object.entries(this.killStats).forEach(([type, count]) => {
  const name = ENEMY_DATA[type]?.name || type.toUpperCase();
  this.add.text(32, killY, name, { fontFamily: 'monospace', fontSize: '11px', color: '#556677' });
  this.add.text(width - 32, killY, `×${count}`, { fontFamily: 'monospace', fontSize: '11px', color: '#eef2f8' }).setOrigin(1, 0);
  killY += 18;
});

this.add.rectangle(width / 2, statsY + 228, width - 48, 1, 0x334455);
this.add.text(32, statsY + 238, 'TOWERS DEPLOYED', { fontFamily: 'monospace', fontSize: '10px', color: '#8899aa', letterSpacing: 2 });
let towerY = statsY + 256;
Object.entries(this.towersUsed).forEach(([type, count]) => {
  const data      = TOWER_DATA[type];
  const colourHex = '#' + data.colour.toString(16).padStart(6, '0');
  this.add.text(32, towerY, data.name, { fontFamily: 'monospace', fontSize: '11px', color: colourHex });
  this.add.text(width - 32, towerY, `×${count}`, { fontFamily: 'monospace', fontSize: '11px', color: '#eef2f8' }).setOrigin(1, 0);
  towerY += 18;
});

// Level-specific reward cards
if (victory && this.levelId === 1) {
  const ry = statsY + 298;
  this.add.rectangle(width / 2, ry + 28, width - 48, 56, 0x0d1e2e);
  this.add.rectangle(width / 2, ry + 28, width - 48, 56).setStrokeStyle(1, 0x3a8fc4);
  this.add.circle(48, ry + 28, 14, 0x3a8fc4);
  this.add.text(48, ry + 28, 'W2', { fontFamily: 'monospace', fontSize: '10px', color: '#0d1117', fontStyle: 'bold' }).setOrigin(0.5);
  this.add.text(72, ry + 16, 'NEW RECRUIT', { fontFamily: 'monospace', fontSize: '13px', color: '#3a8fc4', fontStyle: 'bold' });
  this.add.text(72, ry + 34, 'A second worker awaits at the factory.', { fontFamily: 'monospace', fontSize: '11px', color: '#8899aa' });
}

if (victory && this.levelId === 2) {
  const ry = statsY + 298;
  this.add.rectangle(width / 2, ry + 28, width - 48, 56, 0x1a1200);
  this.add.rectangle(width / 2, ry + 28, width - 48, 56).setStrokeStyle(1, 0xe8a020);
  this.add.text(32, ry + 16, 'FACTORY UNLOCK', { fontFamily: 'monospace', fontSize: '13px', color: '#e8a020', fontStyle: 'bold' });
  this.add.text(32, ry + 34, 'Bomber & Barricade assembly now available.', { fontFamily: 'monospace', fontSize: '11px', color: '#8899aa' });
}

if (victory && this.levelId === 8) {
  const ry = statsY + 298;
  this.add.rectangle(width / 2, ry + 28, width - 48, 56, 0x1a0a0a);
  this.add.rectangle(width / 2, ry + 28, width - 48, 56).setStrokeStyle(1, 0xc43a3a);
  this.add.text(32, ry + 16, 'NEW THREAT INCOMING', { fontFamily: 'monospace', fontSize: '13px', color: '#c43a3a', fontStyle: 'bold' });
  this.add.text(32, ry + 34, 'The Limbic Cartel has taken notice.', { fontFamily: 'monospace', fontSize: '11px', color: '#8899aa' });
}

const btnY = height - 90;
const btn = this.add.rectangle(width / 2, btnY, 260, 68, 0x161b22).setInteractive();
this.add.rectangle(width / 2, btnY, 260, 68).setStrokeStyle(1, 0xe8a020);
this.add.text(width / 2, btnY, 'RETURN TO BASE', {
  fontFamily: 'monospace', fontSize: '18px', color: '#e8a020', fontStyle: 'bold'
}).setOrigin(0.5);
btn.on('pointerdown', () => {
  this.cameras.main.fade(300, 0, 0, 0);
  this.time.delayedCall(300, () => this.scene.start('BaseScene'));
});
btn.on('pointerover', () => btn.setFillStyle(0x252c38));
btn.on('pointerout',  () => btn.setFillStyle(0x161b22));
```

}

// ─── Save ─────────────────────────────────────────────────────────────────

saveProgress() {
const slotIndex = localStorage.getItem(‘factower_active_slot’);
const saveKey   = `factower_save_${slotIndex}`;
const save      = JSON.parse(localStorage.getItem(saveKey));

```
if (!save.completedLevels) save.completedLevels = {};
const key = `storyline${this.storylineId}`;
if (!save.completedLevels[key]) save.completedLevels[key] = [];
if (!save.completedLevels[key].includes(this.levelId)) {
  save.completedLevels[key].push(this.levelId);
}

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
```

}

// ─── Per-frame update ─────────────────────────────────────────────────────

update() {
// Track and update HP bar positions for all active enemies
this.activeEnemies.forEach(enemy => {
if (!enemy.alive || !enemy.sprite?.active) return;

```
  const x    = enemy.sprite.x;
  const y    = enemy.sprite.y;
  const barW = Math.max(enemy.data.size * 2.5, 22);
  const barY = y - enemy.data.size - 7;

  if (enemy.hpBg) enemy.hpBg.setPosition(x, barY);

  if (enemy.hpFill) {
    const pct   = Math.max(0, enemy.hp / enemy.maxHp);
    const fillW = barW * pct;
    enemy.hpFill.setPosition(x - barW / 2, barY);
    enemy.hpFill.setSize(fillW, 4);
    const colour = pct > 0.5 ? 0x5eba7d : pct > 0.25 ? 0xe8a020 : 0xc43a3a;
    enemy.hpFill.setFillStyle(colour);
  }
});
```

}
}