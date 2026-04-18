// ── ChromeScene.js ────────────────────────────────────────────────────────────
// Chrome's slot machine. 3 reels, tap to stop each.
// Symbols: ◆ ● ▲ ■ ★  (5 symbols, weighted)
// Payout: 3-match pays well, 2-match pays small, no match = nothing
// Fatigue: reward_multiplier = 1 / (1 + 0.15 * rolls), cost = base * 1.35^rolls
// Pity: after 10 zero-win rolls, next guaranteed ≥ 2 Bolts

const CHROME_SYMBOLS = [
  { glyph: '★', label: 'STAR',    weight: 6  },
  { glyph: '◆', label: 'DIAMOND', weight: 14 },
  { glyph: '▲', label: 'SPIKE',   weight: 20 },
  { glyph: '●', label: 'CORE',    weight: 28 },
  { glyph: '■', label: 'BLOCK',   weight: 32 },
];
// Cumulative weights for weighted random
const CHROME_TOTAL_WEIGHT = CHROME_SYMBOLS.reduce((s, sym) => s + sym.weight, 0);

// Base payouts (Bolts) for each symbol on a 3-match
const THREE_MATCH_PAYOUT = { '★': 20, '◆': 12, '▲': 8, '●': 5, '■': 3 };
// 2-match always pays 1 Bolt (small consolation)
const TWO_MATCH_PAYOUT   = 1;

// Base roll cost in Nuts
const BASE_COST = 2;

class ChromeScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ChromeScene' });
  }

  create() {
    const { width, height } = this.scale;

    const slotIndex    = localStorage.getItem('factower_active_slot');
    this.saveKey       = `factower_save_${slotIndex}`;
    this.saveData      = JSON.parse(localStorage.getItem(this.saveKey)) || {};

    if (!this.saveData.nuts)            this.saveData.nuts = 0;
    if (!this.saveData.bolts)           this.saveData.bolts = 0;
    if (!this.saveData.merchantFatigue) this.saveData.merchantFatigue = { chrome: 0, ricochet: 0, doubleDown: 0 };
    if (!this.saveData.chromeState)     this.saveData.chromeState = { pityCount: 0 };

    this.fatigue   = this.saveData.merchantFatigue.chrome || 0;
    this.pityCount = this.saveData.chromeState.pityCount  || 0;

    // Reel state
    this.reelSymbols  = [0, 0, 0];   // visible symbol index per reel
    this.reelSpinning = [false, false, false];
    this.reelTimers   = [null, null, null];
    this.spinning     = false;     // full spin in progress
    this.resultLocked = false;     // prevent double-taps after result shown

    // ── Background ────────────────────────────────────────────────────────
    this.add.rectangle(width / 2, height / 2, width, height, 0x0d1117);

    // Decorative top ambient line
    this.add.rectangle(width / 2, 0, width, 4, 0xe8a020, 0.4);

    // ── Header ────────────────────────────────────────────────────────────
    this.add.rectangle(width / 2, 144, width, 100, 0x161b22);
    this.add.rectangle(width / 2, 194, width, 1, 0x334455);

    const backBtn = this.add.rectangle(44, 144, 72, 48, 0x1e2530).setInteractive();
    this.add.text(44, 144, '<- BACK', {
      fontFamily: 'monospace', fontSize: '14px', color: '#e8a020'
    }).setOrigin(0.5);
    backBtn.on('pointerdown', () => {
      if (this.spinning) return; // can't leave mid-spin
      this._save();
      this.cameras.main.fade(200, 0, 0, 0);
      this.time.delayedCall(200, () => this.scene.start('MarketplaceScene'));
    });
    backBtn.on('pointerover', () => backBtn.setFillStyle(0x252c38));
    backBtn.on('pointerout',  () => backBtn.setFillStyle(0x1e2530));

    this.add.text(width / 2 + 20, 125, 'CHROME', {
      fontFamily: 'monospace', fontSize: '26px', color: '#e8a020', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.add.text(width / 2 + 20, 152, 'THE SLOTS', {
      fontFamily: 'monospace', fontSize: '11px', color: '#8899aa', letterSpacing: 3
    }).setOrigin(0.5);

    // ── Currency ──────────────────────────────────────────────────────────
    const curY = 218;
    this.nutsText  = this.add.text(width / 2 - 70, curY, `${this.saveData.nuts} NUTS`, {
      fontFamily: 'monospace', fontSize: '13px', color: '#e8a020', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.add.text(width / 2, curY, '·', {
      fontFamily: 'monospace', fontSize: '13px', color: '#334455'
    }).setOrigin(0.5);
    this.boltsText = this.add.text(width / 2 + 70, curY, `${this.saveData.bolts} BOLTS`, {
      fontFamily: 'monospace', fontSize: '13px', color: '#8ab4cc', fontStyle: 'bold'
    }).setOrigin(0.5);

    // ── Machine cabinet ───────────────────────────────────────────────────
    const cabinetY = 445;
    const cabinetH = 300;
    this.add.rectangle(width / 2, cabinetY, width - 24, cabinetH, 0x0f1318);
    this.add.rectangle(width / 2, cabinetY, width - 24, cabinetH).setStrokeStyle(2, 0xe8a020, 0.7);

    // Chrome name plate
    this.add.rectangle(width / 2, 250, 160, 28, 0xe8a020);
    this.add.text(width / 2, 250, 'C H R O M E', {
      fontFamily: 'monospace', fontSize: '12px', color: '#0d1117', fontStyle: 'bold', letterSpacing: 4
    }).setOrigin(0.5);

    // Payline indicator (horizontal amber line across middle of reels)
    const paylineY = cabinetY - 2;
    this.add.rectangle(width / 2, paylineY, width - 48, 2, 0xe8a020, 0.5);

    // ── Reels ─────────────────────────────────────────────────────────────
    this.reelDisplays = [];
    this.reelBgs      = [];
    const reelY       = cabinetY;
    const reelSpacing = 96;
    const reelW       = 82;
    const reelH       = 110;
    const reelXs      = [
      width / 2 - reelSpacing,
      width / 2,
      width / 2 + reelSpacing
    ];

    reelXs.forEach((rx, i) => {
      // Reel background
      const reelBg = this.add.rectangle(rx, reelY, reelW, reelH, 0x161b22);
      this.add.rectangle(rx, reelY, reelW, reelH).setStrokeStyle(1, 0x334455);
      this.reelBgs.push(reelBg);

      // Symbols above/below for scroll feel
      this.add.text(rx, reelY - reelH / 2 - 20, CHROME_SYMBOLS[2].glyph, {
        fontFamily: 'monospace', fontSize: '22px', color: '#1e2a38'
      }).setOrigin(0.5);
      this.add.text(rx, reelY + reelH / 2 + 20, CHROME_SYMBOLS[3].glyph, {
        fontFamily: 'monospace', fontSize: '22px', color: '#1e2a38'
      }).setOrigin(0.5);

      // Main reel symbol (large, on payline)
      const sym = this.add.text(rx, reelY, CHROME_SYMBOLS[0].glyph, {
        fontFamily: 'monospace', fontSize: '44px', color: '#8899aa', fontStyle: 'bold'
      }).setOrigin(0.5);
      this.reelDisplays.push(sym);

      // TAP TO STOP label — shown during spin
      const stopLabel = this.add.text(rx, reelY + 66, 'TAP', {
        fontFamily: 'monospace', fontSize: '9px', color: '#556677', letterSpacing: 2
      }).setOrigin(0.5).setAlpha(0);
      this.reelDisplays[i].stopLabel = stopLabel;

      // Make reel tap-to-stop interactive during spin
      reelBg.setInteractive();
      reelBg.on('pointerdown', () => this._tapReel(i));
    });

    // ── Result banner ─────────────────────────────────────────────────────
    this.resultBanner = this.add.text(width / 2, cabinetY + reelH / 2 + 48, '', {
      fontFamily: 'monospace', fontSize: '16px', color: '#e8a020', fontStyle: 'bold',
      align: 'center', letterSpacing: 2
    }).setOrigin(0.5).setAlpha(0);

    // ── Fatigue bar ───────────────────────────────────────────────────────
    const fatY = cabinetY + cabinetH / 2 + 24;
    this.add.text(width / 2, fatY, 'FATIGUE', {
      fontFamily: 'monospace', fontSize: '9px', color: '#445566', letterSpacing: 3
    }).setOrigin(0.5);

    const barW  = width - 80;
    const barY  = fatY + 16;
    this.add.rectangle(width / 2, barY, barW, 8, 0x1a2230);
    this.fatigueFill = this.add.rectangle(width / 2 - barW / 2, barY, 1, 8, 0xe8a020).setOrigin(0, 0.5);
    this._updateFatigueBar(barW);

    this.fatigueLabel = this.add.text(width / 2, barY + 14, this._fatigueText(), {
      fontFamily: 'monospace', fontSize: '9px', color: '#556677', letterSpacing: 1
    }).setOrigin(0.5);

    // ── Cost display ──────────────────────────────────────────────────────
    const costY = barY + 36;
    this.add.text(width / 2, costY, 'ROLL COST', {
      fontFamily: 'monospace', fontSize: '9px', color: '#445566', letterSpacing: 3
    }).setOrigin(0.5);
    this.costText = this.add.text(width / 2, costY + 16, `${this._rollCost()} NUTS`, {
      fontFamily: 'monospace', fontSize: '14px', color: '#e8a020', fontStyle: 'bold'
    }).setOrigin(0.5);

    // ── SPIN button ───────────────────────────────────────────────────────
    const spinY = height - 90;
    this.spinBg  = this.add.rectangle(width / 2, spinY, width - 48, 68, 0x1a1200).setInteractive();
    this.spinBdr = this.add.rectangle(width / 2, spinY, width - 48, 68).setStrokeStyle(2, 0xe8a020);
    this.spinTxt = this.add.text(width / 2, spinY - 10, 'SPIN', {
      fontFamily: 'monospace', fontSize: '26px', color: '#e8a020', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.spinSub = this.add.text(width / 2, spinY + 18, `COSTS ${this._rollCost()} NUTS`, {
      fontFamily: 'monospace', fontSize: '11px', color: '#556677', letterSpacing: 1
    }).setOrigin(0.5);

    this.spinBg.on('pointerdown', () => this._startSpin());
    this.spinBg.on('pointerover', () => this.spinBg.setFillStyle(0x261a00));
    this.spinBg.on('pointerout',  () => this.spinBg.setFillStyle(0x1a1200));

    this._refreshSpinButton();
  }

  // ── Fatigue helpers ───────────────────────────────────────────────────────
  _rollCost() {
    const cost = Math.round(BASE_COST * Math.pow(1.35, this.fatigue));
    return Math.min(cost, 50); // cap at 50 Nuts
  }

  _rewardMultiplier() {
    return 1 / (1 + 0.15 * this.fatigue);
  }

  _fatigueText() {
    if (this.fatigue === 0)  return 'FRESH — FULL PAYOUTS';
    if (this.fatigue < 5)    return `WARM (${this.fatigue} ROLLS) — SLIGHT REDUCTION`;
    if (this.fatigue < 12)   return `TIRED (${this.fatigue} ROLLS) — REDUCED PAYOUTS`;
    return                          `BURNT (${this.fatigue} ROLLS) — HEAVY REDUCTION`;
  }

  _updateFatigueBar(barW) {
    const maxFatigue  = 20;
    const pct         = Math.min(this.fatigue / maxFatigue, 1);
    const col         = this.fatigue < 5 ? 0x5eba7d : this.fatigue < 12 ? 0xe8a020 : 0xc43a3a;
    this.fatigueFill.setSize(Math.max(1, barW * pct), 8);
    this.fatigueFill.setFillStyle(col);
  }

  _refreshSpinButton() {
    const cost       = this._rollCost();
    const canAfford  = this.saveData.nuts >= cost;
    const col        = canAfford ? 0xe8a020 : 0x445566;
    const bgCol      = canAfford ? 0x1a1200 : 0x161b22;
    const bdrCol     = canAfford ? 0xe8a020 : 0x334455;

    this.spinTxt.setStyle({ color: canAfford ? '#e8a020' : '#445566' });
    this.spinBg.setFillStyle(bgCol);
    this.spinBdr.setStrokeStyle(2, bdrCol);
    this.spinSub.setText(`COSTS ${cost} NUTS`);
    this.spinSub.setStyle({ color: canAfford ? '#8899aa' : '#334455' });
    this.costText.setText(`${cost} NUTS`);

    if (canAfford && !this.spinning) {
      this.spinBg.setInteractive();
    } else {
      this.spinBg.disableInteractive();
    }
  }

  // ── Spin logic ────────────────────────────────────────────────────────────
  _startSpin() {
    if (this.spinning || this.resultLocked) return;
    const cost = this._rollCost();
    if (this.saveData.nuts < cost) return;

    // Deduct cost
    this.saveData.nuts -= cost;
    this.nutsText.setText(`${this.saveData.nuts} NUTS`);

    this.spinning        = true;
    this.resultLocked    = false;
    this.reelSpinning    = [true, true, true];
    this.reelStopped     = [false, false, false];
    this._pendingResults = [];

    // Hide result banner
    this.tweens.add({ targets: this.resultBanner, alpha: 0, duration: 100 });

    // Pre-determine outcomes (weighted random)
    this._pendingResults = [
      this._weightedSymbol(),
      this._weightedSymbol(),
      this._weightedSymbol()
    ];

    // Apply pity: if pityCount >= 10 and all three would be different, force 2-match on reels 0+1
    if (this.pityCount >= 10) {
      this._pendingResults[1] = this._pendingResults[0];
    }

    // Start reel spinning animations
    this.reelDisplays.forEach((display, i) => {
      display.setStyle({ color: '#8899aa' });
      this._spinReel(i);
      // Show TAP label after 1s
      this.time.delayedCall(1000, () => {
        if (this.reelSpinning[i]) {
          this.tweens.add({ targets: display.stopLabel, alpha: 1, duration: 200 });
        }
      });
    });

    this.spinBg.disableInteractive();
    this.spinTxt.setText('SPINNING');
    this.spinSub.setText('TAP REELS TO STOP');
    this.spinSub.setStyle({ color: '#8899aa' });
  }

  _spinReel(i) {
    if (!this.reelSpinning[i]) return;
    // Cycle through a random symbol rapidly
    const next = Math.floor(Math.random() * CHROME_SYMBOLS.length);
    this.reelSymbols[i] = next;
    this.reelDisplays[i].setText(CHROME_SYMBOLS[next].glyph);
    this.reelBgs[i].setFillStyle(0x1e2530);

    if (this.reelSpinning[i]) {
      this.reelTimers[i] = this.time.delayedCall(80, () => this._spinReel(i));
    }
  }

  _tapReel(i) {
    if (!this.spinning || !this.reelSpinning[i]) return;

    // Stop this reel
    this.reelSpinning[i] = false;
    if (this.reelTimers[i]) { this.reelTimers[i].remove(false); this.reelTimers[i] = null; }

    const result = this._pendingResults[i];
    this.reelSymbols[i] = result;
    this.reelDisplays[i].setText(CHROME_SYMBOLS[result].glyph);
    this.reelDisplays[i].setStyle({ color: '#eef2f8' });
    this.reelBgs[i].setFillStyle(0x161b22);

    // Hide TAP label
    this.tweens.add({ targets: this.reelDisplays[i].stopLabel, alpha: 0, duration: 100 });

    // Flash reel on stop
    this.cameras.main.flash(60, 232, 160, 32, false);
    this.reelStopped[i] = true;

    // Check if all stopped
    if (this.reelStopped.every(s => s)) {
      this.time.delayedCall(300, () => this._evaluateResult());
    }
  }

  _weightedSymbol() {
    let r = Math.random() * CHROME_TOTAL_WEIGHT;
    for (let i = 0; i < CHROME_SYMBOLS.length; i++) {
      r -= CHROME_SYMBOLS[i].weight;
      if (r <= 0) return i;
    }
    return CHROME_SYMBOLS.length - 1;
  }

  _evaluateResult() {
    const syms    = this._pendingResults;
    const glyphs  = syms.map(s => CHROME_SYMBOLS[s].glyph);

    let rawPayout = 0;
    let resultMsg = '';
    let resultCol = '#8899aa';

    if (glyphs[0] === glyphs[1] && glyphs[1] === glyphs[2]) {
      // 3-match jackpot
      rawPayout = THREE_MATCH_PAYOUT[glyphs[0]] || 3;
      resultMsg = `${glyphs[0]} ${glyphs[0]} ${glyphs[0]}  JACKPOT`;
      resultCol = '#e8a020';
      this.cameras.main.flash(200, 232, 160, 32, false);
    } else if (glyphs[0] === glyphs[1] || glyphs[1] === glyphs[2] || glyphs[0] === glyphs[2]) {
      // 2-match
      rawPayout = TWO_MATCH_PAYOUT;
      resultMsg = 'PAIR  +' + rawPayout + ' BOLT' + (rawPayout === 1 ? '' : 'S');
      resultCol = '#8ab4cc';
    } else {
      rawPayout = 0;
      resultMsg = 'NO MATCH';
      resultCol = '#445566';
    }

    // Apply fatigue multiplier
    const mult   = this._rewardMultiplier();
    const payout = Math.max(rawPayout > 0 ? 1 : 0, Math.round(rawPayout * mult));

    // Pity tracking
    if (payout === 0) {
      this.pityCount++;
    } else {
      this.pityCount = 0;
    }

    // Award bolts
    if (payout > 0) {
      this.saveData.bolts += payout;
      this.boltsText.setText(`${this.saveData.bolts} BOLTS`);
      // Bolt flash animation
      this.tweens.add({ targets: this.boltsText, scaleX: 1.3, scaleY: 1.3, duration: 150, yoyo: true });
    }

    // Increment fatigue
    this.fatigue++;
    this.saveData.merchantFatigue.chrome = this.fatigue;
    this.saveData.chromeState.pityCount  = this.pityCount;

    // Update UI
    const barW = this.scale.width - 80;
    this._updateFatigueBar(barW);
    this.fatigueLabel.setText(this._fatigueText());

    // Colour matched symbols
    if (glyphs[0] === glyphs[1] && glyphs[1] === glyphs[2]) {
      this.reelDisplays.forEach(d => d.setStyle({ color: '#e8a020', fontStyle: 'bold' }));
    } else if (glyphs[0] === glyphs[2]) {
      this.reelDisplays[0].setStyle({ color: '#8ab4cc' });
      this.reelDisplays[2].setStyle({ color: '#8ab4cc' });
    } else if (glyphs[0] === glyphs[1]) {
      this.reelDisplays[0].setStyle({ color: '#8ab4cc' });
      this.reelDisplays[1].setStyle({ color: '#8ab4cc' });
    } else if (glyphs[1] === glyphs[2]) {
      this.reelDisplays[1].setStyle({ color: '#8ab4cc' });
      this.reelDisplays[2].setStyle({ color: '#8ab4cc' });
    }

    // Show result banner
    this.resultBanner.setText(resultMsg);
    this.resultBanner.setStyle({ color: resultCol });
    this.tweens.add({ targets: this.resultBanner, alpha: 1, duration: 250 });

    // Show payout popup if won
    if (payout > 0) {
      const { width } = this.scale;
      const pop = this.add.text(width / 2, 380, `+${payout} BOLT${payout === 1 ? '' : 'S'}`, {
        fontFamily: 'monospace', fontSize: '20px', color: '#8ab4cc', fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(10).setAlpha(0);
      this.tweens.add({
        targets: pop, y: 340, alpha: 1, duration: 200,
        onComplete: () => {
          this.time.delayedCall(800, () => {
            this.tweens.add({ targets: pop, alpha: 0, duration: 300, onComplete: () => pop.destroy() });
          });
        }
      });
    }

    // Save
    this._save();

    // Reset for next spin
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
}
