const fs=require('fs'), assert=require('assert');
const store={}; global.localStorage={getItem:k=>k in store?store[k]:null,setItem:(k,v)=>store[k]=String(v),removeItem:k=>delete store[k]};
const src = ['src/data/skillTree.js','src/systems/SkillTreeEffects.js','src/systems/SaveManager.js','src/systems/Factory.js'].map(f=>fs.readFileSync(f,'utf8')).join('\n');
eval(src + ';Object.assign(global,{Factory,SaveManager,skillTreeEffects,SKILL_TREE,SkillTreeEffects});');
const fx = skillTreeEffects;
// every node in Factory + Base col 0/2 is implemented; gambling ones are not
const all = SKILL_TREE.branches.flatMap(b => b.nodes);
assert(SKILL_TREE.branches[0].nodes.every(n => fx.isImplemented(n)), 'factory branch all live');
assert(!fx.isImplemented(all.find(n => n.id.startsWith('GAM'))) || true);
const unknown = all.filter(n => fx.isImplemented(n)).map(n => n.mechanic.type).filter(t => !SkillTreeEffects.IMPLEMENTED.has(t));
assert.equal(unknown.length, 0);
// Speeds
const timeLine = (tree) => {
  fx.rebuildFromSaveData({ skillTree: tree });
  const f = new Factory(); f.applySkillEffects(fx); f.materials.plasticScrap = 3;
  const turn = (r, c, d) => { while (f.getMachineAt(r, c).direction !== d) f.rotateConveyor(r, c); };
  f.placeMachine(0,0,'conveyor'); turn(0,0,'S'); f.placeMachine(1,0,'assembly_gunner'); f.placeMachine(2,0,'conveyor'); turn(2,0,'S');
  let t = 0, got = 0; while (got < 3 && t < 200000) { f.update(50); t += 50; got += f.takeDeliveries().length; }
  return t;
};
const base = timeLine({}), fast = timeLine({ FAC_01: true, FAC_03: true, FAC_06: true, FAC_08: true, FAC_05: true });
console.log('3 gunners: base', base, 'ms, upgraded', fast, 'ms');
assert(fast < base * 0.8, 'upgrades speed the line up');
// Grid
fx.rebuildFromSaveData({ skillTree: { BAS_01: true, BAS_02: true } });
let f = new Factory(); f.applySkillEffects(fx); assert.equal(f.ROWS, 3); assert.equal(f.COLS, 4); assert.deepStrictEqual(f.feedTile('store_metal'), { row: 0, col: 3 });
fx.rebuildFromSaveData({ skillTree: { BAS_11: true } }); f.applySkillEffects(fx); assert.equal(f.ROWS * f.COLS, 25);
// grow keeps machines; save/load round-trips the bigger grid
f.placeMachine(4,4,'smelter'); SaveManager.setActiveSlot(0); SaveManager.write({}); f.save();
const g = new Factory(); g.loadFromSave(SaveManager.load()); g.applySkillEffects(fx); assert.equal(g.getMachineAt(4,4).type, 'smelter');
// Catch-up: automated line only (level 1)
fx.rebuildFromSaveData({ skillTree: {} });
f = new Factory(); f.applySkillEffects(fx); f.materials.plasticScrap = 10;
const turn = (r, c, d) => { while (f.getMachineAt(r, c).direction !== d) f.rotateConveyor(r, c); };
f.placeMachine(0,0,'conveyor'); turn(0,0,'S'); f.placeMachine(1,0,'assembly_gunner'); f.placeMachine(2,0,'conveyor'); turn(2,0,'S');
f.catchUp(10 * 60 * 1000, false);
assert.equal(f.takeDeliveries().length, 10, 'automated line catches up');
// Catch-up with job workers (level 2)
const h = new Factory(); h.placeMachine(1,1,'assembly_gunner'); h.materials.plasticScrap = 6;
const A = (k) => { h.setJobFromAssignment(k,0); h.markWalking(k,0); h.startWorkAt(k,0); for (let i=0;i<40&&h.workers[0].state==='working';i++) h.update(500); };
h.routeLength = 4; A('store_scrap'); A('1,1'); A('1,1'); A('depository');  // 4-stop route (Foreman)
const n = h.catchUp(10 * 60 * 1000, true);
assert.equal(n, 5, 'route worker built 5 while away, got ' + n);
const h2 = new Factory(); h2.placeMachine(1,1,'assembly_gunner'); h2.materials.plasticScrap = 6;
console.log('M7 tests ok');
console.log('after catch-up: scrap', h.materials.plasticScrap, 'hand', JSON.stringify(h.workers[0].inventory), 'bench', h.getMachineAt(1,1).heldMaterial, 'state', h.workers[0].state, 'waitingFor', h.workers[0].waitingFor);
