// ── ChromeScene.js ────────────────────────────────────────────────────────────
// Slots. Three reels; three of a kind pays by symbol, any pair pays 1 bolt.
// The next spin's result is decided (and saved) in advance, so leaving and
// coming back can't re-roll it — that's what makes Jackpot Sense fair.
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
const REEL_AUTO_STOP_MS   = [2200, 3400, 4600];
const CHROME_PITY_SPINS   = 10;   // this many losses in a row guarantees a pair

class ChromeScene extends Phaser.Scene {
  constructor() { super({ key: 'ChromeScene' }); }

  create() {
    const { width, height } = this.scale;
    this.saveData = SaveManager.load() || {};
    if (!Merchants.isRecruited(this.saveData, 'chrome')) { this.scene.start('MarketplaceScene'); return; }
    this.saveData = SaveManager.update(s => {
      if (!s.flags) s.flags = {};
      if (!s.flags.merchantsMet) s.flags.merchantsMet = {};
      s.flags.merchantsMet.chrome = true;
      if (!s.merchantFatigue) s.merchantFatigue = { chrome: 0, ricochet: 0, doubleDown: 0 };
      if (!s.chromeState) s.chromeState = { pityCount: 0 };
      if (!s.tutorials) s.tutorials = {};
      s.nuts = s.nuts || 0; s.bolts = s.bolts || 0;
    }) || this.saveData;

    this.fx        = Merchants.effects(this.saveData);
    this.fatigue   = Merchants.fatigue(this.saveData, 'chrome');
    this.pityCount = this.saveData.chromeState.pityCount || 0;
    this.nextSpin  = this.saveData.chromeState.next || this._rollResult();
    this.spinning  = false;
    this.reelSpinning   = [false, false, false];
    this.reelStopped    = [false, false, false];
    this.reelTimers     = [null, null, null];
    this.autoStopTimers = [null, null, null];
    this._pendingResults = [];

    UI.backdrop(this);
    UI.fadeIn(this);
    this.hdr = UI.header(this, {
      title: 'CHROME', sub: 'THE SLOTS', accent: UI.C.amber,
      onBack: () => { if (this.spinning) return; this._save(); UI.go(this, 'MarketplaceScene'); },
      chips: [{ kind: 'nuts', value: this.saveData.nuts }, { kind: 'bolts', value: this.saveData.bolts }]
    });

    // ── Cabinet ───────────────────────────────────────────────────────────
    const cabY = 284, cabH = 300;
    this.cabY = cabY; this.cabH = cabH;
    this.cabGlow = this.add.graphics();
    UI.panel(this, width / 2, cabY, width - 32, cabH, { fill: 0x0f1318, stroke: UI.C.amber, strokeAlpha: 0.7, strokeWidth: 2, radius: 18 });
    UI.panel(this, width / 2, cabY - cabH / 2, 150, 28, { fill: UI.C.amber, stroke: UI.C.amber, radius: 14 });
    UI.text(this, width / 2, cabY - cabH / 2, 'C H R O M E', 'tag', { size: 12, origin: 0.5, color: UI.T.dark });

    // ── Reels ─────────────────────────────────────────────────────────────
    this.reelDisplays = [];
    this.reelBgs      = [];
    const reelY = cabY - 16, reelW = 88, reelH = 132, gap = 100;
    this.reelY = reelY; this.reelW = reelW; this.reelH = reelH; this.reelGap = gap;
    const reelXs = [width / 2 - gap, width / 2, width / 2 + gap];
    reelXs.forEach((rx, i) => {
      const bg = this.add.graphics();
      const drawBg = (lit) => {
        bg.clear();
        bg.fillStyle(lit ? 0x1e2530 : 0x161b22, 1);
        bg.fillRoundedRect(rx - reelW / 2, reelY - reelH / 2, reelW, reelH, 12);
        bg.lineStyle(1, 0x334455, 1);
        bg.strokeRoundedRect(rx - reelW / 2, reelY - reelH / 2, reelW, reelH, 12);
      };
      drawBg(false);
      bg.drawBg = drawBg;
      this.reelBgs.push(bg);
      const sym  = UI.text(this, rx, reelY, CHROME_SYMBOLS[i].glyph, 'hero', { size: 52, origin: 0.5, color: '#8899aa' });
      const hint = UI.text(this, rx, reelY + reelH / 2 - 14, 'TAP', 'tag', { size: 10, origin: 0.5, color: UI.T.mute }).setAlpha(0);
      sym.stopLabel = hint;
      this.reelDisplays.push(sym);
      this.add.zone(rx, reelY, reelW, reelH).setInteractive().on('pointerdown', () => this._tapReel(i));
    });

    this.resultBanner = UI.text(this, width / 2, reelY + reelH / 2 + 34, '', 'heading', { size: 17, origin: 0.5, color: UI.T.amber }).setAlpha(0);
    this.tellText = UI.text(this, width / 2, reelY + reelH / 2 + 34, 'The cabinet hums… something big is coming.', 'small',
      { size: 12, origin: 0.5, color: UI.T.amber }).setAlpha(0);

    // ── Paytable ──────────────────────────────────────────────────────────
    const payY = cabY + cabH / 2 + 46;
    UI.panel(this, width / 2, payY, width - 32, 64, { fill: UI.C.surface, stroke: UI.C.line, radius: 12 });
    UI.text(this, 32, payY - 16, 'PAYS (BOLTS)', 'label', { size: 10, origin: [0, 0.5] });
    const pays = CHROME_SYMBOLS.map(s => [s.glyph + s.glyph + s.glyph, THREE_MATCH_PAYOUT[s.glyph]]).concat([['ANY PAIR', TWO_MATCH_PAYOUT]]);
    const colW = (width - 48) / pays.length;
    pays.forEach(([k, v], i) => {
      const x = 24 + colW * i + colW / 2;
      UI.text(this, x, payY + 6, k, 'small', { size: k === 'ANY PAIR' ? 10 : 12, origin: 0.5, color: UI.T.dim });
      UI.text(this, x, payY + 22, String(v), 'number', { size: 14, origin: 0.5, color: UI.T.amber });
    });

    // ── Fatigue strip + spin ──────────────────────────────────────────────
    this.strip = Merchants.drawStrip(this, payY + 74, 'chrome', this.fx).refresh(this.fatigue);
    this.spinBtn = UI.button(this, width / 2, height - 76, width - 32, 68, {
      label: 'SPIN', sub: '', variant: 'primary', size: 22, onTap: () => this._startSpin()
    });
    this._refreshSpinButton();
    this._showTell();

    if (!this.saveData.tutorials.chrome) this.time.delayedCall(250, () => this._showTutorial());
  }

