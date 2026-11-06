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
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('factower_active_slot', '0'); localStorage.setItem('factower_save_0', JSON.stringify({ saveVersion: 1, stockpile: { gunner: 6, bomber: 2 }, completedLevels: { storyline1: [1,2,3,4,5,6,7], storyline2: [1,2,3] }, storySeen: { intro: true }, flags: {}, tutorials: { combat1: true }, seenEnemies: { scrapRunner: true, driftwoodHulk: true, frontCommander: true, bilgeRat: true }, factory: { tutorialComplete: true } })); });
  await p.evaluate(() => { const L = LEVEL_DATA.storylines[0].levels[5]; window.__game.scene.getScenes(true).forEach(x => x.scene.start('CombatScene', { storylineId: 1, levelId: L.id, levelData: L })); });
  await p.waitForTimeout(1500);
  await p.evaluate(() => { const c = window.__game.scene.getScene('CombatScene'); const pts = c.pathPoints;
    [[0.3,30],[0.5,-30],[0.7,30]].forEach(([f,o]) => { const i = Math.floor(f*(pts.length-1)); c.selectedTowerType = 'gunner'; c.placeTower(pts[i].x + o, pts[i].y + o); });
    c.selectedTowerType = 'bomber'; c.placeTower(pts[pts.length-2].x + 30, pts[pts.length-2].y - 30);
    c.startNextWave(); });
  await p.waitForTimeout(4500);
  await p.screenshot({ path: process.env.OUT + '/up-0-shots.png' });
  for (let i = 0; i < 80; i++) {
    const k = await p.evaluate(() => { const c = window.__game.scene.getScene('CombatScene'); c.pickups.filter(x => !x.done).forEach(x => c.collectPickup(x)); return c.coach && c.coach.key; });
    if (k === 'up-tap') break; await p.waitForTimeout(700);
  }
  await p.waitForTimeout(400); await p.screenshot({ path: process.env.OUT + '/up-1-tap.png' });
  const t = await p.evaluate(() => { const c = window.__game.scene.getScene('CombatScene'); return { x: c._upTut.tower.x, y: c._upTut.tower.y }; });
  await p.mouse.click(t.x, t.y); await p.waitForTimeout(500);
  await p.screenshot({ path: process.env.OUT + '/up-2-buy.png' });
  const bb = await p.evaluate(() => { const c = window.__game.scene.getScene('CombatScene'); return c._upgradeBtn ? { x: c._upgradeBtn.x, y: c._upgradeBtn.y } : null; });
  await p.mouse.click(bb.x, bb.y); await p.waitForTimeout(500);
  await p.screenshot({ path: process.env.OUT + '/up-3-done.png' });
  console.log(JSON.stringify(await p.evaluate(() => { const c = window.__game.scene.getScene('CombatScene'); return { key: c.coach.key, tier: c._upTut.tower.upgradeTier, paused: c.paused }; })));
  const btn = await p.evaluate(() => { const c = window.__game.scene.getScene('CombatScene'); const x = c.coach.items.find(e => e.label && /BACK TO THE FIGHT/.test(e.label.text)); return { x: x.x, y: x.y }; });
  await p.mouse.click(btn.x, btn.y); await p.waitForTimeout(500);
  console.log(JSON.stringify(await p.evaluate(() => { const c = window.__game.scene.getScene('CombatScene'); return { paused: c.paused, saved: JSON.parse(localStorage.getItem('factower_save_0')).tutorials.upgrades }; })));
  console.log('errors:', errs); if (errs.length) process.exitCode = 1; await b.close();
})();
