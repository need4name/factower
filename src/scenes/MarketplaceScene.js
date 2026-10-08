// ── MarketplaceScene.js ───────────────────────────────────────────────────────
class MarketplaceScene extends Phaser.Scene {
  constructor() { super({ key: 'MarketplaceScene' }); }

  create() {
    const { width, height } = this.scale;
    this.saveData = SaveManager.load() || {};
    if (!this.saveData.nuts)            this.saveData.nuts = 0;
    if (!this.saveData.bolts)           this.saveData.bolts = 0;
    if (!this.saveData.merchantFatigue) this.saveData.merchantFatigue = { chrome: 0, ricochet: 0, doubleDown: 0 };
    UI.backdrop(this);
    UI.fadeIn(this);

    UI.header(this, {
      title: 'MARKET', sub: 'MERCHANT GUILD', accent: UI.C.purple,
      onBack: () => UI.go(this, 'BaseScene'),
      chips: [{ kind: 'nuts', value: this.saveData.nuts }, { kind: 'bolts', value: this.saveData.bolts }]
    });

    // How the economy works, in one line
    UI.text(this, 16, UI.HEADER_H + 22, 'Stake nuts with a merchant for a chance at bolts. Bolts buy permanent upgrades in the Uplink.',
      'body', { size: 13, wrap: width - 32, color: UI.T.mute });

    const fat = this.saveData.merchantFatigue;
    const merchants = [
      { name: 'Chrome', tag: 'THE SLOTS', colour: UI.C.amber, fatigue: fat.chrome, scene: 'ChromeScene',
        desc: 'Spin three reels. Match symbols to win bolts.' },
      { name: 'Ricochet', tag: 'THE BOARD', colour: UI.C.green, fatigue: fat.ricochet, scene: 'RicochetScene',
        desc: 'Aim a ball through the pegs. More hits, more bolts.' },
      { name: 'Double-Down', tag: 'PRESS YOUR LUCK', colour: UI.C.red, fatigue: fat.doubleDown, scene: 'DoubleDownScene',
        desc: 'Roll dice, bank points — or push your luck and lose it all.' }
    ];
    let y = UI.HEADER_H + 84;
    merchants.forEach(m => { this.drawCard(m, y); y += 132; });

    UI.text(this, width / 2, height - 30, 'Merchants tire of you the more you play. They recover after every battle you win.', 'small',
      { origin: 0.5, size: 11, color: UI.T.faint, wrap: width - 40, align: 'center' });
  }

  fatLabel(f) {
    if (f === 0) return ['FRESH', UI.T.green];
    if (f < 6)   return ['WARM',  UI.T.amber];
    if (f < 14)  return ['TIRED', '#d98a3a'];
    return             ['BURNT', UI.T.red];
  }

  drawCard(m, top) {
    const { width } = this.scale;
    const w = width - 32, h = 118, cy = top + h / 2, lx = 16 + 20;
    const panel = UI.panel(this, width / 2, cy, w, h, { fill: UI.C.surface, stroke: m.colour, strokeAlpha: 0.45, accent: m.colour, radius: 16 });
    UI.text(this, lx, top + 18, m.tag, 'tag', { size: 11, color: UI.hex(m.colour) });
    UI.text(this, lx, top + 36, m.name, 'title', { size: 22 });
    UI.text(this, lx, top + 70, m.desc, 'small', { size: 12, wrap: w - 110 });
    const [ft, fc] = this.fatLabel(m.fatigue || 0);
    UI.text(this, width - 16 - 18, top + 22, ft, 'tag', { size: 10, origin: [1, 0.5], color: fc });
    UI.icon(this, width - 16 - 24, cy + 6, 'chevron', 14, m.colour);

    const zone = this.add.zone(width / 2, cy, w, h).setInteractive();
    let pressed = false;
    zone.on('pointerdown', () => { pressed = true; panel.setAlpha(0.8); });
    zone.on('pointerout',  () => { pressed = false; panel.setAlpha(1); });
    zone.on('pointerup',   () => { panel.setAlpha(1); if (pressed) UI.go(this, m.scene); pressed = false; });
  }
}
