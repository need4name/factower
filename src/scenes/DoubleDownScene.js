// ── DoubleDownScene.js ────────────────────────────────────────────────────────
// Farkle dice game. Roll 6 dice. Scoring dice glow green — tap to hold them.
// Roll remaining dice or bank your points. Farkle (no scoring dice) = lose all.
// Minimum 300 pts to bank. 100 pts = 1 Bolt.

const DD_BASE_COST = 4;

class DoubleDownScene extends Phaser.Scene {
  constructor() { super({ key: 'DoubleDownScene' }); }

  create() {
    const { width, height } = this.scale;
    const slotIndex = localStorage.getItem('factower_active_slot');
    this.saveKey    = 'factower_save_' + slotIndex;
    this.saveData   = JSON.parse(localStorage.getItem(this.saveKey)) || {};
    if (!this.saveData.nuts)            this.saveData.nuts = 0;
    if (!this.saveData.bolts)           this.saveData.bolts = 0;
    if (!this.saveData.merchantFatigue) this.saveData.merchantFatigue = { chrome:0, ricochet:0, doubleDown:0 };
    if (!this.saveData.tutorials)       this.saveData.tutorials = {};

    this.fatigue   = this.saveData.merchantFatigue.doubleDown || 0;
    this.inRound   = false;
    this.accScore  = 0;
    this.rollScore = 0;
    this.rolling   = false;
    this.farkled   = false;
    this.dice      = [];
    this.minBank   = 300;

    // ── Background & header ───────────────────────────────────────────────
    this.add.rectangle(width/2, height/2, width, height, 0x0d1117);
    this.add.rectangle(width/2, 0, width, 4, 0xc43a3a, 0.4);
    this.add.rectangle(width/2, 144, width, 100, 0x161b22);
    this.add.rectangle(width/2, 194, width, 1, 0x334455);

    // Back button — NO inRound gate. Always works.
    const back = this.add.rectangle(44, 144, 72, 48, 0x1e2530).setInteractive();
    this.add.text(44, 144, '<- BACK', { fontFamily:'monospace', fontSize:'14px', color:'#e8a020' }).setOrigin(0.5);
    back.on('pointerdown', () => {
      this._save();
      this.cameras.main.fade(200, 0, 0, 0);
      this.time.delayedCall(200, () => this.scene.start('MarketplaceScene'));
    });
    back.on('pointerover', () => back.setFillStyle(0x252c38));
    back.on('pointerout',  () => back.setFillStyle(0x1e2530));

    this.add.text(width/2+20, 125, 'DOUBLE-DOWN',    { fontFamily:'monospace', fontSize:'22px', color:'#c43a3a', fontStyle:'bold' }).setOrigin(0.5);
    this.add.text(width/2+20, 152, 'PRESS YOUR LUCK', { fontFamily:'monospace', fontSize:'11px', color:'#8899aa', letterSpacing:2 }).setOrigin(0.5);

    this.nutsText  = this.add.text(width/2-70, 216, this.saveData.nuts  +' NUTS',  { fontFamily:'monospace', fontSize:'12px', color:'#e8a020',  fontStyle:'bold' }).setOrigin(0.5);
    this.add.text(width/2, 216, '\xb7', { fontFamily:'monospace', fontSize:'12px', color:'#334455' }).setOrigin(0.5);
    this.boltsText = this.add.text(width/2+70, 216, this.saveData.bolts +' BOLTS', { fontFamily:'monospace', fontSize:'12px', color:'#8ab4cc', fontStyle:'bold' }).setOrigin(0.5);

    // ── Instruction banner ─────────────────────────────────────────────────
    // Always tells the player what to do right now.
    const bannerY  = 244;
    this.bannerBg  = this.add.rectangle(width/2, bannerY, width-32, 44, 0x0f1318);
    this.bannerBdr = this.add.rectangle(width/2, bannerY, width-32, 44).setStrokeStyle(1, 0x334455);
    this.bannerTxt = this.add.text(width/2, bannerY, '', {
      fontFamily:'monospace', fontSize:'11px', color:'#e8a020',
      fontStyle:'bold', align:'center', letterSpacing:1,
      wordWrap:{ width:width-56 }
    }).setOrigin(0.5);

    // ── Scoring guide — permanent, always visible ──────────────────────────
    // This answers "what am I trying to score?"
    const guideY = 278;
    this.add.text(width/2, guideY, '1s = 100 pts  \xb7  5s = 50 pts  \xb7  3\xd7 = face \xd7 100', {
      fontFamily:'monospace', fontSize:'9px', color:'#334455', letterSpacing:1
    }).setOrigin(0.5);

    // ── Score panel ────────────────────────────────────────────────────────
    const scoreY = 312;
    this.add.rectangle(width/2, scoreY, width-32, 52, 0x0f1318);
    this.add.rectangle(width/2, scoreY, width-32, 52).setStrokeStyle(1, 0x334455);
    this.accText     = this.add.text(60, scoreY-12, 'ROUND  0 pts',   { fontFamily:'monospace', fontSize:'11px', color:'#8899aa' });
    this.rollText    = this.add.text(60, scoreY+6,  'LAST ROLL  \u2014', { fontFamily:'monospace', fontSize:'11px', color:'#eef2f8' });
    this.boltPreview = this.add.text(width-24, scoreY, '', { fontFamily:'monospace', fontSize:'13px', color:'#8ab4cc', fontStyle:'bold' }).setOrigin(1, 0.5);

    // ── Dice grid (2 rows × 3) ─────────────────────────────────────────────
    this._buildDiceArea(width);

    // ── Score breakdown ────────────────────────────────────────────────────
    this.breakdownText = this.add.text(width/2, 540, '', {
      fontFamily:'monospace', fontSize:'10px', color:'#5eba7d', align:'center', letterSpacing:1
    }).setOrigin(0.5);

    // ── Action buttons ─────────────────────────────────────────────────────
    this._buildButtons(width, height);

    // ── Fatigue ────────────────────────────────────────────────────────────
    const fatY = 614;
    this.add.text(width/2, fatY, 'FATIGUE', { fontFamily:'monospace', fontSize:'9px', color:'#445566', letterSpacing:3 }).setOrigin(0.5);
    const bW = width-80, bY = fatY+14;
    this.add.rectangle(width/2, bY, bW, 6, 0x1a2230);
    this.fatigueFill  = this.add.rectangle(width/2-bW/2, bY, 2, 6, 0xc43a3a).setOrigin(0,0.5);
    this.fatigueLabel = this.add.text(width/2, bY+13, this._fatigueText(), { fontFamily:'monospace', fontSize:'9px', color:'#556677' }).setOrigin(0.5);
    this._updateFatigueBar(bW);

    this._refreshUI();

    if (!this.saveData.tutorials.doubleDown) {
      this.time.delayedCall(200, () => this._showTutorial());
    }
  }

