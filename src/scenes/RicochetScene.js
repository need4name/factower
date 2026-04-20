// ── RicochetScene.js ─────────────────────────────────────────────────────────
// Top launcher, fire downward. Hold anywhere to aim (preview shows while held),
// release to fire. No saved aim between shots.
// ~10 pegs oscillate sinusoidally — layout never repeats.

const RICOCHET_BASE_COST = 3;
const RICOCHET_BINS      = [16, 8, 3, 8, 16];
const BUCKET_MULTIPLIER  = 2;
const BALL_SPEED         = 300;
const GRAVITY            = 480;
const PEG_R              = 7;
const BALL_R             = 8;

// Pegs in play-area-relative coords.
// moves:true pegs oscillate. axis:'x'|'y', amp=pixels, spd=rad/s, phase=offset.
const PEG_LAYOUT = [
  // Row 1 y=50
  { x:40,  y:50  },
  { x:111, y:50,  moves:true, axis:'x', amp:20, spd:1.2, phase:0.0 },
  { x:181, y:50  },
  { x:251, y:50,  moves:true, axis:'x', amp:18, spd:0.9, phase:1.8 },
  { x:322, y:50  },
  // Row 2 y=106
  { x:76,  y:106, moves:true, axis:'y', amp:14, spd:1.4, phase:0.5 },
  { x:146, y:106 },
  { x:216, y:106, moves:true, axis:'y', amp:13, spd:1.0, phase:2.1 },
  { x:286, y:106 },
  // Row 3 y=162
  { x:40,  y:162 },
  { x:111, y:162, moves:true, axis:'x', amp:22, spd:0.8, phase:1.0 },
  { x:181, y:162 },
  { x:251, y:162 },
  { x:322, y:162, moves:true, axis:'y', amp:16, spd:1.3, phase:0.3 },
  // Row 4 y=218
  { x:76,  y:218 },
  { x:146, y:218, moves:true, axis:'x', amp:24, spd:1.1, phase:2.5 },
  { x:216, y:218 },
  { x:286, y:218 },
  // Row 5 y=274
  { x:40,  y:274, moves:true, axis:'y', amp:15, spd:0.9, phase:1.7 },
  { x:111, y:274 },
  { x:181, y:274, moves:true, axis:'x', amp:19, spd:1.5, phase:0.8 },
  { x:251, y:274 },
  { x:322, y:274 },
  // Row 6 y=330
  { x:76,  y:330 },
  { x:146, y:330, moves:true, axis:'x', amp:21, spd:1.0, phase:3.1 },
  { x:216, y:330 },
  { x:286, y:330 },
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

    this.fatigue    = this.saveData.merchantFatigue.ricochet || 0;
    this.ballActive = false;
    this._isAiming  = false;

    // ── Play area ──────────────────────────────────────────────────────────
    this.PLAY_LEFT   = 14;
    this.PLAY_RIGHT  = 376;
    this.PLAY_TOP    = 252;
    this.PLAY_BOTTOM = 638;
    this.PLAY_W      = this.PLAY_RIGHT - this.PLAY_LEFT;
    this.PLAY_H      = this.PLAY_BOTTOM - this.PLAY_TOP;

    this.LAUNCHER_X  = width / 2;
    this.LAUNCHER_Y  = 234;
    this.aimAngle    = Math.PI / 2;

    this.bucketW     = 58;
    this.bucketX     = this.PLAY_LEFT + this.PLAY_W / 2;
    this.bucketDir   = 1;
    this.bucketSpeed = 74;
    this.BIN_W       = this.PLAY_W / RICOCHET_BINS.length;

    // Build peg objects — movers store baseX/baseY separately
    this.pegs = PEG_LAYOUT.map(p => {
      const px = this.PLAY_LEFT + p.x;
      const py = this.PLAY_TOP  + p.y;
      return { x:px, y:py, baseX:px, baseY:py, r:PEG_R, lit:false,
               moves:p.moves||false, axis:p.axis||'x',
               amp:p.amp||0, spd:p.spd||1, phase:p.phase||0 };
    });

    // ── Background & header ────────────────────────────────────────────────
    this.add.rectangle(width/2, height/2, width, height, 0x0d1117);
    this.add.rectangle(width/2, 0, width, 4, 0x5eba7d, 0.4);
    this.add.rectangle(width/2, 144, width, 100, 0x161b22);
    this.add.rectangle(width/2, 194, width, 1, 0x334455);

    const back = this.add.rectangle(44, 144, 72, 48, 0x1e2530).setInteractive();
    this.add.text(44, 144, '<- BACK', { fontFamily:'monospace', fontSize:'14px', color:'#e8a020' }).setOrigin(0.5);
    back.on('pointerdown', () => {
      this._save();
      this.cameras.main.fade(200, 0, 0, 0);
      this.time.delayedCall(200, () => this.scene.start('MarketplaceScene'));
    });
    back.on('pointerover', () => back.setFillStyle(0x252c38));
    back.on('pointerout',  () => back.setFillStyle(0x1e2530));

    this.add.text(width/2+20, 125, 'RICOCHET',  { fontFamily:'monospace', fontSize:'26px', color:'#5eba7d', fontStyle:'bold' }).setOrigin(0.5);
    this.add.text(width/2+20, 152, 'THE BOARD', { fontFamily:'monospace', fontSize:'11px', color:'#8899aa', letterSpacing:3 }).setOrigin(0.5);

    this.nutsText  = this.add.text(width/2-72, 216, this.saveData.nuts  + ' NUTS',  { fontFamily:'monospace', fontSize:'12px', color:'#e8a020',  fontStyle:'bold' }).setOrigin(0.5);
    this.add.text(width/2, 216, '\xb7', { fontFamily:'monospace', fontSize:'12px', color:'#334455' }).setOrigin(0.5);
    this.boltsText = this.add.text(width/2+72, 216, this.saveData.bolts + ' BOLTS', { fontFamily:'monospace', fontSize:'12px', color:'#8ab4cc', fontStyle:'bold' }).setOrigin(0.5);

    // ── Play field border ──────────────────────────────────────────────────
    this.add.rectangle(this.PLAY_LEFT+this.PLAY_W/2, this.PLAY_TOP+this.PLAY_H/2, this.PLAY_W, this.PLAY_H, 0x0a0e14);
    this.add.rectangle(this.PLAY_LEFT+this.PLAY_W/2, this.PLAY_TOP+this.PLAY_H/2, this.PLAY_W, this.PLAY_H).setStrokeStyle(1,0x5eba7d,0.25);

    this.pegGfx    = this.add.graphics().setDepth(2);
    this._drawPegs();
    this._drawBins();
    this.bucketGfx = this.add.graphics().setDepth(4);
    this._drawBucket();
    this.previewGfx  = this.add.graphics().setDepth(3);
    this.launcherGfx = this.add.graphics().setDepth(5);
    this._drawLauncher(false);

    this.ballGfx = this.add.circle(-50,-50, BALL_R, 0x5eba7d).setDepth(6);
    this.ball    = { x:0, y:0, vx:0, vy:0 };

    this.resultText = this.add.text(width/2, this.PLAY_TOP+24, '', {
      fontFamily:'monospace', fontSize:'15px', color:'#5eba7d', fontStyle:'bold', letterSpacing:2
    }).setOrigin(0.5).setAlpha(0).setDepth(10);

    // ── Fatigue ────────────────────────────────────────────────────────────
    const fatY = 688;
    this.add.text(width/2, fatY, 'FATIGUE', { fontFamily:'monospace', fontSize:'9px', color:'#445566', letterSpacing:3 }).setOrigin(0.5);
    const bW = width-80, bY = fatY+14;
    this.add.rectangle(width/2, bY, bW, 6, 0x1a2230);
    this.fatigueFill  = this.add.rectangle(width/2-bW/2, bY, 2, 6, 0x5eba7d).setOrigin(0,0.5);
    this.fatigueLabel = this.add.text(width/2, bY+13, this._fatigueText(), { fontFamily:'monospace', fontSize:'9px', color:'#556677' }).setOrigin(0.5);
    this._updateFatigueBar(bW);

    // ── Bottom strip — cost display, no button ─────────────────────────────
    this.add.rectangle(width/2, height-76, width-48, 60, 0x0a0e14);
    this.add.rectangle(width/2, height-76, width-48, 60).setStrokeStyle(1,0x1e3028);
    this.hintTxt = this.add.text(width/2, height-76-10, 'HOLD & DRAG TO AIM', {
      fontFamily:'monospace', fontSize:'13px', color:'#2a5538', fontStyle:'bold', letterSpacing:2
    }).setOrigin(0.5);
    this.costTxt = this.add.text(width/2, height-76+12, 'RELEASE TO FIRE  \xb7  COSTS ' + this._rollCost() + ' NUTS', {
      fontFamily:'monospace', fontSize:'10px', color:'#334455', letterSpacing:1
    }).setOrigin(0.5);

    // ── Input: hold = aim, release = fire ──────────────────────────────────
    this._onDown = (p) => {
      if (this.ballActive) return;
      if (p.y < 200) return;   // ignore back button area
      if (this.saveData.nuts < this._rollCost()) {
        this._flashMsg('NOT ENOUGH NUTS');
        return;
      }
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
      if (this.ballActive) return;
      if (this.saveData.nuts >= this._rollCost()) this._fire();
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

  // ── Peg oscillation ────────────────────────────────────────────────────────

  _updateMovingPegs(timeMs) {
    const t = timeMs / 1000;
    this.pegs.forEach(peg => {
      if (!peg.moves) return;
      if (peg.axis === 'x') peg.x = peg.baseX + Math.sin(t * peg.spd + peg.phase) * peg.amp;
      else                  peg.y = peg.baseY + Math.sin(t * peg.spd + peg.phase) * peg.amp;
    });
  }

  // ── Draw helpers ───────────────────────────────────────────────────────────

  _drawPegs() {
    this.pegGfx.clear();
    this.pegs.forEach(peg => {
      const baseCol = peg.moves ? 0x3d5a6e : 0x2a3a4a;
      this.pegGfx.fillStyle(peg.lit ? 0x5eba7d : baseCol, 1);
      this.pegGfx.fillCircle(peg.x, peg.y, peg.r + (peg.lit ? 2 : 0));
      if (peg.moves && !peg.lit) {
        this.pegGfx.lineStyle(1, 0x5eba7d, 0.22);
        if (peg.axis === 'x') {
          this.pegGfx.lineBetween(peg.x-peg.r-3, peg.y, peg.x-peg.r-7, peg.y);
          this.pegGfx.lineBetween(peg.x+peg.r+3, peg.y, peg.x+peg.r+7, peg.y);
        } else {
          this.pegGfx.lineBetween(peg.x, peg.y-peg.r-3, peg.x, peg.y-peg.r-7);
          this.pegGfx.lineBetween(peg.x, peg.y+peg.r+3, peg.x, peg.y+peg.r+7);
        }
      }
    });
  }

  _drawBins() {
    const gfx         = this.add.graphics().setDepth(3);
    const binColors   = [0xe8a020, 0x5eba7d, 0x334455, 0x5eba7d, 0xe8a020];
    const binBgColors = [0x1a1200, 0x0d1e10, 0x0f1318, 0x0d1e10, 0x1a1200];
    RICOCHET_BINS.forEach((payout, i) => {
      const bx = this.PLAY_LEFT + i * this.BIN_W;
      const cx = bx + this.BIN_W/2;
      gfx.fillStyle(binBgColors[i],1);
      gfx.fillRect(bx+1, this.PLAY_BOTTOM, this.BIN_W-2, 38);
      gfx.lineStyle(1, binColors[i], 0.7);
      gfx.strokeRect(bx+1, this.PLAY_BOTTOM, this.BIN_W-2, 38);
      this.add.text(cx, this.PLAY_BOTTOM+10, ''+payout, {
        fontFamily:'monospace', fontSize:'13px',
        color:'#'+binColors[i].toString(16).padStart(6,'0'), fontStyle:'bold'
      }).setOrigin(0.5).setDepth(4);
      this.add.text(cx, this.PLAY_BOTTOM+26, 'B', { fontFamily:'monospace', fontSize:'8px', color:'#556677' }).setOrigin(0.5).setDepth(4);
      if (i>0) { gfx.lineStyle(1,0x1e2a38); gfx.lineBetween(bx,this.PLAY_BOTTOM-8,bx,this.PLAY_BOTTOM+38); }
    });
    this.add.text(this.PLAY_LEFT+this.PLAY_W/2, this.PLAY_BOTTOM-14, '\xd72  BUCKET', {
      fontFamily:'monospace', fontSize:'9px', color:'#334455', letterSpacing:2
    }).setOrigin(0.5).setDepth(4);
  }

  _drawBucket() {
    this.bucketGfx.clear();
    const by = this.PLAY_BOTTOM-4;
    this.bucketGfx.fillStyle(0x5eba7d, 0.22);
    this.bucketGfx.fillRect(this.bucketX-this.bucketW/2, by-8, this.bucketW, 12);
    this.bucketGfx.lineStyle(2, 0x5eba7d, 0.85);
    this.bucketGfx.strokeRect(this.bucketX-this.bucketW/2, by-8, this.bucketW, 12);
  }

  _drawLauncher(active) {
    this.launcherGfx.clear();
    const lx = this.LAUNCHER_X, ly = this.LAUNCHER_Y;
    const a  = active ? 0.95 : 0.5;
    this.launcherGfx.fillStyle(active ? 0x1a3028 : 0x1e2a38, 1);
    this.launcherGfx.fillCircle(lx, ly, 18);
    this.launcherGfx.lineStyle(2, 0x5eba7d, a);
    this.launcherGfx.strokeCircle(lx, ly, 18);
    const bx2 = lx + Math.cos(this.aimAngle)*30;
    const by2 = ly + Math.sin(this.aimAngle)*30;
    this.launcherGfx.lineStyle(4, 0x5eba7d, a);
    this.launcherGfx.lineBetween(lx, ly, bx2, by2);
    this.launcherGfx.fillStyle(0x5eba7d, a);
    this.launcherGfx.fillCircle(lx, ly, 5);
  }

  _drawPreview() {
    this.previewGfx.clear();
    if (!this._isAiming) return;
    const lx = this.LAUNCHER_X, ly = this.LAUNCHER_Y;
    const dx = Math.cos(this.aimAngle), dy = Math.sin(this.aimAngle);
    for (let i = 1; i <= 22; i++) {
      const t  = i * 0.04;
      const px = lx + dx*BALL_SPEED*t;
      const py = ly + dy*BALL_SPEED*t + 0.5*GRAVITY*t*t;
      if (py > this.PLAY_BOTTOM || px < this.PLAY_LEFT || px > this.PLAY_RIGHT) break;
      const a = Math.max(0.04, 0.8 - i*0.034);
      this.previewGfx.fillStyle(0x5eba7d, a);
      this.previewGfx.fillCircle(px, py, Math.max(1, 3.2 - i*0.1));
    }
  }

  _updateAim(pointer) {
    const dx = pointer.x - this.LAUNCHER_X;
    const dy = pointer.y - this.LAUNCHER_Y;
    if (dy < 8) return;
    this.aimAngle = Phaser.Math.Clamp(Math.atan2(dy, dx), 0.2, Math.PI-0.2);
    this._drawLauncher(true);
    this._drawPreview();
  }

  // ── Fire ───────────────────────────────────────────────────────────────────

  _fire() {
    const cost = this._rollCost();
    if (this.saveData.nuts < cost || this.ballActive) return;
    this.saveData.nuts -= cost;
    this.nutsText.setText(this.saveData.nuts + ' NUTS');
    this.ballActive = true;
    this.ball.x  = this.LAUNCHER_X + Math.cos(this.aimAngle)*22;
    this.ball.y  = this.LAUNCHER_Y + Math.sin(this.aimAngle)*22;
    this.ball.vx = Math.cos(this.aimAngle)*BALL_SPEED;
    this.ball.vy = Math.sin(this.aimAngle)*BALL_SPEED;
    this.ballGfx.setPosition(this.ball.x, this.ball.y).setAlpha(1);
    this.tweens.add({ targets:this.resultText, alpha:0, duration:100 });
    this.time.delayedCall(10000, () => { if (this.ballActive) this._resolve(); });
  }

  // ── Physics ────────────────────────────────────────────────────────────────

  update(time, delta) {
    this._updateMovingPegs(time);
    this._drawPegs();

    this.bucketX += this.bucketDir * this.bucketSpeed * (delta/1000);
    if (this.bucketX+this.bucketW/2 > this.PLAY_RIGHT) { this.bucketX = this.PLAY_RIGHT-this.bucketW/2; this.bucketDir=-1; }
    if (this.bucketX-this.bucketW/2 < this.PLAY_LEFT)  { this.bucketX = this.PLAY_LEFT +this.bucketW/2; this.bucketDir= 1; }
    this._drawBucket();

    if (!this.ballActive) return;

    const dt = Math.min(delta/1000, 0.025);
    this.ball.vy += GRAVITY*dt;
    this.ball.x  += this.ball.vx*dt;
    this.ball.y  += this.ball.vy*dt;

    const L = this.PLAY_LEFT+BALL_R, R = this.PLAY_RIGHT-BALL_R;
    if (this.ball.x < L) { this.ball.x=L; this.ball.vx= Math.abs(this.ball.vx)*0.75; }
    if (this.ball.x > R) { this.ball.x=R; this.ball.vx=-Math.abs(this.ball.vx)*0.75; }
    if (this.ball.y < this.PLAY_TOP+BALL_R) { this.ball.y=this.PLAY_TOP+BALL_R; this.ball.vy=Math.abs(this.ball.vy)*0.75; }

    this.pegs.forEach(peg => {
      const dx=this.ball.x-peg.x, dy=this.ball.y-peg.y;
      const dist=Math.sqrt(dx*dx+dy*dy), minD=BALL_R+peg.r;
      if (dist < minD && dist > 0.01) {
        const nx=dx/dist, ny=dy/dist;
        const dot=this.ball.vx*nx+this.ball.vy*ny;
        if (dot < 0) {
          this.ball.vx -= (1+0.65)*dot*nx;
          this.ball.vy -= (1+0.65)*dot*ny;
          this.ball.vx += (Math.random()-0.5)*22;
        }
        this.ball.x += nx*(minD-dist);
        this.ball.y += ny*(minD-dist);
        if (!peg.lit) { peg.lit=true; this.time.delayedCall(200, ()=>{ peg.lit=false; }); }
      }
    });

    this.ballGfx.setPosition(this.ball.x, this.ball.y);
    if (this.ball.y >= this.PLAY_BOTTOM-BALL_R) this._resolve();
  }

  _resolve() {
    this.ballActive = false;
    const relX    = this.ball.x - this.PLAY_LEFT;
    const idx     = Phaser.Math.Clamp(Math.floor(relX/this.BIN_W), 0, 4);
    let   payout  = RICOCHET_BINS[idx];
    let   inBucket= false;
    if (Math.abs(this.ball.x-this.bucketX) < this.bucketW/2+BALL_R) {
      payout*=BUCKET_MULTIPLIER; inBucket=true;
      this.cameras.main.flash(150, 92, 186, 125, false);
    }
    const mult = Math.max(0.2, 1/(1+0.08*this.fatigue));
    payout = Math.max(1, Math.round(payout*mult));
    this.saveData.bolts += payout;
    this.fatigue++;
    this.saveData.merchantFatigue.ricochet = this.fatigue;
    this._save();
    this.boltsText.setText(this.saveData.bolts+' BOLTS');
    this.tweens.add({ targets:this.boltsText, scaleX:1.3, scaleY:1.3, duration:150, yoyo:true });
    const isEdge = idx===0||idx===4;
    const col = inBucket?'#eef2f8': isEdge?'#e8a020':'#5eba7d';
    const msg = inBucket?'BUCKET \xd72!  +'+payout+' BOLTS': isEdge?'EDGE!  +'+payout+' BOLTS':'+'+payout+' BOLT'+(payout===1?'':'S');
    this.resultText.setText(msg).setStyle({ color:col }).setAlpha(0);
    this.tweens.add({ targets:this.resultText, alpha:1, duration:250 });
    this.tweens.add({ targets:this.ballGfx, alpha:0, y:this.ball.y+24, duration:300 });
    this.time.delayedCall(600, () => {
      this.ballGfx.setPosition(-50,-50).setAlpha(1);
      const bW = this.scale.width-80;
      this._updateFatigueBar(bW);
      this.fatigueLabel.setText(this._fatigueText());
      this._refreshCostText();
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  _flashMsg(msg) {
    const { width } = this.scale;
    const t = this.add.text(width/2, this.LAUNCHER_Y-30, msg, {
      fontFamily:'monospace', fontSize:'12px', color:'#c43a3a', fontStyle:'bold', letterSpacing:2
    }).setOrigin(0.5).setDepth(20).setAlpha(0);
    this.tweens.add({ targets:t, alpha:1, duration:150, yoyo:true, hold:700, onComplete:()=>t.destroy() });
  }
  _rollCost() { return Math.min(Math.round(RICOCHET_BASE_COST*(1+Math.pow(this.fatigue,3)/500)),60); }
  _fatigueText() {
    if (this.fatigue===0) return 'FRESH \u2014 FULL PAYOUTS';
    if (this.fatigue<6)   return 'WARM ('+this.fatigue+' SHOTS)';
    if (this.fatigue<14)  return 'TIRED ('+this.fatigue+' SHOTS) \u2014 REDUCED';
    return 'BURNT ('+this.fatigue+' SHOTS) \u2014 HEAVY REDUCTION';
  }
  _updateFatigueBar(bW) {
    const col = this.fatigue<6?0x5eba7d: this.fatigue<14?0xe8a020:0xc43a3a;
    this.fatigueFill.setSize(Math.max(2,bW*Math.min(this.fatigue/20,1)),6).setFillStyle(col);
  }
  _refreshCostText() {
    const ok = this.saveData.nuts >= this._rollCost();
    this.hintTxt.setStyle({ color: ok?'#2a5538':'#553333' });
    this.costTxt.setText('RELEASE TO FIRE  \xb7  COSTS '+this._rollCost()+' NUTS').setStyle({ color: ok?'#334455':'#553333' });
  }
  _save() {
    this.saveData.merchantFatigue.ricochet = this.fatigue;
    localStorage.setItem(this.saveKey, JSON.stringify(this.saveData));
  }

  // ── Tutorial ───────────────────────────────────────────────────────────────

  _showTutorial() {
    const { width, height } = this.scale;
    const steps = [
      { tx:this.LAUNCHER_X, ty:this.LAUNCHER_Y, tw:48, th:48,
        title:'THE LAUNCHER',
        body:'HOLD ANYWHERE ON SCREEN TO AIM.\nPREVIEW APPEARS WHILE PRESSING.\nRELEASE TO FIRE \u2014 YOU CANNOT PRE-AIM.' },
      { tx:this.PLAY_LEFT+this.PLAY_W/2, ty:this.PLAY_TOP+this.PLAY_H/2, tw:this.PLAY_W, th:this.PLAY_H,
        title:'MOVING PEGS',
        body:'BRIGHTER PEGS WITH TICK MARKS\nOSCILLATE BACK AND FORTH.\nNO TWO SHOTS ARE IDENTICAL.' },
      { tx:this.PLAY_LEFT+this.PLAY_W/2, ty:this.PLAY_BOTTOM-4, tw:this.bucketW+14, th:20,
        title:'THE BUCKET',
        body:'LAND IN THE BUCKET FOR '+BUCKET_MULTIPLIER+'\xd7 PAYOUT.\nWATCH WHERE IT IS BEFORE YOU FIRE.' },
      { tx:this.PLAY_LEFT+this.PLAY_W/2, ty:this.PLAY_BOTTOM+19, tw:this.PLAY_W, th:38,
        title:'THE BINS',
        body:'OUTER BINS: 16 BOLTS\nINNER BINS: 8 BOLTS\nMIDDLE BIN: 3 BOLTS' },
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
    const showStep=(i)=>{ const s=steps[i]; pulse.setPosition(s.tx,s.ty).setSize(s.tw+12,s.th+12); tT.setText(s.title); tB.setText(s.body); };
    showStep(0);
    const advance=()=>{ step++; if(step>=steps.length){ [overlay,pulse,card,tT,tB].forEach(e=>e.destroy()); this.saveData.tutorials.ricochet=true; this._save(); return; } showStep(step); };
    overlay.setInteractive();
    overlay.on('pointerdown', advance);
  }
}
