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
    localStorage.setItem('factower_save_0', JSON.stringify({ saveVersion: 2, campaign: true, bolts: 0, stockpile: { gunner: 6, gunner2: 6, bomber: 4, harpoon: 3, cannon: 3 }, materials: { plasticScrap: 5, salvagedMetal: 5 },
      completedLevels: { storyline1: [1,2,3,4,5,6,7], storyline2: [1,2,3,4,5,6], storyline3: [1,2,3,4,5,6,7], storyline4: [1,2,3,4], storyline5: [1,2] },
      tutorials: { combat1: true, upgrades: true, salvage: true }, seenEnemies: Object.fromEntries(Object.keys(ENEMY_DATA).map(k => [k, true])), storySeen: Object.fromEntries(Object.keys(STORY_BEATS).map(k => [k, true])), factory: { tutorialComplete: true }, flags: {} })); BUILD.test = false; });
  const go = async (k, d) => { await p.evaluate(([k, d]) => window.__game.scene.getScenes(true).forEach(x => x.scene.start(k, d)), [k, d]); await p.waitForTimeout(1500); };
  // 1. Armoury + contracts
  await go('ArmouryScene');
  await p.screenshot({ path: process.env.OUT + '/s6-armoury.png' });
  console.log('contracts', await p.evaluate(() => JSON.stringify(SaveManager.load().contracts.items.map(o => o && [o.want, o.bolts]))));
  // force a fillable contract and deliver via its button
  await p.evaluate(() => { SaveManager.update(s => { s.contracts.items[0] = { client: 'Test', want: { gunner: 2 }, bolts: 2, plasticScrap: 1, salvagedMetal: 0 }; }); });
  await go('ArmouryScene');
  const btn = await p.evaluate(() => { const a = window.__game.scene.getScene('ArmouryScene'); const t = a.listC.list.find(o => o.text === 'Test'); return t ? { x: 390 - 16 - 56, y: t.y + a.listC.y + 23 } : null; });
  if (btn) await p.mouse.click(btn.x, btn.y);
  await p.waitForTimeout(500);
  console.log('after deliver', await p.evaluate(() => { const s = SaveManager.load(); return JSON.stringify({ bolts: s.bolts, gunner: s.stockpile.gunner, items: s.contracts.items.map(o => o && o.client) }); }));
  // scroll to bottom
  await p.mouse.move(195, 600); await p.mouse.down(); await p.mouse.move(195, 200, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(300);
  await p.screenshot({ path: process.env.OUT + '/s6-armoury-scrolled.png' });
  // 2. Endless: build and launch via Dock
  await go('DockScene');
  await p.evaluate(() => window.__game.scene.getScene('DockScene').launch(null, true)); await p.waitForTimeout(2000);
  const info = await p.evaluate(() => { const c = window.__game.scene.getScene('CombatScene'); const L = c.levelData;
    return JSON.stringify({ waves: L.waves.length, twists: L.twists, w0: L.waves[0].enemies.map(g => g.type + 'x' + g.count), w9: L.waves[9].enemies.map(g => g.type + 'x' + g.count + '@' + g.hp.toFixed(2)), w4: L.waves[4].enemies.map(g => g.type + 'x' + g.count) }); });
  console.log('endless', info); must(JSON.parse(info).waves === 60, 'Endless builds 60 waves');
  // 3. Borga: place and pound
  await p.evaluate(() => { const c = window.__game.scene.getScene('CombatScene');
    const cand = []; for (let x = 30; x < 370; x += 16) for (let y = c.PLAY_TOP + 20; y < c.PLAY_BOTTOM - 10; y += 16) if (c.canPlaceAt(x, y)) cand.push({ x, y });
    ['gunner2', 'harpoon', 'cannon', 'bomber', 'gunner2', 'gunner2'].forEach(t => { let best = null, bs = -1; cand.forEach(s => { if (!c.canPlaceAt(s.x, s.y)) return; const r = c.roadCoverage(s.x, s.y, TOWER_DATA[t].range); if (r > bs) { bs = r; best = s; } }); c.selectedTowerType = t; c.placeTower(best.x, best.y); });
    let best = null, bs = -1; cand.forEach(s => { if (!c.canPlaceAt(s.x, s.y)) return; const r = c.roadCoverage(s.x, s.y, 72); if (r > bs) { bs = r; best = s; } });
    c.castAbility('borga', best.x, best.y);
    c.speed = 3; c.applyTimeScale(); c.startNextWave(); });
  for (let i = 0; i < 20; i++) { await p.evaluate(() => { const c = window.__game.scene.getScene('CombatScene'); if (!c.waveActive && !c.gameOver) c.startNextWave(); if (c.hero && c.abilityCooldownLeft('borga') === 0 && c.activeEnemies.length > 3) c.groundPound(); }); await p.waitForTimeout(1500); if (i === 12) await p.screenshot({ path: process.env.OUT + '/s6-borga.png' }); }
  console.log('borga', await p.evaluate(() => { const c = window.__game.scene.getScene('CombatScene'); return JSON.stringify({ hero: c.hero && { lv: c.hero.level, xp: c.hero.xp }, wave: c.currentWave, base: c.baseHp, dmg: Math.round((c.towerStats.borga || {}).damageDealt || 0) }); }));
  // 4. End the endless run: rewards
  await p.evaluate(() => { const c = window.__game.scene.getScene('CombatScene'); c.currentWave = 12; c.triggerGameOver(false); }); await p.waitForTimeout(800);
  await p.screenshot({ path: process.env.OUT + '/s6-endless-end.png' });
  const es = await p.evaluate(() => SaveManager.load()); console.log('endless save', JSON.stringify({ best: es.endlessBest, bolts: es.bolts, mat: es.materials }));
  must(es.endlessBest === 12, 'Endless saves best wave'); must(es.bolts >= 6, 'contract + Endless pay bolts');
  console.log('errors:', errs); if (errs.length) process.exitCode = 1; await b.close();
})();
