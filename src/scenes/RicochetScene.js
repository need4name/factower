// ── RicochetScene.js ─────────────────────────────────────────────────────────
// Hold anywhere to aim, release to fire.
// Score by hitting as many unique pegs as possible.
// Pegs form the Tianxia Integrated Holdings gate logo in the LOWER 2/3 of the
// play field — top third is a clear entry zone so all angles are viable.
// Ball clamped strictly within play bounds every frame to prevent escape.

const BALL_SPEED         = 300;
const GRAVITY            = 480;
const PEG_R              = 7;
const BALL_R             = 8;
const BUCKET_HIT_BONUS   = 2;

// Payout tiers: min unique hits required → bolts awarded
const HIT_TIERS = [
  { min:0,  bolts:0, label:'BUST', range:'0-3'   },
  { min:4,  bolts:1, label:'1 B',  range:'4-7'   },
  { min:8,  bolts:2, label:'2 B',  range:'8-10'  },
  { min:11, bolts:3, label:'3 B',  range:'11-13' },
  { min:14, bolts:4, label:'4 B',  range:'14-16' },
  { min:17, bolts:6, label:'6 B',  range:'17+'   },
];

// ── Tianxia gate — coords relative to (PLAY_LEFT, PLAY_TOP) ──────────────────
// Clear entry zone: y=0 to y=100 (no pegs here at all).
// Gate logo occupies y=100 to y=340.
//
// Structure:
//   Outer arch   (9)  — wide parabolic crown
//   Left pillar  (3)  — vertical left support
//   Right pillar (3)  — vertical right support
//   Inner arch   (7)  — smaller inset arch
//   Crossbar     (5)  — horizontal gate beam
//   Centre post  (2)  — vertical spine
//   Base accents (3)  — foundation detail

const PEG_LAYOUT = [
  // Outer arch — parabola peak at (181, 108), feet at (50,200) and (312,200)
  {x:50, y:200},{x:82, y:157},{x:116,y:128},{x:150,y:112},{x:181,y:106},
  {x:212,y:112},{x:246,y:128},{x:280,y:157},{x:312,y:200},
  // Left outer pillar
  {x:50, y:238},{x:50, y:278},{x:50, y:318},
  // Right outer pillar
  {x:312,y:238},{x:312,y:278},{x:312,y:318},
  // Inner arch — smaller parabola inside: peak at (181,188), feet at (100,228) and (262,228)
  {x:100,y:228},{x:128,y:207},{x:153,y:195},{x:181,y:191},
  {x:209,y:195},{x:234,y:207},{x:262,y:228},
  // Crossbar — horizontal beam linking inner arch feet
  {x:100,y:264},{x:140,y:264},{x:181,y:264},{x:222,y:264},{x:262,y:264},
  // Centre post — vertical from inner arch peak to crossbar
  {x:181,y:228},{x:181,y:306},
  // Base accents
  {x:100,y:326},{x:181,y:338},{x:262,y:326},
];

class RicochetScene extends Phaser.Scene {
  constructor() { super({ key: 'RicochetScene' }); }