  _cost() { return Merchants.cost('chrome', this.fatigue, this.fx); }

  _refreshSpinButton() {
    const cost = this._cost(), ok = this.saveData.nuts >= cost;
    this.spinBtn.setLabel('SPIN', ok ? 'COSTS ' + cost + ' NUTS' : 'NEED ' + cost + ' NUTS — SELL TOWERS AT THE MARKET');
    this.spinBtn.setEnabled(ok && !this.spinning);
  }

  _rollResult() { return [this._weightedSymbol(), this._weightedSymbol(), this._weightedSymbol()]; }
  _isTriple(r) { return r[0] === r[1] && r[1] === r[2]; }
  _isWin(r)    { return r[0] === r[1] || r[1] === r[2] || r[0] === r[2]; }

  // Jackpot Sense: glow when the saved next spin is three of a kind
  _showTell() {
    const on = this.fx.hasMerchantJackpotTell() && this._isTriple(this.nextSpin) && !this.spinning;
    const { width } = this.scale;
    this.cabGlow.clear();
    if (this._tellTween) { this._tellTween.stop(); this._tellTween = null; }
    this.tellText.setAlpha(0);
    if (!on) return;
    this.cabGlow.fillStyle(UI.C.amber, 0.22);
    this.cabGlow.fillRoundedRect(16 - 8, this.cabY - this.cabH / 2 - 8, width - 32 + 16, this.cabH + 16, 24);
    this._tellTween = this.tweens.add({ targets: [this.cabGlow, this.tellText], alpha: { from: 0.25, to: 1 }, duration: 600, yoyo: true, repeat: -1 });
  }

  _startSpin() {
    if (this.spinning) return;
    const cost = this._cost();
    if (this.saveData.nuts < cost) return;

    let result = this.nextSpin.slice();
    this.lucky = false;
    if (!this._isWin(result) && Math.random() < Merchants.luck('chrome', this.fx)) {
      result = this._rollResult();
      this.lucky = this._isWin(result);
    }
    if (!this._isWin(result) && this.pityCount >= CHROME_PITY_SPINS) result[1] = result[0];
    this._pendingResults = result;
    this.nextSpin = this._rollResult();

    this.saveData.nuts -= cost;
    this._save();   // persist the stake now — reloading mid-spin must not refund it
    this.hdr.chips.nuts.setValue(this.saveData.nuts);
    this.spinning     = true;
    this.reelSpinning = [true, true, true];
    this.reelStopped  = [false, false, false];
    this._showTell();
    this.tweens.add({ targets: this.resultBanner, alpha: 0, duration: 100 });

    this.reelDisplays.forEach((d, i) => {
      d.setColor('#8899aa');
      this._spinReel(i);
      this.time.delayedCall(700, () => {
        if (this.reelSpinning[i]) this.tweens.add({ targets: d.stopLabel, alpha: 1, duration: 200 });
      });
      this.autoStopTimers[i] = this.time.delayedCall(REEL_AUTO_STOP_MS[i], () => this._tapReel(i));
    });
    this.spinBtn.setEnabled(false).setLabel('SPINNING', 'TAP A REEL TO STOP IT EARLY');
  }

