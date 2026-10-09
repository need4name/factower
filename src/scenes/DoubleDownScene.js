// ── DoubleDownScene.js ────────────────────────────────────────────────────────
// Farkle-style dice. Pay once to start a round, then roll six dice. Dice that
// score are set aside automatically and the rest can be rolled again for more
// points — but a roll with nothing scoring (a Farkle) ends the round and loses
// everything. Bank at 300+ points; every 200 points is about 1 bolt.

const DD_MIN_BANK    = 300;
const DD_PTS_PER_BOLT = 200;   // keeps bolts-per-nut in line with the other merchants
const DD_ALL_IN_MULT = 5;     // All-In (Uplink) pays 5× bolts
const DD_ALL_IN_MIN  = 5;     // …and needs at least 5 rounds' worth of nuts

class DoubleDownScene extends Phaser.Scene {
  constructor() { super({ key: 'DoubleDownScene' }); }

  create() {
    const { width, height } = this.scale;
    this.saveData = SaveManager.load() || {};
    if (!Merchants.isRecruited(this.saveData, 'doubleDown')) { this.scene.start('MarketplaceScene'); return; }
    this.saveData = SaveManager.update(s => {
      if (!s.flags) s.flags = {};
      if (!s.flags.merchantsMet) s.flags.merchantsMet = {};
      s.flags.merchantsMet.doubleDown = true;
      if (!s.merchantFatigue) s.merchantFatigue = { chrome: 0, ricochet: 0, doubleDown: 0 };
      if (!s.tutorials) s.tutorials = {};
      s.nuts = s.nuts || 0; s.bolts = s.bolts || 0;
    }) || this.saveData;

    this.fx       = Merchants.effects(this.saveData);
    this.fatigue  = Merchants.fatigue(this.saveData, 'doubleDown');
    this.inRound  = false;
    this.allIn    = false;
    this.accScore = 0;
    this.rollScore = 0;
    this.rolling  = false;
    this.lastEvent = null;     // 'farkle' | 'bank' | null — drives the banner between rounds
    this.dice     = this._freshDice();

    UI.backdrop(this);
    UI.fadeIn(this);
    this.hdr = UI.header(this, {
      title: 'DOUBLE-DOWN', sub: 'PRESS YOUR LUCK', accent: UI.C.red,
      onBack: () => { if (this.rolling) return; this._leave(); },
      chips: [{ kind: 'nuts', value: this.saveData.nuts }, { kind: 'bolts', value: this.saveData.bolts }]
    });

    // ── Instruction banner ────────────────────────────────────────────────
    this.bannerY = UI.HEADER_H + 36;
    this.bannerG = this.add.graphics();
    this.bannerTxt = UI.text(this, width / 2, this.bannerY, '', 'bodyB', { size: 13, origin: 0.5, align: 'center', wrap: width - 64 });

    // ── Score panel ───────────────────────────────────────────────────────
    const scoreY = this.bannerY + 74;
    this.scoreY = scoreY;
    UI.panel(this, width / 2, scoreY, width - 32, 70, { fill: UI.C.surface, stroke: UI.C.line, radius: 14 });
    UI.text(this, 34, scoreY - 18, 'ROUND', 'label', { size: 10, origin: [0, 0.5] });
    this.accText  = UI.text(this, 34, scoreY + 8, '0', 'number', { size: 26, origin: [0, 0.5] });
    this.rollText = UI.text(this, 34 + 90, scoreY + 10, '', 'small', { size: 12, origin: [0, 0.5], color: UI.T.green });
    UI.text(this, width - 34, scoreY - 18, 'BANK FOR', 'label', { size: 10, origin: [1, 0.5] });
    this.boltPreview = UI.text(this, width - 34, scoreY + 8, '—', 'number', { size: 20, origin: [1, 0.5], color: UI.T.faint });

    // ── Dice ──────────────────────────────────────────────────────────────
    this._buildDice(scoreY + 62);

    // ── Breakdown + scoring guide ─────────────────────────────────────────
    this.breakdownText = UI.text(this, width / 2, this.diceBottom + 22, '', 'small', { size: 12, origin: 0.5, color: UI.T.green, align: 'center', wrap: width - 40 });
    const guideY = this.diceBottom + 66;
    this.guideY = guideY;
    UI.panel(this, width / 2, guideY, width - 32, 50, { fill: UI.C.surface, stroke: UI.C.line, radius: 12 });
    UI.text(this, width / 2, guideY - 9, 'Each 1 = 100   ·   each 5 = 50   ·   three pairs = 750', 'small', { size: 12, origin: 0.5, color: UI.T.dim });
    UI.text(this, width / 2, guideY + 10, 'Three of a kind = face × 100 (three 1s = 1000)', 'small', { size: 12, origin: 0.5, color: UI.T.dim });

    // ── Fatigue + buttons ─────────────────────────────────────────────────
    this.strip = Merchants.drawStrip(this, guideY + 64, 'doubleDown', this.fx).refresh(this.fatigue);

    const bY = height - 72, half = (width - 44) / 2;
    this.rollBtn = UI.button(this, 16 + half / 2, bY, half, 64, {
      label: 'PLAY', sub: '', variant: 'primary', colour: UI.C.red, size: 20,
      onTap: () => { if (this.rolling) return; if (!this.inRound) this._startRound(false); else this._doRoll(); }
    });
    this.bankBtn = UI.button(this, width - 16 - half / 2, bY, half, 64, {
      label: 'BANK', sub: 'NEED ' + DD_MIN_BANK + ' PTS', variant: 'success', size: 20, onTap: () => this._doBank()
    });
    this.allInBtn = null;
    if (this.fx.isMerchantAllInUnlocked()) {
      this.allInBtn = UI.button(this, width / 2, bY - 62, width - 32, 44, {
        label: 'ALL IN', sub: '', variant: 'outline', colour: UI.C.red, size: 15, onTap: () => this._confirmAllIn()
      });
    }

    this._render();
    if (!this.saveData.tutorials.doubleDown) this.time.delayedCall(250, () => this._showTutorial());
  }

