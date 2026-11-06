const must = (ok, msg) => { if (!ok) { console.log('FAIL: ' + msg); process.exitCode = 1; } };
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('**/phaser.min.js', r => r.fulfill({ path: require.resolve('phaser/dist/phaser.min.js'), contentType: 'application/javascript' }));
  await p.addInitScript(() => { let P; Object.defineProperty(window, 'Phaser', { configurable: true, get: () => P, set: v => {
      const G = v.Game; v.Game = function (c) { const g = new G(c); window.__game = g; return g; }; P = v; } }); });
  await p.goto(process.env.BASE_URL + '/index.html'); await p.waitForFunction(() => window.__game);
  await p.evaluate(() => { localStorage.setItem('factower_active_slot', '0'); localStorage.setItem('factower_save_0', JSON.stringify({ saveVersion: 1, stockpile: { gunner: 3 }, completedLevels: { storyline1: [1, 2] }, flags: {}, tutorials: {}, factory: { tutorialComplete: true } })); });
  await p.evaluate(() => window.__game.scene.getScenes(true).forEach(x => x.scene.start('DockScene')));
  await p.waitForTimeout(800);
  await p.evaluate(() => window.__game.scene.getScene('DockScene').showLevelList(LEVEL_DATA.storylines[0]));
  await p.waitForTimeout(400); await p.screenshot({ path: process.env.OUT + '/dock.png' });
  console.log('errors:', errs); if (errs.length) process.exitCode = 1; await b.close();
})();