  // ── Dice area ─────────────────────────────────────────────────────────────

  _buildDiceArea(width) {
    const dY = [400, 480];
    const dX = [84, 195, 306];
    this.diceObjects = [];
    for (let i = 0; i < 6; i++) {
      const row=Math.floor(i/3), col=i%3;
      const x=dX[col], y=dY[row];
      const bg  = this.add.rectangle(x, y, 78, 68, 0x161b22);
      const bdr = this.add.rectangle(x, y, 78, 68).setStrokeStyle(2, 0x334455);
      const pip = this.add.text(x, y-6, '\u2014', { fontFamily:'monospace', fontSize:'28px', color:'#445566', fontStyle:'bold' }).setOrigin(0.5);
      const lbl = this.add.text(x, y+24, '', { fontFamily:'monospace', fontSize:'9px', color:'#e8a020', letterSpacing:2 }).setOrigin(0.5);
      this.diceObjects.push({ bg, bdr, pip, lbl });
      bg.setInteractive();
      bg.on('pointerdown', () => this._toggleHold(i));
    }
  }

  // ── Buttons ───────────────────────────────────────────────────────────────

  _buildButtons(width, height) {
    const bY   = height-72;
    const half = (width-60)/2;

    // Single unified ROLL/PLAY button — no listener accumulation
    this.rollBg  = this.add.rectangle(24+half/2, bY, half, 60, 0x1a0808).setInteractive();
    this.rollBdr = this.add.rectangle(24+half/2, bY, half, 60).setStrokeStyle(2, 0xc43a3a);
    this.rollTxt = this.add.text(24+half/2, bY-9, 'PLAY', { fontFamily:'monospace', fontSize:'20px', color:'#c43a3a', fontStyle:'bold' }).setOrigin(0.5);
    this.rollSub = this.add.text(24+half/2, bY+14, '', { fontFamily:'monospace', fontSize:'9px', color:'#556677', letterSpacing:1 }).setOrigin(0.5);
    this.rollBg.on('pointerdown', () => {
      if (this.rolling) return;
      if (!this.inRound) this._startRound();
      else               this._doRoll();
    });
    this.rollBg.on('pointerover', () => this.rollBg.setFillStyle(0x261008));
    this.rollBg.on('pointerout',  () => this.rollBg.setFillStyle(0x1a0808));

    const bx2   = width-24-half/2;
    this.bankBg  = this.add.rectangle(bx2, bY, half, 60, 0x0d1e10).setInteractive();
    this.bankBdr = this.add.rectangle(bx2, bY, half, 60).setStrokeStyle(2, 0x5eba7d);
    this.bankTxt = this.add.text(bx2, bY-9, 'BANK', { fontFamily:'monospace', fontSize:'20px', color:'#5eba7d', fontStyle:'bold' }).setOrigin(0.5);
    this.bankSub = this.add.text(bx2, bY+14, 'MIN 300 pts', { fontFamily:'monospace', fontSize:'9px', color:'#556677', letterSpacing:1 }).setOrigin(0.5);
    this.bankBg.on('pointerdown', () => this._doBank());
    this.bankBg.on('pointerover', () => this.bankBg.setFillStyle(0x122018));
    this.bankBg.on('pointerout',  () => this.bankBg.setFillStyle(0x0d1e10));
  }

