// Nut values per tower type (tune later).
const TOWER_SELL_VALUE = {
  gunner:    1,
  gunner2:   3,
  siphon:    3,
  bomber:    2,
  barricade: 2
};

// One-line role description per tower, shown wherever towers are listed.
const TOWER_ROLE = {
  gunner:    'Fast single-target shots. Your bread and butter.',
  bomber:    'Slow, heavy shells that hit everything in a blast.',
  barricade: 'Deals no damage — slows every raider in its field.',
  gunner2:   'Tier 2 Gunner. Heavier rounds and longer reach.',
  siphon:    'Drains raiders with a beam. Kills drop double salvage, auto-collected.'
};

class ArmouryScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ArmouryScene' });
  }

  create() {
    const { width, height } = this.scale;
    this.saveData = applyTestStock() || SaveManager.load() || {};
    if (this.saveData.nuts === undefined) this.saveData.nuts = 0;
    UI.backdrop(this);
    UI.fadeIn(this);

    this.hdr = UI.header(this, {
      title: 'ARMOURY', sub: 'TOWERS READY FOR BATTLE', accent: UI.C.green,
      onBack: () => UI.go(this, 'BaseScene'),
      chips: [{ kind: 'nuts', value: this.saveData.nuts }]
    });

    // Phaser reuses this scene object between visits — clear references to
    // the previous visit's (destroyed) objects before anything touches them.
    this.cardItems = [];
    this.dockBtn = null;
    this.drawTowerCards();

    const by = height - 46;
    UI.button(this, 16 + 76, by, 152, 52, { label: 'BUILD MORE', variant: 'secondary', icon: 'factory', onTap: () => UI.go(this, 'FactoryScene') });
    this.dockBtn = UI.button(this, width - 16 - (width - 32 - 164) / 2, by, width - 32 - 164, 52, {
      label: 'TO THE DOCK', variant: 'primary', colour: UI.C.red, icon: 'anchor', onTap: () => UI.go(this, 'DockScene')
    });
  }

  drawTowerCards() {
    const { width } = this.scale;
    const stockpile = this.saveData.stockpile || {};
    this.cardItems.forEach(e => e.destroy());
    this.cardItems = [];

    // Unlocked towers, plus a preview of the next one still to unlock
    const isOpen = t => t === 'gunner' || Progress.has(this.saveData, t) || (stockpile[t] || 0) > 0;
    const shown = TOWER_ORDER.filter(isOpen);
    const nextLocked = TOWER_ORDER.find(t => !isOpen(t));
    if (nextLocked) shown.push(nextLocked);
    const compact = shown.length > 3;
    const w = width - 32, h = compact ? 108 : 150;
    let y = UI.HEADER_H + (compact ? 12 : 20);
    shown.forEach(type => {
      const d = TOWER_DATA[type];
      const count = stockpile[type] || 0;
      const unlocked = isOpen(type);
      const cy = y + h / 2;
      const lx = 16 + 20;
      const add = (o) => { this.cardItems.push(o); return o; };

      add(UI.panel(this, width / 2, cy, w, h, {
        fill: UI.C.surface, stroke: count > 0 ? d.colour : UI.C.lineSoft, strokeAlpha: count > 0 ? 0.5 : 1,
        accent: unlocked ? d.colour : undefined, radius: 16
      }));
      add(UI.text(this, lx, y + (compact ? 12 : 18), this.titleCase(d.name), 'title', { size: compact ? 19 : 22, color: unlocked ? UI.T.text : UI.T.faint }));
      const role = unlocked ? TOWER_ROLE[type] : 'Unlocks after ' + Progress.levelName(UNLOCKS[type].at) + '.';
      if (!compact || !unlocked) add(UI.text(this, lx, y + (compact ? 38 : 48), role, 'small', { size: 12, wrap: w - 140, color: unlocked ? UI.T.mute : UI.T.faint }));

      // Stat row
      const stats = type === 'barricade' ? [['SLOW', Math.round((1 - d.slowAmount) * 100) + '%'], ['RANGE', d.range]]
        : type === 'siphon' ? [['DRAIN', d.dps + '/s'], ['RANGE', d.range], ['BEAMS', d.beams]]
        : [['DAMAGE', d.damage], ['RANGE', d.range], ['RATE', (1000 / d.fireRate).toFixed(1) + '/s']];
      if (unlocked || !compact) stats.forEach(([k, v], i) => {
        const sx = lx + i * 80;
        add(UI.text(this, sx, y + h - 50, k, 'label', { size: 10, color: unlocked ? UI.T.mute : UI.T.faint }));
        add(UI.text(this, sx, y + h - 34, String(v), 'number', { size: 17, color: unlocked ? UI.T.text : UI.T.faint }));
      });

      // Count + sell
      const rx = width - 16 - 54;
      add(UI.text(this, rx, y + (compact ? 26 : 40), String(count), 'number', { size: compact ? 28 : 34, origin: 0.5, color: count > 0 ? UI.hex(d.colour) : UI.T.faint }));
      add(UI.text(this, rx, y + (compact ? 48 : 66), 'IN STOCK', 'label', { size: 10, origin: 0.5 }));
      const nut = TOWER_SELL_VALUE[type] || 1;
      const sell = add(UI.button(this, rx, y + h - (compact ? 28 : 34), 84, compact ? 34 : 38, {
        label: 'SELL +' + nut, variant: 'outline', colour: UI.C.amber, size: 13, disabled: count === 0,
        onTap: () => this.confirmSell(type)
      }));
      sell.setEnabled(count > 0);
      y += h + (compact ? 8 : 12);
    });

    const total = Object.values(stockpile).reduce((a, b) => a + b, 0);
    if (total === 0) {
      this.cardItems.push(UI.text(this, width / 2, y + 20, 'No towers yet — build them in the Factory.', 'body', { origin: 0.5, size: 13, color: UI.T.mute }));
    }
    if (this.dockBtn) this.dockBtn.setEnabled(total > 0);
  }

  titleCase(str) { return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()).replace(/\bIi\b/g, 'II'); }

  confirmSell(type) {
    const nut = TOWER_SELL_VALUE[type] || 1;
    UI.modal(this, {
      title: 'Sell a ' + this.titleCase(TOWER_DATA[type].name) + '?',
      body: 'You get ' + nut + ' nut' + (nut === 1 ? '' : 's') + '. Nuts can be traded for bolts at the Market, which buy upgrades in the Uplink.',
      icon: 'nut', accent: UI.C.amber,
      buttons: [{ label: 'CANCEL' }, { label: 'SELL', variant: 'primary', onTap: () => this.executeSell(type) }]
    });
  }

  executeSell(type) {
    const stockpile = this.saveData.stockpile || {};
    if (!stockpile[type] || stockpile[type] <= 0) return;

    const nutValue = TOWER_SELL_VALUE[type] || 1;
    // Apply to the latest stored save, not just this scene's snapshot
    this.saveData = SaveManager.update(s => {
      if (!s.stockpile) s.stockpile = {};
      s.stockpile[type] = Math.max(0, (s.stockpile[type] || 0) - 1);
      s.nuts = (s.nuts || 0) + nutValue;
    }) || this.saveData;

    this.hdr.chips.nuts.setValue(this.saveData.nuts).pulse();
    this.drawTowerCards();
    UI.toast(this, '+' + nutValue + ' nut' + (nutValue === 1 ? '' : 's'), 'good');
  }
}
