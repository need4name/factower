// ── DoubleDownScene.js ────────────────────────────────────────────────────────
// Farkle-inspired dice game with Mod Chips.
// Roll 6 dice. Tap scoring dice to hold. Roll remaining or bank.
// Farkle (no scoring dice) = lose all accumulated points this round.
// 100pts = 1 Bolt. Min 300pts to bank.

const DD_BASE_COST = 4;
const DD_MOD_POOL  = [
  { id: 'lucky5',    name: 'LUCKY 5s',    desc: '5s score 100pts instead of 50',     passive: true  },
  { id: 'lucky1',    name: 'LUCKY 1s',    desc: '1s score 150pts instead of 100',    passive: true  },
  { id: 'insurance', name: 'INSURANCE',   desc: 'First Farkle this round: no penalty', passive: true  },
  { id: 'chain',     name: 'CHAIN BONUS', desc: 'Each consecutive roll: +100pts',    passive: true  },
  { id: 'wild',      name: 'WILD DIE',    desc: 'Lowest die counts as wild for combos', passive: true  },
  { id: 'safety',    name: 'SAFETY NET',  desc: 'Farkle: keep 50% score instead of zero', passive: true },
  { id: 'overdrive', name: 'OVERDRIVE',   desc: 'TAP to activate: next roll scores 2×', passive: false },
  { id: 'straight',  name: 'STRAIGHT UP', desc: '1-2-3-4-5-6 straight pays 3000pts', passive: true  },
];

class DoubleDownScene extends Phaser.Scene {
  constructor() { super({ key: 'DoubleDownScene' }); }

