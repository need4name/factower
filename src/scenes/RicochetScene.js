// ── RicochetScene.js ─────────────────────────────────────────────────────────
// Hold anywhere to aim, release to fire. Preview arc shown while pressing.
// Score by hitting as many unique pegs as possible — more hits = higher tier.
// Landing in the moving bucket adds +2 bonus hits.
// Peg layout: Tianxia Integrated Holdings corporate gate logo.
// Ball rendered via Graphics every frame — no Arc tween conflicts.

const RICOCHET_BASE_COST = 3;
const BALL_SPEED         = 300;
const GRAVITY            = 480;
const PEG_R              = 7;
const BALL_R             = 8;
const BUCKET_HIT_BONUS   = 2;

// Payout tiers: [min unique hits to qualify, bolts payout]
const HIT_TIERS = [
  { min:0,  bolts:0, label:'BUST', range:'0-3'   },
  { min:4,  bolts:1, label:'1 B',  range:'4-7'   },
  { min:8,  bolts:2, label:'2 B',  range:'8-10'  },
  { min:11, bolts:3, label:'3 B',  range:'11-13' },
  { min:14, bolts:4, label:'4 B',  range:'14-16' },
  { min:17, bolts:6, label:'6 B',  range:'17+'   },
];

// ── Tianxia Integrated Holdings — gate logo peg layout ────────────────────────
// Coordinates relative to (PLAY_LEFT, PLAY_TOP).
// Index groups:
//   0-8   outer arch (9)      9-12  left pillar (4)
//   13-16 right pillar (4)    17-23 inner arch (7)
//   24-28 crossbar (5)        29-30 centre post (2)
//   31-33 base accents (3)
const PEG_LAYOUT = [
  // Outer arch — parabolic crown spanning the full gate width
  {x:50,y:130},{x:80,y:89},{x:116,y:55},{x:148,y:36},{x:181,y:30},
  {x:214,y:36},{x:246,y:55},{x:282,y:89},{x:312,y:130},
  // Left outer pillar
  {x:50,y:170},{x:50,y:212},{x:50,y:256},{x:50,y:310},
  // Right outer pillar
  {x:312,y:170},{x:312,y:212},{x:312,y:256},{x:312,y:310},
  // Inner arch — smaller parabola inset within the gate
  {x:100,y:160},{x:130,y:127},{x:155,y:111},{x:181,y:105},
  {x:207,y:111},{x:232,y:127},{x:262,y:160},
  // Horizontal crossbar — the gate beam
  {x:100,y:222},{x:140,y:222},{x:181,y:222},{x:222,y:222},{x:262,y:222},
  // Centre post — vertical spine
  {x:181,y:167},{x:181,y:262},
  // Base accents — foundation detail
  {x:100,y:322},{x:181,y:342},{x:262,y:322},
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

    // ── Play area bounds ────────────────────────────────────────────────────
    this.PLAY_LEFT   = 14;
    this.PLAY_RIGHT  = 376;
    this.PLAY_TOP    = 252;
    this.PLAY_BOTTOM = 638;
    this.PLAY_W      = this.PLAY_RIGHT - this.PLAY_LEFT;  // 362
    this.PLAY_H      = this.PLAY_BOTTOM - this.PLAY_TOP;  // 386

    this.LAUNCHER_X  = width / 2;
    this.LAUNCHER_Y  = 234;
    this.aimAngle    = Math.PI / 2;

    // Bucket
    this.bucketW     = 58;
    this.bucketX     = this.PLAY_LEFT + this.PLAY_W / 2;
    this.bucketDir   = 1;
    this.bucketSpeed = 74;

    // Build world-coord pegs
    this.pegs = PEG_LAYOUT.map(p => ({
      x: this.PLAY_LEFT + p.x, y: this.PLAY_TOP  + p.y,
      r: PEG_R, lit: false
    }));

    // Ball: physics state + render state (plain JS objects — tween-safe)
    this.ball      = { x:0, y:0, vx:0, vy:0 };
    this.ballState = { x:0, y:0, alpha:0 };

    // ── Background & header ─────────────────────────────────────────────────
    this.add.rectangle(width/2, height/2, width, height, 0x0d1117);
    this.add.rectangle(width/2, 0, width, 4, 0x5eba7d, 0.4);
    this.add.rectangle(width/2, 144, width, 100, 0x161b22);
    this.add.rectangle(width/2, 194, width, 1, 0x334455);

    // Back — no gate
    const back = this.add.rectangle(44, 144, 72, 48, 0x1e2530).setInteractive();
    this.add.text(44, 144, '<- BACK', { fontFamily:'monospace', fontSize:'14px', color:'#e8a020' }).setOrigin(0.5);
    back.on('pointerdown', () => {
      this._save();
      this.cameras.main.fade(200,0,0,0);
      this.time.delayedCall(200, () => this.scene.start('MarketplaceScene'));
    });
    back.on('pointerover', () => back.setFillStyle(0x252c38));
    back.on('pointerout',  () => back.setFillStyle(0x1e2530));

    this.add.text(width/2+20, 125, 'RICOCHET',  { fontFamily:'monospace', fontSize:'26px', color:'#5eba7d', fontStyle:'bold' }).setOrigin(0.5);
    this.add.text(width/2+20, 152, 'THE BOARD', { fontFamily:'monospace', fontSize:'11px', color:'#8899aa', letterSpacing:3 }).setOrigin(0.5);

    this.nutsText  = this.add.text(width/2-72, 216, this.saveData.nuts  +' NUTS',  { fontFamily:'monospace', fontSize:'12px', color:'#e8a020',  fontStyle:'bold' }).setOrigin(0.5);
    this.add.text(width/2, 216, '\xb7', { fontFamily:'monospace', fontSize:'12px', color:'#334455' }).setOrigin(0.5);
    this.boltsText = this.add.text(width/2+72, 216, this.saveData.bolts +' BOLTS', { fontFamily:'monospace', fontSize:'12px', color:'#8ab4cc', fontStyle:'bold' }).setOrigin(0.5);

    // ── Play field ──────────────────────────────────────────────────────────
    this.add.rectangle(this.PLAY_LEFT+this.PLAY_W/2, this.PLAY_TOP+this.PLAY_H/2, this.PLAY_W, this.PLAY_H, 0x0a0e14);
    this.add.rectangle(this.PLAY_LEFT+this.PLAY_W/2, this.PLAY_TOP+this.PLAY_H/2, this.PLAY_W, this.PLAY_H).setStrokeStyle(1,0x5eba7d,0.25);

    // Corporate watermark
    this.add.text(width/2, this.PLAY_TOP+this.PLAY_H/2, 'TIANXIA\nINTEGRATED\nHOLDINGS', {
      fontFamily:'monospace', fontSize:'30px', color:'#e8a020',
      align:'center', lineSpacing:6
    }).setOrigin(0.5).setAlpha(0.04).setDepth(1);

    // Gate logo connector lines (depth 1, static)
    this._drawLogoLines();

    // Pegs (depth 2)
    this.pegGfx = this.add.graphics().setDepth(2);
    this._drawPegs();

    // Bucket (depth 4)
    this.bucketGfx = this.add.graphics().setDepth(4);
    this._drawBucket();
    this.add.text(this.PLAY_LEFT+this.PLAY_W/2, this.PLAY_BOTTOM-14, '+' + BUCKET_HIT_BONUS + ' HIT BONUS', {
      fontFamily:'monospace', fontSize:'9px', color:'#334455', letterSpacing:2
    }).setOrigin(0.5).setDepth(4);

    // ── Tier display (replaces bins) ─────────────────────────────────────────
    this._buildTierDisplay();

    // ── Hit counter strip (inside play area top, hidden until shot fires) ───
    const sY = this.PLAY_TOP + 18;
    this.hitStripBg  = this.add.rectangle(this.PLAY_LEFT+this.PLAY_W/2, sY, this.PLAY_W, 34, 0x070b0e, 0.92).setDepth(8).setAlpha(0);
    this.hitCountTxt = this.add.text(this.PLAY_LEFT+14, sY, '0 HITS', {
      fontFamily:'monospace', fontSize:'13px', color:'#8899aa', fontStyle:'bold', letterSpacing:2
    }).setOrigin(0,0.5).setDepth(9).setAlpha(0);
    this.hitTierTxt  = this.add.text(this.PLAY_RIGHT-14, sY, 'BUST', {
      fontFamily:'monospace', fontSize:'12px', color:'#553333', fontStyle:'bold'
    }).setOrigin(1,0.5).setDepth(9).setAlpha(0);

    // ── Preview / launcher / ball (depth 3/5/6) ─────────────────────────────
    this.previewGfx  = this.add.graphics().setDepth(3);
    this.launcherGfx = this.add.graphics().setDepth(5);
    this._drawLauncher(false);
    this.ballGfx     = this.add.graphics().setDepth(6);   // drawn from ballState every frame

    // ── Result text ─────────────────────────────────────────────────────────
    this.resultText = this.add.text(width/2, this.PLAY_TOP+58, '', {
      fontFamily:'monospace', fontSize:'15px', color:'#5eba7d', fontStyle:'bold', letterSpacing:2
    }).setOrigin(0.5).setAlpha(0).setDepth(10);

    // ── Fatigue strip ────────────────────────────────────────────────────────
    const fatY = 692;
    this.add.text(width/2, fatY, 'FATIGUE', { fontFamily:'monospace', fontSize:'9px', color:'#445566', letterSpacing:3 }).setOrigin(0.5);
    const bW = width-80, bY = fatY+14;
    this.add.rectangle(width/2, bY, bW, 6, 0x1a2230);
    this.fatigueFill  = this.add.rectangle(width/2-bW/2, bY, 2, 6, 0x5eba7d).setOrigin(0,0.5);
    this.fatigueLabel = this.add.text(width/2, bY+13, this._fatigueText(), { fontFamily:'monospace', fontSize:'9px', color:'#556677' }).setOrigin(0.5);
    this._updateFatigueBar(bW);

    // ── Bottom hint (no fire button — hold/release is the mechanic) ──────────
    this.add.rectangle(width/2, height-76, width-48, 60, 0x0a0e14);
    this.add.rectangle(width/2, height-76, width-48, 60).setStrokeStyle(1,0x1e3028);
    this.hintTxt = this.add.text(width/2, height-76-10, 'HOLD & DRAG TO AIM', {
      fontFamily:'monospace', fontSize:'13px', color:'#2a5538', fontStyle:'bold', letterSpacing:2
    }).setOrigin(0.5);
    this.costTxt = this.add.text(width/2, height-76+12, 'RELEASE TO FIRE  \xb7  COSTS '+this._rollCost()+' NUTS', {
      fontFamily:'monospace', fontSize:'10px', color:'#334455', letterSpacing:1
    }).setOrigin(0.5);

    // ── Input: hold = aim + preview, release = fire ───────────────────────────
    this._onDown = (p) => {
      if (this.ballActive || p.y < 200) return;
      if (this.saveData.nuts < this._rollCost()) { this._flashMsg('NOT ENOUGH NUTS'); return; }
      this._isAiming = true;
      this._updateAim(p);
      this.hintTxt.setStyle({ color:'#5eba7d' });
    };
    this._onMove = (p) => {
      if (!this._isAiming || this.ballActive) return;
      this._updateAim(p);
    };
    this._onUp = () => {
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

  // ── Logo connector lines ───────────────────────────────────────────────────
  // Faint amber lines trace the gate structure behind the pegs.

  _drawLogoLines() {
    const gfx = this.add.graphics().setDepth(1);
    const pl = this.PLAY_LEFT, pt = this.PLAY_TOP;

    const chain = (pts, alpha) => {
      gfx.lineStyle(1, 0xe8a020, alpha);
      for (let i = 0; i < pts.length-1; i++) {
        gfx.lineBetween(pl+pts[i].x, pt+pts[i].y, pl+pts[i+1].x, pt+pts[i+1].y);
      }
    };

    const OA = PEG_LAYOUT.slice(0,9);
    const LP = PEG_LAYOUT.slice(9,13);
    const RP = PEG_LAYOUT.slice(13,17);
    const IA = PEG_LAYOUT.slice(17,24);
    const CB = PEG_LAYOUT.slice(24,29);
    const PP = PEG_LAYOUT.slice(29,31);

    chain(OA,                  0.22);   // outer arch crown
    chain([OA[0],...LP],       0.22);   // left pillar from arch foot
    chain([OA[8],...RP],       0.22);   // right pillar from arch foot
    chain(IA,                  0.16);   // inner arch
    chain(CB,                  0.16);   // crossbar
    chain([IA[3],...PP],       0.13);   // centre post from inner arch peak

    // Vertical supports connecting inner arch ends to crossbar ends
    gfx.lineStyle(1, 0xe8a020, 0.10);
    gfx.lineBetween(pl+IA[0].x, pt+IA[0].y, pl+CB[0].x, pt+CB[0].y);
    gfx.lineBetween(pl+IA[6].x, pt+IA[6].y, pl+CB[4].x, pt+CB[4].y);
  }

  // ── Tier display (replaces bins) ───────────────────────────────────────────

  _buildTierDisplay() {
    const boxW  = this.PLAY_W / HIT_TIERS.length;   // ~60px
    const boxH  = 44;
    this.tierGfxArr = [];
    this.tierLblArr = [];
    this.tierRngArr = [];

    HIT_TIERS.forEach((tier, i) => {
      const bx = this.PLAY_LEFT + i * boxW;
      const cx = bx + boxW / 2;

      const gfx = this.add.graphics().setDepth(3);
      this._drawTierBox(gfx, bx, this.PLAY_BOTTOM, boxW, boxH, false, tier);

      const lbl = this.add.text(cx, this.PLAY_BOTTOM+13, tier.label, {
        fontFamily:'monospace', fontSize:'11px',
        color: tier.bolts===0 ? '#442222' : '#445566', fontStyle:'bold'
      }).setOrigin(0.5).setDepth(4);

      const rng = this.add.text(cx, this.PLAY_BOTTOM+29, tier.range, {
        fontFamily:'monospace', fontSize:'8px', color:'#222d38', letterSpacing:1
      }).setOrigin(0.5).setDepth(4);

      this.tierGfxArr.push(gfx);
      this.tierLblArr.push(lbl);
      this.tierRngArr.push(rng);
    });
  }

  _drawTierBox(gfx, bx, by, bw, bh, active, tier) {
    gfx.clear();
    const bgCol = active ? (tier.bolts===0 ? 0x200808 : 0x081410) : 0x070b0e;
    const bdCol = active ? (tier.bolts===0 ? 0xc43a3a : 0x5eba7d) : (tier.bolts===0 ? 0x2a1010 : 0x1a2530);
    gfx.fillStyle(bgCol, 1);
    gfx.fillRect(bx+1, by, bw-2, bh);
    gfx.lineStyle(active?2:1, bdCol, active?0.9:0.5);
    gfx.strokeRect(bx+1, by, bw-2, bh);
  }

  _highlightTier(idx) {
    const boxW = this.PLAY_W / HIT_TIERS.length;
    HIT_TIERS.forEach((tier, i) => {
      const active = i === idx;
      this._drawTierBox(this.tierGfxArr[i], this.PLAY_LEFT+i*boxW, this.PLAY_BOTTOM, boxW, 44, active, tier);
      const lCol = active ? (tier.bolts===0 ? '#c43a3a' : '#5eba7d') : (tier.bolts===0 ? '#442222' : '#445566');
      const rCol = active ? '#8899aa' : '#222d38';
      this.tierLblArr[i].setStyle({ color: lCol });
      this.tierRngArr[i].setStyle({ color: rCol });
    });
  }

  // ── Hit counter ───────────────────────────────────────────────────────────

  _updateHitCounter(overrideHits) {
    const h    = overrideHits !== undefined ? overrideHits : this.pegHitCount;
    const tier = this._getTier(h);
    const col  = tier.bolts===0 ? '#553333' : tier.bolts<3 ? '#e8a020' : '#5eba7d';
    this.hitCountTxt.setText(h+' HIT'+(h===1?'':'S')).setStyle({ color: col });
    this.hitTierTxt.setText(tier.bolts>0 ? '\u2192 '+tier.bolts+' B' : 'BUST').setStyle({ color: col });
    this._highlightTier(this._getTierIndex(h));
  }

  // ── Draw helpers ───────────────────────────────────────────────────────────

  _drawPegs() {
    this.pegGfx.clear();
    this.pegs.forEach(peg => {
      this.pegGfx.fillStyle(peg.lit ? 0x5eba7d : 0x2a3a4a, 1);
      this.pegGfx.fillCircle(peg.x, peg.y, peg.r + (peg.lit ? 2 : 0));
    });
  }

  _drawBucket() {
    this.bucketGfx.clear();
    const by = this.PLAY_BOTTOM - 4;
    this.bucketGfx.fillStyle(0x5eba7d, 0.22);
    this.bucketGfx.fillRect(this.bucketX-this.bucketW/2, by-8, this.bucketW, 12);
    this.bucketGfx.lineStyle(2, 0x5eba7d, 0.85);
    this.bucketGfx.strokeRect(this.bucketX-this.bucketW/2, by-8, this.bucketW, 12);
  }

  _drawLauncher(active) {
    this.launcherGfx.clear();
    const lx=this.LAUNCHER_X, ly=this.LAUNCHER_Y, a=active?0.95:0.5;
    this.launcherGfx.fillStyle(active?0x1a3028:0x1e2a38,1);
    this.launcherGfx.fillCircle(lx, ly, 18);
    this.launcherGfx.lineStyle(2, 0x5eba7d, a);
    this.launcherGfx.strokeCircle(lx, ly, 18);
    this.launcherGfx.lineStyle(4, 0x5eba7d, a);
    this.launcherGfx.lineBetween(lx, ly, lx+Math.cos(this.aimAngle)*30, ly+Math.sin(this.aimAngle)*30);
    this.launcherGfx.fillStyle(0x5eba7d, a);
    this.launcherGfx.fillCircle(lx, ly, 5);
  }

  _drawPreview() {
    this.previewGfx.clear();
    if (!this._isAiming) return;
    const lx=this.LAUNCHER_X, ly=this.LAUNCHER_Y;
    const dx=Math.cos(this.aimAngle), dy=Math.sin(this.aimAngle);
    for (let i=1; i<=24; i++) {
      const t=i*0.04;
      const px=lx+dx*BALL_SPEED*t, py=ly+dy*BALL_SPEED*t+0.5*GRAVITY*t*t;
      if (py>this.PLAY_BOTTOM||px<this.PLAY_LEFT||px>this.PLAY_RIGHT) break;
      const al=Math.max(0.03, 0.8-i*0.032);
      this.previewGfx.fillStyle(0x5eba7d, al);
      this.previewGfx.fillCircle(px, py, Math.max(1, 3.2-i*0.1));
    }
  }

  _updateAim(pointer) {
    const dx=pointer.x-this.LAUNCHER_X, dy=pointer.y-this.LAUNCHER_Y;
    if (dy<8) return;
    this.aimAngle = Phaser.Math.Clamp(Math.atan2(dy,dx), 0.2, Math.PI-0.2);
    this._drawLauncher(true);
    this._drawPreview();
  }

  // ── Fire ───────────────────────────────────────────────────────────────────

  _fire() {
    const cost = this._rollCost();
    if (this.saveData.nuts<cost || this.ballActive) return;

    this.saveData.nuts -= cost;
    this.nutsText.setText(this.saveData.nuts+' NUTS');
    this.ballActive      = true;
    this.pegHitCount     = 0;
    this.pegsHitThisShot = new Set();

    this.ball.x  = this.LAUNCHER_X + Math.cos(this.aimAngle)*22;
    this.ball.y  = this.LAUNCHER_Y + Math.sin(this.aimAngle)*22;
    this.ball.vx = Math.cos(this.aimAngle)*BALL_SPEED;
    this.ball.vy = Math.sin(this.aimAngle)*BALL_SPEED;
    this.ballState.x     = this.ball.x;
    this.ballState.y     = this.ball.y;
    this.ballState.alpha = 1;

    // Show hit counter strip
    this.hitStripBg.setAlpha(1);
    this.hitCountTxt.setAlpha(1);
    this.hitTierTxt.setAlpha(1);
    this._updateHitCounter(0);
    this.tweens.add({ targets:this.resultText, alpha:0, duration:100 });
    this._highlightTier(-1);

    // Safety timeout
    this.time.delayedCall(10000, () => { if (this.ballActive) this._resolve(); });
  }

  // ── Physics update ─────────────────────────────────────────────────────────

  update(time, delta) {
    // Bucket always moves
    this.bucketX += this.bucketDir*this.bucketSpeed*(delta/1000);
    if (this.bucketX+this.bucketW/2 > this.PLAY_RIGHT) { this.bucketX=this.PLAY_RIGHT-this.bucketW/2; this.bucketDir=-1; }
    if (this.bucketX-this.bucketW/2 < this.PLAY_LEFT)  { this.bucketX=this.PLAY_LEFT +this.bucketW/2; this.bucketDir= 1; }
    this._drawBucket();

    // ── Ball rendering (always from ballState, never from Phaser tweens) ────
    this.ballGfx.clear();
    if (this.ballState.alpha > 0.01) {
      this.ballGfx.fillStyle(0x5eba7d, this.ballState.alpha);
      this.ballGfx.fillCircle(this.ballState.x, this.ballState.y, BALL_R);
    }

    if (!this.ballActive) return;

    // Sync ballState with live physics
    this.ballState.x     = this.ball.x;
    this.ballState.y     = this.ball.y;
    this.ballState.alpha = 1;

    const dt = Math.min(delta/1000, 0.025);
    this.ball.vy += GRAVITY*dt;
    this.ball.x  += this.ball.vx*dt;
    this.ball.y  += this.ball.vy*dt;

    // Wall bounces
    const L=this.PLAY_LEFT+BALL_R, R=this.PLAY_RIGHT-BALL_R;
    if (this.ball.x<L) { this.ball.x=L; this.ball.vx= Math.abs(this.ball.vx)*0.75; }
    if (this.ball.x>R) { this.ball.x=R; this.ball.vx=-Math.abs(this.ball.vx)*0.75; }
    if (this.ball.y<this.PLAY_TOP+BALL_R) { this.ball.y=this.PLAY_TOP+BALL_R; this.ball.vy=Math.abs(this.ball.vy)*0.75; }

    // Peg collisions — count unique hits
    let pegDirty = false;
    this.pegs.forEach((peg, i) => {
      const dx=this.ball.x-peg.x, dy=this.ball.y-peg.y;
      const dist=Math.sqrt(dx*dx+dy*dy), minD=BALL_R+peg.r;
      if (dist<minD && dist>0.01) {
        const nx=dx/dist, ny=dy/dist;
        const dot=this.ball.vx*nx+this.ball.vy*ny;
        if (dot<0) {
          this.ball.vx -= (1+0.65)*dot*nx;
          this.ball.vy -= (1+0.65)*dot*ny;
          this.ball.vx += (Math.random()-0.5)*20;
        }
        this.ball.x += nx*(minD-dist);
        this.ball.y += ny*(minD-dist);
        if (!this.pegsHitThisShot.has(i)) {
          this.pegsHitThisShot.add(i);
          this.pegHitCount++;
          this._updateHitCounter();
        }
        if (!peg.lit) {
          peg.lit=true; pegDirty=true;
          this.time.delayedCall(220, () => { peg.lit=false; this._drawPegs(); });
        }
      }
    });
    if (pegDirty) this._drawPegs();

    if (this.ball.y >= this.PLAY_BOTTOM-BALL_R) this._resolve();
  }

  // ── Resolve ────────────────────────────────────────────────────────────────

  _resolve() {
    this.ballActive = false;

    // Bucket catch adds bonus hits
    const inBucket  = Math.abs(this.ball.x-this.bucketX) < this.bucketW/2+BALL_R;
    const totalHits = this.pegHitCount + (inBucket ? BUCKET_HIT_BONUS : 0);

    if (inBucket) this.cameras.main.flash(150, 92, 186, 125, false);

    // Update counter to show bucket bonus
    if (inBucket) {
      this.hitCountTxt.setText(this.pegHitCount+' + '+BUCKET_HIT_BONUS+' = '+totalHits+' HITS');
    }
    this._updateHitCounter(totalHits);

    // Payout
    const tier   = this._getTier(totalHits);
    const mult   = Math.max(0.2, 1/(1+0.08*this.fatigue));
    const payout = tier.bolts>0 ? Math.max(1, Math.round(tier.bolts*mult)) : 0;

    this.saveData.bolts += payout;
    this.fatigue++;
    this.saveData.merchantFatigue.ricochet = this.fatigue;
    this._save();

    this.boltsText.setText(this.saveData.bolts+' BOLTS');
    this.tweens.add({ targets:this.boltsText, scaleX:1.3, scaleY:1.3, duration:150, yoyo:true });

    const col = payout>0 ? (payout>=4 ? '#5eba7d' : '#e8a020') : '#c43a3a';
    const msg = payout>0 ? '+'+payout+' BOLT'+(payout===1?'':'S') : 'BUST \u2014 0 BOLTS';
    this.resultText.setText(msg).setStyle({color:col}).setAlpha(0);
    this.tweens.add({ targets:this.resultText, alpha:1, duration:250 });

    // Ball sink — tween plain ballState object (safe, no Phaser Arc)
    this.ballState.x = this.ball.x;
    this.ballState.y = this.ball.y;
    this.tweens.add({ targets:this.ballState, alpha:0, y:this.ball.y+28, duration:350 });

    // Cleanup after display window
    this.time.delayedCall(1400, () => {
      this.tweens.add({ targets:[this.hitStripBg,this.hitCountTxt,this.hitTierTxt], alpha:0, duration:400 });
      this._highlightTier(-1);
      const bW = this.scale.width-80;
      this._updateFatigueBar(bW);
      this.fatigueLabel.setText(this._fatigueText());
      this._refreshCostText();
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  _getTier(hits) {
    let t = HIT_TIERS[0];
    for (const tier of HIT_TIERS) { if (hits>=tier.min) t=tier; else break; }
    return t;
  }
  _getTierIndex(hits) {
    let idx=0;
    for (let i=0; i<HIT_TIERS.length; i++) { if (hits>=HIT_TIERS[i].min) idx=i; else break; }
    return idx;
  }

  _flashMsg(msg) {
    const { width }=this.scale;
    const t=this.add.text(width/2, this.LAUNCHER_Y-30, msg, {
      fontFamily:'monospace', fontSize:'12px', color:'#c43a3a', fontStyle:'bold', letterSpacing:2
    }).setOrigin(0.5).setDepth(20).setAlpha(0);
    this.tweens.add({ targets:t, alpha:1, duration:150, yoyo:true, hold:700, onComplete:()=>t.destroy() });
  }
  _rollCost()   { return Math.min(Math.round(RICOCHET_BASE_COST*(1+Math.pow(this.fatigue,3)/500)),60); }
  _fatigueText() {
    if (this.fatigue===0) return 'FRESH \u2014 FULL PAYOUTS';
    if (this.fatigue<6)   return 'WARM ('+this.fatigue+' SHOTS)';
    if (this.fatigue<14)  return 'TIRED ('+this.fatigue+' SHOTS) \u2014 REDUCED';
    return 'BURNT ('+this.fatigue+' SHOTS) \u2014 HEAVY REDUCTION';
  }
  _updateFatigueBar(bW) {
    const col=this.fatigue<6?0x5eba7d:this.fatigue<14?0xe8a020:0xc43a3a;
    this.fatigueFill.setSize(Math.max(2,bW*Math.min(this.fatigue/20,1)),6).setFillStyle(col);
  }
  _refreshCostText() {
    const ok=this.saveData.nuts>=this._rollCost();
    this.hintTxt.setStyle({ color:ok?'#2a5538':'#553333' });
    this.costTxt.setText('RELEASE TO FIRE  \xb7  COSTS '+this._rollCost()+' NUTS').setStyle({ color:ok?'#334455':'#553333' });
  }
  _save() {
    this.saveData.merchantFatigue.ricochet=this.fatigue;
    localStorage.setItem(this.saveKey, JSON.stringify(this.saveData));
  }

  // ── Tutorial ───────────────────────────────────────────────────────────────

  _showTutorial() {
    const { width, height }=this.scale;
    const steps=[
      { tx:this.LAUNCHER_X, ty:this.LAUNCHER_Y, tw:48, th:48,
        title:'THE LAUNCHER',
        body:'HOLD ANYWHERE ON SCREEN TO AIM.\nPREVIEW APPEARS WHILE PRESSING.\nRELEASE YOUR FINGER TO FIRE.' },
      { tx:this.PLAY_LEFT+this.PLAY_W/2, ty:this.PLAY_TOP+this.PLAY_H/2, tw:this.PLAY_W, th:this.PLAY_H,
        title:'TIANXIA GATE',
        body:'THE PEGS ARE SHAPED LIKE THE\nTIANXIA INTEGRATED HOLDINGS LOGO.\nHIT AS MANY PEGS AS POSSIBLE.' },
      { tx:this.PLAY_LEFT+this.PLAY_W/2, ty:this.PLAY_TOP+18, tw:this.PLAY_W, th:34,
        title:'HIT COUNTER',
        body:'EACH UNIQUE PEG YOU HIT IS COUNTED.\nMORE HITS = HIGHER PAYOUT TIER.\nTHE COUNTER UPDATES LIVE.' },
      { tx:this.PLAY_LEFT+this.PLAY_W/2, ty:this.PLAY_BOTTOM+22, tw:this.PLAY_W, th:44,
        title:'PAYOUT TIERS',
        body:'HIT 4-7 PEGS: 1 BOLT\nHIT 8-10: 2 BOLTS\nHIT 17+: 6 BOLTS\nBUCKET CATCH ADDS +2 TO YOUR COUNT.' },
    ];
    let step=0;
    const overlay  =this.add.rectangle(width/2,height/2,width,height,0x000000,0.72).setDepth(50);
    const pulse    =this.add.rectangle(0,0,0,0).setStrokeStyle(2,0xe8a020).setDepth(51);
    this.tweens.add({ targets:pulse, alpha:0.4, duration:600, yoyo:true, repeat:-1 });
    const cardY=height-160;
    const card  =this.add.rectangle(width/2,cardY,width-32,100,0x0a0e14,0.98).setDepth(52);
    this.add.rectangle(width/2,cardY,width-32,100).setStrokeStyle(1,0xe8a020,0.6).setDepth(52);
    const tT=this.add.text(width/2,cardY-30,'',{ fontFamily:'monospace',fontSize:'13px',color:'#e8a020',fontStyle:'bold',letterSpacing:3 }).setOrigin(0.5).setDepth(53);
    const tB=this.add.text(width/2,cardY+2, '',{ fontFamily:'monospace',fontSize:'11px',color:'#8899aa',align:'center',wordWrap:{width:width-60} }).setOrigin(0.5).setDepth(53);
    this.add.text(width/2,cardY+38,'TAP TO CONTINUE',{ fontFamily:'monospace',fontSize:'9px',color:'#334455',letterSpacing:3 }).setOrigin(0.5).setDepth(53);
    const show=(i)=>{ const s=steps[i]; pulse.setPosition(s.tx,s.ty).setSize(s.tw+12,s.th+12); tT.setText(s.title); tB.setText(s.body); };
    show(0);
    const advance=()=>{ step++; if(step>=steps.length){ [overlay,pulse,card,tT,tB].forEach(e=>e.destroy()); this.saveData.tutorials.ricochet=true; this._save(); return; } show(step); };
    overlay.setInteractive();
    overlay.on('pointerdown', advance);
  }
}