class BaseScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BaseScene' });
  }

  create() {
    const { width, height } = this.scale;

    const slotIndex   = localStorage.getItem('factower_active_slot');
    const saveKey     = `factower_save_${slotIndex}`;
    this.saveData     = JSON.parse(localStorage.getItem(saveKey)) || {};
    this.saveKey      = saveKey;

    // ── Derive unlock states ──────────────────────────────────────────────
    if (!this.saveData.flags) this.saveData.flags = {};

    const stockTotal      = Object.values(this.saveData.stockpile || {}).reduce((a, b) => a + b, 0);
    const completedLevels = this.saveData.completedLevels || [];

    // Armoury + Dock: first tower ever built or first level completed
    const armouryUnlocked = this.saveData.flags.armouryUnlocked
      || stockTotal > 0
      || completedLevels.length > 0;

    // Skill Matrix: always unlocked in current build (gates will be enforced when merchants ship)
    const skillMatrixUnlocked = true;

    // Persist newly-derived flags so future checks are instant
    let flagsDirty = false;
    if (armouryUnlocked   && !this.saveData.flags.armouryUnlocked)   { this.saveData.flags.armouryUnlocked   = true; flagsDirty = true; }
    if (skillMatrixUnlocked && !this.saveData.flags.skillTreeUnlocked) { this.saveData.flags.skillTreeUnlocked = true; flagsDirty = true; }
    if (flagsDirty) localStorage.setItem(saveKey, JSON.stringify(this.saveData));

    // Is this the very first time the player lands here?
    const isFirstVisit = !this.saveData.flags.baseTutDone;

    // ── Background & header ───────────────────────────────────────────────
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

    this.add.text(width - 24, 38, 'POWER', {
      fontFamily: 'monospace', fontSize: '10px', color: '#8899aa', letterSpacing: 3
    }).setOrigin(1, 0);
    this.add.text(width - 24, 52, `${powerScore}`, {
      fontFamily: 'monospace', fontSize: '18px', color: '#e8a020', fontStyle: 'bold'
    }).setOrigin(1, 0);
    this.add.text(width - 24, 78, `${nuts} NUTS  ·  ${bolts} BOLTS`, {
      fontFamily: 'monospace', fontSize: '10px', color: '#556677', letterSpacing: 1
    }).setOrigin(1, 0);

    this.add.text(width / 2, 142, 'SELECT ZONE', {
      fontFamily: 'monospace', fontSize: '11px', color: '#8899aa', letterSpacing: 5
    }).setOrigin(0.5);

    // ── Build zone list dynamically ───────────────────────────────────────
    // Zones are rendered from y=220 downward.
    // Unlocked zones take 96px height, locked zones take 52px.
    // We build an array of zone descriptors then lay them out.

    const zones = [];

    zones.push({
      key: 'factory', title: 'FACTORY FLOOR', subtitle: 'PRODUCE TOWERS',
      colour: '#3a8fc4', unlocked: true
    });

    if (armouryUnlocked) {
      zones.push({
        key: 'armoury', title: 'ARMOURY', subtitle: 'MANAGE STOCKPILE',
        colour: '#5eba7d', unlocked: true
      });
      zones.push({
        key: 'dock', title: 'DOCK', subtitle: 'LAUNCH MISSIONS',
        colour: '#c43a3a', unlocked: true
      });
    } else {
      zones.push({
        key: null, title: 'ARMOURY', subtitle: 'BUILD A TOWER TO UNLOCK',
        colour: '#445566', unlocked: false, hint: 'LOCKED — BUILD YOUR FIRST TOWER'
      });
      zones.push({
        key: null, title: 'DOCK', subtitle: 'BUILD A TOWER TO UNLOCK',
        colour: '#445566', unlocked: false, hint: 'LOCKED — BUILD YOUR FIRST TOWER'
      });
    }

    if (skillMatrixUnlocked) {
      zones.push({
        key: 'skillTree', title: 'SKILL MATRIX', subtitle: 'SPEND BOLTS',
        colour: '#e8a020', unlocked: true
      });
    } else {
      zones.push({
        key: null, title: 'SKILL MATRIX', subtitle: 'EARN BOLTS TO UNLOCK',
        colour: '#445566', unlocked: false, hint: 'LOCKED — EARN BOLTS FROM MERCHANTS'
      });
    }

    // Future zones — always locked for now
    zones.push({ key: null, title: 'MARKETPLACE',    subtitle: 'UNLOCK VIA STORY', colour: '#445566', unlocked: false });
    zones.push({ key: null, title: 'WORKER HOUSING', subtitle: 'UNLOCK VIA STORY', colour: '#445566', unlocked: false });

    // Layout
    let y = 220;
    this.zoneObjects = {};
    zones.forEach(zone => {
      const zoneH = zone.unlocked ? 96 : 52;
      this._drawZone(zone, y, zoneH);
      if (zone.key) this.zoneObjects[zone.key] = y;
      y += zoneH + 12;
    });

    // ── Tutorial overlay ──────────────────────────────────────────────────
    if (isFirstVisit || !armouryUnlocked) {
      this._showTutorial(armouryUnlocked, skillMatrixUnlocked);
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
      this.add.text(50, y - 16, zone.title, {
        fontFamily: 'monospace', fontSize: '17px', color: '#eef2f8', fontStyle: 'bold'
      });
      this.add.text(50, y + 10, zone.subtitle, {
        fontFamily: 'monospace', fontSize: '11px', color: '#8899aa', letterSpacing: 2
      });
      this.add.text(width - 32, y, '→', {
        fontFamily: 'monospace', fontSize: '20px', color: zone.colour
      }).setOrigin(0.5);
      bg.on('pointerdown', () => this._enterZone(zone.key));
      bg.on('pointerover', () => bg.setFillStyle(0x1e2530));
      bg.on('pointerout',  () => bg.setFillStyle(0x161b22));

    } else {
      this.add.rectangle(width / 2, y, zoneW, zoneH).setStrokeStyle(1, 0x222d3a);
      this.add.text(width / 2, y - 8, zone.title, {
        fontFamily: 'monospace', fontSize: '12px', color: '#445566', fontStyle: 'bold'
      }).setOrigin(0.5);
      const hintStr = zone.hint || 'UNLOCK VIA STORY';
      this.add.text(width / 2, y + 8, hintStr, {
        fontFamily: 'monospace', fontSize: '9px', color: '#2a3a4a', letterSpacing: 2
      }).setOrigin(0.5);
    }
  }

  _showTutorial(armouryUnlocked, skillMatrixUnlocked) {
    const { width } = this.scale;

    if (!armouryUnlocked) {
      // New player — only factory unlocked. Highlight it.
      const factoryY = this.zoneObjects.factory;
      if (factoryY === undefined) return;

      // Pulsing amber border around the factory zone card
      const zoneW = width - 48;
      const pulse = this.add.rectangle(width / 2, factoryY, zoneW + 8, 104).setDepth(15)
        .setStrokeStyle(2, 0xe8a020, 0.9);
      this.tweens.add({ targets: pulse, alpha: 0.4, duration: 700, yoyo: true, repeat: -1 });

      // Small instruction card directly below the zone
      const cardY = factoryY + 68;
      this.add.rectangle(width / 2, cardY, zoneW, 38, 0x0d1520, 0.95).setDepth(15);
      this.add.rectangle(width / 2, cardY, zoneW, 38).setStrokeStyle(1, 0xe8a020, 0.5).setDepth(15);
      this.add.text(width / 2, cardY - 7, 'START HERE — BUILD YOUR FIRST TOWER', {
        fontFamily: 'monospace', fontSize: '10px', color: '#e8a020', fontStyle: 'bold', letterSpacing: 2
      }).setOrigin(0.5).setDepth(16);
      this.add.text(width / 2, cardY + 9, 'ARMOURY AND DOCK UNLOCK ONCE YOU HAVE TOWERS', {
        fontFamily: 'monospace', fontSize: '8px', color: '#556677', letterSpacing: 1
      }).setOrigin(0.5).setDepth(16);

    } else if (!skillMatrixUnlocked) {
      // Armoury / Dock just became available — guide player to dock
      const dockY = this.zoneObjects.dock;
      if (dockY === undefined) return;

      const zoneW = width - 48;
      const pulse = this.add.rectangle(width / 2, dockY, zoneW + 8, 104).setDepth(15)
        .setStrokeStyle(2, 0xc43a3a, 0.9);
      this.tweens.add({ targets: pulse, alpha: 0.4, duration: 700, yoyo: true, repeat: -1 });

      const cardY = dockY + 68;
      this.add.rectangle(width / 2, cardY, zoneW, 38, 0x140808, 0.95).setDepth(15);
      this.add.rectangle(width / 2, cardY, zoneW, 38).setStrokeStyle(1, 0xc43a3a, 0.5).setDepth(15);
      this.add.text(width / 2, cardY - 7, 'YOU\'RE ARMED — LAUNCH YOUR FIRST MISSION', {
        fontFamily: 'monospace', fontSize: '10px', color: '#c43a3a', fontStyle: 'bold', letterSpacing: 1
      }).setOrigin(0.5).setDepth(16);
      this.add.text(width / 2, cardY + 9, 'HEAD TO THE DOCK TO SELECT A LEVEL', {
        fontFamily: 'monospace', fontSize: '8px', color: '#556677', letterSpacing: 1
      }).setOrigin(0.5).setDepth(16);

      if (!this.saveData.flags.baseTutDone) {
        this.saveData.flags.baseTutDone = true;
        localStorage.setItem(this.saveKey, JSON.stringify(this.saveData));
      }
    }
  }

  _enterZone(key) {
    this.cameras.main.flash(150, 0, 0, 0);
    this.time.delayedCall(150, () => {
      switch (key) {
        case 'factory':   this.scene.start('FactoryScene');    break;
        case 'armoury':   this.scene.start('ArmouryScene');    break;
        case 'dock':      this.scene.start('DockScene');       break;
        case 'skillTree': this.scene.start('SkillTreeScene');  break;
      }
    });
  }
}