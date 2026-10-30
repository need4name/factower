// ── ManualScene ───────────────────────────────────────────────────────────────
// The Field Manual: a reference the player can reopen any time. Topics appear
// as their mechanics unlock, so it never spoils what's ahead; the raider
// guide only lists boats you've already met (their intro cards, collected).

class ManualScene extends Phaser.Scene {
  constructor() { super({ key: 'ManualScene' }); }

  create() {
    this.saveData = SaveManager.load() || {};
    this.scrollY = 0; this.scrollMin = 0;
    UI.backdrop(this);
    UI.fadeIn(this);
    Art.ensure(this);
    // Everything below the header lives in one container, clipped to the
    // area under the header, and scrolls as a whole
    const { width, height } = this.scale;
    const clip = this.make.graphics({ add: false });
    clip.fillStyle(0xffffff, 1); clip.fillRect(0, UI.HEADER_H, width, height - UI.HEADER_H);
    this.content = this.add.container(0, 0).setDepth(5).setMask(clip.createGeometryMask());
    this.hdr = UI.header(this, {
      title: 'FIELD MANUAL', sub: 'HOW THINGS WORK ON THE RAFT', accent: UI.C.amber,
      onBack: () => this.view === 'topic' ? this.showIndex() : UI.go(this, 'BaseScene')
    });
    this.enableScroll();
    this.showIndex();
  }