  // ── Round logic ───────────────────────────────────────────────────────────

  _startRound() {
    const cost = this._rollCost();
    if (this.saveData.nuts < cost) return;
    this.saveData.nuts -= cost;
    this.nutsText.setText(this.saveData.nuts+' NUTS');
    this._save();
    this.inRound  = true;
    this.accScore = 0;
    this.rollScore= 0;
    this.farkled  = false;
    this.dice = Array(6).fill(null).map(() => ({ value:1, held:false, scored:false }));
    this._doRoll();
  }

  _doRoll() {
    if (this.rolling) return;
    this.farkled = false;
    this.dice.forEach(d => { d.scored = false; });
    if (this.dice.every(d => d.held)) this.dice.forEach(d => { d.held=false; });
    this.rolling = true;
    this._refreshUI();
    this._animateRoll(() => {
      this.dice.forEach(d => { if (!d.held) d.value = Math.floor(Math.random()*6)+1; });
      const result = this._scoreDice();
      this.rolling = false;
      if (result.score === 0) {
        this._farkle();
      } else {
        this.rollScore  = result.score;
        this.accScore  += this.rollScore;
        this.breakdownText.setText(result.breakdown);
        result.scoringIndices.forEach(i => { this.dice[i].scored=true; });
        this._updateDiceDisplay();
        this._updateScoreDisplay();
        this._refreshUI();
      }
    });
  }

  _animateRoll(onComplete) {
    let ticks=0;
    const tick=()=>{
      this.dice.forEach(d=>{ if(!d.held) d.value=Math.floor(Math.random()*6)+1; });
      this._updateDiceDisplay(true);
      ticks++;
      if(ticks<8) this.time.delayedCall(60,tick); else this.time.delayedCall(60,onComplete);
    };
    tick();
  }

  // ── Scoring ───────────────────────────────────────────────────────────────
  // 1s=100, 5s=50, three-of-a-kind=face*100 (1s=1000).
  // 4× = 2× the 3× value. 5× = 4×. 6× = 8×. Three pairs = 750.

