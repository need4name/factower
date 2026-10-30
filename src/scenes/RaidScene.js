// ── RaidScene.js ──────────────────────────────────────────────────────────────
// Offensive levels. Your towers ride out on carts along the road as a convoy,
// firing at enemy turrets as they pass. Whatever reaches the end of the road
// hammers the enemy core. Wreck the core to win.
//   · Tap a tower button to send one out (from your Armoury stock).
//   · Barricade carts are tough and draw turret fire.
//   · Wrecked turrets leave salvage — tap it for Parts, spend Parts on REPAIR.
//   · Towers that get wrecked are lost; the rest come home, win or lose.

const RAID_TURRETS = {
  gun:   { name: 'Gun nest', hp: 150, dmg: 14, range: 120, rate: 850,  colour: 0xe5534b, parts: 6 },
  salvo: { name: 'SALV salvo', hp: 210, dmg: 10, range: 135, rate: 500,  colour: 0x52c47f, parts: 9 },
  heavy: { name: 'Cannon',   hp: 300, dmg: 38, range: 110, rate: 1800, colour: 0xb03a33, parts: 12, rare: 'plate' }
};
const RAID_UNIT_HP   = { gunner: 110, gunner2: 150, bomber: 90, barricade: 260, siphon: 120 };
const RAID_DEPLOY_MS = 1000;
const RAID_REPAIR    = { cost: 10, heal: 0.5, cooldown: 6000 };

class RaidScene extends Phaser.Scene {
  constructor() { super({ key: 'RaidScene' }); }

  init(data) {
    this.storylineId = (data && data.storylineId) || 1;
    this.levelId     = (data && data.levelId) || 4;
    this.levelData   = (data && data.levelData) || Progress.level(Progress.key(this.storylineId, this.levelId));
  }

  create() {
    const { width } = this.scale;
    this.H = this.scale.height;
    this.saveData = SaveManager.load() || {};
    const stock = this.saveData.stockpile || {};
    this.stock = {}; this.lost = {};
    TOWER_ORDER.forEach(t => { this.stock[t] = stock[t] || 0; this.lost[t] = 0; });
    this.units = []; this.turrets = []; this.shots = []; this.pickups = [];
    this.parts = 10; this.rare = { plate: 0, engine: 0 };   // enough for one repair
    this.repairHinted = false;
    this.simNow = 0; this.lastDeploy = -1e9; this.lastRepair = -1e9;
    this.over = false; this.paused = false; this.started = false;

    UI.backdrop(this);
    UI.fadeIn(this);
    Art.ensure(this);

    // Layout mirrors CombatScene
    this.PLAY_TOP = UI.HEADER_H + 14;
    this.PANEL_TOP = this.H - 124;
    this.CORE_Y = this.H - 150;
    this.CT = this.PLAY_TOP + 4;
    this.CB = this.CORE_Y - 40;
    const sy = (this.CB - this.CT) / 418;
    this.path = this.levelData.path.map(p => ({ x: p.x, y: this.CT + p.oy * sy }));
    this.segs = [];
    let total = 0;
    for (let i = 0; i < this.path.length - 1; i++) {
      const a = this.path[i], b = this.path[i + 1], L = Math.hypot(b.x - a.x, b.y - a.y);
      this.segs.push({ a, b, L, start: total }); total += L;
    }
    this.pathLen = total;

    this.drawRoad();
    (this.levelData.turrets || []).forEach(t => this.addTurret(t.x, this.CT + t.oy * sy, t.kind));
    this.drawCore(this.levelData.core.hp);

    this.hdr = UI.header(this, {
      title: this.titleCase(this.levelData.name), sub: 'RAID  ·  WRECK THE CORE', accent: UI.C.red,
      onBack: () => this.confirmAbort(),
      chips: [{ kind: 'parts', value: this.parts }]
    });
    this.status = UI.text(this, width / 2, this.PLAY_TOP - 8, 'Tap a tower below to send it down the road', 'bodyB',
      { size: 12.5, origin: [0.5, 0], color: UI.T.amber, depth: 30 });
    this.drawPanel();

    this.input.on('pointerup', () => { this._pickupTap = false; });
  }

  titleCase(str) { return UI.titleCase(str); }