  _freshDice() { return Array(6).fill(null).map(() => ({ value: 1, locked: false, scored: false })); }
  _cost() { return Merchants.cost('doubleDown', this.fatigue, this.fx); }

  _leave() {
    if (this.inRound && this.accScore > 0) {
      UI.modal(this, {
        title: 'Walk away?', icon: 'back', accent: UI.C.red,
        body: 'You have ' + this.accScore + ' points on the table. Leaving now forfeits them' + (this.accScore >= DD_MIN_BANK ? ' — bank first to keep them.' : '.'),
        buttons: [{ label: 'STAY' }, { label: 'LEAVE', variant: 'danger', onTap: () => UI.go(this, 'MarketplaceScene') }]
      });
      return;
    }
    UI.go(this, 'MarketplaceScene');
  }

  // ── Dice area ─────────────────────────────────────────────────────────
  _buildDice(top) {
    const { width } = this.scale;
    const dw = 96, dh = 80, gx = 108, gy = 92;
    this.diceObjects = [];
    for (let i = 0; i < 6; i++) {
      const x = width / 2 + ((i % 3) - 1) * gx;
      const y = top + dh / 2 + Math.floor(i / 3) * gy;
      const g = this.add.graphics();
      const pip = UI.text(this, x, y - 6, '–', 'hero', { size: 34, origin: 0.5, color: UI.T.faint });
      const lbl = UI.text(this, x, y + 26, '', 'tag', { size: 9, origin: 0.5 });
      this.diceObjects.push({ g, pip, lbl, x, y, w: dw, h: dh });
    }
    this.diceTop = top;
    this.diceBottom = top + dh + gy;
  }