  _scoreDice() {
    const vals   = this.dice.map((d,i)=>({v:d.value,i})).filter(d=>!this.dice[d.i].held);
    const counts = [0,0,0,0,0,0,0];
    vals.forEach(d=>counts[d.v]++);

    let score=0;
    const scoringIndices=[], parts=[];

    // Three pairs (only on full free roll of 6)
    if (vals.length===6 && counts.slice(1).filter(c=>c===2).length===3) {
      return { score:750, breakdown:'THREE PAIRS  750 pts', scoringIndices:vals.map(d=>d.i) };
    }
    // Multi-of-a-kind
    for (let face=1; face<=6; face++) {
      const c=counts[face];
      if (c>=3) {
        const base=face===1?1000:face*100;
        const extra=c===4?2:c===5?4:c===6?8:1;
        const pts=base*extra;
        score+=pts; parts.push(c+'\xd7'+face+'  '+pts+' pts');
        let m=0; vals.forEach(d=>{ if(d.v===face&&m<c){scoringIndices.push(d.i);m++;} });
        counts[face]=0;
      }
    }
    // Singles
    if(counts[1]>0){ const pts=counts[1]*100; score+=pts; parts.push(counts[1]+'\xd71  '+pts+' pts'); let m=0; vals.forEach(d=>{if(d.v===1&&m<counts[1]){scoringIndices.push(d.i);m++;}}); }
    if(counts[5]>0){ const pts=counts[5]*50;  score+=pts; parts.push(counts[5]+'\xd75  '+pts+' pts'); let m=0; vals.forEach(d=>{if(d.v===5&&m<counts[5]){scoringIndices.push(d.i);m++;}}); }

    return { score, breakdown:parts.join('   '), scoringIndices:Array.from(new Set(scoringIndices)) };
  }

  _farkle() {
    this.farkled=true; this.accScore=0; this.rollScore=0;
    this.dice.forEach(d=>{ d.held=false; d.scored=false; d.value=Math.floor(Math.random()*6)+1; });
    this._updateDiceDisplay(); this._updateScoreDisplay(); this._refreshUI();
    this.breakdownText.setText('FARKLE \u2014 NO SCORING DICE  \u2014 ALL POINTS LOST');
    this.cameras.main.shake(200, 0.008);
  }

  _doBank() {
    if (!this.inRound || this.accScore<this.minBank || this.rolling) return;
    const mult  =Math.max(0.2, 1/(1+0.08*this.fatigue));
    const payout=Math.max(1, Math.floor(this.accScore/100*mult));
    this.saveData.bolts+=payout; this.fatigue++;
    this.saveData.merchantFatigue.doubleDown=this.fatigue;
    this._save();
    this.boltsText.setText(this.saveData.bolts+' BOLTS');
    this.tweens.add({ targets:this.boltsText, scaleX:1.3, scaleY:1.3, duration:150, yoyo:true });
    const { width }=this.scale;
    const pop=this.add.text(width/2,360,'BANKED  +'+payout+' BOLTS',{
      fontFamily:'monospace',fontSize:'18px',color:'#5eba7d',fontStyle:'bold'
    }).setOrigin(0.5).setDepth(20).setAlpha(0);
    this.tweens.add({ targets:pop, alpha:1, duration:200,
      onComplete:()=>this.time.delayedCall(1000,()=>this.tweens.add({ targets:pop, alpha:0, duration:400, onComplete:()=>pop.destroy() }))
    });
    this._endRound();
  }

  _endRound() {
    this.inRound=false; this.accScore=0; this.rollScore=0; this.farkled=false;
    this.dice=Array(6).fill(null).map(()=>({value:1,held:false,scored:false}));
    this._updateDiceDisplay(); this._updateScoreDisplay();
    this.breakdownText.setText('');
    const bW=this.scale.width-80; this._updateFatigueBar(bW); this.fatigueLabel.setText(this._fatigueText());
    this._refreshUI();
  }

  // ── Dice interaction ──────────────────────────────────────────────────────

  _toggleHold(i) {
    if (!this.inRound||this.rolling||!this.dice[i].scored) return;
    this.dice[i].held=!this.dice[i].held;
    this._updateDiceDisplay();
  }

