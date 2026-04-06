class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create() {
    const { width, height } = this.scale;

    // Background
    this.add.rectangle(width / 2, height / 2, width, height, 0x0a0c0f);

    // Title
    this.add.text(width / 2, height / 2 - 40, 'FACTOWER', {
      fontFamily: 'monospace',
      fontSize: '48px',
      color: '#e8a020',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Subtitle
    this.add.text(width / 2, height / 2 + 20, 'TAP TO START', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#6a7585',
      letterSpacing: 6
    }).setOrigin(0.5);

    // Tap anywhere to continue
    this.input.once('pointerdown', () => {
      console.log('Ready to build.');
    });
  }
}
