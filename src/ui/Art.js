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
         water: 0x0f2a44, waterDeep: 0x091a2c, glint: 0x7fe3ff, edge: 0x060d16 },
    5: { name: 'steel', deck: 0x2e343c, deckAlt: 0x323942, seam: 0x1c2128, patch: [0x34506e, 0x6b7280, 0x8a6a42],
         water: 0x2a4256, waterDeep: 0x1a2c3c, glint: 0xb7d4ea, edge: 0x0e1820 },
    6: { name: 'storm', deck: 0x262a2e, deckAlt: 0x2a2e33, seam: 0x16191c, patch: [0x5a3a3a, 0x3a4a5a, 0x5a5a3a],
         water: 0x1c3a3a, waterDeep: 0x102424, glint: 0x9fd8c8, edge: 0x081212 }
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
    Art._island(scene);
    Art._factory(scene);
    Art._merchants(scene);
    Art._ambient(scene);
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
      saltChild:      { shape: 'drums', beam: 0.62, hats: [0x1a1a1a, 0xc43a3a, 0x6b7280] },
      scrapRunner:    { shape: 'jetski', beam: 0.42, hats: [0x1a1a1a, 0xc43a3a, 0x6b7280] },
      bilgeRat:       { shape: 'inflatable', beam: 0.7, hats: [0x1a1a1a, 0xc43a3a, 0x6b7280] },
      driftwoodHulk:  { prow: 'blunt', beam: 0.62, hull: 0x7a6650, deck: 0x5a4a3a, planks: true, cargo: true, crew: 2, hats: [0x1a1a1a, 0xc43a3a, 0x6b7280] },
      frontCommander: { prow: 'point', beam: 0.5,  hull: 0xc43a3a, deck: 0x6e2222, cabin: true, flag: 0x1a1a1a, mast: true, sail: 0x3a1414, crew: 3, hats: [0x1a1a1a, 0xc43a3a, 0x6b7280] },
      salvSkiff:      { prow: 'point', beam: 0.4,  hull: 0x3fae8e, deck: 0x22604f, stripe: 0xe8e1c8, crew: 2, hats: [0x2f7d6a, 0xe8e1c8, 0x52c47f] },
      salvCutter:     { prow: 'point', beam: 0.48, hull: 0x2f7d6a, deck: 0x1f5246, cabin: true, cargo: true, crew: 2, hats: [0x2f7d6a, 0xe8e1c8, 0x52c47f] },
      salvRam:        { prow: 'ram',   beam: 0.55, hull: 0x1f5f52, deck: 0x163f37, cabin: true, crew: 2, hats: [0x2f7d6a, 0xe8e1c8, 0x52c47f] },
      umbajiFlagship: { prow: 'point', beam: 0.46, hull: 0x1b8a64, deck: 0x6b5232, cabin: true, mast: true, flag: 0x52c47f, guns: true, cargo: true, crew: 4, sail: 0xe8e1c8, hats: [0x2f7d6a, 0xe8e1c8, 0x52c47f] },
      helixDrone:     { helix: true, shape: 'dart',  hull: 0xd8e4ea, glow: 0x7fe3ff },
      helixLancer:    { helix: true, shape: 'arrow', hull: 0x9fe8ff, glow: 0xffffff },
      helixMothership:{ helix: true, shape: 'hex',   hull: 0x2fb6d6, glow: 0xe8fbff },
      ioaCutter:      { prow: 'point', beam: 0.4,  hull: 0x5a7a9a, deck: 0x3a5068, stripe: 0xf4f6f8, crew: 2, hats: [0xf4f6f8, 0x2f5f8a, 0x1a2a3a] },
      ioaGunboat:     { prow: 'point', beam: 0.48, hull: 0x34506e, deck: 0x22344a, cabin: true, guns: true, crew: 3, hats: [0xf4f6f8, 0x2f5f8a, 0x1a2a3a] },
      ortegaFlagship: { prow: 'point', beam: 0.46, hull: 0x24405e, deck: 0x1a2a3a, cabin: true, guns: true, mast: true, flag: 0xf4f6f8, cargo: true, crew: 4, hats: [0xf4f6f8, 0x2f5f8a, 0x1a2a3a] },
      helixGhost:     { helix: true, shape: 'dart',  hull: 0xbfefff, glow: 0xffffff },
      salvFlotilla:   { prow: 'blunt', beam: 0.66, hull: 0x2f7d6a, deck: 0x1f5246, planks: true, stripe: 0xe8e1c8, cargo: true, crew: 3, hats: [0x2f7d6a, 0xe8e1c8, 0x52c47f] },
      frontDiver:     { prow: 'point', beam: 0.44, hull: 0x5a2a2a, deck: 0x3a1414, cabin: true, stripe: 0xe8a020, crew: 1, hats: [0x1a1a1a, 0xc43a3a, 0x6b7280] },
      helixTrooper:   { helix: true, shape: 'pod',   hull: 0x9fb4c2, glow: 0x7fe3ff },
      helixWarden:    { helix: true, shape: 'hex',   hull: 0x5fd0e6, glow: 0xe8fbff },
      helixSpearhead: { helix: true, shape: 'arrow', hull: 0x2fb6d6, glow: 0xe8fbff }
    }[type] || {};
    return Object.assign(base, S);
  },

  // Each raider type gets VARIANTS looks (scrap patches, crew, cargo), so a
  // wave isn't a row of clones. Art.boat picks one at random.
  VARIANTS: 3,

  _boat(scene, type) {
    for (let v = 0; v < Art.VARIANTS; v++) Art._boatVariant(scene, type, v);
  },

  _boatVariant(scene, type, v) {
    const d = ENEMY_DATA[type], st = Art._boatStyle(type);
    const L = Math.round(d.size * 2.8), B = Math.max(8, Math.round(L * (st.beam || 0.5)));
    const pad = 5, W = L + pad * 2, H = B + pad * 2;
    // Small seeded random so each variant is stable between sessions
    let seed = (type.length * 977 + v * 131 + type.charCodeAt(0) * 17) % 2147483647;
    const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
    const pick = a => a[Math.floor(rnd() * a.length)];
    Art._make(scene, 'boat_' + type + '_' + v, W, H, (g, R) => {
      const x0 = pad * R, cy = (H / 2) * R, l = L * R, b = B * R, hb = b / 2;
      const P = (pts) => pts.map(([x, y]) => new Phaser.Geom.Point(x0 + x * l, cy + y * hb));
      const X = f => x0 + f * l, Y = f => cy + f * hb;
      const skin = [0xe0b080, 0xb07850, 0x7a5030, 0xc89068];
      const hat = st.hats || [0x1a1a1a, 0xc43a3a];
      // A crew member from above: shoulders, then a head with a hat or bandana
      const crew = (fx, fy, r) => {
        g.fillStyle(0x2a2f38, 1); g.fillEllipse(X(fx), Y(fy), r * 2.6 * R, r * 1.6 * R);
        g.fillStyle(pick(skin), 1); g.fillCircle(X(fx), Y(fy), r * R);
        g.fillStyle(pick(hat), 1); g.slice(X(fx), Y(fy), r * R, Math.PI * 0.6, Math.PI * 1.4, false); g.fillPath();
      };
      const shadow = (pts) => { g.fillStyle(0x000000, 0.35); g.fillPoints(pts.map(p => new Phaser.Geom.Point(p.x + 1.5 * R, p.y + 2 * R)), true); };
      if (st.helix) return Art._helixHull(g, R, x0, cy, l, hb, st);

      // ── Front: a raft of lashed oil drums with a kid or two ──
      if (st.shape === 'drums') {
        const cols = [0x2f6f9a, 0xc4642a, 0x6b7280, 0x3a8f5a, 0xb03a33];
        g.fillStyle(0x000000, 0.35); g.fillRoundedRect(X(0.02) + 1.5 * R, Y(-0.95) + 2 * R, l * 0.96, hb * 1.9, 3 * R);
        for (let i = 0; i < 3; i++) {                                   // three drums across, lashed
          const dy = Y(-0.66 + i * 0.66);
          g.fillStyle(pick(cols), 1); g.fillRoundedRect(X(0.02), dy - hb * 0.3, l * 0.96, hb * 0.6, hb * 0.28);
          g.lineStyle(1 * R, 0x0b0f14, 0.6); g.lineBetween(X(0.3), dy - hb * 0.3, X(0.3), dy + hb * 0.3); g.lineBetween(X(0.7), dy - hb * 0.3, X(0.7), dy + hb * 0.3);
        }
        g.fillStyle(0x8a6a42, 1); g.fillRect(X(0.25), Y(-0.75), l * 0.5, hb * 1.5);   // plank deck
        g.lineStyle(1 * R, 0x5a4428, 1); [0.4, 0.55].forEach(f => g.lineBetween(X(f), Y(-0.75), X(f), Y(0.75)));
        crew(0.45, v === 1 ? -0.3 : 0, 0.24 * hb / R);
        if (v !== 0) crew(0.68, 0.35, 0.2 * hb / R);
        g.lineStyle(1.5 * R, 0x5a4428, 1); g.lineBetween(X(0.5), Y(0.2), X(0.95), Y(0.95));   // paddle
        return;
      }
      // ── Jet-ski: sleek hull, one rider leaning forward ──
      if (st.shape === 'jetski') {
        const hull = P([[0, -0.7], [0.55, -1], [0.85, -0.6], [1, 0], [0.85, 0.6], [0.55, 1], [0, 0.7]]);
        shadow(hull);
        g.fillStyle(pick([0xe8a020, 0xe5534b, 0xf2c14b]), 1); g.fillPoints(hull, true);
        g.lineStyle(1 * R, 0x0b0f14, 0.9); g.strokePoints(hull, true);
        g.fillStyle(0x1a1a1a, 1); g.fillEllipse(X(0.42), cy, l * 0.32, hb * 0.9);   // seat
        g.fillStyle(0xdfe6ee, 0.9); g.fillRect(X(0.66), Y(-0.45), l * 0.05, hb * 0.9); // handlebars
        crew(0.5, 0, 0.3 * hb / R);
        g.fillStyle(0x0b0f14, 1); g.fillRect(X(-0.04), Y(-0.25), l * 0.06, hb * 0.5);   // jet nozzle
        return;
      }
      // ── Inflatable: a grey ring with a rat-faced raider ──
      if (st.shape === 'inflatable') {
        g.fillStyle(0x000000, 0.35); g.fillEllipse(X(0.5) + 1.5 * R, cy + 2 * R, l * 0.98, b * 0.98);
        g.fillStyle(pick([0x6b7280, 0x8a7a5a, 0x5a6a4a]), 1); g.fillEllipse(X(0.5), cy, l, b);
        g.fillStyle(0x2a2f38, 1); g.fillEllipse(X(0.5), cy, l * 0.66, b * 0.56);
        crew(0.45, 0, 0.32 * hb / R);
        return;
      }

      // ── Proper boats ──
      const shapes = {
        point: [[0, -0.85], [0.62, -1], [0.86, -0.7], [1, 0], [0.86, 0.7], [0.62, 1], [0, 0.85]],
        round: [[0, -0.8], [0.7, -1], [0.95, -0.55], [1, 0], [0.95, 0.55], [0.7, 1], [0, 0.8]],
        blunt: [[0, -1], [0.9, -1], [1, -0.6], [1, 0.6], [0.9, 1], [0, 1]],
        ram:   [[0, -0.9], [0.7, -1], [0.82, -0.55], [1, -0.18], [1, 0.18], [0.82, 0.55], [0.7, 1], [0, 0.9]]
      };
      const hull = P(shapes[st.prow] || shapes.point);
      shadow(hull);
      g.fillStyle(st.hull, 1); g.fillPoints(hull, true);
      // Scrap patches riveted onto the hull, different on every variant
      for (let k = 0; k < 2 + v; k++) {
        const fx = 0.1 + rnd() * 0.6, side = rnd() < 0.5 ? -1 : 1;
        g.fillStyle(pick([0x6b7280, 0x8a6a42, 0x5a6878, 0x9a5a3a]), 0.9);
        g.fillRect(X(fx), side < 0 ? Y(-0.98) : Y(0.72), l * 0.12, hb * 0.26);
      }
      g.lineStyle(1.2 * R, st.trim, 0.9); g.strokePoints(hull, true);
      const inner = hull.map(p => new Phaser.Geom.Point(x0 + (p.x - x0) * 0.86 + l * 0.05, cy + (p.y - cy) * 0.68));
      g.fillStyle(st.deck, 1); g.fillPoints(inner, true);
      if (st.planks) { g.lineStyle(1 * R, 0x3a2e22, 0.9); for (let i = 1; i < 5; i++) g.lineBetween(X(0.08), cy - hb * 0.68 + i * hb * 0.27, X(0.86), cy - hb * 0.68 + i * hb * 0.27); }
      if (st.stripe) { g.fillStyle(st.stripe, 0.9); g.fillRect(X(0.15), cy - 1.2 * R, l * 0.6, 2.4 * R); }
      if (st.plates) {
        g.fillStyle(0xdfe6ee, 0.85);
        [0.2, 0.42, 0.64].forEach(f => { g.fillRect(X(f), Y(-0.98), l * 0.14, hb * 0.22); g.fillRect(X(f), Y(0.76), l * 0.14, hb * 0.22); });
      }
      if (st.prow === 'ram') { g.fillStyle(0xbfc7cf, 1); g.fillTriangle(X(0.86), Y(-0.45), X(1.0), cy, X(0.86), Y(0.45)); }
      // Cargo: crates and a junk pile on the bigger hulls
      if (st.cargo) for (let k = 0; k < 1 + v; k++) {
        const fx = 0.55 + rnd() * 0.22, fy = -0.4 + rnd() * 0.8;
        g.fillStyle(pick([0x8a6a42, 0x6b5232, 0x5a6878]), 1); g.fillRect(X(fx), Y(fy) - hb * 0.18, l * 0.1, hb * 0.36);
        g.lineStyle(0.8 * R, 0x0b0f14, 0.6); g.strokeRect(X(fx), Y(fy) - hb * 0.18, l * 0.1, hb * 0.36);
      }
      if (st.cabin) { g.fillStyle(0x0b0f14, 0.55); g.fillRoundedRect(X(0.18), cy - hb * 0.42, l * 0.3, hb * 0.84, 2 * R);
                      g.fillStyle(0xdfe6ee, 0.5); g.fillRect(X(0.42), cy - hb * 0.3, 1.5 * R, hb * 0.6); }
      if (st.guns) { g.fillStyle(0x0b0f14, 0.9); [0.58, 0.7].forEach(f => { g.fillCircle(X(f), cy, hb * 0.22); g.fillRect(X(f), cy - 1 * R, l * 0.1, 2 * R); }); }
      // Crew on deck
      const crewN = (st.crew || 1) + (v === 2 ? 1 : 0), cr = Math.min(3.2, hb / R * 0.26);
      for (let k = 0; k < crewN; k++) crew(0.3 + (k % 3) * 0.17 + (v * 0.03), (k % 2 ? 0.32 : -0.28) * (v === 1 ? -1 : 1), cr);
      if (st.mast) { g.fillStyle(0xe8e1c8, 1); g.fillCircle(X(0.52), cy, 1.8 * R); }
      if (st.flag) { g.fillStyle(st.flag, 1); g.fillTriangle(X(0.52), cy, X(0.36), Y(-0.5), X(0.36), Y(0.1)); }
      if (st.sail) { g.fillStyle(st.sail, 0.85); g.fillTriangle(X(0.52), Y(-0.9), X(0.52), Y(0.9), X(0.32), Y(0.1)); }
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
    const lamps = Art._dressMap(rt, pts, area, R);

    // Moving wave pattern, clipped to the channel
    const maskG = scene.make.graphics({ add: false });
    channel(maskG, 44, 0xffffff, 1);
    const water = scene.add.tileSprite(L + W / 2, Tp + H / 2, W * R, H * R, 'water').setScale(1 / R)
      .setTint(T.glint).setAlpha(0.32).setDepth(1.1).setMask(maskG.createGeometryMask());
    return { water, theme: T, lamps, id };
  },

  _segDist(px, py, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / l2)) : 0;
    return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
  },

  boat(scene, x, y, type, variant) {
    const v = variant !== undefined ? variant : Math.floor(Math.random() * Art.VARIANTS);
    return scene.add.image(x, y, 'boat_' + type + '_' + v).setScale(1 / Art.RES);
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
      else if (type === 'harpoon') {
        // Whaling gun: a long rail with the bolt loaded, a drum of rope behind
        g.fillStyle(0x5a6472, 1); g.fillRect(cx - 2 * R, cy - 2.5 * R, 20 * R, 5 * R);
        g.fillStyle(0xdfe6ee, 1); g.fillRect(cx + 2 * R, cy - 1 * R, 15 * R, 2 * R);
        g.fillTriangle(cx + 17 * R, cy - 3.5 * R, cx + 22 * R, cy, cx + 17 * R, cy + 3.5 * R);
        ring(8); g.fillStyle(0xc9b48a, 1); g.fillCircle(cx - 3 * R, cy, 4 * R); g.lineStyle(1 * R, 0x8a7448, 1); g.strokeCircle(cx - 3 * R, cy, 2.5 * R);
      }
      else if (type === 'cannon') {
        // Pump drum with a flared nozzle
        g.fillStyle(0x8a96a6, 1); g.fillRect(cx, cy - 3 * R, 12 * R, 6 * R);
        g.fillStyle(0xd9a441, 1); g.fillTriangle(cx + 11 * R, cy - 3 * R, cx + 18 * R, cy - 6 * R, cx + 18 * R, cy + 6 * R); g.fillTriangle(cx + 11 * R, cy - 3 * R, cx + 11 * R, cy + 3 * R, cx + 18 * R, cy + 6 * R);
        ring(9.5); g.fillStyle(0xbfefff, 1); g.fillCircle(cx, cy, 4 * R); g.fillStyle(0x1a6a88, 1); g.fillCircle(cx, cy, 1.8 * R);
      }
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

  // ── The home island: buildings seen from above, and the turbine ────────
  _island(scene) {
    const shadow = (g, R, f) => { g.fillStyle(0x000000, 0.35); f(3 * R, 4 * R); };
    // Factory: a long shed with a corrugated roof and a chimney
    Art._make(scene, 'bld_factory', 96, 70, (g, R) => {
      shadow(g, R, (dx, dy) => g.fillRoundedRect(4 * R + dx, 8 * R + dy, 86 * R, 56 * R, 6 * R));
      g.fillStyle(0x2a3a4c, 1); g.fillRoundedRect(4 * R, 8 * R, 86 * R, 56 * R, 6 * R);
      g.fillStyle(0x3a8fc4, 1); g.fillRoundedRect(4 * R, 8 * R, 86 * R, 44 * R, 6 * R);
      g.lineStyle(1.2 * R, 0x23628a, 1); for (let x = 10; x < 88; x += 6) g.lineBetween(x * R, 10 * R, x * R, 50 * R);
      g.fillStyle(0x1a2430, 1); g.fillRect(36 * R, 52 * R, 22 * R, 12 * R);                     // loading door
      g.fillStyle(0x0b0f14, 1); g.fillCircle(80 * R, 14 * R, 7 * R);                            // chimney
      g.fillStyle(0x4a5868, 1); g.fillCircle(80 * R, 14 * R, 4 * R);
    });
    // Armoury: a sandbagged bunker with crates
    Art._make(scene, 'bld_armoury', 84, 66, (g, R) => {
      shadow(g, R, (dx, dy) => g.fillRoundedRect(6 * R + dx, 6 * R + dy, 72 * R, 54 * R, 14 * R));
      g.fillStyle(0x8a7a5a, 1); for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.fillEllipse(42 * R + Math.cos(a) * 34 * R, 33 * R + Math.sin(a) * 24 * R, 14 * R, 9 * R); }
      g.fillStyle(0x2f5a3f, 1); g.fillRoundedRect(14 * R, 12 * R, 56 * R, 42 * R, 10 * R);
      g.lineStyle(2 * R, 0x52c47f, 0.8); g.strokeRoundedRect(14 * R, 12 * R, 56 * R, 42 * R, 10 * R);
      g.fillStyle(0x1b2a20, 1); g.fillCircle(42 * R, 33 * R, 9 * R);                            // hatch
      g.fillStyle(0x6b5232, 1); g.fillRect(58 * R, 40 * R, 9 * R, 9 * R); g.fillRect(50 * R, 44 * R, 8 * R, 8 * R);  // crates
    });
    // Uplink: a dish on a mast
    Art._make(scene, 'bld_uplink', 70, 70, (g, R) => {
      shadow(g, R, (dx, dy) => g.fillCircle(35 * R + dx, 35 * R + dy, 26 * R));
      g.fillStyle(0x2a323d, 1); g.fillRect(25 * R, 25 * R, 20 * R, 20 * R);
      g.fillStyle(0xd9dee5, 1); g.fillCircle(35 * R, 35 * R, 24 * R);
      g.fillStyle(0xb7bec8, 1); g.fillCircle(35 * R, 35 * R, 17 * R);
      g.lineStyle(2 * R, 0xe8a020, 1); g.lineBetween(35 * R, 35 * R, 52 * R, 18 * R);
      g.fillStyle(0xe8a020, 1); g.fillCircle(52 * R, 18 * R, 4 * R); g.fillCircle(35 * R, 35 * R, 3 * R);
    });
    // Market: a striped awning over a stall, and Chrome's lights
    Art._make(scene, 'bld_market', 84, 66, (g, R) => {
      shadow(g, R, (dx, dy) => g.fillRect(6 * R + dx, 8 * R + dy, 72 * R, 50 * R));
      g.fillStyle(0x3a3046, 1); g.fillRect(6 * R, 30 * R, 72 * R, 28 * R);
      for (let i = 0; i < 6; i++) { g.fillStyle(i % 2 ? 0xe8e1c8 : 0x9d7ff0, 1); g.fillRect((6 + i * 12) * R, 8 * R, 12 * R, 24 * R); }
      g.fillStyle(0x0b0f14, 0.35); g.fillRect(6 * R, 28 * R, 72 * R, 4 * R);
      g.fillStyle(0x1a1420, 1); g.fillRoundedRect(54 * R, 36 * R, 18 * R, 18 * R, 3 * R);         // slot machine
      [0xe5534b, 0xe8a020, 0x52c47f].forEach((c, i) => { g.fillStyle(c, 1); g.fillCircle((58 + i * 5) * R, 41 * R, 1.8 * R); });
      g.fillStyle(0x6b5232, 1); g.fillRect(14 * R, 40 * R, 12 * R, 10 * R); g.fillRect(30 * R, 42 * R, 10 * R, 8 * R);
    });
    // Housing: a couple of shacks
    Art._make(scene, 'bld_housing', 84, 62, (g, R) => {
      [[6, 10, 36, 30, 0x6b5a45], [44, 20, 34, 34, 0x5a6470]].forEach(([x, y, w, h, c]) => {
        g.fillStyle(0x000000, 0.35); g.fillRect((x + 3) * R, (y + 4) * R, w * R, h * R);
        g.fillStyle(c, 1); g.fillRect(x * R, y * R, w * R, h * R);
        g.lineStyle(1 * R, 0x0b0f14, 0.6); g.lineBetween(x * R, (y + h / 2) * R, (x + w) * R, (y + h / 2) * R);
      });
    });
    // Turbine: a round base, and a three-bladed rotor that turns slowly
    Art._make(scene, 'turbine_base', 60, 60, (g, R) => {
      g.fillStyle(0x000000, 0.35); g.fillCircle(32 * R, 33 * R, 26 * R);
      g.fillStyle(0x3a4452, 1); g.fillCircle(30 * R, 30 * R, 26 * R);
      g.lineStyle(2 * R, 0x5a6878, 1); g.strokeCircle(30 * R, 30 * R, 20 * R);
      g.fillStyle(0xc9b48a, 0.9); g.fillRect(8 * R, 28 * R, 10 * R, 4 * R);          // Tianxia stencil, faded
    });
    Art._make(scene, 'turbine_rotor', 200, 200, (g, R) => {
      const c = 100 * R;
      for (let i = 0; i < 3; i++) {
        const a = i * Math.PI * 2 / 3, ca = Math.cos(a), sa = Math.sin(a), px = -sa, py = ca;
        const tip = 94 * R, root = 10 * R, w = 7 * R;
        g.fillStyle(0x000000, 0.25);
        g.fillTriangle(c + ca * root + px * w + 4 * R, c + sa * root + py * w + 6 * R, c + ca * tip + 4 * R, c + sa * tip + 6 * R, c + ca * root - px * w + 4 * R, c + sa * root - py * w + 6 * R);
        g.fillStyle(0xdfe6ee, 1);
        g.fillTriangle(c + ca * root + px * w, c + sa * root + py * w, c + ca * tip, c + sa * tip, c + ca * root - px * w, c + sa * root - py * w);
        g.fillStyle(0xc43a3a, 1); g.fillCircle(c + ca * (tip - 6 * R), c + sa * (tip - 6 * R), 2.5 * R);
      }
      g.fillStyle(0xb7bec8, 1); g.fillCircle(c, c, 12 * R);
      g.fillStyle(0x6f7b8d, 1); g.fillCircle(c, c, 5 * R);
    });
  },

  // ── Factory: floor plate, benches, smelter, belt and the crew ──────────
  _factory(scene) {
    // Steel diamond plate
    Art._make(scene, 'floor_plate', 32, 32, (g, R) => {
      g.fillStyle(0x161c24, 1); g.fillRect(0, 0, 32 * R, 32 * R);
      g.fillStyle(0x222a35, 1);
      [[8, 8, 1], [24, 8, -1], [8, 24, -1], [24, 24, 1]].forEach(([x, y, d]) => {
        const a = d * 0.6, c = Math.cos(a), sn = Math.sin(a), l = 5 * R, w = 1.4 * R;
        g.fillPoints([[l, 0], [0, w], [-l, 0], [0, -w]].map(([px, py]) => new Phaser.Geom.Point(x * R + px * c - py * sn, y * R + px * sn + py * c)), true);
      });
    });
    // Workbench: a wooden top with a vise; the tower being built sits on it
    Art._make(scene, 'bench', 56, 34, (g, R) => {
      g.fillStyle(0x000000, 0.35); g.fillRoundedRect(3 * R, 5 * R, 52 * R, 28 * R, 4 * R);
      g.fillStyle(0x6b5232, 1); g.fillRoundedRect(2 * R, 2 * R, 52 * R, 28 * R, 4 * R);
      g.lineStyle(1 * R, 0x4a3820, 1); [9, 16, 23].forEach(y => g.lineBetween(4 * R, y * R, 52 * R, y * R));
      g.fillStyle(0x8a8f96, 1); g.fillRect(44 * R, 6 * R, 8 * R, 10 * R); g.fillStyle(0x5a6068, 1); g.fillRect(46 * R, 16 * R, 4 * R, 10 * R);   // vise
      g.fillStyle(0x2a2a2a, 1); g.fillRect(5 * R, 22 * R, 10 * R, 4 * R);                                                                  // tools
    });
    // Smelter: a squat furnace; its mouth glows when working (see FactoryScene)
    Art._make(scene, 'smelter_art', 46, 40, (g, R) => {
      g.fillStyle(0x000000, 0.35); g.fillRoundedRect(4 * R, 6 * R, 40 * R, 33 * R, 8 * R);
      g.fillStyle(0x4a4038, 1); g.fillRoundedRect(3 * R, 3 * R, 40 * R, 33 * R, 8 * R);
      g.lineStyle(2 * R, 0xe8a020, 0.8); g.strokeRoundedRect(3 * R, 3 * R, 40 * R, 33 * R, 8 * R);
      g.fillStyle(0x1a1410, 1); g.fillRoundedRect(13 * R, 18 * R, 20 * R, 12 * R, 5 * R);
      g.fillStyle(0x0b0f14, 1); g.fillCircle(36 * R, 9 * R, 4 * R);                                     // flue
    });
    // Belt: dark rubber with rollers, running left→right (rotated per direction)
    Art._make(scene, 'belt', 64, 40, (g, R) => {
      g.fillStyle(0x0b0f14, 1); g.fillRect(0, 4 * R, 64 * R, 32 * R);
      g.fillStyle(0x232a33, 1); g.fillRect(0, 7 * R, 64 * R, 26 * R);
      g.fillStyle(0x3a4452, 1); for (let x = 4; x < 64; x += 10) g.fillRect(x * R, 7 * R, 2 * R, 26 * R);
      g.fillStyle(0x8a96a6, 1); [4, 36].forEach(y => { for (let x = 6; x < 64; x += 14) g.fillCircle(x * R, y * R, 2 * R); });
    });
    // The crew, from above: shoulders and a coloured hard hat
    [[0, 0xf2a93b, false], [1, 0x3a8fc4, false], [2, 0x9d7ff0, true]].forEach(([id, col, big]) => {
      Art._make(scene, 'worker_' + id, 40, 40, (g, R) => {
        const sh = big ? 15 : 12;
        g.fillStyle(0x000000, 0.35); g.fillEllipse(21 * R, 23 * R, sh * 2.2 * R, sh * 1.3 * R);
        g.fillStyle(big ? 0x3a3f4a : 0x4a5868, 1); g.fillEllipse(20 * R, 21 * R, sh * 2.2 * R, sh * 1.3 * R);
        if (big) { g.fillStyle(0x7fe3ff, 1); g.fillCircle(8 * R, 20 * R, 2.5 * R); g.fillCircle(32 * R, 20 * R, 2.5 * R); }   // cyber joints
        g.fillStyle(col, 1); g.fillCircle(20 * R, 19 * R, (big ? 11 : 10) * R);
        g.lineStyle(1.5 * R, 0x0a0d12, 1); g.strokeCircle(20 * R, 19 * R, (big ? 11 : 10) * R);
        g.fillStyle(0xffffff, 0.25); g.fillEllipse(17 * R, 15 * R, 8 * R, 4 * R);                         // hat shine
      });
    });
  },

  // ── Battle-map dressing: deck clutter, flotsam, gulls, the base gate ───
  _ambient(scene) {
    const sh = (g, R, f) => { g.fillStyle(0x000000, 0.35); f(); };
    Art._make(scene, 'prop_crate', 18, 18, (g, R) => {
      g.fillStyle(0x000000, 0.35); g.fillRect(3 * R, 4 * R, 14 * R, 14 * R);
      g.fillStyle(0x8a6a42, 1); g.fillRect(2 * R, 2 * R, 14 * R, 14 * R);
      g.lineStyle(1.2 * R, 0x5a4428, 1); g.strokeRect(2 * R, 2 * R, 14 * R, 14 * R); g.lineBetween(2 * R, 2 * R, 16 * R, 16 * R); g.lineBetween(16 * R, 2 * R, 2 * R, 16 * R);
    });
    Art._make(scene, 'prop_drums', 24, 22, (g, R) => {
      [[7, 7, 0x2f6f9a], [17, 8, 0xc4642a], [11, 16, 0x6b7280]].forEach(([x, y, c]) => {
        g.fillStyle(0x000000, 0.35); g.fillCircle((x + 1) * R, (y + 2) * R, 5.5 * R);
        g.fillStyle(c, 1); g.fillCircle(x * R, y * R, 5.5 * R); g.lineStyle(1 * R, 0x0b0f14, 0.6); g.strokeCircle(x * R, y * R, 3.5 * R);
      });
    });
    Art._make(scene, 'prop_tyres', 18, 18, (g, R) => {
      g.fillStyle(0x000000, 0.35); g.fillCircle(10 * R, 11 * R, 8 * R);
      g.fillStyle(0x1a1d22, 1); g.fillCircle(9 * R, 9 * R, 8 * R); g.fillStyle(0x3a3f48, 1); g.fillCircle(9 * R, 9 * R, 4.5 * R); g.fillStyle(0x1a1d22, 1); g.fillCircle(9 * R, 9 * R, 2.5 * R);
    });
    Art._make(scene, 'prop_tarp', 28, 20, (g, R) => {
      g.fillStyle(0x000000, 0.35); g.fillRoundedRect(3 * R, 4 * R, 24 * R, 15 * R, 4 * R);
      g.fillStyle(0x2f5f8a, 1); g.fillRoundedRect(2 * R, 2 * R, 24 * R, 15 * R, 4 * R);
      g.lineStyle(1 * R, 0x1f3f5a, 1); [8, 14, 20].forEach(x => g.lineBetween(x * R, 3 * R, (x - 2) * R, 16 * R));
      g.lineStyle(1 * R, 0xc9b48a, 0.9); g.lineBetween(2 * R, 9 * R, 26 * R, 10 * R);
    });
    Art._make(scene, 'prop_solar', 26, 18, (g, R) => {
      g.fillStyle(0x000000, 0.35); g.fillRect(3 * R, 4 * R, 22 * R, 13 * R);
      g.fillStyle(0x1a2a4a, 1); g.fillRect(2 * R, 2 * R, 22 * R, 13 * R);
      g.lineStyle(1 * R, 0x5a7aa8, 0.8); [7.5, 13, 18.5].forEach(x => g.lineBetween(x * R, 2 * R, x * R, 15 * R)); g.lineBetween(2 * R, 8.5 * R, 24 * R, 8.5 * R);
      g.lineStyle(1 * R, 0xb7bec8, 1); g.strokeRect(2 * R, 2 * R, 22 * R, 13 * R);
    });
    Art._make(scene, 'prop_rope', 16, 16, (g, R) => {
      g.lineStyle(1.6 * R, 0xc9b48a, 1); [6.5, 4.5, 2.5].forEach(r => g.strokeCircle(8 * R, 8 * R, r * R));
    });
    Art._make(scene, 'prop_lamp', 12, 12, (g, R) => {
      g.fillStyle(0x3a4452, 1); g.fillCircle(6 * R, 6 * R, 4.5 * R); g.fillStyle(0xffd27a, 1); g.fillCircle(6 * R, 6 * R, 2.5 * R);
    });
    // Flotsam that drifts down the channels
    Art._make(scene, 'flot_bottle', 10, 6, (g, R) => { g.fillStyle(0x7fc4a8, 0.9); g.fillRoundedRect(0, 1 * R, 7 * R, 4 * R, 2 * R); g.fillRect(7 * R, 2 * R, 3 * R, 2 * R); });
    Art._make(scene, 'flot_crate', 9, 9, (g, R) => { g.fillStyle(0x8a6a42, 0.95); g.fillRect(0, 0, 9 * R, 9 * R); g.lineStyle(1 * R, 0x5a4428, 1); g.strokeRect(0, 0, 9 * R, 9 * R); });
    Art._make(scene, 'flot_ring', 10, 10, (g, R) => { g.lineStyle(2.5 * R, 0xe5534b, 1); g.strokeCircle(5 * R, 5 * R, 3.6 * R); g.lineStyle(2.5 * R, 0xf4efe2, 1); g.beginPath(); g.arc(5 * R, 5 * R, 3.6 * R, 0, 0.8); g.strokePath(); g.beginPath(); g.arc(5 * R, 5 * R, 3.6 * R, Math.PI, Math.PI + 0.8); g.strokePath(); });
    // A gull, wings out
    Art._make(scene, 'gull', 20, 10, (g, R) => {
      g.fillStyle(0xf4f6f8, 1);
      g.fillTriangle(10 * R, 5 * R, 0, 2 * R, 2 * R, 6 * R); g.fillTriangle(10 * R, 5 * R, 20 * R, 2 * R, 18 * R, 6 * R);
      g.fillEllipse(10 * R, 5.5 * R, 4 * R, 7 * R); g.fillStyle(0xe8a020, 1); g.fillCircle(10 * R, 1.5 * R, 0.9 * R);
    });
    // Your base: a palisade gate across the channel with two lamps
    Art._make(scene, 'base_gate', 76, 26, (g, R) => {
      g.fillStyle(0x000000, 0.35); g.fillRect(3 * R, 9 * R, 72 * R, 16 * R);
      g.fillStyle(0x6b5232, 1); for (let x = 2; x < 74; x += 6) { g.fillRect(x * R, 8 * R, 5 * R, 14 * R); g.fillTriangle(x * R, 8 * R, (x + 2.5) * R, 4 * R, (x + 5) * R, 8 * R); }
      g.fillStyle(0x3a4452, 1); g.fillRect(2 * R, 13 * R, 72 * R, 3 * R);
      [[6, 0x3a8fc4], [70, 0x3a8fc4]].forEach(([x, c]) => { g.fillStyle(0x2a323d, 1); g.fillCircle(x * R, 15 * R, 5 * R); g.fillStyle(0xffd27a, 1); g.fillCircle(x * R, 15 * R, 2.5 * R); });
      g.fillStyle(0x3a8fc4, 1); g.fillTriangle(38 * R, 0, 38 * R, 8 * R, 46 * R, 3 * R); g.fillStyle(0xdfe6ee, 1); g.fillRect(37 * R, 0, 1.5 * R, 12 * R);
    });
    // Soft glow: white middle fading to nothing (lamps, fog, smoke)
    if (!scene.textures.exists('glow')) {
      const tex = scene.textures.createCanvas('glow', 64, 64), ctx = tex.getContext();
      const grd = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.4, 'rgba(255,255,255,0.45)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grd; ctx.fillRect(0, 0, 64, 64); tex.refresh();
    }
    // Vignette: transparent middle, dark edges
    if (!scene.textures.exists('vignette')) {
      const tex = scene.textures.createCanvas('vignette', 256, 256), ctx = tex.getContext();
      const grd = ctx.createRadialGradient(128, 128, 60, 128, 128, 182);
      grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(0,0,0,0.85)');
      ctx.fillStyle = grd; ctx.fillRect(0, 0, 256, 256); tex.refresh();
    }
  },

  // Scatter deck clutter into the baked map: seeded by the path so a level
  // always looks the same. Returns lamp positions (they glow at night).
  _dressMap(rt, pts, area, R) {
    const { x: L, y: Tp, w: W, h: H } = area;
    let seed = Math.round(pts.reduce((a, p) => a + p.x * 7 + p.y * 3, 0)) % 2147483646 + 1;
    const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
    const near = (x, y) => { let best = 1e9; for (let i = 0; i < pts.length - 1; i++) best = Math.min(best, Art._segDist(x, y, pts[i], pts[i + 1])); return best; };
    const keys = ['prop_crate', 'prop_crate', 'prop_drums', 'prop_tyres', 'prop_tarp', 'prop_solar', 'prop_rope', 'prop_lamp', 'prop_lamp'];
    const lamps = [], img = rt.scene.make.image({ x: 0, y: 0, key: 'prop_crate', add: false });
    for (let y = Tp + 18; y < Tp + H - 14; y += 30) for (let x = L + 16; x < L + W - 14; x += 30) {
      if (rnd() > 0.2) continue;
      const px = x + (rnd() - 0.5) * 14, py = y + (rnd() - 0.5) * 14;
      if (near(px, py) < 38) continue;
      const k = keys[Math.floor(rnd() * keys.length)];
      img.setTexture(k).setRotation(k === 'prop_lamp' ? 0 : (rnd() - 0.5) * 0.9).setPosition((px - L) * R, (py - Tp) * R);
      rt.draw(img);
      if (k === 'prop_lamp') lamps.push({ x: px, y: py });
    }
    img.destroy();
    return lamps;
  },

  // ── Market: each merchant's game ───────────────────────────────────────
  _merchants(scene) {
    // Chrome: a slot machine cabinet with three reels and a handle
    Art._make(scene, 'mer_chrome', 46, 46, (g, R) => {
      g.fillStyle(0x000000, 0.35); g.fillRoundedRect(7 * R, 6 * R, 32 * R, 39 * R, 5 * R);
      g.fillStyle(0xb8862a, 1); g.fillRoundedRect(5 * R, 3 * R, 32 * R, 39 * R, 5 * R);
      g.fillStyle(0xe8a020, 1); g.fillRoundedRect(5 * R, 3 * R, 32 * R, 9 * R, 4 * R);
      g.fillStyle(0xf4efe2, 1); [9, 18, 27].forEach(x => g.fillRect(x * R, 16 * R, 7 * R, 11 * R));
      [[12.5, 0xe5534b], [21.5, 0x52c47f], [30.5, 0xe5534b]].forEach(([x, c]) => { g.fillStyle(c, 1); g.fillCircle(x * R, 21.5 * R, 2.2 * R); });
      g.fillStyle(0x3a2a10, 1); g.fillRect(9 * R, 32 * R, 25 * R, 5 * R);
      g.lineStyle(2 * R, 0xb7bec8, 1); g.lineBetween(40 * R, 26 * R, 40 * R, 10 * R);
      g.fillStyle(0xe5534b, 1); g.fillCircle(40 * R, 9 * R, 3.2 * R);
    });
    // Ricochet: a peg board with a ball dropping through
    Art._make(scene, 'mer_ricochet', 46, 46, (g, R) => {
      g.fillStyle(0x000000, 0.35); g.fillRoundedRect(6 * R, 5 * R, 36 * R, 39 * R, 5 * R);
      g.fillStyle(0x1f4a35, 1); g.fillRoundedRect(4 * R, 3 * R, 36 * R, 39 * R, 5 * R);
      g.lineStyle(2 * R, 0x52c47f, 1); g.strokeRoundedRect(4 * R, 3 * R, 36 * R, 39 * R, 5 * R);
      g.fillStyle(0xdfe6ee, 1);
      for (let r = 0; r < 4; r++) for (let c = 0; c < (r % 2 ? 3 : 4); c++) g.fillCircle((10 + c * 8 + (r % 2) * 4) * R, (11 + r * 7) * R, 1.5 * R);
      g.fillStyle(0xe8a020, 1); g.fillCircle(25 * R, 20 * R, 3 * R);
      g.fillStyle(0x0b0f14, 0.6); [10, 18, 26, 34].forEach(x => g.fillRect((x - 3) * R, 36 * R, 6 * R, 4 * R));
    });
    // Double-Down: a pair of dice
    Art._make(scene, 'mer_doubleDown', 46, 46, (g, R) => {
      const die = (cx, cy, a, pips) => {
        const pts = [[-9, -9], [9, -9], [9, 9], [-9, 9]].map(([x, y]) => new Phaser.Geom.Point((cx + x * Math.cos(a) - y * Math.sin(a)) * R, (cy + x * Math.sin(a) + y * Math.cos(a)) * R));
        g.fillStyle(0x000000, 0.35); g.fillPoints(pts.map(p => new Phaser.Geom.Point(p.x + 2 * R, p.y + 3 * R)), true);
        g.fillStyle(0xf4efe2, 1); g.fillPoints(pts, true);
        g.lineStyle(1.5 * R, 0xc43a3a, 1); g.strokePoints(pts, true);
        g.fillStyle(0xc43a3a, 1);
        pips.forEach(([x, y]) => g.fillCircle((cx + x * Math.cos(a) - y * Math.sin(a)) * R, (cy + x * Math.sin(a) + y * Math.cos(a)) * R, 1.8 * R));
      };
      die(15, 17, -0.25, [[-4.5, -4.5], [0, 0], [4.5, 4.5]]);
      die(30, 29, 0.3, [[-4.5, -4.5], [4.5, -4.5], [-4.5, 4.5], [4.5, 4.5], [0, 0], [-4.5, 0]]);
    });
  },

  // ── Upgrade looks (like Bloons: every mod tier changes the tower) ──────
  // Drawn in the turret head's own coordinates (barrel along +x, pivot at
  // 0,0, game units) into a Graphics that turns with the head. mods is
  // [path0, path1, path2] tiers, 0..3 each.
  drawHeadMods(g, type, mods) {
    g.clear();
    const [a, b, c] = mods || [0, 0, 0];
    const steel = 0xdfe6ee, dark = 0x0b0f14, brass = 0xd9a441, rust = 0x8a5a2b;
    const tube = (x0, x1, w, off, col) => { g.fillStyle(col || steel, 1); g.fillRect(x0, off - w / 2, x1 - x0, w); g.fillStyle(dark, 0.55); g.fillRect(x1 - 2, off - w / 2, 2, w); };
    const coil = (x0, x1, y, h, col) => { g.lineStyle(1.6, col, 1); g.beginPath(); for (let i = 0, n = Math.round((x1 - x0) / 2.5); i <= n; i++) { const x = x0 + (x1 - x0) * i / n; i ? g.lineTo(x, y + (i % 2 ? -h : h)) : g.moveTo(x, y); } g.strokePath(); };
    const spikes = (r0, r1, n, col, ofs) => { g.fillStyle(col, 1); for (let i = 0; i < n; i++) { const t = (ofs || 0) + i * Math.PI * 2 / n, w = 0.22; g.fillTriangle(Math.cos(t - w) * r0, Math.sin(t - w) * r0, Math.cos(t) * r1, Math.sin(t) * r1, Math.cos(t + w) * r0, Math.sin(t + w) * r0); } };
    const box = (x, y, w, h, col, edge) => { g.fillStyle(col, 1); g.fillRect(x, y, w, h); g.lineStyle(1, edge || dark, 0.8); g.strokeRect(x, y, w, h); };

    if (type === 'gunner') {
      if (a >= 1) tube(16, 24, 4, 0);                                                     // longer pipe
      if (a >= 2) { g.lineStyle(1.5, rust, 1); g.lineBetween(4, -5, 14, -2.5); g.lineBetween(4, 5, 14, 2.5); box(2, -9, 7, 3, 0x5a6472); }   // braces + sight
      if (a >= 3) { g.fillStyle(0xc0c8d2, 1); g.fillTriangle(24, -5, 31, 0, 24, 5); g.fillStyle(0xe5534b, 1); g.fillTriangle(24, -5, 21, -3, 24, -1); g.fillTriangle(24, 5, 21, 3, 24, 1); }   // harpoon tip
      if (b >= 1) coil(-6, 4, 9.5, 2.2, 0xb7bec8);                                       // bedspring
      if (b >= 2) { g.lineStyle(1.6, 0x9aa3ad, 1); g.strokeEllipse(-4, 0, 10, 20); g.fillStyle(0x8a8f96, 1); [-8, 6].forEach(y => g.fillCircle(-4, y, 1.4)); }   // bike chain
      if (b >= 3) { box(-17, -5, 8, 10, 0x5a6472); g.fillStyle(0xe8a020, 1); g.fillRect(-15, -3.5, 4, 2); g.lineStyle(2, 0x8a8f96, 1); g.lineBetween(-17, -7, -17, 7); }   // outboard motor
      if (c >= 1) spikes(8, 11, 7, 0xb7bec8, 0.4);                                      // nails on the dome
      if (c >= 2) { box(-3, -15, 10, 6, 0x7d8f4a); g.fillStyle(0xe8a020, 1); g.fillRect(-1, -13.5, 6, 1.5); }   // shrapnel box
      if (c >= 3) tube(2, 18, 3.5, -6);                                                   // double barrel
    } else if (type === 'gunner2') {
      if (a >= 1) { g.lineStyle(1, dark, 0.7); [8, 12, 16].forEach(x => { g.lineBetween(x, -4.5, x, -0.8); g.lineBetween(x, 0.8, x, 4.5); }); }   // rifling rings
      if (a >= 2) { box(-2, -12, 12, 4, 0x1f2a36, 0x7fe3ff); g.fillStyle(0x7fe3ff, 1); g.fillCircle(10, -10, 1.6); }   // scope
      if (a >= 3) { g.fillStyle(0xc0c8d2, 1); g.fillTriangle(19, -5, 30, 0, 19, 5); g.lineStyle(1, dark, 0.7); g.lineBetween(19, 0, 29, 0); }   // hull-piercer spike
      if (b >= 1) { g.fillStyle(brass, 1); for (let i = 0; i < 5; i++) g.fillRect(-10 + i * 2.6, 9 + i * 0.6, 1.8, 4); }      // ammo belt
      if (b >= 2) { g.fillStyle(brass, 1); for (let i = 0; i < 5; i++) g.fillRect(-10 + i * 2.6, -13 - i * 0.6, 1.8, 4); }    // second belt
      if (b >= 3) { box(-19, -6, 8, 12, 0x5a6472); g.lineStyle(1.2, 0x8a8f96, 1); g.strokeCircle(-15, 0, 3.5); g.lineBetween(-18.5, 0, -11.5, 0); g.lineBetween(-15, -3.5, -15, 3.5); }   // motor + fan
      if (c >= 1) { g.lineStyle(3, 0x5a6878, 1); g.beginPath(); g.arc(4, 0, 13, -0.9, 0.9); g.strokePath(); }               // flak plate
      if (c >= 2) { g.lineStyle(3, 0x5a6878, 1); g.beginPath(); g.arc(4, 0, 13, -1.3, -0.9); g.strokePath(); g.beginPath(); g.arc(4, 0, 13, 0.9, 1.3); g.strokePath(); g.fillStyle(dark, 0.8); [-0.6, 0, 0.6].forEach(t => g.fillCircle(4 + Math.cos(t) * 13, Math.sin(t) * 13, 1)); }
      if (c >= 3) tube(3, 19, 3, 0, 0xb7bec8);                                           // third barrel down the middle
    } else if (type === 'bomber') {
      const can = (y, col) => { g.fillStyle(col, 1); g.fillRoundedRect(-9, y - 3, 13, 6, 3); g.fillStyle(0xffffff, 0.35); g.fillRect(-7, y - 2, 9, 1); g.fillStyle(dark, 1); g.fillRect(4, y - 1, 2, 2); };
      if (a >= 1) can(13, 0x52c47f);                                                      // gas canister
      if (a >= 2) can(-13, 0x52c47f);
      if (a >= 3) { can(13, 0xe5534b); can(-13, 0xe5534b); g.fillStyle(0xe8a020, 0.9); g.fillTriangle(-3, 10, -1, 6, 1, 10); g.fillTriangle(-3, -16, -1, -20, 1, -16); }   // napalm
      if (b >= 1) { g.lineStyle(2, rust, 1); g.strokeCircle(0, 0, 11); }                 // reinforced band
      if (b >= 2) { g.fillStyle(0x8a8f96, 1); for (let i = 0; i < 8; i++) { const t = i * Math.PI / 4; g.fillCircle(Math.cos(t) * 11, Math.sin(t) * 11, 1.2); } }   // rivets
      if (b >= 3) { box(10, -6.5, 8, 13, 0x3a4a5a); g.lineStyle(1, 0x8fb3c9, 1); g.lineBetween(10, -2, 18, -2); g.lineBetween(10, 2, 18, 2); }   // depth-charge drum
      if (c >= 1) tube(12, 20, 8, 0, 0x7a838f);                                           // drainpipe tube
      if (c >= 2) { box(-18, -5, 7, 10, 0x8a6a42); g.fillStyle(brass, 1); [-3, 0, 3].forEach(y => g.fillCircle(-14.5, y, 1.3)); }   // loader tray
      if (c >= 3) { g.lineStyle(2, 0x5a6068, 1); [[-14, -14], [-14, 14], [16, 0]].forEach(([x, y]) => g.lineBetween(0, 0, x, y)); g.fillStyle(0x2a2a2a, 1); g.fillCircle(-14, -14, 2); g.fillCircle(-14, 14, 2); }   // mortar legs
    } else if (type === 'barricade') {
      const net = (r, alpha, w) => { g.lineStyle(w, 0xc9b48a, alpha); g.strokeCircle(0, 0, r); for (let i = 0; i < 8; i++) { const t = i * Math.PI / 4; g.lineBetween(Math.cos(t) * 5, Math.sin(t) * 5, Math.cos(t) * r, Math.sin(t) * r); } g.strokeCircle(0, 0, r * 0.6); };
      if (a >= 1) net(14, 0.7, 1);                                                        // fishing net
      if (a >= 2) net(17, 0.6, 1);
      if (a >= 3) { net(17, 0.95, 2); g.lineStyle(2, 0x6b5232, 1); g.strokeCircle(0, 0, 20); }   // tangle
      const buoys = (n, r) => { for (let i = 0; i < n; i++) { const t = i * Math.PI * 2 / n + 0.3; g.fillStyle(0xe8a020, 1); g.fillCircle(Math.cos(t) * r, Math.sin(t) * r, 2.6); g.fillStyle(0xffffff, 0.8); g.fillRect(Math.cos(t) * r - 2.6, Math.sin(t) * r - 0.6, 5.2, 1.2); } };
      if (b >= 1) buoys(3, 19);
      if (b >= 2) buoys(6, 19);
      if (b >= 3) { g.lineStyle(1, 0xc9b48a, 0.8); g.strokeCircle(0, 0, 19); buoys(6, 19); }
      if (c >= 1) spikes(12, 17, 8, 0xb7bec8, Math.PI / 8);                               // nails
      if (c >= 2) { g.lineStyle(1.3, 0x8a8f96, 1); g.beginPath(); for (let i = 0; i <= 40; i++) { const t = i / 40 * Math.PI * 2, r = 21 + (i % 2 ? 2 : -2); i ? g.lineTo(Math.cos(t) * r, Math.sin(t) * r) : g.moveTo(Math.cos(t) * r, Math.sin(t) * r); } g.strokePath(); }   // barbed wire
      if (c >= 3) { g.lineStyle(1.5, 0xe5534b, 1); g.beginPath(); for (let i = 0; i <= 60; i++) { const t = i / 60 * Math.PI * 4, r = 9 + i / 60 * 12; i ? g.lineTo(Math.cos(t) * r, Math.sin(t) * r) : g.moveTo(Math.cos(t) * r, Math.sin(t) * r); } g.strokePath(); }   // razor coil
    } else if (type === 'siphon') {
      const hose = (r, col) => { g.lineStyle(2.5, col, 1); g.beginPath(); g.arc(-9, 0, r, Math.PI * 0.35, Math.PI * 1.65); g.strokePath(); };
      if (a >= 1) hose(6, 0x8a96a6);                                                      // hose coil
      if (a >= 2) hose(9, 0x8a96a6);
      if (a >= 3) { hose(6, 0xc43a3a); hose(9, 0xc43a3a); g.fillStyle(brass, 1); g.fillRect(14, -2, 5, 4); }   // fire hose + brass nozzle
      const prongs = n => { g.fillStyle(0xd9c9ff, 1); for (let i = 0; i < n; i++) { const t = (i - (n - 1) / 2) * 0.45; g.fillTriangle(6 * Math.cos(t), 6 * Math.sin(t) - 2, 17 * Math.cos(t), 17 * Math.sin(t), 6 * Math.cos(t), 6 * Math.sin(t) + 2); } };
      if (b >= 1) prongs(b + 1);                                                          // splitter / manifold / octopus
      if (c >= 1) { g.lineStyle(2, 0x8a8f96, 1); g.lineBetween(-4, -9, -12, -15); g.fillStyle(0x2a2a2a, 1); g.fillCircle(-12, -15, 2); }   // hand pump
      if (c >= 2) box(-6, 8, 10, 7, 0x4a3f5a, 0x9d7ff0);                                  // bilge pump
      if (c >= 3) { g.fillStyle(0x9d7ff0, 0.35); g.fillCircle(0, 0, 13); g.fillStyle(0xffffff, 1); g.fillCircle(0, 0, 3); }   // engine core glow
    } else if (type === 'harpoon') {
      if (a >= 1) { g.fillStyle(0xc9b48a, 1); g.fillCircle(-3, 0, 6); g.lineStyle(1, 0x8a7448, 1); g.strokeCircle(-3, 0, 4); }   // bigger rope drum
      if (a >= 2) { g.lineStyle(1.4, 0x9aa3ad, 1); g.strokeCircle(-3, 0, 7.5); }                                     // steel cable
      if (a >= 3) { box(-16, -7, 8, 14, 0x3a4452, 0xd9a441); g.fillStyle(brass, 1); g.fillCircle(-12, 0, 2.5); }      // deep-sea winch
      if (b >= 1) { g.fillStyle(0xe5534b, 1); g.fillTriangle(17, -3.5, 14, -6, 15, -2); g.fillTriangle(17, 3.5, 14, 6, 15, 2); }   // barbs
      if (b >= 2) { g.fillStyle(0x7fe3ff, 1); g.fillTriangle(20, -2, 24, 0, 20, 2); }                                 // shield-ripper tip
      if (b >= 3) { g.fillStyle(0xe8a020, 1); g.fillCircle(19, 0, 3); g.fillStyle(0xe5534b, 1); g.fillCircle(19, 0, 1.5); }   // explosive tip
      if (c >= 1) { g.fillStyle(0x5a6068, 1); g.fillRect(-1, 6, 8, 3); }                                              // ratchet
      if (c >= 2) { g.lineStyle(1.6, 0xb7bec8, 1); g.strokeCircle(4, 8, 3); }                                         // gear
      if (c >= 3) { g.fillStyle(0x5a6472, 1); g.fillRect(-2, -9, 20, 4); g.fillStyle(0xdfe6ee, 1); g.fillRect(2, -8, 15, 2); }   // twin launcher
    } else if (type === 'cannon') {
      const hoseLoop = (r, col) => { g.lineStyle(2.4, col, 1); g.beginPath(); g.arc(-8, 0, r, Math.PI * 0.4, Math.PI * 1.6); g.strokePath(); };
      if (a >= 1) hoseLoop(7, 0xc43a3a);                                                   // pump hose
      if (a >= 2) box(-18, -6, 7, 12, 0xc43a3a, 0x6e2222);                                 // fire pump
      if (a >= 3) { g.fillStyle(brass, 1); g.fillRect(17, -5, 4, 10); }                    // firehose nozzle ring
      const fan = n => { g.fillStyle(0xbfefff, 0.9); for (let i = 0; i < n; i++) { const t = (i - (n - 1) / 2) * 0.5; g.fillCircle(Math.cos(t) * 20, Math.sin(t) * 20, 1.8); } };
      if (b >= 1) fan(b === 1 ? 2 : b === 2 ? 3 : 5);                                     // spray jets
      if (c >= 1) box(2, 7, 8, 5, 0xdfe6ee);                                              // brine tank
      if (c >= 2) { g.fillStyle(0x8a7448, 1); [4, 7].forEach(x => g.fillCircle(x, 9.5, 1)); }   // grit
      if (c >= 3) { g.fillStyle(0xe5534b, 0.4); g.fillCircle(0, 0, 12); g.fillStyle(0xffffff, 0.8); [-3, 0, 3].forEach(x => g.fillCircle(x, -13, 1.4)); }   // boiling: heat + steam
    }
  },

  // On the (non-turning) platform: a pip per tier on the paths taken, and a
  // gold rim once any path reaches tier 3
  drawBaseMods(g, type, mods, colour) {
    g.clear();
    const m = mods || [0, 0, 0];
    if (m.some(t => t >= 3)) { g.lineStyle(2, 0xf2c14b, 0.95); g.strokeRoundedRect(-15.5, -15.5, 31, 31, 6); }
    const cols = [0xe8a020, 0x7fe3ff, 0xe5534b];
    let row = 0;
    m.forEach((t, p) => {
      if (!t) return;
      for (let i = 0; i < t; i++) { g.fillStyle(cols[p], 1); g.fillCircle(-10 + i * 5, 19 + row * 5, 1.8); }
      row++;
    });
  },

  tower(scene, x, y, type) {
    const base = scene.add.image(x, y, 'twr_base_' + type).setScale(1 / Art.RES);
    const head = scene.add.image(x, y, 'twr_head_' + type).setScale(1 / Art.RES);
    return { base, head };
  }
};