  _spinReel(i) {
    if (!this.reelSpinning[i]) return;
    const n = Math.floor(Math.random() * CHROME_SYMBOLS.length);
    this.reelDisplays[i].setText(CHROME_SYMBOLS[n].glyph);
    this.reelBgs[i].drawBg(true);
    this.reelTimers[i] = this.time.delayedCall(80, () => this._spinReel(i));
  }

  _tapReel(i) {
    if (!this.spinning || !this.reelSpinning[i]) return;
    this.reelSpinning[i] = false;
    if (this.reelTimers[i])     { this.reelTimers[i].remove(false);     this.reelTimers[i] = null; }
    if (this.autoStopTimers[i]) { this.autoStopTimers[i].remove(false); this.autoStopTimers[i] = null; }
    const r = this._pendingResults[i];
    this.reelDisplays[i].setText(CHROME_SYMBOLS[r].glyph).setColor('#eef2f8');
    this.reelBgs[i].drawBg(false);
    this.tweens.add({ targets: this.reelDisplays[i].stopLabel, alpha: 0, duration: 100 });
    this.tweens.add({ targets: this.reelDisplays[i], scale: { from: 1.18, to: 1 }, duration: 160 });
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
    let raw = 0, msg = '', col = UI.T.mute;
    const triple = g[0] === g[1] && g[1] === g[2];
    if (triple) {
      raw = THREE_MATCH_PAYOUT[g[0]] || 3; msg = g[0] + ' ' + g[0] + ' ' + g[0] + '   JACKPOT'; col = UI.T.amber;
      this.cameras.main.flash(220, 242, 169, 59, false);
    } else if (g[0] === g[1] || g[1] === g[2] || g[0] === g[2]) {
      raw = TWO_MATCH_PAYOUT; msg = 'PAIR'; col = '#7cc4f2';
    } else {
      msg = 'NO MATCH';
    }
    if (this.lucky && raw > 0) msg = 'LUCKY RE-SPIN — ' + msg;

    const payout = Merchants.payout(raw, 'chrome', this.fatigue, this.fx);
    this.pityCount = payout === 0 ? this.pityCount + 1 : 0;

    if (payout > 0) {
      this.saveData.bolts += payout;
      this.hdr.chips.bolts.setValue(this.saveData.bolts).pulse();
      Merchants.popBolts(this, this.scale.width / 2, this.reelY - 50, payout);
    }
    if (triple) this.reelDisplays.forEach(d => d.setColor(UI.T.amber));
    else [[0, 1], [1, 2], [0, 2]].forEach(([a, b]) => {
      if (g[a] === g[b]) { this.reelDisplays[a].setColor('#7cc4f2'); this.reelDisplays[b].setColor('#7cc4f2'); }
    });

    this.resultBanner.setText(msg + (payout > 0 ? '   +' + payout : '')).setColor(col);
    this.tweens.add({ targets: this.resultBanner, alpha: 1, duration: 250 });

    this.fatigue++;
    this._save();
    this.strip.refresh(this.fatigue);
    this.spinning = false;
    this.reelStopped = [false, false, false];
    this._refreshSpinButton();
    // Jackpot Sense: once the result has been read, swap the banner for the tell
    if (this.fx.hasMerchantJackpotTell() && this._isTriple(this.nextSpin)) {
      this.time.delayedCall(1200, () => { if (!this.spinning) { this.resultBanner.setAlpha(0); this._showTell(); } });
    }
  }

  _save() {
    const st = { pityCount: this.pityCount, next: this.nextSpin };
    const bolts = this.saveData.bolts, nuts = this.saveData.nuts, fat = this.fatigue;
    this.saveData = SaveManager.update(s => {
      s.nuts = nuts; s.bolts = bolts;
      if (!s.merchantFatigue) s.merchantFatigue = {};
      s.merchantFatigue.chrome = fat;
      s.chromeState = st;
    }) || this.saveData;
  }

  _showTutorial() {
    const { width, height } = this.scale;
    Merchants.tour(this, 'chrome', [
      { title: 'Meet Chrome', body: Merchants.get('chrome').bio + '\n\nEach spin costs nuts and can win bolts.' },
      { target: { x: width / 2, y: this.reelY, w: this.reelGap * 2 + this.reelW, h: this.reelH }, title: 'Three reels',
        body: 'Reels stop on their own, or tap one to stop it early. Three of a kind pays big; any pair pays 1 bolt.' },
      { target: { x: width / 2, y: this.cabY + this.cabH / 2 + 46, w: width - 32, h: 64 }, title: 'The paytable',
        body: 'Rarer symbols pay more. ★★★ is the jackpot.' },
      { target: { x: width / 2, y: this.cabY + this.cabH / 2 + 120, w: width - 32, h: 58 }, title: 'Fatigue',
        body: 'Your first few spins are full price. After that each spin costs a bit more and pays a bit less. Merchants rest after every battle you win.' },
      { target: { x: width / 2, y: height - 76, w: width - 32, h: 68 }, title: 'Spin', body: 'Out of nuts? Sell spare towers at the Market\'s trade counter.' }
    ]);
  }
}
