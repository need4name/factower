class BaseScene extends Phaser.Scene {
constructor() {
  super({ key: 'BaseScene' });
}

create() {
  const { width, height } = this.scale;

  const slotIndex = localStorage.getItem('factower_active_slot');
  const saveKey   = 'factower_save_' + slotIndex;
  this.saveData   = JSON.parse(localStorage.getItem(saveKey)) || {};
  this.saveKey    = saveKey;

  // ── Derive unlock states ──────────────────────────────────────────────────
  if (!this.saveData.flags) this.saveData.flags = {};

  const stockTotal      = Object.values(this.saveData.stockpile || {}).reduce((a, b) => a + b, 0);
  const completedLevels = this.saveData.completedLevels || [];
  const completedArr    = Array.isArray(completedLevels) ? completedLevels : Object.values(completedLevels).flat();

  // ── Progression gates ────────────────────────────────────────────────────
  // Until the player builds their first tower, only the Factory is available.
  // Armoury + Dock open when they have a tower OR have completed any level.
  // Uplink + Marketplace require having earned something (towers built or levels won)
  // and are gated behind at least one completed level.
  const hasBuiltTower    = stockTotal > 0 || completedArr.length > 0;
  const hasCompletedAny  = completedArr.length > 0;

  const armouryUnlocked    = this.saveData.flags.armouryUnlocked || hasBuiltTower;
  const uplinkUnlocked     = this.saveData.flags.skillTreeUnlocked || hasCompletedAny;
  const marketplaceUnlocked = this.saveData.flags.marketplaceUnlocked || hasCompletedAny;

  // Persist newly-derived flags
  let flagsDirty = false;
  if (armouryUnlocked     && !this.saveData.flags.armouryUnlocked)     { this.saveData.flags.armouryUnlocked     = true; flagsDirty = true; }
  if (uplinkUnlocked      && !this.saveData.flags.skillTreeUnlocked)   { this.saveData.flags.skillTreeUnlocked   = true; flagsDirty = true; }
  if (marketplaceUnlocked && !this.saveData.flags.marketplaceUnlocked) { this.saveData.flags.marketplaceUnlocked = true; flagsDirty = true; }
  if (flagsDirty) localStorage.setItem(saveKey, JSON.stringify(this.saveData));

  const isFirstVisit = !this.saveData.flags.baseTutDone;

  // ── Background & header ───────────────────────────────────────────────────
  this.add.rectangle(width / 2, height / 2, width, height, 0x0d1117);
  this.add.rectangle(width / 2, 70, width, 100, 0x161b22);
  this.add.rectangle(width / 2, 120, width, 1, 0x334455);

  this.add.text(24, 38, 'THE PIRATE KING', {
    fontFamily: 'monospace', fontSize: '11px', color: '#8899aa', letterSpacing: 3
  });
  this.add.text(24, 58, 'YOUR ISLAND', {
    fontFamily: 'monospace', fontSize: '22px', color: '#eef2f8', fontStyle: 'bold'
  });

  const powerScore = this.saveData.powerScore || 0;
  const nuts       = this.saveData.nuts  || 0;
  const bolts      = this.saveData.bolts || 0;
  const scrap      = (this.saveData.materials && this.saveData.materials.plasticScrap)  || 0;
  const metal      = (this.saveData.materials && this.saveData.materials.salvagedMetal) || 0;

  this.add.text(width - 24, 38, 'POWER', {
    fontFamily: 'monospace', fontSize: '10px', color: '#8899aa', letterSpacing: 3
  }).setOrigin(1, 0);
  this.add.text(width - 24, 52, '' + powerScore, {
    fontFamily: 'monospace', fontSize: '18px', color: '#e8a020', fontStyle: 'bold'
  }).setOrigin(1, 0);
  // Show materials prominently before combat is unlocked, bolts after
  if (hasBuiltTower) {
    this.add.text(width - 24, 78, nuts + ' NUTS  \xb7  ' + bolts + ' BOLTS', {
      fontFamily: 'monospace', fontSize: '10px', color: '#556677', letterSpacing: 1
    }).setOrigin(1, 0);
  } else {
    this.add.text(width - 24, 78, scrap + ' SCRAP  \xb7  ' + metal + ' METAL', {
      fontFamily: 'monospace', fontSize: '10px', color: '#556677', letterSpacing: 1
    }).setOrigin(1, 0);
  }

  this.add.text(width / 2, 142, 'SELECT ZONE', {
    fontFamily: 'monospace', fontSize: '11px', color: '#8899aa', letterSpacing: 5
  }).setOrigin(0.5);

  // ── Zone list ─────────────────────────────────────────────────────────────
  const zones = [];

  zones.push({
    key: 'factory', title: 'FACTORY FLOOR', subtitle: 'PRODUCE TOWERS',
    colour: '#3a8fc4', unlocked: true
  });

  if (armouryUnlocked) {
    zones.push({ key: 'armoury', title: 'ARMOURY', subtitle: 'MANAGE STOCKPILE', colour: '#5eba7d', unlocked: true });
    zones.push({ key: 'dock',    title: 'DOCK',    subtitle: 'LAUNCH MISSIONS',  colour: '#c43a3a', unlocked: true });
  } else {
    zones.push({ key: null, title: 'ARMOURY', subtitle: '', colour: '#445566', unlocked: false, hint: 'LOCKED \u2014 BUILD YOUR FIRST TOWER' });
    zones.push({ key: null, title: 'DOCK',    subtitle: '', colour: '#445566', unlocked: false, hint: 'LOCKED \u2014 BUILD YOUR FIRST TOWER' });
  }

  if (uplinkUnlocked) {
    zones.push({ key: 'skillTree', title: 'UPLINK', subtitle: 'SPEND BOLTS', colour: '#e8a020', unlocked: true });
  } else {
    zones.push({ key: null, title: 'UPLINK', subtitle: '', colour: '#445566', unlocked: false, hint: 'LOCKED \u2014 COMPLETE A LEVEL' });
  }

  if (marketplaceUnlocked) {
    zones.push({ key: 'marketplace', title: 'MARKETPLACE', subtitle: 'MERCHANT GUILD', colour: '#7a5fc4', unlocked: true });
  } else {
    zones.push({ key: null, title: 'MARKETPLACE', subtitle: '', colour: '#445566', unlocked: false, hint: 'LOCKED \u2014 COMPLETE A LEVEL' });
  }

  zones.push({ key: null, title: 'WORKER HOUSING', subtitle: '', colour: '#445566', unlocked: false, hint: 'UNLOCK VIA STORY' });

  // Layout
  let y = 220;
  this.zoneObjects = {};
  zones.forEach(zone => {
    const zoneH = zone.unlocked ? 96 : 52;
    this._drawZone(zone, y, zoneH);
    if (zone.key) this.zoneObjects[zone.key] = y;
    y += zoneH + 12;
  });

  // ── Tutorial overlay ──────────────────────────────────────────────────────
  if (isFirstVisit) {
    this._showTutorial(armouryUnlocked);
    this.saveData.flags.baseTutDone = true;
    localStorage.setItem(saveKey, JSON.stringify(this.saveData));
  }
}

_drawZone(zone, y, zoneH) {
  const { width } = this.scale;
  const zoneW = width - 48;
  const col   = Phaser.Display.Color.HexStringToColor(zone.colour).color;

  const bg = this.add.rectangle(width / 2, y, zoneW, zoneH, 0x161b22);

  if (zone.unlocked) {
    bg.setInteractive();
    this.add.rectangle(width / 2, y, zoneW, zoneH).setStrokeStyle(1, col);
    this.add.rectangle(28, y, 6, zoneH - 16, col);
    this.add.text(50, y - 16, zone.title, { fontFamily: 'monospace', fontSize: '17px', color: '#eef2f8', fontStyle: 'bold' });
    this.add.text(50, y + 10, zone.subtitle, { fontFamily: 'monospace', fontSize: '11px', color: '#8899aa', letterSpacing: 2 });
    this.add.text(width - 32, y, '\u2192', { fontFamily: 'monospace', fontSize: '20px', color: zone.colour }).setOrigin(0.5);
    bg.on('pointerdown', () => this._enterZone(zone.key));
    bg.on('pointerover', () => bg.setFillStyle(0x1e2530));
    bg.on('pointerout',  () => bg.setFillStyle(0x161b22));
  } else {
    this.add.rectangle(width / 2, y, zoneW, zoneH).setStrokeStyle(1, 0x222d3a);
    this.add.text(width / 2, y - 8, zone.title, { fontFamily: 'monospace', fontSize: '12px', color: '#445566', fontStyle: 'bold' }).setOrigin(0.5);
    const hintStr = zone.hint || 'UNLOCK VIA STORY';
    this.add.text(width / 2, y + 8, hintStr, { fontFamily: 'monospace', fontSize: '9px', color: '#2a3a4a', letterSpacing: 2 }).setOrigin(0.5);
  }
}

_showTutorial(armouryUnlocked) {
  const { width } = this.scale;
  const zoneW = width - 48;

  const factoryY = this.zoneObjects.factory;
  if (factoryY !== undefined) {
    const pulse = this.add.rectangle(width / 2, factoryY, zoneW + 8, 104).setStrokeStyle(2, 0xe8a020, 0.9).setDepth(15);
    this.tweens.add({ targets: pulse, alpha: 0.3, duration: 700, yoyo: true, repeat: -1 });
  }

  if (!armouryUnlocked) {
    const cardY = (factoryY || 220) + 68;
    this.add.rectangle(width / 2, cardY, zoneW, 38, 0x0d1520, 0.95).setDepth(15);
    this.add.rectangle(width / 2, cardY, zoneW, 38).setStrokeStyle(1, 0xe8a020, 0.5).setDepth(15);
    this.add.text(width / 2, cardY - 7, 'START HERE \u2014 BUILD YOUR FIRST TOWER', { fontFamily: 'monospace', fontSize: '10px', color: '#e8a020', fontStyle: 'bold', letterSpacing: 2 }).setOrigin(0.5).setDepth(16);
    this.add.text(width / 2, cardY + 9, 'OTHER ZONES UNLOCK AS YOU PROGRESS', { fontFamily: 'monospace', fontSize: '8px', color: '#556677', letterSpacing: 1 }).setOrigin(0.5).setDepth(16);
  } else {
    const dockY = this.zoneObjects.dock;
    if (dockY !== undefined) {
      const pulseDock = this.add.rectangle(width / 2, dockY, zoneW + 8, 104).setStrokeStyle(2, 0xc43a3a, 0.9).setDepth(15);
      this.tweens.add({ targets: pulseDock, alpha: 0.3, duration: 700, yoyo: true, repeat: -1 });
    }
    const cardY = (dockY || 550) + 68;
    this.add.rectangle(width / 2, cardY, zoneW, 38, 0x140808, 0.95).setDepth(15);
    this.add.rectangle(width / 2, cardY, zoneW, 38).setStrokeStyle(1, 0xc43a3a, 0.5).setDepth(15);
    this.add.text(width / 2, cardY - 7, 'FACTORY BUILDS TOWERS  \xb7  DOCK LAUNCHES MISSIONS', { fontFamily: 'monospace', fontSize: '9px', color: '#c43a3a', fontStyle: 'bold', letterSpacing: 1 }).setOrigin(0.5).setDepth(16);
    this.add.text(width / 2, cardY + 9, 'START IN THE FACTORY, THEN HEAD TO THE DOCK', { fontFamily: 'monospace', fontSize: '8px', color: '#556677', letterSpacing: 1 }).setOrigin(0.5).setDepth(16);
  }
}

_enterZone(key) {
  this.cameras.main.flash(150, 0, 0, 0);
  this.time.delayedCall(150, () => {
    switch (key) {
      case 'factory':     this.scene.start('FactoryScene');     break;
      case 'armoury':     this.scene.start('ArmouryScene');     break;
      case 'dock':        this.scene.start('DockScene');        break;
      case 'skillTree':   this.scene.start('SkillTreeScene');   break;
      case 'marketplace': this.scene.start('MarketplaceScene'); break;
    }
  });
}
}
