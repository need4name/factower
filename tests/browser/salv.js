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
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('factower_active_slot', '0'); localStorage.setItem('factower_save_0', JSON.stringify({ saveVersion: 1, stockpile: { gunner: 8, bomber: 4, barricade: 2 }, completedLevels: { storyline1: [1,2,3,4] }, flags: {}, tutorials: { combat1: true, upgrades: true }, factory: { tutorialComplete: true } })); });
  await p.evaluate(() => { const L = LEVEL_DATA.storylines[0].levels[4]; window.__game.scene.getScenes(true).forEach(x => x.scene.start('CombatScene', { storylineId: 1, levelId: L.id, levelData: L })); });
  await p.waitForTimeout(1500);
  const C = 'window.__game.scene.getScene("CombatScene")';
  await p.evaluate(() => { const c = window.__game.scene.getScene('CombatScene'); const pts = c.pathPoints;
    const spots = []; for (let i = 1; i < pts.length - 1; i++) spots.push({ x: (pts[i].x + pts[i+1].x) / 2 + 34, y: (pts[i].y + pts[i+1].y) / 2 + 34 });
    let k = 0; ['gunner','gunner','gunner','bomber','bomber','barricade'].forEach(t => { for (let tries = 0; tries < spots.length; tries++) { const s = spots[(k++) % spots.length]; if (c.canPlaceAt(s.x, s.y)) { c.selectedTowerType = t; c.placeTower(s.x, s.y); break; } } });
    c.speed = 2; c.applyTimeScale(); c.startNextWave(); });
  await p.waitForTimeout(800);
  await p.screenshot({ path: process.env.OUT + '/salv-card.png' });
  // click through any raider cards
  for (let i = 0; i < 4; i++) {
    const btn = await p.evaluate(() => { const c = window.__game.scene.getScene('CombatScene'); const o = c.children.list.find(x => x.label && /GOT IT|NEXT/.test(x.label.text) && x.depth >= 200); return o ? { x: o.x, y: o.y, t: o.label.text } : null; });
    if (!btn) break; console.log('card button', btn.t); await p.mouse.click(btn.x, btn.y); await p.waitForTimeout(500);
  }
  let collected = 0;
  for (let t = 0; t < 40; t++) {
    const pk = await p.evaluate(() => { const c = window.__game.scene.getScene('CombatScene'); return c.pickups.filter(x => !x.done).map(x => ({ x: x.c.x, y: x.c.y })); });
    for (const q of pk.slice(0, 3)) { await p.mouse.click(q.x, q.y); collected++; }
    if (t === 12) await p.screenshot({ path: process.env.OUT + '/salv-mid.png' });
    await p.waitForTimeout(700);
    const st = await p.evaluate(() => { const c = window.__game.scene.getScene('CombatScene'); return { wa: c.waveActive, over: c.gameOver, parts: c.parts }; });
    if (!st.wa) break;
  }
  const st = await p.evaluate(() => { const c = window.__game.scene.getScene('CombatScene'); return { parts: c.parts, rare: c.rare, wave: c.currentWave, placed: c.placedTowers.length, hp: c.baseHp }; });
  console.log('after wave 1, tapped', collected, JSON.stringify(st));
  // open a gunner, buy mods on two paths, check third is blocked
  const res = await p.evaluate(() => { const c = window.__game.scene.getScene('CombatScene'); c.parts += 100; c.rare.plate = 1;
    const t = c.placedTowers.find(x => x.type === 'gunner'); c.applyUpgrade(t, 0); c.applyUpgrade(t, 1); c.applyUpgrade(t, 2); c.applyUpgrade(t, 0); c.applyUpgrade(t, 0);
    c.showUpgradePanel(t); return { mods: t.mods, dmg: t.data.damage, range: t.data.range, pierce: t.data.pierce, plate: c.rare.plate }; });
  console.log('mods', JSON.stringify(res));
  await p.waitForTimeout(300); await p.screenshot({ path: process.env.OUT + '/salv-panel.png' });
  console.log('errors:', errs); if (errs.length) process.exitCode = 1; await b.close();
})();
