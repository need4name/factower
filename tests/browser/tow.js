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
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('factower_active_slot', '0'); localStorage.setItem('factower_save_0', JSON.stringify({ saveVersion: 2, stockpile: { gunner: 6, gunner2: 3, bomber: 3, barricade: 2, siphon: 3 }, completedLevels: { storyline1: [1,2,3,4,5,6,7], storyline2: [1,2,3,4,5,6] }, flags: { beltGuideSeen: true, towerTutorialsSeen: { bomber: true, barricade: true, gunner2: true } }, tutorials: { combat1: true, upgrades: true, salvage: true }, seenEnemies: { scrapRunner: true, salvSkiff: true, salvCutter: true }, storySeen: { intro: true }, workers: 2, worker2Introduced: true, factory: { tutorialComplete: true }, materials: { plasticScrap: 50, salvagedMetal: 50 } })); BUILD.test = false; });
  const go = async (k, d, ms = 1500) => { await p.evaluate(([k, d]) => window.__game.scene.getScenes(true).forEach(x => x.scene.start(k, d)), [k, d]); await p.waitForTimeout(ms); };
  await go('ArmouryScene'); await p.screenshot({ path: process.env.OUT + '/tow-armoury.png' });
  await go('FactoryScene', null, 2000); await p.screenshot({ path: process.env.OUT + '/tow-factory-card.png' });
  await p.evaluate(() => { const s = window.__game.scene.getScene('FactoryScene'); s.children.list.filter(o => o.depth >= 200).forEach(o => o.destroy && o.destroy()); s.showAssemblyTypeMenu(0, 0); });
  await p.waitForTimeout(500); await p.screenshot({ path: process.env.OUT + '/tow-benches.png' });
  await p.evaluate(() => window.__game.scene.getScenes(true).forEach(x => x.scene.start('CombatScene', { storylineId: 2, levelId: 3, levelData: Progress.level('s1-3') })));
  await p.waitForTimeout(1500);
  await p.evaluate(() => { const c = window.__game.scene.getScene('CombatScene'); const pts = c.pathPoints;
    const spots = []; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b2 = pts[i+1]; for (const f of [0.3, 0.7]) { const x = a.x + (b2.x - a.x) * f, y = a.y + (b2.y - a.y) * f; for (const [ox, oy] of [[0, 34], [0, -34], [34, 0], [-34, 0]]) spots.push({ x: x + ox, y: y + oy }); } }
    let k = 0; ['siphon','siphon','gunner2','gunner2','gunner','gunner','bomber','gunner','barricade'].forEach(t => { for (let tries = 0; tries < spots.length; tries++) { const s = spots[(k++) % spots.length]; if (c.canPlaceAt(s.x, s.y)) { c.selectedTowerType = t; c.placeTower(s.x, s.y); break; } } });
    c.startNextWave(); });
  await p.waitForTimeout(6000); await p.screenshot({ path: process.env.OUT + '/tow-combat.png' });
  for (let i = 0; i < 200; i++) { const o = await p.evaluate(() => { const c = window.__game.scene.getScene('CombatScene'); c.pickups.filter(x => !x.done).forEach(x => c.collectPickup(x)); if (!c.waveActive && !c.gameOver) c.startNextWave(); return c.gameOver; }); if (o) break; await p.waitForTimeout(700); }
  console.log('combat', JSON.stringify(await p.evaluate(() => { const c = window.__game.scene.getScene('CombatScene'); return { hp: c.baseHp, stats: c.towerStats, parts: c.parts }; })));
  await p.evaluate(() => window.__game.scene.getScenes(true).forEach(x => x.scene.start('RaidScene', { storylineId: 1, levelId: 4, levelData: Progress.level('p4') })));
  await p.waitForTimeout(1500);
  await p.evaluate(() => { const r = window.__game.scene.getScene('RaidScene'); r.deploy('barricade'); });
  for (const t of ['siphon', 'gunner2', 'gunner']) { await p.waitForTimeout(1300); await p.evaluate((t) => window.__game.scene.getScene('RaidScene').deploy(t), t); }
  await p.waitForTimeout(3000); await p.screenshot({ path: process.env.OUT + '/tow-raid.png' });
  console.log('errors:', errs); if (errs.length) process.exitCode = 1; await b.close();
})();
