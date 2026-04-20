// ── RicochetScene.js ──────────────────────────────────────────────────────────
// Peggle-inspired side launcher. Fixed launcher on right wall, drag up/down to
// aim. Dotted preview line (short by default, full on tap). Ball fires leftward
// into hand-placed diagonal peg grid. Moving bucket at bottom for 2× multiplier.
// 5 scoring bins: outer=high, middle=low.

const RICOCHET_BASE_COST = 3;
const RICOCHET_BINS      = [16, 8, 3, 8, 16]; // Bolts per bin (5 bins)
const BUCKET_MULTIPLIER  = 2;
const BALL_SPEED         = 260;  // px/s — 60% of original 430
const GRAVITY            = 520;  // px/s²

// Hand-placed peg layout — diagonal bands to force interesting bounces
// Coordinates relative to play area top-left (PLAY_LEFT, PLAY_TOP)
const PEG_LAYOUT = [
  // Row 1 — 4 pegs, shifted right
  {x:240,y:52},{x:290,y:44},{x:196,y:66},{x:148,y:52},
  // Row 2 — 5 pegs
  {x:60,y:110},{x:116,y:98},{x:176,y:118},{x:248,y:104},{x:306,y:92},
  // Row 3 — 4 pegs, shifted left
  {x:44,y:162},{x:100,y:172},{x:156,y:158},{x:220,y:174},{x:280,y:148},
  // Row 4 — 5 pegs
  {x:72,y:228},{x:132,y:214},{x:188,y:232},{x:252,y:220},{x:316,y:208},
  // Row 5 — 4 pegs
  {x:48,y:284},{x:108,y:270},{x:164,y:290},{x:228,y:276},{x:292,y:262},
  // Row 6 — 5 pegs
  {x:76,y:340},{x:136,y:328},{x:196,y:348},{x:260,y:332},{x:320,y:318},
  // Row 7 — 4 pegs, tighter
  {x:52,y:392},{x:120,y:380},{x:184,y:400},{x:248,y:386},
  // Scattered mid-board
  {x:320,y:370},{x:88,y:440},{x:160,y:452},{x:232,y:438},{x:296,y:424},
];
const PEG_R = 6;
const BALL_R = 8;

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
    if (!this.saveData.tutorials)       this.saveData.tutorials = {};

    this.fatigue    = this.saveData.merchantFatigue.ricochet || 0;
    this.ballActive = false;
    this.showFullPreview = false;

    // ── Play area bounds ───────────────────────────────────────────────────
    this.PLAY_LEFT   = 12;
    this.PLAY_RIGHT  = 346;
    this.PLAY_TOP    = 238;
    this.PLAY_BOTTOM = 652;
    this.PLAY_W      = this.PLAY_RIGHT - this.PLAY_LEFT;
    this.PLAY_H      = this.PLAY_BOTTOM - this.PLAY_TOP;

    // Launcher on right wall, vertically centred in play area
    this.LAUNCHER_X  = this.PLAY_RIGHT;
    this.LAUNCHER_Y  = this.PLAY_TOP + this.PLAY_H * 0.38;
    this.aimAngle    = Math.PI;  // start pointing straight left (180°)
    // Clamp: leftward half-plane, dead zones at ±80° from horizontal left
    this.AIM_MIN     = Math.PI * 0.22;   // ~40° above horizontal
    this.AIM_MAX     = Math.PI * 1.78;   // ~40° below horizontal

    // Bucket
    this.bucketW     = 56;
    this.bucketX     = this.PLAY_LEFT + this.PLAY_W / 2;
    this.bucketDir   = 1;
    this.bucketSpeed = 68;

    // Bin widths
    this.BIN_W = this.PLAY_W / 5;

    // Build peg world coords
    this.pegs = PEG_LAYOUT.map(p => ({
      x: this.PLAY_LEFT + p.x,
      y: this.PLAY_TOP  + p.y,
      r: PEG_R,
      lit: false
    }));

    // ── Draw ──────────────────────────────────────────────────────────────
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
    this.add.text(width / 2 + 20, 152, 'THE BOARD', { fontFamily: 'monospace', fontSize: '11px', color: '#8899aa', letterSpacing: 3 }).setOrigin(0.5);

    this.nutsText  = this.add.text(width / 2 - 72, 216, `${this.saveData.nuts} NUTS`,  { fontFamily: 'monospace', fontSize: '12px', color: '#e8a020', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(width / 2, 216, '·', { fontFamily: 'monospace', fontSize: '12px', color: '#334455' }).setOrigin(0.5);
    this.boltsText = this.add.text(width / 2 + 72, 216, `${this.saveData.bolts} BOLTS`, { fontFamily: 'monospace', fontSize: '12px', color: '#8ab4cc', fontStyle: 'bold' }).setOrigin(0.5);

    // ── Play field border ─────────────────────────────────────────────────
    this.add.rectangle(
      this.PLAY_LEFT + this.PLAY_W / 2,
      this.PLAY_TOP  + this.PLAY_H / 2,
      this.PLAY_W, this.PLAY_H, 0x0a0e14
    );
    this.add.rectangle(
      this.PLAY_LEFT + this.PLAY_W / 2,
      this.PLAY_TOP  + this.PLAY_H / 2,
      this.PLAY_W, this.PLAY_H
    ).setStrokeStyle(1, 0x5eba7d, 0.25);

    // ── Pegs ──────────────────────────────────────────────────────────────
    this.pegGfx = this.add.graphics().setDepth(2);
    this._drawPegs();

    // ── Bins ──────────────────────────────────────────────────────────────
    this._drawBins();

    // ── Moving bucket ─────────────────────────────────────────────────────
    this.bucketGfx = this.add.graphics().setDepth(4);
    this._drawBucket();

    // ── Preview line ──────────────────────────────────────────────────────
    this.previewGfx = this.add.graphics().setDepth(3);

    // ── Launcher ──────────────────────────────────────────────────────────
    this.launcherGfx = this.add.graphics().setDepth(5);
    this._drawLauncher();

    // Launcher tap zone for full-preview toggle
    const lZone = this.add.circle(this.LAUNCHER_X, this.LAUNCHER_Y, 22).setInteractive();
    lZone.on('pointerdown', () => {
      this.showFullPreview = !this.showFullPreview;
      this._drawPreview();
    });

    // Aim label
    this.aimHint = this.add.text(this.LAUNCHER_X - 14, this.LAUNCHER_Y + 28, 'DRAG\nTO AIM', {
      fontFamily: 'monospace', fontSize: '8px', color: '#5eba7d', align: 'right', letterSpacing: 1
    }).setOrigin(1, 0).setDepth(5);

    // ── Ball ──────────────────────────────────────────────────────────────
    this.ballGfx = this.add.circle(-50, -50, BALL_R, 0x5eba7d).setDepth(6);
    this.ball    = { x: 0, y: 0, vx: 0, vy: 0 };

    // ── Result text ───────────────────────────────────────────────────────
    this.resultText = this.add.text(width / 2, this.PLAY_TOP + 20, '', {
      fontFamily: 'monospace', fontSize: '15px', color: '#5eba7d', fontStyle: 'bold', letterSpacing: 2
    }).setOrigin(0.5).setAlpha(0).setDepth(10);

    // ── Fatigue strip ─────────────────────────────────────────────────────
    const fatY = this.PLAY_BOTTOM + 20;
    this.add.text(width / 2, fatY, 'FATIGUE', { fontFamily: 'monospace', fontSize: '9px', color: '#445566', letterSpacing: 3 }).setOrigin(0.5);
    const bW = width - 80, bY = fatY + 14;
    this.add.rectangle(width / 2, bY, bW, 6, 0x1a2230);
    this.fatigueFill  = this.add.rectangle(width / 2 - bW / 2, bY, 2, 6, 0x5eba7d).setOrigin(0, 0.5);
    this.fatigueLabel = this.add.text(width / 2, bY + 13, this._fatigueText(), { fontFamily: 'monospace', fontSize: '9px', color: '#556677' }).setOrigin(0.5);
    this._updateFatigueBar(bW);

    // ── FIRE button ───────────────────────────────────────────────────────
    const btnY = height - 76;
    this.fireBg  = this.add.rectangle(width / 2, btnY, width - 48, 60, 0x0d1e10).setInteractive();
    this.fireBdr = this.add.rectangle(width / 2, btnY, width - 48, 60).setStrokeStyle(2, 0x5eba7d);
    this.fireTxt = this.add.text(width / 2, btnY - 8, 'FIRE', { fontFamily: 'monospace', fontSize: '22px', color: '#5eba7d', fontStyle: 'bold' }).setOrigin(0.5);
    this.fireSub = this.add.text(width / 2, btnY + 14, `COSTS ${this._rollCost()} NUTS`, { fontFamily: 'monospace', fontSize: '10px', color: '#556677', letterSpacing: 1 }).setOrigin(0.5);
    this.fireBg.on('pointerdown', () => this._fire());
    this.fireBg.on('pointerover', () => this.fireBg.setFillStyle(0x122018));
    this.fireBg.on('pointerout',  () => this.fireBg.setFillStyle(0x0d1e10));

    // ── Drag input for aiming ─────────────────────────────────────────────
    this._isDragging = false;
    this._onDown = (p) => {
      if (this.ballActive) return;
      if (p.y < this.PLAY_TOP || p.y > this.PLAY_BOTTOM) return;
      this._isDragging = true;
      this._updateAim(p);
    };
    this._onMove = (p) => {
      if (!this._isDragging || this.ballActive) return;
      this._updateAim(p);
    };
    this._onUp = () => { this._isDragging = false; };
    this.input.on('pointerdown',      this._onDown);
    this.input.on('pointermove',      this._onMove);
    this.input.on('pointerup',        this._onUp);
    this.input.on('pointerupoutside', this._onUp);
    this.events.on('shutdown', () => {
      this.input.off('pointerdown',      this._onDown);
      this.input.off('pointermove',      this._onMove);
      this.input.off('pointerup',        this._onUp);
      this.input.off('pointerupoutside', this._onUp);
    });

    this._drawPreview();
    this._refreshFireButton();

    // ── Tutorial ──────────────────────────────────────────────────────────
    if (!this.saveData.tutorials.ricochet) {
      this.time.delayedCall(200, () => this._showTutorial());
    }
  }

  // ── Drawing helpers ───────────────────────────────────────────────────────
  _drawPegs() {
    this.pegGfx.clear();
    this.pegs.forEach(peg => {
      this.pegGfx.fillStyle(peg.lit ? 0x5eba7d : 0x2a3a4a, 1);
      this.pegGfx.fillCircle(peg.x, peg.y, peg.r + (peg.lit ? 2 : 0));
    });
  }

  _drawBins() {
    const gfx = this.add.graphics().setDepth(3);
    const binColors = [0xe8a020, 0x5eba7d, 0x334455, 0x5eba7d, 0xe8a020];
    const binBgColors = [0x1a1200, 0x0d1e10, 0x0f1318, 0x0d1e10, 0x1a1200];
    const binY = this.PLAY_BOTTOM;

    RICOCHET_BINS.forEach((payout, i) => {
      const bx  = this.PLAY_LEFT + i * this.BIN_W;
      const cx  = bx + this.BIN_W / 2;
      gfx.fillStyle(binBgColors[i], 1);
      gfx.fillRect(bx + 1, binY, this.BIN_W - 2, 38);
      gfx.lineStyle(1, binColors[i], 0.7);
      gfx.strokeRect(bx + 1, binY, this.BIN_W - 2, 38);
      this.add.text(cx, binY + 10, `${payout}`, {
        fontFamily: 'monospace', fontSize: '13px',
        color: '#' + binColors[i].toString(16).padStart(6, '0'), fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(4);
      this.add.text(cx, binY + 26, 'B', {
        fontFamily: 'monospace', fontSize: '8px', color: '#556677'
      }).setOrigin(0.5).setDepth(4);
      // Divider
      if (i > 0) { gfx.lineStyle(1, 0x1e2a38); gfx.lineBetween(bx, binY - 8, bx, binY + 38); }
    });

    // ×2 bucket label area above bins
    this.add.text(this.PLAY_LEFT + this.PLAY_W / 2, this.PLAY_BOTTOM - 14, '× 2  BUCKET', {
      fontFamily: 'monospace', fontSize: '9px', color: '#334455', letterSpacing: 2
    }).setOrigin(0.5).setDepth(4);
  }

  _drawBucket() {
    this.bucketGfx.clear();
    const by = this.PLAY_BOTTOM - 3;
    this.bucketGfx.fillStyle(0x5eba7d, 0.25);
    this.bucketGfx.fillRect(this.bucketX - this.bucketW / 2, by - 6, this.bucketW, 10);
    this.bucketGfx.lineStyle(2, 0x5eba7d, 0.8);
    this.bucketGfx.strokeRect(this.bucketX - this.bucketW / 2, by - 6, this.bucketW, 10);
  }

  _drawLauncher() {
    this.launcherGfx.clear();
    const lx = this.LAUNCHER_X, ly = this.LAUNCHER_Y;
    // Body
    this.launcherGfx.fillStyle(0x1e2a38, 1);
    this.launcherGfx.fillCircle(lx, ly, 18);
    this.launcherGfx.lineStyle(2, 0x5eba7d, 0.9);
    this.launcherGfx.strokeCircle(lx, ly, 18);
    // Barrel — points in aim direction
    const bLen = 28;
    const bx2  = lx + Math.cos(this.aimAngle) * bLen;
    const by2  = ly + Math.sin(this.aimAngle) * bLen;
    this.launcherGfx.lineStyle(4, 0x5eba7d, 1);
    this.launcherGfx.lineBetween(lx, ly, bx2, by2);
    // Inner dot
    this.launcherGfx.fillStyle(0x5eba7d, 1);
    this.launcherGfx.fillCircle(lx, ly, 5);
  }

  _drawPreview() {
    this.previewGfx.clear();
    const lx = this.LAUNCHER_X, ly = this.LAUNCHER_Y;
    const dx = Math.cos(this.aimAngle), dy = Math.sin(this.aimAngle);

    if (this.showFullPreview) {
      // Simulate full trajectory (no peg collisions — just gravity arc)
      this.previewGfx.lineStyle(1, 0x5eba7d, 0.35);
      let sx = lx, sy = ly, svx = dx * BALL_SPEED, svy = dy * BALL_SPEED;
      let steps = 0;
      while (steps < 120 && sy < this.PLAY_BOTTOM + 20 && sx > this.PLAY_LEFT - 20) {
        const nx = sx + svx * 0.016, ny = sy + svy * 0.016;
        svy += GRAVITY * 0.016;
        if (nx < this.PLAY_LEFT)  { svx = Math.abs(svx); }
        if (nx > this.PLAY_RIGHT) { svx = -Math.abs(svx); }
        if (steps % 3 === 0) this.previewGfx.fillStyle(0x5eba7d, 0.3), this.previewGfx.fillCircle(sx, sy, 2);
        sx = Phaser.Math.Clamp(nx, this.PLAY_LEFT, this.PLAY_RIGHT);
        sy = ny;
        steps++;
      }
    } else {
      // Short dotted preview — 10 dots, 14px apart
      this.previewGfx.fillStyle(0x5eba7d, 0.6);
      for (let i = 1; i <= 10; i++) {
        const t  = i * 14 / BALL_SPEED;
        const px = lx + dx * BALL_SPEED * t;
        const py = ly + dy * BALL_SPEED * t + 0.5 * GRAVITY * t * t;
        const a  = Math.max(0, 0.6 - i * 0.05);
        this.previewGfx.fillStyle(0x5eba7d, a);
        this.previewGfx.fillCircle(px, py, Math.max(1, 3 - i * 0.2));
      }
      // TAP LAUNCHER hint
    }
  }

  _updateAim(pointer) {
    const dx   = pointer.x - this.LAUNCHER_X;
    const dy   = pointer.y - this.LAUNCHER_Y;
    let angle  = Math.atan2(dy, dx);
    // Normalise to [0, 2π]
    if (angle < 0) angle += Math.PI * 2;
    // Clamp to leftward arc
    if (angle < Math.PI * 0.22) angle = Math.PI * 0.22;
    if (angle > Math.PI * 1.78) angle = Math.PI * 1.78;
    this.aimAngle = angle;
    this._drawLauncher();
    this._drawPreview();
  }

  // ── Fire ──────────────────────────────────────────────────────────────────
  _fire() {
    const cost = this._rollCost();
    if (this.saveData.nuts < cost || this.ballActive) return;

    this.saveData.nuts -= cost;
    this.nutsText.setText(`${this.saveData.nuts} NUTS`);
    this.ballActive = true;
    this.showFullPreview = false;
    this.previewGfx.clear();
    this.aimHint.setAlpha(0);

    // Init ball
    this.ball.x   = this.LAUNCHER_X + Math.cos(this.aimAngle) * 22;
    this.ball.y   = this.LAUNCHER_Y + Math.sin(this.aimAngle) * 22;
    this.ball.vx  = Math.cos(this.aimAngle) * BALL_SPEED;
    this.ball.vy  = Math.sin(this.aimAngle) * BALL_SPEED;
    this.ballGfx.setPosition(this.ball.x, this.ball.y).setAlpha(1);

    this.fireBg.disableInteractive();
    this.tweens.add({ targets: this.resultText, alpha: 0, duration: 100 });
  }

  // ── Physics update ────────────────────────────────────────────────────────
  update(time, delta) {
    // Move bucket
    if (!this.ballActive) {
      this.bucketX += this.bucketDir * this.bucketSpeed * (delta / 1000);
      if (this.bucketX + this.bucketW / 2 > this.PLAY_RIGHT) {
        this.bucketX = this.PLAY_RIGHT - this.bucketW / 2;
        this.bucketDir = -1;
      }
      if (this.bucketX - this.bucketW / 2 < this.PLAY_LEFT) {
        this.bucketX = this.PLAY_LEFT + this.bucketW / 2;
        this.bucketDir = 1;
      }
      this._drawBucket();
      return;
    }

    const dt = Math.min(delta / 1000, 0.025);

    // Gravity
    this.ball.vy += GRAVITY * dt;

    // Move
    this.ball.x += this.ball.vx * dt;
    this.ball.y += this.ball.vy * dt;

    // Wall collisions
    const L = this.PLAY_LEFT + BALL_R, R = this.PLAY_RIGHT - BALL_R;
    if (this.ball.x < L) { this.ball.x = L; this.ball.vx = Math.abs(this.ball.vx) * 0.72; }
    if (this.ball.x > R) { this.ball.x = R; this.ball.vx = -Math.abs(this.ball.vx) * 0.72; }
    if (this.ball.y < this.PLAY_TOP + BALL_R) {
      this.ball.y = this.PLAY_TOP + BALL_R;
      this.ball.vy = Math.abs(this.ball.vy) * 0.72;
    }

    // Peg collisions
    let pegHit = false;
    this.pegs.forEach(peg => {
      const dx   = this.ball.x - peg.x;
      const dy   = this.ball.y - peg.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minD = BALL_R + peg.r;
      if (dist < minD && dist > 0.01) {
        const nx  = dx / dist, ny = dy / dist;
        const dot = this.ball.vx * nx + this.ball.vy * ny;
        if (dot < 0) {
          this.ball.vx -= (1 + 0.65) * dot * nx;
          this.ball.vy -= (1 + 0.65) * dot * ny;
          // Slight random scatter
          this.ball.vx += (Math.random() - 0.5) * 18;
        }
        const ov = minD - dist;
        this.ball.x += nx * ov;
        this.ball.y += ny * ov;

        if (!peg.lit) {
          peg.lit = true;
          pegHit  = true;
          this.time.delayedCall(180, () => { peg.lit = false; this._drawPegs(); });
        }
      }
    });
    if (pegHit) this._drawPegs();

    this.ballGfx.setPosition(this.ball.x, this.ball.y);

    // Move bucket while ball is in flight
    this.bucketX += this.bucketDir * this.bucketSpeed * dt;
    if (this.bucketX + this.bucketW / 2 > this.PLAY_RIGHT) {
      this.bucketX = this.PLAY_RIGHT - this.bucketW / 2; this.bucketDir = -1;
    }
    if (this.bucketX - this.bucketW / 2 < this.PLAY_LEFT) {
      this.bucketX = this.PLAY_LEFT + this.bucketW / 2; this.bucketDir = 1;
    }
    this._drawBucket();

    // Reached bottom
    if (this.ball.y >= this.PLAY_BOTTOM - BALL_R) {
      this._resolve();
    }
  }

  _resolve() {
    this.ballActive = false;

    // Which bin?
    const relX  = this.ball.x - this.PLAY_LEFT;
    const idx   = Phaser.Math.Clamp(Math.floor(relX / this.BIN_W), 0, 4);
    let payout  = RICOCHET_BINS[idx];
    let inBucket = false;

    // Bucket check
    if (Math.abs(this.ball.x - this.bucketX) < this.bucketW / 2 + BALL_R) {
      payout  *= BUCKET_MULTIPLIER;
      inBucket = true;
      this.cameras.main.flash(150, 92, 186, 125, false);
    }

    // Fatigue multiplier
    const mult    = Math.max(0.2, 1 / (1 + 0.08 * this.fatigue));
    payout        = Math.max(1, Math.round(payout * mult));

    this.saveData.bolts += payout;
    this.fatigue++;
    this.saveData.merchantFatigue.ricochet = this.fatigue;
    this._save();

    this.boltsText.setText(`${this.saveData.bolts} BOLTS`);
    this.tweens.add({ targets: this.boltsText, scaleX: 1.3, scaleY: 1.3, duration: 150, yoyo: true });

    const { width } = this.scale;
    const isEdge   = idx === 0 || idx === 4;
    const col      = inBucket ? '#eef2f8' : isEdge ? '#e8a020' : '#5eba7d';
    const msg      = inBucket
      ? `BUCKET ×2!  +${payout} BOLTS`
      : isEdge
        ? `EDGE!  +${payout} BOLTS`
        : `+${payout} BOLT${payout === 1 ? '' : 'S'}`;

    this.resultText.setText(msg).setStyle({ color: col }).setAlpha(0);
    this.tweens.add({ targets: this.resultText, alpha: 1, duration: 250 });

    // Sink ball
    this.tweens.add({ targets: this.ballGfx, alpha: 0, y: this.ball.y + 24, duration: 300 });

    this.time.delayedCall(600, () => {
      this.ballGfx.setPosition(-50, -50).setAlpha(1);
      this.aimHint.setAlpha(1);
      this._drawPreview();
      const bW = this.scale.width - 80;
      this._updateFatigueBar(bW);
      this.fatigueLabel.setText(this._fatigueText());
      this._refreshFireButton();
    });
  }

  // ── Fatigue ───────────────────────────────────────────────────────────────
  _rollCost() {
    return Math.min(Math.round(RICOCHET_BASE_COST * (1 + Math.pow(this.fatigue, 3) / 500)), 60);
  }
  _fatigueText() {
    if (this.fatigue === 0) return 'FRESH — FULL PAYOUTS';
    if (this.fatigue < 6)   return `WARM (${this.fatigue} SHOTS)`;
    if (this.fatigue < 14)  return `TIRED (${this.fatigue} SHOTS) — REDUCED`;
    return `BURNT (${this.fatigue} SHOTS) — HEAVY REDUCTION`;
  }
  _updateFatigueBar(bW) {
    const pct = Math.min(this.fatigue / 20, 1);
    const col = this.fatigue < 6 ? 0x5eba7d : this.fatigue < 14 ? 0xe8a020 : 0xc43a3a;
    this.fatigueFill.setSize(Math.max(2, bW * pct), 6).setFillStyle(col);
  }
  _refreshFireButton() {
    const cost = this._rollCost(), ok = this.saveData.nuts >= cost && !this.ballActive;
    this.fireTxt.setStyle({ color: ok ? '#5eba7d' : '#445566' });
    this.fireBg.setFillStyle(ok ? 0x0d1e10 : 0x161b22);
    this.fireBdr.setStrokeStyle(2, ok ? 0x5eba7d : 0x334455);
    this.fireSub.setText(`COSTS ${cost} NUTS`).setStyle({ color: ok ? '#8899aa' : '#334455' });
    if (ok) this.fireBg.setInteractive(); else this.fireBg.disableInteractive();
  }
  _save() {
    this.saveData.merchantFatigue.ricochet = this.fatigue;
    localStorage.setItem(this.saveKey, JSON.stringify(this.saveData));
  }

  // ── Tutorial ──────────────────────────────────────────────────────────────
  _showTutorial() {
    const { width, height } = this.scale;
    const steps = [
      {
        targetY: this.LAUNCHER_Y, targetH: 44, targetW: 44, targetX: this.LAUNCHER_X,
        title: 'THE LAUNCHER',
        body: 'DRAG ANYWHERE ON THE BOARD\nTO AIM. THE BARREL FOLLOWS.'
      },
      {
        targetY: this.PLAY_TOP + this.PLAY_H / 2, targetH: this.PLAY_H, targetW: this.PLAY_W, targetX: this.PLAY_LEFT + this.PLAY_W / 2,
        title: 'THE BOARD',
        body: 'BOUNCE THE BALL OFF PEGS.\nTAP THE LAUNCHER FOR A\nFULL TRAJECTORY PREVIEW.'
      },
      {
        targetY: this.PLAY_BOTTOM, targetH: 20, targetW: this.bucketW + 12, targetX: this.bucketX,
        title: 'THE BUCKET',
        body: `LAND IN THE MOVING BUCKET\nFOR ${BUCKET_MULTIPLIER}× YOUR BIN PAYOUT.\nWATCH ITS TIMING.`
      },
      {
        targetY: this.PLAY_BOTTOM + 19, targetH: 38, targetW: this.PLAY_W, targetX: this.PLAY_LEFT + this.PLAY_W / 2,
        title: 'THE BINS',
        body: 'OUTER BINS PAY MORE.\nMIDDLE BIN IS THE SAFE CATCH.\nAIM FOR THE EDGES.'
      },
    ];

    let step = 0;
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.72).setDepth(50);
    const pulseRect = this.add.rectangle(0, 0, 0, 0).setStrokeStyle(2, 0xe8a020).setDepth(51);
    this.tweens.add({ targets: pulseRect, alpha: 0.4, duration: 600, yoyo: true, repeat: -1 });

    const cardY = height - 170;
    const card    = this.add.rectangle(width / 2, cardY, width - 32, 100, 0x0a0e14, 0.98).setDepth(52);
    this.add.rectangle(width / 2, cardY, width - 32, 100).setStrokeStyle(1, 0xe8a020, 0.6).setDepth(52);
    const titleTxt = this.add.text(width / 2, cardY - 30, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#e8a020', fontStyle: 'bold', letterSpacing: 3
    }).setOrigin(0.5).setDepth(53);
    const bodyTxt  = this.add.text(width / 2, cardY + 2, '', {
      fontFamily: 'monospace', fontSize: '11px', color: '#8899aa', align: 'center', letterSpacing: 1,
      wordWrap: { width: width - 60 }
    }).setOrigin(0.5).setDepth(53);
    const tapHint  = this.add.text(width / 2, cardY + 38, 'TAP TO CONTINUE', {
      fontFamily: 'monospace', fontSize: '9px', color: '#334455', letterSpacing: 3
    }).setOrigin(0.5).setDepth(53);

    const showStep = (i) => {
      const s = steps[i];
      pulseRect.setPosition(s.targetX, s.targetY).setSize(s.targetW + 12, s.targetH + 12);
      titleTxt.setText(s.title);
      bodyTxt.setText(s.body);
    };

    showStep(0);

    const advanceTut = () => {
      step++;
      if (step >= steps.length) {
        [overlay, pulseRect, card, titleTxt, bodyTxt, tapHint].forEach(e => e.destroy());
        overlay.off('pointerdown', advanceTut);
        this.saveData.tutorials.ricochet = true;
        this._save();
        return;
      }
      showStep(step);
    };

    overlay.setInteractive();
    overlay.on('pointerdown', advanceTut);
  }
}