  create() {
    const { width, height } = this.scale;
    const slotIndex  = localStorage.getItem('factower_active_slot');
    this.saveKey     = `factower_save_${slotIndex}`;
    this.saveData    = JSON.parse(localStorage.getItem(this.saveKey)) || {};
    if (!this.saveData.nuts)            this.saveData.nuts = 0;
    if (!this.saveData.bolts)           this.saveData.bolts = 0;
    if (!this.saveData.merchantFatigue) this.saveData.merchantFatigue = { chrome: 0, ricochet: 0, doubleDown: 0 };
    if (!this.saveData.ddState)         this.saveData.ddState = {};

    this.fatigue   = this.saveData.merchantFatigue.doubleDown || 0;

    // Round state
    this.inRound       = false;
    this.accScore      = 0;    // points accumulated this round
    this.rollScore     = 0;    // points scored this roll
    this.consecutiveRolls = 0; // for chain bonus
    this.insuranceUsed = false;
    this.overdriveActive = false;
    this.modChips      = [];
    this.dice          = [];   // { value, held, scored } ×6
    this.rolling       = false;
    this.minBank       = 300;

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

    this.nutsText  = this.add.text(width / 2 - 70, 216, `${this.saveData.nuts} NUTS`,  { fontFamily: 'monospace', fontSize: '12px', color: '#e8a020', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(width / 2, 216, '·', { fontFamily: 'monospace', fontSize: '12px', color: '#334455' }).setOrigin(0.5);
    this.boltsText = this.add.text(width / 2 + 70, 216, `${this.saveData.bolts} BOLTS`, { fontFamily: 'monospace', fontSize: '12px', color: '#8ab4cc', fontStyle: 'bold' }).setOrigin(0.5);

    // ── Mod chip area ─────────────────────────────────────────────────────
    this.modArea = this.add.container(0, 0);
    this.add.text(width / 2, 238, 'MOD CHIPS — START A ROUND TO DRAW', {
      fontFamily: 'monospace', fontSize: '9px', color: '#334455', letterSpacing: 2
    }).setOrigin(0.5);

    // ── Score display ─────────────────────────────────────────────────────
    const scoreY = 284;
    this.add.rectangle(width / 2, scoreY, width - 32, 60, 0x0f1318);
    this.add.rectangle(width / 2, scoreY, width - 32, 60).setStrokeStyle(1, 0x334455);

    this.accText  = this.add.text(60, scoreY - 10, 'BANKED  0 pts', { fontFamily: 'monospace', fontSize: '11px', color: '#8899aa' });
    this.rollText = this.add.text(60, scoreY + 8,  'THIS ROLL  —', { fontFamily: 'monospace', fontSize: '11px', color: '#eef2f8' });
    this.boltPreview = this.add.text(width - 24, scoreY, '', { fontFamily: 'monospace', fontSize: '13px', color: '#8ab4cc', fontStyle: 'bold' }).setOrigin(1, 0.5);

    // ── Dice area ─────────────────────────────────────────────────────────
    this.diceElements = [];
    this._buildDiceArea(width);

    // ── Score breakdown ───────────────────────────────────────────────────
    this.breakdownText = this.add.text(width / 2, 592, '', {
      fontFamily: 'monospace', fontSize: '10px', color: '#5eba7d', align: 'center', letterSpacing: 1
    }).setOrigin(0.5);

    // ── Action buttons ────────────────────────────────────────────────────
    this._buildButtons(width, height);

    // ── Fatigue ───────────────────────────────────────────────────────────
    const fatY = height - 138;
    this.add.text(width / 2, fatY, 'FATIGUE', { fontFamily: 'monospace', fontSize: '9px', color: '#445566', letterSpacing: 3 }).setOrigin(0.5);
    const bW = width - 80, bY = fatY + 14;
    this.add.rectangle(width / 2, bY, bW, 6, 0x1a2230);
    this.fatigueFill  = this.add.rectangle(width / 2 - bW / 2, bY, 2, 6, 0xc43a3a).setOrigin(0, 0.5);
    this.fatigueLabel = this.add.text(width / 2, bY + 13, this._fatigueText(), { fontFamily: 'monospace', fontSize: '9px', color: '#556677' }).setOrigin(0.5);
    this._updateFatigueBar(bW);

    this._refreshUI();
  }

  _buildDiceArea(width) {
    const dY = [390, 475];
    const dX = [84, 195, 306];
    this.diceObjects = [];

    for (let i = 0; i < 6; i++) {
      const row = Math.floor(i / 3), col = i % 3;
      const x = dX[col], y = dY[row];
      const bg = this.add.rectangle(x, y, 78, 72, 0x161b22);
      const bdr = this.add.rectangle(x, y, 78, 72).setStrokeStyle(2, 0x334455);
      const pip = this.add.text(x, y - 6, '—', { fontFamily: 'monospace', fontSize: '28px', color: '#445566', fontStyle: 'bold' }).setOrigin(0.5);
      const heldLabel = this.add.text(x, y + 24, '', { fontFamily: 'monospace', fontSize: '9px', color: '#e8a020', letterSpacing: 2 }).setOrigin(0.5);
      this.diceObjects.push({ bg, bdr, pip, heldLabel, x, y });
      bg.setInteractive();
      bg.on('pointerdown', () => this._toggleHold(i));
    }
  }

  _buildButtons(width, height) {
    const bY = height - 72;
    const half = (width - 60) / 2;

    // ROLL button
    this.rollBg  = this.add.rectangle(24 + half / 2, bY, half, 60, 0x1a0808).setInteractive();
    this.rollBdr = this.add.rectangle(24 + half / 2, bY, half, 60).setStrokeStyle(2, 0xc43a3a);
    this.rollTxt = this.add.text(24 + half / 2, bY - 9, 'ROLL', { fontFamily: 'monospace', fontSize: '20px', color: '#c43a3a', fontStyle: 'bold' }).setOrigin(0.5);
    this.rollSub = this.add.text(24 + half / 2, bY + 14, '', { fontFamily: 'monospace', fontSize: '9px', color: '#556677', letterSpacing: 1 }).setOrigin(0.5);
    this.rollBg.on('pointerdown', () => this._doRoll());
    this.rollBg.on('pointerover', () => this.rollBg.setFillStyle(0x261008));
    this.rollBg.on('pointerout',  () => this.rollBg.setFillStyle(0x1a0808));

    // BANK button
    const bx2 = width - 24 - half / 2;
    this.bankBg  = this.add.rectangle(bx2, bY, half, 60, 0x0d1e10).setInteractive();
    this.bankBdr = this.add.rectangle(bx2, bY, half, 60).setStrokeStyle(2, 0x5eba7d);
    this.bankTxt = this.add.text(bx2, bY - 9, 'BANK', { fontFamily: 'monospace', fontSize: '20px', color: '#5eba7d', fontStyle: 'bold' }).setOrigin(0.5);
    this.bankSub = this.add.text(bx2, bY + 14, 'MIN 300pts', { fontFamily: 'monospace', fontSize: '9px', color: '#556677', letterSpacing: 1 }).setOrigin(0.5);
    this.bankBg.on('pointerdown', () => this._doBank());
    this.bankBg.on('pointerover', () => this.bankBg.setFillStyle(0x122018));
    this.bankBg.on('pointerout',  () => this.bankBg.setFillStyle(0x0d1e10));
  }

  // ── Mod Chips ──────────────────────────────────────────────────────────────
  _drawModChips(width) {
    this.modArea.removeAll(true);
    if (this.modChips.length === 0) return;

    const chipW = 148, chipH = 36, startX = width / 2 - chipW / 2 - 4;
    this.modChips.forEach((chip, i) => {
      const cx    = startX + i * (chipW + 8);
      const isOD  = chip.id === 'overdrive';
      const col   = isOD ? (this.overdriveActive ? 0xe8a020 : 0x445566) : 0xc43a3a;
      const tcol  = isOD ? (this.overdriveActive ? '#e8a020' : '#445566') : '#c43a3a';

      const bg  = this.add.rectangle(cx + chipW / 2, 258, chipW, chipH, 0x0f1318);
      const bdr = this.add.rectangle(cx + chipW / 2, 258, chipW, chipH).setStrokeStyle(1, col);
      const t1  = this.add.text(cx + 10, 248, chip.name, { fontFamily: 'monospace', fontSize: '9px', color: tcol, fontStyle: 'bold', letterSpacing: 1 });
      const t2  = this.add.text(cx + 10, 260, chip.desc.substring(0, 22), { fontFamily: 'monospace', fontSize: '7px', color: '#556677' });
      this.modArea.add([bg, bdr, t1, t2]);

      if (isOD && !this.overdriveActive) {
        bg.setInteractive();
        bg.on('pointerdown', () => { this.overdriveActive = true; this._drawModChips(width); });
      }
    });
  }

  // ── Round start ────────────────────────────────────────────────────────────
  _startRound() {
    const cost = this._rollCost();
    if (this.saveData.nuts < cost) return;
    this.saveData.nuts -= cost;
    this.nutsText.setText(`${this.saveData.nuts} NUTS`);
    this._save();

    this.inRound          = true;
    this.accScore         = 0;
    this.consecutiveRolls = 0;
    this.insuranceUsed    = false;
    this.overdriveActive  = false;

    // Draw 2 random mod chips
    const pool = [...DD_MOD_POOL].sort(() => Math.random() - 0.5);
    this.modChips = pool.slice(0, 2);
    this._drawModChips(this.scale.width);

    // Reset dice
    this.dice = Array(6).fill(null).map(() => ({ value: 1, held: false, scored: false }));
    this._doRoll();
  }

  _doRoll() {
    if (this.rolling) return;

    // Unhold any dice that were scored (they get freed for next roll)
    // Un-score previously scored dice unless manually held
    this.dice.forEach(d => { d.scored = false; });

    const toRoll = this.inRound ? this.dice.filter(d => !d.held) : this.dice;

    // If all dice are held, release them all (fresh roll of 6)
    if (toRoll.length === 0) {
      this.dice.forEach(d => { d.held = false; d.scored = false; });
    }

    this.rolling = true;
    this._animateRoll(() => {
      const freeCount = this.dice.filter(d => !d.held).length;
      if (freeCount === 0) this.dice.forEach(d => { d.held = false; });

      // Reroll unheld dice
      this.dice.forEach(d => { if (!d.held) d.value = Math.floor(Math.random() * 6) + 1; });

      // Score this roll
      const result = this._scoreDice();
      this.rolling = false;

      if (result.score === 0) {
        this._farkle();
      } else {
        this.rollScore = result.score;

        // Mod chip: overdrive
        if (this.overdriveActive) { this.rollScore *= 2; this.overdriveActive = false; this._drawModChips(this.scale.width); }

        // Mod chip: chain bonus
        if (this.modChips.some(c => c.id === 'chain')) { this.rollScore += this.consecutiveRolls * 100; }

        this.consecutiveRolls++;
        this.accScore += this.rollScore;
        this.breakdownText.setText(result.breakdown);

        // Mark scoring dice
        result.scoringIndices.forEach(i => { this.dice[i].scored = true; });
        this._updateDiceDisplay();
        this._updateScoreDisplay();
        this._refreshUI();
      }
    });
  }

  _animateRoll(onComplete) {
    let ticks = 0;
    const MAX = 8;
    const tick = () => {
      this.dice.forEach(d => { if (!d.held) d.value = Math.floor(Math.random() * 6) + 1; });
      this._updateDiceDisplay(true);
      ticks++;
      if (ticks < MAX) { this.time.delayedCall(60, tick); }
      else { this.time.delayedCall(60, onComplete); }
    };
    tick();
  }

  _scoreDice() {
    const vals    = this.dice.map((d, i) => ({ v: d.value, i })).filter(d => !this.dice[d.i].held);
    const counts  = [0, 0, 0, 0, 0, 0, 0]; // index 1-6
    vals.forEach(d => counts[d.v]++);

    const lucky5  = this.modChips.some(c => c.id === 'lucky5');
    const lucky1  = this.modChips.some(c => c.id === 'lucky1');
    const useStraight = this.modChips.some(c => c.id === 'straight');

    let score = 0;
    const scoringIndices = [];
    const parts = [];

    // Check straight (1-2-3-4-5-6) — needs all 6 free dice
    if (useStraight && vals.length === 6 && counts.slice(1).every(c => c === 1)) {
      return { score: 3000, breakdown: 'STRAIGHT 1-2-3-4-5-6  3000pts!', scoringIndices: vals.map(d => d.i) };
    }

    // Three pairs
    const pairs = counts.filter(c => c === 2).length;
    if (pairs === 3 && vals.length === 6) {
      return { score: 750, breakdown: 'THREE PAIRS  750pts', scoringIndices: vals.map(d => d.i) };
    }

    // Multi-of-a-kind
    for (let face = 1; face <= 6; face++) {
      const c = counts[face];
      if (c >= 3) {
        const base  = face === 1 ? 1000 : face * 100;
        const extra = c === 4 ? 2 : c === 5 ? 4 : c === 6 ? 8 : 1;
        const pts   = base * extra;
        score += pts;
        parts.push(`${c}×${face}  ${pts}pts`);
        // Mark these dice
        let marked = 0;
        vals.forEach(d => { if (d.v === face && marked < c) { scoringIndices.push(d.i); marked++; } });
        counts[face] -= c; // consumed
      }
    }

    // Singles: 1s and 5s
    const remaining1 = counts[1], remaining5 = counts[5];
    if (remaining1 > 0) {
      const pts = remaining1 * (lucky1 ? 150 : 100);
      score += pts;
      parts.push(`${remaining1}×1  ${pts}pts`);
      let marked = 0;
      vals.forEach(d => { if (d.v === 1 && marked < remaining1) { scoringIndices.push(d.i); marked++; } });
    }
    if (remaining5 > 0) {
      const pts = remaining5 * (lucky5 ? 100 : 50);
      score += pts;
      parts.push(`${remaining5}×5  ${pts}pts`);
      let marked = 0;
      vals.forEach(d => { if (d.v === 5 && marked < remaining5) { scoringIndices.push(d.i); marked++; } });
    }

    return {
      score,
      breakdown: parts.join('   ') || '',
      scoringIndices: [...new Set(scoringIndices)]
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
}
