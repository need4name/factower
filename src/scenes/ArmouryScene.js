class ArmouryScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ArmouryScene' });
  }

  create() {
    const { width, height } = this.scale;
    const TOP = 55;

    const slotIndex = localStorage.getItem('factower_active_slot');
    const saveKey   = 'factower_save_' + slotIndex;
    this.saveData   = JSON.parse(localStorage.getItem(saveKey));

    this.add.rectangle(width / 2, height / 2, width, height, 0x0d1117);
    this.add.rectangle(width / 2, TOP + 94, width, 100, 0x161b22);
    this.add.rectangle(width / 2, TOP + 144, width, 1, 0x334455);

    const backBtn = this.add.rectangle(44, TOP + 94, 72, 48, 0x1e2530).setInteractive();
    this.add.text(44, TOP + 94, '<- BACK', {
      fontFamily: 'monospace', fontSize: '14px', color: '#e8a020'
    }).setOrigin(0.5);
    backBtn.on('pointerdown', () => {
      this.cameras.main.fade(200, 0, 0, 0);
      this.time.delayedCall(200, () => this.scene.start('BaseScene'));
    });
    backBtn.on('pointerover', () => backBtn.setFillStyle(0x252c38));
    backBtn.on('pointerout',  () => backBtn.setFillStyle(0x1e2530));

    this.add.text(width / 2 + 20, TOP + 80, 'ARMOURY', {
      fontFamily: 'monospace', fontSize: '22px', color: '#eef2f8', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.add.text(width / 2 + 20, TOP + 108, 'TOWER STOCKPILE', {
      fontFamily: 'monospace', fontSize: '12px', color: '#8899aa', letterSpacing: 2
    }).setOrigin(0.5);

    // --- NEW CURRENCY DISPLAY ---
    const currentNuts = this.saveData.nuts || 0;
    const currentBolts = this.saveData.bolts || 0;
    this.add.text(width - 24, TOP + 94, `${currentNuts} NUTS\n${currentBolts} BOLTS`, {
      fontFamily: 'monospace', fontSize: '12px', color: '#eef2f8', fontStyle: 'bold', align: 'right'
    }).setOrigin(1, 0.5);
    // ----------------------------

    this.add.text(24, TOP + 164, 'AVAILABLE TOWERS', {
      fontFamily: 'monospace', fontSize: '12px', color: '#8899aa', letterSpacing: 3
    });
    this.add.rectangle(width / 2, TOP + 184, width - 48, 1, 0x334455);

    const stockpile  = (this.saveData && this.saveData.stockpile) ? this.saveData.stockpile : {};
    const towerTypes = ['gunner', 'bomber', 'barricade'];

    towerTypes.forEach((type, i) => {
      const count     = stockpile[type] || 0;
      const data      = TOWER_DATA[type];
      const y         = TOP + 260 + i * 130;
      const colourHex = '#' + data.colour.toString(16).padStart(6, '0');
      const active    = count > 0;

      this.add.rectangle(width / 2, y, width - 48, 110, 0x161b22);
      this.add.rectangle(width / 2, y, width - 48, 110).setStrokeStyle(1, active ? data.colour : 0x334455);
      this.add.rectangle(28, y, 6, 86, active ? data.colour : 0x334455);

      this.add.text(52, y - 28, data.name, {
        fontFamily: 'monospace', fontSize: '20px', color: active ? '#eef2f8' : '#556677', fontStyle: 'bold'
      });
      this.add.text(52, y + 4,  'TIER ' + data.tier, {
        fontFamily: 'monospace', fontSize: '12px', color: active ? '#8899aa' : '#334455'
      });
      this.add.text(52, y + 24, 'DMG ' + data.damage + '  ·  RNG ' + data.range, {
        fontFamily: 'monospace', fontSize: '12px', color: active ? '#8899aa' : '#334455'
      });
      this.add.text(width - 36, y - 8, '' + count, {
        fontFamily: 'monospace', fontSize: '36px', color: active ? colourHex : '#334455', fontStyle: 'bold'
      }).setOrigin(1, 0.5);
      this.add.text(width - 36, y + 28, 'IN STOCK', {
        fontFamily: 'monospace', fontSize: '10px', color: active ? '#8899aa' : '#334455', letterSpacing: 2
      }).setOrigin(1, 0.5);

      // --- NEW SCRAP LOGIC ---
      if (active && count >= 10) {
        const scrapYield = data.tier === 1 ? 100 : 250; 
        
        const scrapBtnBg = this.add.rectangle(width - 120, y + 10, 80, 32, 0x1e2530).setOrigin(0.5).setInteractive();
        this.add.rectangle(width - 120, y + 10, 80, 32).setOrigin(0.5).setStrokeStyle(1, 0x556677);
        
        this.add.text(width - 120, y + 10, `SCRAP 10\n(+${scrapYield} NUTS)`, {
          fontFamily: 'monospace', fontSize: '9px', color: '#8899aa', align: 'center'
        }).setOrigin(0.5);

        scrapBtnBg.on('pointerover', () => scrapBtnBg.setFillStyle(0x252c38));
        scrapBtnBg.on('pointerout',  () => scrapBtnBg.setFillStyle(0x1e2530));
        
        scrapBtnBg.on('pointerdown', () => {
          if (this.saveData.stockpile[type] >= 10) {
            this.saveData.stockpile[type] -= 10;
            this.saveData.nuts = (this.saveData.nuts || 0) + scrapYield;
            
            localStorage.setItem(saveKey, JSON.stringify(this.saveData));
            this.scene.restart(); 
          }
        });
      }
      // -----------------------
    });

    const dockBtn = this.add.rectangle(width / 2, height - 80, width - 48, 72, 0x1a2210).setInteractive();
    this.add.rectangle(width / 2, height - 80, width - 48, 72).setStrokeStyle(1, 0x5eba7d);
    this.add.text(width / 2, height - 80, 'GO TO DOCK  ->', {
      fontFamily: 'monospace', fontSize: '18px', color: '#5eba7d', fontStyle: 'bold'
    }).setOrigin(0.5);
    dockBtn.on('pointerdown', () => {
      this.cameras.main.fade(200, 0, 0, 0);
      this.time.delayedCall(200, () => this.scene.start('DockScene'));
    });
    dockBtn.on('pointerover', () => dockBtn.setFillStyle(0x223318));
    dockBtn.on('pointerout',  () => dockBtn.setFillStyle(0x1a2210));
  }
}