  // ── Round logic ───────────────────────────────────────────────────────
  _startRound(allIn) {
    const stake = allIn ? this.saveData.nuts : this._cost();
    if (this.saveData.nuts < stake || stake <= 0) return;
    this.saveData.nuts -= stake;
    this.fatigue++;          // every round played tires the merchant, win or lose
    this._save();            // persist the stake now — reloading mid-round must not refund it
    this.hdr.chips.nuts.setValue(this.saveData.nuts);
    this.inRound = true;
    this.allIn = !!allIn;
    this.accScore = 0;
    this.rollScore = 0;
    this.lastEvent = null;
    this.dice = this._freshDice();
    this.strip.refresh(this.fatigue);
    this._doRoll();
  }

  _confirmAllIn() {
    if (this.inRound || this.rolling) return;
    const n = this.saveData.nuts;
    UI.modal(this, {
      title: 'Go all in?', icon: 'nut', accent: UI.C.red,
      body: 'Stake all ' + n + ' nuts on one round. Bank it and you win ' + DD_ALL_IN_MULT + '× the bolts. Farkle and every nut is gone.',
      buttons: [{ label: 'NOT NOW' }, { label: 'ALL IN', variant: 'danger', onTap: () => this._startRound(true) }]
    });
  }

  _doRoll() {
    if (this.rolling || !this.inRound) return;
    // Scoring dice from the last roll are set aside; with all six set aside
    // you get "hot dice" and roll all six again.
    this.dice.forEach(d => { if (d.scored) d.locked = true; d.scored = false; });
    if (this.dice.every(d => d.locked)) this.dice.forEach(d => { d.locked = false; });
    this.rolling = true;
    this.breakdownText.setText('');
    this._render();
    this._animateRoll(() => {
      this._rollFree();
      let result = this._scoreDice();
      let lucky = false;
      if (result.score === 0 && Math.random() < Merchants.luck('doubleDown', this.fx)) {
        this._rollFree();
        result = this._scoreDice();
        lucky = result.score > 0;
      }
      this.rolling = false;
      if (result.score === 0) return this._farkle();
      this.rollScore = result.score;
      this.accScore += result.score;
      result.scoringIndices.forEach(i => { this.dice[i].scored = true; });
      this.breakdownText.setText((lucky ? 'SECOND WIND!  ' : '') + result.breakdown).setColor(lucky ? UI.T.amber : UI.T.green);
      this._render();
    });
  }

  _rollFree() { this.dice.forEach(d => { if (!d.locked) d.value = Math.floor(Math.random() * 6) + 1; }); }

  _animateRoll(onComplete) {
    let ticks = 0;
    const tick = () => {
      this.dice.forEach(d => { if (!d.locked) d.value = Math.floor(Math.random() * 6) + 1; });
      this._renderDice(true);
      ticks++;
      if (ticks < 8) this.time.delayedCall(60, tick); else this.time.delayedCall(60, onComplete);
    };
    tick();
  }

  // ── Scoring ───────────────────────────────────────────────────────────
  // 1s=100, 5s=50, three of a kind = face×100 (1s=1000).
  // 4× = 2× the 3× value, 5× = 4×, 6× = 8×. Three pairs = 750.
  _scoreDice() {
    const vals   = this.dice.map((d, i) => ({ v: d.value, i })).filter(d => !this.dice[d.i].locked);
    const counts = [0, 0, 0, 0, 0, 0, 0];
    vals.forEach(d => counts[d.v]++);
    let score = 0;
    const scoringIndices = [], parts = [];

    if (vals.length === 6 && counts.slice(1).filter(c => c === 2).length === 3) {
      return { score: 750, breakdown: 'Three pairs  +750', scoringIndices: vals.map(d => d.i) };
    }
    for (let face = 1; face <= 6; face++) {
      const c = counts[face];
      if (c >= 3) {
        const base = face === 1 ? 1000 : face * 100;
        const pts = base * (c === 4 ? 2 : c === 5 ? 4 : c === 6 ? 8 : 1);
        score += pts; parts.push(c + '× ' + face + '  +' + pts);
        vals.filter(d => d.v === face).forEach(d => scoringIndices.push(d.i));
        counts[face] = 0;
      }
    }
    if (counts[1] > 0) { score += counts[1] * 100; parts.push(counts[1] + '× 1  +' + counts[1] * 100); vals.filter(d => d.v === 1).forEach(d => scoringIndices.push(d.i)); }
    if (counts[5] > 0) { score += counts[5] * 50;  parts.push(counts[5] + '× 5  +' + counts[5] * 50);  vals.filter(d => d.v === 5).forEach(d => scoringIndices.push(d.i)); }
    return { score, breakdown: parts.join('    '), scoringIndices: Array.from(new Set(scoringIndices)) };
  }

