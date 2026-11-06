const must = (ok, msg) => { if (!ok) { console.log('FAIL: ' + msg); process.exitCode = 1; } };
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('**/phaser.min.js', r => r.fulfill({ path: require.resolve('phaser/dist/phaser.min.js'), contentType: 'application/javascript' }));
  await p.addInitScript(() => { let P; Object.defineProperty(window, 'Phaser', { configurable: true, get: () => P, set: v => {
      const G = v.Game; v.Game = function (c) { const g = new G(c); window.__game = g; return g; }; P = v; } }); });
  await p.goto(process.env.BASE_URL + '/index.html'); await p.waitForFunction(() => window.__game);
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('factower_active_slot', '0'); localStorage.setItem('factower_save_0', JSON.stringify({ saveVersion: 1, nuts: 3, bolts: 30, stockpile: { gunner: 3 }, completedLevels: { storyline1: [1] }, flags: {}, tutorials: {}, skillTree: {}, factory: { tutorialComplete: true } })); });
  const go = async (k) => { await p.evaluate((k) => window.__game.scene.getScenes(true).forEach(x => x.scene.start(k)), k); await p.waitForFunction((k) => window.__game.scene.isActive(k), k); await p.waitForTimeout(500); };
  const clickLabel = async (scene, txt) => {
    const pos = await p.evaluate(([scene, txt]) => { const c = window.__game.scene.getScene(scene);
      const find = (list) => { for (const o of list) { if (o.label && (txt.endsWith('*') ? o.label.text.startsWith(txt.slice(0,-1)) : o.label.text === txt)) return o; if (o.list) { const f = find(o.list); if (f) return f; } } return null; };
      const bt = find(c.children.list); if (!bt) return null; const m = bt.getWorldTransformMatrix(); return { x: m.tx, y: m.ty }; }, [scene, txt]);
    if (!pos) throw new Error('no button ' + txt); await p.mouse.click(pos.x, pos.y); await p.waitForTimeout(300); };
  const save = () => p.evaluate(() => JSON.parse(localStorage.factower_save_0));
  // Armoury sell
  await go('ArmouryScene'); await clickLabel('ArmouryScene', 'SELL +1'); await clickLabel('ArmouryScene', 'SELL');
  let s = await save(); console.log('after sell: gunners', s.stockpile.gunner, 'nuts', s.nuts);
  // Uplink purchase of gateway node (10 bolts)
  await go('SkillTreeScene');
  const node = await p.evaluate(() => { const c = window.__game.scene.getScene('SkillTreeScene'); const colW = (390 - 32) / 3; return { x: 16 + colW + colW / 2, y: c.CONTENT_TOP + 6 + 62 + 37 }; });
  await p.mouse.click(node.x, node.y); await p.waitForTimeout(300);
  await p.screenshot({ path: process.env.OUT + '/flow-uplink.png' });
  await clickLabel('SkillTreeScene', 'UNLOCK FOR*');
  s = await save(); console.log('after unlock: bolts', s.bolts, 'tree', JSON.stringify(s.skillTree));
  // Save slot delete asks first
  await go('SaveScene');
  const del = await p.evaluate(() => { const c = window.__game.scene.getScene('SaveScene'); const b = c.children.list.find(o => o.bw === 40); return { x: b.x, y: b.y }; });
  await p.mouse.click(del.x, del.y); await p.waitForTimeout(400);
  await p.screenshot({ path: process.env.OUT + '/flow-delete.png' });
  console.log('slot still exists before confirm:', await p.evaluate(() => localStorage.getItem('factower_save_0') !== null));
  await clickLabel('SaveScene', 'DELETE'); await p.waitForTimeout(500);
  console.log('slot deleted after confirm:', await p.evaluate(() => localStorage.getItem('factower_save_0') === null));
  console.log('errors:', errs); if (errs.length) process.exitCode = 1; await b.close();
})();
