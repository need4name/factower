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
  const uplinkUnlocked      = s.flags.skillTreeUnlocked   || hasCompletedAny;
  const marketplaceUnlocked = s.flags.marketplaceUnlocked || hasCompletedAny;

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
  const nextLevel = LEVEL_DATA.storylines[0].levels.find(l => !completed.includes(l.id));
  const scrap = (s.materials && s.materials.plasticScrap) || 0;
  const metal = (s.materials && s.materials.salvagedMetal) || 0;
  const zones = [
    { key: 'FactoryScene', name: 'Factory', icon: 'factory', colour: UI.C.blue, unlocked: true,
      info: scrap + ' scrap  ·  ' + metal + ' metal' },
    { key: 'DockScene', name: 'Dock', icon: 'anchor', colour: UI.C.red, unlocked: armouryUnlocked,
      info: nextLevel ? 'Next: ' + this.titleCase(nextLevel.name) : 'Campaign clear', lock: 'Build a tower first' },
    { key: 'ArmouryScene', name: 'Armoury', icon: 'shield', colour: UI.C.green, unlocked: armouryUnlocked,
      info: stockTotal + ' tower' + (stockTotal === 1 ? '' : 's') + ' ready', lock: 'Build a tower first' },
    { key: 'SkillTreeScene', name: 'Uplink', icon: 'signal', colour: UI.C.amber, unlocked: uplinkUnlocked,
      info: (s.bolts || 0) + ' bolts to spend', lock: 'Win a battle first' },
    { key: 'MarketplaceScene', name: 'Market', icon: 'coins', colour: UI.C.purple, unlocked: marketplaceUnlocked,
      info: this.marketInfo(s), lock: 'Win a battle first' },
    { key: null, name: 'Housing', icon: 'house', colour: UI.C.steel, unlocked: false,
      info: '', lock: 'Later in the story' }
  ];

  const cols = 2, gap = 12, tileW = (width - 32 - gap) / 2, tileH = 128;
  const gridTop = 116 + this.goalH + 34;
  UI.text(this, 18, gridTop - 2, 'ISLAND', 'label', { origin: [0, 1], size: 11 });
  zones.forEach((z, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = 16 + tileW / 2 + col * (tileW + gap);
    const y = gridTop + 8 + tileH / 2 + row * (tileH + gap);
    this.drawZoneTile(z, x, y, tileW, tileH, goal.scene === z.key);
  });
}

marketInfo(s) {
  const met = (s.flags && s.flags.merchantsMet) || {};
  const here = Merchants.list().filter(m => Merchants.isRecruited(s, m.id));
  if (here.some(m => !met[m.id])) return 'New merchant in town!';
  return here.length + ' merchant' + (here.length === 1 ? '' : 's') + '  ·  sell towers for nuts';
}

titleCase(str) {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

// What should the player do next? Drives the card at the top of the hub so a
// new player is never left guessing.
nextGoal(stockTotal, completed) {
  const factoryDone = this.saveData.factory && this.saveData.factory.tutorialComplete;
  const levels = LEVEL_DATA.storylines[0].levels;
  const next   = levels.find(l => !completed.includes(l.id));

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
  if (stockTotal === 0) {
    return { tag: 'OUT OF TOWERS', title: 'Restock the Armoury',
      body: 'Towers are used up in battle. Build more in the Factory before you sail.',
      scene: 'FactoryScene', cta: 'GO TO FACTORY', colour: UI.C.blue };
  }
  if (next) {
    return { tag: 'LEVEL ' + next.id, title: this.titleCase(next.name),
      body: next.description + '  You have ' + stockTotal + ' tower' + (stockTotal === 1 ? '' : 's') + ' ready.',
      scene: 'DockScene', cta: 'TO THE DOCK', colour: UI.C.red };
  }
  return { tag: 'CAMPAIGN CLEAR', title: 'Endless waves await',
    body: 'Test your defences against endless raids at the Dock.',
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

drawZoneTile(z, x, y, w, h, recommended) {
  const lx = x - w / 2 + 16;
  const panel = UI.panel(this, x, y, w, h, {
    fill: z.unlocked ? UI.C.surface : 0x10151c,
    stroke: recommended ? z.colour : (z.unlocked ? UI.C.line : UI.C.lineSoft),
    strokeAlpha: recommended ? 0.9 : 1, radius: 14
  });

  // Icon disc
  const iy = y - h / 2 + 34;
  const disc = this.add.graphics();
  disc.fillStyle(z.unlocked ? z.colour : UI.C.surface2, z.unlocked ? 0.16 : 1);
  disc.fillCircle(lx + 18, iy, 18);
  UI.icon(this, lx + 18, iy, z.unlocked ? z.icon : 'lock', 17, z.unlocked ? z.colour : 0x465163);

  UI.text(this, lx, y + 14, z.name, 'heading', { size: 18, origin: [0, 0.5], color: z.unlocked ? UI.T.text : UI.T.faint });
  UI.text(this, lx, y + 38, z.unlocked ? z.info : z.lock, 'small',
    { size: 12, origin: [0, 0.5], wrap: w - 32, color: z.unlocked ? UI.T.mute : UI.T.faint });

  if (recommended) {
    const badge = UI.text(this, x + w / 2 - 14, y - h / 2 + 18, 'NEXT', 'tag', { size: 10, origin: [1, 0.5], color: UI.hex(z.colour) });
    this.tweens.add({ targets: badge, alpha: 0.4, duration: 700, yoyo: true, repeat: -1 });
  }

  if (!z.unlocked || !z.key) return;
  UI.icon(this, x + w / 2 - 20, y + 14, 'chevron', 12, 0x6f7b8d);
  const zone = this.add.zone(x, y, w, h).setInteractive();
  let pressed = false;
  zone.on('pointerdown', () => { pressed = true; panel.setAlpha(0.75); });
  zone.on('pointerout',  () => { pressed = false; panel.setAlpha(1); });
  zone.on('pointerup',   () => { panel.setAlpha(1); if (pressed) UI.go(this, z.key); pressed = false; });
}
}