  create() {
    const { width, height } = this.scale;
    this.saveData = SaveManager.load() || {};
    if (!Merchants.isRecruited(this.saveData, 'ricochet')) { this.scene.start('MarketplaceScene'); return; }
    this.saveData = SaveManager.update(s => {
      if (!s.flags) s.flags = {};
      if (!s.flags.merchantsMet) s.flags.merchantsMet = {};
      s.flags.merchantsMet.ricochet = true;
      if (!s.merchantFatigue) s.merchantFatigue = { chrome: 0, ricochet: 0, doubleDown: 0 };
      if (!s.tutorials) s.tutorials = {};
      s.nuts = s.nuts || 0; s.bolts = s.bolts || 0;
    }) || this.saveData;

    this.fx              = Merchants.effects(this.saveData);
    this.fatigue         = Merchants.fatigue(this.saveData, 'ricochet');
    this.ballActive      = false;
    this._isAiming       = false;
    this.pegHitCount     = 0;
    this.pegsHitThisShot = new Set();

    // ── Play area ────────────────────────────────────────────────────────────
    this.PLAY_LEFT   = 14;
    this.PLAY_RIGHT  = 376;
    this.PLAY_TOP    = 252;
    this.PLAY_BOTTOM = 638;
    this.PLAY_W      = this.PLAY_RIGHT - this.PLAY_LEFT;   // 362
    this.PLAY_H      = this.PLAY_BOTTOM - this.PLAY_TOP;   // 386

    // DRAIN_Y: the visible bottom line of the playfield where the ball collects.
    // Ball must physically reach this line before resolve fires.
    this.DRAIN_Y = this.PLAY_BOTTOM - 4;

    // Strict physics bounds (ball centre must stay inside these)
    this.BOUND_L = this.PLAY_LEFT   + BALL_R;
    this.BOUND_R = this.PLAY_RIGHT  - BALL_R;
    this.BOUND_T = this.PLAY_TOP    + BALL_R;
    this.BOUND_B = this.DRAIN_Y     - BALL_R;

    this.LAUNCHER_X  = width / 2;
    this.LAUNCHER_Y  = this.PLAY_TOP - 18;      // visually just above play area top
    this.aimAngle    = Math.PI / 2;

    // Bucket
    this.bucketW     = 58;
    this.bucketX     = this.PLAY_LEFT + this.PLAY_W / 2;
    this.bucketDir   = 1;
    this.bucketSpeed = 74;

    // Build world-coord pegs
    this.pegs = PEG_LAYOUT.map(p => ({
      x: this.PLAY_LEFT + p.x,
      y: this.PLAY_TOP  + p.y,
      r: PEG_R, lit: false
    }));

    // Ball physics state
    this.ball         = { x:0, y:0, vx:0, vy:0 };
    // Sink state — driven by manual timer in update()
    this.ballSinkX     = 0;
    this.ballSinkY     = 0;
    this.ballSinkTimer = 0;   // counts down in seconds; >0 = sinking animation active
    // Safety timer reference — MUST be tracked and cancelled on every new shot
    // and every resolve, or stale timers from previous shots will fire resolve
    // mid-flight on a later shot. This was the sporadic vanish bug.
    this._safetyTimer  = null;

    // ── Background & header ──────────────────────────────────────────────────
    UI.backdrop(this);
    UI.fadeIn(this);
    // Shared header — nuts/bolts live in its chips (they accept setText for legacy calls)
    this.hdr = UI.header(this, {
      title: 'RICOCHET', sub: 'THE BOARD', accent: UI.C.green,
      onBack: () => { if (this.ballActive) return; this._save(); UI.go(this, 'MarketplaceScene'); },
      chips: [{ kind: 'nuts', value: this.saveData.nuts }, { kind: 'bolts', value: this.saveData.bolts }]
    });
    this.nutsText  = this.hdr.chips.nuts;
    this.boltsText = this.hdr.chips.bolts;

    // ── Play field ───────────────────────────────────────────────────────────
    this.add.rectangle(this.PLAY_LEFT+this.PLAY_W/2, this.PLAY_TOP+this.PLAY_H/2, this.PLAY_W, this.PLAY_H, 0x0a0e14);
    this.add.rectangle(this.PLAY_LEFT+this.PLAY_W/2, this.PLAY_TOP+this.PLAY_H/2, this.PLAY_W, this.PLAY_H).setStrokeStyle(1,0x5eba7d,0.25);

    // Corporate watermark
    this.add.text(width/2, this.PLAY_TOP + this.PLAY_H*0.6, 'TIANXIA\nINTEGRATED\nHOLDINGS', {
      fontFamily:'monospace', fontSize:'28px', color:'#e8a020',
      align:'center', lineSpacing:4
    }).setOrigin(0.5).setAlpha(0.025).setDepth(1);

    // Faint amber connector lines tracing gate structure
    this._drawLogoLines();

    // Pegs (depth 2)
    this.pegGfx = this.add.graphics().setDepth(2);
    this._drawPegs();

    // Drain line — the visible bottom of the playfield where the ball collects.
    // Gives the ball something to physically hit, like a pinball drain.
    const drainGfx = this.add.graphics().setDepth(2);
    drainGfx.fillStyle(0x1a2530, 1);
    drainGfx.fillRect(this.PLAY_LEFT, this.DRAIN_Y, this.PLAY_W, 4);
    drainGfx.lineStyle(1, 0x3d5a6e, 0.8);
    drainGfx.lineBetween(this.PLAY_LEFT, this.DRAIN_Y, this.PLAY_RIGHT, this.DRAIN_Y);
    // Amber warning stripes on the drain bar
    drainGfx.lineStyle(1, 0xe8a020, 0.35);
    for (let x = this.PLAY_LEFT; x < this.PLAY_RIGHT; x += 12) {
      drainGfx.lineBetween(x, this.DRAIN_Y+1, x+6, this.DRAIN_Y+3);
    }

    // Bucket (depth 4)
    this.bucketGfx = this.add.graphics().setDepth(4);
    this._drawBucket();
    this.add.text(this.PLAY_LEFT+this.PLAY_W/2, this.PLAY_BOTTOM-14,
      '+'+BUCKET_HIT_BONUS+' HIT BONUS',
      { fontFamily:'monospace', fontSize:'9px', color:'#334455', letterSpacing:2 }
    ).setOrigin(0.5).setDepth(4);

    // Tier boxes (depth 3)
    this._buildTierDisplay();

    // Preview / launcher — below ball
    this.previewGfx  = this.add.graphics().setDepth(3);
    this.launcherGfx = this.add.graphics().setDepth(5);
    this._drawLauncher(false);

    // Ball — dedicated circle game object, NOT a graphics redraw.
    // Graphics redraws have race conditions with Phaser's render pipeline;
    // a persistent game object is rendered every frame regardless.
    this.ballSprite = this.add.circle(-100, -100, BALL_R, 0x5eba7d);
    this.ballSprite.setDepth(20);
    this.ballSprite.setVisible(false);

    // Hit counter strip inside play area (depth 15 — below ball)
    const sY = this.PLAY_TOP + 18;
    this.hitStripBg  = this.add.rectangle(this.PLAY_LEFT+this.PLAY_W/2, sY, this.PLAY_W, 34, 0x070b0e, 0.94).setDepth(15).setAlpha(0);
    this.hitCountTxt = this.add.text(this.PLAY_LEFT+14, sY, '0 HITS', {
      fontFamily:'monospace', fontSize:'13px', color:'#8899aa', fontStyle:'bold', letterSpacing:2
    }).setOrigin(0,0.5).setDepth(16).setAlpha(0);
    this.hitTierTxt  = this.add.text(this.PLAY_RIGHT-14, sY, 'BUST', {
      fontFamily:'monospace', fontSize:'12px', color:'#553333', fontStyle:'bold'
    }).setOrigin(1,0.5).setDepth(16).setAlpha(0);

    // Result text
    this.resultText = UI.text(this, width/2, this.PLAY_TOP+58, '', 'title', { size: 20, origin: 0.5, color: UI.T.green, depth: 10 }).setAlpha(0);

    // ── Fatigue strip ─────────────────────────────────────────────────────────
    this.strip = Merchants.drawStrip(this, 716, 'ricochet', this.fx).refresh(this.fatigue);

    // ── Bottom strip ──────────────────────────────────────────────────────────
    this.hintPanel = UI.panel(this, width/2, height-46, width-32, 60, { fill: UI.C.surface, stroke: UI.C.green, strokeAlpha: 0.35, radius: 14 });
    this.hintTxt = UI.text(this, width/2, height-46-10, 'HOLD & DRAG ON THE BOARD TO AIM', 'heading', { size: 15, origin: 0.5, color: UI.T.green });
    this.costTxt = UI.text(this, width/2, height-46+13, '', 'small', { size: 12, origin: 0.5 });

    // ── Input: hold = aim, release = fire ─────────────────────────────────────
    this._onDown = (p) => {
      if (this.ballActive || p.y < this.PLAY_TOP - 40 || p.y > this.PLAY_BOTTOM + 44) return;
      if (this.coach && this.coach.isShowing()) return;
      if (this.saveData.nuts < this._rollCost()) { this._flashMsg('NOT ENOUGH NUTS'); return; }
      this._isAiming = true;
      this._updateAim(p);
      this.hintTxt.setText('RELEASE TO FIRE');
    };
    this._onMove = (p) => { if (!this._isAiming||this.ballActive) return; this._updateAim(p); };
    this._onUp   = () => {
      if (!this._isAiming) return;
      this._isAiming = false;
      this.previewGfx.clear();
      this._drawLauncher(false);
      this._refreshCostText();
      if (!this.ballActive && this.saveData.nuts >= this._rollCost()) this._fire();
    };

    this.input.on('pointerdown',      this._onDown);
    this.input.on('pointermove',      this._onMove);
    this.input.on('pointerup',        this._onUp);
    this.input.on('pointerupoutside', this._onUp);
    this.events.on('shutdown', () => {
      this.input.off('pointerdown',      this._onDown);
      this.input.off('pointermove',      this._onMove);
      this.input.off('pointerup',        this._onUp);
      this.input.off('pointerupoutside', this._onUp);
      if (this._safetyTimer) { this._safetyTimer.remove(); this._safetyTimer = null; }
    });

    this._refreshCostText();
    if (!this.saveData.tutorials.ricochet) {
      this.time.delayedCall(200, () => this._showTutorial());
    }
  }