  // ── Map ───────────────────────────────────────────────────────────────
  drawRoad() {
    const { width } = this.scale;
    const map = Art.drawMap(this, this.path, { x: 14, y: this.PLAY_TOP, w: width - 28, h: this.CORE_Y + 22 - this.PLAY_TOP }, this.storylineId);
    this.waterFx = map.water;
    const s = this.path[0];
    UI.text(this, s.x + 28, this.CT + 34, 'YOUR CONVOY', 'tag', { size: 10, origin: [0, 0.5], color: UI.T.blue, depth: 2 });
  }

  pointAt(d) {
    d = Phaser.Math.Clamp(d, 0, this.pathLen);
    const seg = this.segs.find(sg => d <= sg.start + sg.L) || this.segs[this.segs.length - 1];
    const t = seg.L ? (d - seg.start) / seg.L : 0;
    return { x: seg.a.x + (seg.b.x - seg.a.x) * t, y: seg.a.y + (seg.b.y - seg.a.y) * t };
  }

  addTurret(x, y, kind) {
    // Later raids have tougher defences: turretScale multiplies hp and damage
    const base = RAID_TURRETS[kind] || RAID_TURRETS.gun, sc = this.levelData.turretScale || 1;
    const k = Object.assign({}, base, { hp: Math.round(base.hp * sc), dmg: Math.round(base.dmg * sc) });
    const size = kind === 'heavy' ? 30 : 24;
    const body = this.add.image(x, y, kind === 'heavy' ? 'tur_base_heavy' : 'tur_base').setScale(1 / Art.RES).setDepth(4);
    const barrel = this.add.image(x, y, 'tur_head_' + (RAID_TURRETS[kind] ? kind : 'gun')).setScale(1 / Art.RES).setDepth(5).setRotation(-Math.PI / 2);
    const range = this.add.circle(x, y, k.range, k.colour, 0.05).setStrokeStyle(1, k.colour, 0.22).setDepth(2);
    const hpBg = this.add.rectangle(x, y - size / 2 - 8, size + 6, 4, 0x2a3a4a).setDepth(6);
    const hpFill = this.add.rectangle(x - (size + 6) / 2, y - size / 2 - 8, size + 6, 4, UI.C.red).setOrigin(0, 0.5).setDepth(6);
    this.turrets.push({ kind, k, x, y, size, hp: k.hp, maxHp: k.hp, alive: true, last: -1e9, body, barrel, range, hpBg, hpFill });
  }

  drawCore(hp) {
    const end = this.path[this.path.length - 1];
    this.core = { x: end.x, y: this.CORE_Y - 6, hp, maxHp: hp, alive: true };
    const g = this.add.graphics().setDepth(4);
    g.fillStyle(0x2a1414, 1); g.lineStyle(3, UI.C.red, 1);
    const r = 26, pts = [];
    for (let i = 0; i < 6; i++) pts.push({ x: this.core.x + r * Math.cos(Math.PI / 6 + i * Math.PI / 3), y: this.core.y + r * Math.sin(Math.PI / 6 + i * Math.PI / 3) });
    g.fillPoints(pts, true); g.strokePoints(pts, true);
    this.core.gfx = g;
    UI.text(this, this.core.x, this.core.y, 'CORE', 'tag', { size: 10, origin: 0.5, color: UI.T.red, depth: 5 });
    const { width } = this.scale;
    this.coreBarW = width - 120;
    UI.text(this, 24, this.CORE_Y + 30, 'ENEMY CORE', 'label', { size: 10, origin: [0, 0.5], color: UI.T.red });
    this.add.rectangle(100 + this.coreBarW / 2, this.CORE_Y + 30, this.coreBarW, 8, 0x2a3a4a).setDepth(6);
    this.coreFill = this.add.rectangle(100, this.CORE_Y + 30, this.coreBarW, 8, UI.C.red).setOrigin(0, 0.5).setDepth(6);
  }

