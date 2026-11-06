const must = (ok, msg) => { if (!ok) { console.log('FAIL: ' + msg); process.exitCode = 1; } };
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
  await p.route('**/phaser.min.js', r => r.fulfill({ path: require.resolve('phaser/dist/phaser.min.js'), contentType: 'application/javascript' }));
  await p.addInitScript(() => { let P; Object.defineProperty(window, 'Phaser', { configurable: true, get: () => P, set: v => {
      const G = v.Game; v.Game = function (c) { const g = new G(c); window.__game = g; return g; }; P = v; } }); });
  await p.goto(process.env.BASE_URL + '/index.html'); await p.waitForFunction(() => window.__game);
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('factower_active_slot', '0'); localStorage.setItem('factower_save_0', JSON.stringify({ saveVersion: 2, campaign: true, nuts: 0, bolts: 0, stockpile: { gunner: 8, bomber: 4, barricade: 4 }, materials: { plasticScrap: 0, salvagedMetal: 0 }, completedLevels: { storyline1: [1, 2, 3] }, tutorials: { combat1: true, upgrades: true, salvage: true }, seenEnemies: Object.fromEntries(Object.keys(ENEMY_DATA).map(k => [k, true])), storySeen: Object.fromEntries(Object.keys(STORY_BEATS).map(k => [k, true])), factory: { tutorialComplete: true }, flags: {} })); });
  const fight = async (L, hard, towers) => {
    await p.evaluate(([L, hard]) => { const k = Progress.parse(L); window.__game.scene.getScenes(true).forEach(x => x.scene.start('CombatScene', Object.assign(k, { levelData: Progress.level(L), hard }))); }, [L, hard]);
    await p.waitForTimeout(1500);
    const info = await p.evaluate((n) => { const c = window.__game.scene.getScene('CombatScene');
      const cand = []; for (let x = 30; x < 370; x += 16) for (let y = c.PLAY_TOP + 20; y < c.PLAY_BOTTOM - 10; y += 16) if (c.canPlaceAt(x, y)) cand.push({ x, y });
      ['gunner', 'bomber', 'gunner', 'barricade', 'gunner', 'bomber'].slice(0, n).forEach(t => { let best = null, bs = -1; cand.forEach(s => { if (!c.canPlaceAt(s.x, s.y)) return; const r = c.roadCoverage(s.x, s.y, 110); if (r > bs) { bs = r; best = s; } }); c.selectedTowerType = t; c.placeTower(best.x, best.y); });
      return { baseHp: c.baseHpMax, hpScale: c.levelData.hpScale || 1, rec: c.levelData.recommendedTowers }; }, towers);
    // pretend the battle went perfectly, then win
    await p.evaluate(() => { const c = window.__game.scene.getScene('CombatScene'); c.enemiesEscaped = 0; c.triggerGameOver(true); });
    await p.waitForTimeout(800);
    const res = await p.evaluate((L) => { const c = window.__game.scene.getScene('CombatScene'), s = SaveManager.load(); return { checks: c.starChecks.map(x => x[1]), r: c.starResult, stars: s.stars, hard: s.hardCleared, bolts: s.bolts }; }, L);
    return Object.assign(info, res);
  };
  console.log('normal p4? (p5) 4 towers', JSON.stringify(await fight('p5', false, 4)));
  await p.screenshot({ path: process.env.OUT + '/stars-victory.png' });
  console.log('again p5 6 towers', JSON.stringify(await fight('p5', false, 6)));
  console.log('hard p5', JSON.stringify(await fight('p5', true, 4)));
  await p.screenshot({ path: process.env.OUT + '/stars-hard.png' });
  // Raid stars
  await p.evaluate(() => { const k = Progress.parse('p4'); window.__game.scene.getScenes(true).forEach(x => x.scene.start('RaidScene', Object.assign(k, { levelData: Progress.level('p4') }))); });
  await p.waitForTimeout(1500);
  console.log('raid', await p.evaluate(() => { const s = window.__game.scene.getScene('RaidScene'); s.finish(true); return JSON.stringify({ checks: s.starChecks.map(x => x[1]), r: s.starResult, stars: SaveManager.load().stars }); }));
  // Dock chart + briefing
  await p.evaluate(() => window.__game.scene.getScenes(true).forEach(x => x.scene.start('DockScene'))); await p.waitForTimeout(1500);
  await p.screenshot({ path: process.env.OUT + '/stars-dock.png' });
  await p.evaluate(() => window.__game.scene.getScene('DockScene').showLevelList(Progress.storyline(1))); await p.waitForTimeout(800);
  await p.screenshot({ path: process.env.OUT + '/stars-chart.png' });
  await p.evaluate(() => window.__game.scene.getScene('DockScene').showBriefing(Progress.storyline(1), Progress.level('p5'))); await p.waitForTimeout(600);
  await p.screenshot({ path: process.env.OUT + '/stars-brief.png' });
  console.log('errors:', errs); if (errs.length) process.exitCode = 1; await b.close();
})();
