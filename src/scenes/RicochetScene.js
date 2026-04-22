// ── RicochetScene.js ─────────────────────────────────────────────────────────
// Hold anywhere to aim, release to fire.
// Score by hitting as many unique pegs as possible.
// Pegs form the Tianxia Integrated Holdings gate logo in the LOWER 2/3 of the
// play field — top third is a clear entry zone so all angles are viable.
// Ball clamped strictly within play bounds every frame to prevent escape.

const RICOCHET_BASE_COST = 3;
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
    const slotIndex = localStorage.getItem('factower_active_slot');
    this.saveKey    = 'factower_save_' + slotIndex;
    this.saveData   = JSON.parse(localStorage.getItem(this.saveKey)) || {};
    if (!this.saveData.nuts)            this.saveData.nuts = 0;
    if (!this.saveData.bolts)           this.saveData.bolts = 0;
    if (!this.saveData.merchantFatigue) this.saveData.merchantFatigue = { chrome:0, ricochet:0, doubleDown:0 };
    if (!this.saveData.tutorials)       this.saveData.tutorials = {};

    this.fatigue         = this.saveData.merchantFatigue.ricochet || 0;
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
    // Sink state — driven by manual timer in update(), NO tweens touch ball rendering
    this.ballSinkX     = 0;
    this.ballSinkY     = 0;
    this.ballSinkTimer = 0;   // counts down in seconds; >0 = sinking animation active

    // ── Background & header ──────────────────────────────────────────────────
    this.add.rectangle(width/2, height/2, width, height, 0x0d1117);
    this.add.rectangle(width/2, 0, width, 4, 0x5eba7d, 0.4);
    this.add.rectangle(width/2, 144, width, 100, 0x161b22);
    this.add.rectangle(width/2, 194, width, 1, 0x334455);

    const back = this.add.rectangle(44, 144, 72, 48, 0x1e2530).setInteractive();
    this.add.text(44, 144, '<- BACK', { fontFamily:'monospace', fontSize:'14px', color:'#e8a020' }).setOrigin(0.5);
    back.on('pointerdown', () => { this._save(); this.cameras.main.fade(200,0,0,0); this.time.delayedCall(200,()=>this.scene.start('MarketplaceScene')); });
    back.on('pointerover', () => back.setFillStyle(0x252c38));
    back.on('pointerout',  () => back.setFillStyle(0x1e2530));

    this.add.text(width/2+20, 125, 'RICOCHET',  { fontFamily:'monospace', fontSize:'26px', color:'#5eba7d', fontStyle:'bold' }).setOrigin(0.5);
    this.add.text(width/2+20, 152, 'THE BOARD', { fontFamily:'monospace', fontSize:'11px', color:'#8899aa', letterSpacing:3 }).setOrigin(0.5);

    this.nutsText  = this.add.text(width/2-72, 216, this.saveData.nuts  +' NUTS',  { fontFamily:'monospace', fontSize:'12px', color:'#e8a020',  fontStyle:'bold' }).setOrigin(0.5);
    this.add.text(width/2, 216, '\xb7', { fontFamily:'monospace', fontSize:'12px', color:'#334455' }).setOrigin(0.5);
    this.boltsText = this.add.text(width/2+72, 216, this.saveData.bolts +' BOLTS', { fontFamily:'monospace', fontSize:'12px', color:'#8ab4cc', fontStyle:'bold' }).setOrigin(0.5);

    // ── Play field ───────────────────────────────────────────────────────────
    this.add.rectangle(this.PLAY_LEFT+this.PLAY_W/2, this.PLAY_TOP+this.PLAY_H/2, this.PLAY_W, this.PLAY_H, 0x0a0e14);
    this.add.rectangle(this.PLAY_LEFT+this.PLAY_W/2, this.PLAY_TOP+this.PLAY_H/2, this.PLAY_W, this.PLAY_H).setStrokeStyle(1,0x5eba7d,0.25);

    // Corporate watermark
    this.add.text(width/2, this.PLAY_TOP + this.PLAY_H*0.6, 'TIANXIA\nINTEGRATED\nHOLDINGS', {
      fontFamily:'monospace', fontSize:'28px', color:'#e8a020',
      align:'center', lineSpacing:4
    }).setOrigin(0.5).setAlpha(0.04).setDepth(1);

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

    // Ball — depth 20: always on top of everything including hit strip
    this.ballGfx = this.add.graphics().setDepth(20);

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
    this.resultText = this.add.text(width/2, this.PLAY_TOP+58, '', {
      fontFamily:'monospace', fontSize:'15px', color:'#5eba7d', fontStyle:'bold', letterSpacing:2
    }).setOrigin(0.5).setAlpha(0).setDepth(10);

    // ── Fatigue strip ─────────────────────────────────────────────────────────
    const fatY = 692;
    this.add.text(width/2, fatY, 'FATIGUE', { fontFamily:'monospace', fontSize:'9px', color:'#445566', letterSpacing:3 }).setOrigin(0.5);
    const bW = width-80, bY = fatY+14;
    this.add.rectangle(width/2, bY, bW, 6, 0x1a2230);
    this.fatigueFill  = this.add.rectangle(width/2-bW/2, bY, 2, 6, 0x5eba7d).setOrigin(0,0.5);
    this.fatigueLabel = this.add.text(width/2, bY+13, this._fatigueText(), { fontFamily:'monospace', fontSize:'9px', color:'#556677' }).setOrigin(0.5);
    this._updateFatigueBar(bW);

    // ── Bottom strip ──────────────────────────────────────────────────────────
    this.add.rectangle(width/2, height-76, width-48, 60, 0x0a0e14);
    this.add.rectangle(width/2, height-76, width-48, 60).setStrokeStyle(1,0x1e3028);
    this.hintTxt = this.add.text(width/2, height-76-10, 'HOLD & DRAG TO AIM', {
      fontFamily:'monospace', fontSize:'13px', color:'#2a5538', fontStyle:'bold', letterSpacing:2
    }).setOrigin(0.5);
    this.costTxt = this.add.text(width/2, height-76+12,
      'RELEASE TO FIRE  \xb7  COSTS '+this._rollCost()+' NUTS',
      { fontFamily:'monospace', fontSize:'10px', color:'#334455', letterSpacing:1 }
    ).setOrigin(0.5);

    // ── Input: hold = aim, release = fire ─────────────────────────────────────
    this._onDown = (p) => {
      if (this.ballActive || p.y < 200) return;
      if (this.saveData.nuts < this._rollCost()) { this._flashMsg('NOT ENOUGH NUTS'); return; }
      this._isAiming = true;
      this._updateAim(p);
      this.hintTxt.setStyle({ color:'#5eba7d' });
    };
    this._onMove = (p) => { if (!this._isAiming||this.ballActive) return; this._updateAim(p); };
    this._onUp   = () => {
      if (!this._isAiming) return;
      this._isAiming = false;
      this.previewGfx.clear();
      this._drawLauncher(false);
      this.hintTxt.setStyle({ color:'#2a5538' });
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
        color: tier.bolts===0?'#442222':'#445566', fontStyle:'bold'
      }).setOrigin(0.5).setDepth(4));
      this.tierRngArr.push(this.add.text(cx, this.PLAY_BOTTOM+29, tier.range, {
        fontFamily:'monospace', fontSize:'8px', color:'#222d38', letterSpacing:1
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
      this.tierLblArr[i].setStyle({ color: on?(tier.bolts===0?'#c43a3a':'#5eba7d'):(tier.bolts===0?'#442222':'#445566') });
      this.tierRngArr[i].setStyle({ color: on?'#8899aa':'#222d38' });
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
    this.saveData.nuts-=cost;
    this.nutsText.setText(this.saveData.nuts+' NUTS');
    this.ballActive=true;
    this.pegHitCount=0;
    this.pegsHitThisShot=new Set();

    // Start ball just inside play-area ceiling regardless of launcher y
    this.ball.x  = this.LAUNCHER_X;
    this.ball.y  = this.BOUND_T;
    this.ball.vx = Math.cos(this.aimAngle)*BALL_SPEED;
    this.ball.vy = Math.abs(Math.sin(this.aimAngle)*BALL_SPEED); // always downward
    this.ballSinkTimer = 0;   // cancel any leftover sink animation

    // Show hit strip
    this.hitStripBg.setAlpha(1); this.hitCountTxt.setAlpha(1); this.hitTierTxt.setAlpha(1);
    this._updateHitCounter(0);
    this.tweens.add({ targets:this.resultText, alpha:0, duration:100 });
    this._highlightTier(-1);

    // Safety timeout
    this.time.delayedCall(10000, ()=>{ if(this.ballActive) this._resolve(); });
  }

  // ── Physics update ────────────────────────────────────────────────────────

  update(time, delta) {
    // Bucket always moves
    this.bucketX+=this.bucketDir*this.bucketSpeed*(delta/1000);
    if (this.bucketX+this.bucketW/2>this.PLAY_RIGHT){this.bucketX=this.PLAY_RIGHT-this.bucketW/2;this.bucketDir=-1;}
    if (this.bucketX-this.bucketW/2<this.PLAY_LEFT) {this.bucketX=this.PLAY_LEFT +this.bucketW/2;this.bucketDir= 1;}
    this._drawBucket();

    // ── Ball rendering — entirely manual, no tweens ──────────────────────
    this.ballGfx.clear();
    if (this.ballActive) {
      // Live flight: render at current physics position
      this.ballGfx.fillStyle(0x5eba7d, 1);
      this.ballGfx.fillCircle(this.ball.x, this.ball.y, BALL_R);
    } else if (this.ballSinkTimer > 0) {
      // Collection animation — renders at ball's LAST physics position,
      // not teleported elsewhere. Ball visibly stops, squashes, fades.
      const SINK_DUR = 0.40;
      const elapsed  = SINK_DUR - this.ballSinkTimer;

      let rx = BALL_R, ry = BALL_R, alpha = 1;
      if (elapsed < 0.12) {
        // Impact squash
        const p = elapsed / 0.12;
        rx = BALL_R * (1 + p * 0.30);
        ry = BALL_R * (1 - p * 0.30);
      } else {
        // Shrink + fade into drain
        const p = (elapsed - 0.12) / 0.28;
        rx = BALL_R * (1.30 - p * 1.30);
        ry = BALL_R * (0.70 - p * 0.70);
        alpha = 1 - p;
      }

      if (alpha > 0.01 && rx > 0.5 && ry > 0.5) {
        this.ballGfx.fillStyle(0x5eba7d, alpha);
        // Render at ballSinkX/Y — which _resolve() sets to the ball's actual
        // final position, not at DRAIN_Y. No teleport.
        this.ballGfx.fillEllipse(this.ballSinkX, this.ballSinkY - ry + BALL_R, rx * 2, ry * 2);
      }

      this.ballSinkTimer -= delta / 1000;
      if (this.ballSinkTimer < 0) this.ballSinkTimer = 0;
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

    const inBucket  = Math.abs(this.ball.x-this.bucketX)<this.bucketW/2+BALL_R;
    const totalHits = this.pegHitCount+(inBucket?BUCKET_HIT_BONUS:0);

    if (inBucket) {
      this.cameras.main.flash(150,92,186,125,false);
      this.hitCountTxt.setText(this.pegHitCount+' +'+BUCKET_HIT_BONUS+' = '+totalHits+' HITS');
    }
    this._updateHitCounter(totalHits);

    const tier   = this._getTier(totalHits);
    const mult   = Math.max(0.2, 1/(1+0.08*this.fatigue));
    const payout = tier.bolts>0 ? Math.max(1,Math.round(tier.bolts*mult)) : 0;

    this.saveData.bolts+=payout;
    this.fatigue++;
    this.saveData.merchantFatigue.ricochet=this.fatigue;
    this._save();

    this.boltsText.setText(this.saveData.bolts+' BOLTS');
    this.tweens.add({ targets:this.boltsText, scaleX:1.3, scaleY:1.3, duration:150, yoyo:true });

    const col=payout>0?(payout>=4?'#5eba7d':'#e8a020'):'#c43a3a';
    const msg=payout>0?'+'+payout+' BOLT'+(payout===1?'':'S'):'BUST \u2014 0 BOLTS';
    this.resultText.setText(msg).setStyle({color:col}).setAlpha(0);
    this.tweens.add({ targets:this.resultText, alpha:1, duration:250 });

    // Start collection animation at ball's ACTUAL position
    this.ballSinkX     = this.ball.x;
    this.ballSinkY     = this.ball.y;
    this.ballSinkTimer = 0.40;

    this.time.delayedCall(1400,()=>{
      this.tweens.add({ targets:[this.hitStripBg,this.hitCountTxt,this.hitTierTxt], alpha:0, duration:400 });
      this._highlightTier(-1);
      const bW=this.scale.width-80;
      this._updateFatigueBar(bW);
      this.fatigueLabel.setText(this._fatigueText());
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
  _rollCost() { return Math.min(Math.round(RICOCHET_BASE_COST*(1+Math.pow(this.fatigue,3)/500)),60); }
  _fatigueText() {
    if(this.fatigue===0) return 'FRESH \u2014 FULL PAYOUTS';
    if(this.fatigue<6)   return 'WARM ('+this.fatigue+' SHOTS)';
    if(this.fatigue<14)  return 'TIRED ('+this.fatigue+' SHOTS) \u2014 REDUCED';
    return 'BURNT ('+this.fatigue+' SHOTS) \u2014 HEAVY REDUCTION';
  }
  _updateFatigueBar(bW) {
    const col=this.fatigue<6?0x5eba7d:this.fatigue<14?0xe8a020:0xc43a3a;
    this.fatigueFill.setSize(Math.max(2,bW*Math.min(this.fatigue/20,1)),6).setFillStyle(col);
  }
  _refreshCostText() {
    const ok=this.saveData.nuts>=this._rollCost();
    this.hintTxt.setStyle({color:ok?'#2a5538':'#553333'});
    this.costTxt.setText('RELEASE TO FIRE  \xb7  COSTS '+this._rollCost()+' NUTS').setStyle({color:ok?'#334455':'#553333'});
  }
  _save() {
    this.saveData.merchantFatigue.ricochet=this.fatigue;
    localStorage.setItem(this.saveKey,JSON.stringify(this.saveData));
  }

  // ── Tutorial ─────────────────────────────────────────────────────────────

  _showTutorial() {
    const {width,height}=this.scale;
    const steps=[
      { tx:this.LAUNCHER_X, ty:this.LAUNCHER_Y, tw:48, th:48,
        title:'THE LAUNCHER',
        body:'HOLD ANYWHERE TO AIM.\nPREVIEW APPEARS WHILE HOLDING.\nRELEASE YOUR FINGER TO FIRE.' },
      { tx:this.PLAY_LEFT+this.PLAY_W/2, ty:this.PLAY_TOP+this.PLAY_H*0.6, tw:this.PLAY_W, th:this.PLAY_H*0.7,
        title:'TIANXIA GATE',
        body:'PEGS FORM THE TIANXIA LOGO.\nTHE TOP IS CLEAR — USE THE\nFULL WIDTH TO AIM ANYWHERE.' },
      { tx:this.PLAY_LEFT+this.PLAY_W/2, ty:this.PLAY_TOP+18, tw:this.PLAY_W, th:34,
        title:'HIT COUNTER',
        body:'EACH UNIQUE PEG COUNTS ONCE.\nMORE HITS = HIGHER TIER.\nBUCKET ADDS +'+BUCKET_HIT_BONUS+' BONUS HITS.' },
      { tx:this.PLAY_LEFT+this.PLAY_W/2, ty:this.PLAY_BOTTOM+22, tw:this.PLAY_W, th:44,
        title:'TIERS',
        body:'0-3 HITS = BUST\n4-7 = 1 BOLT   8-10 = 2 BOLTS\n14-16 = 4 BOLTS   17+ = 6 BOLTS' },
    ];
    let step=0;
    const ov  =this.add.rectangle(width/2,height/2,width,height,0x000000,0.72).setDepth(50);
    const pl  =this.add.rectangle(0,0,0,0).setStrokeStyle(2,0xe8a020).setDepth(51);
    this.tweens.add({targets:pl,alpha:0.4,duration:600,yoyo:true,repeat:-1});
    const cy=height-160;
    const c =this.add.rectangle(width/2,cy,width-32,100,0x0a0e14,0.98).setDepth(52);
    this.add.rectangle(width/2,cy,width-32,100).setStrokeStyle(1,0xe8a020,0.6).setDepth(52);
    const tT=this.add.text(width/2,cy-30,'',{fontFamily:'monospace',fontSize:'13px',color:'#e8a020',fontStyle:'bold',letterSpacing:3}).setOrigin(0.5).setDepth(53);
    const tB=this.add.text(width/2,cy+2, '',{fontFamily:'monospace',fontSize:'11px',color:'#8899aa',align:'center',wordWrap:{width:width-60}}).setOrigin(0.5).setDepth(53);
    this.add.text(width/2,cy+38,'TAP TO CONTINUE',{fontFamily:'monospace',fontSize:'9px',color:'#334455',letterSpacing:3}).setOrigin(0.5).setDepth(53);
    const show=(i)=>{const s=steps[i];pl.setPosition(s.tx,s.ty).setSize(s.tw+12,s.th+12);tT.setText(s.title);tB.setText(s.body);};
    show(0);
    const adv=()=>{step++;if(step>=steps.length){[ov,pl,c,tT,tB].forEach(e=>e.destroy());this.saveData.tutorials.ricochet=true;this._save();return;}show(step);};
    ov.setInteractive();ov.on('pointerdown',adv);
  }
}