  // ── Bottom panel ──────────────────────────────────────────────────────
  drawPanel() {
    const { width } = this.scale;
    const g = this.add.graphics().setDepth(20);
    g.fillStyle(UI.C.bg, 0.96); g.fillRect(0, this.PANEL_TOP, width, 124);
    g.fillStyle(UI.C.line, 1); g.fillRect(0, this.PANEL_TOP, width, 1);
    // One button per tower type you own (two rows if there are more than 3), plus REPAIR
    let types = TOWER_ORDER.filter(t => this.stock[t] > 0);
    if (!types.length) types = ['gunner'];
    const compact = types.length > 3;
    const perRow = compact ? Math.ceil(types.length / 2) : types.length;
    const repW = 88, bw = (width - 32 - repW - 8 * perRow) / perRow;
    const bh = compact ? 50 : 76;
    this.deployBtns = {};
    types.forEach((t, i) => {
      const row = compact ? Math.floor(i / perRow) : 0, col = compact ? i % perRow : i;
      const x = 16 + bw / 2 + col * (bw + 8);
      const y = compact ? this.PANEL_TOP + 8 + bh / 2 + row * (bh + 8) : this.H - 62;
      this.deployBtns[t] = UI.button(this, x, y, bw, bh, {
        label: TOWER_DATA[t].short || this.titleCase(TOWER_DATA[t].name), sub: 'x' + this.stock[t], variant: 'secondary', size: compact ? 11.5 : 13, depth: 21,
        onTap: () => this.deploy(t)
      });
    });
    this.repairBtn = UI.button(this, width - 16 - repW / 2, this.H - 62, repW, 76, {
      label: 'REPAIR', sub: RAID_REPAIR.cost + ' PARTS', variant: 'primary', colour: UI.C.green, size: 13, depth: 21,
      onTap: () => this.repair()
    });
    this.refreshPanel();
  }

  refreshPanel() {
    Object.entries(this.deployBtns).forEach(([t, b]) => b.setLabel(TOWER_DATA[t].short || this.titleCase(TOWER_DATA[t].name), 'x' + this.stock[t]).setEnabled(this.stock[t] > 0 && !this.over));
    const ready = this.simNow - this.lastRepair >= RAID_REPAIR.cooldown;
    this.repairBtn.setEnabled(!this.over && this.parts >= RAID_REPAIR.cost && ready && this.units.some(u => u.alive));
    this.hdr.chips.parts.setValue(this.parts);
  }

  // ── Actions ───────────────────────────────────────────────────────────
  deploy(type) {
    if (this.over || this.stock[type] <= 0) return;
    if (this.simNow - this.lastDeploy < RAID_DEPLOY_MS) { UI.toast(this, 'The road is busy — one cart at a time', 'warn', { y: this.PLAY_TOP + 30, duration: 1000 }); return; }
    this.lastDeploy = this.simNow;
    this.stock[type]--;
    this.started = true;
    Sfx.play('place');
    const d = TOWER_DATA[type];
    const p = this.path[0];
    // A barge carrying the tower; the turret head turns separately
    const art = Art.tower(this, 0, 0, type);
    const barge = this.add.image(0, 0, 'barge').setScale(1 / Art.RES);
    const sprite = this.add.container(p.x, p.y, [barge, art.base.setScale(0.8 / Art.RES)]).setDepth(8);
    sprite.barge = barge;
    const head = art.head.setPosition(p.x, p.y).setScale(0.8 / Art.RES).setDepth(9).setRotation(Math.PI / 2);
    const barrel = type === 'barricade' ? null : head;
    if (type === 'barricade') { sprite.add(head.setPosition(0, 0)); this.tweens.add({ targets: head, angle: 360, duration: 9000, repeat: -1 }); }
    const hpBg = this.add.rectangle(p.x, p.y - 20, 26, 4, 0x2a3a4a).setDepth(9);
    const hpFill = this.add.rectangle(p.x - 13, p.y - 20, 26, 4, UI.C.green).setOrigin(0, 0.5).setDepth(9);
    const hp = RAID_UNIT_HP[type];
    this.units.push({ type, d, s: 0, hp, maxHp: hp, alive: true, last: -1e9, sprite, barrel, hpBg, hpFill,
      speed: (d.speed || 60) * 0.9, atCore: false });
    this.status.setText(type === 'barricade' ? 'Barricade carts soak up turret fire' : 'Your convoy fires as it rolls').setColor(UI.T.dim);
    this.refreshPanel();
  }

