// ── RicochetScene.js ──────────────────────────────────────────────────────────
// Plinko-style drop. Drag to aim, release to drop. Ball bounces through peg
// grid using manual physics in update(). 7 buckets: outer=high, middle=low.

const RICOCHET_BASE_COST = 3;
const RICOCHET_BUCKETS   = [18, 10, 5, 2, 5, 10, 18]; // Bolts per slot (7 slots)

class RicochetScene extends Phaser.Scene {
  constructor() { super({ key: 'RicochetScene' }); }

  create() {
    const { width, height } = this.scale;
    const slotIndex   = localStorage.getItem('factower_active_slot');
    this.saveKey      = `factower_save_${slotIndex}`;
    this.saveData     = JSON.parse(localStorage.getItem(this.saveKey)) || {};
    if (!this.saveData.nuts)            this.saveData.nuts = 0;
    if (!this.saveData.bolts)           this.saveData.bolts = 0;
    if (!this.saveData.merchantFatigue) this.saveData.merchantFatigue = { chrome: 0, ricochet: 0, doubleDown: 0 };
    if (!this.saveData.ricochetState)   this.saveData.ricochetState = { pityCount: 0 };

    this.fatigue      = this.saveData.merchantFatigue.ricochet || 0;
    this.ballActive   = false;
    this.aimX         = width / 2;
    this.isDragging   = false;

    // ── Play area geometry ────────────────────────────────────────────────
    this.PLAY_LEFT    = 20;
    this.PLAY_RIGHT   = 370;
    this.PLAY_WIDTH   = 350;
    this.BUCKET_Y     = 660;
    this.BALL_START_Y = 258;
    this.PEG_R        = 5;
    this.BALL_R       = 9;

    // Build peg grid: 8 rows alternating 7 and 6 pegs
    const bucketW = this.PLAY_WIDTH / 7; // ~50
    this.pegs = [];
    for (let row = 0; row < 8; row++) {
      const y      = 278 + row * 52;
      const isWide = row % 2 === 0; // 7 pegs on even rows
      const count  = isWide ? 7 : 6;
      const startX = isWide ? this.PLAY_LEFT + bucketW / 2 : this.PLAY_LEFT + bucketW;
      for (let col = 0; col < count; col++) {
        this.pegs.push({ x: startX + col * bucketW, y, r: this.PEG_R });
      }
    }

    // ── Background ────────────────────────────────────────────────────────
    this.add.rectangle(width / 2, height / 2, width, height, 0x0d1117);
    this.add.rectangle(width / 2, 0, width, 4, 0x5eba7d, 0.4);

    // ── Header ────────────────────────────────────────────────────────────
    this.add.rectangle(width / 2, 144, width, 100, 0x161b22);
    this.add.rectangle(width / 2, 194, width, 1, 0x334455);

    const back = this.add.rectangle(44, 144, 72, 48, 0x1e2530).setInteractive();
    this.add.text(44, 144, '<- BACK', { fontFamily: 'monospace', fontSize: '14px', color: '#e8a020' }).setOrigin(0.5);
    back.on('pointerdown', () => {
      if (this.ballActive) return;
      this._save();
      this.cameras.main.fade(200, 0, 0, 0);
      this.time.delayedCall(200, () => this.scene.start('MarketplaceScene'));
    });
    back.on('pointerover', () => back.setFillStyle(0x252c38));
    back.on('pointerout',  () => back.setFillStyle(0x1e2530));

    this.add.text(width / 2 + 20, 125, 'RICOCHET', { fontFamily: 'monospace', fontSize: '26px', color: '#5eba7d', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(width / 2 + 20, 152, 'THE PLINKO BOARD', { fontFamily: 'monospace', fontSize: '11px', color: '#8899aa', letterSpacing: 2 }).setOrigin(0.5);

    this.nutsText  = this.add.text(width / 2 - 70, 216, `${this.saveData.nuts} NUTS`,  { fontFamily: 'monospace', fontSize: '12px', color: '#e8a020', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(width / 2, 216, '·', { fontFamily: 'monospace', fontSize: '12px', color: '#334455' }).setOrigin(0.5);
    this.boltsText = this.add.text(width / 2 + 70, 216, `${this.saveData.bolts} BOLTS`, { fontFamily: 'monospace', fontSize: '12px', color: '#8ab4cc', fontStyle: 'bold' }).setOrigin(0.5);

    // ── Board background ──────────────────────────────────────────────────
    this.add.rectangle(width / 2, 460, width - 8, 440, 0x0f1318);
    this.add.rectangle(width / 2, 460, width - 8, 440).setStrokeStyle(1, 0x5eba7d, 0.3);

    // ── Pegs ──────────────────────────────────────────────────────────────
    this.pegGraphics = this.add.graphics();
    this._drawPegs();

    // ── Buckets ───────────────────────────────────────────────────────────
    this._drawBuckets();

    // ── Aim indicator ─────────────────────────────────────────────────────
    // Thin vertical guide line
    this.aimLine = this.add.graphics();
    this.aimBall = this.add.circle(this.aimX, this.BALL_START_Y, this.BALL_R + 3, 0x5eba7d, 0.6);
    this.aimLabel = this.add.text(width / 2, 236, 'DRAG LEFT / RIGHT TO AIM', {
      fontFamily: 'monospace', fontSize: '10px', color: '#5eba7d', letterSpacing: 2
    }).setOrigin(0.5);
    this._drawAimLine();

    // ── Ball (hidden until drop) ───────────────────────────────────────────
    this.ballObj = this.add.circle(-50, -50, this.BALL_R, 0x5eba7d).setDepth(5);
    this.ball    = { x: 0, y: 0, vx: 0, vy: 0 };

    // ── Result text ───────────────────────────────────────────────────────
    this.resultText = this.add.text(width / 2, 234, '', {
      fontFamily: 'monospace', fontSize: '14px', color: '#5eba7d', fontStyle: 'bold', letterSpacing: 2
    }).setOrigin(0.5).setAlpha(0);

    // ── Fatigue ───────────────────────────────────────────────────────────
    const fatY = this.BUCKET_Y + 28;
    this.add.text(width / 2, fatY, 'FATIGUE', { fontFamily: 'monospace', fontSize: '9px', color: '#445566', letterSpacing: 3 }).setOrigin(0.5);
    const bW = width - 80, bY = fatY + 14;
    this.add.rectangle(width / 2, bY, bW, 6, 0x1a2230);
    this.fatigueFill  = this.add.rectangle(width / 2 - bW / 2, bY, 2, 6, 0x5eba7d).setOrigin(0, 0.5);
    this.fatigueLabel = this.add.text(width / 2, bY + 13, this._fatigueText(), { fontFamily: 'monospace', fontSize: '9px', color: '#556677' }).setOrigin(0.5);
    this._updateFatigueBar(bW);

    // ── DROP button ───────────────────────────────────────────────────────
    const btnY = height - 88;
    this.dropBg  = this.add.rectangle(width / 2, btnY, width - 48, 64, 0x0d1e10).setInteractive();
    this.dropBdr = this.add.rectangle(width / 2, btnY, width - 48, 64).setStrokeStyle(2, 0x5eba7d);
    this.dropTxt = this.add.text(width / 2, btnY - 9, 'DROP', { fontFamily: 'monospace', fontSize: '24px', color: '#5eba7d', fontStyle: 'bold' }).setOrigin(0.5);
    this.dropSub = this.add.text(width / 2, btnY + 16, `COSTS ${this._rollCost()} NUTS`, { fontFamily: 'monospace', fontSize: '11px', color: '#556677', letterSpacing: 1 }).setOrigin(0.5);
    this.dropBg.on('pointerdown', () => this._startDrop());
    this.dropBg.on('pointerover', () => this.dropBg.setFillStyle(0x122018));
    this.dropBg.on('pointerout',  () => this.dropBg.setFillStyle(0x0d1e10));

    // ── Aim drag input ────────────────────────────────────────────────────
    this._aimDown = (p) => {
      if (this.ballActive) return;
      if (p.y >= this.BALL_START_Y - 24 && p.y <= this.BUCKET_Y) {
        this.isDragging = true;
        this._setAim(p.x);
      }
    };
    this._aimMove = (p) => {
      if (!this.isDragging || this.ballActive) return;
      this._setAim(p.x);
    };
    this._aimUp = () => { this.isDragging = false; };

    this.input.on('pointerdown',  this._aimDown);
    this.input.on('pointermove',  this._aimMove);
    this.input.on('pointerup',    this._aimUp);
    this.input.on('pointerupoutside', this._aimUp);

    this.events.on('shutdown', () => {
      this.input.off('pointerdown',  this._aimDown);
      this.input.off('pointermove',  this._aimMove);
      this.input.off('pointerup',    this._aimUp);
      this.input.off('pointerupoutside', this._aimUp);
    });

    this._refreshDropButton();
  }

  _drawPegs() {
    this.pegGraphics.clear();
    this.pegs.forEach(peg => {
      this.pegGraphics.fillStyle(0x334455, 1);
      this.pegGraphics.fillCircle(peg.x, peg.y, peg.r);
    });
  }

  _drawBuckets() {
    const { width } = this.scale;
    const bucketW = this.PLAY_WIDTH / 7;
    const gfx = this.add.graphics();

    RICOCHET_BUCKETS.forEach((payout, i) => {
      const bx  = this.PLAY_LEFT + i * bucketW;
      const by  = this.BUCKET_Y;
      const bh  = 44;
      const cx  = bx + bucketW / 2;
      const isEdge   = i === 0 || i === 6;
      const isNearEdge = i === 1 || i === 5;
      const col = isEdge ? 0xe8a020 : isNearEdge ? 0x5eba7d : 0x334455;
      const bgCol = isEdge ? 0x1a1200 : isNearEdge ? 0x0d1e10 : 0x0f1318;

      gfx.fillStyle(bgCol, 1);
      gfx.fillRect(bx + 1, by, bucketW - 2, bh);
      gfx.lineStyle(1, col, 0.7);
      gfx.strokeRect(bx + 1, by, bucketW - 2, bh);

      this.add.text(cx, by + 12, `${payout}`, {
        fontFamily: 'monospace', fontSize: '12px', color: '#' + col.toString(16).padStart(6, '0'), fontStyle: 'bold'
      }).setOrigin(0.5);
      this.add.text(cx, by + 28, 'B', {
        fontFamily: 'monospace', fontSize: '8px', color: '#556677'
      }).setOrigin(0.5);

      // Divider lines
      if (i > 0) { gfx.lineStyle(1, 0x1e2a38, 1); gfx.lineBetween(bx, by - 10, bx, by + bh); }
    });
  }

  _drawAimLine() {
    this.aimLine.clear();
    this.aimLine.lineStyle(1, 0x5eba7d, 0.3);
    this.aimLine.lineBetween(this.aimX, this.BALL_START_Y + this.BALL_R, this.aimX, this.BUCKET_Y);
    this.aimBall.setPosition(this.aimX, this.BALL_START_Y);
  }

  _setAim(x) {
    this.aimX = Phaser.Math.Clamp(x, this.PLAY_LEFT + this.BALL_R, this.PLAY_RIGHT - this.BALL_R);
    this._drawAimLine();
  }

  _rollCost() {
    return Math.min(Math.round(RICOCHET_BASE_COST * (1 + Math.pow(this.fatigue, 3) / 500)), 60);
  }

  _fatigueText() {
    if (this.fatigue === 0) return 'FRESH — FULL PAYOUTS';
    if (this.fatigue < 6)   return `WARM (${this.fatigue} DROPS)`;
    if (this.fatigue < 14)  return `TIRED (${this.fatigue} DROPS) — REDUCED`;
    return `BURNT (${this.fatigue} DROPS) — HEAVY REDUCTION`;
  }

  _updateFatigueBar(bW) {
    const pct = Math.min(this.fatigue / 20, 1);
    const col = this.fatigue < 6 ? 0x5eba7d : this.fatigue < 14 ? 0xe8a020 : 0xc43a3a;
    this.fatigueFill.setSize(Math.max(2, bW * pct), 6).setFillStyle(col);
  }

  _refreshDropButton() {
    const cost = this._rollCost(), ok = this.saveData.nuts >= cost && !this.ballActive;
    this.dropTxt.setStyle({ color: ok ? '#5eba7d' : '#445566' });
    this.dropBg.setFillStyle(ok ? 0x0d1e10 : 0x161b22);
    this.dropBdr.setStrokeStyle(2, ok ? 0x5eba7d : 0x334455);
    this.dropSub.setText(`COSTS ${cost} NUTS`).setStyle({ color: ok ? '#8899aa' : '#334455' });
    if (ok) this.dropBg.setInteractive(); else this.dropBg.disableInteractive();
  }

  _startDrop() {
    const cost = this._rollCost();
    if (this.saveData.nuts < cost || this.ballActive) return;

    this.saveData.nuts -= cost;
    this.nutsText.setText(`${this.saveData.nuts} NUTS`);
    this.ballActive = true;
    this.isDragging = false;

    // Hide aim visuals
    this.aimLine.setAlpha(0.1);
    this.aimBall.setAlpha(0.1);
    this.aimLabel.setAlpha(0);
    this.tweens.add({ targets: this.resultText, alpha: 0, duration: 100 });

    // Initialise ball physics — slight random horizontal nudge
    this.ball.x  = this.aimX + (Math.random() - 0.5) * 4;
    this.ball.y  = this.BALL_START_Y;
    this.ball.vx = (Math.random() - 0.5) * 30;
    this.ball.vy = 60;

    this.ballObj.setPosition(this.ball.x, this.ball.y).setAlpha(1);
    this.dropBg.disableInteractive();
  }

  update(time, delta) {
    if (!this.ballActive) return;

    const dt = Math.min(delta / 1000, 0.033); // cap at 33ms
    const GRAVITY = 900;
    const RESTITUTION = 0.55;

    this.ball.vy += GRAVITY * dt;
    this.ball.x  += this.ball.vx * dt;
    this.ball.y  += this.ball.vy * dt;

    // Wall bounces
    const L = this.PLAY_LEFT + this.BALL_R, R = this.PLAY_RIGHT - this.BALL_R;
    if (this.ball.x < L) { this.ball.x = L; this.ball.vx = Math.abs(this.ball.vx) * RESTITUTION; }
    if (this.ball.x > R) { this.ball.x = R; this.ball.vx = -Math.abs(this.ball.vx) * RESTITUTION; }

    // Peg collisions
    for (const peg of this.pegs) {
      const dx   = this.ball.x - peg.x;
      const dy   = this.ball.y - peg.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minD = this.BALL_R + peg.r;
      if (dist < minD && dist > 0.01) {
        const nx  = dx / dist, ny = dy / dist;
        const dot = this.ball.vx * nx + this.ball.vy * ny;
        // Only reflect if approaching
        if (dot < 0) {
          this.ball.vx -= (1 + RESTITUTION) * dot * nx;
          this.ball.vy -= (1 + RESTITUTION) * dot * ny;
          // Add tiny random horizontal spread on each peg hit
          this.ball.vx += (Math.random() - 0.5) * 20;
        }
        // Push out
        const overlap = minD - dist;
        this.ball.x  += nx * overlap;
        this.ball.y  += ny * overlap;

        // Flash peg
        this.pegGraphics.fillStyle(0x5eba7d, 1);
        this.pegGraphics.fillCircle(peg.x, peg.y, peg.r + 2);
        this.time.delayedCall(120, () => {
          this.pegGraphics.fillStyle(0x334455, 1);
          this.pegGraphics.fillCircle(peg.x, peg.y, peg.r);
        });
      }
    }

    this.ballObj.setPosition(this.ball.x, this.ball.y);

    // Reached bucket zone
    if (this.ball.y >= this.BUCKET_Y - 4) {
      this._resolveBucket(this.ball.x);
    }
  }

  _resolveBucket(finalX) {
    this.ballActive = false;
    const bucketW = this.PLAY_WIDTH / 7;
    const idx = Phaser.Math.Clamp(Math.floor((finalX - this.PLAY_LEFT) / bucketW), 0, 6);

    // Snap ball to bucket centre
    const cx = this.PLAY_LEFT + idx * bucketW + bucketW / 2;
    this.ball.x = cx;
    this.ballObj.setPosition(cx, this.BUCKET_Y - 4);

    const rawPayout = RICOCHET_BUCKETS[idx];
    const mult      = Math.max(0.2, 1 / (1 + 0.08 * this.fatigue));
    const payout    = Math.max(1, Math.round(rawPayout * mult));

    this.saveData.bolts += payout;
    this.saveData.merchantFatigue.ricochet = ++this.fatigue;
    this.boltsText.setText(`${this.saveData.bolts} BOLTS`);
    this.tweens.add({ targets: this.boltsText, scaleX: 1.3, scaleY: 1.3, duration: 150, yoyo: true });

    const col = idx === 0 || idx === 6 ? '#e8a020' : idx === 1 || idx === 5 ? '#5eba7d' : '#8899aa';
    const msg = idx === 0 || idx === 6 ? `EDGE HIT!  +${payout} BOLTS` : `+${payout} BOLT${payout === 1 ? '' : 'S'}`;
    this.resultText.setText(msg).setStyle({ color: col }).setAlpha(0);
    this.tweens.add({ targets: this.resultText, alpha: 1, duration: 250 });

    if (idx === 0 || idx === 6) this.cameras.main.flash(150, 232, 160, 32, false);

    this._save();

    // Reset after short delay
    this.time.delayedCall(1200, () => {
      // Float ball off screen
      this.tweens.add({ targets: this.ballObj, alpha: 0, y: this.BUCKET_Y + 40, duration: 400 });
      this.time.delayedCall(450, () => {
        this.ballObj.setPosition(-50, -50).setAlpha(1);
        this.aimLine.setAlpha(1);
        this.aimBall.setAlpha(0.6);
        this.aimLabel.setAlpha(1);
        this._setAim(this.aimX);
        const bW = this.scale.width - 80;
        this._updateFatigueBar(bW);
        this.fatigueLabel.setText(this._fatigueText());
        this._refreshDropButton();
      });
    });
  }

  _save() {
    this.saveData.merchantFatigue.ricochet = this.fatigue;
    localStorage.setItem(this.saveKey, JSON.stringify(this.saveData));
  }
}