  _farkle() {
    const lost = this.accScore;
    this.inRound = false;
    this.allIn = false;
    this.accScore = 0; this.rollScore = 0;
    this.lastEvent = 'farkle';
    this.dice.forEach(d => { d.scored = false; d.locked = false; });
    this.breakdownText.setText('FARKLE — nothing scored.' + (lost > 0 ? ' ' + lost + ' points lost.' : '')).setColor(UI.T.red);
    this.cameras.main.shake(200, 0.008);
    this._save();
    this._render();
  }

  _payoutFor(score) {
    const p = Merchants.payout(score / DD_PTS_PER_BOLT, 'doubleDown', this.fatigue - 1, this.fx);
    return this.allIn ? p * DD_ALL_IN_MULT : p;
  }

  _doBank() {
    if (!this.inRound || this.accScore < DD_MIN_BANK || this.rolling) return;
    const payout = this._payoutFor(this.accScore);
    this.saveData.bolts += payout;
    this.inRound = false;
    this.allIn = false;
    this.lastEvent = 'bank';
    this._save();
    this.hdr.chips.bolts.setValue(this.saveData.bolts).pulse();
    Merchants.popBolts(this, this.scale.width / 2, this.diceTop + 80, payout, UI.T.green);
    this.breakdownText.setText('Banked ' + this.accScore + ' points').setColor(UI.T.green);
    this.accScore = 0; this.rollScore = 0;
    this.dice = this._freshDice();
    this._render();
  }

  // ── Rendering ─────────────────────────────────────────────────────────
  _renderDice(animating) {
    this.diceObjects.forEach((o, i) => {
      const d = this.dice[i];
      const live = this.inRound || animating;
      const col = d.locked ? UI.C.amber : d.scored ? UI.C.green : UI.C.line;
      o.g.clear();
      o.g.fillStyle(d.locked ? 0x1f1808 : d.scored ? 0x0d1e14 : UI.C.surface2, 1);
      o.g.fillRoundedRect(o.x - o.w / 2, o.y - o.h / 2, o.w, o.h, 14);
      o.g.lineStyle(2, col, live ? 1 : 0.4);
      o.g.strokeRoundedRect(o.x - o.w / 2, o.y - o.h / 2, o.w, o.h, 14);
      const txt = d.locked ? UI.T.amber : d.scored ? UI.T.green : (live ? UI.T.text : UI.T.faint);
      o.pip.setText(animating && !d.locked ? '?' : (live || this.lastEvent ? String(d.value) : '–')).setColor(txt);
      o.lbl.setText(d.locked ? 'SET ASIDE' : d.scored ? 'SCORES' : '').setColor(d.locked ? UI.T.amber : UI.T.green);
    });
  }