  // ── Topics ──────────────────────────────────────────────────────────────
  // Each: { key, title, icon, colour, open (bool), lock (text), body () => [blocks] }
  // A block is a string (paragraph), ['h', text] (heading) or
  // ['tower', type] / ['raider', type] (art + text card).
  topics() {
    const s = this.saveData, has = f => Progress.has(s, f);
    const seen = s.seenEnemies || {};
    const towers = TOWER_ORDER.filter(t => t === 'gunner' || has(t) || ((s.stockpile || {})[t] || 0) > 0);
    const raiders = Object.keys(ENEMY_DATA).filter(t => seen[t] || t === 'saltChild');
    const raided = Progress.done(s, 'p4');
    return [
      { key: 'basics', title: 'Holding the raft', icon: 'shield', colour: UI.C.blue, open: true, body: () => [
        'Raiders sail the channels from RAIDERS ENTER down to YOUR BASE. Every boat that gets through costs base HP. Lose it all and the battle is lost.',
        'Pick a tower at the bottom of the screen, then tap the decking beside a channel to place it. The ring shows its range; the coverage meter shows how much channel it can reach. Bends where a channel doubles back are the best spots.',
        'Press START when you’re ready. Between waves you can place more towers. Once a wave is under way, EARLY calls the next one in for bonus Parts.',
        ['h', 'Towers are used up'],
        'Every tower you place is spent when the battle ends — win or lose it’s gone, so build in the Factory between battles. If you lose, the towers you placed go back to the Armoury so you can retry straight away.',
        'Each mission’s briefing says how many towers it’s tuned for. Bring at least that many.',
        ['h', 'Speed and targets'],
        'The 1× / 2× button speeds the battle up. Tap a placed tower to choose what it shoots: the FIRST raider on the channel, the LAST, the STRONGEST or the CLOSEST.'
      ] },
      { key: 'towers', title: 'Towers', icon: 'shield', colour: UI.C.green, open: true, body: () =>
        [ 'Each tower has a job. Mix them: one type alone has a weakness some raider will find.' ].concat(towers.map(t => ['tower', t])) },
      { key: 'raiders', title: 'Raiders you’ve met', icon: 'anchor', colour: UI.C.red, open: true, body: () =>
        [ 'Every boat you meet is logged here, with what beats it.' ].concat(raiders.map(t => ['raider', t])) },
      { key: 'salvage', title: 'Salvage & mods', icon: 'gear', colour: UI.C.amber, open: has('mods'), lock: 'Opens after ' + Progress.levelName(UNLOCKS.mods.at), body: () => [
        'Wrecks leave salvage floating on the water. Tap it before it sinks (it blinks first) to collect Parts.',
        'Tap a placed tower to spend Parts on scavenger mods. Every tower has three mod paths with three tiers each; any two paths can be taken, so choose what the tower is for.',
        ['h', 'Rare parts'],
        'Elite boats leave rare parts: Hull Plates and Engines. Tier-three mods need one as well as Parts.',
        has('siphon') ? 'Raiders that die in a Siphon’s beam drop double salvage, collected automatically.' : null
      ] },
      { key: 'abilities', title: 'Flares & nets', icon: 'star', colour: UI.C.amber, open: has('abilities'), lock: 'Opens after ' + Progress.levelName(UNLOCKS.abilities.at), body: () => [
        'The two round buttons in battle are your own weapons. Tap one, then tap the channel.',
        ['h', 'Flare'],
        'A whistle, then a blast that hits everything in a small circle and ignores some armour. Ready again after 25 seconds.',
        ['h', 'Cargo net'],
        'Raiders inside the net barely move for a few seconds — perfect for holding a pack in front of your Bombers. Ready again after 20 seconds.'
      ] },
      { key: 'raids', title: 'Raids', icon: 'anchor', colour: UI.C.red, open: raided || Progress.done(s, 'p3'), lock: 'Opens after ' + Progress.levelName('p3'), body: () => [
        'Some missions are raids: you attack instead of defend. Your towers ride barges down the channel toward the enemy core while their turrets shoot at them.',
        'Tap a tower at the bottom to send it. One barge leaves at a time. Barges fire as they go, then attack the core when they reach it.',
        ['h', 'Keeping the convoy alive'],
        'Turrets shoot Barricades first, so send one ahead to soak the fire. Siphon barges patch up the barge in front of them.',
        'REPAIR spends 10 Parts to mend every barge by half. Collect salvage from wrecked turrets to afford more.',
        'Only barges that are wrecked are lost. Whatever survives comes home, and a won raid pays loot.'
      ] },
      { key: 'factory', title: 'The Factory', icon: 'factory', colour: UI.C.blue, open: true, body: () => [
        'Towers are built in the Factory, one material each. Build a bench for each tower type, then give your workers jobs.',
        ['h', 'Workers'],
        'Tap a station (a store, a bench, the Depository) to give a worker a job there. A worker remembers one route, from A to B: fetch scrap from the store and build at the bench, or carry towers to the Depository. Uplink upgrades let routes have more stops.',
        'If a worker has to put something down that doesn’t fit, it goes in the Lost & Found.',
        ['h', 'Materials'],
        'Gunners are built from Plastic Scrap.' + (has('metal') ? ' Barricades' + (has('gunner2') ? ' and Mk IIs' : '') + ' take Salvaged Metal.' : '') +
          (has('smelter') ? ' Bombers' + (has('siphon') ? ' and Siphons' : '') + ' need Refined Plastic: load a Smelter with scrap and it refines it by itself.' : ''),
        has('belts') ? ['h', 'Belts'] : null,
        has('belts') ? 'Belts move items without workers. A belt under a store is fed from it; a belt pointing into a machine loads it; a bottom-row belt pointing down delivers to the Depository. Hold a belt to turn it.' : null,
        ['h', 'While you’re away'],
        'The factory keeps running when you’re out of it (but not during battles), and catches up when you come back.'
      ] },
      { key: 'economy', title: 'Materials & rewards', icon: 'scrap', colour: UI.C.green, open: true, body: () => [
        'Every tower costs one material, so materials are your tower budget.',
        'Winning a mission for the first time pays enough for roughly the next mission’s towers. Replays pay half. Sinking raiders adds a little scrap (one per 15), bosses drop more, and raids pay loot.',
        'Wins also pay bolts — more for a first clear.',
        has('market') ? 'Short of nuts or bolts? See the Market.' : null
      ] },
      { key: 'market', title: 'Market & Uplink', icon: 'coins', colour: UI.C.purple, open: has('market') || has('uplink'), lock: 'Opens after ' + Progress.levelName(UNLOCKS.market.at), body: () => [
        has('market') ? ['h', 'Market'] : null,
        has('market') ? 'Sell spare towers for nuts at the trade counter. Stake nuts with a merchant for a chance at bolts. Merchants tire the more you play; they rest after every battle you win.' : null,
        has('uplink') ? ['h', 'Uplink'] : null,
        has('uplink') ? 'Spend bolts on permanent upgrades: faster factories, longer worker routes, a tougher base and better odds with the merchants.' : null
      ] }
    ];
  }

  // ── Views ───────────────────────────────────────────────────────────────
  clear() { this.content.removeAll(true); this.scrollY = 0; this.applyScroll(); }
  keep(o) { this.content.add(o); return o; }

  showIndex() {
    this.clear();
    this.view = 'index';
    this.hdr.title.setText('FIELD MANUAL');
    const { width, height } = this.scale;
    let y = UI.HEADER_H + 16;
    this.topics().forEach(t => {
      const h = 64, cy = y + h / 2;
      const panel = this.keep(UI.panel(this, width / 2, cy, width - 32, h, { fill: t.open ? UI.C.surface : 0x10151c, stroke: t.open ? t.colour : UI.C.lineSoft,
        strokeAlpha: t.open ? 0.45 : 1, accent: t.open ? t.colour : undefined, radius: 14 }));
      this.keep(UI.icon(this, 44, cy, t.open ? t.icon : 'lock', 16, t.open ? t.colour : 0x465163));
      this.keep(UI.text(this, 70, cy - (t.open ? 0 : 9), t.title, 'heading', { size: 16, origin: [0, 0.5], color: t.open ? UI.T.text : UI.T.faint }));
      if (!t.open) this.keep(UI.text(this, 70, cy + 11, t.lock, 'small', { size: 11, origin: [0, 0.5], color: UI.T.faint }));
      if (t.open) {
        this.keep(UI.icon(this, width - 16 - 22, cy, 'chevron', 13, 0x6f7b8d));
        const z = this.keep(this.add.zone(width / 2, cy, width - 32, h).setInteractive());
        let pressed = false;
        z.on('pointerdown', () => { pressed = true; panel.setAlpha(0.8); });
        z.on('pointerout', () => { pressed = false; panel.setAlpha(1); });
        z.on('pointerup', () => { panel.setAlpha(1); if (pressed && !this._dragging) { Sfx.play('tap'); this.showTopic(t); } pressed = false; });
      }
      y += h + 10;
    });
    this.scrollMin = Math.min(0, height - (y + 16));
  }