  _updateDiceDisplay(animating) {
    this.diceObjects.forEach((obj,i)=>{
      const d=this.dice[i]||{value:1,held:false,scored:false};
      const col   =d.held?0xe8a020:d.scored?0x5eba7d:0x334455;
      const bgCol =d.held?0x1a1200:d.scored?0x0d1e10:0x161b22;
      const txtCol=d.held?'#e8a020':d.scored?'#5eba7d':(this.inRound?'#eef2f8':'#445566');
      obj.bg.setFillStyle(bgCol);
      obj.bdr.setStrokeStyle(2,col);
      obj.pip.setText(animating?'?':String(d.value)).setStyle({color:txtCol});
      obj.lbl.setText(d.held?'HELD \u2605':d.scored?'TAP TO HOLD':'');
    });
  }

  _updateScoreDisplay() {
    const preview=this.accScore>=this.minBank?'\u2192 +'+Math.floor(this.accScore/100)+' B':'';
    this.accText.setText('ROUND  '+this.accScore+' pts');
    this.rollText.setText(this.rollScore>0?'LAST ROLL  +'+this.rollScore+' pts':'LAST ROLL  \u2014');
    this.boltPreview.setText(preview);
  }

  // ── Instruction banner ────────────────────────────────────────────────────

  _updateBanner() {
    const cost=this._rollCost();
    let msg='', col='#e8a020', bdrCol=0xe8a020;
    if (this.rolling) {
      msg='ROLLING...'; col='#8899aa'; bdrCol=0x334455;
    } else if (!this.inRound) {
      msg='TAP PLAY TO START  \xb7  COSTS '+cost+' NUTS\nWIN BOLTS BY SCORING 1s, 5s & TRIPLES';
      col='#e8a020'; bdrCol=0xe8a020;
    } else if (this.farkled) {
      msg='FARKLE! \u2014 NO SCORING DICE THIS ROLL\nTAP ROLL TO TRY AGAIN (ROUND RESETS)';
      col='#c43a3a'; bdrCol=0xc43a3a;
    } else if (this.rollScore>0) {
      msg='GREEN DICE SCORE  \xb7  TAP THEM TO HOLD\nTHEN ROLL FOR MORE OR BANK';
      col='#5eba7d'; bdrCol=0x5eba7d;
    }
    this.bannerTxt.setText(msg).setStyle({color:col});
    this.bannerBdr.setStrokeStyle(1, bdrCol);
  }

  // ── UI refresh ────────────────────────────────────────────────────────────

  _refreshUI() {
    const cost    =this._rollCost();
    const canStart=!this.inRound&&this.saveData.nuts>=cost&&!this.rolling;
    const canRoll =this.inRound&&!this.rolling;
    const canBank =this.inRound&&this.accScore>=this.minBank&&!this.rolling;

    const rollActive=canStart||canRoll;
    this.rollTxt.setText(this.inRound?'ROLL':'PLAY');
    this.rollTxt.setStyle({ color:rollActive?'#c43a3a':'#445566' });
    this.rollBg.setFillStyle(rollActive?0x1a0808:0x161b22);
    this.rollBdr.setStrokeStyle(2, rollActive?0xc43a3a:0x334455);
    this.rollSub.setText(this.inRound?'PRESS YOUR LUCK':'COSTS '+cost+' NUTS');
    if(rollActive) this.rollBg.setInteractive(); else this.rollBg.disableInteractive();

    this.bankTxt.setStyle({color:canBank?'#5eba7d':'#445566'});
    this.bankBg.setFillStyle(canBank?0x0d1e10:0x161b22);
    this.bankBdr.setStrokeStyle(2, canBank?0x5eba7d:0x334455);
    if(canBank) this.bankBg.setInteractive(); else this.bankBg.disableInteractive();

    this._updateBanner();
  }

  // ── Fatigue ───────────────────────────────────────────────────────────────