  // ── Logo connector lines (static, depth 1) ────────────────────────────────

  _drawLogoLines() {
    const gfx = this.add.graphics().setDepth(1);
    const pl = this.PLAY_LEFT, pt = this.PLAY_TOP;

    const chain = (indices, alpha) => {
      gfx.lineStyle(1, 0xe8a020, alpha);
      for (let i=0; i<indices.length-1; i++) {
        const a = PEG_LAYOUT[indices[i]], b = PEG_LAYOUT[indices[i+1]];
        gfx.lineBetween(pl+a.x, pt+a.y, pl+b.x, pt+b.y);
      }
    };

    chain([0,1,2,3,4,5,6,7,8],        0.22);  // outer arch
    chain([0,9,10,11],                 0.22);  // left pillar from arch foot
    chain([8,12,13,14],                0.22);  // right pillar from arch foot
    chain([15,16,17,18,19,20,21],      0.18);  // inner arch
    chain([22,23,24,25,26],            0.16);  // crossbar
    chain([18,27,28],                  0.14);  // centre post
    gfx.lineStyle(1,0xe8a020,0.10);
    gfx.lineBetween(pl+PEG_LAYOUT[15].x, pt+PEG_LAYOUT[15].y, pl+PEG_LAYOUT[22].x, pt+PEG_LAYOUT[22].y);
    gfx.lineBetween(pl+PEG_LAYOUT[21].x, pt+PEG_LAYOUT[21].y, pl+PEG_LAYOUT[26].x, pt+PEG_LAYOUT[26].y);
  }

