const must = (ok, msg) => { if (!ok) { console.log('FAIL: ' + msg); process.exitCode = 1; } };
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
  await p.route('**/phaser.min.js', r => r.fulfill({ path: require.resolve('phaser/dist/phaser.min.js'), contentType: 'application/javascript' }));
  await p.addInitScript(() => { let P; Object.defineProperty(window, 'Phaser', { configurable: true, get: () => P, set: v => {
      const G = v.Game; v.Game = function (c) { const g = new G(c); window.__game = g; return g; }; P = v; } }); });
  await p.goto(process.env.BASE_URL + '/index.html'); await p.waitForFunction(() => window.__game);
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('factower_active_slot', '0');
    localStorage.setItem('factower_save_0', JSON.stringify({ saveVersion: 2, campaign: true, stockpile: { gunner2: 4, harpoon: 3, cannon: 3 }, materials: { plasticScrap: 30, salvagedMetal: 30 },
      completedLevels: { storyline1: [1,2,3,4,5,6,7], storyline2: [1,2,3,4,5,6], storyline3: [1,2,3,4,5,6,7], storyline4: [1,2,3,4], storyline5: [1,2] },
      tutorials: { combat1: true, upgrades: true, salvage: true }, seenEnemies: Object.fromEntries(Object.keys(ENEMY_DATA).map(k => [k, true])), storySeen: Object.fromEntries(Object.keys(STORY_BEATS).map(k => [k, true])), factory: { tutorialComplete: true }, flags: {} })); BUILD.test = false; });
  const go = async (k, d) => { await p.evaluate(([k, d]) => window.__game.scene.getScenes(true).forEach(x => x.scene.start(k, d)), [k, d]); await p.waitForTimeout(1500); };
  await go('CombatScene', await p.evaluate(() => Object.assign(Progress.parse('s3-4'), { levelData: Progress.level('s3-4') })));
  await p.evaluate(() => { const c = window.__game.scene.getScene('CombatScene');
    const cand = []; for (let x = 30; x < 370; x += 16) for (let y = c.PLAY_TOP + 20; y < c.PLAY_BOTTOM - 10; y += 16) if (c.canPlaceAt(x, y)) cand.push({ x, y });
    ['cannon', 'harpoon', 'gunner2', 'cannon', 'harpoon', 'gunner2'].forEach(t => { let best = null, bs = -1; cand.forEach(s => { if (!c.canPlaceAt(s.x, s.y)) return; const r = c.roadCoverage(s.x, s.y, TOWER_DATA[t].range); if (r > bs) { bs = r; best = s; } }); c.selectedTowerType = t; c.placeTower(best.x, best.y); });
    c.parts = 500; c.rare = { plate: 5, engine: 5 };
    // max two paths on the first cannon and harpoon
    const cn = c.placedTowers.find(t => t.type === 'cannon'), hp = c.placedTowers.find(t => t.type === 'harpoon');
    [0, 1].forEach(i => { for (let k = 0; k < 3; k++) { c.applyUpgrade(cn, i); c.applyUpgrade(hp, i === 0 ? 1 : 0); } });
    c.dismissUpgradePanel();
    c.speed = 3; c.applyTimeScale(); c.startNextWave(); });
  // track knockback: max regress of moveTargetIdx
  await p.evaluate(() => { const c = window.__game.scene.getScene('CombatScene'); const orig = c.knockback.bind(c); window.__kb = 0; window.__kbBack = 0;
    c.knockback = (e, d) => { const i0 = e.moveTargetIdx; orig(e, d); window.__kb++; if (e.moveTargetIdx < i0) window.__kbBack++; }; });
  for (let i = 0; i < 30; i++) { await p.evaluate(() => { const c = window.__game.scene.getScene('CombatScene'); if (!c.waveActive && !c.gameOver) c.startNextWave(); }); await p.waitForTimeout(1500); if (i === 20) await p.screenshot({ path: process.env.OUT + '/nt-combat.png' }); }
  console.log(await p.evaluate(() => { const c = window.__game.scene.getScene('CombatScene'); return JSON.stringify({ kb: window.__kb, back: window.__kbBack, hp: c.baseHp, wave: c.currentWave, over: c.gameOver, stats: Object.fromEntries(Object.entries(c.towerStats).map(([k, v]) => [k, Math.round(v.damageDealt || 0)])), cannon: c.placedTowers.find(t => t.type === 'cannon').data, }); }));
  must(await p.evaluate(() => window.__kb > 0), 'Water Cannon pushes raiders back');
  must(await p.evaluate(() => (window.__game.scene.getScene('CombatScene').towerStats.harpoon || {}).damageDealt > 0), 'Harpoon deals damage');
  // Factory bench picker + armoury
  await go('FactoryScene');
  await p.screenshot({ path: process.env.OUT + '/nt-factory.png' });
  await go('ArmouryScene'); await p.screenshot({ path: process.env.OUT + '/nt-armoury.png' });
  console.log('errors:', errs); if (errs.length) process.exitCode = 1; await b.close();
})();
