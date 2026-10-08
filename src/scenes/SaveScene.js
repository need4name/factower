class SaveScene extends Phaser.Scene {
  constructor() {
    super({ key: 'SaveScene' });
  }

  create() {
    const { width, height } = this.scale;
    UI.backdrop(this);
    UI.fadeIn(this);

    UI.text(this, width / 2, 74, 'FACTOWER', 'hero', { size: 34, origin: 0.5, ls: 3 });
    UI.text(this, width / 2, 110, 'CHOOSE A SAVE', 'label', { origin: 0.5, size: 12 });

    const cardH = 168, gap = 18;
    const top = 150;
    for (let i = 0; i < 3; i++) this.createSlot(i, top + cardH / 2 + i * (cardH + gap), cardH);

    UI.text(this, width / 2, height - 34, 'Progress saves automatically on this device.', 'small', { origin: 0.5, color: UI.T.faint });
  }

  createSlot(index, y, cardH) {
    const { width } = this.scale;
    const w = width - 40;
    const data = SaveManager.exists(index) ? SaveManager.load(index) : null;
    const isEmpty = !data;
    const lx = width / 2 - w / 2 + 20;

    const panel = UI.panel(this, width / 2, y, w, cardH, {
      fill: UI.C.surface, stroke: isEmpty ? UI.C.lineSoft : UI.C.line,
      accent: isEmpty ? undefined : UI.C.amber, radius: 16
    });

    UI.text(this, lx, y - cardH / 2 + 18, 'SLOT ' + (index + 1), 'label', { size: 11 });

    if (isEmpty) {
      UI.text(this, width / 2, y - 6, 'New game', 'title', { origin: 0.5, size: 24 });
      UI.text(this, width / 2, y + 24, 'Start building your island defences.', 'body', { origin: 0.5, size: 13, color: UI.T.mute });
    } else {
      const completed = (data.completedLevels && data.completedLevels.storyline1) || [];
      const stock = Object.values(data.stockpile || {}).reduce((a, b) => a + b, 0);
      UI.text(this, lx, y - 28, data.playerName || 'THE PIRATE KING', 'title', { size: 21, origin: [0, 0.5] });
      UI.text(this, lx, y + 2, 'Salt & Plastic  ·  ' + completed.length + ' / 8 levels cleared', 'body', { size: 13, origin: [0, 0.5] });

      const chipY = y + 42;
      let cx = lx;
      [['towers', stock], ['nuts', data.nuts || 0], ['bolts', data.bolts || 0]].forEach(([k, v]) => {
        const chip = UI.chip(this, 0, chipY, k, v);
        chip.x = cx + chip.cw / 2;
        cx += chip.cw + 8;
      });

      // Delete — small trash button, asks before wiping anything
      const del = UI.button(this, width / 2 + w / 2 - 34, y - cardH / 2 + 26, 40, 34, {
        variant: 'ghost', label: '', depth: 2, onTap: () => this.confirmDelete(index, data)
      });
      del.add(UI.icon(this, 0, 0, 'trash', 15, UI.C.red));
    }

    // Whole card is the "play" target (the delete button sits above it)
    const zone = this.add.zone(width / 2, y, w, cardH).setInteractive().setDepth(1);
    let pressed = false;
    zone.on('pointerdown', () => { pressed = true; panel.setAlpha(0.8); });
    zone.on('pointerout',  () => { pressed = false; panel.setAlpha(1); });
    zone.on('pointerup',   () => { panel.setAlpha(1); if (pressed) this.selectSlot(index, isEmpty); pressed = false; });

    // Play affordance on the right
    const playX = width / 2 + w / 2 - 36;
    const pg = this.add.graphics().setDepth(1);
    pg.fillStyle(isEmpty ? UI.C.surface2 : UI.C.amber, 1);
    pg.fillCircle(playX, y + (isEmpty ? 0 : 6), 18);
    UI.icon(this, playX + 1, y + (isEmpty ? 0 : 6), isEmpty ? 'chevron' : 'play', 13, isEmpty ? 0xeef2f7 : UI.C.bg).setDepth(1);
  }

  confirmDelete(index, data) {
    UI.modal(this, {
      title: 'Delete slot ' + (index + 1) + '?',
      body: 'All progress for ' + (data.playerName || 'this save') + ' will be lost. This cannot be undone.',
      icon: 'trash', accent: UI.C.red,
      buttons: [
        { label: 'CANCEL', variant: 'secondary' },
        { label: 'DELETE', variant: 'danger', onTap: () => { SaveManager.remove(index); this.scene.restart(); } }
      ]
    });
  }

  selectSlot(index, isEmpty) {
    if (isEmpty) {
      const newSave = {
        saveVersion: SAVE_VERSION,
        slot:       index,
        playerName: 'THE PIRATE KING',
        storyline:  1,
        level:      1,
        powerScore: 0,
        // ── Starting materials ─────────────────────────────────────────────
        // Player must visit the factory before the first level.
        materials: { plasticScrap: 2, refinedPlastic: 0, salvagedMetal: 0 },
        // ── Starting stockpile: empty — towers are built, never given ─────
        stockpile: { gunner: 0, bomber: 0, barricade: 0 },
        nuts:            0,
        bolts:           0,
        parts:           0,
        completedLevels: {},
        skillTree:       {},
        merchantFatigue: { chrome: 0, ricochet: 0, doubleDown: 0 },
        merchantUnlocks: { chrome: false, ricochet: false, doubleDown: false },
        chromeState:     { pityCount: 0 },
        ricochetState:   {},
        ddState:         {},
        tutorials:       {},
        flags: {
          armouryUnlocked:     false,
          skillTreeUnlocked:   false,  // unlocks after first level completion
          marketplaceUnlocked: false,  // unlocks after first level completion
          baseTutDone:         false
        },
        // True whenever the factory should be running — i.e. the player is NOT
        // in a combat mission. CombatScene flips this on entry and exit.
        factoryActive: true,
        createdAt: Date.now()
      };
      SaveManager.write(newSave, index);
    } else {
      // Bring older saves up to the current format (see SaveManager.js)
      const existing = SaveManager.load(index);
      let   dirty    = SaveManager.migrate(existing);
      // Nobody is in combat while picking a slot. If the app was closed mid-battle,
      // CombatScene never got to clear this, and the factory would stay frozen.
      if (existing.factoryActive !== true) { existing.factoryActive = true; dirty = true; }
      if (dirty) SaveManager.write(existing, index);
    }

    SaveManager.setActiveSlot(index);
    UI.go(this, 'BaseScene');
  }
}
