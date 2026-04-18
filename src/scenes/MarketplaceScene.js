// ── MarketplaceScene.js ───────────────────────────────────────────────────────
// Merchant Guild hub. Shows Chrome (playable) + 2 locked mystery slots.

class MarketplaceScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MarketplaceScene' });
  }

  create() {
    const { width, height } = this.scale;

    const slotIndex    = localStorage.getItem('factower_active_slot');
    this.saveKey       = `factower_save_${slotIndex}`;
    this.saveData      = JSON.parse(localStorage.getItem(this.saveKey)) || {};

    if (!this.saveData.nuts)            this.saveData.nuts = 0;
    if (!this.saveData.bolts)           this.saveData.bolts = 0;
    if (!this.saveData.merchantFatigue) this.saveData.merchantFatigue = { chrome: 0, ricochet: 0, doubleDown: 0 };

    // ── Background ────────────────────────────────────────────────────────
    this.add.rectangle(width / 2, height / 2, width, height, 0x0d1117);

    // ── Header ────────────────────────────────────────────────────────────
    this.add.rectangle(width / 2, 144, width, 100, 0x161b22);
    this.add.rectangle(width / 2, 194, width, 1, 0x334455);

    const backBtn = this.add.rectangle(44, 144, 72, 48, 0x1e2530).setInteractive();
    this.add.text(44, 144, '<- BACK', {
      fontFamily: 'monospace', fontSize: '14px', color: '#e8a020'
    }).setOrigin(0.5);
    backBtn.on('pointerdown', () => {
      this.cameras.main.fade(200, 0, 0, 0);
      this.time.delayedCall(200, () => this.scene.start('BaseScene'));
    });
    backBtn.on('pointerover', () => backBtn.setFillStyle(0x252c38));
    backBtn.on('pointerout',  () => backBtn.setFillStyle(0x1e2530));

    this.add.text(width / 2 + 20, 128, 'MERCHANT GUILD', {
      fontFamily: 'monospace', fontSize: '22px', color: '#eef2f8', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.add.text(width / 2 + 20, 152, 'TRADE NUTS FOR BOLTS', {
      fontFamily: 'monospace', fontSize: '11px', color: '#8899aa', letterSpacing: 2
    }).setOrigin(0.5);

    // Currency strip
    this._drawCurrencyStrip(width, 178);

    // ── Merchant list ─────────────────────────────────────────────────────
    this.add.text(24, 214, 'MERCHANTS', {
      fontFamily: 'monospace', fontSize: '12px', color: '#8899aa', letterSpacing: 3
    });
    this.add.rectangle(width / 2, 232, width - 48, 1, 0x334455);

    // Chrome — available
    this._drawMerchantCard(width, 310, {
      name:     'CHROME',
      tagline:  'THE SLOTS',
      colour:   0xe8a020,
      colourHex:'#e8a020',
      fatigue:  this.saveData.merchantFatigue.chrome || 0,
      unlocked: true,
      key:      'chrome'
    });

    // Slot 2 — locked mystery
    this._drawLockedSlot(width, 440, 2);

    // Slot 3 — locked mystery
    this._drawLockedSlot(width, 560, 3);

    // Footer note
    this.add.text(width / 2, height - 60, 'MORE MERCHANTS UNLOCK AS YOU PROGRESS', {
      fontFamily: 'monospace', fontSize: '10px', color: '#2a3a4a', letterSpacing: 2
    }).setOrigin(0.5);
  }

  _drawCurrencyStrip(width, y) {
    this.nutsText  = this.add.text(80, y, `${this.saveData.nuts} NUTS`, {
      fontFamily: 'monospace', fontSize: '12px', color: '#e8a020', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.add.text(width / 2, y, '·', {
      fontFamily: 'monospace', fontSize: '12px', color: '#334455'
    }).setOrigin(0.5);
    this.boltsText = this.add.text(width - 80, y, `${this.saveData.bolts} BOLTS`, {
      fontFamily: 'monospace', fontSize: '12px', color: '#8ab4cc', fontStyle: 'bold'
    }).setOrigin(0.5);
  }

  _drawMerchantCard(width, y, cfg) {
    const cardW = width - 48;
    const cardH = 108;

    const bg  = this.add.rectangle(width / 2, y, cardW, cardH, 0x161b22).setInteractive();
    const bdr = this.add.rectangle(width / 2, y, cardW, cardH).setStrokeStyle(1, cfg.colour);
    this.add.rectangle(28, y, 6, cardH - 20, cfg.colour);

    this.add.text(50, y - 30, cfg.name, {
      fontFamily: 'monospace', fontSize: '20px', color: '#eef2f8', fontStyle: 'bold'
    });
    this.add.text(50, y - 6, cfg.tagline, {
      fontFamily: 'monospace', fontSize: '11px', color: cfg.colourHex, letterSpacing: 2
    });

    // Fatigue indicator
    const fatigueLabel = cfg.fatigue === 0 ? 'FRESH' :
      cfg.fatigue < 5  ? 'WARM'  :
      cfg.fatigue < 12 ? 'TIRED' : 'BURNT';
    const fatigueCol = cfg.fatigue === 0 ? '#5eba7d' :
      cfg.fatigue < 5  ? '#e8a020' :
      cfg.fatigue < 12 ? '#c47a20' : '#c43a3a';

    this.add.text(50, y + 16, `FATIGUE: ${fatigueLabel}`, {
      fontFamily: 'monospace', fontSize: '10px', color: fatigueCol, letterSpacing: 1
    });

    this.add.text(width - 32, y, '→', {
      fontFamily: 'monospace', fontSize: '22px', color: cfg.colourHex
    }).setOrigin(0.5);

    bg.on('pointerdown', () => {
      this.cameras.main.flash(150, 0, 0, 0);
      this.time.delayedCall(150, () => this.scene.start('ChromeScene'));
    });
    bg.on('pointerover', () => bg.setFillStyle(0x1e2530));
    bg.on('pointerout',  () => bg.setFillStyle(0x161b22));
  }

  _drawLockedSlot(width, y, slotNum) {
    const cardW = width - 48;
    const cardH = 88;

    this.add.rectangle(width / 2, y, cardW, cardH, 0x0f1318);
    this.add.rectangle(width / 2, y, cardW, cardH).setStrokeStyle(1, 0x1e2a38);

    this.add.text(width / 2, y - 12, `MERCHANT SLOT ${slotNum}`, {
      fontFamily: 'monospace', fontSize: '13px', color: '#2a3a4a', fontStyle: 'bold', letterSpacing: 3
    }).setOrigin(0.5);
    this.add.text(width / 2, y + 10, 'LOCKED — PROGRESS THE STORY', {
      fontFamily: 'monospace', fontSize: '9px', color: '#1e2a38', letterSpacing: 2
    }).setOrigin(0.5);

    // Three question mark icons
    [-40, 0, 40].forEach(ox => {
      this.add.text(width / 2 + ox, y - 12, '?', {
        fontFamily: 'monospace', fontSize: '16px', color: '#1e2a38', fontStyle: 'bold'
      }).setOrigin(0.5);
    });
  }
}
