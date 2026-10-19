// ── Story.js ──────────────────────────────────────────────────────────────────
// Plays a story beat (see data/story.js) as a dialogue overlay: portrait,
// speaker name and line in a panel at the bottom; tap to advance, SKIP to
// jump to the end. Each beat plays once per save (save.storySeen).
//
//   Story.play(scene, 'p1.after', () => { ...carry on... });

const Story = {
  seen(key) {
    const s = SaveManager.load();
    return !!(s && s.storySeen && s.storySeen[key]);
  },

  markSeen(key) {
    SaveManager.update(s => { if (!s.storySeen) s.storySeen = {}; s.storySeen[key] = true; });
  },

  has(key) { return !!STORY_BEATS[key] && !Story.seen(key); },

  play(scene, key, onDone, opts) {
    const lines = STORY_BEATS[key];
    const done = () => { if (onDone) onDone(); };
    if (!lines || (Story.seen(key) && !(opts && opts.replay))) { done(); return null; }

    const { width, height } = scene.scale;
    const D = (opts && opts.depth) || 500;
    const items = [];
    const dim = scene.add.rectangle(width / 2, height / 2, width, height, 0x05070a, 0.78).setDepth(D).setInteractive();
    items.push(dim);
    const panelH = 230, py = height - 16 - panelH / 2;
    const panel = scene.add.graphics().setDepth(D + 1);
    items.push(panel);
    const portrait = scene.add.graphics().setDepth(D + 2);
    const initial = UI.text(scene, 0, 0, '', 'title', { size: 26, origin: 0.5, depth: D + 3, color: UI.T.dark });
    const nameT = UI.text(scene, 0, 0, '', 'heading', { size: 17, origin: [0, 0.5], depth: D + 3 });
    const roleT = UI.text(scene, 0, 0, '', 'small', { size: 11, origin: [0, 0.5], depth: D + 3, color: UI.T.mute });
    const bodyT = UI.text(scene, 0, 0, '', 'body', { size: 15, depth: D + 3, wrap: width - 72, color: UI.T.text, lineSpacing: 5 });
    const hint  = UI.text(scene, width / 2, height - 30, 'TAP TO CONTINUE', 'label', { size: 10, origin: 0.5, depth: D + 3, color: UI.T.faint });
    const counter = UI.text(scene, width - 32, py - panelH / 2 + 22, '', 'label', { size: 10, origin: [1, 0.5], depth: D + 3, color: UI.T.faint });
    items.push(initial, nameT, roleT, bodyT, hint, counter);
    let i = 0, finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      Story.markSeen(key);
      items.forEach(e => e && e.destroy && e.destroy());
      done();
    };
    const skip = UI.button(scene, width - 16 - 40, py - panelH / 2 - 24, 72, 34, { label: 'SKIP', variant: 'ghost', size: 12, depth: D + 4, onTap: finish });
    items.push(skip);

    const show = () => {
      const [who, text] = lines[i];
      const ch = CHARACTERS[who] || CHARACTERS.narrator;
      const narr = who === 'narrator';
      const top = py - panelH / 2;
      UI.drawPanel(panel, width / 2, py, width - 32, panelH, { fill: 0x111720, stroke: narr ? UI.C.line : ch.colour, strokeAlpha: narr ? 1 : 0.7, radius: 18 });
      portrait.clear();
      counter.setText((i + 1) + ' / ' + lines.length);
      if (narr) {
        initial.setText('');
        nameT.setText(''); roleT.setText('');
        bodyT.setPosition(36, top + 44).setColor(UI.T.dim).setFontStyle('italic');
      } else {
        const cx = 16 + 44, cy = top + 46;
        portrait.fillStyle(ch.colour, 1); portrait.fillCircle(cx, cy, 28);
        portrait.lineStyle(3, 0x0a0d12, 1); portrait.strokeCircle(cx, cy, 28);
        initial.setPosition(cx, cy).setText(ch.name.replace(/^Uncle /, '').charAt(0));
        nameT.setPosition(cx + 40, cy - 9).setText(ch.name).setColor(UI.hex(ch.colour));
        roleT.setPosition(cx + 40, cy + 11).setText(ch.role || '');
        bodyT.setPosition(36, top + 92).setColor(UI.T.text).setFontStyle('400');
      }
      bodyT.setText(text).setAlpha(0);
      scene.tweens.add({ targets: bodyT, alpha: 1, duration: 200 });
    };
    dim.on('pointerup', () => { if (finished) return; i++; if (i >= lines.length) finish(); else show(); });
    show();
    return { finish };
  }
};