  // ── Tier display ──────────────────────────────────────────────────────────

  _buildTierDisplay() {
    const boxW = this.PLAY_W / HIT_TIERS.length;
    this.tierGfxArr = [];
    this.tierLblArr = [];
    this.tierRngArr = [];

    HIT_TIERS.forEach((tier, i) => {
      const bx = this.PLAY_LEFT + i*boxW;
      const cx = bx + boxW/2;
      const g  = this.add.graphics().setDepth(3);
      this._drawTierBox(g, bx, this.PLAY_BOTTOM, boxW, 44, false, tier);
      this.tierGfxArr.push(g);
      this.tierLblArr.push(this.add.text(cx, this.PLAY_BOTTOM+13, tier.label, {
        fontFamily:'monospace', fontSize:'11px',
        color: tier.bolts===0?'#7a3a36':'#8090a4', fontStyle:'bold'
      }).setOrigin(0.5).setDepth(4));
      this.tierRngArr.push(this.add.text(cx, this.PLAY_BOTTOM+29, tier.range, {
        fontFamily:'monospace', fontSize:'10px', color:'#56637a', letterSpacing:1
      }).setOrigin(0.5).setDepth(4));
    });
  }

  _drawTierBox(gfx, bx, by, bw, bh, active, tier) {
    gfx.clear();
    const bgCol = active?(tier.bolts===0?0x200808:0x081410):0x070b0e;
    const bdCol = active?(tier.bolts===0?0xc43a3a:0x5eba7d):(tier.bolts===0?0x2a1010:0x1a2530);
    gfx.fillStyle(bgCol,1); gfx.fillRect(bx+1,by,bw-2,bh);
    gfx.lineStyle(active?2:1,bdCol,active?0.9:0.5); gfx.strokeRect(bx+1,by,bw-2,bh);
  }

  _highlightTier(activeIdx) {
    const boxW = this.PLAY_W / HIT_TIERS.length;
    HIT_TIERS.forEach((tier,i) => {
      const on = i===activeIdx;
      this._drawTierBox(this.tierGfxArr[i], this.PLAY_LEFT+i*boxW, this.PLAY_BOTTOM, boxW, 44, on, tier);
      this.tierLblArr[i].setStyle({ color: on?(tier.bolts===0?'#c43a3a':'#5eba7d'):(tier.bolts===0?'#7a3a36':'#8090a4') });
      this.tierRngArr[i].setStyle({ color: on?'#a7b2c1':'#56637a' });
    });
  }

