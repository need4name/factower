class SkillTreeScene extends Phaser.Scene {
  constructor() {
    super({ key: 'SkillTreeScene' });
  }

  create() {
    const { width } = this.scale;
    this.saveData = SaveManager.load() || {};
    if (!this.saveData.skillTree) this.saveData.skillTree = {};
    if (this.saveData.bolts === undefined) this.saveData.bolts = 0;
    UI.backdrop(this);
    UI.fadeIn(this);

    this.activeBranchIndex = 0;
    this.contentContainer  = null;
    this.nodePanel         = null;

    this.hdr = UI.header(this, {
      title: 'UPLINK', sub: 'PERMANENT UPGRADES', accent: UI.C.amber,
      onBack: () => UI.go(this, 'BaseScene'),
      chips: [{ kind: 'bolts', value: this.saveData.bolts }]
    });

    // Fixed band under the header: branch tabs + status note
    this.TABS_Y  = UI.HEADER_H + 30;
    this.CONTENT_TOP = UI.HEADER_H + 96;
    const band = this.add.graphics().setDepth(18);
    band.fillStyle(UI.C.bg, 0.96);
    band.fillRect(0, UI.HEADER_H, width, this.CONTENT_TOP - UI.HEADER_H - 6);
    UI.text(this, width / 2, this.TABS_Y + 38, 'Factory, Base and Gambling upgrades are live. Marked ones are coming soon.', 'small',
      { origin: 0.5, size: 11, color: UI.T.amber, depth: 19 });

    this.drawTabs();
    this.drawBranch(0);

    // ── Drag-to-scroll ───────────────────────────────────────────────────
    this._dragStart = undefined; this._dragBase = 0; this._dragging = false;
    this.scrollY = 0; this.scrollMinY = 0;
    this._onDown = (p) => {
      if (p.y < this.CONTENT_TOP || this.nodePanel) return;
      this._dragStart = p.y; this._dragBase = this.scrollY; this._dragging = false;
    };
    this._onMove = (p) => {
      if (this._dragStart === undefined) return;
      const dy = p.y - this._dragStart;
      if (Math.abs(dy) > 8) this._dragging = true;
      if (!this._dragging) return;
      const ny = Phaser.Math.Clamp(this._dragBase + dy, this.scrollMinY, 0);
      if (this.contentContainer) this.contentContainer.setY(ny);
      this.scrollY = ny;
    };
    this._onUp = () => { this._dragStart = undefined; this.time.delayedCall(0, () => { this._dragging = false; }); };
    this.input.on('pointerdown', this._onDown);
    this.input.on('pointermove', this._onMove);
    this.input.on('pointerup',   this._onUp);
  }

  // ── Branch tabs ──────────────────────────────────────────────────────
  drawTabs() {
    const { width } = this.scale;
    const n = SKILL_TREE.branches.length;
    const tabW = (width - 32) / n, tabH = 46;
    if (this.tabItems) this.tabItems.forEach(t => t.destroy());
    this.tabItems = [];

    const track = this.add.graphics().setDepth(19);
    track.fillStyle(UI.C.surface, 1);
    track.fillRoundedRect(16, this.TABS_Y - tabH / 2, width - 32, tabH, 12);
    this.tabItems.push(track);

    SKILL_TREE.branches.forEach((branch, i) => {
      const cx = 16 + tabW * i + tabW / 2;
      const active = i === this.activeBranchIndex;
      const bought = branch.nodes.filter(nd => this.saveData.skillTree[nd.id]).length;
      if (active) {
        const g = this.add.graphics().setDepth(19);
        g.fillStyle(UI.C.raised, 1);
        g.fillRoundedRect(cx - tabW / 2 + 3, this.TABS_Y - tabH / 2 + 3, tabW - 6, tabH - 6, 9);
        g.fillStyle(branch.colour, 1);
        g.fillRoundedRect(cx - 10, this.TABS_Y + tabH / 2 - 7, 20, 3, 1.5);
        this.tabItems.push(g);
      }
      this.tabItems.push(
        UI.text(this, cx, this.TABS_Y - 6, branch.id.toUpperCase(), 'tag',
          { size: 9.5, origin: 0.5, ls: 0.5, depth: 20, color: active ? branch.colourHex : UI.T.mute }),
        UI.text(this, cx, this.TABS_Y + 9, bought + '/' + branch.nodes.length, 'small',
          { size: 10, origin: 0.5, depth: 20, color: active ? UI.T.text : UI.T.faint })
      );
      const zone = this.add.zone(cx, this.TABS_Y, tabW, tabH).setInteractive().setDepth(21);
      zone.on('pointerup', () => {
        if (this.activeBranchIndex === i || this.nodePanel) return;
        this.activeBranchIndex = i;
        this.scrollY = 0;
        this.drawTabs();
        this.drawBranch(i);
      });
      this.tabItems.push(zone);
    });
  }

  // ── Branch tree ──────────────────────────────────────────────────────
  drawBranch(branchIndex) {
    const { width, height } = this.scale;
    if (this.contentContainer) { this.contentContainer.destroy(true); this.contentContainer = null; }
    this.dismissNodePanel();

    const branch = SKILL_TREE.branches[branchIndex];
    const C = this.add.container(0, 0).setDepth(5);
    this.contentContainer = C;

    const top = this.CONTENT_TOP + 6;
    C.add([
      UI.text(this, 16, top, branch.name, 'heading', { size: 18, color: branch.colourHex }),
      UI.text(this, 16, top + 26, branch.desc, 'small', { size: 12 })
    ]);

    const gridTop = top + 62;
    const colW = (width - 32) / 3;
    const rowH = 100;
    const nodeW = colW - 12, nodeH = 74;
    const pos = nd => ({ x: 16 + colW * nd.col + colW / 2, y: gridTop + rowH * (nd.tier - 1) + nodeH / 2 });

    // Connectors first so they sit under the nodes
    const lines = this.add.graphics();
    C.add(lines);
    branch.nodes.forEach(nd => nd.prereqs.forEach(pid => {
      const p = branch.nodes.find(n => n.id === pid);
      if (!p) return;
      const a = pos(p), b = pos(nd);
      const lit = !!this.saveData.skillTree[pid];
      lines.lineStyle(2, lit ? branch.colour : UI.C.line, lit ? 0.7 : 1);
      lines.beginPath();
      lines.moveTo(a.x, a.y + nodeH / 2);
      lines.lineTo(a.x, (a.y + b.y) / 2);
      lines.lineTo(b.x, (a.y + b.y) / 2);
      lines.lineTo(b.x, b.y - nodeH / 2);
      lines.strokePath();
    }));

    branch.nodes.forEach(nd => {
      const { x, y } = pos(nd);
      const state = this.getNodeState(nd);
      const bought = state === 'purchased', avail = state === 'available', soon = state === 'soon';
      const g = this.add.graphics();
      UI.drawPanel(g, x, y, nodeW, nodeH, {
        fill: bought ? branch.colour : avail ? UI.C.surface2 : 0x10151c,
        fillAlpha: bought ? 0.22 : 1,
        stroke: bought || avail ? branch.colour : UI.C.lineSoft,
        strokeAlpha: avail ? 0.9 : 1, strokeWidth: nd.kind === 'capstone' ? 2 : 1, radius: 12
      });
      C.add(g);
      if (nd.kind === 'gamechanger' || nd.kind === 'capstone') {
        C.add(UI.icon(this, x + nodeW / 2 - 12, y - nodeH / 2 + 12, 'star', 9, state === 'locked' ? 0x465163 : branch.colour));
      }
      C.add(UI.text(this, x, y - 8, nd.name, 'heading', {
        size: 12.5, origin: 0.5, align: 'center', wrap: nodeW - 14, lineSpacing: -2,
        color: state === 'locked' || soon ? UI.T.faint : UI.T.text
      }));
      C.add(bought
        ? UI.icon(this, x, y + 22, 'check', 12, branch.colour)
        : UI.text(this, x, y + 22, soon ? 'COMING SOON' : nd.cost + ' bolts', soon ? 'label' : 'small', { size: soon ? 9.5 : 11, origin: 0.5, color: avail ? UI.T.amber : UI.T.faint }));

      const zone = this.add.zone(x, y, nodeW, nodeH).setInteractive();
      zone.on('pointerup', () => { if (!this._dragging && !this.nodePanel) this.showNodePanel(branch, nd, state); });
      C.add(zone);
    });

    const maxTier = Math.max(...branch.nodes.map(n => n.tier));
    const contentBot = gridTop + rowH * maxTier + 30;
    this.scrollMinY = Math.min(0, height - contentBot);
  }

  getNodeState(node) {
    if (this.saveData.skillTree[node.id]) return 'purchased';
    if (!skillTreeEffects.isImplemented(node)) return 'soon';
    return node.prereqs.every(pid => this.saveData.skillTree[pid]) ? 'available' : 'locked';
  }

  // ── Node detail sheet ────────────────────────────────────────────────
  showNodePanel(branch, node, state) {
    this.dismissNodePanel();
    const { width, height } = this.scale;
    const items = [];
    const dim = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.55).setInteractive().setDepth(40);
    dim.on('pointerup', () => this.dismissNodePanel());
    items.push(dim);

    const kind = { capstone: 'CAPSTONE', gamechanger: 'GAME CHANGER', significant: 'MAJOR', incremental: 'MINOR' }[node.kind] || '';
    const w = width - 24, lx = 12 + 22;
    const effT = UI.text(this, lx, 0, node.effect, 'body', { size: 14, wrap: w - 44, color: UI.T.dim });
    const prereqNames = node.prereqs.map(pid => (branch.nodes.find(n => n.id === pid) || { name: pid }).name);
    const preT = UI.text(this, lx, 0, prereqNames.length ? 'Requires: ' + prereqNames.join(', ') : 'No requirements', 'small', { size: 12, wrap: w - 44 });
    const h = 20 + 18 + 30 + effT.height + 10 + preT.height + 20 + 52 + 22;
    const top = height - h - 12;

    items.push(UI.panel(this, width / 2, top + h / 2, w, h, { fill: UI.C.surface, stroke: branch.colour, strokeAlpha: 0.7, radius: 18, depth: 41 }));
    // Panel must swallow taps so they don't close the sheet
    items.push(this.add.zone(width / 2, top + h / 2, w, h).setInteractive().setDepth(41));
    let y = top + 20;
    items.push(UI.text(this, lx, y, branch.name + '  ·  ' + kind, 'tag', { size: 11, color: branch.colourHex, depth: 42 })); y += 18;
    items.push(UI.text(this, lx, y, node.name, 'title', { size: 22, depth: 42 })); y += 32;
    effT.setY(y).setDepth(42); items.push(effT); y += effT.height + 10;
    preT.setY(y).setDepth(42); items.push(preT); y += preT.height + 20;

    const by = y + 26;
    if (state === 'purchased') {
      items.push(UI.button(this, width / 2, by, w - 44, 52, { label: 'OWNED', variant: 'ghost', disabled: true, depth: 43 }));
    } else if (state === 'soon') {
      items.push(UI.button(this, width / 2, by, w - 44, 52, { label: 'COMING SOON', variant: 'ghost', disabled: true, depth: 43 }));
    } else if (state === 'locked') {
      items.push(UI.button(this, width / 2, by, w - 44, 52, { label: 'LOCKED — UNLOCK REQUIREMENTS FIRST', variant: 'ghost', disabled: true, depth: 43, size: 13 }));
    } else {
      const afford = this.saveData.bolts >= node.cost;
      items.push(UI.button(this, width / 2, by, w - 44, 52, {
        label: afford ? 'UNLOCK FOR ' + node.cost + ' BOLTS' : 'NEED ' + node.cost + ' BOLTS (HAVE ' + this.saveData.bolts + ')',
        variant: 'primary', colour: branch.colour, disabled: !afford, depth: 43, size: afford ? 16 : 13,
        onTap: () => this.purchaseNode(branch, node)
      }));
    }
    this.nodePanel = items;
  }

  dismissNodePanel() {
    if (this.nodePanel) { this.nodePanel.forEach(e => e && e.destroy && e.destroy()); this.nodePanel = null; }
  }

  purchaseNode(branch, node) {
    if (this.saveData.bolts < node.cost) return;
    if (this.saveData.skillTree[node.id]) return;
    if (!node.prereqs.every(pid => this.saveData.skillTree[pid])) return;
    if (!skillTreeEffects.isImplemented(node)) return;

    this.saveData = SaveManager.update(s => {
      if (!s.skillTree) s.skillTree = {};
      s.bolts = (s.bolts || 0) - node.cost;
      s.skillTree[node.id] = true;
    }) || this.saveData;

    this.hdr.chips.bolts.setValue(this.saveData.bolts).pulse();
    this.cameras.main.flash(120, branch.colour >> 16 & 0xff, branch.colour >> 8 & 0xff, branch.colour & 0xff, false);
    this.dismissNodePanel();
    const keepY = this.scrollY;
    this.drawTabs();
    this.drawBranch(this.activeBranchIndex);
    this.scrollY = Phaser.Math.Clamp(keepY, this.scrollMinY, 0);
    if (this.contentContainer) this.contentContainer.setY(this.scrollY);
    UI.toast(this, node.name + ' unlocked', 'good');
  }
}
