const must = (ok, msg) => { if (!ok) { console.log('FAIL: ' + msg); process.exitCode = 1; } };
const { chromium } = require('playwright');
const out = process.env.OUT + '/e2e';
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type()==='error' && errs.push(m.text()));
  await p.route('**/phaser.min.js', r => r.fulfill({ path: require.resolve('phaser/dist/phaser.min.js'), contentType: 'application/javascript' }));
  await p.addInitScript(() => { let P; Object.defineProperty(window, 'Phaser', { configurable: true, get: () => P, set: v => {
      const G = v.Game; v.Game = function (c) { const g = new G(c); window.__game = g; return g; }; P = v; } }); });
  await p.goto(process.env.BASE_URL + '/index.html'); await p.waitForFunction(() => window.__game);
  await p.evaluate(() => { localStorage.clear(); BUILD.test = false; });
  let n = 0; const shot = (name) => p.screenshot({ path: out + '/' + String(++n).padStart(2, '0') + '-' + name + '.png' });
  const active = (k) => p.waitForFunction((k) => window.__game.scene.isActive(k) && !window.__game.scene.getScene(k)._uiLeaving, k, { timeout: 15000 }).then(() => p.waitForTimeout(450));
  const clickLabel = async (scene, txt) => {
    const pos = await p.evaluate(([scene, txt]) => { const c = window.__game.scene.getScene(scene);
      const find = (list) => { for (const o of list) { if (o.label && o.label.text === txt) return o; if (o.list) { const f = find(o.list); if (f) return f; } } return null; };
      const bt = find(c.children.list); if (!bt) return null; const m = bt.getWorldTransformMatrix(); return { x: m.tx, y: m.ty }; }, [scene, txt]);
    if (!pos) throw new Error('no button ' + txt + ' in ' + scene);
    await p.mouse.click(pos.x, pos.y);
  };
  const storyThrough = async () => { for (let i = 0; i < 12; i++) { const on = await p.evaluate(() => window.__game.scene.getScenes(true).some(sc => sc.children.list.some(o => o.depth >= 500 && o.active))); if (!on) break; await p.mouse.click(195, 790); await p.waitForTimeout(300); } };
  const steps = [];
  const log = (s) => { steps.push(s); console.log(s); };

  await p.waitForTimeout(500); await p.mouse.click(195, 400); await active('SaveScene');
  await p.mouse.click(160, 234); await active('BaseScene'); await shot('base-new'); log('base: new game');
  await p.waitForTimeout(900); for (let i = 0; i < 6; i++) { await p.mouse.click(195, 790); await p.waitForTimeout(250); }
  await clickLabel('BaseScene', 'GO TO FACTORY'); await active('FactoryScene'); log('factory opened');

  // follow the factory coach
  for (let guard = 0; guard < 400; guard++) {
    const st = await p.evaluate(() => { const s = window.__game.scene.getScene('FactoryScene'); return { key: s.coach.key, tut: s.tutorialActive, stock: s.stockTotal() }; });
    if (!st.tut) break;
    const t = await p.evaluate((key) => {
      const s = window.__game.scene.getScene('FactoryScene');
      if (key === 'intro') return 'SHOW ME';
      if (key === 'bench') return { x: s.toolButtons.assembly.x, y: s.toolButtons.assembly.y };
      if (key === 'tile') return s.tileCentre(0, 1);
      if (key === 'pick') return { x: s._asmGunnerRect.x, y: s._asmGunnerRect.y };
      if (key === 'collect') return { x: s.SCRAP_X, y: s.STORE_Y };
      if (key === 'deposit' || key === 'assemble' || key === 'build') return s.tileCentre(0, 1);
      if (key === 'deliver') return { x: s.DEPOT_X, y: s.DEPOT_Y };
      return null;
    }, st.key);
    if (t === 'SHOW ME') await clickLabel('FactoryScene', 'SHOW ME'); else if (t) await p.mouse.click(t.x, t.y);
    await p.waitForTimeout(350);
  }
  await p.waitForTimeout(500); await shot('factory-done'); log('factory tutorial complete');
  await clickLabel('FactoryScene', 'TO THE DOCK'); await active('DockScene'); await shot('dock'); log('dock');
  await p.mouse.click(195, 190); await p.waitForTimeout(600); await shot('levels');  // campaign card
  const lv = await p.evaluate(() => 96 + 16 + 46); await p.mouse.click(195, lv); await p.waitForTimeout(600); await shot('briefing'); log('briefing open');
  await clickLabel('DockScene', 'LAUNCH'); await p.waitForTimeout(600); await storyThrough(); await active('CombatScene'); log('combat');
  for (let guard = 0; guard < 40; guard++) {
    const key = await p.evaluate(() => { const c = window.__game.scene.getScene('CombatScene'); return c.tutorial ? c.coach.key : null; });
    if (key === null) break;
    if (key === 'intro') await clickLabel('CombatScene', 'GOT IT');
    else {
      const t = await p.evaluate((key) => { const c = window.__game.scene.getScene('CombatScene');
        if (key.startsWith('select')) return { x: c.towerButtons.gunner.x, y: c.towerButtons.gunner.y };
        if (key.startsWith('place')) return c.tutorialSpot(c.tutorial.placed);
        if (key === 'start') return { x: c.startWaveBtn.x, y: c.startWaveBtn.y }; }, key);
      await p.mouse.move(t.x, t.y, { steps: 2 }); await p.mouse.click(t.x, t.y);
    }
    await p.waitForTimeout(400);
  }
  await clickLabel('CombatScene', '1×');
  for (let i = 0; i < 300; i++) {
    const st = await p.evaluate(() => { const c = window.__game.scene.getScene('CombatScene'); return { over: c.gameOver, between: !c.waveActive && c.currentWave > 0 && c.currentWave < c.levelData.waves.length && !c.gameOver && c.startWaveBtn.label.text === 'START' }; });
    if (st.over) break;
    if (st.between) await clickLabel('CombatScene', 'START');
    await p.waitForTimeout(1000);
  }
  await p.waitForTimeout(2500); await storyThrough(); await p.waitForTimeout(500); await shot('result');
  const res = await p.evaluate(() => { const c = window.__game.scene.getScene('CombatScene'); return { hp: c.baseHp, won: c.baseHp > 0 }; }); log('battle result ' + JSON.stringify(res));
  await clickLabel('CombatScene', 'BASE'); await active('BaseScene'); await shot('base-after'); log('back at base');
  const goal = await p.evaluate(() => { const s = JSON.parse(localStorage.factower_save_0); return { done: s.completedLevels, stock: s.stockpile, workers: s.workers, fa: s.factoryActive }; }); log('save ' + JSON.stringify(goal));
  await p.mouse.click(103, 420); await active('FactoryScene'); await p.waitForTimeout(600); await shot('factory-revisit'); log('factory revisit, tutorialActive=' + await p.evaluate(() => window.__game.scene.getScene('FactoryScene').tutorialActive));
  console.log('errors:', errs); if (errs.length) process.exitCode = 1; await b.close();
})();
