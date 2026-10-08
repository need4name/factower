// ── Coach.js ──────────────────────────────────────────────────────────────────
// Spotlight tutorial overlay.
//
// Darkens the whole screen except a "hole" around the thing the player should
// tap next, with a card explaining what to do and why. The dark area is
// interactive, so stray taps are swallowed and the player can't wander off the
// guided path; the hole has no blocker, so taps there reach the real button.
//
//   const coach = new Coach(scene);
//   coach.show({
//     target: { x, y, w, h },      // centre + size of the spotlight; omit for a centred card
//     title:  'Build an Assembly Bench',
//     body:   'Benches turn raw materials into towers.',
//     step: 1, total: 6,           // optional "STEP 1 / 6" tag
//     button: { label: 'NEXT', onTap },   // optional; without it, the player must tap the target
//     mode:   'block' | 'hint'     // 'hint' = no dimmer, card only, nothing blocked
//   });
//   coach.hide();

class Coach {
  constructor(scene, opts) {
    this.scene = scene;
    this.depth = (opts && opts.depth) || 300;
    this.items = [];
    this.key   = null;   // id of the step on screen; show() with the same key is a no-op
  }

  isShowing(key) { return this.items.length > 0 && (key === undefined || this.key === key); }

  hide() {
    this.items.forEach(e => { if (e && e.destroy) e.destroy(); });
    this.items = [];
    this.key = null;
    if (this._pulse) { this._pulse.stop(); this._pulse = null; }
  }

  destroy() { this.hide(); }

  show(o) {
    if (o.key !== undefined && this.key === o.key && this.items.length) return;
    this.hide();
    this.key = o.key !== undefined ? o.key : null;

    const scene = this.scene;
    const { width, height } = scene.scale;
    const D = this.depth;
    const mode = o.mode || 'block';
    const t = o.target;
    const pad = o.pad !== undefined ? o.pad : 8;

    // ── Dimmer with a hole ──────────────────────────────────────────────
    if (mode === 'block') {
      const alpha = o.dim !== undefined ? o.dim : 0.72;
      const mk = (x, y, w, h) => {
        if (w <= 0 || h <= 0) return;
        const r = scene.add.rectangle(x + w / 2, y + h / 2, w, h, 0x05070a, alpha).setDepth(D).setInteractive();
        this.items.push(r);
      };
      if (t) {
        const L = Math.max(0, t.x - t.w / 2 - pad), R = Math.min(width, t.x + t.w / 2 + pad);
        const T = Math.max(0, t.y - t.h / 2 - pad), B = Math.min(height, t.y + t.h / 2 + pad);
        mk(0, 0, width, T);                 // above
        mk(0, B, width, height - B);        // below
        mk(0, T, L, B - T);                 // left
        mk(R, T, width - R, B - T);         // right
      } else {
        mk(0, 0, width, height);
      }
    }

    // ── Pulsing outline around the target ───────────────────────────────
    this._ring = null;
    if (t) {
      const ring = scene.add.graphics().setDepth(D + 1);
      const w = t.w + pad * 2, h = t.h + pad * 2;
      ring.lineStyle(3, UI.C.amber, 1);
      ring.strokeRoundedRect(t.x - w / 2, t.y - h / 2, w, h, Math.min(14, h / 3));
      this.items.push(ring);
      this._ring = ring;
      this._pulse = scene.tweens.add({ targets: ring, alpha: 0.35, duration: 650, yoyo: true, repeat: -1 });

      if (o.finger !== false && mode === 'block' && !o.button) {
        // A small "tap here" marker bobbing beside the target
        const fx = t.x + Math.min(t.w / 2, 60) - 6, fy = t.y + t.h / 2 + pad + 2;
        const finger = scene.add.container(fx, fy).setDepth(D + 3);
        const fg = scene.add.graphics();
        fg.fillStyle(UI.C.amber, 1);
        fg.fillTriangle(0, -10, -8, 4, 8, 4);
        const lbl = UI.text(scene, 0, 14, 'TAP', 'tag', { size: 11, origin: 0.5, color: UI.T.amber });
        finger.add([fg, lbl]);
        this.items.push(finger);
        scene.tweens.add({ targets: finger, y: fy + 6, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
    }

    // ── Explanation card ────────────────────────────────────────────────
    const cardW = width - 32;
    const inner = cardW - 36;
    const tag   = o.step ? ('STEP ' + o.step + (o.total ? ' / ' + o.total : '')) : (o.tag || null);
    const tagT  = tag ? UI.text(scene, 0, 0, tag, 'tag', { size: 11 }) : null;
    const titleT = UI.text(scene, 0, 0, o.title || '', 'heading', { size: 18, wrap: inner });
    const bodyT  = o.body ? UI.text(scene, 0, 0, o.body, 'body', { size: 14, wrap: inner, color: UI.T.dim }) : null;
    const btnH   = o.button ? 46 : 0;
    const cardH  = 18 + (tagT ? 20 : 0) + titleT.height + (bodyT ? 8 + bodyT.height : 0) + (o.button ? 16 + btnH : 0) + 18;

    // Place the card on whichever side of the target has room
    let cy;
    if (o.cardBottom !== undefined) {
      cy = o.cardBottom - cardH / 2;          // anchored, e.g. just above a toolbar
    } else if (!t) {
      cy = o.cardY !== undefined ? o.cardY : height / 2;
    } else {
      const spaceAbove = t.y - t.h / 2 - pad;
      const spaceBelow = height - (t.y + t.h / 2 + pad);
      const below = o.placement === 'below' || (o.placement !== 'above' && spaceBelow >= spaceAbove);
      const gap = 26;
      cy = below ? t.y + t.h / 2 + pad + gap + cardH / 2 + (o.button ? 0 : 22)
                 : t.y - t.h / 2 - pad - gap - cardH / 2;
      cy = Phaser.Math.Clamp(cy, cardH / 2 + 12, height - cardH / 2 - 12);
    }
    const top = cy - cardH / 2;

    const panel = UI.panel(scene, width / 2, cy, cardW, cardH, {
      fill: 0x121820, stroke: UI.C.amber, strokeAlpha: 0.7, radius: 14, depth: D + 2, glow: UI.C.amber
    });
    this.items.push(panel);

    let y = top + 18;
    const lx = width / 2 - cardW / 2 + 18;
    if (tagT) { tagT.setPosition(lx, y).setDepth(D + 3); this.items.push(tagT); y += 20; }
    titleT.setPosition(lx, y).setDepth(D + 3); this.items.push(titleT); y += titleT.height;
    if (bodyT) { y += 8; bodyT.setPosition(lx, y).setDepth(D + 3); this.items.push(bodyT); y += bodyT.height; }
    if (o.button) {
      y += 16;
      const b = UI.button(scene, width / 2 + cardW / 2 - 18 - 70, y + btnH / 2, 140, btnH, {
        label: o.button.label || 'NEXT', variant: 'primary', depth: D + 4,
        onTap: () => { if (o.button.onTap) o.button.onTap(); }
      });
      this.items.push(b);
      if (o.button.secondary) {
        const s = UI.button(scene, lx + 60, y + btnH / 2, 120, btnH, {
          label: o.button.secondary.label, variant: 'ghost', depth: D + 4,
          onTap: () => { if (o.button.secondary.onTap) o.button.secondary.onTap(); }
        });
        this.items.push(s);
      }
    }

    // Fade in
    const fade = this.items.filter(e => e !== this._ring);
    fade.forEach(e => { if (e.setAlpha) e.setAlpha(0); });
    scene.tweens.add({ targets: fade, alpha: 1, duration: 180 });
  }
}