  repair() {
    if (this.over || this.parts < RAID_REPAIR.cost || this.simNow - this.lastRepair < RAID_REPAIR.cooldown) return;
    this.parts -= RAID_REPAIR.cost;
    this.lastRepair = this.simNow;
    this.units.filter(u => u.alive).forEach(u => {
      u.hp = Math.min(u.maxHp, u.hp + u.maxHp * RAID_REPAIR.heal);
      const ring = this.add.circle(u.sprite.x, u.sprite.y, 18, UI.C.green, 0.35).setDepth(7);
      this.tweens.add({ targets: ring, scale: 2, alpha: 0, duration: 400, onComplete: () => ring.destroy() });
    });
    this.refreshPanel();
  }

  confirmAbort() {
    if (this.over) { UI.go(this, 'DockScene'); return; }
    if (!this.started) { UI.go(this, 'DockScene'); return; }
    this.paused = true;
    UI.modal(this, {
      title: 'Call off the raid?', icon: 'back', accent: UI.C.red,
      body: 'Carts still on the road come home. Towers already wrecked stay lost.',
      buttons: [{ label: 'KEEP GOING', variant: 'secondary', onTap: () => { this.paused = false; } },
                { label: 'RETREAT', variant: 'danger', onTap: () => this.finish(false, true) }]
    });
  }

  // ── Simulation ────────────────────────────────────────────────────────
  update(time, delta) {
    if (this.waterFx && !this.paused) { this.waterFx.tilePositionX += delta * 0.012; this.waterFx.tilePositionY -= delta * 0.02; }
    if (this.over || this.paused) return;
    const dt = Math.min(delta, 50);
    this.simNow += dt;

    // Units roll forward; at the end of the road they hit the core
    this.units.forEach(u => {
      if (!u.alive) return;
      if (!u.atCore) {
        u.s += u.speed * dt / 1000;
        if (u.s >= this.pathLen - 4) { u.s = this.pathLen - 4; u.atCore = true; }
      }
      const p = this.pointAt(u.s);
      // Point the barge along the channel
      const q = this.pointAt(u.s + 6);
      if (q.x !== p.x || q.y !== p.y) u.sprite.barge.setRotation(Math.atan2(q.y - p.y, q.x - p.x));
      u.sprite.setPosition(p.x, p.y);
      if (u.barrel) u.barrel.setPosition(p.x, p.y);
      u.hpBg.setPosition(p.x, p.y - 20); u.hpFill.setPosition(p.x - 13, p.y - 20);
      u.hpFill.setSize(26 * Math.max(0, u.hp / u.maxHp), 4).setFillStyle(u.hp / u.maxHp > 0.5 ? UI.C.green : u.hp / u.maxHp > 0.25 ? UI.C.amber : UI.C.red);

      // Fire: core if parked there, else the nearest turret in range
      if (u.type === 'barricade') {
        if (u.atCore && this.simNow - u.last >= 1000) { u.last = this.simNow; this.hitCore(8); }
        return;
      }
      const rate = u.type === 'siphon' ? 500 : u.d.fireRate;
      if (this.simNow - u.last < rate) return;
      let target = null;
      if (u.atCore && this.core.alive) target = this.core;
      else {
        let best = 1e9;
        this.turrets.forEach(t => {
          if (!t.alive) return;
          const dd = Phaser.Math.Distance.Between(p.x, p.y, t.x, t.y);
          if (dd <= u.d.range && dd < best) { best = dd; target = t; }
        });
      }
      if (!target) return;
      u.last = this.simNow;
      const ang = Phaser.Math.Angle.Between(p.x, p.y, target.x, target.y);
      if (u.barrel) u.barrel.setRotation(ang);
      const dmg = u.type === 'siphon' ? Math.round((u.d.dps || 12) * 0.5) : u.d.damage;
      if (u.type === 'siphon') {
        // Siphon carts drain turrets and patch up the cart in front
        const ally = this.units.filter(o => o.alive && o !== u && o.hp < o.maxHp).sort((a, b) => Math.abs(a.s - u.s) - Math.abs(b.s - u.s))[0];
        if (ally) ally.hp = Math.min(ally.maxHp, ally.hp + dmg * 0.6);
      }
      Sfx.play(u.type === 'bomber' ? 'bomb' : u.type === 'siphon' ? 'zap' : u.type === 'gunner2' ? 'shot2' : 'shot');
      this.fire(p.x, p.y, target, u.type === 'bomber' ? 340 : 700, dmg, u.type === 'bomber' ? (u.d.splashRadius || 80) : 0, u.type === 'bomber' ? u.d.colour : u.type === 'siphon' ? 0xc9b6ff : 0xfff2c4, 'unit');
    });

    // Turrets shoot the nearest cart in range — barricades first
    this.turrets.forEach(t => {
      if (!t.alive || this.simNow - t.last < t.k.rate) return;
      const inRange = this.units.filter(u => u.alive && Phaser.Math.Distance.Between(t.x, t.y, u.sprite.x, u.sprite.y) <= t.k.range);
      if (!inRange.length) return;
      const tank = inRange.filter(u => u.type === 'barricade');
      const pool = tank.length ? tank : inRange;
      const target = pool.reduce((a, b) => Phaser.Math.Distance.Between(t.x, t.y, a.sprite.x, a.sprite.y) <= Phaser.Math.Distance.Between(t.x, t.y, b.sprite.x, b.sprite.y) ? a : b);
      t.last = this.simNow;
      t.barrel.setRotation(Phaser.Math.Angle.Between(t.x, t.y, target.sprite.x, target.sprite.y));
      Sfx.play(t.kind === 'heavy' ? 'bomb' : 'shot');
      this.fire(t.x, t.y, target, t.kind === 'heavy' ? 360 : 620, t.k.dmg, 0, t.k.colour, 'turret');
    });

    this.updateShots(dt);
    this.updatePickups();

    // First time a cart is badly hurt, point at REPAIR
    if (!this.repairHinted && this.parts >= RAID_REPAIR.cost && this.units.some(u => u.alive && u.hp < u.maxHp * 0.5)) {
      this.repairHinted = true;
      this.status.setText('A cart is badly damaged \u2014 tap REPAIR!').setColor(UI.T.green);
      this.tweens.add({ targets: this.repairBtn, scale: 1.08, duration: 220, yoyo: true, repeat: 5 });
    }
    if (this._panelAcc === undefined || (this._panelAcc += dt) > 200) { this._panelAcc = 0; this.refreshPanel(); }

    // Lost: nothing on the road and nothing left to send
    if (this.started && !this.units.some(u => u.alive) && !Object.values(this.stock).some(n => n > 0) && !this.shots.length) this.finish(false);
  }

