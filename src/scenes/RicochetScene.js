// ── RicochetScene.js ─────────────────────────────────────────────────────────
// Peggle-style top launcher. Ball fires downward. Drag anywhere on screen to
// aim — barrel follows. Staggered peg grid (6 rows, alternating 5/4 pegs).
// Moving bucket for 2× payout. 5 scoring bins at bottom.

const RICOCHET_BASE_COST = 3;
const RICOCHET_BINS      = [16, 8, 3, 8, 16];
const BUCKET_MULTIPLIER  = 2;
const BALL_SPEED         = 300;
const GRAVITY            = 480;
const PEG_R              = 7;
const BALL_R             = 8;

// Staggered grid — coordinates relative to (PLAY_LEFT, PLAY_TOP)
// Alternating 5-peg rows (outer-aligned) and 4-peg rows (offset inward).
const PEG_LAYOUT = [
  // Row 1 y=50 — 5 pegs
  {x:40,y:50},{x:111,y:50},{x:181,y:50},{x:251,y:50},{x:322,y:50},
  // Row 2 y=106 — 4 pegs, offset
  {x:76,y:106},{x:146,y:106},{x:216,y:106},{x:286,y:106},
  // Row 3 y=162 — 5 pegs
  {x:40,y:162},{x:111,y:162},{x:181,y:162},{x:251,y:162},{x:322,y:162},
  // Row 4 y=218 — 4 pegs, offset
  {x:76,y:218},{x:146,y:218},{x:216,y:218},{x:286,y:218},
  // Row 5 y=274 — 5 pegs
  {x:40,y:274},{x:111,y:274},{x:181,y:274},{x:251,y:274},{x:322,y:274},
  // Row 6 y=330 — 4 pegs, offset
  {x:76,y:330},{x:146,y:330},{x:216,y:330},{x:286,y:330},
];

class RicochetScene extends Phaser.Scene {
  constructor() { super({ key: 'RicochetScene' }); }

