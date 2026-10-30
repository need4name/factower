// ── Art.js ────────────────────────────────────────────────────────────────────
// Procedural art: every texture is drawn once with Graphics and cached, so the
// game ships no image files. Textures are drawn at RES× and displayed at 1/RES
// scale so they stay crisp on high-density phone screens.
//
//   Art.ensure(scene)                 build every texture (cheap after the first call)
//   Art.theme(storylineId)            colours for a storyline's maps
//   Art.boat(scene, x, y, type)       an enemy boat image, facing right (rotation 0)
//   Art.tower(scene, x, y, type)      { base, head } images; head faces right
//
// The battle map itself (raft decking with water channels) is drawn by
// CombatScene.drawMap using the deck_* and water textures made here.

const Art = {
  RES: 2,

  // Map palettes per storyline: decking, the water in the channels, and a
  // highlight used for glints and buoys
  THEMES: {
    1: { name: 'dawn',  deck: 0x2b3440, deckAlt: 0x2e3845, seam: 0x1c232c, patch: [0x3f6c86, 0x86603a, 0x5d7a4a],
         water: 0x14445a, waterDeep: 0x0d2f40, glint: 0x7fc4dc, edge: 0x0b1820 },
    2: { name: 'salv',  deck: 0x2a3633, deckAlt: 0x2d3a37, seam: 0x1b2422, patch: [0x2f7d6a, 0x8a6d3b, 0x50606b],
         water: 0x124a47, waterDeep: 0x0b322f, glint: 0x7fdcc4, edge: 0x0a1a18 },
    3: { name: 'dusk',  deck: 0x302c3c, deckAlt: 0x332f40, seam: 0x1f1c28, patch: [0x6a4f8f, 0x8a5a3b, 0x3f6c86],
         water: 0x2a2f5a, waterDeep: 0x1b1f40, glint: 0xb7a8f0, edge: 0x100f1c },
    4: { name: 'night', deck: 0x222a36, deckAlt: 0x252e3a, seam: 0x151b23, patch: [0x2f5f7a, 0x5d4a6e, 0x3a5a4a],
         water: 0x0f2a44, waterDeep: 0x091a2c, glint: 0x7fe3ff, edge: 0x060d16 }
  },

  theme(storylineId) { return Art.THEMES[storylineId] || Art.THEMES[1]; },

  ensure(scene) {
    if (scene.textures.exists('fx_dot')) return;
    Art._fx(scene);
    Object.keys(Art.THEMES).forEach(id => Art._deck(scene, +id));
    Art._water(scene);
    Object.keys(ENEMY_DATA).forEach(t => Art._boat(scene, t));
    Object.keys(TOWER_DATA).forEach(t => Art._tower(scene, t));
    Art._raid(scene);
  },

  // Draw into a temporary Graphics at RES scale and save it as a texture
  _make(scene, key, w, h, draw) {
    const R = Art.RES, g = scene.make.graphics({ x: 0, y: 0, add: false });
    draw(g, R);
    g.generateTexture(key, Math.ceil(w * R), Math.ceil(h * R));
    g.destroy();
  },

  // ── Effects ────────────────────────────────────────────────────────────
  _fx(scene) {
    Art._make(scene, 'fx_dot', 8, 8, (g, R) => { g.fillStyle(0xffffff, 1); g.fillCircle(4 * R, 4 * R, 4 * R); });
    Art._make(scene, 'fx_chip', 4, 4, (g, R) => { g.fillStyle(0xffffff, 1); g.fillRect(0, 0, 4 * R, 4 * R); });
    // Soft ring for splashes
    Art._make(scene, 'fx_ring', 32, 32, (g, R) => { g.lineStyle(2 * R, 0xffffff, 1); g.strokeCircle(16 * R, 16 * R, 14 * R); });
  },

  // ── Raft decking: fused plastic tiles with seams, bolts and patches ───
  _deck(scene, id) {
    const T = Art.THEMES[id], S = 64;
    Art._make(scene, 'deck_' + id, S, S, (g, R) => {
      const s = S * R, h = s / 2;
      g.fillStyle(T.deck, 1); g.fillRect(0, 0, s, s);
      g.fillStyle(T.deckAlt, 1); g.fillRect(0, 0, h, h); g.fillRect(h, h, h, h);
      // Odd scrap patches so the tiling doesn't look mechanical
      g.fillStyle(T.patch[0], 0.16); g.fillRect(6 * R, 38 * R, 14 * R, 9 * R);
      g.fillStyle(T.patch[1], 0.12); g.fillRect(41 * R, 9 * R, 9 * R, 11 * R);
      // Seams
      g.lineStyle(1 * R, T.seam, 1);
      g.strokeRect(0, 0, s, s);
      g.lineBetween(h, 0, h, s); g.lineBetween(0, h, s, h);
      // Grain lines on two tiles
      g.lineStyle(1 * R, T.seam, 0.25);
      [8, 16, 24].forEach(y => g.lineBetween(4 * R, y * R, 28 * R, y * R));
      [40, 48, 56].forEach(x => g.lineBetween(x * R, 36 * R, x * R, 60 * R));
      // Bolts at the tile corners
      g.fillStyle(0x0b0f14, 0.6);
      [[3, 3], [29, 3], [3, 29], [35, 35], [61, 35], [35, 61]].forEach(([x, y]) => g.fillCircle(x * R, y * R, 1.4 * R));
    });
  },

  // Water: white wave strokes on transparent, tinted per theme and tiled
  // over the channel colour; scrolling it makes the channel flow
  _water(scene) {
    const S = 96;
    Art._make(scene, 'water', S, S, (g, R) => {
      g.lineStyle(1.5 * R, 0xffffff, 0.5);
      const wave = (x, y, w) => {
        g.beginPath();
        for (let i = 0; i <= 8; i++) {
          const px = x + (w * i) / 8, py = y + Math.sin((i / 8) * Math.PI * 2) * 2;
          if (i === 0) g.moveTo(px * R, py * R); else g.lineTo(px * R, py * R);
        }
        g.strokePath();
      };
      wave(6, 14, 22); wave(52, 30, 18); wave(20, 54, 26); wave(64, 74, 20); wave(8, 86, 14);
      g.fillStyle(0xffffff, 0.35);
      [[40, 8], [80, 50], [30, 38], [70, 92], [12, 70]].forEach(([x, y]) => g.fillCircle(x * R, y * R, 1 * R));
    });
  },

  // ── Boats ──────────────────────────────────────────────────────────────
  // Each raider is a hull pointing right. Style comes from its faction.
  _boatStyle(type) {
    const d = ENEMY_DATA[type];
    const base = { hull: d.colour, deck: Phaser.Display.Color.ValueToColor(d.colour).darken(25).color, trim: 0x0b0f14,
                   prow: 'point', beam: 0.5, cabin: false, plates: (d.traits || []).includes('armoured'), flag: null, glow: null, mast: false };
    const S = {
      saltChild:      { prow: 'round', beam: 0.55, hull: 0x9aa3ad, deck: 0x6b5a45 },
      scrapRunner:    { prow: 'point', beam: 0.38, hull: 0xe8a020, deck: 0x8a5a14, stripe: 0x1a1a1a },
      bilgeRat:       { prow: 'round', beam: 0.6,  hull: 0x9aa48a, deck: 0x5e6650 },
      driftwoodHulk:  { prow: 'blunt', beam: 0.62, hull: 0x7a6650, deck: 0x5a4a3a, planks: true },
      frontCommander: { prow: 'point', beam: 0.5,  hull: 0xc43a3a, deck: 0x6e2222, cabin: true, flag: 0x1a1a1a, mast: true },
      salvSkiff:      { prow: 'point', beam: 0.4,  hull: 0x3fae8e, deck: 0x22604f, stripe: 0xe8e1c8 },
      salvCutter:     { prow: 'point', beam: 0.48, hull: 0x2f7d6a, deck: 0x1f5246, cabin: true },
      salvRam:        { prow: 'ram',   beam: 0.55, hull: 0x1f5f52, deck: 0x163f37, cabin: true },
      umbajiFlagship: { prow: 'point', beam: 0.46, hull: 0x1b8a64, deck: 0x6b5232, cabin: true, mast: true, flag: 0x52c47f, guns: true },
      helixDrone:     { helix: true, shape: 'dart',  hull: 0xd8e4ea, glow: 0x7fe3ff },
      helixTrooper:   { helix: true, shape: 'pod',   hull: 0x9fb4c2, glow: 0x7fe3ff },
      helixWarden:    { helix: true, shape: 'hex',   hull: 0x5fd0e6, glow: 0xe8fbff },
      helixSpearhead: { helix: true, shape: 'arrow', hull: 0x2fb6d6, glow: 0xe8fbff }
    }[type] || {};
    return Object.assign(base, S);
  },

  _boat(scene, type) {
    const d = ENEMY_DATA[type], st = Art._boatStyle(type);
    const L = Math.round(d.size * 2.8), B = Math.max(8, Math.round(L * (st.beam || 0.5)));
    const pad = 4, W = L + pad * 2, H = B + pad * 2;
    Art._make(scene, 'boat_' + type, W, H, (g, R) => {
      const x0 = pad * R, cy = (H / 2) * R, l = L * R, b = B * R, hb = b / 2;
      const P = (pts) => pts.map(([x, y]) => new Phaser.Geom.Point(x0 + x * l, cy + y * hb));
      if (st.helix) return Art._helixHull(g, R, x0, cy, l, hb, st);
      // Hull outline by prow shape (x 0..1 stern→bow, y -1..1)
      const shapes = {
        point: [[0, -0.85], [0.62, -1], [0.86, -0.7], [1, 0], [0.86, 0.7], [0.62, 1], [0, 0.85]],
        round: [[0, -0.8], [0.7, -1], [0.95, -0.55], [1, 0], [0.95, 0.55], [0.7, 1], [0, 0.8]],
        blunt: [[0, -1], [0.9, -1], [1, -0.6], [1, 0.6], [0.9, 1], [0, 1]],
        ram:   [[0, -0.9], [0.7, -1], [0.82, -0.55], [1, -0.18], [1, 0.18], [0.82, 0.55], [0.7, 1], [0, 0.9]]
      };
      const hull = P(shapes[st.prow] || shapes.point);
      // Shadow, hull, deck
      g.fillStyle(0x000000, 0.35); g.fillPoints(hull.map(p => new Phaser.Geom.Point(p.x + 1.5 * R, p.y + 2 * R)), true);
      g.fillStyle(st.hull, 1); g.fillPoints(hull, true);
      g.lineStyle(1.2 * R, st.trim, 0.9); g.strokePoints(hull, true);
      const inner = hull.map(p => new Phaser.Geom.Point(x0 + (p.x - x0) * 0.86 + l * 0.05, cy + (p.y - cy) * 0.68));
      g.fillStyle(st.deck, 1); g.fillPoints(inner, true);
      if (st.planks) { g.lineStyle(1 * R, 0x3a2e22, 0.9); for (let i = 1; i < 5; i++) g.lineBetween(x0 + l * 0.08, cy - hb * 0.68 + i * hb * 0.27, x0 + l * 0.86, cy - hb * 0.68 + i * hb * 0.27); }
      if (st.stripe) { g.fillStyle(st.stripe, 0.9); g.fillRect(x0 + l * 0.15, cy - 1.2 * R, l * 0.6, 2.4 * R); }
      if (st.plates) {
        g.fillStyle(0xdfe6ee, 0.85);
        [0.2, 0.42, 0.64].forEach(f => { g.fillRect(x0 + l * f, cy - hb * 0.98, l * 0.14, hb * 0.22); g.fillRect(x0 + l * f, cy + hb * 0.76, l * 0.14, hb * 0.22); });
      }
      if (st.prow === 'ram') { g.fillStyle(0xbfc7cf, 1); g.fillTriangle(x0 + l * 0.86, cy - hb * 0.45, x0 + l * 1.0, cy, x0 + l * 0.86, cy + hb * 0.45); }
      if (st.cabin) { g.fillStyle(0x0b0f14, 0.55); g.fillRoundedRect(x0 + l * 0.18, cy - hb * 0.42, l * 0.3, hb * 0.84, 2 * R);
                      g.fillStyle(0xdfe6ee, 0.5); g.fillRect(x0 + l * 0.42, cy - hb * 0.3, 1.5 * R, hb * 0.6); }
      if (st.guns) { g.fillStyle(0x0b0f14, 0.9); [0.58, 0.7].forEach(f => { g.fillCircle(x0 + l * f, cy, hb * 0.22); g.fillRect(x0 + l * f, cy - 1 * R, l * 0.1, 2 * R); }); }
      if (st.mast) { g.fillStyle(0xe8e1c8, 1); g.fillCircle(x0 + l * 0.52, cy, 1.8 * R); }
      if (st.flag) { g.fillStyle(st.flag, 1); g.fillTriangle(x0 + l * 0.52, cy, x0 + l * 0.36, cy - hb * 0.5, x0 + l * 0.36, cy + hb * 0.1); }
      // Outboard motor at the stern
      g.fillStyle(0x0b0f14, 0.9); g.fillRect(x0 - 2.5 * R, cy - 2 * R, 3 * R, 4 * R);
    });
  },

  // Helix craft: hovering machines rather than boats
  _helixHull(g, R, x0, cy, l, hb, st) {
    const pts = {
      dart:  [[0, -0.8], [1, 0], [0, 0.8], [0.22, 0]],
      pod:   [[0, -0.7], [0.3, -1], [0.85, -0.8], [1, 0], [0.85, 0.8], [0.3, 1], [0, 0.7]],
      hex:   [[0.05, -0.55], [0.3, -1], [0.75, -1], [1, 0], [0.75, 1], [0.3, 1], [0.05, 0.55]],
      arrow: [[0, -1], [0.35, -0.6], [1, 0], [0.35, 0.6], [0, 1], [0.2, 0]]
    }[st.shape].map(([x, y]) => new Phaser.Geom.Point(x0 + x * l, cy + y * hb));
    g.fillStyle(st.glow, 0.18); g.fillCircle(x0 + l * 0.5, cy, Math.max(l, hb * 2) * 0.55);
    g.fillStyle(0x000000, 0.3); g.fillPoints(pts.map(p => new Phaser.Geom.Point(p.x + 1.5 * R, p.y + 2 * R)), true);
    g.fillStyle(st.hull, 1); g.fillPoints(pts, true);
    g.lineStyle(1.2 * R, 0x0b1820, 0.9); g.strokePoints(pts, true);
    // Glowing core and a stripe
    g.fillStyle(st.glow, 1); g.fillCircle(x0 + l * 0.48, cy, Math.max(1.6 * R, hb * 0.28));
    g.lineStyle(1 * R, st.glow, 0.8); g.lineBetween(x0 + l * 0.12, cy, x0 + l * 0.34, cy);
  },

  // ── Battle map ─────────────────────────────────────────────────────────
  // Raft decking over the play area with water channels along the path.
  // Returns { water, theme }: scroll water.tilePosition in update() to make
  // the channels flow.
  drawMap(scene, pts, area, storylineId) {
    const id = Art.THEMES[storylineId] ? storylineId : 1, T = Art.theme(id), R = Art.RES;
    const { x: L, y: Tp, w: W, h: H } = area;
    // Everything that never moves is drawn once into a texture at RES×,
    // so the map costs one image per frame instead of re-drawing shapes
    const rt = scene.add.renderTexture(L, Tp, W * R, H * R).setOrigin(0, 0).setScale(1 / R).setDepth(-5);
    const deck = scene.make.tileSprite({ x: 0, y: 0, width: W * R, height: H * R, key: 'deck_' + id, add: false }).setOrigin(0, 0);
    rt.draw(deck, 0, 0); deck.destroy();

    const channel = (g, w, col, a) => {
      g.fillStyle(col, a); pts.forEach(p => g.fillCircle(p.x, p.y, w / 2));
      g.lineStyle(w, col, a); g.beginPath(); g.moveTo(pts[0].x, pts[0].y); pts.forEach(p => g.lineTo(p.x, p.y)); g.strokePath();
    };
    const g = scene.make.graphics({ add: false });
    g.lineStyle(3, T.edge, 1); g.strokeRoundedRect(L + 1.5, Tp + 1.5, W - 3, H - 3, 10);   // frame
    channel(g, 54, T.edge, 1);          // wet edge of the decking
    channel(g, 44, T.waterDeep, 1);     // channel
    channel(g, 26, T.water, 1);         // lighter middle

    // Tyre fenders along both banks (skipped where they'd sit in another channel)
    const distToPath = (x, y) => {
      let best = Infinity;
      for (let i = 0; i < pts.length - 1; i++) best = Math.min(best, Art._segDist(x, y, pts[i], pts[i + 1]));
      return best;
    };
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
      const px = -Math.sin(ang), py = Math.cos(ang);
      for (let d = 18; d < len - 18; d += 38) {
        const x = a.x + Math.cos(ang) * d, y = a.y + Math.sin(ang) * d;
        [-1, 1].forEach(side => {
          const fx = x + px * 26 * side, fy = y + py * 26 * side;
          if (distToPath(fx, fy) < 24) return;
          g.fillStyle(0x0d1116, 1); g.fillCircle(fx, fy, 4.2);
          g.lineStyle(1.5, 0x3a4452, 1); g.strokeCircle(fx, fy, 2.6);
        });
      }
    }
    // Graphics coords are game units; scale them up into the RES× texture
    g.setScale(R); rt.draw(g, -L * R, -Tp * R); g.destroy();

    // Moving wave pattern, clipped to the channel
    const maskG = scene.make.graphics({ add: false });
    channel(maskG, 44, 0xffffff, 1);
    const water = scene.add.tileSprite(L + W / 2, Tp + H / 2, W * R, H * R, 'water').setScale(1 / R)
      .setTint(T.glint).setAlpha(0.32).setDepth(1.1).setMask(maskG.createGeometryMask());
    return { water, theme: T };
  },

  _segDist(px, py, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / l2)) : 0;
    return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
  },

  boat(scene, x, y, type) {
    return scene.add.image(x, y, 'boat_' + type).setScale(1 / Art.RES);
  },

  // ── Towers: a raft platform plus a turret head that turns ──────────────
  _tower(scene, type) {
    const d = TOWER_DATA[type], c = d.colour;
    const dark = Phaser.Display.Color.ValueToColor(c).darken(30).color;
    const light = Phaser.Display.Color.ValueToColor(c).lighten(25).color;
    // Platform: a square pallet of plastic with tyre bumpers on the corners
    Art._make(scene, 'twr_base_' + type, 36, 36, (g, R) => {
      const s = 36 * R;
      g.fillStyle(0x000000, 0.35); g.fillRoundedRect(3 * R, 4 * R, s - 4 * R, s - 4 * R, 6 * R);
      g.fillStyle(0x2a323d, 1); g.fillRoundedRect(2 * R, 2 * R, s - 5 * R, s - 5 * R, 6 * R);
      g.lineStyle(1 * R, 0x141a22, 1);
      for (let i = 1; i < 4; i++) g.lineBetween(4 * R, (2 + i * 7.75) * R, s - 5 * R, (2 + i * 7.75) * R);
      g.lineStyle(2 * R, c, 0.75); g.strokeRoundedRect(2 * R, 2 * R, s - 5 * R, s - 5 * R, 6 * R);
      g.fillStyle(0x0d1116, 1); [[6, 6], [s / R - 9, 6], [6, s / R - 9], [s / R - 9, s / R - 9]].forEach(([x, y]) => g.fillCircle(x * R, y * R, 3.2 * R));
      g.fillStyle(0x3a4452, 1); [[6, 6], [s / R - 9, 6], [6, s / R - 9], [s / R - 9, s / R - 9]].forEach(([x, y]) => g.fillCircle(x * R, y * R, 1.4 * R));
    });
    // Head (pointing right, centred at its pivot)
    const S = 40;
    Art._make(scene, 'twr_head_' + type, S, S, (g, R) => {
      const cx = S / 2 * R, cy = S / 2 * R;
      const ring = (r) => { g.fillStyle(0x000000, 0.3); g.fillCircle(cx + 1 * R, cy + 1.5 * R, r * R); g.fillStyle(c, 1); g.fillCircle(cx, cy, r * R); g.lineStyle(1.5 * R, dark, 1); g.strokeCircle(cx, cy, r * R); };
      const barrel = (len, w, off) => { g.fillStyle(0xdfe6ee, 1); g.fillRect(cx, cy - (w / 2 - off) * R, len * R, w * R); g.fillStyle(0x0b0f14, 0.6); g.fillRect(cx + (len - 2) * R, cy - (w / 2 - off) * R, 2 * R, w * R); };
      if (type === 'gunner') { barrel(17, 4.5, 0); ring(8.5); g.fillStyle(light, 1); g.fillCircle(cx - 2 * R, cy - 2 * R, 2.5 * R); }
      else if (type === 'gunner2') { barrel(19, 3.5, -2.6); barrel(19, 3.5, 2.6); ring(9.5); g.fillStyle(dark, 1); g.fillRect(cx - 6 * R, cy - 1.5 * R, 9 * R, 3 * R); }
      else if (type === 'bomber') { ring(10); g.fillStyle(0x2a2a2a, 1); g.fillRoundedRect(cx - 2 * R, cy - 5 * R, 14 * R, 10 * R, 3 * R); g.fillStyle(0x0b0f14, 1); g.fillCircle(cx + 9 * R, cy, 3.5 * R); }
      else if (type === 'siphon') { ring(8.5); g.lineStyle(2 * R, 0xd9c9ff, 1); g.strokeCircle(cx, cy, 5 * R); g.fillStyle(0xd9c9ff, 1); g.fillTriangle(cx + 6 * R, cy - 3 * R, cx + 16 * R, cy, cx + 6 * R, cy + 3 * R); g.fillStyle(0xffffff, 1); g.fillCircle(cx, cy, 2 * R); }
      else if (type === 'barricade') {
        // Spiked boom: a star of spikes around a hub
        g.fillStyle(0xdfe6ee, 1);
        for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.fillTriangle(cx + Math.cos(a + 0.25) * 6 * R, cy + Math.sin(a + 0.25) * 6 * R, cx + Math.cos(a) * 15 * R, cy + Math.sin(a) * 15 * R, cx + Math.cos(a - 0.25) * 6 * R, cy + Math.sin(a - 0.25) * 6 * R); }
        ring(7.5);
      } else { barrel(16, 4, 0); ring(8.5); }
    });
  },

  // ── Raids: barges that carry your towers, and enemy turrets ────────────
  _raid(scene) {
    // Barge: a flat raft of drums and planks, bow to the right
    Art._make(scene, 'barge', 44, 34, (g, R) => {
      g.fillStyle(0x000000, 0.35); g.fillRoundedRect(3 * R, 4 * R, 40 * R, 29 * R, 6 * R);
      g.fillStyle(0x5a4a3a, 1); g.fillRoundedRect(2 * R, 2 * R, 38 * R, 28 * R, 6 * R);
      g.lineStyle(1 * R, 0x3a2e22, 1);
      for (let i = 1; i < 4; i++) g.lineBetween(4 * R, (2 + i * 7) * R, 38 * R, (2 + i * 7) * R);
      g.fillStyle(0x2f5f7a, 1); [6, 30].forEach(y => g.fillRoundedRect(38 * R, (y - 4) * R, 5 * R, 8 * R, 2 * R));   // floats
      g.lineStyle(1.5 * R, 0xc9b48a, 0.9); g.strokeRoundedRect(2 * R, 2 * R, 38 * R, 28 * R, 6 * R);                  // rope
    });
    // Turret bunker: an armoured hexagon in Front red
    [['tur_base', 34], ['tur_base_heavy', 42]].forEach(([key, S]) => Art._make(scene, key, S, S, (g, R) => {
      const c = S / 2 * R, r = (S / 2 - 3) * R;
      const hex = []; for (let i = 0; i < 6; i++) hex.push(new Phaser.Geom.Point(c + r * Math.cos(Math.PI / 6 + i * Math.PI / 3), c + r * Math.sin(Math.PI / 6 + i * Math.PI / 3)));
      g.fillStyle(0x000000, 0.35); g.fillPoints(hex.map(p => new Phaser.Geom.Point(p.x + 1.5 * R, p.y + 2 * R)), true);
      g.fillStyle(0x3a2020, 1); g.fillPoints(hex, true);
      g.lineStyle(2 * R, 0xc43a3a, 1); g.strokePoints(hex, true);
      g.fillStyle(0x0b0f14, 0.6); hex.forEach(p => g.fillCircle(c + (p.x - c) * 0.7, c + (p.y - c) * 0.7, 1.5 * R));
    }));
    const head = (key, draw) => Art._make(scene, key, 44, 44, (g, R) => draw(g, R, 22 * R, 22 * R));
    const gun = (g, R, cx, cy, len, w, off) => { g.fillStyle(0x8a8f96, 1); g.fillRect(cx, cy - (w / 2 - off) * R, len * R, w * R); g.fillStyle(0x0b0f14, 0.7); g.fillRect(cx + (len - 2) * R, cy - (w / 2 - off) * R, 2 * R, w * R); };
    head('tur_head_gun',   (g, R, cx, cy) => { gun(g, R, cx, cy, 16, 4.5, 0); g.fillStyle(0xc43a3a, 1); g.fillCircle(cx, cy, 7 * R); g.lineStyle(1.5 * R, 0x6e2222, 1); g.strokeCircle(cx, cy, 7 * R); });
    head('tur_head_salvo', (g, R, cx, cy) => { [-4, 0, 4].forEach(o => gun(g, R, cx, cy, 13, 3, o)); g.fillStyle(0x3fae8e, 1); g.fillRoundedRect(cx - 7 * R, cy - 7 * R, 12 * R, 14 * R, 3 * R); });
    head('tur_head_heavy', (g, R, cx, cy) => { gun(g, R, cx, cy, 20, 8, 0); g.fillStyle(0x8a2a2a, 1); g.fillCircle(cx, cy, 10 * R); g.lineStyle(2 * R, 0x3a1010, 1); g.strokeCircle(cx, cy, 10 * R); });
  },

  tower(scene, x, y, type) {
    const base = scene.add.image(x, y, 'twr_base_' + type).setScale(1 / Art.RES);
    const head = scene.add.image(x, y, 'twr_head_' + type).setScale(1 / Art.RES);
    return { base, head };
  }
};
