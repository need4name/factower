// ── UI.js ─────────────────────────────────────────────────────────────────────
// Shared look & feel. Every scene builds its chrome from these helpers so the
// game reads as one product: same header, same buttons, same dialogs.
//
//   UI.backdrop(scene)                       full-screen background
//   UI.header(scene, { title, sub, onBack, chips })
//   UI.text(scene, x, y, str, preset, overrides)
//   UI.panel(scene, x, y, w, h, opts)        rounded card (centre coords)
//   UI.button(scene, x, y, w, h, opts)       tappable button (centre coords)
//   UI.chip(scene, x, y, kind, value)        currency / material counter
//   UI.icon(scene, x, y, name, size, colour) small vector icon
//   UI.modal(scene, opts)                    dialog over a tap-blocking dimmer
//   UI.toast(scene, text, kind)              short message near the top
//
// Coordinates are game units (390 × 844 portrait canvas).

const UI = {
  // ── Palette ────────────────────────────────────────────────────────────
  C: {
    bg:       0x0a0d12,
    bgTop:    0x111722,
    surface:  0x141a23,
    surface2: 0x1a222d,
    raised:   0x222c39,
    line:     0x2a3544,
    lineSoft: 0x1e2732,
    amber:    0xf2a93b,
    blue:     0x4aa3e8,
    green:    0x52c47f,
    red:      0xe5534b,
    purple:   0x9d7ff0,
    steel:    0x8b9bb0
  },
  T: {
    text:  '#eef2f7',
    dim:   '#a7b2c1',
    mute:  '#6f7b8d',
    faint: '#465163',
    amber: '#f2a93b',
    blue:  '#4aa3e8',
    green: '#52c47f',
    red:   '#e5534b',
    purple:'#9d7ff0',
    dark:  '#0a0d12'
  },
  F: {
    display: '"Chakra Petch", "Arial Narrow", sans-serif',
    body:    'Inter, "Helvetica Neue", Arial, sans-serif'
  },

  HEADER_H: 96,

  hex(n) { return '#' + n.toString(16).padStart(6, '0'); },

  // ── Type presets ───────────────────────────────────────────────────────
  PRESETS: {
    hero:    { font: 'display', size: 44, weight: '700', color: 'amber', ls: 3 },
    title:   { font: 'display', size: 24, weight: '700', color: 'text',  ls: 1 },
    heading: { font: 'display', size: 18, weight: '700', color: 'text',  ls: 0.5 },
    label:   { font: 'display', size: 12, weight: '600', color: 'mute',  ls: 2 },
    tag:     { font: 'display', size: 11, weight: '700', color: 'amber', ls: 1.5 },
    number:  { font: 'display', size: 22, weight: '700', color: 'text',  ls: 0 },
    body:    { font: 'body',    size: 14, weight: '400', color: 'dim',   ls: 0 },
    bodyB:   { font: 'body',    size: 14, weight: '600', color: 'text',  ls: 0 },
    small:   { font: 'body',    size: 12, weight: '500', color: 'mute',  ls: 0 },
    button:  { font: 'display', size: 16, weight: '700', color: 'text',  ls: 1 }
  },

  style(preset, overrides) {
    const p = UI.PRESETS[preset] || UI.PRESETS.body;
    const o = overrides || {};
    const colour = o.color || UI.T[p.color] || p.color;
    const s = {
      fontFamily: UI.F[p.font],
      fontSize:   (o.size || p.size) + 'px',
      fontStyle:  o.weight || p.weight,
      color:      colour,
      letterSpacing: o.ls !== undefined ? o.ls : p.ls
    };
    if (o.wrap)  s.wordWrap = { width: o.wrap, useAdvancedWrap: true };
    if (o.align) s.align = o.align;
    if (o.lineSpacing !== undefined) s.lineSpacing = o.lineSpacing;
    else if (p.font === 'body') s.lineSpacing = 4;
    return s;
  },

  text(scene, x, y, str, preset, overrides) {
    const o = overrides || {};
    const t = scene.add.text(x, y, str, UI.style(preset, o));
    if (o.origin !== undefined) {
      Array.isArray(o.origin) ? t.setOrigin(o.origin[0], o.origin[1]) : t.setOrigin(o.origin);
    }
    if (o.depth !== undefined) t.setDepth(o.depth);
    return t;
  },

  // ── Background ─────────────────────────────────────────────────────────
  backdrop(scene, opts) {
    const o = opts || {};
    const { width, height } = scene.scale;
    const g = scene.add.graphics().setDepth(-10);
    g.fillGradientStyle(UI.C.bgTop, UI.C.bgTop, UI.C.bg, UI.C.bg, 1);
    g.fillRect(0, 0, width, height);
    // Faint engineering dot-grid — gives the dark background some texture
    g.fillStyle(0xffffff, 0.035);
    for (let y = 12; y < height; y += 24) {
      for (let x = 12; x < width; x += 24) g.fillRect(x, y, 1.5, 1.5);
    }
    return g;
  },

  // ── Panel (rounded card) ───────────────────────────────────────────────
  // opts: fill, fillAlpha, stroke, strokeAlpha, radius, accent (left bar colour),
  //       depth, glow (colour of a soft outer glow)
  panel(scene, x, y, w, h, opts) {
    const o = opts || {};
    const g = scene.add.graphics();
    UI.drawPanel(g, x, y, w, h, o);
    if (o.depth !== undefined) g.setDepth(o.depth);
    return g;
  },

  drawPanel(g, x, y, w, h, o) {
    const r  = o.radius !== undefined ? o.radius : 12;
    const lx = x - w / 2, ty = y - h / 2;
    g.clear();
    if (o.glow !== undefined) {
      g.fillStyle(o.glow, 0.10);
      g.fillRoundedRect(lx - 4, ty - 4, w + 8, h + 8, r + 4);
    }
    g.fillStyle(o.fill !== undefined ? o.fill : UI.C.surface, o.fillAlpha !== undefined ? o.fillAlpha : 1);
    g.fillRoundedRect(lx, ty, w, h, r);
    // Top sheen — a 1px lighter line inside the top edge reads as a bevel
    g.fillStyle(0xffffff, 0.035);
    g.fillRoundedRect(lx + 1, ty + 1, w - 2, Math.min(h / 2, 24), { tl: r, tr: r, bl: 0, br: 0 });
    if (o.stroke !== null) {
      g.lineStyle(o.strokeWidth || 1, o.stroke !== undefined ? o.stroke : UI.C.line, o.strokeAlpha !== undefined ? o.strokeAlpha : 1);
      g.strokeRoundedRect(lx, ty, w, h, r);
    }
    if (o.accent !== undefined) {
      g.fillStyle(o.accent, 1);
      g.fillRoundedRect(lx, ty + 10, 4, h - 20, 2);
    }
  },

  // ── Button ─────────────────────────────────────────────────────────────
  // opts: label, sub, variant ('primary'|'secondary'|'ghost'|'danger'|'success'),
  //       colour (accent override), icon, onTap, disabled, depth, size (label px),
  //       guard() → return false to swallow a tap (e.g. while drag-scrolling)
  // Taps fire on pointerup inside the button, after a pointerdown inside it, so
  // a drag that starts on a button doesn't trigger it.
  button(scene, x, y, w, h, opts) {
    const o = opts || {};
    const c = scene.add.container(x, y);
    if (o.depth !== undefined) c.setDepth(o.depth);
    const bg = scene.add.graphics();
    c.add(bg);

    const variants = {
      primary:   { fill: UI.C.amber,    stroke: UI.C.amber, text: UI.T.dark },
      secondary: { fill: UI.C.surface2, stroke: UI.C.line,  text: UI.T.text },
      ghost:     { fill: UI.C.surface,  stroke: UI.C.lineSoft, text: UI.T.dim },
      danger:    { fill: 0x3a1514,      stroke: UI.C.red,   text: '#ff8a83' },
      success:   { fill: UI.C.green,    stroke: UI.C.green, text: UI.T.dark },
      outline:   { fill: UI.C.surface,  stroke: o.colour || UI.C.amber, text: UI.hex(o.colour || UI.C.amber) }
    };
    let v = Object.assign({}, variants[o.variant || 'secondary']);
    if (o.colour !== undefined && o.variant === 'primary') { v.fill = o.colour; v.stroke = o.colour; }

    const iconOff = o.icon ? 14 : 0;
    const labelY  = o.sub ? -8 : 0;
    const label = UI.text(scene, iconOff / 2 + (o.icon ? 6 : 0), labelY, o.label || '', 'button',
      { size: o.size || (h < 44 ? 14 : 16), color: v.text, origin: 0.5 });
    c.add(label);
    let sub = null;
    if (o.sub) {
      sub = UI.text(scene, iconOff / 2 + (o.icon ? 6 : 0), 12, o.sub, 'small',
        { size: 11, color: v.text, origin: 0.5 });
      sub.setAlpha(0.75);
      c.add(sub);
    }
    let icon = null;
    if (o.icon) {
      const iconX = -label.width / 2 - 6;
      icon = UI.icon(scene, iconX, labelY, o.icon, 14, Phaser.Display.Color.HexStringToColor(v.text).color);
      c.add(icon);
    }

    const zone = scene.add.zone(0, 0, w, h).setInteractive();
    c.add(zone);

    let enabled = !o.disabled, pressed = false, hover = false;
    const draw = () => {
      const fill = enabled ? v.fill : UI.C.surface;
      const stroke = enabled ? v.stroke : UI.C.lineSoft;
      UI.drawPanel(bg, 0, 0, w, h, {
        fill, stroke, radius: o.radius !== undefined ? o.radius : Math.min(12, h / 4),
        fillAlpha: 1
      });
      if (enabled && (hover || pressed)) {
        bg.fillStyle(0xffffff, pressed ? 0.10 : 0.05);
        bg.fillRoundedRect(-w / 2, -h / 2, w, h, Math.min(12, h / 4));
      }
      label.setColor(enabled ? v.text : UI.T.faint);
      if (sub) sub.setColor(enabled ? v.text : UI.T.faint);
      if (icon) icon.setAlpha(enabled ? 1 : 0.35);
    };
    draw();

    zone.on('pointerdown', () => { if (!enabled) return; pressed = true; c.setScale(0.97); draw(); });
    zone.on('pointerout',  () => { hover = false; pressed = false; c.setScale(1); draw(); });
    zone.on('pointerover', () => { hover = true; draw(); });
    zone.on('pointerup',   () => {
      const was = pressed;
      pressed = false; c.setScale(1); draw();
      if (!was || !enabled) return;
      if (o.guard && o.guard() === false) return;
      if (o.onTap) o.onTap();
    });

    c.zone = zone;
    c.label = label;
    c.subLabel = sub;
    c.setEnabled = (on) => { enabled = !!on; draw(); return c; };
    c.isEnabled  = () => enabled;
    c.setLabel   = (str, subStr) => { label.setText(str); if (sub && subStr !== undefined) sub.setText(subStr); return c; };
    c.setVariant = (name, colour) => {
      v = Object.assign({}, variants[name]);
      if (colour !== undefined) { v.fill = colour; v.stroke = colour; }
      draw(); return c;
    };
    c.bw = w; c.bh = h;
    return c;
  },

  // ── Header ─────────────────────────────────────────────────────────────
  // Every non-gameplay scene uses this. Title left-aligned next to a round back
  // button; currency chips right-aligned. Returns the content top y.
  header(scene, opts) {
    const o = opts || {};
    const { width } = scene.scale;
    const H = o.height || UI.HEADER_H;
    const depth = o.depth !== undefined ? o.depth : 20;
    const g = scene.add.graphics().setDepth(depth);
    g.fillStyle(UI.C.bg, 0.92);
    g.fillRect(0, 0, width, H);
    g.fillStyle(UI.C.line, 1);
    g.fillRect(0, H - 1, width, 1);
    if (o.accent !== undefined) {
      g.fillStyle(o.accent, 1);
      g.fillRect(0, H - 2, 64, 2);
    }

    const cy = H / 2 + 8;
    let tx = 20;
    if (o.onBack) {
      const back = scene.add.container(38, cy).setDepth(depth + 1);
      const bg = scene.add.graphics();
      const draw = (p) => {
        bg.clear();
        bg.fillStyle(p ? UI.C.raised : UI.C.surface2, 1);
        bg.fillCircle(0, 0, 20);
        bg.lineStyle(1, UI.C.line, 1);
        bg.strokeCircle(0, 0, 20);
      };
      draw(false);
      const ic = UI.icon(scene, -1, 0, 'back', 14, 0xeef2f7);
      const zone = scene.add.zone(0, 0, 52, 52).setInteractive();
      back.add([bg, ic, zone]);
      let pressed = false;
      zone.on('pointerdown', () => { pressed = true; draw(true); });
      zone.on('pointerout',  () => { pressed = false; draw(false); });
      zone.on('pointerup',   () => { if (!pressed) return; pressed = false; draw(false); o.onBack(); });
      tx = 70;
    }

    const title = UI.text(scene, tx, o.sub ? cy - 10 : cy, o.title || '', 'title',
      { origin: [0, 0.5], depth: depth + 1, size: o.titleSize || 22, color: o.titleColor });
    let sub = null;
    if (o.sub) {
      sub = UI.text(scene, tx, cy + 13, o.sub, 'label', { origin: [0, 0.5], depth: depth + 1, size: 11 });
    }

    // Right-aligned chips
    const chips = {};
    let rx = width - 16;
    (o.chips || []).slice().reverse().forEach(ch => {
      const chip = UI.chip(scene, 0, cy, ch.kind, ch.value, { depth: depth + 1 });
      chip.x = rx - chip.cw / 2;
      rx -= chip.cw + 6;
      chips[ch.kind] = chip;
    });

    return { height: H, title, sub, chips, gfx: g };
  },

  // ── Currency / material chip ───────────────────────────────────────────
  CHIP_KINDS: {
    nuts:   { icon: 'nut',   colour: 0xf2a93b, label: 'NUTS' },
    bolts:  { icon: 'bolt',  colour: 0x7cc4f2, label: 'BOLTS' },
    parts:  { icon: 'gear',  colour: 0xf2a93b, label: 'PARTS' },
    scrap:  { icon: 'scrap', colour: 0x4aa3e8, label: 'SCRAP' },
    metal:  { icon: 'metal', colour: 0x52c47f, label: 'METAL' },
    towers: { icon: 'shield', colour: 0xeef2f7, label: 'TOWERS' }
  },

  chip(scene, x, y, kind, value, opts) {
    const o = opts || {};
    const k = UI.CHIP_KINDS[kind] || UI.CHIP_KINDS.nuts;
    const c = scene.add.container(x, y);
    if (o.depth !== undefined) c.setDepth(o.depth);
    const txt = UI.text(scene, 0, 0, String(value), 'number', { size: 15, origin: [0, 0.5] });
    const w = Math.max(54, txt.width + 38);
    const bg = scene.add.graphics();
    const draw = () => {
      bg.clear();
      bg.fillStyle(UI.C.surface2, 1);
      bg.fillRoundedRect(-c.cw / 2, -15, c.cw, 30, 15);
      bg.lineStyle(1, UI.C.line, 1);
      bg.strokeRoundedRect(-c.cw / 2, -15, c.cw, 30, 15);
    };
    c.cw = w;
    draw();
    const ic = UI.icon(scene, -w / 2 + 16, 0, k.icon, 13, k.colour);
    txt.x = -w / 2 + 28;
    c.add([bg, ic, txt]);
    c.setValue = (v) => {
      txt.setText(String(v));
      const nw = Math.max(54, txt.width + 38);
      if (nw !== c.cw) { c.cw = nw; draw(); ic.x = -nw / 2 + 16; txt.x = -nw / 2 + 28; }
      return c;
    };
    // Lets legacy code that set "40 NUTS"-style strings drive a chip
    c.setText = (str) => c.setValue(parseInt(String(str), 10) || 0);
    c.pulse = () => scene.tweens.add({ targets: c, scaleX: 1.12, scaleY: 1.12, duration: 120, yoyo: true });
    return c;
  },

  // ── Icons ──────────────────────────────────────────────────────────────
  // Small vector icons drawn with Graphics, centred on (x, y).
  icon(scene, x, y, name, size, colour) {
    const g = scene.add.graphics({ x, y });
    const s = (size || 16) / 16;
    const col = colour !== undefined ? colour : 0xeef2f7;
    g.lineStyle(2 * s, col, 1);
    g.fillStyle(col, 1);
    const poly = (pts, fill) => {
      const P = pts.map(p => new Phaser.Math.Vector2(p[0] * s, p[1] * s));
      if (fill) g.fillPoints(P, true); else g.strokePoints(P, true);
    };
    switch (name) {
      case 'back':
        g.lineStyle(2.4 * s, col, 1);
        g.beginPath(); g.moveTo(3 * s, -6 * s); g.lineTo(-3 * s, 0); g.lineTo(3 * s, 6 * s); g.strokePath();
        break;
      case 'chevron':
        g.lineStyle(2.2 * s, col, 1);
        g.beginPath(); g.moveTo(-3 * s, -6 * s); g.lineTo(3 * s, 0); g.lineTo(-3 * s, 6 * s); g.strokePath();
        break;
      case 'nut': {
        const pts = [];
        for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; pts.push([Math.cos(a) * 7.5, Math.sin(a) * 7.5]); }
        poly(pts, true);
        g.fillStyle(UI.C.surface2, 1); g.fillCircle(0, 0, 3 * s);
        break;
      }
      case 'bolt':
        poly([[1, -8], [-5, 1], [-0.5, 1], [-2, 8], [5, -1.5], [0.5, -1.5]], true);
        break;
      case 'gear': {
        for (let i = 0; i < 8; i++) {
          const a = i * Math.PI / 4;
          g.fillRect((Math.cos(a) * 6 - 1.6) * s, (Math.sin(a) * 6 - 1.6) * s, 3.2 * s, 3.2 * s);
        }
        g.fillCircle(0, 0, 5.2 * s);
        g.fillStyle(UI.C.surface2, 1); g.fillCircle(0, 0, 2.2 * s);
        break;
      }
      case 'scrap':
        g.fillRoundedRect(-6 * s, -6 * s, 12 * s, 12 * s, 3 * s);
        break;
      case 'metal':
        poly([[0, -7], [7, 6], [-7, 6]], true);
        break;
      case 'shield':
        poly([[0, -8], [7, -5], [6, 3], [0, 8], [-6, 3], [-7, -5]], false);
        break;
      case 'factory':
        g.strokeRect(-7 * s, -1 * s, 14 * s, 8 * s);
        poly([[-7, -1], [-7, -6], [-2, -3], [-2, -6], [3, -3], [3, -8], [7, -8], [7, -1]], false);
        break;
      case 'anchor':
        g.strokeCircle(0, -5.5 * s, 2 * s);
        g.lineBetween(0, -3.5 * s, 0, 7 * s);
        g.lineBetween(-4 * s, -1 * s, 4 * s, -1 * s);
        g.beginPath(); g.arc(0, 1 * s, 6 * s, 0.2, Math.PI - 0.2); g.strokePath();
        break;
      case 'signal':
        g.fillCircle(0, 5 * s, 2 * s);
        g.beginPath(); g.arc(0, 5 * s, 6 * s, -2.4, -0.74); g.strokePath();
        g.beginPath(); g.arc(0, 5 * s, 10 * s, -2.4, -0.74); g.strokePath();
        break;
      case 'coins':
        g.strokeEllipse(-2 * s, 2 * s, 11 * s, 6 * s);
        g.strokeEllipse(2 * s, -3 * s, 11 * s, 6 * s);
        break;
      case 'house':
        poly([[-7, -1], [0, -7], [7, -1], [7, 7], [-7, 7]], false);
        break;
      case 'lock':
        g.fillRoundedRect(-6 * s, -1 * s, 12 * s, 9 * s, 2 * s);
        g.beginPath(); g.arc(0, -2 * s, 4 * s, Math.PI, 0); g.strokePath();
        g.lineBetween(-4 * s, -2 * s, -4 * s, 0); g.lineBetween(4 * s, -2 * s, 4 * s, 0);
        break;
      case 'check':
        g.lineStyle(2.4 * s, col, 1);
        g.beginPath(); g.moveTo(-6 * s, 0); g.lineTo(-2 * s, 5 * s); g.lineTo(7 * s, -5 * s); g.strokePath();
        break;
      case 'play':
        poly([[-4, -7], [7, 0], [-4, 7]], true);
        break;
      case 'pause':
        g.fillRect(-6 * s, -7 * s, 4 * s, 14 * s); g.fillRect(2 * s, -7 * s, 4 * s, 14 * s);
        break;
      case 'ff':
        poly([[-8, -6], [0, 0], [-8, 6]], true); poly([[0, -6], [8, 0], [0, 6]], true);
        break;
      case 'trash':
        g.strokeRect(-5 * s, -3 * s, 10 * s, 10 * s);
        g.lineBetween(-7 * s, -5 * s, 7 * s, -5 * s);
        g.lineBetween(-2 * s, -7 * s, 2 * s, -7 * s);
        break;
      case 'star':
        poly([[0, -8], [2.3, -2.5], [8, -2.5], [3.5, 1.2], [5, 7.5], [0, 4], [-5, 7.5], [-3.5, 1.2], [-8, -2.5], [-2.3, -2.5]], true);
        break;
      default:
        g.fillCircle(0, 0, 5 * s);
    }
    return g;
  },

  // ── Modal dialog ───────────────────────────────────────────────────────
  // opts: title, body, accent, icon, buttons: [{ label, variant, onTap, keepOpen }],
  //       depth, width, dismissOnBackdrop, onClose
  // The dimmer is interactive, so taps never fall through to the scene behind.
  modal(scene, opts) {
    const o = opts || {};
    const { width, height } = scene.scale;
    const depth = o.depth !== undefined ? o.depth : 200;
    const w = o.width || width - 48;
    const accent = o.accent !== undefined ? o.accent : UI.C.amber;
    const items = [];

    const dim = scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.72)
      .setInteractive().setDepth(depth);
    items.push(dim);

    const bodyT = o.body ? UI.text(scene, 0, 0, o.body, 'body', { wrap: w - 48, size: 14, color: UI.T.dim }) : null;
    const extraH = o.extraHeight || 0;
    const bodyH = bodyT ? bodyT.height : 0;
    const btns  = o.buttons || [{ label: 'OK', variant: 'primary' }];
    const btnRows = btns.length > 2 ? btns.length : 1;
    const h = 28 + (o.icon ? 46 : 0) + 30 + (bodyT ? bodyH + 14 : 0) + extraH + 16 + btnRows * 58 + 6;
    const cy = height / 2;
    const top = cy - h / 2;

    const panel = UI.panel(scene, width / 2, cy, w, h, { fill: UI.C.surface, stroke: accent, strokeAlpha: 0.55, radius: 16, depth: depth + 1 });
    items.push(panel);

    let y = top + 26;
    if (o.icon) {
      const ring = scene.add.graphics().setDepth(depth + 2);
      ring.fillStyle(accent, 0.14); ring.fillCircle(width / 2, y + 18, 22);
      ring.lineStyle(1.5, accent, 0.8); ring.strokeCircle(width / 2, y + 18, 22);
      items.push(ring, UI.icon(scene, width / 2, y + 18, o.icon, 18, accent).setDepth(depth + 3));
      y += 46;
    }
    const titleT = UI.text(scene, width / 2, y + 12, o.title || '', 'heading', { size: 20, origin: 0.5, depth: depth + 2, align: 'center', wrap: w - 40 });
    items.push(titleT);
    y += 30;
    if (bodyT) {
      bodyT.setPosition(width / 2, y + 4).setOrigin(0.5, 0).setAlign('center').setDepth(depth + 2);
      items.push(bodyT);
      y += bodyH + 14;
    }
    const contentY = y;
    y += extraH + 16;

    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      items.forEach(e => e && e.destroy && e.destroy());
      if (o.onClose) o.onClose();
    };

    const bw = btns.length === 2 ? (w - 52) / 2 : w - 40;
    btns.forEach((b, i) => {
      let bx = width / 2, by = y + 24 + i * 58;
      if (btns.length === 2) { bx = width / 2 + (i === 0 ? -1 : 1) * (bw / 2 + 6); by = y + 24; }
      const btn = UI.button(scene, bx, by, bw, 48, {
        label: b.label, variant: b.variant || 'secondary', depth: depth + 3, colour: b.colour,
        onTap: () => { if (!b.keepOpen) close(); if (b.onTap) b.onTap(); }
      });
      items.push(btn);
    });

    if (o.dismissOnBackdrop) {
      dim.on('pointerup', (p) => { if (Math.abs(p.y - cy) > h / 2 || Math.abs(p.x - width / 2) > w / 2) close(); });
    }

    // Pop-in
    const pops = items.slice(1);
    pops.forEach(e => { if (e.setAlpha) e.setAlpha(0); });
    scene.tweens.add({ targets: pops, alpha: 1, duration: 140 });

    return { close, items, contentY, add: (obj) => { obj.setDepth && obj.setDepth(depth + 3); items.push(obj); return obj; } };
  },

  // ── Toast ──────────────────────────────────────────────────────────────
  // kind: 'info' | 'good' | 'bad' | 'warn'
  toast(scene, text, kind, opts) {
    const o = opts || {};
    const { width } = scene.scale;
    const col = { info: UI.C.blue, good: UI.C.green, bad: UI.C.red, warn: UI.C.amber }[kind || 'info'];
    if (scene._uiToast && scene._uiToast.scene) scene._uiToast.destroy();
    const c = scene.add.container(width / 2, o.y || UI.HEADER_H + 26).setDepth(o.depth || 150);
    const t = UI.text(scene, 0, 0, text, 'bodyB', { size: 13, origin: 0.5, wrap: width - 80, align: 'center' });
    const w = Math.min(width - 32, t.width + 40), h = t.height + 18;
    const g = scene.add.graphics();
    g.fillStyle(UI.C.surface2, 0.97); g.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
    g.lineStyle(1, col, 0.8);       g.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
    g.fillStyle(col, 1);            g.fillRoundedRect(-w / 2, -h / 2 + 6, 3, h - 12, 1.5);
    c.add([g, t]);
    c.setAlpha(0); c.y -= 8;
    scene.tweens.add({ targets: c, alpha: 1, y: c.y + 8, duration: 160 });
    scene.time.delayedCall(o.duration || 2400, () => {
      if (!c.active) return;
      scene.tweens.add({ targets: c, alpha: 0, duration: 220, onComplete: () => c.destroy() });
    });
    scene._uiToast = c;
    return c;
  },

  // ── Scene transition ───────────────────────────────────────────────────
  go(scene, key, data) {
    if (scene._uiLeaving) return;
    scene._uiLeaving = true;
    scene.cameras.main.fadeOut(180, 10, 13, 18);
    scene.time.delayedCall(180, () => scene.scene.start(key, data));
  },

  fadeIn(scene) {
    scene._uiLeaving = false;
    scene.cameras.main.fadeIn(200, 10, 13, 18);
  }
};

// ── Crisp text on high-DPI phones ────────────────────────────────────────────
// The canvas is 390 game units wide and is scaled up to the screen, so text
// rasterised at 1× looks soft on a 3× display. Render every Text object's
// texture at the device pixel ratio instead (capped at 3).
(function () {
  if (typeof Phaser === 'undefined') return;
  const res = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
  const proto = Phaser.GameObjects.GameObjectFactory.prototype;
  const orig  = proto.text;
  proto.text = function (x, y, text, style) {
    const st = Object.assign({ resolution: res }, style || {});
    // Older scenes asked for 'monospace'; give them the game's display face
    // so every screen shares one typographic voice.
    if (st.fontFamily === 'monospace') st.fontFamily = UI.F.display;
    // Nothing on a phone should be smaller than ~10px
    const px = parseFloat(st.fontSize);
    if (px && px < 10) st.fontSize = '10px';
    return orig.call(this, x, y, text, st);
  };
})();
