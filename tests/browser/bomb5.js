const must = (ok, msg) => { if (!ok) { console.log('FAIL: ' + msg); process.exitCode = 1; } };
// A player with a Gunner line running tries to start making Bombers, using taps only.
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
  const FS = () => window.__game.scene.getScene('FactoryScene');
  const click = async (x, y, wait) => { await p.mouse.click(x, y); await p.waitForTimeout(wait || 500); };
  const textAt = (str) => F((str) => { const f = window.__game.scene.getScene('FactoryScene'); const t = f.children.list.filter(o => o.type === 'Text' && o.visible && o.text === str).sort((a, b) => b.depth - a.depth)[0]; return t ? { x: t.x + (t.originX === 0 ? t.width / 2 : 0), y: t.y } : null; }, str);
  const tile = (r, c) => F(([r, c]) => window.__game.scene.getScene('FactoryScene').tileCentre(r, c), [r, c]);
  const st = (k) => F((k) => window.__game.scene.getScene('FactoryScene').getStationPos(k), k);
  const menu = () => F(() => { const f = window.__game.scene.getScene('FactoryScene'); if (!f.workerMenuActive) return null;
      return f.children.list.filter(o => o.type === 'Text' && o.depth >= 112 && o.visible).map(t => t.text).join(' | '); });
  const workerCard = (id) => F((id) => { const f = window.__game.scene.getScene('FactoryScene'); const t = f.children.list.find(o => o.type === 'Text' && o.depth === 114 && o.text === WORKER_LABELS[id]); return t ? { x: t.x + 40, y: t.y } : null; }, id);
  const jobs = () => F(() => JSON.stringify(window.__game.scene.getScene('FactoryScene').factory.workers.slice(0, 2).map(w => ({ inv: w.inventory.join(), st: w.state, wait: w.waitingFor, job: w.job && w.job.stops.map(s => s.action + '@' + s.station).join('>') }))));
  let shot = 0; const snap = async (n) => p.screenshot({ path: process.env.OUT + '/b5-' + (++shot) + '-' + n + '.png' });

  // Save: after p4 (bombers unlocked), Gunner bench already running with two workers
  await F(() => { localStorage.clear(); localStorage.setItem('factower_active_slot', '0');
    localStorage.setItem('factower_save_0', JSON.stringify({ saveVersion: 2, campaign: true, stockpile: { gunner: 3 }, materials: { plasticScrap: 20, salvagedMetal: 8 },
      completedLevels: { storyline1: [1, 2, 3, 4] }, storySeen: { intro: true }, tutorials: { combat1: true },
      flags: { baseTutDone: true, towerTutorialsSeen: { barricade: true, bomber: true } }, workers: 2, worker2Introduced: true,
      factory: { tutorialComplete: true, factoryVersion: 2 }, factoryActive: true })); });
  await F(() => window.__game.scene.getScenes(true).forEach(x => x.scene.start('FactoryScene'))); await p.waitForTimeout(1500);
  await F(() => { const f = window.__game.scene.getScene('FactoryScene'); window.__built = {}; const o = f.addTowerToStockpile.bind(f); f.addTowerToStockpile = (t, q) => { window.__built[t] = (window.__built[t] || 0) + 1; return o(t, q); };
    window.__msgs = []; const sm = f.showMessage.bind(f); f.showMessage = (t, k) => { window.__msgs.push(t); return sm(t, k); };
    // existing gunner line: W1 runs the gunner bench, W2 hauls scrap to it
    f.factory.placeMachine(2, 0, 'assembly_gunner'); f.drawMachines();
    f.tryAssignWorker(0, '2,0'); });
  await p.waitForTimeout(800);
  await F(() => { const f = window.__game.scene.getScene('FactoryScene'); f.tryAssignWorker(1, 'store_scrap'); });
  await p.waitForTimeout(2500);
  await F(() => { const f = window.__game.scene.getScene('FactoryScene'); f.tryAssignWorker(1, '2,0'); });
  await p.waitForTimeout(6000);
  console.log('gunner line:', await jobs(), 'built', JSON.stringify(await F(() => window.__built)));
  await snap('gunnerline');

  // Player builds a Bomber bench: tap BENCH, tap a tile, choose Bomber
  const tool = (k) => F((k) => { const b = window.__game.scene.getScene('FactoryScene').toolButtons[k]; return { x: b.x, y: b.y }; }, k);
  let b1 = await tool('assembly'); await click(b1.x, b1.y);
  let t = await tile(1, 1); await click(t.x, t.y, 700); await snap('benchmenu');
  let bo = await textAt('Bomber'); console.log('bomber option', !!bo); await click(bo.x, bo.y, 700);
  // Smelter: tap SMELTER, tap a tile
  b1 = await tool('smelter'); await click(b1.x, b1.y);
  t = await tile(0, 1); await click(t.x, t.y, 700);
  console.log('grid', await F(() => JSON.stringify(window.__game.scene.getScene('FactoryScene').factory.grid.map(r => r.map(m => m ? m.type.replace('assembly_', '') : '-')))));
  await snap('built');
  // Now tap the Bomber bench and see the menu
  t = await tile(1, 1); await click(t.x, t.y, 700);
  console.log('bomber bench menu:', await menu()); await snap('bombermenu');
  // Pick W1 (the gunner operator) — the natural choice
  let c = await workerCard(0); if (c) await click(c.x, c.y, 700);
  console.log('after picking W1:', await menu(), await jobs());
  await snap('afterpick');
  await p.waitForTimeout(45000);
  const built5 = await F(() => window.__built); console.log('45s later:', await jobs(), 'built', JSON.stringify(built5));
  must(built5.bomber >= 1, 'a Bomber is built after moving a worker off the Gunner line');
  console.log('msgs', JSON.stringify(await F(() => window.__msgs.slice(-6))));
  await snap('end');
  console.log('errors:', errs); if (errs.length) process.exitCode = 1; await b.close();
})();