  // ── Hit counter ───────────────────────────────────────────────────────────

  _updateHitCounter(override) {
    const h    = override !== undefined ? override : this.pegHitCount;
    const tier = this._getTier(h);
    const col  = tier.bolts===0?'#553333':tier.bolts<3?'#e8a020':'#5eba7d';
    this.hitCountTxt.setText(h+' HIT'+(h===1?'':'S')).setStyle({ color:col });
    this.hitTierTxt.setText(tier.bolts>0?'\u2192 '+tier.bolts+' B':'BUST').setStyle({ color:col });
    this._highlightTier(this._getTierIndex(h));
  }

  // ── Draw helpers ──────────────────────────────────────────────────────────

  _drawPegs() {
    this.pegGfx.clear();
    this.pegs.forEach(peg => {
      this.pegGfx.fillStyle(peg.lit?0x5eba7d:0x2a3a4a,1);
      this.pegGfx.fillCircle(peg.x, peg.y, peg.r+(peg.lit?2:0));
    });
  }

  _drawBucket() {
    this.bucketGfx.clear();
    const by = this.PLAY_BOTTOM-4;
    this.bucketGfx.fillStyle(0x5eba7d,0.22);
    this.bucketGfx.fillRect(this.bucketX-this.bucketW/2, by-8, this.bucketW, 12);
    this.bucketGfx.lineStyle(2,0x5eba7d,0.85);
    this.bucketGfx.strokeRect(this.bucketX-this.bucketW/2, by-8, this.bucketW, 12);
  }

  _drawLauncher(active) {
    this.launcherGfx.clear();
    const lx=this.LAUNCHER_X, ly=this.LAUNCHER_Y, a=active?0.95:0.5;
    this.launcherGfx.fillStyle(active?0x1a3028:0x1e2a38,1);
    this.launcherGfx.fillCircle(lx,ly,18);
    this.launcherGfx.lineStyle(2,0x5eba7d,a); this.launcherGfx.strokeCircle(lx,ly,18);
    this.launcherGfx.lineStyle(4,0x5eba7d,a);
    this.launcherGfx.lineBetween(lx,ly, lx+Math.cos(this.aimAngle)*30, ly+Math.sin(this.aimAngle)*30);
    this.launcherGfx.fillStyle(0x5eba7d,a); this.launcherGfx.fillCircle(lx,ly,5);
  }

  _drawPreview() {
    this.previewGfx.clear();
    if (!this._isAiming) return;
    const lx=this.LAUNCHER_X, ly=this.LAUNCHER_Y;
    const dx=Math.cos(this.aimAngle), dy=Math.sin(this.aimAngle);
    for (let i=1; i<=28; i++) {
      const t=i*0.04;
      const px=lx+dx*BALL_SPEED*t, py=ly+dy*BALL_SPEED*t+0.5*GRAVITY*t*t;
      if (py>this.PLAY_BOTTOM||px<this.PLAY_LEFT||px>this.PLAY_RIGHT) break;
      const al=Math.max(0.03, 0.8-i*0.028);
      this.previewGfx.fillStyle(0x5eba7d,al);
      this.previewGfx.fillCircle(px,py,Math.max(1,3.2-i*0.09));
    }
  }

  _updateAim(pointer) {
    const dx=pointer.x-this.LAUNCHER_X, dy=pointer.y-this.LAUNCHER_Y;
    if (dy < 0) return;   // must point at least slightly downward
    this.aimAngle = Phaser.Math.Clamp(Math.atan2(dy,dx), 0.18, Math.PI-0.18);
    this._drawLauncher(true);
    this._drawPreview();
  }

  // ── Fire ──────────────────────────────────────────────────────────────────

