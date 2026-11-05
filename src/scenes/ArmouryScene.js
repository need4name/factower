// Nut values per tower type (tune later).
const TOWER_SELL_VALUE = {
  gunner:    1,
  gunner2:   3,
  siphon:    3,
  harpoon:   4,
  cannon:    4,
  bomber:    2,
  barricade: 2
};

// What a tower sells for right now: base value × Economy-branch upgrades
// (Market Knowledge, Sharp Trader, Premium Goods, Market Tycoon)
function towerSellValue(type) {
  return Math.max(1, Math.round((TOWER_SELL_VALUE[type] || 1) * skillTreeEffects.getSellPriceMult() * skillTreeEffects.getNutsMult()));
}

// One-line role description per tower, shown wherever towers are listed.
const TOWER_ROLE = {
  gunner:    'Fast single-target shots. Your bread and butter.',
  bomber:    'Slow, heavy shells that hit everything in a blast.',
  barricade: 'Deals no damage — slows every raider in its field.',
  gunner2:   'Tier 2 Gunner. Heavier rounds and longer reach.',
  siphon:    'Drains raiders with a beam. Kills drop double salvage, auto-collected.',
  harpoon:   'Long-range bolt that pierces armour and reels raiders in.',
  cannon:    'Sprays raiders back up the road. Strips shields fast.'
};

class ArmouryScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ArmouryScene' });
  }

  create() {
    const { width, height } = this.scale;
    this.saveData = applyTestStock() || SaveManager.load() || {};
    if (this.saveData.nuts === undefined) this.saveData.nuts = 0;
    skillTreeEffects.rebuildFromSaveData(this.saveData);
    UI.backdrop(this);
    UI.fadeIn(this);
    Art.ensure(this);

    this.hdr = UI.header(this, {
      title: 'ARMOURY', sub: 'TOWERS READY FOR BATTLE', accent: UI.C.green,
      onBack: () => UI.go(this, 'BaseScene'),
      chips: [{ kind: 'nuts', value: this.saveData.nuts }]
    });

    // Phaser reuses this scene object between visits — clear references to
    // the previous visit's (destroyed) objects before anything touches them.
    this.cardItems = [];
    this.dockBtn = null;
    this.listC = null; this.listY = 0; this.listMin = 0;   // scrolling list
    this.drawTowerCards();
    this.enableListScroll();

    const by = height - 46;
    UI.button(this, 16 + 76, by, 152, 52, { label: 'BUILD MORE', variant: 'secondary', icon: 'factory', onTap: () => UI.go(this, 'FactoryScene') });
    this.dockBtn = UI.button(this, width - 16 - (width - 32 - 164) / 2, by, width - 32 - 164, 52, {
      label: 'TO THE DOCK', variant: 'primary', colour: UI.C.red, icon: 'anchor', onTap: () => UI.go(this, 'DockScene')
    });
  }

  drawTowerCards() {
    const { width } = this.scale;
    const stockpile = this.saveData.stockpile || {};
    if (this.listC) { this.listC.destroy(); this.listC = null; }
    this.cardItems = [];

    // Unlocked towers, plus a preview of the next one still to unlock
    const isOpen = t => t === 'gunner' || Progress.has(this.saveData, t) || (stockpile[t] || 0) > 0;
    const shown = TOWER_ORDER.filter(isOpen);
    const nextLocked = TOWER_ORDER.find(t => !isOpen(t));
    if (nextLocked) shown.push(nextLocked);
    const compact = shown.length > 3;
    const w = width - 32, h = compact ? 108 : 150;
    let y = UI.HEADER_H + (compact ? 12 : 20);
    if (Contracts.open(this.saveData)) y = this.drawContracts(y);
    shown.forEach(type => {
      const d = TOWER_DATA[type];
      const count = stockpile[type] || 0;
      const unlocked = isOpen(type);
      const cy = y + h / 2;
      // Tower art on the left of the card, the text beside it
      const ax = 16 + 34, ay = y + (compact ? 34 : 44), sc = compact ? 1 : 1.25;
      const art = Art.tower(this, ax, ay, type);
      art.base.setScale(sc / Art.RES).setDepth(1); art.head.setScale(sc / Art.RES).setRotation(-Math.PI / 2).setDepth(1);
      if (!unlocked) [art.base, art.head].forEach(o => o.setTint(0x3a424e).setAlpha(0.7));
      this.cardItems.push(art.base, art.head);
      const lx = 16 + 68;
      const add = (o) => { this.cardItems.push(o); return o; };

      add(UI.panel(this, width / 2, cy, w, h, {
        fill: UI.C.surface, stroke: count > 0 ? d.colour : UI.C.lineSoft, strokeAlpha: count > 0 ? 0.5 : 1,
        accent: unlocked ? d.colour : undefined, radius: 16
      }));
      add(UI.text(this, lx, y + (compact ? 12 : 18), this.titleCase(d.name), 'title', { size: compact ? 19 : 22, color: unlocked ? UI.T.text : UI.T.faint }));
      const role = unlocked ? TOWER_ROLE[type] : 'Unlocks after ' + Progress.levelName(UNLOCKS[type].at) + '.';
      if (!compact || !unlocked) add(UI.text(this, lx, y + (compact ? 38 : 48), role, 'small', { size: 12, wrap: w - 190, color: unlocked ? UI.T.mute : UI.T.faint }));

      // Stat row
      const stats = type === 'barricade' ? [['SLOW', Math.round((1 - d.slowAmount) * 100) + '%'], ['RANGE', d.range]]
        : type === 'siphon' ? [['DRAIN', d.dps + '/s'], ['RANGE', d.range], ['BEAMS', d.beams]]
        : type === 'cannon' ? [['PUSH', d.push], ['RANGE', d.range], ['SHIELD', '\u00d7' + d.shieldX]]
        : [['DAMAGE', d.damage], ['RANGE', d.range], ['RATE', (1000 / d.fireRate).toFixed(1) + '/s']];
      if (unlocked || !compact) stats.forEach(([k, v], i) => {
        const sx = lx + i * 66;
        add(UI.text(this, sx, y + h - 50, k, 'label', { size: 10, color: unlocked ? UI.T.mute : UI.T.faint }));
        add(UI.text(this, sx, y + h - 34, String(v), 'number', { size: 17, color: unlocked ? UI.T.text : UI.T.faint }));
      });

      // Count + sell
      const rx = width - 16 - 54;
      add(UI.text(this, rx, y + (compact ? 26 : 40), String(count), 'number', { size: compact ? 28 : 34, origin: 0.5, color: count > 0 ? UI.hex(d.colour) : UI.T.faint }));
      add(UI.text(this, rx, y + (compact ? 48 : 66), 'IN STOCK', 'label', { size: 10, origin: 0.5 }));
      const nut = towerSellValue(type);
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

    // Everything above scrolls between the header and the bottom buttons
    const { height } = this.scale;
    const top = UI.HEADER_H, bottom = height - 80;
    this.listC = this.add.container(0, 0, this.cardItems);
    this.listC.sort('depth');   // tower art sits above its card
    const m = this.make.graphics({}, false); m.fillStyle(0xffffff); m.fillRect(0, top, width, bottom - top);
    this.listC.setMask(m.createGeometryMask());
    this.listMin = Math.min(0, bottom - (y + 12));
    this.listY = Phaser.Math.Clamp(this.listY || 0, this.listMin, 0);
    this.listC.setY(this.listY);
  }

  enableListScroll() {
    const top = UI.HEADER_H, bottom = this.scale.height - 80;
    let start = null, base = 0;
    this.input.on('pointerdown', p => { if (p.y > top && p.y < bottom) { start = p.y; base = this.listY; } });
    this.input.on('pointermove', p => {
      if (start === null || !p.isDown || !this.listC) return;
      if (Math.abs(p.y - start) < 8) return;
      this.listY = Phaser.Math.Clamp(base + p.y - start, this.listMin, 0);
      this.listC.setY(this.listY);
    });
    this.input.on('pointerup', () => { start = null; });
    this.input.on('wheel', (p, o, dx, dy) => { if (!this.listC) return; this.listY = Phaser.Math.Clamp(this.listY - dy, this.listMin, 0); this.listC.setY(this.listY); });
  }

  // ── Contracts: standing orders for towers, paid in bolts ──────────────
  drawContracts(y) {
    const { width } = this.scale;
    const add = (o) => { this.cardItems.push(o); return o; };
    const st = Contracts.state(this.saveData);
    add(UI.text(this, 20, y + 8, 'CONTRACTS', 'tag', { size: 11, origin: [0, 0.5], color: UI.T.amber }));
    add(UI.text(this, width - 20, y + 8, 'New orders arrive after each win', 'small', { size: 11, origin: [1, 0.5], color: UI.T.mute }));
    y += 22;
    st.items.forEach((o, i) => {
      const h = 78, cy = y + h / 2;
      add(UI.panel(this, width / 2, cy, width - 32, h, { fill: UI.C.surface, stroke: o ? UI.C.amber : UI.C.lineSoft, strokeAlpha: o ? 0.5 : 1, accent: o ? UI.C.amber : undefined, radius: 14 }));
      if (!o) {
        add(UI.text(this, width / 2, cy, 'Order filled \u2014 a new one comes in after your next win', 'small', { size: 12, origin: 0.5, color: UI.T.faint }));
        y += h + 8; return;
      }
      const stock = this.saveData.stockpile || {};
      const want = Object.entries(o.want).map(([t, c]) => c + ' ' + (TOWER_DATA[t].short || this.titleCase(TOWER_DATA[t].name)) + ((stock[t] || 0) < c ? ' (' + (stock[t] || 0) + ')' : '')).join('  \u00b7  ');
      const pay = [o.bolts + ' bolt' + (o.bolts === 1 ? '' : 's'), o.plasticScrap ? o.plasticScrap + ' scrap' : '', o.salvagedMetal ? o.salvagedMetal + ' metal' : ''].filter(Boolean).join(' + ');
      add(UI.text(this, 32, y + 16, o.client, 'heading', { size: 15, origin: [0, 0.5] }));
      add(UI.text(this, 32, y + 39, 'Wants ' + want, 'small', { size: 12, origin: [0, 0.5], wrap: width - 170, color: UI.T.mute }));
      add(UI.text(this, 32, y + 60, 'Pays ' + pay, 'label', { size: 11, origin: [0, 0.5], color: UI.T.amber }));
      const ok = Contracts.canFill(this.saveData, i);
      const b = add(UI.button(this, width - 16 - 56, cy, 92, 40, { label: 'DELIVER', variant: ok ? 'primary' : 'outline', colour: UI.C.amber, size: 13, disabled: !ok,
        onTap: () => this.deliver(i) }));
      b.setEnabled(ok);
      y += h + 8;
    });
    add(UI.text(this, 20, y + 8, 'YOUR TOWERS', 'tag', { size: 11, origin: [0, 0.5], color: UI.T.green }));
    return y + 24;
  }

  deliver(i) {
    const { save, paid } = Contracts.fill(i);
    if (!paid) return;
    this.saveData = save;
    Sfx.play('coin');
    UI.toast(this, 'Delivered! +' + paid.bolts + ' bolt' + (paid.bolts === 1 ? '' : 's'), 'good');
    this.drawTowerCards();
  }

  titleCase(str) { return UI.titleCase(str); }

  confirmSell(type) {
    const nut = towerSellValue(type);
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

    const nutValue = towerSellValue(type);
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