  create() {
    const { width, height } = this.scale;
    const slotIndex  = localStorage.getItem('factower_active_slot');
    this.saveKey     = 'factower_save_' + slotIndex;
    this.saveData    = JSON.parse(localStorage.getItem(this.saveKey)) || {};
    if (!this.saveData.nuts)            this.saveData.nuts = 0;
    if (!this.saveData.bolts)           this.saveData.bolts = 0;
    if (!this.saveData.merchantFatigue) this.saveData.merchantFatigue = { chrome: 0, ricochet: 0, doubleDown: 0 };
    if (!this.saveData.tutorials)       this.saveData.tutorials = {};

    this.fatigue         = this.saveData.merchantFatigue.ricochet || 0;
    this.ballActive      = false;
    this.showFullPreview = false;

    // ── Play area bounds ────────────────────────────────────────────────
    this.PLAY_LEFT   = 14;
    this.PLAY_RIGHT  = 376;
    this.PLAY_TOP    = 252;
    this.PLAY_BOTTOM = 638;
    this.PLAY_W      = this.PLAY_RIGHT - this.PLAY_LEFT;   // 362
    this.PLAY_H      = this.PLAY_BOTTOM - this.PLAY_TOP;   // 386

    // Launcher sits at top-centre, barrel points into the play field
    this.LAUNCHER_X  = width / 2;
    this.LAUNCHER_Y  = 234;                                 // circle edge = PLAY_TOP
    this.aimAngle    = Math.PI / 2;                         // default: straight down

    // Bucket
    this.bucketW     = 58;
    this.bucketX     = this.PLAY_LEFT + this.PLAY_W / 2;
    this.bucketDir   = 1;
    this.bucketSpeed = 70;

    // Bin width
    this.BIN_W = this.PLAY_W / RICOCHET_BINS.length;       // 72.4 px each

    // Build pegs in world coords
    this.pegs = PEG_LAYOUT.map(p => ({
      x:   this.PLAY_LEFT + p.x,
      y:   this.PLAY_TOP  + p.y,
      r:   PEG_R,
      lit: false
    }));

    // ── Scene background ────────────────────────────────────────────────
    this.add.rectangle(width / 2, height / 2, width, height, 0x0d1117);
    this.add.rectangle(width / 2, 0, width, 4, 0x5eba7d, 0.4);

    // ── Header ──────────────────────────────────────────────────────────
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

    this.nutsText  = this.add.text(width / 2 - 72, 216, this.saveData.nuts + ' NUTS',  { fontFamily: 'monospace', fontSize: '12px', color: '#e8a020',  fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(width / 2, 216, '·', { fontFamily: 'monospace', fontSize: '12px', color: '#334455' }).setOrigin(0.5);
    this.boltsText = this.add.text(width / 2 + 72, 216, this.saveData.bolts + ' BOLTS', { fontFamily: 'monospace', fontSize: '12px', color: '#8ab4cc', fontStyle: 'bold' }).setOrigin(0.5);

    // ── Play field ───────────────────────────────────────────────────────
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

    // ── Pegs ────────────────────────────────────────────────────────────
    this.pegGfx = this.add.graphics().setDepth(2);
    this._drawPegs();

    // ── Bins ────────────────────────────────────────────────────────────
    this._drawBins();

    // ── Bucket ──────────────────────────────────────────────────────────
    this.bucketGfx = this.add.graphics().setDepth(4);
    this._drawBucket();

    // ── Preview line ────────────────────────────────────────────────────
    this.previewGfx = this.add.graphics().setDepth(3);

    // ── Launcher ────────────────────────────────────────────────────────
    this.launcherGfx = this.add.graphics().setDepth(5);
    this._drawLauncher();

    // Tap launcher circle to toggle full arc preview
    this.add.circle(this.LAUNCHER_X, this.LAUNCHER_Y, 24).setInteractive()
      .on('pointerdown', () => {
        if (!this.ballActive) {
          this.showFullPreview = !this.showFullPreview;
          this._drawPreview();
        }
      });

    // Aim hint text below launcher
    this.aimHint = this.add.text(width / 2, this.LAUNCHER_Y + 30, 'DRAG TO AIM', {
      fontFamily: 'monospace', fontSize: '8px', color: '#2a5538', letterSpacing: 2
    }).setOrigin(0.5).setDepth(5);

    // ── Ball ─────────────────────────────────────────────────────────────
    this.ballGfx = this.add.circle(-50, -50, BALL_R, 0x5eba7d).setDepth(6);
    this.ball    = { x: 0, y: 0, vx: 0, vy: 0 };

    // ── Result text ──────────────────────────────────────────────────────
    this.resultText = this.add.text(width / 2, this.PLAY_TOP + 24, '', {
      fontFamily: 'monospace', fontSize: '15px', color: '#5eba7d', fontStyle: 'bold', letterSpacing: 2
    }).setOrigin(0.5).setAlpha(0).setDepth(10);

    // ── Fatigue strip ─────────────────────────────────────────────────────
    const fatY = 688;
    this.add.text(width / 2, fatY, 'FATIGUE', { fontFamily: 'monospace', fontSize: '9px', color: '#445566', letterSpacing: 3 }).setOrigin(0.5);
    const bW = width - 80, bY = fatY + 14;
    this.add.rectangle(width / 2, bY, bW, 6, 0x1a2230);
    this.fatigueFill  = this.add.rectangle(width / 2 - bW / 2, bY, 2, 6, 0x5eba7d).setOrigin(0, 0.5);
    this.fatigueLabel = this.add.text(width / 2, bY + 13, this._fatigueText(), { fontFamily: 'monospace', fontSize: '9px', color: '#556677' }).setOrigin(0.5);
    this._updateFatigueBar(bW);

    // ── FIRE button ───────────────────────────────────────────────────────
    const btnY   = height - 76;
    this.fireBg  = this.add.rectangle(width / 2, btnY, width - 48, 60, 0x0d1e10).setInteractive();
    this.fireBdr = this.add.rectangle(width / 2, btnY, width - 48, 60).setStrokeStyle(2, 0x5eba7d);
    this.fireTxt = this.add.text(width / 2, btnY - 8, 'FIRE', { fontFamily: 'monospace', fontSize: '22px', color: '#5eba7d', fontStyle: 'bold' }).setOrigin(0.5);
    this.fireSub = this.add.text(width / 2, btnY + 14, 'COSTS ' + this._rollCost() + ' NUTS', { fontFamily: 'monospace', fontSize: '10px', color: '#556677', letterSpacing: 1 }).setOrigin(0.5);
    this.fireBg.on('pointerdown', () => this._fire());
    this.fireBg.on('pointerover', () => this.fireBg.setFillStyle(0x122018));
    this.fireBg.on('pointerout',  () => this.fireBg.setFillStyle(0x0d1e10));

    // ── Aiming input ──────────────────────────────────────────────────────
    // Drag anywhere — barrel follows touch point relative to launcher.
    this._isDragging = false;
    this._onDown = (p) => {
      if (this.ballActive) return;
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
    const gfx       = this.add.graphics().setDepth(3);
    const binColors   = [0xe8a020, 0x5eba7d, 0x334455, 0x5eba7d, 0xe8a020];
    const binBgColors = [0x1a1200, 0x0d1e10, 0x0f1318, 0x0d1e10, 0x1a1200];

    RICOCHET_BINS.forEach((payout, i) => {
      const bx = this.PLAY_LEFT + i * this.BIN_W;
      const cx = bx + this.BIN_W / 2;
      gfx.fillStyle(binBgColors[i], 1);
      gfx.fillRect(bx + 1, this.PLAY_BOTTOM, this.BIN_W - 2, 38);
      gfx.lineStyle(1, binColors[i], 0.7);
      gfx.strokeRect(bx + 1, this.PLAY_BOTTOM, this.BIN_W - 2, 38);
      this.add.text(cx, this.PLAY_BOTTOM + 10, '' + payout, {
        fontFamily: 'monospace', fontSize: '13px',
        color: '#' + binColors[i].toString(16).padStart(6, '0'), fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(4);
      this.add.text(cx, this.PLAY_BOTTOM + 26, 'B', {
        fontFamily: 'monospace', fontSize: '8px', color: '#556677'
      }).setOrigin(0.5).setDepth(4);
      if (i > 0) {
        gfx.lineStyle(1, 0x1e2a38);
        gfx.lineBetween(bx, this.PLAY_BOTTOM - 8, bx, this.PLAY_BOTTOM + 38);
      }
    });

    this.add.text(this.PLAY_LEFT + this.PLAY_W / 2, this.PLAY_BOTTOM - 14, '× 2  BUCKET', {
      fontFamily: 'monospace', fontSize: '9px', color: '#334455', letterSpacing: 2
    }).setOrigin(0.5).setDepth(4);
  }

  _drawBucket() {
    this.bucketGfx.clear();
    const by = this.PLAY_BOTTOM - 4;
    this.bucketGfx.fillStyle(0x5eba7d, 0.22);
    this.bucketGfx.fillRect(this.bucketX - this.bucketW / 2, by - 8, this.bucketW, 12);
    this.bucketGfx.lineStyle(2, 0x5eba7d, 0.85);
    this.bucketGfx.strokeRect(this.bucketX - this.bucketW / 2, by - 8, this.bucketW, 12);
  }

  _drawLauncher() {
    this.launcherGfx.clear();
    const lx = this.LAUNCHER_X, ly = this.LAUNCHER_Y;

    // Body circle
    this.launcherGfx.fillStyle(0x1e2a38, 1);
    this.launcherGfx.fillCircle(lx, ly, 18);
    this.launcherGfx.lineStyle(2, 0x5eba7d, 0.9);
    this.launcherGfx.strokeCircle(lx, ly, 18);

    // Barrel pointing in aim direction
    const bx2 = lx + Math.cos(this.aimAngle) * 30;
    const by2 = ly + Math.sin(this.aimAngle) * 30;
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
      // Full gravity-arc simulation with wall bounces, no peg prediction
      let sx = lx, sy = ly, svx = dx * BALL_SPEED, svy = dy * BALL_SPEED;
      for (let i = 0; i < 220; i++) {
        const dt = 0.016;
        svy += GRAVITY * dt;
        sx  += svx * dt;
        sy  += svy * dt;
        if (sx < this.PLAY_LEFT  + BALL_R) { sx = this.PLAY_LEFT  + BALL_R; svx =  Math.abs(svx); }
        if (sx > this.PLAY_RIGHT - BALL_R) { sx = this.PLAY_RIGHT - BALL_R; svx = -Math.abs(svx); }
        if (sy > this.PLAY_BOTTOM) break;
        if (i % 2 === 0) {
          const a = Math.max(0.04, 0.45 - i * 0.002);
          this.previewGfx.fillStyle(0x5eba7d, a);
          this.previewGfx.fillCircle(sx, sy, 2);
        }
      }
    } else {
      // Short gravity-arc dotted line — 20 dots sampled every 40ms of travel
      for (let i = 1; i <= 20; i++) {
        const t  = i * 0.04;
        const px = lx + dx * BALL_SPEED * t;
        const py = ly + dy * BALL_SPEED * t + 0.5 * GRAVITY * t * t;
        if (py > this.PLAY_BOTTOM || px < this.PLAY_LEFT || px > this.PLAY_RIGHT) break;
        const a  = Math.max(0.04, 0.75 - i * 0.035);
        this.previewGfx.fillStyle(0x5eba7d, a);
        this.previewGfx.fillCircle(px, py, Math.max(1, 3 - i * 0.1));
      }
    }
  }

  _updateAim(pointer) {
    const dx = pointer.x - this.LAUNCHER_X;
    const dy = pointer.y - this.LAUNCHER_Y;
    // Only track touches that are below the launcher (dy > 0 = pointing downward)
    if (dy < 10) return;
    // atan2 with dy>0 naturally returns angle in (0, π) — no extra clamping needed
    // except dead zones near horizontal to prevent barely-descending shots
    let angle = Math.atan2(dy, dx);
    angle = Phaser.Math.Clamp(angle, 0.2, Math.PI - 0.2);
    this.aimAngle = angle;
    this._drawLauncher();
    this._drawPreview();
  }

  // ── Fire ──────────────────────────────────────────────────────────────────

  _fire() {
    const cost = this._rollCost();
    if (this.saveData.nuts < cost || this.ballActive) return;

    this.saveData.nuts -= cost;
    this.nutsText.setText(this.saveData.nuts + ' NUTS');
    this.ballActive      = true;
    this.showFullPreview = false;
    this.previewGfx.clear();
    this.aimHint.setAlpha(0);

    // Spawn ball at barrel tip
    this.ball.x  = this.LAUNCHER_X + Math.cos(this.aimAngle) * 22;
    this.ball.y  = this.LAUNCHER_Y + Math.sin(this.aimAngle) * 22;
    this.ball.vx = Math.cos(this.aimAngle) * BALL_SPEED;
    this.ball.vy = Math.sin(this.aimAngle) * BALL_SPEED;
    this.ballGfx.setPosition(this.ball.x, this.ball.y).setAlpha(1);

    this.fireBg.disableInteractive();
    this.tweens.add({ targets: this.resultText, alpha: 0, duration: 100 });

    // Safety timeout — resolve if ball somehow gets stuck
    this.time.delayedCall(10000, () => {
      if (this.ballActive) this._resolve();
    });
  }

  // ── Physics update ────────────────────────────────────────────────────────

  update(time, delta) {
    // Bucket always moves
    this.bucketX += this.bucketDir * this.bucketSpeed * (delta / 1000);
    if (this.bucketX + this.bucketW / 2 > this.PLAY_RIGHT) {
      this.bucketX = this.PLAY_RIGHT - this.bucketW / 2; this.bucketDir = -1;
    }
    if (this.bucketX - this.bucketW / 2 < this.PLAY_LEFT) {
      this.bucketX = this.PLAY_LEFT  + this.bucketW / 2; this.bucketDir = 1;
    }
    this._drawBucket();

    if (!this.ballActive) return;

    const dt = Math.min(delta / 1000, 0.025);

    // Gravity & movement
    this.ball.vy += GRAVITY * dt;
    this.ball.x  += this.ball.vx * dt;
    this.ball.y  += this.ball.vy * dt;

    // Wall collisions
    const L = this.PLAY_LEFT  + BALL_R;
    const R = this.PLAY_RIGHT - BALL_R;
    if (this.ball.x < L) { this.ball.x = L; this.ball.vx =  Math.abs(this.ball.vx) * 0.75; }
    if (this.ball.x > R) { this.ball.x = R; this.ball.vx = -Math.abs(this.ball.vx) * 0.75; }
    // Top wall bounce (in case ball deflects upward off a peg)
    if (this.ball.y < this.PLAY_TOP + BALL_R) {
      this.ball.y  = this.PLAY_TOP + BALL_R;
      this.ball.vy = Math.abs(this.ball.vy) * 0.75;
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
          // Small random scatter for interesting paths
          this.ball.vx += (Math.random() - 0.5) * 20;
        }
        // Push ball out of peg
        this.ball.x += nx * (minD - dist);
        this.ball.y += ny * (minD - dist);
        if (!peg.lit) {
          peg.lit = true;
          pegHit  = true;
          this.time.delayedCall(200, () => { peg.lit = false; this._drawPegs(); });
        }
      }
    });
    if (pegHit) this._drawPegs();

    this.ballGfx.setPosition(this.ball.x, this.ball.y);

    // Reached bottom — resolve
    if (this.ball.y >= this.PLAY_BOTTOM - BALL_R) {
      this._resolve();
    }
  }

  _resolve() {
    this.ballActive = false;

    const relX     = this.ball.x - this.PLAY_LEFT;
    const idx      = Phaser.Math.Clamp(Math.floor(relX / this.BIN_W), 0, 4);
    let   payout   = RICOCHET_BINS[idx];
    let   inBucket = false;

    // Bucket catch check
    if (Math.abs(this.ball.x - this.bucketX) < this.bucketW / 2 + BALL_R) {
      payout   *= BUCKET_MULTIPLIER;
      inBucket  = true;
      this.cameras.main.flash(150, 92, 186, 125, false);
    }

    // Apply fatigue multiplier
    const mult = Math.max(0.2, 1 / (1 + 0.08 * this.fatigue));
    payout     = Math.max(1, Math.round(payout * mult));

    this.saveData.bolts += payout;
    this.fatigue++;
    this.saveData.merchantFatigue.ricochet = this.fatigue;
    this._save();

    this.boltsText.setText(this.saveData.bolts + ' BOLTS');
    this.tweens.add({ targets: this.boltsText, scaleX: 1.3, scaleY: 1.3, duration: 150, yoyo: true });

    const isEdge = idx === 0 || idx === 4;
    const col    = inBucket ? '#eef2f8' : isEdge ? '#e8a020' : '#5eba7d';
    const msg    = inBucket
      ? 'BUCKET \xd72!  +' + payout + ' BOLTS'
      : isEdge
        ? 'EDGE!  +' + payout + ' BOLTS'
        : '+' + payout + ' BOLT' + (payout === 1 ? '' : 'S');

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

  // ── Fatigue & button ──────────────────────────────────────────────────────

  _rollCost() {
    return Math.min(Math.round(RICOCHET_BASE_COST * (1 + Math.pow(this.fatigue, 3) / 500)), 60);
  }
  _fatigueText() {
    if (this.fatigue === 0) return 'FRESH \u2014 FULL PAYOUTS';
    if (this.fatigue < 6)   return 'WARM (' + this.fatigue + ' SHOTS)';
    if (this.fatigue < 14)  return 'TIRED (' + this.fatigue + ' SHOTS) \u2014 REDUCED';
    return 'BURNT (' + this.fatigue + ' SHOTS) \u2014 HEAVY REDUCTION';
  }
  _updateFatigueBar(bW) {
    const pct = Math.min(this.fatigue / 20, 1);
    const col = this.fatigue < 6 ? 0x5eba7d : this.fatigue < 14 ? 0xe8a020 : 0xc43a3a;
    this.fatigueFill.setSize(Math.max(2, bW * pct), 6).setFillStyle(col);
  }
  _refreshFireButton() {
    const cost = this._rollCost();
    const ok   = this.saveData.nuts >= cost && !this.ballActive;
    this.fireTxt.setStyle({ color: ok ? '#5eba7d' : '#445566' });
    this.fireBg.setFillStyle(ok ? 0x0d1e10 : 0x161b22);
    this.fireBdr.setStrokeStyle(2, ok ? 0x5eba7d : 0x334455);
    this.fireSub.setText('COSTS ' + cost + ' NUTS').setStyle({ color: ok ? '#8899aa' : '#334455' });
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
        tx: this.LAUNCHER_X,              ty: this.LAUNCHER_Y,
        tw: 48,                           th: 48,
        title: 'THE LAUNCHER',
        body:  'DRAG ANYWHERE ON SCREEN\nTO AIM. THE BARREL FOLLOWS.\nTAP LAUNCHER FOR FULL ARC.'
      },
      {
        tx: this.PLAY_LEFT + this.PLAY_W / 2, ty: this.PLAY_TOP  + this.PLAY_H / 2,
        tw: this.PLAY_W,                      th: this.PLAY_H,
        title: 'THE BOARD',
        body:  'BALL FIRES DOWNWARD.\nBOUNCES OFF PEGS INTO\nUNPREDICTABLE PATHS.'
      },
      {
        tx: this.PLAY_LEFT + this.PLAY_W / 2, ty: this.PLAY_BOTTOM - 4,
        tw: this.bucketW + 14,                th: 20,
        title: 'THE BUCKET',
        body:  'LAND IN THE MOVING BUCKET\nFOR ' + BUCKET_MULTIPLIER + '\xd7 YOUR BIN PAYOUT.\nAIM A BIT AHEAD OF IT.'
      },
      {
        tx: this.PLAY_LEFT + this.PLAY_W / 2, ty: this.PLAY_BOTTOM + 19,
        tw: this.PLAY_W,                      th: 38,
        title: 'THE BINS',
        body:  'OUTER BINS PAY 16 BOLTS.\nMIDDLE BIN IS ONLY 3.\nAIM FOR THE EDGES.'
      },
    ];

    let step = 0;
    const overlay   = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.72).setDepth(50);
    const pulseRect = this.add.rectangle(0, 0, 0, 0).setStrokeStyle(2, 0xe8a020).setDepth(51);
    this.tweens.add({ targets: pulseRect, alpha: 0.4, duration: 600, yoyo: true, repeat: -1 });

