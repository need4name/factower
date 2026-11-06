const must = (ok, msg) => { if (!ok) { console.log('FAIL: ' + msg); process.exitCode = 1; } };
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' @ ' + (e.stack || '').split('\n').slice(1,3).join(' | '))); p.on('console', m => m.type()==='error' && errs.push(m.text()));
  await p.route('**/phaser.min.js', r => r.fulfill({ path: require.resolve('phaser/dist/phaser.min.js'), contentType: 'application/javascript' }));
  await p.addInitScript(() => { let P; Object.defineProperty(window, 'Phaser', { configurable: true, get: () => P, set: v => {
      const G = v.Game; v.Game = function (c) { const g = new G(c); window.__game = g; return g; }; P = v; } }); });
  await p.goto(process.env.BASE_URL + '/index.html'); await p.waitForFunction(() => window.__game);
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('factower_active_slot', '0'); localStorage.setItem('factower_save_0', JSON.stringify({ saveVersion: 1, nuts: 10, bolts: 10, stockpile: { gunner: 3 }, completedLevels: { storyline1: [1,2,3,4,5,6,7], storyline2: [1,2,3] }, storySeen: { intro: true }, flags: { baseTutDone: true, beltGuideSeen: true, towerTutorialsSeen: { bomber: true, barricade: true, gunner2: true } }, tutorials: { chrome: true, ricochet: true, doubleDown: true, combat1: true }, workers: 2, worker2Introduced: true, factory: { tutorialComplete: true, factoryVersion: 2 }, factoryActive: true })); });
  await p.evaluate(() => window.__game.scene.getScenes(true).forEach(x => x.scene.start('BaseScene')));
  await p.waitForTimeout(800);
  const active = () => p.evaluate(() => window.__game.scene.getScenes(true).map(s => s.scene.key).join(','));
  // hub tile centres (2 cols): from BaseScene layout
  const tiles = await p.evaluate(() => window.__game.scene.getScene('BaseScene').zoneSpots.map(s => ({ x: s.x, y: s.y })));
  const backXY = { x: 38, y: 56 };
  const log = [];
  for (let round = 0; round < 20; round++) {
    const i = round % 5, t = tiles[i];
    const delayIn = [0, 60, 150, 250, 400][round % 5], delayOut = [0, 50, 120, 300, 600][(round * 3) % 5];
    await p.mouse.click(t.x, t.y); await p.waitForTimeout(delayIn);
    await p.mouse.click(t.x, t.y);                     // double tap
    await p.waitForTimeout(3000 + delayOut);
    const a1 = await active();
    await p.mouse.click(backXY.x, backXY.y); await p.waitForTimeout(40); await p.mouse.click(backXY.x, backXY.y);
    await p.waitForTimeout(3500);
    let a2 = await active();
    if (a2 !== 'BaseScene') {   // maybe in a sub-view (dock levels) or still transitioning
      await p.waitForTimeout(2500); a2 = await active();
      if (a2 !== 'BaseScene') { await p.mouse.click(backXY.x, backXY.y); await p.waitForTimeout(3500); a2 = await active(); }
    }
    log.push(round + ': ' + a1 + ' -> ' + a2);
    if (a2 !== 'BaseScene') { console.log('STUCK at round', round, a1, a2); await p.screenshot({ path: process.env.OUT + '/stuck.png' }); break; }
  }
  console.log(log.slice(-6).join('\n'));
  // also check camera state of base (black screen = frozen look)
  console.log('base camera fade alpha:', await p.evaluate(() => { const c = window.__game.scene.getScene('BaseScene').cameras.main; return [c.fadeEffect.alpha, c.fadeEffect.isRunning, c.fadeEffect.isComplete]; }));
  console.log('errors:', errs); if (errs.length) process.exitCode = 1; await b.close();
})();
