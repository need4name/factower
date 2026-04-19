};
  }

  _farkle() {
    const hasSafety   = this.modChips.some(c => c.id === 'safety');
    const hasInsurance = this.modChips.some(c => c.id === 'insurance');

    if (hasInsurance && !this.insuranceUsed) {
      this.insuranceUsed = true;
      this.breakdownText.setText('FARKLE! — INSURANCE SAVED YOU');
      this.dice.forEach(d => { d.held = false; d.scored = false; });
      this._updateDiceDisplay();
      this._updateScoreDisplay();
      this._refreshUI();
      return;
    }

    const lost = hasSafety ? Math.floor(this.accScore * 0.5) : this.accScore;
    this.accScore = hasSafety ? Math.ceil(this.accScore * 0.5) : 0;
    this.consecutiveRolls = 0;
    this.rollScore = 0;

    this.breakdownText.setText(hasSafety ? `FARKLE — SAFETY NET: kept ${this.accScore}pts` : 'FARKLE — ALL POINTS LOST');

    this.dice.forEach(d => { d.held = false; d.scored = false; d.value = Math.floor(Math.random() * 6) + 1; });
    this._updateDiceDisplay();
    this._updateScoreDisplay();
    this._refreshUI();

    this.cameras.main.shake(200, 0.008);
  }

  _doBank() {
    if (!this.inRound || this.accScore < this.minBank) return;

    const mult   = Math.max(0.2, 1 / (1 + 0.08 * this.fatigue));
    const payout = Math.max(1, Math.floor(this.accScore / 100 * mult));

    this.saveData.bolts += payout;
    this.fatigue++;
    this.saveData.merchantFatigue.doubleDown = this.fatigue;
    this._save();

    this.boltsText.setText(`${this.saveData.bolts} BOLTS`);
    this.tweens.add({ targets: this.boltsText, scaleX: 1.3, scaleY: 1.3, duration: 150, yoyo: true });

    // Flash result
    const { width } = this.scale;
    const pop = this.add.text(width / 2, 300, `BANKED  +${payout} BOLTS`, {
      fontFamily: 'monospace', fontSize: '18px', color: '#5eba7d', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(20).setAlpha(0);
    this.tweens.add({ targets: pop, alpha: 1, duration: 200, onComplete: () =>
      this.time.delayedCall(1000, () => this.tweens.add({ targets: pop, alpha: 0, duration: 400, onComplete: () => pop.destroy() }))
    });

    this._endRound();
  }

  _endRound() {
    this.inRound = false;
    this.accScore = 0; this.rollScore = 0; this.consecutiveRolls = 0;
    this.modChips = [];
    this.modArea.removeAll(true);

    const { width } = this.scale;
    this.add.text(width / 2, 238, 'MOD CHIPS — START A ROUND TO DRAW', {
      fontFamily: 'monospace', fontSize: '9px', color: '#334455', letterSpacing: 2
    }).setOrigin(0.5);

    this.dice = Array(6).fill(null).map(() => ({ value: 1, held: false, scored: false }));
    this._updateDiceDisplay();
    this._updateScoreDisplay();
    const bW = this.scale.width - 80;
    this._updateFatigueBar(bW);
    this.fatigueLabel.setText(this._fatigueText());
    this._refreshUI();
    this.breakdownText.setText('');
  }

  _toggleHold(i) {
    if (!this.inRound || this.rolling) return;
    if (this.dice[i].scored) {
      this.dice[i].held = !this.dice[i].held;
      this._updateDiceDisplay();
    }
  }

  _updateDiceDisplay(animating) {
    this.diceObjects.forEach((obj, i) => {
      const d = this.dice[i];
      const isHeld   = d.held;
      const isScored = d.scored;
      const v        = d.value;

      const col    = isHeld ? 0xe8a020 : isScored ? 0x5eba7d : 0x334455;
      const bgCol  = isHeld ? 0x1a1200 : isScored ? 0x0d1e10 : 0x161b22;
      const txtCol = isHeld ? '#e8a020' : isScored ? '#5eba7d' : (this.inRound ? '#eef2f8' : '#445566');

      obj.bg.setFillStyle(bgCol);
      obj.bdr.setStrokeStyle(2, col);
      obj.pip.setText(animating ? '?' : String(v)).setStyle({ color: txtCol });
      obj.heldLabel.setText(isHeld ? 'HELD ★' : isScored ? 'TAP HOLD' : '');
    });
  }

  _updateScoreDisplay() {
    const boltsPreview = this.accScore >= this.minBank ? `→ ${Math.floor(this.accScore / 100)} B` : '';
    this.accText.setText(`BANKED  ${this.accScore} pts`);
    this.rollText.setText(this.rollScore > 0 ? `THIS ROLL  +${this.rollScore}` : 'THIS ROLL  —');
    this.boltPreview.setText(boltsPreview);
  }

  _refreshUI() {
    const cost  = this._rollCost();
    const canStart = !this.inRound && this.saveData.nuts >= cost && !this.rolling;
    const canRoll  = this.inRound && !this.rolling;
    const canBank  = this.inRound && this.accScore >= this.minBank && !this.rolling;

    if (!this.inRound) {
      // Show PLAY button on top of ROLL
      this.rollTxt.setText('PLAY').setStyle({ color: canStart ? '#c43a3a' : '#445566' });
      this.rollSub.setText(`COSTS ${cost} NUTS`);
      this.rollBg.setFillStyle(canStart ? 0x1a0808 : 0x161b22);
      this.rollBdr.setStrokeStyle(2, canStart ? 0xc43a3a : 0x334455);
      if (canStart) { this.rollBg.on('pointerdown', () => this._startRound()); this.rollBg.setInteractive(); }
      else { this.rollBg.disableInteractive(); }
    } else {
      this.rollBg.off('pointerdown');
      this.rollBg.on('pointerdown', () => this._doRoll());
      this.rollTxt.setText('ROLL').setStyle({ color: canRoll ? '#c43a3a' : '#445566' });
      this.rollSub.setText('PRESS YOUR LUCK');
      this.rollBg.setFillStyle(canRoll ? 0x1a0808 : 0x161b22);
      this.rollBdr.setStrokeStyle(2, canRoll ? 0xc43a3a : 0x334455);
      if (canRoll) this.rollBg.setInteractive(); else this.rollBg.disableInteractive();
    }

    this.bankTxt.setStyle({ color: canBank ? '#5eba7d' : '#445566' });
    this.bankBg.setFillStyle(canBank ? 0x0d1e10 : 0x161b22);
    this.bankBdr.setStrokeStyle(2, canBank ? 0x5eba7d : 0x334455);
    this.bankSub.setText(`MIN ${this.minBank}pts`);
    if (canBank) this.bankBg.setInteractive(); else this.bankBg.disableInteractive();
  }

  _rollCost() {
    return Math.min(Math.round(DD_BASE_COST * (1 + Math.pow(this.fatigue, 3) / 500)), 60);
  }

  _fatigueText() {
    if (this.fatigue === 0) return 'FRESH — FULL PAYOUTS';
    if (this.fatigue < 6)   return `WARM (${this.fatigue} ROUNDS)`;
    if (this.fatigue < 14)  return `TIRED (${this.fatigue} ROUNDS) — REDUCED`;
    return `BURNT (${this.fatigue} ROUNDS) — HEAVY REDUCTION`;
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

  _showTutorial() {
    const { width, height } = this.scale;
    const steps = [
      {
        tx: width / 2, ty: 340, tw: width - 24, th: 180,
        title: 'THE DICE',
        body: 'SIX DICE PER ROLL. SCORING DICE\nGLOW GREEN. TAP GREEN DICE\nTO HOLD THEM BETWEEN ROLLS.'
      },
      {
        tx: width / 2, ty: 258, tw: width - 24, th: 44,
        title: 'MOD CHIPS',
        body: 'TWO RANDOM CHIPS DRAWN EACH\nROUND. THEY CHANGE THE RULES —\nREAD THEM BEFORE YOU ROLL.'
      },
      {
        tx: width / 2, ty: 284, tw: width - 32, th: 60,
        title: 'SCORE',
        body: '1s = 100pts, 5s = 50pts.\nTHREE OF A KIND = FACE × 100.\nCONVERT 100pts TO 1 BOLT.'
      },
      {
        tx: width / 2, ty: height - 72, tw: width - 24, th: 60,
        title: 'BANK OR ROLL',
        body: 'ROLL = RISK IT FOR MORE POINTS.\nFARKLE (NO SCORE) = LOSE IT ALL.\nBANK = LOCK IN YOUR BOLTS.'
      },
    ];

    let step = 0;
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.72).setDepth(50);
    const pulse   = this.add.rectangle(0, 0, 0, 0).setStrokeStyle(2, 0xe8a020).setDepth(51);
    this.tweens.add({ targets: pulse, alpha: 0.4, duration: 600, yoyo: true, repeat: -1 });

    const cardY  = height - 148;
    const card   = this.add.rectangle(width / 2, cardY, width - 32, 88, 0x0a0e14, 0.98).setDepth(52);
    this.add.rectangle(width / 2, cardY, width - 32, 88).setStrokeStyle(1, 0xe8a020, 0.6).setDepth(52);
    const tTitle = this.add.text(width / 2, cardY - 24, '', { fontFamily: 'monospace', fontSize: '13px', color: '#e8a020', fontStyle: 'bold', letterSpacing: 3 }).setOrigin(0.5).setDepth(53);
    const tBody  = this.add.text(width / 2, cardY + 4,  '', { fontFamily: 'monospace', fontSize: '11px', color: '#8899aa', align: 'center', wordWrap: { width: width - 60 } }).setOrigin(0.5).setDepth(53);
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