  fire(x, y, target, speed, dmg, splash, colour, from) {
    const bullet = this.add.circle(x, y, splash ? 6 : 3.5, colour).setDepth(10);
    this.shots.push({ bullet, target, speed, dmg, splash, from });
  }

  updateShots(dt) {
    this.shots = this.shots.filter(sh => {
      const t = sh.target;
      const alive = t === this.core ? this.core.alive : t.alive;
      if (!alive) { sh.bullet.destroy(); return false; }
      const tx = t.sprite ? t.sprite.x : t.x, ty = t.sprite ? t.sprite.y : t.y;
      const d = Phaser.Math.Distance.Between(sh.bullet.x, sh.bullet.y, tx, ty), step = sh.speed * dt / 1000;
      if (d <= step + 8) {
        sh.bullet.destroy();
        if (sh.from === 'turret') this.hitUnit(t, sh.dmg);
        else if (t === this.core) this.hitCore(sh.dmg);
        else {
          this.hitTurret(t, sh.dmg);
          if (sh.splash) this.turrets.forEach(o => { if (o !== t && o.alive && Phaser.Math.Distance.Between(o.x, o.y, tx, ty) <= sh.splash) this.hitTurret(o, sh.dmg); });
        }
        return false;
      }
      sh.bullet.x += (tx - sh.bullet.x) / d * step;
      sh.bullet.y += (ty - sh.bullet.y) / d * step;
      return true;
    });
  }

  flash(target) { if (target && target.setAlpha) this.tweens.add({ targets: target, alpha: 0.35, duration: 60, yoyo: true }); }

  hitUnit(u, dmg) {
    if (!u.alive) return;
    u.hp -= dmg; this.flash(u.sprite);
    if (u.hp > 0) return;
    u.alive = false;
    this.lost[u.type]++;
    Sfx.play('boom');
    [u.barrel, u.hpBg, u.hpFill].forEach(o => o && o.destroy());
    this.tweens.add({ targets: u.sprite, scale: 1.8, alpha: 0, duration: 220, onComplete: () => u.sprite.destroy() });
    UI.toast(this, this.titleCase(u.d.name) + ' wrecked', 'bad', { y: this.PLAY_TOP + 30, duration: 1000 });
  }

