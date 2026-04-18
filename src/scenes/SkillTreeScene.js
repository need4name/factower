class SkillTreeScene extends Phaser.Scene {
  constructor() {
    super({ key: 'SkillTreeScene' });
  }

  create() {
    const { width, height } = this.scale;
    const TOP = 55;

    const slotIndex = localStorage.getItem('factower_active_slot');
    this.saveKey    = 'factower_save_' + slotIndex;
    this.saveData   = JSON.parse(localStorage.getItem(this.saveKey));

    if (!this.saveData.skillTree) this.saveData.skillTree = {};
    if (this.saveData.bolts === undefined) this.saveData.bolts = 0;

    this.activeBranchIndex = 0;
    this.contentContainer  = null;

    // ── Background
    this.add.rectangle(width / 2, height / 2, width, height, 0x0d1117);

    // ── Header
    this.add.rectangle(width / 2, TOP + 94, width, 100, 0x161b22).setDepth(10);
    this.add.rectangle(width / 2, TOP + 144, width, 1, 0x334455).setDepth(10);

    const backBtn = this.add.rectangle(44, TOP + 94, 72, 48, 0x1e2530).setInteractive().setDepth(11);
    this.add.text(44, TOP + 94, '<- BACK', {
      fontFamily: 'monospace', fontSize: '14px', color: '#e8a020'
    }).setOrigin(0.5).setDepth(11);
    backBtn.on('pointerdown', () => {
      this.cameras.main.fade(200, 0, 0, 0);
      this.time.delayedCall(200, () => this.scene.start('BaseScene'));
    });
    backBtn.on('pointerover', () => backBtn.setFillStyle(0x252c38));
    backBtn.on('pointerout',  () => backBtn.setFillStyle(0x1e2530));

    this.add.text(width / 2 + 20, TOP + 80, 'UPLINK', {
      fontFamily: 'monospace', fontSize: '22px', color: '#eef2f8', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(11);

    // Bolt counter in the header
    const boltGfx = this.add.graphics().setDepth(11);
    boltGfx.fillStyle(0xe8a020, 1);
    const bx = width - 92, by = TOP + 108;
    boltGfx.fillTriangle(bx, by - 6, bx + 6, by + 4, bx - 6, by + 4);
    this.boltCountText = this.add.text(width - 80, TOP + 108, '' + this.saveData.bolts + ' BOLTS', {
      fontFamily: 'monospace', fontSize: '12px', color: '#e8a020', fontStyle: 'bold'
    }).setOrigin(0, 0.5).setDepth(11);

    this.drawTabs();
    this.drawBranch(0);

    // ── Scroll state for tree content
    this._dragStart = undefined;
    this._dragBase  = 0;
    this._dragging  = false;
    this.scrollY    = 0;
    this.scrollMinY = 0;

    this._onDown = (p) => {
      if (p.y < TOP + 210) return;   // do not scroll on header / tabs
      this._dragStart = p.y;
      this._dragBase  = this.scrollY;
      this._dragging  = false;
    };
    this._onMove = (p) => {
      if (this._dragStart === undefined) return;
      const dy = p.y - this._dragStart;
      if (Math.abs(dy) > 5) this._dragging = true;
      if (!this._dragging) return;
      const ny = Phaser.Math.Clamp(this._dragBase + dy, this.scrollMinY, 0);
      if (this.contentContainer) this.contentContainer.setY(ny);
      this.scrollY = ny;
    };
    this._onUp = () => { this._dragStart = undefined; };
    this.input.on('pointerdown', this._onDown);
    this.input.on('pointermove', this._onMove);
    this.input.on('pointerup',   this._onUp);
  }

  // ── Tab bar ──────────────────────────────────────────────────────────
  drawTabs() {
    const { width } = this.scale;
    const TOP = 55;
    const tabY  = TOP + 180;
    const tabH  = 44;
    const tabW  = (width - 28) / SKILL_TREE.branches.length;

    if (this.tabButtons) this.tabButtons.forEach(t => t.destroy());
    this.tabButtons = [];

    SKILL_TREE.branches.forEach((branch, i) => {
      const cx = 14 + tabW * i + tabW / 2;
      const active = i === this.activeBranchIndex;

      const bg  = this.add.rectangle(cx, tabY, tabW - 4, tabH, active ? 0x1e2530 : 0x141a22).setInteractive().setDepth(10);
      const bdr = this.add.rectangle(cx, tabY, tabW - 4, tabH).setStrokeStyle(1, active ? branch.colour : 0x2a3a4a).setDepth(10);
      const label = this.add.text(cx, tabY - 7, branch.id.toUpperCase(), {
        fontFamily: 'monospace', fontSize: '11px',
        color: active ? branch.colourHex : '#556677',
        fontStyle: 'bold', letterSpacing: 2
      }).setOrigin(0.5).setDepth(11);

      // Purchased count indicator
      const purchased  = branch.nodes.filter(n => this.saveData.skillTree[n.id]).length;
      const total      = branch.nodes.length;
      const countLabel = this.add.text(cx, tabY + 10, purchased + '/' + total, {
        fontFamily: 'monospace', fontSize: '9px',
        color: active ? '#eef2f8' : '#445566'
      }).setOrigin(0.5).setDepth(11);

      bg.on('pointerdown', () => {
        if (this.activeBranchIndex === i) return;
        this.activeBranchIndex = i;
        this.scrollY    = 0;
        if (this.contentContainer) this.contentContainer.setY(0);
        this.drawTabs();
        this.drawBranch(i);
      });

      this.tabButtons.push(bg, bdr, label, countLabel);
    });
  }

  // ── Branch tree ──────────────────────────────────────────────────────
  drawBranch(branchIndex) {
    const { width, height } = this.scale;
    const TOP = 55;

    if (this.contentContainer) {
      this.contentContainer.destroy(true);
      this.contentContainer = null;
    }
    this.dismissNodePanel();

    const branch = SKILL_TREE.branches[branchIndex];
    this.contentContainer = this.add.container(0, 0).setDepth(5);

    // Branch header (scrolls with content)
    const topY = TOP + 222;
    const headBg  = this.add.rectangle(width / 2, topY + 30, width - 28, 60, 0x0f1620);
    const headBdr = this.add.rectangle(width / 2, topY + 30, width - 28, 60).setStrokeStyle(1, branch.colour);
    const accent  = this.add.rectangle(22, topY + 30, 4, 44, branch.colour);
    const tHead1  = this.add.text(36, topY + 14, branch.name, { fontFamily: 'monospace', fontSize: '14px', color: branch.colourHex, fontStyle: 'bold', letterSpacing: 2 });
    const tHead2  = this.add.text(36, topY + 36, branch.desc, { fontFamily: 'monospace', fontSize: '10px', color: '#8899aa' });

    this.contentContainer.add([headBg, headBdr, accent, tHead1, tHead2]);

    // Layout nodes in a grid: columns 0–2, tiers going down
    const gridTopY = topY + 78;
    const colW     = (width - 56) / 3;
    const rowH     = 92;
    const nodeR    = 28;

    // Draw connection lines first so they render below nodes
    branch.nodes.forEach(node => {
      node.prereqs.forEach(prereqId => {
        const prereq = branch.nodes.find(n => n.id === prereqId);
        if (!prereq) return;
        const x1 = 28 + colW * prereq.col + colW / 2;
        const y1 = gridTopY + rowH * (prereq.tier - 1) + rowH / 2;
        const x2 = 28 + colW * node.col + colW / 2;
        const y2 = gridTopY + rowH * (node.tier - 1) + rowH / 2;
        const purchased = this.saveData.skillTree[prereqId];
        const line = this.add.graphics();
        line.lineStyle(2, purchased ? branch.colour : 0x2a3a4a, purchased ? 0.55 : 0.35);
        line.lineBetween(x1, y1, x2, y2);
        this.contentContainer.add(line);
      });
    });

    // Draw each node
    branch.nodes.forEach(node => {
      const cx = 28 + colW * node.col + colW / 2;
      const cy = gridTopY + rowH * (node.tier - 1) + rowH / 2;
      const state = this.getNodeState(branch, node);

      let fill, stroke, textCol;
      if (state === 'purchased') {
        fill    = branch.colour;
        stroke  = branch.colour;
        textCol = '#0d1117';
      } else if (state === 'available') {
        fill    = 0x1e2530;
        stroke  = branch.colour;
        textCol = branch.colourHex;
      } else {
        fill    = 0x161b22;
        stroke  = 0x2a3a4a;
        textCol = '#445566';
      }

      const bg    = this.add.circle(cx, cy, nodeR, fill);
      const bdr   = this.add.circle(cx, cy, nodeR).setStrokeStyle(2, stroke);
      const label = this.add.text(cx, cy, this.abbreviate(node.name), {
        fontFamily: 'monospace', fontSize: '9px', color: textCol, fontStyle: 'bold', align: 'center', wordWrap: { width: nodeR * 2 - 6 }
      }).setOrigin(0.5);

      // Capstone visual marker
      if (node.kind === 'capstone') {
        this.contentContainer.add(this.add.circle(cx, cy, nodeR + 4).setStrokeStyle(1, branch.colour, 0.5));
      }
      // Gamechanger diamond notch
      if (node.kind === 'gamechanger' && state !== 'locked') {
        const gx = this.add.graphics();
        gx.fillStyle(branch.colour, 0.9);
        gx.fillTriangle(cx, cy - nodeR - 6, cx + 5, cy - nodeR + 1, cx - 5, cy - nodeR + 1);
        this.contentContainer.add(gx);
      }

      this.contentContainer.add([bg, bdr, label]);

      // Interactive
      bg.setInteractive();
      bg.on('pointerup', () => {
        if (this._dragging) return;
        this.showNodePanel(branch, node, state);
      });
    });

    // Calculate scroll bounds
    const maxTier    = Math.max(...branch.nodes.map(n => n.tier));
    const contentBot = gridTopY + rowH * maxTier + 60;
    this.scrollMinY  = Math.min(0, height - contentBot);
  }

  getNodeState(branch, node) {
    if (this.saveData.skillTree[node.id]) return 'purchased';
    const allPrereqsMet = node.prereqs.every(pid => this.saveData.skillTree[pid]);
    if (allPrereqsMet) return 'available';
    return 'locked';
  }

  abbreviate(name) {
    // Fit long names inside a small circle
    if (name.length <= 8) return name;
    return name.split(' ').map(w => w.substring(0, 5)).join('\n');
  }

  // ── Node detail panel ────────────────────────────────────────────────
  showNodePanel(branch, node, state) {
    this.dismissNodePanel();
    const { width, height } = this.scale;

    const panelH = 220;
    const panelY = height - panelH / 2 - 8;

    const bg  = this.add.rectangle(width / 2, panelY, width - 16, panelH, 0x060c06, 0.98).setDepth(25);
    const bdr = this.add.rectangle(width / 2, panelY, width - 16, panelH).setStrokeStyle(2, branch.colour).setDepth(25);
    const closeBtn = this.add.rectangle(width - 32, panelY - panelH / 2 + 22, 32, 32, 0x1e2530).setInteractive().setDepth(26);
    const closeTxt = this.add.text(width - 32, panelY - panelH / 2 + 22, 'X', { fontFamily: 'monospace', fontSize: '12px', color: '#8899aa', fontStyle: 'bold' }).setOrigin(0.5).setDepth(27);
    closeBtn.on('pointerdown', () => this.dismissNodePanel());

    const panelTop = panelY - panelH / 2;
    const kindStr  = node.kind === 'capstone'    ? 'CAPSTONE'    :
                     node.kind === 'gamechanger' ? 'GAME CHANGER' :
                     node.kind === 'significant' ? 'SIGNIFICANT'  : 'INCREMENTAL';

    const tKind   = this.add.text(24, panelTop + 14, kindStr, { fontFamily: 'monospace', fontSize: '9px', color: branch.colourHex, letterSpacing: 3 }).setDepth(26);
    const tName   = this.add.text(24, panelTop + 30, node.name, { fontFamily: 'monospace', fontSize: '20px', color: '#eef2f8', fontStyle: 'bold' }).setDepth(26);
    const tEffect = this.add.text(24, panelTop + 62, node.effect, { fontFamily: 'monospace', fontSize: '13px', color: '#ccd6e0', wordWrap: { width: width - 56 } }).setDepth(26);

    const prereqsLabel = node.prereqs.length > 0 ? 'REQUIRES: ' + node.prereqs.map(pid => {
      const p = branch.nodes.find(n => n.id === pid);
      return p ? p.name : pid;
    }).join(', ') : 'NO PREREQUISITES';
    const tPrereq = this.add.text(24, panelTop + 100, prereqsLabel, { fontFamily: 'monospace', fontSize: '10px', color: '#556677', wordWrap: { width: width - 56 } }).setDepth(26);

    this.nodePanel = [bg, bdr, closeBtn, closeTxt, tKind, tName, tEffect, tPrereq];

    // Action area
    if (state === 'purchased') {
      const ownTxt = this.add.text(width / 2, panelY + panelH / 2 - 32, '✓ UNLOCKED', { fontFamily: 'monospace', fontSize: '16px', color: branch.colourHex, fontStyle: 'bold', letterSpacing: 3 }).setOrigin(0.5).setDepth(26);
      this.nodePanel.push(ownTxt);
    } else if (state === 'locked') {
      const lockTxt = this.add.text(width / 2, panelY + panelH / 2 - 32, 'LOCKED', { fontFamily: 'monospace', fontSize: '16px', color: '#445566', fontStyle: 'bold', letterSpacing: 3 }).setOrigin(0.5).setDepth(26);
      this.nodePanel.push(lockTxt);
    } else {
      const canAfford = this.saveData.bolts >= node.cost;
      const costTxt   = this.add.text(24, panelY + panelH / 2 - 36, node.cost + ' BOLTS', { fontFamily: 'monospace', fontSize: '18px', color: canAfford ? '#e8a020' : '#c43a3a', fontStyle: 'bold' }).setDepth(26);
      const bgCol     = canAfford ? 0x162616 : 0x161b22;
      const btnBg     = this.add.rectangle(width - 84, panelY + panelH / 2 - 32, 128, 56, bgCol).setInteractive().setDepth(26);
      const btnBdr    = this.add.rectangle(width - 84, panelY + panelH / 2 - 32, 128, 56).setStrokeStyle(1, canAfford ? 0x5eba7d : 0x334455).setDepth(26);
      const btnTxt    = this.add.text(width - 84, panelY + panelH / 2 - 32, 'PURCHASE', { fontFamily: 'monospace', fontSize: '13px', color: canAfford ? '#5eba7d' : '#445566', fontStyle: 'bold' }).setOrigin(0.5).setDepth(27);

      if (canAfford) {
        btnBg.on('pointerdown', () => this.purchaseNode(branch, node));
        btnBg.on('pointerover', () => btnBg.setFillStyle(0x1e3a1e));
        btnBg.on('pointerout',  () => btnBg.setFillStyle(bgCol));
      }

      this.nodePanel.push(costTxt, btnBg, btnBdr, btnTxt);
    }
  }

  dismissNodePanel() {
    if (this.nodePanel) {
      this.nodePanel.forEach(e => { if (e && e.destroy) e.destroy(); });
      this.nodePanel = null;
    }
  }

  purchaseNode(branch, node) {
    if (this.saveData.bolts < node.cost) return;
    if (this.saveData.skillTree[node.id]) return;

    this.saveData.bolts -= node.cost;
    this.saveData.skillTree[node.id] = true;
    localStorage.setItem(this.saveKey, JSON.stringify(this.saveData));

    this.boltCountText.setText('' + this.saveData.bolts + ' BOLTS');
    this.cameras.main.flash(120, branch.colour >> 16 & 0xff, branch.colour >> 8 & 0xff, branch.colour & 0xff, false);
    this.dismissNodePanel();
    this.drawTabs();
    this.drawBranch(this.activeBranchIndex);
    if (this.contentContainer) this.contentContainer.setY(this.scrollY);
  }
}
