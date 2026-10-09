// ── MarketplaceScene.js ───────────────────────────────────────────────────────
// The Merchant Guild. Sell spare towers for nuts at the trade counter, then
// stake nuts with a merchant for a chance at bolts. Merchants join as the
// story progresses (see Merchants.js).
class MarketplaceScene extends Phaser.Scene {
  constructor() { super({ key: 'MarketplaceScene' }); }

  create() {
    const { width, height } = this.scale;
    this.saveData = SaveManager.load() || {};
    if (!this.saveData.nuts)  this.saveData.nuts = 0;
    if (!this.saveData.bolts) this.saveData.bolts = 0;
    this.tradeItems = [];
    UI.backdrop(this);
    UI.fadeIn(this);

    this.hdr = UI.header(this, {
      title: 'MARKET', sub: 'MERCHANT GUILD', accent: UI.C.purple,
      onBack: () => UI.go(this, 'BaseScene'),
      chips: [{ kind: 'nuts', value: this.saveData.nuts }, { kind: 'bolts', value: this.saveData.bolts }]
    });

    UI.text(this, 16, UI.HEADER_H + 16, 'Sell spare towers for nuts. Stake nuts with a merchant to win bolts — bolts buy upgrades in the Uplink.',
      'body', { size: 13, wrap: width - 32, color: UI.T.mute });

    const met = (this.saveData.flags && this.saveData.flags.merchantsMet) || {};
    let y = UI.HEADER_H + 64;
    Merchants.list().forEach(m => {
      this.drawCard(m, y, Merchants.isRecruited(this.saveData, m.id), !met[m.id]);
      y += 112;
    });

    this.tradeTop = y + 8;
    this.drawTradeCounter();

    UI.text(this, width / 2, height - 26, 'Merchants tire of you the more you play. They rest after every battle you win.', 'small',
      { origin: 0.5, size: 11, color: UI.T.faint, wrap: width - 40, align: 'center' });
  }

  drawCard(m, top, recruited, isNew) {
    const { width } = this.scale;
    const w = width - 32, h = 102, cy = top + h / 2, lx = 16 + 20;

    if (!recruited) {
      UI.panel(this, width / 2, cy, w, h, { fill: 0x10151c, stroke: UI.C.lineSoft, radius: 16 });
      UI.icon(this, lx + 10, cy - 14, 'lock', 16, 0x465163);
      UI.text(this, lx + 30, cy - 14, '???', 'title', { size: 20, origin: [0, 0.5], color: UI.T.faint });
      const lvl = LEVEL_DATA.storylines[0].levels.find(l => l.id === m.recruitLevel);
      UI.text(this, lx, cy + 18, 'A new merchant arrives after Level ' + m.recruitLevel + (lvl ? ' — ' + this.titleCase(lvl.name) : '') + '.',
        'small', { size: 12, origin: [0, 0.5], wrap: w - 40, color: UI.T.faint });
      return;
    }

    const fx = Merchants.effects(this.saveData);
    const fatigue = Merchants.fatigue(this.saveData, m.id);
    const md = Merchants.mood(m.id, fatigue, fx);
    const panel = UI.panel(this, width / 2, cy, w, h, { fill: UI.C.surface, stroke: m.colour, strokeAlpha: 0.45, accent: m.colour, radius: 16 });
    UI.text(this, lx, top + 16, m.tag, 'tag', { size: 11, color: UI.hex(m.colour) });
    const nameT = UI.text(this, lx, top + 32, m.name, 'title', { size: 22 });
    UI.text(this, lx, top + 64, m.desc, 'small', { size: 12, wrap: w - 120 });
    UI.text(this, width - 16 - 18, top + 22, md.label, 'tag', { size: 10, origin: [1, 0.5], color: UI.hex(md.colour) });
    UI.text(this, width - 16 - 18, top + 40, Merchants.cost(m.id, fatigue, fx) + ' nuts / ' + m.unit.toLowerCase(), 'small',
      { size: 11, origin: [1, 0.5], color: UI.T.dim });
    UI.icon(this, width - 16 - 24, cy + 22, 'chevron', 14, m.colour);
    if (isNew) {
      const badge = UI.text(this, lx + nameT.width + 10, top + 45, 'NEW', 'tag', { size: 11, origin: [0, 0.5], color: UI.T.green });
      this.tweens.add({ targets: badge, alpha: 0.35, duration: 650, yoyo: true, repeat: -1 });
    }

    const zone = this.add.zone(width / 2, cy, w, h).setInteractive();
    let pressed = false;
    zone.on('pointerdown', () => { pressed = true; panel.setAlpha(0.8); });
    zone.on('pointerout',  () => { pressed = false; panel.setAlpha(1); });
    zone.on('pointerup',   () => { panel.setAlpha(1); if (pressed) UI.go(this, m.scene); pressed = false; });
  }

