const must = (ok, msg) => { if (!ok) { console.log('FAIL: ' + msg); process.exitCode = 1; } };
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
  await p.route('**/phaser.min.js', r => r.fulfill({ path: require.resolve('phaser/dist/phaser.min.js'), contentType: 'application/javascript' }));
  await p.addInitScript(() => { let P; Object.defineProperty(window, 'Phaser', { configurable: true, get: () => P, set: v => {
      const G = v.Game; v.Game = function (c) { const g = new G(c); window.__game = g; return g; }; P = v; } }); });
  await p.goto(process.env.BASE_URL + '/index.html'); await p.waitForFunction(() => window.__game);
  const F = (fn, a) => p.evaluate(fn, a);
  const fresh = async (scrap) => { await F((scrap) => { localStorage.clear(); localStorage.setItem('factower_active_slot', '0');
      localStorage.setItem('factower_save_0', JSON.stringify({ saveVersion: 2, campaign: true, stockpile: {}, materials: { plasticScrap: scrap, salvagedMetal: 8 },
        completedLevels: { storyline1: [1,2,3,4,5,6,7], storyline2: [1,2,3,4,5,6], storyline3: [1,2] }, storySeen: { intro: true }, tutorials: { combat1: true },
        flags: { baseTutDone: true, towerTutorialsSeen: { barricade: true, bomber: true, gunner2: true, siphon: true } }, workers: 3, worker2Introduced: true,
        factory: { tutorialComplete: true, factoryVersion: 2 }, factoryActive: true })); }, scrap);
    await F(() => window.__game.scene.getScenes(true).forEach(x => x.scene.start('FactoryScene'))); await p.waitForTimeout(1500);
    await F(() => { const f = window.__game.scene.getScene('FactoryScene'); window.__built = {}; if (!f.__wrapped) { f.__wrapped = true; const o = f.addTowerToStockpile.bind(f); f.addTowerToStockpile = (t, q) => { window.__built[t] = (window.__built[t] || 0) + 1; return o(t, q); }; } }); };
  const lbl = (k) => F((k) => window.__game.scene.getScene('FactoryScene').machineStatusTexts[k].text, k);
  // Labels: bench alone, no worker
  await fresh(10);
  await F(() => { const f = window.__game.scene.getScene('FactoryScene'); f.factory.placeMachine(1,1,'assembly_bomber'); f.drawMachines(); }); await p.waitForTimeout(400);
  const l1 = await lbl('1,1'); console.log('bench, no worker:', l1); must(l1 === 'NO WORKER', 'idle label NO WORKER');
  await F(() => { window.__game.scene.getScene('FactoryScene').tryAssignWorker(0, '1,1'); }); await p.waitForTimeout(1500);
  const l2 = await lbl('1,1'); console.log('bench + operator, no smelter:', l2); must(l2 === 'NEEDS SMELTER', 'idle label NEEDS SMELTER');
  await p.screenshot({ path: process.env.OUT + '/b7-nosmelter.png' });
  // No scrap
  await fresh(0);
  await F(() => { const f = window.__game.scene.getScene('FactoryScene'); f.factory.placeMachine(1,1,'assembly_bomber'); f.factory.placeMachine(0,1,'smelter'); f.drawMachines(); f.tryAssignWorker(0, '1,1'); }); await p.waitForTimeout(2500);
  const l3 = await lbl('1,1'); must(l3 === 'NO SCRAP', 'idle label NO SCRAP');
  console.log('no scrap:', l3, '| msg:', await F(() => window.__game.scene.getScene('FactoryScene').messageText && window.__game.scene.getScene('FactoryScene').messageText.text));
  await p.screenshot({ path: process.env.OUT + '/b7-noscrap.png' });
  // Three worker chain again
  await fresh(20);
  await F(() => { const f = window.__game.scene.getScene('FactoryScene'); f.factory.placeMachine(1,1,'assembly_bomber'); f.factory.placeMachine(0,1,'smelter'); f.drawMachines(); f.tryAssignWorker(2,'1,1'); f.tryAssignWorker(0,'store_scrap'); });
  await p.waitForTimeout(3000);
  await F(() => { const f = window.__game.scene.getScene('FactoryScene'); f.tryAssignWorker(0, '0,1'); f.tryAssignWorker(1, '0,1'); }); await p.waitForTimeout(800);
  await F(() => { window.__game.scene.getScene('FactoryScene').tryAssignWorker(1, '1,1'); });
  await p.waitForTimeout(60000);
  const b7 = await F(() => window.__built); must(b7.bomber >= 2, 'three-worker Bomber line builds');
  must(!(await F(() => window.__game.scene.getScene('FactoryScene').factory.getUnlockedWorkers().some(w => w.waitingFor === 'stuck'))), 'no worker stuck');
  console.log('3-worker 60s built', JSON.stringify(b7), await F(() => JSON.stringify(window.__game.scene.getScene('FactoryScene').factory.getUnlockedWorkers().map(w => [w.inventory.join(), w.state, w.waitingFor]))));
  console.log('errors:', errs); if (errs.length) process.exitCode = 1; await b.close();
})();
