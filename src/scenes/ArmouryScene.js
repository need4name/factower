// Nut values per tower type (tune later).
const TOWER_SELL_VALUE = {
  gunner:    1,
  bomber:    2,
  barricade: 2
};

class ArmouryScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ArmouryScene' });
  }

  create() {
    const { width, height } = this.scale;
    const slotIndex = localStorage.getItem('factower_active_slot');
    this.saveKey    = `factower_save_${slotIndex}`;
    this.saveData   = JSON.parse(localStorage.getItem(this.saveKey));

    if (this.saveData.nuts === undefined) this.saveData.nuts = 0;

    this.add.rectangle(width / 2, height / 2, width, height, 0x0d1117);
    this.add.rectangle(width / 2, 144, width, 100, 0x161b22);
    this.add.rectangle(width / 2, 194, width, 1, 0x334455);

    const backBtn = this.add.rectangle(44, 144, 72, 48, 0x1e2530).setInteractive();
    this.add.text(44, 144, '<- BACK', {
      fontFamily: 'monospace', fontSize: '14px', color: '#e8a020'
    }).setOrigin(0.5);
    backBtn.on('pointerdown', () => {
      this.cameras.main.fade(200, 0, 0, 0);
      this.time.delayedCall(200, () => this.scene.start('BaseScene'));
    });
    backBtn.on('pointerover', () => backBtn.setFillStyle(0x252c38));
    backBtn.on('pointerout',  () => backBtn.setFillStyle(0x1e2530));

    this.add.text(width / 2 + 20, 128, 'ARMOURY', {
      fontFamily: 'monospace', fontSize: '22px', color: '#eef2f8', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.add.text(width / 2 + 20, 152, 'TOWER STOCKPILE', {
      fontFamily: 'monospace', fontSize: '11px', color: '#8899aa', letterSpacing: 2
    }).setOrigin(0.5);

    // Nut counter in header
    this.nutText = this.add.text(width / 2 + 20, 172, 'NUTS: ' + this.saveData.nuts, {
      fontFamily: 'monospace', fontSize: '11px', color: '#e8a020', letterSpacing: 2
    }).setOrigin(0.5);

    this.add.text(24, 214, 'AVAILABLE TOWERS', {
      fontFamily: 'monospace', fontSize: '12px', color: '#8899aa', letterSpacing: 3
    });
    this.add.rectangle(width / 2, 234, width - 48, 1, 0x334455);

    this.drawTowerCards();

    const dockBtn = this.add.rectangle(width / 2, height - 80, width - 48, 64, 0x1a2210).setInteractive();
    this.add.rectangle(width / 2, height - 80, width - 48, 64).setStrokeStyle(1, 0x5eba7d);
    this.add.text(width / 2, height - 80, 'GO TO DOCK ->', {
      fontFamily: 'monospace', fontSize: '17px', color: '#5eba7d', fontStyle: 'bold'
    }).setOrigin(0.5);
    dockBtn.on('pointerdown', () => {
      this.cameras.main.fade(200, 0, 0, 0);
      this.time.delayedCall(200, () => this.scene.start('DockScene'));
    });
    dockBtn.on('pointerover', () => dockBtn.setFillStyle(0x223318));
    dockBtn.on('pointerout',  () => dockBtn.setFillStyle(0x1a2210));
  }

  drawTowerCards() {
    const { width } = this.scale;
    const stockpile = this.saveData.stockpile || {};
    const towerTypes = ['gunner', 'bomber', 'barricade'];

    if (this.cardElements) this.cardElements.forEach(e => e.destroy());
    this.cardElements = [];

    towerTypes.forEach((type, i) => {
      const count      = stockpile[type] || 0;
      const data       = TOWER_DATA[type];
      const y          = 300 + i * 120;
      const colourHex  = '#' + data.colour.toString(16).padStart(6, '0');
      const active     = count > 0;
      const nutValue   = TOWER_SELL_VALUE[type] || 1;

      const bg      = this.add.rectangle(width / 2, y, width - 48, 104, 0x161b22);
      const border  = this.add.rectangle(width / 2, y, width - 48, 104).setStrokeStyle(1, active ? data.colour : 0x334455);
      const accent  = this.add.rectangle(28, y, 6, 80, active ? data.colour : 0x334455);
      const name    = this.add.text(52, y - 32, data.name, { fontFamily: 'monospace', fontSize: '18px', color: active ? '#eef2f8' : '#556677', fontStyle: 'bold' });
      const tier    = this.add.text(52, y - 10, 'TIER ' + data.tier, { fontFamily: 'monospace', fontSize: '11px', color: active ? '#8899aa' : '#334455' });
      const stats   = this.add.text(52, y + 8, 'DMG ' + data.damage + ' · RNG ' + data.range, { fontFamily: 'monospace', fontSize: '11px', color: active ? '#8899aa' : '#334455' });
      const sellRate = this.add.text(52, y + 26, 'SELLS FOR ' + nutValue + ' NUT' + (nutValue === 1 ? '' : 'S'), { fontFamily: 'monospace', fontSize: '10px', color: '#e8a020', letterSpacing: 1 });

      const countTxt = this.add.text(width - 110, y - 24, '' + count, { fontFamily: 'monospace', fontSize: '30px', color: active ? colourHex : '#334455', fontStyle: 'bold' }).setOrigin(1, 0.5);
      const inStock  = this.add.text(width - 110, y + 4, 'IN STOCK', { fontFamily: 'monospace', fontSize: '9px', color: active ? '#8899aa' : '#334455', letterSpacing: 2 }).setOrigin(1, 0.5);

      this.cardElements.push(bg, border, accent, name, tier, stats, sellRate, countTxt, inStock);

      // Sell button on the right — only interactive if count > 0
      const sellBgCol = active ? 0x2a1a08 : 0x161b22;
      const sellBdrCol = active ? 0xe8a020 : 0x334455;
      const sellBg    = this.add.rectangle(width - 56, y, 64, 72, sellBgCol);
      const sellBdr   = this.add.rectangle(width - 56, y, 64, 72).setStrokeStyle(1, sellBdrCol);
      const sellLabel = this.add.text(width - 56, y - 18, 'SELL', { fontFamily: 'monospace', fontSize: '12px', color: active ? '#e8a020' : '#445566', fontStyle: 'bold' }).setOrigin(0.5);
      const sellValue = this.add.text(width - 56, y + 2, '+' + nutValue, { fontFamily: 'monospace', fontSize: '15px', color: active ? '#eef2f8' : '#445566', fontStyle: 'bold' }).setOrigin(0.5);
      const sellSub   = this.add.text(width - 56, y + 20, 'NUT' + (nutValue === 1 ? '' : 'S'), { fontFamily: 'monospace', fontSize: '8px', color: active ? '#8899aa' : '#445566', letterSpacing: 1 }).setOrigin(0.5);

      if (active) {
        sellBg.setInteractive();
        sellBg.on('pointerdown', () => this.confirmSell(type));
        sellBg.on('pointerover', () => sellBg.setFillStyle(0x3a2510));
        sellBg.on('pointerout',  () => sellBg.setFillStyle(sellBgCol));
      }

      this.cardElements.push(sellBg, sellBdr, sellLabel, sellValue, sellSub);
    });

    const totalTowers = towerTypes.reduce((sum, t) => sum + (stockpile[t] || 0), 0);
    if (totalTowers === 0) {
      const a = this.add.text(width / 2, 690, 'NO TOWERS IN STOCK', { fontFamily: 'monospace', fontSize: '14px', color: '#445566', letterSpacing: 3 }).setOrigin(0.5);
      const b = this.add.text(width / 2, 714, 'BUILD TOWERS IN THE FACTORY FIRST', { fontFamily: 'monospace', fontSize: '10px', color: '#334455', letterSpacing: 1 }).setOrigin(0.5);
      this.cardElements.push(a, b);
    }
  }

  confirmSell(type) {
    const { width, height } = this.scale;
    this.dismissConfirm();

    const nutValue = TOWER_SELL_VALUE[type] || 1;
    const data     = TOWER_DATA[type];

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.75).setDepth(50).setInteractive();
    const panelH  = 180;
    const panel   = this.add.rectangle(width / 2, height / 2, width - 48, panelH, 0x0a0c0f).setDepth(51);
    const bdr     = this.add.rectangle(width / 2, height / 2, width - 48, panelH).setStrokeStyle(2, 0xe8a020).setDepth(51);

    const title   = this.add.text(width / 2, height / 2 - 62, 'SELL ' + data.name + '?', { fontFamily: 'monospace', fontSize: '16px', color: '#eef2f8', fontStyle: 'bold' }).setOrigin(0.5).setDepth(52);
    const info    = this.add.text(width / 2, height / 2 - 34, 'You will receive ' + nutValue + ' Nut' + (nutValue === 1 ? '' : 's'), { fontFamily: 'monospace', fontSize: '12px', color: '#8899aa' }).setOrigin(0.5).setDepth(52);

    const confirmBg  = this.add.rectangle(width / 2 + 68, height / 2 + 36, 108, 48, 0x162616).setInteractive().setDepth(52);
    const confirmBdr = this.add.rectangle(width / 2 + 68, height / 2 + 36, 108, 48).setStrokeStyle(1, 0x5eba7d).setDepth(52);
    const confirmTxt = this.add.text(width / 2 + 68, height / 2 + 36, 'CONFIRM', { fontFamily: 'monospace', fontSize: '13px', color: '#5eba7d', fontStyle: 'bold' }).setOrigin(0.5).setDepth(53);

    const cancelBg  = this.add.rectangle(width / 2 - 68, height / 2 + 36, 108, 48, 0x1e2530).setInteractive().setDepth(52);
    const cancelBdr = this.add.rectangle(width / 2 - 68, height / 2 + 36, 108, 48).setStrokeStyle(1, 0x334455).setDepth(52);
    const cancelTxt = this.add.text(width / 2 - 68, height / 2 + 36, 'CANCEL', { fontFamily: 'monospace', fontSize: '13px', color: '#8899aa', fontStyle: 'bold' }).setOrigin(0.5).setDepth(53);

    this.confirmElements = [overlay, panel, bdr, title, info, confirmBg, confirmBdr, confirmTxt, cancelBg, cancelBdr, cancelTxt];

    confirmBg.on('pointerdown', () => this.executeSell(type));
    confirmBg.on('pointerover', () => confirmBg.setFillStyle(0x1e3a1e));
    confirmBg.on('pointerout',  () => confirmBg.setFillStyle(0x162616));

    cancelBg.on('pointerdown', () => this.dismissConfirm());
    cancelBg.on('pointerover', () => cancelBg.setFillStyle(0x252c38));
    cancelBg.on('pointerout',  () => cancelBg.setFillStyle(0x1e2530));

    overlay.on('pointerdown', (p) => {
      // Only dismiss if tapping outside the panel
      if (Math.abs(p.y - height / 2) > panelH / 2 + 4) this.dismissConfirm();
    });
  }

  dismissConfirm() {
    if (this.confirmElements) {
      this.confirmElements.forEach(e => { if (e && e.destroy) e.destroy(); });
      this.confirmElements = null;
    }
  }

  executeSell(type) {
    const stockpile = this.saveData.stockpile || {};
    if (!stockpile[type] || stockpile[type] <= 0) { this.dismissConfirm(); return; }

    const nutValue = TOWER_SELL_VALUE[type] || 1;
    stockpile[type]--;
    this.saveData.nuts = (this.saveData.nuts || 0) + nutValue;
    this.saveData.stockpile = stockpile;
    localStorage.setItem(this.saveKey, JSON.stringify(this.saveData));

    this.nutText.setText('NUTS: ' + this.saveData.nuts);
    this.dismissConfirm();
    this.drawTowerCards();

    // Flash feedback
    const { width } = this.scale;
    const flash = this.add.text(width / 2, 172, '+' + nutValue + ' NUT' + (nutValue === 1 ? '' : 'S'), {
      fontFamily: 'monospace', fontSize: '14px', color: '#e8a020', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(40);
    this.tweens.add({
      targets: flash, y: 140, alpha: 0, duration: 800,
      onComplete: () => flash.destroy()
    });
  }
}
