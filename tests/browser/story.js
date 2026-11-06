const must = (ok, msg) => { if (!ok) { console.log('FAIL: ' + msg); process.exitCode = 1; } };
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' @ ' + (e.stack || '').split('\n')[1])); p.on('console', m => m.type()==='error' && errs.push(m.text()));
  await p.route('**/phaser.min.js', r => r.fulfill({ path: require.resolve('phaser/dist/phaser.min.js'), contentType: 'application/javascript' }));
  await p.addInitScript(() => { let P; Object.defineProperty(window, 'Phaser', { configurable: true, get: () => P, set: v => {
      const G = v.Game; v.Game = function (c) { const g = new G(c); window.__game = g; return g; }; P = v; } }); });
  await p.goto(process.env.BASE_URL + '/index.html'); await p.waitForFunction(() => window.__game);
  const shot = (n) => p.screenshot({ path: process.env.OUT + '/st-' + n + '.png' });
  const go = async (k, d, ms = 1500) => { await p.evaluate(([k, d]) => window.__game.scene.getScenes(true).forEach(x => x.scene.start(k, d)), [k, d]); await p.waitForTimeout(ms); };
  // 1. New save: intro on base
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('factower_active_slot', '0'); localStorage.setItem('factower_save_0', JSON.stringify({ saveVersion: 2, stockpile: {}, completedLevels: {}, flags: {}, tutorials: {}, factory: {} })); BUILD.test = false; });
  await go('BaseScene', null, 2200); await shot('1-intro');
  for (let i = 0; i < 3; i++) { await p.mouse.click(195, 300); await p.waitForTimeout(300); }
  await shot('2-intro3');
  // 2. Dock after prologue 1-3
  await p.evaluate(() => { localStorage.setItem('factower_save_0', JSON.stringify({ saveVersion: 2, stockpile: { gunner: 6, barricade: 2 }, completedLevels: { storyline1: [1,2,3] }, flags: {}, tutorials: { combat1: true }, storySeen: { intro: true }, factory: { tutorialComplete: true } })); });
  await go('DockScene'); await shot('3-dock');
  await p.evaluate(() => { const d = window.__game.scene.getScene('DockScene'); d.showLevelList(Progress.storyline(1)); });
  await p.waitForTimeout(500); await shot('4-prologue');
  await p.evaluate(() => { const d = window.__game.scene.getScene('DockScene'); d.launch(Progress.level('p4'), false, Progress.storyline(1)); });
  await p.waitForTimeout(900); await shot('5-before');
  for (let i = 0; i < 6; i++) { await p.mouse.click(195, 300); await p.waitForTimeout(250); }
  await p.waitForTimeout(1800);
  console.log('scene', await p.evaluate(() => window.__game.scene.getScenes(true).map(s => s.scene.key).join()));
  await p.evaluate(() => { const r = window.__game.scene.getScene('RaidScene'); r.deploy('barricade'); });
  await p.waitForTimeout(1300); await p.evaluate(() => window.__game.scene.getScene('RaidScene').deploy('gunner'));
  await p.waitForTimeout(1300); await p.evaluate(() => window.__game.scene.getScene('RaidScene').deploy('gunner'));
  await p.waitForTimeout(5000); await shot('6-raid');
  // 3. Base after p5 → market open
  await p.evaluate(() => { localStorage.setItem('factower_save_0', JSON.stringify({ saveVersion: 2, stockpile: { gunner: 6 }, completedLevels: { storyline1: [1,2,3,4,5] }, flags: {}, tutorials: {}, storySeen: { intro: true }, factory: { tutorialComplete: true } })); });
  await go('BaseScene'); await shot('7-base');
  console.log('errors:', errs); if (errs.length) process.exitCode = 1; await b.close();
})();
