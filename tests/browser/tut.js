const must = (ok, msg) => { if (!ok) { console.log('FAIL: ' + msg); process.exitCode = 1; } };
const { chromium } = require('playwright');
const out = process.env.OUT + '/tut';
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type()==='error' && errs.push(m.text()));
  await p.route('**/phaser.min.js', r => r.fulfill({ path: require.resolve('phaser/dist/phaser.min.js'), contentType: 'application/javascript' }));
  await p.addInitScript(() => { let P; Object.defineProperty(window, 'Phaser', { configurable: true, get: () => P, set: v => {
      const G = v.Game; v.Game = function (c) { const g = new G(c); window.__game = g; return g; }; P = v; } }); });
  await p.goto(process.env.BASE_URL + '/index.html'); await p.waitForFunction(() => window.__game);
  await p.evaluate(() => { localStorage.clear(); BUILD.test = false; });
  await p.waitForTimeout(400);
  await p.mouse.click(195, 400); await p.waitForTimeout(600);
  await p.mouse.click(195, 234); await p.waitForTimeout(700);           // slot 1 → base
  await p.screenshot({ path: out + '/00-base.png' });
  await p.waitForTimeout(900);
  for (let i = 0; i < 20; i++) {   // tap through the intro story until it closes
    const open = await p.evaluate(() => { const b = window.__game.scene.getScene('BaseScene'); return !!(b && (b._storyOpen || (b._inputBlockedUntil && b.time.now < b._inputBlockedUntil))); });
    if (!open && i > 0) break;
    await p.mouse.click(195, 790); await p.waitForTimeout(300);
  }
  await p.waitForTimeout(400);
  await p.waitForFunction(() => window.__game.scene.isActive('BaseScene'));
  await p.waitForTimeout(300);
  await p.mouse.click(195, 258);                                          // GO TO FACTORY (goal card button)
  await p.waitForFunction(() => window.__game.scene.isActive('FactoryScene'), null, { timeout: 5000 });
  await p.waitForTimeout(400);
  const fs = () => p.evaluate(() => { const s = window.__game.scene.getScene('FactoryScene'); return s && s.scene.isActive() ? { key: s.coach.key, stock: s.stockTotal(), tut: s.tutorialActive } : null; });
  let i = 0, last = null, guard = 0;
  while (guard++ < 400) {
    const st = await fs(); if (!st) { console.log('factory not active'); break; }
    if (!st.tut) { await p.waitForTimeout(500); await p.screenshot({ path: out + '/99-done.png' }); console.log('tutorial finished, stock', st.stock); break; }
    if (st.key !== last) { await p.waitForTimeout(250); await p.screenshot({ path: out + '/' + String(++i).padStart(2, '0') + '-' + String(st.key).replace(/[^a-z0-9]/gi, '_').slice(0, 30) + '.png' }); last = st.key; console.log('step', st.key, 'stock', st.stock); }
    // tap target for this step
    const tgt = await p.evaluate((key) => {
      const s = window.__game.scene.getScene('FactoryScene');
      if (key === 'intro') { const btn = s.coach.items.find(e => e.label && e.label.text === 'SHOW ME'); return btn ? { x: btn.x, y: btn.y } : null; }
      if (key === 'bench') return { x: s.toolButtons.assembly.x, y: s.toolButtons.assembly.y };
      if (key === 'tile') { const c = s.tileCentre(1, 1); return c; }
      if (key === 'pick') return { x: s._asmGunnerRect.x, y: s._asmGunnerRect.y };
      if (key === 'collect') return { x: s.SCRAP_X, y: s.STORE_Y };
      if (key === 'deposit' || key === 'assemble' || key === 'build') { return s.tileCentre(1, 1); }
      if (key === 'deliver') return { x: s.DEPOT_X, y: s.DEPOT_Y };
      return null;
    }, st.key);
    if (tgt) { await p.mouse.click(tgt.x, tgt.y); await p.waitForTimeout(300); }
    else await p.waitForTimeout(300);
  }
  // test blocked tap: none here. Now the completion modal
  await p.screenshot({ path: out + '/99-final.png' });
  console.log('errors:', errs); if (errs.length) process.exitCode = 1; await b.close();
})();