  hitTurret(t, dmg) {
    if (!t.alive) return;
    t.hp -= dmg; this.flash(t.body);
    t.hpFill.setSize((t.size + 6) * Math.max(0, t.hp / t.maxHp), 4);
    if (t.hp > 0) return;
    t.alive = false;
    Sfx.play('boom');
    [t.barrel, t.hpBg, t.hpFill, t.range].forEach(o => o.destroy());
    t.body.setTint(0x555555);
    const boom = this.add.circle(t.x, t.y, 26, UI.C.amber, 0.5).setDepth(11);
    this.tweens.add({ targets: boom, scale: 2, alpha: 0, duration: 300, onComplete: () => boom.destroy() });
    this.spawnPickup(t.x + 16, t.y + 16, { parts: t.k.parts });
    if (t.k.rare) this.spawnPickup(t.x - 16, t.y + 16, { rare: t.k.rare });
  }

  hitCore(dmg) {
    if (!this.core.alive) return;
    this.core.hp -= dmg;
    this.coreFill.setSize(this.coreBarW * Math.max(0, this.core.hp / this.core.maxHp), 8);
    this.cameras.main.shake(60, 0.002);
    Sfx.play('hit');
    if (this.core.hp <= 0) { this.core.alive = false; Sfx.play('bigsink'); this.finish(true); }
  }

  // ── Salvage (same idea as defence levels) ─────────────────────────────
  spawnPickup(x, y, what) {
    const isRare = !!what.rare;
    const col = isRare ? RARE_PARTS[what.rare].colour : UI.C.amber;
    const c = this.add.container(x, y).setDepth(12);
    const g = this.add.graphics();
    g.fillStyle(0x0a0d12, 0.85); g.fillCircle(0, 0, 10); g.lineStyle(2, col, 1); g.strokeCircle(0, 0, 10);
    c.add([g, UI.icon(this, 0, 0, isRare ? 'star' : 'gear', 10, col)]);
    const zone = this.add.zone(x, y, 48, 48).setInteractive().setDepth(13);
    const p = { c, zone, born: this.simNow, what };
    zone.on('pointerdown', () => this.collect(p));
    this.tweens.add({ targets: c, y: y - 3, duration: 600, yoyo: true, repeat: -1 });
    this.pickups.push(p);
  }

  collect(p) {
    if (p.done) return;
    p.done = true; p.zone.destroy();
    if (p.what.rare) this.rare[p.what.rare]++; else this.parts += p.what.parts;
    const t = UI.text(this, p.c.x, p.c.y - 12, p.what.rare ? '+1 ' + RARE_PARTS[p.what.rare].name : '+' + p.what.parts, 'tag', { size: 12, origin: 0.5, color: UI.T.amber, depth: 14 });
    this.tweens.add({ targets: t, y: t.y - 24, alpha: 0, duration: 600, onComplete: () => t.destroy() });
    this.tweens.killTweensOf(p.c); p.c.destroy();
    this.refreshPanel();
  }

  updatePickups() {
    this.pickups = this.pickups.filter(p => {
      if (p.done) return false;
      const age = this.simNow - p.born;
      if (age > 9000) { p.zone.destroy(); this.tweens.killTweensOf(p.c); p.c.destroy(); return false; }
      if (age > 7000) p.c.setAlpha(0.35 + 0.65 * Math.abs(Math.sin(age / 120)));
      return true;
    });
  }