  showTopic(t) {
    this.clear();
    this.view = 'topic';
    this.hdr.title.setText(t.title.toUpperCase());
    const { width, height } = this.scale;
    const lx = 24, wrap = width - 48;
    let y = UI.HEADER_H + 18;
    t.body().filter(Boolean).forEach(b => {
      if (typeof b === 'string') {
        const tx = this.keep(UI.text(this, lx, y, b, 'body', { size: 14, wrap, color: UI.T.dim, lineSpacing: 5 }));
        y += tx.height + 12;
      } else if (b[0] === 'h') {
        y += 6;
        this.keep(UI.text(this, lx, y, b[1].toUpperCase(), 'tag', { size: 12, color: UI.hex(t.colour) }));
        y += 24;
      } else if (b[0] === 'tower') {
        y = this.towerCard(b[1], y) + 10;
      } else if (b[0] === 'raider') {
        y = this.raiderCard(b[1], y) + 10;
      }
    });
    this.scrollMin = Math.min(0, height - (y + 24));
  }

  towerCard(type, top) {
    const { width } = this.scale;
    const d = TOWER_DATA[type];
    const body = UI.text(this, 84, top + 36, TOWER_ROLE[type] || '', 'small', { size: 12.5, wrap: width - 84 - 32, color: UI.T.mute });
    const h = Math.max(76, 36 + body.height + 14);
    this.keep(UI.panel(this, width / 2, top + h / 2, width - 32, h, { fill: UI.C.surface, stroke: d.colour, strokeAlpha: 0.4, radius: 14 })).setDepth(0);
    const art = Art.tower(this, 50, top + h / 2, type);
    art.base.setDepth(1); art.head.setDepth(1).setRotation(-Math.PI / 2);
    this.keep(art.base); this.keep(art.head);
    this.keep(UI.text(this, 84, top + 16, UI.titleCase(d.name), 'heading', { size: 16, color: UI.hex(d.colour) }).setDepth(1));
    this.keep(body.setDepth(1));
    return top + h;
  }

  raiderCard(type, top) {
    const { width } = this.scale;
    const d = ENEMY_DATA[type], c = d.card || { title: UI.titleCase(d.name), trait: 'RAIDER', body: '' };
    const body = UI.text(this, 96, top + 52, c.body, 'small', { size: 12.5, wrap: width - 96 - 32, color: UI.T.mute });
    const h = Math.max(84, 52 + body.height + 14);
    this.keep(UI.panel(this, width / 2, top + h / 2, width - 32, h, { fill: UI.C.surface, stroke: d.colour, strokeAlpha: 0.4, radius: 14 })).setDepth(0);
    const boat = Art.boat(this, 56, top + h / 2, type).setDepth(1).setRotation(-Math.PI / 2);
    const fit = 56 / Math.max(boat.displayWidth, boat.displayHeight);
    if (fit < 1) boat.setScale(boat.scale * fit);
    this.keep(boat);
    this.keep(UI.text(this, 96, top + 16, c.title, 'heading', { size: 16 }).setDepth(1));
    this.keep(UI.text(this, 96, top + 36, c.trait, 'tag', { size: 10.5, color: UI.hex(d.colour) }).setDepth(1));
    this.keep(body.setDepth(1));
    return top + h;
  }

  // ── Drag to scroll (everything below the header moves) ─────────────────
  enableScroll() {
    let startY = null, startScroll = 0;
    this.input.on('pointerdown', p => { startY = p.y; startScroll = this.scrollY; this._dragging = false; });
    this.input.on('pointermove', p => {
      if (startY === null || !p.isDown) return;
      if (Math.abs(p.y - startY) > 8) this._dragging = true;
      if (this._dragging) { this.scrollY = Phaser.Math.Clamp(startScroll + (p.y - startY), this.scrollMin, 0); this.applyScroll(); }
    });
    this.input.on('pointerup', () => { startY = null; this.time.delayedCall(0, () => { this._dragging = false; }); });
  }

  applyScroll() { this.content.y = this.scrollY; }
}
