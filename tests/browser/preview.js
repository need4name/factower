const must = (ok, msg) => { if (!ok) { console.log('FAIL: ' + msg); process.exitCode = 1; } };
// The upgrade panel shows current stats and what each mod changes; the
// frame-rate readout switches on from settings.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
  await p.route('**/phaser.min.js', r => r.fulfill({ path: require.resolve('phaser/dist/phaser.min.js'), contentType: 'application/javascript' }));
  await p.addInitScript(() => { let P; Object.defineProperty(window, 'Phaser', { configurable: true, get: () => P, set: v => {
      const G = v.Game; v.Game = function (c) { const g = new G(c); window.__game = g; return g; }; P = v; } }); });
  await p.goto(process.env.BASE_URL + '/index.html'); await p.waitForFunction(() => window.__game);
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('factower_active_slot', '0');
    localStorage.setItem('factower_save_0', JSON.stringify({ saveVersion: 2, campaign: true, stockpile: { gunner: 4, bomber: 2, cannon: 1 },
      completedLevels: { storyline1: [1,2,3,4,5,6,7] }, tutorials: { combat1: true, upgrades: true, salvage: true },
      seenEnemies: Object.fromEntries(Object.keys(ENEMY_DATA).map(k => [k, true])), storySeen: Object.fromEntries(Object.keys(STORY_BEATS).map(k => [k, true])), factory: { tutorialComplete: true }, flags: {} })); BUILD.test = false; });
  await p.evaluate(() => window.__game.scene.getScenes(true).forEach(x => x.scene.start('CombatScene', Object.assign(Progress.parse('p5'), { levelData: Progress.level('p5') }))));
  await p.waitForTimeout(1500);
  const texts = await p.evaluate(() => { const c = window.__game.scene.getScene('CombatScene');
    const cand = []; for (let x = 40; x < 360; x += 16) for (let y = c.PLAY_TOP + 40; y < c.PLAY_BOTTOM - 40; y += 16) if (c.canPlaceAt(x, y)) cand.push({ x, y });
    c.selectedTowerType = 'gunner'; c.placeTower(cand[Math.floor(cand.length / 2)].x, cand[Math.floor(cand.length / 2)].y);
    c.parts = 40; const t = c.placedTowers[0]; c.showUpgradePanel(t);
    return c.upgradePanel.filter(o => o.type === 'Text').map(o => o.text); });
  console.log(texts.join(' | '));
  must(texts.some(t => /^DMG 15/.test(t)), 'panel shows current stats');
  must(texts.some(t => t === 'range 110 → 130'), 'range mod shows 110 → 130');
  must(texts.some(t => /fires 1\.1 → 1\.4\/s/.test(t)), 'fire-rate mod shows the new rate');
  await p.screenshot({ path: process.env.OUT + '/preview-panel.png' });
  // Frame rate readout
  await p.evaluate(() => Settings.set('fps', true)); await p.waitForTimeout(1200);
  const fps = await p.evaluate(() => Settings._fps && Settings._fps.el.textContent);
  console.log('fps readout:', fps); must(/\d+ FPS/.test(fps || ''), 'frame-rate readout appears');
  await p.evaluate(() => Settings.set('fps', false));
  must(await p.evaluate(() => !Settings._fps), 'frame-rate readout switches off');
  console.log('errors:', errs); if (errs.length) process.exitCode = 1; await b.close();
})();