  // ── End ───────────────────────────────────────────────────────────────
  finish(won, retreated) {
    if (this.over) return;
    this.over = true;
    Sfx.play(won ? 'win' : 'lose');
    if (this._uiToast && this._uiToast.scene) this._uiToast.destroy();
    this.paused = false;
    const key = Progress.key(this.storylineId, this.levelId);
    let firstClear = false, bolts = 0;
    const loot = {};    // filled in below: full on a first clear, half on replays
    SaveManager.update(save => {
      if (!save.stockpile) save.stockpile = {};
      Object.entries(this.lost).forEach(([t, n]) => { save.stockpile[t] = Math.max(0, (save.stockpile[t] || 0) - n); });
      if (!won) return;
      if (!save.completedLevels) save.completedLevels = {};
      const sk = 'storyline' + this.storylineId;
      if (!save.completedLevels[sk]) save.completedLevels[sk] = [];
      firstClear = !save.completedLevels[sk].includes(this.levelId);
      if (firstClear) save.completedLevels[sk].push(this.levelId);
      const base = this.levelData.loot || {};
      Object.keys(base).forEach(m => { loot[m] = Math.ceil(base[m] * (firstClear ? 1 : 0.5)); });
      if (!save.materials) save.materials = { plasticScrap: 0, refinedPlastic: 0, salvagedMetal: 0 };
      save.materials.plasticScrap  = (save.materials.plasticScrap  || 0) + (loot.plasticScrap  || 0);
      save.materials.salvagedMetal = (save.materials.salvagedMetal || 0) + (loot.salvagedMetal || 0);
      bolts = firstClear ? 2 + this.levelId : 1;
      save.bolts = (save.bolts || 0) + bolts;
      save.merchantFatigue = { chrome: 0, ricochet: 0, doubleDown: 0 };
    });
    this.showResults(won, retreated, loot, bolts, firstClear, key);
  }

  showResults(won, retreated, loot, bolts, firstClear, key) {
    const { width } = this.scale, height = this.H, D = 40;
    this.add.rectangle(width / 2, height / 2, width, height, UI.C.bg, 1).setInteractive().setDepth(D);
    UI.backdrop(this).setDepth(D);
    const accent = won ? UI.C.green : UI.C.red;
    UI.text(this, width / 2, 80, won ? 'RAID WON' : retreated ? 'RETREAT' : 'RAID FAILED', 'hero', { size: 42, origin: 0.5, color: UI.hex(accent), depth: D + 1 });
    UI.text(this, width / 2, 118, won ? 'Their core is scrap. Load the carts.' : 'The convoy turns for home.', 'body', { size: 14, origin: 0.5, depth: D + 1 });
    let y = 160;
    const card = (title, text, colour) => {
      const body = UI.text(this, 32, 0, text, 'body', { size: 13, wrap: width - 64, depth: D + 2 });
      const h = 40 + body.height + 14;
      UI.panel(this, width / 2, y + h / 2, width - 32, h, { fill: UI.C.surface, stroke: colour, strokeAlpha: 0.6, accent: colour, radius: 14, depth: D + 1 });
      UI.text(this, 32, y + 20, title, 'tag', { size: 11, origin: [0, 0.5], color: UI.hex(colour), depth: D + 2 });
      body.setY(y + 36); y += h + 10;
    };
    const lostList = Object.entries(this.lost).filter(([, n]) => n).map(([t, n]) => n + ' ' + this.titleCase(TOWER_DATA[t].name) + (n === 1 ? '' : 's'));
    card('CONVOY', lostList.length ? 'Lost: ' + lostList.join(', ') + '.\nEverything else came home.' : 'Every cart came home.', UI.C.blue);
    if (won) {
      card('LOOT', '+' + (loot.plasticScrap || 0) + ' Plastic Scrap\n+' + (loot.salvagedMetal || 0) + ' Salvaged Metal\n+' + bolts + ' Bolt' + (bolts === 1 ? '' : 's') + ' for the Uplink', UI.C.green);
      const unlocks = firstClear ? Progress.unlocksAt(key).map(u => u.label) : [];
      if (unlocks.length) card('UNLOCKED', unlocks.join('\n'), UI.C.amber);
    } else {
      card('TRY THIS', 'Lead with a Barricade cart — turrets shoot it first while the guns behind it work. Grab salvage from wrecked turrets and REPAIR when the convoy is hurting.', UI.C.amber);
    }
    const by = height - 46;
    UI.button(this, 16 + 80, by, 160, 54, { label: 'BASE', variant: 'secondary', depth: D + 3, onTap: () => UI.go(this, 'BaseScene') });
    UI.button(this, width - 16 - (width - 32 - 172) / 2, by, width - 32 - 172, 54, {
      label: won ? 'TO THE DOCK' : 'RETRY', variant: 'primary', colour: won ? UI.C.green : UI.C.amber, depth: D + 3,
      onTap: () => won ? UI.go(this, 'DockScene') : UI.go(this, 'RaidScene', { storylineId: this.storylineId, levelId: this.levelId, levelData: this.levelData })
    });
    if (won && Story.has(key + '.after')) this.time.delayedCall(700, () => Story.play(this, key + '.after'));
  }
}
