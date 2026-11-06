const must = (ok, msg) => { if (!ok) { console.log('FAIL: ' + msg); process.exitCode = 1; } };
const { chromium } = require('playwright');
const runs = JSON.parse(process.argv[2] || '[["barricade","gunner","gunner","gunner"]]');
const lvl = process.argv[3] || 'p4';
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' @ ' + (e.stack || '').split('\n')[1])); p.on('console', m => m.type()==='error' && errs.push(m.text()));
  await p.route('**/phaser.min.js', r => r.fulfill({ path: require.resolve('phaser/dist/phaser.min.js'), contentType: 'application/javascript' }));
  await p.addInitScript(() => { let P; Object.defineProperty(window, 'Phaser', { configurable: true, get: () => P, set: v => {
      const G = v.Game; v.Game = function (c) { const g = new G(c); window.__game = g; return g; }; P = v; } }); });
  await p.goto(process.env.BASE_URL + '/index.html'); await p.waitForFunction(() => window.__game);
  for (const [ri, order] of runs.entries()) {
    await p.evaluate(() => { localStorage.clear(); localStorage.setItem('factower_active_slot', '0'); localStorage.setItem('factower_save_0', JSON.stringify({ saveVersion: 2, stockpile: { gunner: 10, gunner2: 6, bomber: 5, barricade: 5, siphon: 4 }, completedLevels: { storyline1: [1,2,3] }, flags: {}, tutorials: {}, storySeen: { "p4.after": true, "s1-1.after": true, "s2-1.after": true, "s2-2.after": true, "s2-4.after": true }, factory: { tutorialComplete: true } })); BUILD.test = false; });
    await p.evaluate((lvl) => { window.__game.scene.getScenes(true).forEach(x => x.scene.start('RaidScene', Object.assign(Progress.parse(lvl), { levelData: Progress.level(lvl) }))); }, lvl);
    await p.waitForTimeout(1500);
    // deploy in order (all stock limited to order), collect + repair; run fast by stepping sim
    const res = await p.evaluate(async (order) => {
      const r = window.__game.scene.getScene('RaidScene');
      r.stock = { gunner: 0, bomber: 0, barricade: 0, gunner2: 0, siphon: 0 }; order.forEach(t => r.stock[t]++);
      let i = 0;
      for (let step = 0; step < 4000 && !r.over; step++) {
        if (i < order.length && r.simNow - r.lastDeploy >= 1000) r.deploy(order[i++]);
        r.pickups.filter(p => !p.done).forEach(p => r.collect(p));
        if (r.units.some(u => u.alive && u.hp < u.maxHp * 0.5)) r.repair();
        r.update(0, 50);
      }
      return { over: r.over, core: Math.round(r.core.hp), lost: r.lost, turretsLeft: r.turrets.filter(t => t.alive).length, secs: Math.round(r.simNow / 1000) };
    }, order);
    console.log(lvl, JSON.stringify(order), JSON.stringify(res));
    if (ri === 0) { await p.waitForTimeout(800); await p.screenshot({ path: process.env.OUT + '/raid-end.png' }); }
  }
  console.log('errors:', errs); if (errs.length) process.exitCode = 1; await b.close();
})();
