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
    const seen = Object.fromEntries(Object.keys(STORY_BEATS).map(k => [k, true])); delete seen['s4-3.after']; delete seen['ortega.pick'];
    localStorage.setItem('factower_save_0', JSON.stringify({ saveVersion: 2, campaign: true, nuts: 0, bolts: 0, stockpile: { gunner: 8, bomber: 4, barricade: 4 }, materials: { plasticScrap: 0, salvagedMetal: 0 },
      completedLevels: { storyline1: [1,2,3,4,5,6,7], storyline2: [1,2,3,4,5,6], storyline3: [1,2,3,4,5,6,7], storyline4: [1,2,3,4], storyline5: [1,2,3] },
      tutorials: { combat1: true, upgrades: true, salvage: true }, seenEnemies: {}, storySeen: seen, factory: { tutorialComplete: true }, flags: {} })); });
  const go = async (k, d) => { await p.evaluate(([k, d]) => window.__game.scene.getScenes(true).forEach(x => x.scene.start(k, d)), [k, d]); await p.waitForTimeout(1500); };
  await go('BaseScene');
  console.log('next before choice', await p.evaluate(() => window.__game.scene.getScene('BaseScene').nextPlayable().level.name));
  // Play the after-beat, tap through to the choice
  await p.evaluate(() => Story.play(window.__game.scene.getScene('BaseScene'), 's4-3.after'));
  for (let i = 0; i < 6; i++) { await p.mouse.click(195, 300); await p.waitForTimeout(250); }
  await p.screenshot({ path: process.env.OUT + '/or-choice.png' });
  // Tap the second option (STAY FREE) by finding the text
  const pos = await p.evaluate(() => { const sc = window.__game.scene.getScene('BaseScene'); const t = sc.children.list.find(o => o.text === 'STAY FREE'); return t ? { x: t.x, y: t.y } : null; });
  console.log('free btn', pos);
  await p.mouse.click(195, 740);
  await p.waitForTimeout(400);
  const ch = await p.evaluate(() => SaveManager.load().choices || {}); console.log('choice saved', JSON.stringify(ch)); must(ch.ortega === 'free', 'Ortega choice saved from the choice buttons');
  await p.screenshot({ path: process.env.OUT + '/or-after.png' });
  for (let i = 0; i < 4; i++) { await p.mouse.click(195, 300); await p.waitForTimeout(250); }
  await go('BaseScene');
  console.log('next after choice', await p.evaluate(() => window.__game.scene.getScene('BaseScene').nextPlayable().level.name));
  await go('DockScene');
  await p.evaluate(() => window.__game.scene.getScene('DockScene').showLevelList(Progress.storyline(5))); await p.waitForTimeout(800);
  await p.screenshot({ path: process.env.OUT + '/or-chart.png' });
  // Boss fights: SOVEREIGN then Mothership, jump to last wave
  for (const L of ['s4-6', 's5-4']) {
    await go('CombatScene', (await p.evaluate((L) => Object.assign(Progress.parse(L), { levelData: Choices.apply(Progress.level(L), SaveManager.load()) }), L)));
    const info = await p.evaluate(() => { const c = window.__game.scene.getScene('CombatScene');
      c.waveIndex = c.levelData.waves.length - 1; return { name: c.levelData.name, base: c.baseHpMax, sb: c.shieldBreak }; });
    console.log(L, JSON.stringify(info));
    await p.evaluate(() => { const c = window.__game.scene.getScene('CombatScene'); const w = c.levelData.waves[c.levelData.waves.length - 1];
      w.enemies.forEach(g => c.spawnEnemy ? c.spawnEnemy(g.type) : null); });
    await p.waitForTimeout(2500);
    console.log('enemies', await p.evaluate(() => (window.__game.scene.getScene('CombatScene').enemies || []).map(e => e.type).join(',')));
    await p.screenshot({ path: process.env.OUT + '/or-' + L + '.png' });
  }
  console.log('errors:', errs); if (errs.length) process.exitCode = 1; await b.close();
})();
