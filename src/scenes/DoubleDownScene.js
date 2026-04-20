// ── DoubleDownScene.js ────────────────────────────────────────────────────────
// Farkle dice game. Roll 6 dice. Scoring dice glow green — tap to hold them.
// Roll remaining dice or bank your points. Farkle (no scoring dice) = lose all.
// Minimum 300 pts to bank. 100 pts = 1 Bolt.
//
// Simplified from previous version: mod chips removed. A persistent instruction
// banner always tells the player exactly what to do next.

const DD_BASE_COST = 4;

class DoubleDownScene extends Phaser.Scene {
  constructor() { super({ key: 'DoubleDownScene' }); }

  create() {
    const { width, height } = this.scale;
    const slotIndex  = localStorage.getItem('factower_active_slot');
    this.saveKey     = 'factower_save_' + slotIndex;
    this.saveData    = JSON.parse(localStorage.getItem(this.saveKey)) || {};
    if (!this.saveData.nuts)            this.saveData.nuts = 0;
    if (!this.saveData.bolts)           this.saveData.bolts = 0;
    if (!this.saveData.merchantFatigue) this.saveData.merchantFatigue = { chrome: 0, ricochet: 0, doubleDown: 0 };
    if (!this.saveData.tutorials)       this.saveData.tutorials = {};

    this.fatigue   = this.saveData.merchantFatigue.doubleDown || 0;

    // Round state
    this.inRound   = false;
    this.accScore  = 0;     // pts accumulated this round (across rolls)
    this.rollScore = 0;     // pts scored on the most recent roll
    this.rolling   = false;
    this.farkled   = false;
    this.dice      = [];    // { value, held, scored } x6
    this.minBank   = 300;

    // ── Background & header ───────────────────────────────────────────────
    this.add.rectangle(width / 2, height / 2, width, height, 0x0d1117);
    this.add.rectangle(width / 2, 0, width, 4, 0xc43a3a, 0.4);
    this.add.rectangle(width / 2, 144, width, 100, 0x161b22);
    this.add.rectangle(width / 2, 194, width, 1, 0x334455);

    const back = this.add.rectangle(44, 144, 72, 48, 0x1e2530).setInteractive();
    this.add.text(44, 144, '<- BACK', { fontFamily: 'monospace', fontSize: '14px', color: '#e8a020' }).setOrigin(0.5);
    back.on('pointerdown', () => {
      if (this.inRound) return;
      this._save();
      this.cameras.main.fade(200, 0, 0, 0);
      this.time.delayedCall(200, () => this.scene.start('MarketplaceScene'));
    });
    back.on('pointerover', () => back.setFillStyle(0x252c38));
    back.on('pointerout',  () => back.setFillStyle(0x1e2530));

    this.add.text(width / 2 + 20, 125, 'DOUBLE-DOWN', { fontFamily: 'monospace', fontSize: '22px', color: '#c43a3a', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(width / 2 + 20, 152, 'PRESS YOUR LUCK', { fontFamily: 'monospace', fontSize: '11px', color: '#8899aa', letterSpacing: 2 }).setOrigin(0.5);

    this.nutsText  = this.add.text(width / 2 - 70, 216, this.saveData.nuts + ' NUTS',  { fontFamily: 'monospace', fontSize: '12px', color: '#e8a020',  fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(width / 2, 216, '\xb7', { fontFamily: 'monospace', fontSize: '12px', color: '#334455' }).setOrigin(0.5);
    this.boltsText = this.add.text(width / 2 + 70, 216, this.saveData.bolts + ' BOLTS', { fontFamily: 'monospace', fontSize: '12px', color: '#8ab4cc', fontStyle: 'bold' }).setOrigin(0.5);

    // ── Instruction banner ────────────────────────────────────────────────
    // Replaces the old mod chip area. Always visible, always tells the player
    // what action to take right now.
    const bannerY  = 244;
    this.bannerBg  = this.add.rectangle(width / 2, bannerY, width - 32, 44, 0x0f1318);
    this.bannerBdr = this.add.rectangle(width / 2, bannerY, width - 32, 44).setStrokeStyle(1, 0x334455);
    this.bannerTxt = this.add.text(width / 2, bannerY, '', {
      fontFamily: 'monospace', fontSize: '11px', color: '#e8a020',
      fontStyle: 'bold', align: 'center', letterSpacing: 1,
      wordWrap: { width: width - 56 }
    }).setOrigin(0.5);

    // ── Score panel ───────────────────────────────────────────────────────
    const scoreY = 304;
    this.add.rectangle(width / 2, scoreY, width - 32, 56, 0x0f1318);
    this.add.rectangle(width / 2, scoreY, width - 32, 56).setStrokeStyle(1, 0x334455);
    this.accText     = this.add.text(60, scoreY - 12, 'ROUND  0 pts',  { fontFamily: 'monospace', fontSize: '11px', color: '#8899aa' });
    this.rollText    = this.add.text(60, scoreY + 6,  'LAST ROLL  \u2014', { fontFamily: 'monospace', fontSize: '11px', color: '#eef2f8' });
    this.boltPreview = this.add.text(width - 24, scoreY, '', { fontFamily: 'monospace', fontSize: '13px', color: '#8ab4cc', fontStyle: 'bold' }).setOrigin(1, 0.5);

    // ── Dice grid (2 rows of 3) ───────────────────────────────────────────
    this._buildDiceArea(width);

    // ── Score breakdown (what scored last roll) ───────────────────────────
    this.breakdownText = this.add.text(width / 2, 532, '', {
      fontFamily: 'monospace', fontSize: '10px', color: '#5eba7d', align: 'center', letterSpacing: 1
    }).setOrigin(0.5);

    // ── Action buttons ────────────────────────────────────────────────────
    this._buildButtons(width, height);

    // ── Fatigue strip ─────────────────────────────────────────────────────
    const fatY = 606;
    this.add.text(width / 2, fatY, 'FATIGUE', { fontFamily: 'monospace', fontSize: '9px', color: '#445566', letterSpacing: 3 }).setOrigin(0.5);
    const bW = width - 80, bY = fatY + 14;
    this.add.rectangle(width / 2, bY, bW, 6, 0x1a2230);
    this.fatigueFill  = this.add.rectangle(width / 2 - bW / 2, bY, 2, 6, 0xc43a3a).setOrigin(0, 0.5);
    this.fatigueLabel = this.add.text(width / 2, bY + 13, this._fatigueText(), { fontFamily: 'monospace', fontSize: '9px', color: '#556677' }).setOrigin(0.5);
    this._updateFatigueBar(bW);

    this._refreshUI();

    if (!this.saveData.tutorials.doubleDown) {
      this.time.delayedCall(200, () => this._showTutorial());
    }
  }

  // ── Dice area ─────────────────────────────────────────────────────────────

  _buildDiceArea(width) {
    const dY = [392, 474];
    const dX = [84, 195, 306];
    this.diceObjects = [];

    for (let i = 0; i < 6; i++) {
      const row = Math.floor(i / 3), col = i % 3;
      const x   = dX[col], y = dY[row];
      const bg  = this.add.rectangle(x, y, 78, 70, 0x161b22);
      const bdr = this.add.rectangle(x, y, 78, 70).setStrokeStyle(2, 0x334455);
      const pip = this.add.text(x, y - 6, '\u2014', { fontFamily: 'monospace', fontSize: '28px', color: '#445566', fontStyle: 'bold' }).setOrigin(0.5);
      const lbl = this.add.text(x, y + 24, '', { fontFamily: 'monospace', fontSize: '9px', color: '#e8a020', letterSpacing: 2 }).setOrigin(0.5);
      this.diceObjects.push({ bg, bdr, pip, lbl });
      bg.setInteractive();
      bg.on('pointerdown', () => this._toggleHold(i));
    }
  }

  // ── Buttons ───────────────────────────────────────────────────────────────

  _buildButtons(width, height) {
    const bY   = height - 72;
    const half = (width - 60) / 2;

    // ROLL / PLAY button — single unified handler, no accumulation bug
    this.rollBg  = this.add.rectangle(24 + half / 2, bY, half, 60, 0x1a0808).setInteractive();
    this.rollBdr = this.add.rectangle(24 + half / 2, bY, half, 60).setStrokeStyle(2, 0xc43a3a);
    this.rollTxt = this.add.text(24 + half / 2, bY - 9, 'PLAY', { fontFamily: 'monospace', fontSize: '20px', color: '#c43a3a', fontStyle: 'bold' }).setOrigin(0.5);
    this.rollSub = this.add.text(24 + half / 2, bY + 14, '', { fontFamily: 'monospace', fontSize: '9px', color: '#556677', letterSpacing: 1 }).setOrigin(0.5);
    this.rollBg.on('pointerdown', () => {
      if (this.rolling) return;
      if (!this.inRound) this._startRound();
      else               this._doRoll();
    });
    this.rollBg.on('pointerover', () => this.rollBg.setFillStyle(0x261008));
    this.rollBg.on('pointerout',  () => this.rollBg.setFillStyle(0x1a0808));

    // BANK button
    const bx2    = width - 24 - half / 2;
    this.bankBg  = this.add.rectangle(bx2, bY, half, 60, 0x0d1e10).setInteractive();
    this.bankBdr = this.add.rectangle(bx2, bY, half, 60).setStrokeStyle(2, 0x5eba7d);
    this.bankTxt = this.add.text(bx2, bY - 9, 'BANK', { fontFamily: 'monospace', fontSize: '20px', color: '#5eba7d', fontStyle: 'bold' }).setOrigin(0.5);
    this.bankSub = this.add.text(bx2, bY + 14, 'MIN 300 pts', { fontFamily: 'monospace', fontSize: '9px', color: '#556677', letterSpacing: 1 }).setOrigin(0.5);
    this.bankBg.on('pointerdown', () => this._doBank());
    this.bankBg.on('pointerover', () => this.bankBg.setFillStyle(0x122018));
    this.bankBg.on('pointerout',  () => this.bankBg.setFillStyle(0x0d1e10));
  }

  // ── Round logic ───────────────────────────────────────────────────────────

  _startRound() {
    const cost = this._rollCost();
    if (this.saveData.nuts < cost) return;
    this.saveData.nuts -= cost;
    this.nutsText.setText(this.saveData.nuts + ' NUTS');
    this._save();

    this.inRound   = true;
    this.accScore  = 0;
    this.rollScore = 0;
    this.farkled   = false;
    this.dice      = Array(6).fill(null).map(() => ({ value: 1, held: false, scored: false }));
    this._doRoll();
  }

  _doRoll() {
    if (this.rolling) return;
    this.farkled = false;

    // Clear scored flags — held dice keep their values, free dice will be rerolled
    this.dice.forEach(d => { d.scored = false; });

    // If all dice are held, release them for a fresh roll of all 6
    if (this.dice.every(d => d.held)) {
      this.dice.forEach(d => { d.held = false; });
    }

    this.rolling = true;
    this._refreshUI();

    this._animateRoll(() => {
      // Reroll all unheld dice
      this.dice.forEach(d => { if (!d.held) d.value = Math.floor(Math.random() * 6) + 1; });

      const result = this._scoreDice();
      this.rolling = false;

      if (result.score === 0) {
        this._farkle();
      } else {
        this.rollScore = result.score;
        this.accScore += this.rollScore;
        this.breakdownText.setText(result.breakdown);
        result.scoringIndices.forEach(i => { this.dice[i].scored = true; });
        this._updateDiceDisplay();
        this._updateScoreDisplay();
        this._refreshUI();
      }
    });
  }

  _animateRoll(onComplete) {
    let ticks = 0;
    const MAX  = 8;
    const tick = () => {
      this.dice.forEach(d => { if (!d.held) d.value = Math.floor(Math.random() * 6) + 1; });
      this._updateDiceDisplay(true);
      ticks++;
      if (ticks < MAX) this.time.delayedCall(60, tick);
      else             this.time.delayedCall(60, onComplete);
    };
    tick();
  }

  // ── Scoring ───────────────────────────────────────────────────────────────
  // Standard Farkle: 1s=100, 5s=50, three-of-a-kind=face*100 (1s=1000),
  // four/five/six-of-a-kind multiply the three-of-a-kind value.
  // Three pairs = 750 pts (only available on a full free roll of 6 dice).

  _scoreDice() {
    // Only score dice that are NOT held — held dice already counted
    const vals   = this.dice.map((d, i) => ({ v: d.value, i })).filter(d => !this.dice[d.i].held);
    const counts = [0, 0, 0, 0, 0, 0, 0];
    vals.forEach(d => counts[d.v]++);

    let score = 0;
    const scoringIndices = [];
    const parts = [];

    // Three pairs (only possible when all 6 dice are free)
    if (vals.length === 6 && counts.slice(1).filter(c => c === 2).length === 3) {
      return { score: 750, breakdown: 'THREE PAIRS  750 pts', scoringIndices: vals.map(d => d.i) };
    }

    // Three-of-a-kind or better
    for (let face = 1; face <= 6; face++) {
      const c = counts[face];
      if (c >= 3) {
        const base  = face === 1 ? 1000 : face * 100;
        const extra = c === 4 ? 2 : c === 5 ? 4 : c === 6 ? 8 : 1;
        const pts   = base * extra;
        score += pts;
        parts.push(c + '\xd7' + face + '  ' + pts + ' pts');
        let marked = 0;
        vals.forEach(d => { if (d.v === face && marked < c) { scoringIndices.push(d.i); marked++; } });
        counts[face] = 0; // consumed — no further singles from this face
      }
    }

    // Singles: remaining 1s and 5s
    if (counts[1] > 0) {
      const pts = counts[1] * 100;
      score += pts;
      parts.push(counts[1] + '\xd71  ' + pts + ' pts');
      let m = 0;
      vals.forEach(d => { if (d.v === 1 && m < counts[1]) { scoringIndices.push(d.i); m++; } });
    }
    if (counts[5] > 0) {
      const pts = counts[5] * 50;
      score += pts;
      parts.push(counts[5] + '\xd75  ' + pts + ' pts');
      let m = 0;
      vals.forEach(d => { if (d.v === 5 && m < counts[5]) { scoringIndices.push(d.i); m++; } });
    }

    return {
      score,
      breakdown: parts.join('   '),
      scoringIndices: Array.from(new Set(scoringIndices))
    };
  }

  _farkle() {
    this.farkled   = true;
    this.accScore  = 0;
    this.rollScore = 0;
    this.dice.forEach(d => {
      d.held   = false;
      d.scored = false;
      d.value  = Math.floor(Math.random() * 6) + 1;
    });
    this._updateDiceDisplay();
    this._updateScoreDisplay();
    this._refreshUI();
    this.breakdownText.setText('FARKLE \u2014 NO SCORING DICE');
    this.cameras.main.shake(200, 0.008);
  }

  _doBank() {
    if (!this.inRound || this.accScore < this.minBank || this.rolling) return;

    const mult   = Math.max(0.2, 1 / (1 + 0.08 * this.fatigue));
    const payout = Math.max(1, Math.floor(this.accScore / 100 * mult));

    this.saveData.bolts += payout;
    this.fatigue++;
    this.saveData.merchantFatigue.doubleDown = this.fatigue;
    this._save();

    this.boltsText.setText(this.saveData.bolts + ' BOLTS');
    this.tweens.add({ targets: this.boltsText, scaleX: 1.3, scaleY: 1.3, duration: 150, yoyo: true });

    const { width } = this.scale;
    const pop = this.add.text(width / 2, 360, 'BANKED  +' + payout + ' BOLTS', {
      fontFamily: 'monospace', fontSize: '18px', color: '#5eba7d', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(20).setAlpha(0);
    this.tweens.add({
      targets: pop, alpha: 1, duration: 200,
      onComplete: () => this.time.delayedCall(1000, () =>
        this.tweens.add({ targets: pop, alpha: 0, duration: 400, onComplete: () => pop.destroy() })
      )
    });

    this._endRound();
  }

  _endRound() {
    this.inRound   = false;
    this.accScore  = 0;
    this.rollScore = 0;
    this.farkled   = false;
    this.dice = Array(6).fill(null).map(() => ({ value: 1, held: false, scored: false }));
    this._updateDiceDisplay();
    this._updateScoreDisplay();
    this.breakdownText.setText('');
    const bW = this.scale.width - 80;
    this._updateFatigueBar(bW);
    this.fatigueLabel.setText(this._fatigueText());
    this._refreshUI();
  }

  // ── Dice interaction ──────────────────────────────────────────────────────

  _toggleHold(i) {
    if (!this.inRound || this.rolling) return;
    // Only allow holding dice that scored this roll
    if (!this.dice[i].scored) return;
    this.dice[i].held = !this.dice[i].held;
    this._updateDiceDisplay();
  }

  _updateDiceDisplay(animating) {
    this.diceObjects.forEach((obj, i) => {
      const d = this.dice[i] || { value: 1, held: false, scored: false };
      const col    = d.held ? 0xe8a020 : d.scored ? 0x5eba7d : 0x334455;
      const bgCol  = d.held ? 0x1a1200 : d.scored ? 0x0d1e10 : 0x161b22;
      const txtCol = d.held ? '#e8a020' : d.scored ? '#5eba7d' : (this.inRound ? '#eef2f8' : '#445566');
      obj.bg.setFillStyle(bgCol);
      obj.bdr.setStrokeStyle(2, col);
      obj.pip.setText(animating ? '?' : String(d.value)).setStyle({ color: txtCol });
      obj.lbl.setText(d.held ? 'HELD \u2605' : d.scored ? 'TAP TO HOLD' : '');
    });
  }

  _updateScoreDisplay() {
    const preview = this.accScore >= this.minBank
      ? '\u2192 +' + Math.floor(this.accScore / 100) + ' B'
      : '';
    this.accText.setText('ROUND  ' + this.accScore + ' pts');
    this.rollText.setText(this.rollScore > 0 ? 'LAST ROLL  +' + this.rollScore + ' pts' : 'LAST ROLL  \u2014');
    this.boltPreview.setText(preview);
  }

  // ── Instruction banner ────────────────────────────────────────────────────
  // This is the central UX improvement. Always tells the player what to do.

  _updateBanner() {
    const cost = this._rollCost();
    var msg = '', col = '#e8a020', borderCol = 0xe8a020;

    if (this.rolling) {
      msg       = 'ROLLING...';
      col       = '#8899aa';
      borderCol = 0x334455;
    } else if (!this.inRound) {
      msg       = 'TAP PLAY TO START  \xb7  COSTS ' + cost + ' NUTS';
      col       = '#e8a020';
      borderCol = 0xe8a020;
    } else if (this.farkled) {
      msg       = 'FARKLE \u2014 ALL POINTS LOST\nTAP PLAY TO START A NEW ROUND';
      col       = '#c43a3a';
      borderCol = 0xc43a3a;
    } else if (this.rollScore > 0) {
      msg       = 'TAP GREEN DICE TO HOLD  \xb7  THEN ROLL OR BANK';
      col       = '#5eba7d';
      borderCol = 0x5eba7d;
    }

    this.bannerTxt.setText(msg).setStyle({ color: col });
    this.bannerBdr.setStrokeStyle(1, borderCol);
  }

  // ── UI refresh ────────────────────────────────────────────────────────────

  _refreshUI() {
    const cost     = this._rollCost();
    const canStart = !this.inRound && this.saveData.nuts >= cost && !this.rolling;
    const canRoll  = this.inRound  && !this.rolling;
    const canBank  = this.inRound  && this.accScore >= this.minBank && !this.rolling;

    // ROLL / PLAY button
    const rollActive = canStart || canRoll;
    this.rollTxt.setText(this.inRound ? 'ROLL' : 'PLAY');
    this.rollTxt.setStyle({ color: rollActive ? '#c43a3a' : '#445566' });
    this.rollBg.setFillStyle(rollActive ? 0x1a0808 : 0x161b22);
    this.rollBdr.setStrokeStyle(2, rollActive ? 0xc43a3a : 0x334455);
    this.rollSub.setText(this.inRound ? 'PRESS YOUR LUCK' : 'COSTS ' + cost + ' NUTS');
    if (rollActive) this.rollBg.setInteractive(); else this.rollBg.disableInteractive();

    // BANK button
    this.bankTxt.setStyle({ color: canBank ? '#5eba7d' : '#445566' });
    this.bankBg.setFillStyle(canBank ? 0x0d1e10 : 0x161b22);
    this.bankBdr.setStrokeStyle(2, canBank ? 0x5eba7d : 0x334455);
    this.bankSub.setText('MIN ' + this.minBank + ' pts');
    if (canBank) this.bankBg.setInteractive(); else this.bankBg.disableInteractive();

    this._updateBanner();
  }

  // ── Fatigue ───────────────────────────────────────────────────────────────

  _rollCost() {
    return Math.min(Math.round(DD_BASE_COST * (1 + Math.pow(this.fatigue, 3) / 500)), 60);
  }
  _fatigueText() {
    if (this.fatigue === 0) return 'FRESH \u2014 FULL PAYOUTS';
    if (this.fatigue < 6)   return 'WARM (' + this.fatigue + ' ROUNDS)';
    if (this.fatigue < 14)  return 'TIRED (' + this.fatigue + ' ROUNDS) \u2014 REDUCED';
    return 'BURNT (' + this.fatigue + ' ROUNDS) \u2014 HEAVY REDUCTION';
  }
  _updateFatigueBar(bW) {
    const pct = Math.min(this.fatigue / 20, 1);
    const col = this.fatigue < 6 ? 0x5eba7d : this.fatigue < 14 ? 0xe8a020 : 0xc43a3a;
    this.fatigueFill.setSize(Math.max(2, bW * pct), 6).setFillStyle(col);
  }
  _save() {
    this.saveData.merchantFatigue.doubleDown = this.fatigue;
    localStorage.setItem(this.saveKey, JSON.stringify(this.saveData));
  }

  // ── Tutorial ──────────────────────────────────────────────────────────────

  _showTutorial() {
    const { width, height } = this.scale;
    const steps = [
      {
        tx: width / 2, ty: 433, tw: width - 24, th: 180,
        title: 'THE DICE',
        body:  'SIX DICE PER ROLL.\nSCORING DICE GLOW GREEN.\nTAP GREEN DICE TO HOLD THEM BETWEEN ROLLS.'
      },
      {
        tx: width / 2, ty: 304, tw: width - 32, th: 56,
        title: 'SCORING',
        body:  '1s = 100 pts each\n5s = 50 pts each\nTHREE-OF-A-KIND = FACE \xd7 100 (1s = 1000)'
      },
      {
        tx: width / 2, ty: 244, tw: width - 32, th: 44,
        title: 'ALWAYS READ THE BANNER',
        body:  'THE TOP BANNER ALWAYS TELLS YOU\nEXACTLY WHAT TO DO NEXT.\nFOLLOW ITS INSTRUCTIONS.'
      },
      {
        tx: width / 2, ty: height - 72, tw: width - 24, th: 60,
        title: 'BANK OR ROLL',
        body:  'ROLL = RISK IT FOR MORE POINTS.\nFARKLE (NO SCORE) = LOSE EVERYTHING.\nBANK REQUIRES 300 pts MINIMUM.'
      },
    ];

    let step = 0;
    const overlay  = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.72).setDepth(50);
    const pulse    = this.add.rectangle(0, 0, 0, 0).setStrokeStyle(2, 0xe8a020).setDepth(51);
    this.tweens.add({ targets: pulse, alpha: 0.4, duration: 600, yoyo: true, repeat: -1 });

    const cardY  = height - 152;
    const card   = this.add.rectangle(width / 2, cardY, width - 32, 96, 0x0a0e14, 0.98).setDepth(52);
    this.add.rectangle(width / 2, cardY, width - 32, 96).setStrokeStyle(1, 0xe8a020, 0.6).setDepth(52);
    const tTitle = this.add.text(width / 2, cardY - 28, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#e8a020', fontStyle: 'bold', letterSpacing: 3
    }).setOrigin(0.5).setDepth(53);
    const tBody  = this.add.text(width / 2, cardY + 4, '', {
      fontFamily: 'monospace', fontSize: '11px', color: '#8899aa', align: 'center',
      wordWrap: { width: width - 60 }
    }).setOrigin(0.5).setDepth(53);
    this.add.text(width / 2, cardY + 38, 'TAP TO CONTINUE', {
      fontFamily: 'monospace', fontSize: '9px', color: '#334455', letterSpacing: 3
    }).setOrigin(0.5).setDepth(53);

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
        this.saveData.tutorials.doubleDown = true;
        this._save();
        return;
      }
      show(step);
    };
    overlay.setInteractive();
    overlay.on('pointerdown', next);
  }
}