  _rollCost() { return Math.min(Math.round(DD_BASE_COST*(1+Math.pow(this.fatigue,3)/500)),60); }
  _fatigueText() {
    if(this.fatigue===0) return 'FRESH \u2014 FULL PAYOUTS';
    if(this.fatigue<6)   return 'WARM ('+this.fatigue+' ROUNDS)';
    if(this.fatigue<14)  return 'TIRED ('+this.fatigue+' ROUNDS) \u2014 REDUCED';
    return 'BURNT ('+this.fatigue+' ROUNDS) \u2014 HEAVY REDUCTION';
  }
  _updateFatigueBar(bW) {
    const col=this.fatigue<6?0x5eba7d:this.fatigue<14?0xe8a020:0xc43a3a;
    this.fatigueFill.setSize(Math.max(2,bW*Math.min(this.fatigue/20,1)),6).setFillStyle(col);
  }
  _save() {
    this.saveData.merchantFatigue.doubleDown=this.fatigue;
    localStorage.setItem(this.saveKey, JSON.stringify(this.saveData));
  }

  // ── Tutorial ──────────────────────────────────────────────────────────────

  _showTutorial() {
    const { width, height }=this.scale;
    const steps=[
      { tx:width/2, ty:440, tw:width-24, th:180,
        title:'THE DICE',
        body:'ROLL 6 DICE EACH ROUND.\nDICE THAT SCORE GLOW GREEN.\n1s AND 5s ALWAYS SCORE.\nSO DO THREE-OF-A-KIND.' },
      { tx:width/2, ty:278, tw:width-32, th:14,
        title:'SCORING GUIDE',
        body:'1s = 100 pts EACH\n5s = 50 pts EACH\n3\xd7 ANY FACE = FACE \xd7 100\n(THREE 1s = 1000 pts)' },
      { tx:width/2, ty:244, tw:width-32, th:44,
        title:'ALWAYS READ THE BANNER',
        body:'THE BANNER AT THE TOP TELLS YOU\nEXACTLY WHAT TO DO NEXT.\nGREEN = GOOD NEWS. RED = FARKLE.' },
      { tx:width/2, ty:height-72, tw:width-24, th:60,
        title:'BANK OR ROLL',
        body:'TAP GREEN DICE TO HOLD THEM.\nROLL REMAINING DICE FOR MORE PTS.\nFARKLE = LOSE EVERYTHING THIS ROUND.\nBANK NEEDS 300 pts MINIMUM.' },
    ];
    let step=0;
    const overlay=this.add.rectangle(width/2,height/2,width,height,0x000000,0.72).setDepth(50);
    const pulse  =this.add.rectangle(0,0,0,0).setStrokeStyle(2,0xe8a020).setDepth(51);
    this.tweens.add({ targets:pulse, alpha:0.4, duration:600, yoyo:true, repeat:-1 });
    const cardY=height-152;
    const card  =this.add.rectangle(width/2,cardY,width-32,96,0x0a0e14,0.98).setDepth(52);
    this.add.rectangle(width/2,cardY,width-32,96).setStrokeStyle(1,0xe8a020,0.6).setDepth(52);
    const tT=this.add.text(width/2,cardY-28,'',{ fontFamily:'monospace',fontSize:'13px',color:'#e8a020',fontStyle:'bold',letterSpacing:3 }).setOrigin(0.5).setDepth(53);
    const tB=this.add.text(width/2,cardY+4, '',{ fontFamily:'monospace',fontSize:'11px',color:'#8899aa',align:'center',wordWrap:{width:width-60} }).setOrigin(0.5).setDepth(53);
    this.add.text(width/2,cardY+38,'TAP TO CONTINUE',{ fontFamily:'monospace',fontSize:'9px',color:'#334455',letterSpacing:3 }).setOrigin(0.5).setDepth(53);
    const show=(i)=>{ const s=steps[i]; pulse.setPosition(s.tx,s.ty).setSize(s.tw+10,s.th+10); tT.setText(s.title); tB.setText(s.body); };
    show(0);
    const next=()=>{ step++; if(step>=steps.length){ [overlay,pulse,card,tT,tB].forEach(e=>e.destroy()); this.saveData.tutorials.doubleDown=true; this._save(); return; } show(step); };
    overlay.setInteractive();
    overlay.on('pointerdown', next);
  }
}