  _fire() {
    const cost=this._rollCost();
    if (this.saveData.nuts<cost||this.ballActive) return;

    // CRITICAL: cancel any stale safety timer from a previous shot before
    // starting a new one. Without this, a 10-second timer from shot N can
    // fire mid-flight on shot N+1 and resolve it prematurely. This is the
    // sporadic vanish bug.
    if (this._safetyTimer) {
      this._safetyTimer.remove();
      this._safetyTimer = null;
    }

    this.saveData.nuts-=cost;
    this._save();   // persist the stake now — reloading mid-shot must not refund it
    this.nutsText.setText(this.saveData.nuts+' NUTS');
    this._refreshCostText();
    this.ballActive=true;
    this.pegHitCount=0;
    this.pegsHitThisShot=new Set();

    // Start ball just inside play-area ceiling regardless of launcher y
    this.ball.x  = this.LAUNCHER_X;
    this.ball.y  = this.BOUND_T;
    this.ball.vx = Math.cos(this.aimAngle)*BALL_SPEED;
    this.ball.vy = Math.abs(Math.sin(this.aimAngle)*BALL_SPEED);
    this.ballSinkTimer = 0;

    // Position & show the ball sprite
    this.ballSprite.setPosition(this.ball.x, this.ball.y);
    this.ballSprite.setScale(1, 1);
    this.ballSprite.setAlpha(1);
    this.ballSprite.setVisible(true);

    // Show hit strip
    this.hitStripBg.setAlpha(1); this.hitCountTxt.setAlpha(1); this.hitTierTxt.setAlpha(1);
    this._updateHitCounter(0);
    this.tweens.add({ targets:this.resultText, alpha:0, duration:100 });
    this._highlightTier(-1);

    // Safety timeout — tracked so we can cancel on new shot or resolve
    this._safetyTimer = this.time.delayedCall(10000, () => {
      this._safetyTimer = null;
      if (this.ballActive) this._resolve();
    });
  }

  // ── Physics update ────────────────────────────────────────────────────────

  update(time, delta) {
    // Bucket always moves
    this.bucketX+=this.bucketDir*this.bucketSpeed*(delta/1000);
    if (this.bucketX+this.bucketW/2>this.PLAY_RIGHT){this.bucketX=this.PLAY_RIGHT-this.bucketW/2;this.bucketDir=-1;}
    if (this.bucketX-this.bucketW/2<this.PLAY_LEFT) {this.bucketX=this.PLAY_LEFT +this.bucketW/2;this.bucketDir= 1;}
    this._drawBucket();

    // ── Ball rendering via ballSprite (persistent game object) ───────────
    // No clear()/redraw. The sprite just gets its transform updated, which
    // is immune to any render pipeline clearing race conditions.
    if (this.ballActive) {
      // Live flight — position sprite at current physics position
      this.ballSprite.setPosition(this.ball.x, this.ball.y);
    } else if (this.ballSinkTimer > 0) {
      // Collection animation at ball's final landing position
      const SINK_DUR = 0.40;
      const elapsed  = SINK_DUR - this.ballSinkTimer;

      let scaleX = 1, scaleY = 1, alpha = 1;
      if (elapsed < 0.12) {
        const p = elapsed / 0.12;
        scaleX = 1 + p * 0.30;
        scaleY = 1 - p * 0.30;
      } else {
        const p = (elapsed - 0.12) / 0.28;
        scaleX = 1.30 - p * 1.30;
        scaleY = 0.70 - p * 0.70;
        alpha  = 1 - p;
      }

      this.ballSprite.setPosition(this.ballSinkX, this.ballSinkY);
      this.ballSprite.setScale(Math.max(0.01, scaleX), Math.max(0.01, scaleY));
      this.ballSprite.setAlpha(Math.max(0, alpha));

      this.ballSinkTimer -= delta / 1000;
      if (this.ballSinkTimer <= 0) {
        this.ballSinkTimer = 0;
        this.ballSprite.setVisible(false);
      }
    }

    if (!this.ballActive) return;

    // ── Physics step ──────────────────────────────────────────────────────
    const dt = Math.min(delta/1000, 0.025);
    this.ball.vy += GRAVITY * dt;

    const newX = this.ball.x + this.ball.vx * dt;
    const newY = this.ball.y + this.ball.vy * dt;

    // ── RESOLVE CHECK — ONLY during pure gravity movement, BEFORE pegs ────
    // Peg collisions can push the ball anywhere; we do NOT let them trigger
    // resolve. Resolve fires only when the ball falls naturally past the drain.
    if (this.ball.vy > 0 && newY >= this.BOUND_B) {
      this.ball.x = Phaser.Math.Clamp(newX, this.BOUND_L, this.BOUND_R);
      this.ball.y = this.BOUND_B;
      this._resolve();
      return;
    }

    // Apply new position
    this.ball.x = newX;
    this.ball.y = newY;

    // ── Wall response ──────────────────────────────────────────────────────
    if (this.ball.x < this.BOUND_L) { this.ball.vx =  Math.abs(this.ball.vx)*0.78; this.ball.x = this.BOUND_L; }
    if (this.ball.x > this.BOUND_R) { this.ball.vx = -Math.abs(this.ball.vx)*0.78; this.ball.x = this.BOUND_R; }
    if (this.ball.y < this.BOUND_T) { this.ball.vy =  Math.abs(this.ball.vy)*0.78; this.ball.y = this.BOUND_T; }

    // Clamp X only — Y is handled by the resolve check above and peg physics.
    this.ball.x = Phaser.Math.Clamp(this.ball.x, this.BOUND_L, this.BOUND_R);
    this.ball.y = Math.max(this.ball.y, this.BOUND_T);

    // ── Peg collisions — can push ball ANYWHERE, never triggers resolve ───
    let pegDirty = false;
    this.pegs.forEach((peg, i) => {
      const dx = this.ball.x - peg.x;
      const dy = this.ball.y - peg.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const minD = BALL_R + peg.r;
      if (dist < minD && dist > 0.01) {
        const nx = dx/dist, ny = dy/dist;
        const dot = this.ball.vx*nx + this.ball.vy*ny;
        if (dot < 0) {
          this.ball.vx -= (1 + 0.65) * dot * nx;
          this.ball.vy -= (1 + 0.65) * dot * ny;
          this.ball.vx += (Math.random() - 0.5) * 20;
        }
        // Pushout — only clamp X to keep ball inside the board horizontally.
        // Y is NOT clamped so pegs can never push the ball to the drain threshold.
        this.ball.x += nx * (minD - dist);
        this.ball.y += ny * (minD - dist);
        this.ball.x = Phaser.Math.Clamp(this.ball.x, this.BOUND_L, this.BOUND_R);
        this.ball.y = Math.max(this.ball.y, this.BOUND_T);

        if (!this.pegsHitThisShot.has(i)) {
          this.pegsHitThisShot.add(i);
          this.pegHitCount++;
          this._updateHitCounter();
        }
        if (!peg.lit) {
          peg.lit = true; pegDirty = true;
          this.time.delayedCall(220, () => { peg.lit = false; this._drawPegs(); });
        }
      }
    });
    if (pegDirty) this._drawPegs();

    // NOTE: deliberately NO resolve check after pegs. If a peg pushes the ball
    // below the drain line, natural gravity on the next frame will trigger
    // resolve cleanly via the pure-physics check at the top of the step.
  }

