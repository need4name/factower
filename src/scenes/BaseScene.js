class BaseScene extends Phaser.Scene {
constructor() {
  super({ key: 'BaseScene' });
}

create() {
  const { width } = this.scale;
  this.saveData = SaveManager.load() || {};
  UI.backdrop(this);
  UI.fadeIn(this);

  // ── Derive unlock states ──────────────────────────────────────────────────
  if (!this.saveData.flags) this.saveData.flags = {};
  const s = this.saveData;

  const stock           = s.stockpile || {};
  const stockTotal      = Object.values(stock).reduce((a, b) => a + b, 0);
  const completed       = (s.completedLevels && s.completedLevels.storyline1) || [];
  const allCompleted    = Array.isArray(s.completedLevels) ? s.completedLevels : Object.values(s.completedLevels || {}).flat();

  // Progression gates: Factory first. Armoury + Dock open once a tower exists
  // (or a level was won). Uplink + Marketplace open after the first victory.
  const hasBuiltTower   = stockTotal > 0 || allCompleted.length > 0;
  const hasCompletedAny = allCompleted.length > 0;

  const armouryUnlocked     = s.flags.armouryUnlocked     || hasBuiltTower;
  // Uplink and Market open with the story (see progression.js)
  const uplinkUnlocked      = Progress.has(s, 'uplink');
  const marketplaceUnlocked = Progress.has(s, 'market');

  let flagsDirty = false;
  if (armouryUnlocked     && !s.flags.armouryUnlocked)     { s.flags.armouryUnlocked     = true; flagsDirty = true; }
  if (uplinkUnlocked      && !s.flags.skillTreeUnlocked)   { s.flags.skillTreeUnlocked   = true; flagsDirty = true; }
  if (marketplaceUnlocked && !s.flags.marketplaceUnlocked) { s.flags.marketplaceUnlocked = true; flagsDirty = true; }
  if (!s.flags.baseTutDone) { s.flags.baseTutDone = true; flagsDirty = true; }
  if (flagsDirty) SaveManager.update(latest => { latest.flags = Object.assign(latest.flags || {}, s.flags); });

  // ── Header ────────────────────────────────────────────────────────────────
  UI.header(this, {
    title: 'YOUR ISLAND', sub: s.playerName || 'THE PIRATE KING',
    onBack: () => UI.go(this, 'SaveScene'),
    chips: [{ kind: 'nuts', value: s.nuts || 0 }, { kind: 'bolts', value: s.bolts || 0 }]
  });

  // ── Next step ─────────────────────────────────────────────────────────────
  const goal = this.nextGoal(stockTotal, completed);
  this.drawGoalCard(goal, 116);

  // ── Zones ─────────────────────────────────────────────────────────────────
  const nextLevel = this.nextPlayable();
  const scrap = (s.materials && s.materials.plasticScrap) || 0;
  const metal = (s.materials && s.materials.salvagedMetal) || 0;
  const zones = [
    { key: 'FactoryScene', name: 'Factory', icon: 'factory', colour: UI.C.blue, unlocked: true,
      info: scrap + ' scrap  ·  ' + metal + ' metal' },
    { key: 'DockScene', name: 'Dock', icon: 'anchor', colour: UI.C.red, unlocked: armouryUnlocked,
      info: nextLevel ? 'Next: ' + this.titleCase(nextLevel.level.name) : 'More story soon', lock: 'Build a tower first' },
    { key: 'ArmouryScene', name: 'Armoury', icon: 'shield', colour: UI.C.green, unlocked: armouryUnlocked,
      info: stockTotal + ' tower' + (stockTotal === 1 ? '' : 's') + ' ready', lock: 'Build a tower first' },
    { key: 'SkillTreeScene', name: 'Uplink', icon: 'signal', colour: UI.C.amber, unlocked: uplinkUnlocked,
      info: (s.bolts || 0) + ' bolts to spend', lock: 'After ' + Progress.levelName(UNLOCKS.uplink.at) },
    { key: 'MarketplaceScene', name: 'Market', icon: 'coins', colour: UI.C.purple, unlocked: marketplaceUnlocked,
      info: this.marketInfo(s), lock: 'After ' + Progress.levelName(UNLOCKS.market.at) },
    { key: null, name: 'Housing', icon: 'house', colour: UI.C.steel, unlocked: false,
      info: '', lock: 'Later in the story' }
  ];

  // The island keeps a fixed place at the bottom so buildings don't move
  // between visits; only an unusually long goal card pushes it down
  const islandBottom = this.scale.height - 12;
  this.drawIsland(zones, Math.max(islandBottom - 470, 116 + this.goalH + 14), islandBottom, goal.scene);

  // First visit to a new save: how you washed up here
  if (Story.has('intro')) this.time.delayedCall(250, () => Story.play(this, 'intro'));
}

marketInfo(s) {
  const met = (s.flags && s.flags.merchantsMet) || {};
  const here = Merchants.list().filter(m => Merchants.isRecruited(s, m.id));
  if (here.some(m => !met[m.id])) return 'New merchant in town!';
  return here.length + ' merchant' + (here.length === 1 ? '' : 's') + '  ·  sell towers for nuts';
}

// The first level, across all storylines in order, that can be played and
// hasn't been won yet: { storylineId, level, key }
nextPlayable() {
  for (const st of LEVEL_DATA.storylines) {
    for (const l of st.levels) {
      const key = Progress.key(st.id, l.id);
      if (Progress.done(this.saveData, key)) continue;
      if (!Progress.levelLock(this.saveData, st.id, l)) return { storylineId: st.id, level: l, key };
    }
  }
  return null;
}

titleCase(str) {
  return UI.titleCase(str);
}

// What should the player do next? Drives the card at the top of the hub so a
// new player is never left guessing.
nextGoal(stockTotal, completed) {
  const factoryDone = this.saveData.factory && this.saveData.factory.tutorialComplete;
  const np   = this.nextPlayable();
  const next = np && np.level;

  if (!factoryDone && stockTotal === 0 && completed.length === 0) {
    return { tag: 'START HERE', title: 'Build your first towers',
      body: 'Raiders are coming. Head to the Factory, where your worker turns scrap into defence towers.',
      scene: 'FactoryScene', cta: 'GO TO FACTORY', colour: UI.C.blue };
  }
  const need = next && next.recommendedTowers ? next.recommendedTowers : 0;
  if (completed.length === 0 && stockTotal > 0 && stockTotal < need) {
    const more = need - stockTotal;
    return { tag: 'ALMOST READY', title: 'Build ' + more + ' more Gunner' + (more === 1 ? '' : 's'),
      body: 'The first raid needs at least ' + need + ' towers to hold. Build another in the Factory, then head to the Dock.',
      scene: 'FactoryScene', cta: 'GO TO FACTORY', colour: UI.C.blue };
  }
  if (completed.length > 0 && next && next.type !== 'raid' && stockTotal > 0 && stockTotal < need) {
    const more = need - stockTotal;
    return { tag: 'BUILD UP', title: 'Build ' + more + ' more tower' + (more === 1 ? '' : 's'),
      body: this.titleCase(next.name) + ' calls for about ' + need + ' towers. You have ' + stockTotal + '.',
      scene: 'FactoryScene', cta: 'GO TO FACTORY', colour: UI.C.blue };
  }
  if (stockTotal === 0) {
    return { tag: 'OUT OF TOWERS', title: 'Restock the Armoury',
      body: 'Towers are used up in battle. Build more in the Factory before you sail.',
      scene: 'FactoryScene', cta: 'GO TO FACTORY', colour: UI.C.blue };
  }
  if (next) {
    return { tag: (np.storylineId === 1 ? 'PROLOGUE' : Progress.storyline(np.storylineId).short.toUpperCase()) + ' \u00b7 ' + (next.type === 'raid' ? 'RAID' : 'LEVEL ' + next.id),
      title: this.titleCase(next.name),
      body: next.description + '  You have ' + stockTotal + ' tower' + (stockTotal === 1 ? '' : 's') + ' ready.',
      scene: 'DockScene', cta: 'TO THE DOCK', colour: UI.C.red };
  }
  return { tag: 'TO BE CONTINUED', title: 'More story is on its way',
    body: 'You\u2019ve played everything built so far. Endless raids at the Dock keep your defences sharp.',
    scene: 'DockScene', cta: 'TO THE DOCK', colour: UI.C.red };
}

drawGoalCard(goal, top) {
  const { width } = this.scale;
  const w = width - 32, lx = 16 + 20;
  const tagT   = UI.text(this, lx, 0, goal.tag, 'tag', { size: 11, color: UI.hex(goal.colour) });
  const titleT = UI.text(this, lx, 0, goal.title, 'heading', { size: 20, wrap: w - 40 });
  const bodyT  = UI.text(this, lx, 0, goal.body, 'body', { size: 13, wrap: w - 40 });
  const h = 18 + 18 + titleT.height + 6 + bodyT.height + 16 + 46 + 18;
  this.goalH = h;
  const cy = top + h / 2;
  const panel = UI.panel(this, width / 2, cy, w, h, { fill: UI.C.surface, stroke: goal.colour, strokeAlpha: 0.6, radius: 16, glow: goal.colour });
  panel.setDepth(0);
  let y = top + 18;
  tagT.setY(y).setDepth(1);     y += 18;
  titleT.setY(y).setDepth(1);   y += titleT.height + 6;
  bodyT.setY(y).setDepth(1);    y += bodyT.height + 16;
  UI.button(this, width / 2, y + 23, w - 40, 46, {
    label: goal.cta, variant: 'primary', colour: goal.colour, depth: 1,
    onTap: () => UI.go(this, goal.scene)
  });
}

// The home raft seen from above: buildings around the dead Tianxia turbine,
// each one a way into its part of the game
drawIsland(zones, top, bottom, nextKey) {
  const { width } = this.scale;
  Art.ensure(this);
  const L = 12, W = width - 24, H = bottom - top, R = Art.RES;
  const X = f => L + f * W, Y = f => top + f * H;
  // Sea
  const sea = this.add.graphics().setDepth(-3);
  sea.fillStyle(0x0d2f40, 1); sea.fillRoundedRect(L, top, W, H, 18);
  const maskG = this.make.graphics({ add: false }); maskG.fillStyle(0xffffff, 1); maskG.fillRoundedRect(L, top, W, H, 18);
  this.seaFx = this.add.tileSprite(L + W / 2, top + H / 2, W * R, H * R, 'water').setScale(1 / R).setTint(0x7fc4dc).setAlpha(0.25)
    .setDepth(-2.9).setMask(maskG.createGeometryMask());
  // The raft: decking clipped to an uneven outline, with a dark rim and tyres
  const outline = [[0.07, 0.07], [0.42, 0.03], [0.93, 0.08], [0.96, 0.4], [0.92, 0.72], [0.62, 0.74], [0.6, 0.93], [0.08, 0.92], [0.03, 0.55]]
    .map(([fx, fy]) => new Phaser.Geom.Point(X(fx), Y(fy)));
  const rim = this.add.graphics().setDepth(-2.5);
  rim.fillStyle(0x0b1820, 1); rim.fillPoints(outline.map(p => new Phaser.Geom.Point(p.x + 2, p.y + 4)), true);
  const deckMask = this.make.graphics({ add: false }); deckMask.fillStyle(0xffffff, 1); deckMask.fillPoints(outline, true);
  this.add.tileSprite(L + W / 2, top + H / 2, W * R, H * R, 'deck_1').setScale(1 / R).setDepth(-2.4).setMask(deckMask.createGeometryMask());
  const edge = this.add.graphics().setDepth(-2.3);
  edge.lineStyle(3, 0x1c232c, 1); edge.strokePoints(outline, true);
  outline.forEach((a, i) => {
    const b = outline[(i + 1) % outline.length], len = Math.hypot(b.x - a.x, b.y - a.y);
    for (let d = 14; d < len - 8; d += 30) {
      const t = d / len, x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
      edge.fillStyle(0x0d1116, 1); edge.fillCircle(x, y, 4.5); edge.lineStyle(1.5, 0x3a4452, 1); edge.strokeCircle(x, y, 2.8);
    }
  });
  // Pier out to open water, with your barge tied up
  const pier = this.add.graphics().setDepth(-2.2);
  pier.fillStyle(0x5a4a3a, 1); pier.fillRect(X(0.72) - 11, Y(0.7), 22, Y(0.97) - Y(0.7));
  pier.lineStyle(1, 0x3a2e22, 1); for (let y = Y(0.7) + 6; y < Y(0.97); y += 7) pier.lineBetween(X(0.72) - 11, y, X(0.72) + 11, y);
  pier.fillStyle(0x2a2016, 1); [Y(0.76), Y(0.86), Y(0.95)].forEach(y => { pier.fillCircle(X(0.72) - 12, y, 3); pier.fillCircle(X(0.72) + 12, y, 3); });
  this.add.image(X(0.85), Y(0.86), 'barge').setScale(1 / R).setRotation(-Math.PI / 2).setDepth(-2.1);

  // Turbine in the middle; the rotor still turns in the wind
  this.add.image(X(0.5), Y(0.43), 'turbine_base').setScale(1 / R).setDepth(-1);
  const rotor = this.add.image(X(0.5), Y(0.43), 'turbine_rotor').setScale(0.55 / R).setDepth(3).setAlpha(0.92);
  this.tweens.add({ targets: rotor, angle: 360, duration: 26000, repeat: -1 });

  const spots = {
    FactoryScene:     { fx: 0.26, fy: 0.15, tex: 'bld_factory' },
    ArmouryScene:     { fx: 0.75, fy: 0.15, tex: 'bld_armoury' },
    MarketplaceScene: { fx: 0.2,  fy: 0.47, tex: 'bld_market' },
    SkillTreeScene:   { fx: 0.8,  fy: 0.4,  tex: 'bld_uplink' },
    null:             { fx: 0.25, fy: 0.76, tex: 'bld_housing' },
    DockScene:        { fx: 0.72, fy: 0.66, tex: null }
  };
  this.zoneSpots = [];
  zones.forEach(z => {
    const sp = spots[z.key];
    if (!sp) return;
    const x = X(sp.fx), y = Y(sp.fy);
    this.drawBuilding(z, sp, x, y, z.key === nextKey);
    if (z.key) this.zoneSpots.push({ key: z.key, x, y });
  });

  // Smoke from the factory chimney
  const chim = { x: X(0.26) + 17, y: Y(0.15) - 21 };
  this.add.particles(chim.x, chim.y, 'fx_dot', { lifespan: 2200, speedY: { min: -16, max: -10 }, speedX: { min: 2, max: 8 },
    scale: { start: 0.5, end: 1.8 }, alpha: { start: 0.35, end: 0 }, tint: 0x8a96a6, frequency: 380 }).setDepth(4);
}

// A building, its name plate and its tap area
drawBuilding(z, sp, x, y, recommended) {
  const R = Art.RES;
  if (sp.tex) {
    const img = this.add.image(x, y, sp.tex).setScale(1 / R).setDepth(1);
    if (!z.unlocked) img.setTint(0x4a525e).setAlpha(0.85);
  }
  // Name plate under the building (the Dock's sits on the pier)
  const py = sp.tex ? y + 44 : y;
  const name = UI.text(this, x, py - 8, z.name, 'heading', { size: 14, origin: 0.5, depth: 6, color: z.unlocked ? UI.T.text : UI.T.faint });
  const info = UI.text(this, x, py + 2, z.unlocked ? z.info : z.lock, 'small', { size: 10.5, origin: [0.5, 0], depth: 6, color: z.unlocked ? UI.T.mute : UI.T.faint, wrap: 132, align: 'center' });
  const pw = Math.max(name.width + (z.unlocked ? 0 : 24), info.width) + 22, ph = 28 + info.height, pcy = py - 18 + ph / 2;
  const plate = this.add.graphics().setDepth(5);
  UI.drawPanel(plate, x, pcy, pw, ph, { fill: 0x0d131a, stroke: recommended ? z.colour : (z.unlocked ? z.colour : UI.C.lineSoft),
    strokeAlpha: recommended ? 1 : (z.unlocked ? 0.45 : 1), radius: 10 });
  plate.setAlpha(0.94);
  if (!z.unlocked) UI.icon(this, x - name.width / 2 - 12, py - 8, 'lock', 10, 0x6f7b8d).setDepth(6);

  if (recommended) {
    if (sp.tex) {
      const ring = this.add.circle(x, y, 38, z.colour, 0).setStrokeStyle(3, z.colour, 0.9).setDepth(0.5);
      this.tweens.add({ targets: ring, scale: 1.25, alpha: 0, duration: 1200, repeat: -1 });
    }
    const tag = UI.text(this, x + pw / 2 - 4, pcy - ph / 2 - 2, 'NEXT', 'tag', { size: 9, origin: [1, 1], depth: 7, color: UI.T.dark })
      .setBackgroundColor(UI.hex(z.colour)).setPadding(5, 2, 5, 2);
    this.tweens.add({ targets: tag, alpha: 0.35, duration: 700, yoyo: true, repeat: -1 });
  }

  if (!z.unlocked || !z.key) return;
  const top = sp.tex ? y - 34 : y - 50, bottom = pcy + ph / 2;
  const zone = this.add.zone(x, (top + bottom) / 2, 130, bottom - top).setInteractive().setDepth(8);
  let pressed = false;
  zone.on('pointerdown', () => { pressed = true; plate.setAlpha(0.7); });
  zone.on('pointerout',  () => { pressed = false; plate.setAlpha(0.94); });
  zone.on('pointerup',   () => { plate.setAlpha(0.94); if (pressed && !UI.blocked(this)) UI.go(this, z.key); pressed = false; });
}

update(time, delta) {
  if (this.seaFx) { this.seaFx.tilePositionX += delta * 0.008; this.seaFx.tilePositionY -= delta * 0.012; }
}
}
