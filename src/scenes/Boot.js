class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create() {
    const { width, height } = this.scale;
    UI.backdrop(this);
    UI.fadeIn(this);

    const cy = height / 2 - 40;

    // Logo mark — a stylised tower on a factory base
    const mark = this.add.graphics();
    mark.fillStyle(UI.C.amber, 1);
    mark.fillRoundedRect(width / 2 - 26, cy - 112, 52, 10, 3);          // base
    mark.fillRect(width / 2 - 8, cy - 150, 16, 40);                      // tower
    mark.fillTriangle(width / 2 - 16, cy - 150, width / 2 + 16, cy - 150, width / 2, cy - 166);
    mark.fillStyle(UI.C.bg, 1);
    mark.fillRect(width / 2 - 3, cy - 140, 6, 8);                        // window

    UI.text(this, width / 2, cy - 40, 'FACTOWER', 'hero', { size: 52, origin: 0.5, ls: 4 });
    this.add.rectangle(width / 2, cy, 120, 3, UI.C.amber);
    UI.text(this, width / 2, cy + 26, 'BUILD THE TOWERS. HOLD THE ISLAND.', 'label', { origin: 0.5, size: 12, color: UI.T.dim });

    const tap = UI.text(this, width / 2, height - 170, 'TAP TO START', 'heading', { origin: 0.5, size: 18, ls: 4, color: UI.T.text });
    this.tweens.add({ targets: tap, alpha: 0.35, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    UI.text(this, width / 2, height - 40, 'v0.2', 'small', { origin: 0.5, color: UI.T.faint });

    this.input.once('pointerup', () => UI.go(this, 'SaveScene'));
  }
}
