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
  const seed = (extra) => p.evaluate((e) => { localStorage.clear(); localStorage.setItem('factower_active_slot', '0'); localStorage.setItem('factower_save_0', JSON.stringify(Object.assign({ saveVersion: 1, nuts: 40, bolts: 0, stockpile: { gunner: 3, bomber: 1 }, completedLevels: { storyline1: [1,2,3,4,5] }, storySeen: { intro: true }, flags: {}, tutorials: {}, factory: { tutorialComplete: true } }, e))); }, extra);
  const go = async (k, ms=1200) => { await p.evaluate((k) => window.__game.scene.getScenes(true).forEach(x => x.scene.start(k)), k); await p.waitForTimeout(ms); };
  const sd = () => p.evaluate(() => JSON.parse(localStorage.getItem('factower_save_0')));
  const tap = async (x, y) => { await p.mouse.move(x, y); await p.mouse.down(); await p.waitForTimeout(60); await p.mouse.up(); await p.waitForTimeout(250); };

  await seed({});
  await go('MarketplaceScene'); await p.screenshot({ path: process.env.OUT + '/m8-market.png' });
  // sell a gunner via trade counter: find the sell button rows
  const btns = await p.evaluate(() => { const s = window.__game.scene.getScene('MarketplaceScene'); return s.tradeItems.filter(o => o.setEnabled).map(o => [o.x, o.y]); });
  await tap(btns[0][0], btns[0][1]);
  let s = await sd(); console.log('after sell nuts', s.nuts, 'gunners', s.stockpile.gunner);
  // locked merchant -> redirect
  await go('RicochetScene', 1500); console.log('ricochet locked ->', await p.evaluate(() => window.__game.scene.getScenes(true).map(x=>x.scene.key)));
  // Chrome with tutorial
  await go('ChromeScene', 1000); await p.screenshot({ path: process.env.OUT + '/m8-chrome-tut.png' });
  for (let i = 0; i < 5; i++) { const b2 = await p.evaluate(() => { const c = window.__game.scene.getScene('ChromeScene').children.list.find(o => o.label && /NEXT|GOT IT/.test(o.label.text) && o.depth >= 300); return c && [c.x, c.y]; }); if (!b2) break; await tap(b2[0], b2[1]); }
  s = await sd(); console.log('chrome tut done', s.tutorials.chrome, 'met', JSON.stringify(s.flags.merchantsMet));
  for (let i = 0; i < 8; i++) { await tap(195, 844 - 76); await p.waitForTimeout(5200); }
  s = await sd(); console.log('chrome after 8 spins nuts', s.nuts, 'bolts', s.bolts, 'fatigue', s.merchantFatigue.chrome, 'next', JSON.stringify(s.chromeState));
  await p.screenshot({ path: process.env.OUT + '/m8-chrome.png' });
  // Unlock all, buy gambling nodes
  await seed({ nuts: 200, completedLevels: { storyline1: [1,2,3,4,5,6,7], storyline2: [1,2,3] }, storySeen: { intro: true }, tutorials: { chrome: true, ricochet: true }, skillTree: undefined });
  await go('MarketplaceScene'); await p.screenshot({ path: process.env.OUT + '/m8-market-all.png' });
  await go('DoubleDownScene', 1000); await p.screenshot({ path: process.env.OUT + '/m8-dd-tut.png' });
  for (let i = 0; i < 5; i++) { const b2 = await p.evaluate(() => { const c = window.__game.scene.getScene('DoubleDownScene').children.list.find(o => o.label && /NEXT|GOT IT/.test(o.label.text) && o.depth >= 300); return c && [c.x, c.y]; }); if (!b2) break; await tap(b2[0], b2[1]); }
  // play rounds: roll until >=300 then bank or farkle
  const half = (390 - 44) / 2; const rollX = 16 + half / 2, bankX = 390 - 16 - half / 2, by = 844 - 72;
  for (let r = 0; r < 6; r++) {
    await tap(rollX, by); await p.waitForTimeout(800);
    for (let k = 0; k < 10; k++) {
      const st = await p.evaluate(() => { const d = window.__game.scene.getScene('DoubleDownScene'); return { in: d.inRound, acc: d.accScore }; });
      if (!st.in) break;
      if (st.acc >= 300) { await tap(bankX, by); await p.waitForTimeout(400); break; }
      await tap(rollX, by); await p.waitForTimeout(800);
    }
  }
  s = await sd(); console.log('dd nuts', s.nuts, 'bolts', s.bolts, 'fatigue', s.merchantFatigue.doubleDown);
  await p.screenshot({ path: process.env.OUT + '/m8-dd.png' });
  // Ricochet: fire a few shots
  await go('RicochetScene', 1000);
  for (let i = 0; i < 3; i++) { await p.mouse.move(150, 400); await p.mouse.down(); await p.mouse.move(120 + i * 40, 420, { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(6000); }
  s = await sd(); console.log('ric nuts', s.nuts, 'bolts', s.bolts, 'fatigue', s.merchantFatigue.ricochet);
  await p.screenshot({ path: process.env.OUT + '/m8-ric.png' });
  // All-in & effects via owned nodes
  await seed({ nuts: 100, completedLevels: { storyline1: [1,2,3,4,5,6,7], storyline2: [1,2,3] }, storySeen: { intro: true }, tutorials: { chrome: true, ricochet: true, doubleDown: true },
    skillTree: Object.fromEntries(['GAM_01','GAM_02','GAM_03','GAM_04','GAM_05','GAM_06','GAM_07','GAM_08','GAM_09','GAM_10','GAM_11'].map(k=>[k,true])) });
  await go('DoubleDownScene', 1000);
  console.log('allin btn', await p.evaluate(() => { const d = window.__game.scene.getScene('DoubleDownScene'); return !!d.allInBtn + ' cost ' + d._cost() + ' luck ' + Merchants.luck('doubleDown', d.fx) + ' mult ' + Merchants.payoutMult('doubleDown', 0, d.fx).toFixed(2); }));
  await p.screenshot({ path: process.env.OUT + '/m8-dd-allin.png' });
  await go('SkillTreeScene', 1000); await p.screenshot({ path: process.env.OUT + '/m8-uplink.png' });
  console.log('errors:', errs); if (errs.length) process.exitCode = 1; await b.close();
})();