  // ── Resolve ───────────────────────────────────────────────────────────────

  _resolve() {
    this.ballActive=false;

    // Cancel safety timer — it already did its job or isn't needed
    if (this._safetyTimer) {
      this._safetyTimer.remove();
      this._safetyTimer = null;
    }

    let inBucket = Math.abs(this.ball.x-this.bucketX)<this.bucketW/2+BALL_R;
    // Luck (Uplink): a ball that just missed can be pulled into the bucket
    let note = '';
    if (!inBucket && Math.random() < Merchants.luck('ricochet', this.fx)) {
      inBucket = true; note = 'LUCKY BOUNCE';
      this.ball.x = Phaser.Math.Clamp(this.bucketX, this.BOUND_L, this.BOUND_R);
    }
    const totalHits = this.pegHitCount+(inBucket?BUCKET_HIT_BONUS:0);

    if (inBucket) {
      this.cameras.main.flash(150,92,186,125,false);
      this.hitCountTxt.setText(this.pegHitCount+' +'+BUCKET_HIT_BONUS+' = '+totalHits+' HITS');
    }
    this._updateHitCounter(totalHits);

    let tier = this._getTier(totalHits);
    // Lucky Bounce (Uplink): some busts are bounced up into the first paying tier
    if (tier.bolts === 0 && Math.random() < this.fx.getMerchantRedirectChance()) {
      tier = HIT_TIERS[1]; note = 'REDIRECTED';
      this._highlightTier(1);
    }
    const payout = Merchants.payout(tier.bolts, 'ricochet', this.fatigue, this.fx);

    this.saveData.bolts+=payout;
    this.fatigue++;
    this.saveData.merchantFatigue.ricochet=this.fatigue;
    this._save();

    this.boltsText.setText(this.saveData.bolts+' BOLTS');
    this.tweens.add({ targets:this.boltsText, scaleX:1.3, scaleY:1.3, duration:150, yoyo:true });

    const col=payout>0?(payout>=4?'#5eba7d':'#e8a020'):'#c43a3a';
    const msg=(note?note+'  ':'')+(payout>0?'+'+payout+' BOLT'+(payout===1?'':'S'):'BUST \u2014 0 BOLTS');
    this.resultText.setText(msg).setStyle({color:col}).setAlpha(0);
    this.tweens.add({ targets:this.resultText, alpha:1, duration:250 });

    // Start collection animation at ball's ACTUAL position
    this.ballSinkX     = this.ball.x;
    this.ballSinkY     = this.ball.y;
    this.ballSinkTimer = 0.40;

    this.time.delayedCall(1400,()=>{
      this.tweens.add({ targets:[this.hitStripBg,this.hitCountTxt,this.hitTierTxt], alpha:0, duration:400 });
      this._highlightTier(-1);
      this.strip.refresh(this.fatigue);
      this._refreshCostText();
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  _getTier(hits) {
    let t=HIT_TIERS[0];
    for (const tier of HIT_TIERS){ if(hits>=tier.min) t=tier; else break; }
    return t;
  }
  _getTierIndex(hits) {
    let idx=0;
    for (let i=0;i<HIT_TIERS.length;i++){ if(hits>=HIT_TIERS[i].min) idx=i; else break; }
    return idx;
  }
  _flashMsg(msg) {
    const {width}=this.scale;
    const t=this.add.text(width/2,this.LAUNCHER_Y-24,msg,{fontFamily:'monospace',fontSize:'12px',color:'#c43a3a',fontStyle:'bold',letterSpacing:2}).setOrigin(0.5).setDepth(20).setAlpha(0);
    this.tweens.add({targets:t,alpha:1,duration:150,yoyo:true,hold:700,onComplete:()=>t.destroy()});
  }
  _rollCost() { return Merchants.cost('ricochet', this.fatigue, this.fx); }
  _refreshCostText() {
    const cost=this._rollCost(), ok=this.saveData.nuts>=cost;
    if (!this._isAiming) this.hintTxt.setText(ok?'HOLD & DRAG ON THE BOARD TO AIM':'NOT ENOUGH NUTS').setColor(ok?UI.T.green:UI.T.red);
    this.costTxt.setText(ok?'Each shot costs '+cost+' nuts':'Each shot costs '+cost+' — sell towers at the Market').setColor(ok?UI.T.mute:UI.T.red);
  }
  _save() {
    const nuts=this.saveData.nuts, bolts=this.saveData.bolts, fat=this.fatigue;
    this.saveData = SaveManager.update(s => {
      s.nuts=nuts; s.bolts=bolts;
      if (!s.merchantFatigue) s.merchantFatigue={};
      s.merchantFatigue.ricochet=fat;
    }) || this.saveData;
  }

  // ── Tutorial ─────────────────────────────────────────────────────────────

  _showTutorial() {
    const {width,height}=this.scale;
    this.coach = Merchants.tour(this, 'ricochet', [
      { title:'Meet Ricochet', body: Merchants.get('ricochet').bio+'\n\nEach shot costs nuts. Hit enough pegs and you win bolts.' },
      { target:{ x:this.PLAY_LEFT+this.PLAY_W/2, y:this.PLAY_TOP+this.PLAY_H/2, w:this.PLAY_W, h:this.PLAY_H }, title:'Aim and fire',
        body:'Hold and drag on the board to aim — a dotted line shows the path. Let go to fire.' },
      { target:{ x:this.PLAY_LEFT+this.PLAY_W/2, y:this.PLAY_BOTTOM+22, w:this.PLAY_W, h:44 }, title:'Hits pay bolts',
        body:'Each peg counts once. 4+ hits pays 1 bolt, 17+ pays 6. Landing in the moving bucket adds '+BUCKET_HIT_BONUS+' bonus hits.' },
      { target:{ x:width/2, y:716, w:width-32, h:58 }, title:'Fatigue',
        body:'Your first few shots are full price. After that each shot costs more and pays less, until you win another battle.' }
    ], () => { this.coach = null; });
  }
}
