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
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('factower_active_slot', '0'); localStorage.setItem('factower_save_0', JSON.stringify({ saveVersion: 2, stockpile: { gunner: 8, bomber: 4, barricade: 2 }, completedLevels: { storyline1: [1,2,3,4] }, flags: {}, tutorials: { combat1: true, upgrades: true, salvage: true }, seenEnemies: { scrapRunner: true, bilgeRat: true, driftwoodHulk: true }, storySeen: { intro: true, 'p5.before': true }, factory: { tutorialComplete: true } })); BUILD.test = false; });
  await p.evaluate(() => { const L = Progress.level('p5'); window.__game.scene.getScenes(true).forEach(x => x.scene.start('CombatScene', { storylineId: 1, levelId: 5, levelData: L })); });
  await p.waitForTimeout(1500);
  await p.evaluate(() => { const c = window.__game.scene.getScene('CombatScene'); const pts = c.pathPoints;
    const spots = []; for (let i = 1; i < pts.length - 1; i++) spots.push({ x: (pts[i].x + pts[i+1].x) / 2, y: (pts[i].y + pts[i+1].y) / 2 + 38 });
    let k = 0; ['gunner','gunner','gunner','gunner','bomber','bomber'].forEach(t => { for (let tries = 0; tries < spots.length; tries++) { const s = spots[(k++) % spots.length]; if (c.canPlaceAt(s.x, s.y)) { c.selectedTowerType = t; c.placeTower(s.x, s.y); break; } } });
    c.placedTowers[0].targetMode = 'strong'; c.baseHp = 60; c.startNextWave(); });
  let early = null;
  for (let i = 0; i < 60; i++) {
    await p.waitForTimeout(500);
    const st = await p.evaluate(() => { const c = window.__game.scene.getScene('CombatScene'); c.pickups.filter(x => !x.done).forEach(x => c.collectPickup(x)); return { can: c.canCallEarly(), lbl: c.startWaveBtn.label.text, wave: c.currentWave, act: c.waveActive, alive: c.activeEnemies.length }; });
    if (st.can) { early = st; break; }
  }
  console.log('early available', JSON.stringify(early));
  await p.screenshot({ path: process.env.OUT + '/abil-early.png' });
  const b4 = await p.evaluate(() => window.__game.scene.getScene('CombatScene').parts);
  const btn = await p.evaluate(() => { const b = window.__game.scene.getScene('CombatScene').startWaveBtn; return { x: b.x, y: b.y }; });
  await p.mouse.click(btn.x, btn.y); await p.waitForTimeout(600);
  console.log('after call', JSON.stringify(await p.evaluate(() => { const c = window.__game.scene.getScene('CombatScene'); return { wave: c.currentWave, total: c.waveEnemyTotal, pending: c._pendingSpawns, parts: c.parts }; })), 'parts before', b4);
  // abilities: tap flare then road point with enemies
  await p.waitForTimeout(3000);
  const ab = await p.evaluate(() => { const c = window.__game.scene.getScene('CombatScene'); const e = c.activeEnemies.find(x => x.alive); const f = c.abilityBtns.flare.c, n = c.abilityBtns.net.c; return { f: { x: f.x, y: f.y }, n: { x: n.x, y: n.y }, e: e ? { x: e.sprite.x, y: e.sprite.y, hp: e.hp } : null }; });
  await p.mouse.click(ab.f.x, ab.f.y); await p.waitForTimeout(200);
  await p.mouse.move(ab.e.x, ab.e.y); await p.waitForTimeout(100); await p.screenshot({ path: process.env.OUT + '/abil-aim.png' });
  await p.mouse.click(ab.e.x, ab.e.y); await p.waitForTimeout(1200);
  await p.mouse.click(ab.n.x, ab.n.y); await p.waitForTimeout(200);
  const e2 = await p.evaluate(() => { const c = window.__game.scene.getScene('CombatScene'); const e = c.activeEnemies.find(x => x.alive); return e ? { x: e.sprite.x, y: e.sprite.y } : null; });
  if (e2) await p.mouse.click(e2.x, e2.y);
  await p.waitForTimeout(500); await p.screenshot({ path: process.env.OUT + '/abil-cd.png' });
  console.log('cooldowns', JSON.stringify(await p.evaluate(() => { const c = window.__game.scene.getScene('CombatScene'); return { flare: Math.round(c.abilityCooldownLeft('flare')), net: Math.round(c.abilityCooldownLeft('net')), netted: c.activeEnemies.filter(e => e.netUntil > c.simNow).length, flareDmg: c.towerStats }; })));
  // run to the end
  for (let i = 0; i < 200; i++) { const o = await p.evaluate(() => { const c = window.__game.scene.getScene('CombatScene'); c.pickups.filter(x => !x.done).forEach(x => c.collectPickup(x)); if (!c.waveActive && !c.gameOver) c.startNextWave(); else if (c.canCallEarly()) c.callWaveEarly(); return c.gameOver; }); if (o) break; await p.waitForTimeout(700); }
  console.log('end', JSON.stringify(await p.evaluate(() => { const c = window.__game.scene.getScene('CombatScene'); return { over: c.gameOver, hp: c.baseHp, wave: c.currentWave }; })));
  console.log('errors:', errs); if (errs.length) process.exitCode = 1; await b.close();
})();