    const cardY    = height - 160;
    const card     = this.add.rectangle(width / 2, cardY, width - 32, 100, 0x0a0e14, 0.98).setDepth(52);
    this.add.rectangle(width / 2, cardY, width - 32, 100).setStrokeStyle(1, 0xe8a020, 0.6).setDepth(52);
    const titleTxt = this.add.text(width / 2, cardY - 30, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#e8a020', fontStyle: 'bold', letterSpacing: 3
    }).setOrigin(0.5).setDepth(53);
    const bodyTxt  = this.add.text(width / 2, cardY + 2, '', {
      fontFamily: 'monospace', fontSize: '11px', color: '#8899aa', align: 'center',
      wordWrap: { width: width - 60 }
    }).setOrigin(0.5).setDepth(53);
    this.add.text(width / 2, cardY + 38, 'TAP TO CONTINUE', {
      fontFamily: 'monospace', fontSize: '9px', color: '#334455', letterSpacing: 3
    }).setOrigin(0.5).setDepth(53);

    const showStep = (i) => {
      const s = steps[i];
      pulseRect.setPosition(s.tx, s.ty).setSize(s.tw + 12, s.th + 12);
      titleTxt.setText(s.title);
      bodyTxt.setText(s.body);
    };
    showStep(0);

    const advance = () => {
      step++;
      if (step >= steps.length) {
        [overlay, pulseRect, card, titleTxt, bodyTxt].forEach(e => e.destroy());
        this.saveData.tutorials.ricochet = true;
        this._save();
        return;
      }
      showStep(step);
    };
    overlay.setInteractive();
    overlay.on('pointerdown', advance);
  }
}