  _render() {
    this._renderDice(false);
    this.accText.setText(String(this.accScore)).setColor(this.accScore >= DD_MIN_BANK ? UI.T.text : UI.T.dim);
    this.rollText.setText(this.inRound && this.rollScore > 0 ? '+' + this.rollScore + ' last roll' : '');
    this.boltPreview.setText(this.inRound && this.accScore >= DD_MIN_BANK ? '+' + this._payoutFor(this.accScore) + ' B' : '—')
      .setColor(this.inRound && this.accScore >= DD_MIN_BANK ? '#7cc4f2' : UI.T.faint);

    const cost = this._cost();
    const canStart = !this.inRound && !this.rolling && this.saveData.nuts >= cost;
    const free = this.dice.filter(d => !d.locked && !d.scored).length || 6;
    if (this.inRound) this.rollBtn.setLabel('ROLL ' + free, 'RISK ' + this.accScore + ' PTS').setEnabled(!this.rolling);
    else this.rollBtn.setLabel('PLAY', this.saveData.nuts >= cost ? 'COSTS ' + cost + ' NUTS' : 'NEED ' + cost + ' NUTS').setEnabled(canStart);
    this.bankBtn.setLabel('BANK', this.accScore >= DD_MIN_BANK ? 'KEEP IT' : 'NEED ' + DD_MIN_BANK + ' PTS')
      .setEnabled(this.inRound && this.accScore >= DD_MIN_BANK && !this.rolling);
    if (this.allInBtn) {
      const okAllIn = !this.inRound && !this.rolling && this.saveData.nuts >= cost * DD_ALL_IN_MIN;
      this.allInBtn.setVisible(!this.inRound);
      this.allInBtn.setLabel('ALL IN — ' + this.saveData.nuts + ' NUTS FOR ' + DD_ALL_IN_MULT + '× BOLTS').setEnabled(okAllIn);
    }
    this._renderBanner(cost);
  }

  _renderBanner(cost) {
    const { width } = this.scale;
    let msg, col;
    if (this.rolling)                { msg = 'Rolling…'; col = UI.C.steel; }
    else if (!this.inRound && this.lastEvent === 'farkle') { msg = 'Farkle! The round is over. Tap PLAY to try again.'; col = UI.C.red; }
    else if (!this.inRound && this.lastEvent === 'bank')   { msg = 'Banked! Tap PLAY for another round.'; col = UI.C.green; }
    else if (!this.inRound)          { msg = 'Tap PLAY to start a round (' + cost + ' nuts). Score 1s, 5s and three of a kind.'; col = UI.C.amber; }
    else if (this.accScore < DD_MIN_BANK) { msg = 'Green dice score and are set aside. Roll the rest — you need ' + DD_MIN_BANK + ' to bank.'; col = UI.C.green; }
    else                             { msg = (this.allIn ? 'ALL IN. ' : '') + 'Bank your points, or roll again and risk them all.'; col = UI.C.green; }
    this.bannerTxt.setText(msg);
    UI.drawPanel(this.bannerG, width / 2, this.bannerY, width - 32, 56, { fill: UI.C.surface, stroke: col, strokeAlpha: 0.8, radius: 12, accent: col });
  }

  _save() {
    const nuts = this.saveData.nuts, bolts = this.saveData.bolts, fat = this.fatigue;
    this.saveData = SaveManager.update(s => {
      s.nuts = nuts; s.bolts = bolts;
      if (!s.merchantFatigue) s.merchantFatigue = {};
      s.merchantFatigue.doubleDown = fat;
    }) || this.saveData;
  }

  _showTutorial() {
    const { width, height } = this.scale;
    Merchants.tour(this, 'doubleDown', [
      { title: 'Meet Double-Down', body: Merchants.get('doubleDown').bio + '\n\nPay once per round, then push your luck.' },
      { target: { x: width / 2, y: this.diceTop + 86, w: 316, h: 172 }, title: 'Roll six dice',
        body: '1s, 5s and three of a kind score. Scoring dice are set aside automatically — roll the rest for more points.' },
      { target: { x: width / 2, y: this.guideY, w: width - 32, h: 50 }, title: 'What scores', body: 'Keep this guide in view while you play.' },
      { target: { x: width / 2, y: height - 72, w: width - 32, h: 64 }, title: 'Bank or roll',
        body: 'A roll where nothing scores is a Farkle: the round ends and the points are lost. Bank at ' + DD_MIN_BANK + '+ points — every ' + DD_PTS_PER_BOLT + ' is about 1 bolt.' }
    ]);
  }
}
