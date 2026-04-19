// ── MarketplaceScene.js ───────────────────────────────────────────────────────
class MarketplaceScene extends Phaser.Scene {
  constructor() { super({ key: 'MarketplaceScene' }); }

  create() {
    const { width, height } = this.scale;
    const slotIndex   = localStorage.getItem('factower_active_slot');
    this.saveKey      = `factower_save_${slotIndex}`;
    this.saveData     = JSON.parse(localStorage.getItem(this.saveKey)) || {};
    if (!this.saveData.nuts)            this.saveData.nuts = 0;
    if (!this.saveData.bolts)           this.saveData.bolts = 0;
    if (!this.saveData.merchantFatigue) this.saveData.merchantFatigue = { chrome: 0, ricochet: 0, doubleDown: 0 };

    this.add.rectangle(width / 2, height / 2, width, height, 0x0d1117);
    this.add.rectangle(width / 2, 144, width, 100, 0x161b22);
    this.add.rectangle(width / 2, 194, width, 1, 0x334455);

    const back = this.add.rectangle(44, 144, 72, 48, 0x1e2530).setInteractive();
    this.add.text(44, 144, '<- BACK', { fontFamily: 'monospace', fontSize: '14px', color: '#e8a020' }).setOrigin(0.5);
    back.on('pointerdown', () => { this.cameras.main.fade(200, 0, 0, 0); this.time.delayedCall(200, () => this.scene.start('BaseScene')); });
    back.on('pointerover', () => back.setFillStyle(0x252c38));
    back.on('pointerout',  () => back.setFillStyle(0x1e2530));

    this.add.text(width / 2 + 20, 128, 'MERCHANT GUILD', { fontFamily: 'monospace', fontSize: '22px', color: '#eef2f8', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(width / 2 + 20, 152, 'TRADE NUTS FOR BOLTS', { fontFamily: 'monospace', fontSize: '11px', color: '#8899aa', letterSpacing: 2 }).setOrigin(0.5);

    // Currency strip
    this.add.text(80, 178, `${this.saveData.nuts} NUTS`, { fontFamily: 'monospace', fontSize: '12px', color: '#e8a020', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(width / 2, 178, '·', { fontFamily: 'monospace', fontSize: '12px', color: '#334455' }).setOrigin(0.5);
    this.add.text(width - 80, 178, `${this.saveData.bolts} BOLTS`, { fontFamily: 'monospace', fontSize: '12px', color: '#8ab4cc', fontStyle: 'bold' }).setOrigin(0.5);

    this.add.text(24, 212, 'MERCHANTS', { fontFamily: 'monospace', fontSize: '12px', color: '#8899aa', letterSpacing: 3 });
    this.add.rectangle(width / 2, 230, width - 48, 1, 0x334455);

    const fat = this.saveData.merchantFatigue;

    this._drawCard(width, 306, {
      name: 'CHROME', tagline: 'THE SLOTS', colour: 0xe8a020, colourHex: '#e8a020',
      fatigue: fat.chrome, scene: 'ChromeScene',
      desc: 'Match symbols across 3 reels'
    });
    this._drawCard(width, 426, {
      name: 'RICOCHET', tagline: 'THE PLINKO BOARD', colour: 0x5eba7d, colourHex: '#5eba7d',
      fatigue: fat.ricochet, scene: 'RicochetScene',
      desc: 'Drop the ball, aim for the edge'
    });
    this._drawCard(width, 546, {
      name: 'DOUBLE-DOWN', tagline: 'PRESS YOUR LUCK', colour: 0xc43a3a, colourHex: '#c43a3a',
      fatigue: fat.doubleDown, scene: 'DoubleDownScene',
      desc: 'Farkle dice with mod chips'
    });

    this.add.text(width / 2, height - 52, 'FATIGUE RESETS EACH SESSION', {
      fontFamily: 'monospace', fontSize: '9px', color: '#2a3a4a', letterSpacing: 2
    }).setOrigin(0.5);
  }

  _fatLabel(f) {
    if (f === 0) return ['FRESH', '#5eba7d'];
    if (f < 6)   return ['WARM',  '#e8a020'];
    if (f < 14)  return ['TIRED', '#c47a20'];
    return             ['BURNT', '#c43a3a'];
  }

  _drawCard(width, y, cfg) {
    const cardW = width - 48, cardH = 100;
    const bg = this.add.rectangle(width / 2, y, cardW, cardH, 0x161b22).setInteractive();
    this.add.rectangle(width / 2, y, cardW, cardH).setStrokeStyle(1, cfg.colour);
    this.add.rectangle(28, y, 6, cardH - 20, cfg.colour);
    this.add.text(50, y - 28, cfg.name, { fontFamily: 'monospace', fontSize: '18px', color: '#eef2f8', fontStyle: 'bold' });
    this.add.text(50, y - 6,  cfg.tagline, { fontFamily: 'monospace', fontSize: '10px', color: cfg.colourHex, letterSpacing: 2 });
    this.add.text(50, y + 14, cfg.desc, { fontFamily: 'monospace', fontSize: '10px', color: '#8899aa' });

    const [fatTxt, fatCol] = this._fatLabel(cfg.fatigue);
    this.add.text(width - 32, y - 16, fatTxt, { fontFamily: 'monospace', fontSize: '10px', color: fatCol, fontStyle: 'bold' }).setOrigin(1, 0.5);
    this.add.text(width - 32, y,      '→',    { fontFamily: 'monospace', fontSize: '20px', color: cfg.colourHex }).setOrigin(0.5);

    bg.on('pointerdown', () => {
      this.cameras.main.flash(150, 0, 0, 0);
      this.time.delayedCall(150, () => this.scene.start(cfg.scene));
    });
    bg.on('pointerover', () => bg.setFillStyle(0x1e2530));
    bg.on('pointerout',  () => bg.setFillStyle(0x161b22));
  }
}