  // ── Trade counter: sell towers for nuts ─────────────────────────────────
  drawTradeCounter() {
    const { width } = this.scale;
    this.tradeItems.forEach(e => e.destroy());
    this.tradeItems = [];
    const add = (o) => { this.tradeItems.push(o); return o; };
    const stock = this.saveData.stockpile || {};
    const types = ['gunner', 'bomber', 'barricade'].filter(t => t === 'gunner' || (stock[t] || 0) > 0 ||
      Merchants.completed(this.saveData).includes(2));
    const top = this.tradeTop, rowH = 50, w = width - 32;
    const h = 44 + types.length * rowH + 6;

    add(UI.panel(this, width / 2, top + h / 2, w, h, { fill: UI.C.surface, stroke: UI.C.line, radius: 16 }));
    add(UI.text(this, 36, top + 22, 'TRADE COUNTER', 'tag', { size: 11, origin: [0, 0.5], color: UI.T.amber }));
    add(UI.text(this, width - 36, top + 22, 'Towers you sell are gone for good', 'small', { size: 11, origin: [1, 0.5], color: UI.T.faint }));

    types.forEach((type, i) => {
      const d = TOWER_DATA[type], n = stock[type] || 0, nut = TOWER_SELL_VALUE[type] || 1;
      const ry = top + 44 + i * rowH + rowH / 2;
      if (i > 0) add(this.add.rectangle(width / 2, ry - rowH / 2, w - 32, 1, UI.C.lineSoft));
      const disc = add(this.add.graphics());
      disc.fillStyle(d.colour, n > 0 ? 1 : 0.3);
      disc.fillCircle(44, ry, 7);
      add(UI.text(this, 60, ry, this.titleCase(d.name), 'heading', { size: 16, origin: [0, 0.5], color: n > 0 ? UI.T.text : UI.T.faint }));
      add(UI.text(this, 172, ry, '×' + n + ' in stock', 'small', { size: 12, origin: [0, 0.5], color: n > 0 ? UI.T.dim : UI.T.faint }));
      const b = add(UI.button(this, width - 16 - 16 - 48, ry, 96, 38, {
        label: 'SELL +' + nut, variant: 'outline', colour: UI.C.amber, size: 13, disabled: n === 0,
        onTap: () => this.sell(type)
      }));
      b.setEnabled(n > 0);
    });
  }

  sell(type) {
    const stock = this.saveData.stockpile || {};
    if (!stock[type]) return;
    const nut = TOWER_SELL_VALUE[type] || 1;
    // The last tower is easy to sell by accident and costs a factory run to replace
    const total = Object.values(stock).reduce((a, b) => a + b, 0);
    const doSell = () => {
      this.saveData = SaveManager.update(s => {
        if (!s.stockpile) s.stockpile = {};
        if (!s.stockpile[type]) return;
        s.stockpile[type] -= 1;
        s.nuts = (s.nuts || 0) + nut;
      }) || this.saveData;
      this.hdr.chips.nuts.setValue(this.saveData.nuts).pulse();
      this.drawTradeCounter();
      UI.toast(this, '+' + nut + ' nut' + (nut === 1 ? '' : 's'), 'good');
    };
    if (total > 1) return doSell();
    UI.modal(this, {
      title: 'Sell your last tower?', icon: 'nut', accent: UI.C.amber,
      body: 'You won\'t have any towers left for the next battle. You can build more in the Factory.',
      buttons: [{ label: 'KEEP IT' }, { label: 'SELL', variant: 'primary', onTap: doSell }]
    });
  }

  titleCase(str) { return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()); }
}
