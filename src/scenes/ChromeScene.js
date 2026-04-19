// ── ChromeScene.js ────────────────────────────────────────────────────────────
const CHROME_SYMBOLS = [
  { glyph: '★', weight: 5  },
  { glyph: '◆', weight: 12 },
  { glyph: '▲', weight: 20 },
  { glyph: '●', weight: 28 },
  { glyph: '■', weight: 35 },
];
const CHROME_WEIGHT_TOTAL = CHROME_SYMBOLS.reduce((s, x) => s + x.weight, 0);
const THREE_MATCH_PAYOUT  = { '★': 20, '◆': 12, '▲': 8, '●': 5, '■': 3 };
const TWO_MATCH_PAYOUT    = 1;
const CHROME_BASE_COST    = 2;
const REEL_AUTO_STOP_MS   = [3500, 6000, 8500];

class ChromeScene extends Phaser.Scene {
  constructor() { super({ key: 'ChromeScene' }); }

  create() {
    const { width, height } = this.scale;
    const slotIndex   = localStorage.getItem('factower_active_slot');
    this.saveKey      = `factower_save_${slotIndex}`;
    this.saveData     = JSON.parse(localStorage.getItem(this.saveKey)) || {};
    if (!this.saveData.nuts)            this.saveData.nuts = 0;
    if (!this.saveData.bolts)           this.saveData.bolts = 0;
    if (!this.saveData.merchantFatigue) this.saveData.merchantFatigue = { chrome: 0, ricochet: 0, doubleDown: 0 };
    if (!this.saveData.chromeState)     this.saveData.chromeState = { pityCount: 0 };
    if (!this.saveData.tutorials)       this.saveData.tutorials = {};

    this.fatigue        = this.saveData.merchantFatigue.chrome || 0;
    this.pityCount      = this.saveData.chromeState.pityCount  || 0;
    this.spinning       = false;
    this.reelSpinning   = [false, false, false];
    this.reelStopped    = [false, false, false];
    this.reelTimers     = [null, null, null];
    this.autoStopTimers = [null, null, null];
    this._pendingResults = [];

    this.add.rectangle(width / 2, height / 2, width, height, 0x0d1117);
    this.add.rectangle(width / 2, 0, width, 4, 0xe8a020, 0.4);

    // ── Header ────────────────────────────────────────────────────────────
    this.add.rectangle(width / 2, 144, width, 100, 0x161b22);
    this.add.rectangle(width / 2, 194, width, 1, 0x334455);

    const back = this.add.rectangle(44, 144, 72, 48, 0x1e2530).setInteractive();
    this.add.text(44, 144, '<- BACK', { fontFamily: 'monospace', fontSize: '14px', color: '#e8a020' }).setOrigin(0.5);
    back.on('pointerdown', () => {
      if (this.spinning) return;
      this._save();
      this.cameras.main.fade(200, 0, 0, 0);
      this.time.delayedCall(200, () => this.scene.start('MarketplaceScene'));
    });
    back.on('pointerover', () => back.setFillStyle(0x252c38));
    back.on('pointerout',  () => back.setFillStyle(0x1e2530));

    this.add.text(width / 2 + 20, 125, 'CHROME', { fontFamily: 'monospace', fontSize: '26px', color: '#e8a020', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(width / 2 + 20, 152, 'THE SLOTS', { fontFamily: 'monospace', fontSize: '11px', color: '#8899aa', letterSpacing: 3 }).setOrigin(0.5);

    this.nutsText  = this.add.text(width / 2 - 70, 218, `${this.saveData.nuts} NUTS`,  { fontFamily: 'monospace', fontSize: '13px', color: '#e8a020', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(width / 2, 218, '·', { fontFamily: 'monospace', fontSize: '13px', color: '#334455' }).setOrigin(0.5);
    this.boltsText = this.add.text(width / 2 + 70, 218, `${this.saveData.bolts} BOLTS`, { fontFamily: 'monospace', fontSize: '13px', color: '#8ab4cc', fontStyle: 'bold' }).setOrigin(0.5);

    // ── Cabinet ───────────────────────────────────────────────────────────
    const cabY = 445, cabH = 300;
    this.add.rectangle(width / 2, cabY, width - 24, cabH, 0x0f1318);
    this.add.rectangle(width / 2, cabY, width - 24, cabH).setStrokeStyle(2, 0xe8a020, 0.7);
    this.add.rectangle(width / 2, 252, 160, 28, 0xe8a020);
    this.add.text(width / 2, 252, 'C H R O M E', { fontFamily: 'monospace', fontSize: '12px', color: '#0d1117', fontStyle: 'bold', letterSpacing: 4 }).setOrigin(0.5);
    this.add.rectangle(width / 2, cabY - 2, width - 48, 2, 0xe8a020, 0.5);

    // ── Reels ─────────────────────────────────────────────────────────────
    this.reelDisplays = [];
    this.reelBgs      = [];
    const reelY = cabY, reelW = 82, reelH = 110, gap = 96;
    const reelXs = [width / 2 - gap, width / 2, width / 2 + gap];

    reelXs.forEach((rx, i) => {
      const bg = this.add.rectangle(rx, reelY, reelW, reelH, 0x161b22);
      this.add.rectangle(rx, reelY, reelW, reelH).setStrokeStyle(1, 0x334455);
      this.reelBgs.push(bg);
      this.add.text(rx, reelY - reelH / 2 - 20, CHROME_SYMBOLS[2].glyph, { fontFamily: 'monospace', fontSize: '22px', color: '#1e2a38' }).setOrigin(0.5);
      this.add.text(rx, reelY + reelH / 2 + 20, CHROME_SYMBOLS[3].glyph, { fontFamily: 'monospace', fontSize: '22px', color: '#1e2a38' }).setOrigin(0.5);

      const sym  = this.add.text(rx, reelY, CHROME_SYMBOLS[0].glyph, { fontFamily: 'monospace', fontSize: '44px', color: '#8899aa', fontStyle: 'bold' }).setOrigin(0.5);
      const hint = this.add.text(rx, reelY + 66, 'TAP', { fontFamily: 'monospace', fontSize: '9px', color: '#556677', letterSpacing: 2 }).setOrigin(0.5).setAlpha(0);
      sym.stopLabel = hint;
      this.reelDisplays.push(sym);

      bg.setInteractive();
      bg.on('pointerdown', () => this._tapReel(i));
    });

    this.resultBanner = this.add.text(width / 2, cabY + 110 / 2 + 48, '', {
      fontFamily: 'monospace', fontSize: '16px', color: '#e8a020', fontStyle: 'bold', align: 'center', letterSpacing: 2
    }).setOrigin(0.5).setAlpha(0);

    // ── Fatigue bar ───────────────────────────────────────────────────────
    const fatY = cabY + cabH / 2 + 24;
    this.add.text(width / 2, fatY, 'FATIGUE', { fontFamily: 'monospace', fontSize: '9px', color: '#445566', letterSpacing: 3 }).setOrigin(0.5);
    const bW = width - 80, bY = fatY + 16;
    this.add.rectangle(width / 2, bY, bW, 8, 0x1a2230);
    this.fatigueFill  = this.add.rectangle(width / 2 - bW / 2, bY, 2, 8, 0xe8a020).setOrigin(0, 0.5);
    this.fatigueLabel = this.add.text(width / 2, bY + 14, this._fatigueText(), { fontFamily: 'monospace', fontSize: '9px', color: '#556677', letterSpacing: 1 }).setOrigin(0.5);
    this._updateFatigueBar(bW);

    const costY = bY + 36;
    this.add.text(width / 2, costY, 'ROLL COST', { fontFamily: 'monospace', fontSize: '9px', color: '#445566', letterSpacing: 3 }).setOrigin(0.5);
    this.costText = this.add.text(width / 2, costY + 16, `${this._rollCost()} NUTS`, { fontFamily: 'monospace', fontSize: '14px', color: '#e8a020', fontStyle: 'bold' }).setOrigin(0.5);

    // ── SPIN button ───────────────────────────────────────────────────────
    const spinY = height - 90;
    this.spinBg  = this.add.rectangle(width / 2, spinY, width - 48, 68, 0x1a1200).setInteractive();
    this.spinBdr = this.add.rectangle(width / 2, spinY, width - 48, 68).setStrokeStyle(2, 0xe8a020);
    this.spinTxt = this.add.text(width / 2, spinY - 10, 'SPIN', { fontFamily: 'monospace', fontSize: '26px', color: '#e8a020', fontStyle: 'bold' }).setOrigin(0.5);
    this.spinSub = this.add.text(width / 2, spinY + 18, `COSTS ${this._rollCost()} NUTS`, { fontFamily: 'monospace', fontSize: '11px', color: '#556677', letterSpacing: 1 }).setOrigin(0.5);
    this.spinBg.on('pointerdown', () => this._startSpin());
    this.spinBg.on('pointerover', () => this.spinBg.setFillStyle(0x261a00));
    this.spinBg.on('pointerout',  () => this.spinBg.setFillStyle(0x1a1200));
    this._refreshSpinButton();

    if (!this.saveData.tutorials.chrome) {
      this.time.delayedCall(200, () => this._showTutorial());
    }
  }

  _rollCost() {
    return Math.min(Math.round(CHROME_BASE_COST * (1 + Math.pow(this.fatigue, 3) / 500)), 60);
  }

  _rewardMultiplier() {
    return Math.max(0.2, 1 / (1 + 0.08 * this.fatigue));
  }

  _fatigueText() {
    if (this.fatigue === 0) return 'FRESH — FULL PAYOUTS';
    if (this.fatigue < 6)   return `WARM (${this.fatigue} ROLLS)`;
    if (this.fatigue < 14)  return `TIRED (${this.fatigue} ROLLS) — REDUCED`;
    return `BURNT (${this.fatigue} ROLLS) — HEAVY REDUCTION`;
  }

  _updateFatigueBar(bW) {
    const pct = Math.min(this.fatigue / 20, 1);
    const col = this.fatigue < 6 ? 0x5eba7d : this.fatigue < 14 ? 0xe8a020 : 0xc43a3a;
    this.fatigueFill.setSize(Math.max(2, bW * pct), 8).setFillStyle(col);
  }

  _refreshSpinButton() {
    const cost = this._rollCost(), ok = this.saveData.nuts >= cost;
    this.spinTxt.setStyle({ color: ok ? '#e8a020' : '#445566' });
    this.spinBg.setFillStyle(ok ? 0x1a1200 : 0x161b22);
    this.spinBdr.setStrokeStyle(2, ok ? 0xe8a020 : 0x334455);
    this.spinSub.setText(`COSTS ${cost} NUTS`).setStyle({ color: ok ? '#8899aa' : '#334455' });
    this.costText.setText(`${cost} NUTS`);
    if (ok && !this.spinning) this.spinBg.setInteractive(); else this.spinBg.disableInteractive();
  }

  _startSpin() {
    if (this.spinning) return;
    const cost = this._rollCost();
    if (this.saveData.nuts < cost) return;

    this.saveData.nuts -= cost;
    this.nutsText.setText(`${this.saveData.nuts} NUTS`);
    this.spinning       = true;
    this.reelSpinning   = [true, true, true];
    this.reelStopped    = [false, false, false];
    this._pendingResults = [this._weightedSymbol(), this._weightedSymbol(), this._weightedSymbol()];
    if (this.pityCount >= 10) this._pendingResults[1] = this._pendingResults[0];

    this.tweens.add({ targets: this.resultBanner, alpha: 0, duration: 100 });

    this.reelDisplays.forEach((d, i) => {
      d.setStyle({ color: '#8899aa' });
      this._spinReel(i);
      this.time.delayedCall(1000, () => {
        if (this.reelSpinning[i]) this.tweens.add({ targets: d.stopLabel, alpha: 1, duration: 200 });
      });
      this.autoStopTimers[i] = this.time.delayedCall(REEL_AUTO_STOP_MS[i], () => this._tapReel(i));
    });

    this.spinBg.disableInteractive();
    this.spinTxt.setText('SPINNING');
    this.spinSub.setText('TAP REELS TO STOP EARLY').setStyle({ color: '#8899aa' });
  }

  _spinReel(i) {
    if (!this.reelSpinning[i]) return;
    const n = Math.floor(Math.random() * CHROME_SYMBOLS.length);
    this.reelDisplays[i].setText(CHROME_SYMBOLS[n].glyph);
    this.reelBgs[i].setFillStyle(0x1e2530);
    this.reelTimers[i] = this.time.delayedCall(80, () => this._spinReel(i));
  }

  _tapReel(i) {
    if (!this.spinning || !this.reelSpinning[i]) return;
    this.reelSpinning[i] = false;
    if (this.reelTimers[i])     { this.reelTimers[i].remove(false);     this.reelTimers[i] = null; }
    if (this.autoStopTimers[i]) { this.autoStopTimers[i].remove(false); this.autoStopTimers[i] = null; }

    const r = this._pendingResults[i];
    this.reelDisplays[i].setText(CHROME_SYMBOLS[r].glyph).setStyle({ color: '#eef2f8' });
    this.reelBgs[i].setFillStyle(0x161b22);
    this.tweens.add({ targets: this.reelDisplays[i].stopLabel, alpha: 0, duration: 100 });
    this.cameras.main.flash(60, 232, 160, 32, false);
    this.reelStopped[i] = true;
    if (this.reelStopped.every(s => s)) this.time.delayedCall(300, () => this._evaluateResult());
  }

  _weightedSymbol() {
    let r = Math.random() * CHROME_WEIGHT_TOTAL;
    for (let i = 0; i < CHROME_SYMBOLS.length; i++) { r -= CHROME_SYMBOLS[i].weight; if (r <= 0) return i; }
    return CHROME_SYMBOLS.length - 1;
  }

  _evaluateResult() {
    const g = this._pendingResults.map(s => CHROME_SYMBOLS[s].glyph);
    let raw = 0, msg = '', col = '#8899aa';

    if (g[0] === g[1] && g[1] === g[2]) {
      raw = THREE_MATCH_PAYOUT[g[0]] || 3; msg = `${g[0]} ${g[0]} ${g[0]}  JACKPOT`; col = '#e8a020';
      this.cameras.main.flash(200, 232, 160, 32, false);
    } else if (g[0] === g[1] || g[1] === g[2] || g[0] === g[2]) {
      raw = TWO_MATCH_PAYOUT; msg = `PAIR  +${raw} BOLT${raw === 1 ? '' : 'S'}`; col = '#8ab4cc';
    } else {
      msg = 'NO MATCH'; col = '#445566';
    }

    const payout = Math.max(raw > 0 ? 1 : 0, Math.round(raw * this._rewardMultiplier()));
    this.pityCount = payout === 0 ? this.pityCount + 1 : 0;

    if (payout > 0) {
      this.saveData.bolts += payout;
      this.boltsText.setText(`${this.saveData.bolts} BOLTS`);
      this.tweens.add({ targets: this.boltsText, scaleX: 1.3, scaleY: 1.3, duration: 150, yoyo: true });
      const { width } = this.scale;
      const pop = this.add.text(width / 2, 380, `+${payout} BOLT${payout === 1 ? '' : 'S'}`, {
        fontFamily: 'monospace', fontSize: '20px', color: '#8ab4cc', fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(10).setAlpha(0);
      this.tweens.add({ targets: pop, y: 340, alpha: 1, duration: 200, onComplete: () =>
        this.time.delayedCall(800, () => this.tweens.add({ targets: pop, alpha: 0, duration: 300, onComplete: () => pop.destroy() }))
      });
    }

    if (g[0] === g[1] && g[1] === g[2]) { this.reelDisplays.forEach(d => d.setStyle({ color: '#e8a020' })); }
    else { [[0,1],[1,2],[0,2]].forEach(([a,b]) => { if (g[a] === g[b]) { this.reelDisplays[a].setStyle({ color: '#8ab4cc' }); this.reelDisplays[b].setStyle({ color: '#8ab4cc' }); } }); }

    this.resultBanner.setText(msg).setStyle({ color: col });
    this.tweens.add({ targets: this.resultBanner, alpha: 1, duration: 250 });

    this.fatigue++;
    this._save();
    const bW = this.scale.width - 80;
    this._updateFatigueBar(bW);
    this.fatigueLabel.setText(this._fatigueText());
    this.spinning = false;
    this.reelStopped = [false, false, false];
    this.spinTxt.setText('SPIN');
    this._refreshSpinButton();
  }

  _save() {
    this.saveData.merchantFatigue.chrome = this.fatigue;
    this.saveData.chromeState.pityCount  = this.pityCount;
    localStorage.setItem(this.saveKey, JSON.stringify(this.saveData));
  }

  _showTutorial() {
    const { width, height } = this.scale;
    const cabY = 445, cabH = 300, reelY = 445, reelW = 82, reelH = 110, gap = 96;
    const steps = [
      {
        tx: width / 2, ty: cabY, tw: width - 24, th: cabH,
        title: 'THE MACHINE',
        body: 'THREE REELS SPIN WHEN YOU\nPRESS SPIN. EACH STOPS\nAUTOMATICALLY — OR TAP EARLY.'
      },
      {
        tx: width / 2 - gap, ty: reelY, tw: reelW + 8, th: reelH + 8,
        title: 'TAP TO STOP',
        body: 'TAP ANY SPINNING REEL TO\nSTOP IT EARLY. REELS AUTO-STOP\nAT 3.5s, 6s, AND 8.5s.'
      },
      {
        tx: width / 2, ty: cabY + cabH / 2 + 54, tw: width - 60, th: 36,
        title: 'FATIGUE',
        body: 'ROLLING MANY TIMES INCREASES\nCOST AND REDUCES PAYOUTS.\nTAKE A BREAK TO RESET.'
      },
      {
        tx: width / 2, ty: height - 90, tw: width - 48, th: 68,
        title: 'SPIN',
        body: 'COSTS NUTS. MATCH SYMBOLS\nACROSS ALL 3 REELS FOR BOLTS.\nPAIRS PAY A CONSOLATION BOLT.'
      },
    ];

    let step = 0;
    const overlay  = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.72).setDepth(50);
    const pulse    = this.add.rectangle(0, 0, 0, 0).setStrokeStyle(2, 0xe8a020).setDepth(51);
    this.tweens.add({ targets: pulse, alpha: 0.4, duration: 600, yoyo: true, repeat: -1 });

    const cardY   = height - 148;
    const card    = this.add.rectangle(width / 2, cardY, width - 32, 88, 0x0a0e14, 0.98).setDepth(52);
    this.add.rectangle(width / 2, cardY, width - 32, 88).setStrokeStyle(1, 0xe8a020, 0.6).setDepth(52);
    const tTitle  = this.add.text(width / 2, cardY - 24, '', { fontFamily: 'monospace', fontSize: '13px', color: '#e8a020', fontStyle: 'bold', letterSpacing: 3 }).setOrigin(0.5).setDepth(53);
    const tBody   = this.add.text(width / 2, cardY + 4,  '', { fontFamily: 'monospace', fontSize: '11px', color: '#8899aa', align: 'center', wordWrap: { width: width - 60 } }).setOrigin(0.5).setDepth(53);
    this.add.text(width / 2, cardY + 34, 'TAP TO CONTINUE', { fontFamily: 'monospace', fontSize: '9px', color: '#334455', letterSpacing: 3 }).setOrigin(0.5).setDepth(53);

    const show = (i) => {
      const s = steps[i];
      pulse.setPosition(s.tx, s.ty).setSize(s.tw + 10, s.th + 10);
      tTitle.setText(s.title);
      tBody.setText(s.body);
    };
    show(0);

    const next = () => {
      step++;
      if (step >= steps.length) {
        [overlay, pulse, card, tTitle, tBody].forEach(e => e.destroy());
        this.saveData.tutorials.chrome = true;
        this._save();
        return;
      }
      show(step);
    };
    overlay.setInteractive();
    overlay.on('pointerdown', next);
  }
}