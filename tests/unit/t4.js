const fs=require('fs'), assert=require('assert');
const store={}; global.localStorage={getItem:k=>k in store?store[k]:null,setItem:(k,v)=>store[k]=String(v),removeItem:k=>delete store[k]};
eval(fs.readFileSync('src/systems/SaveManager.js','utf8')+fs.readFileSync('src/systems/Factory.js','utf8')+';Object.assign(global,{Factory,SaveManager,SAVE_VERSION});');
SaveManager.setActiveSlot(0);
// ── Migration of a pre-versioning save
const old={materials:{plasticScrap:5,salvagedMetal:1}}; assert(SaveManager.migrate(old));
assert.equal(old.saveVersion,SAVE_VERSION); assert.equal(old.nuts,0); assert.equal(old.materials.plasticScrap,5);
assert(!SaveManager.migrate(old),'second migrate is a no-op');
SaveManager.write(old);
const f=new Factory(); f.loadFromSave(SaveManager.load());
const tick=()=>f.update(f.BELT_TICK_MS);
// ── Belt (0,0)E → belt (0,1)E → gunner bench (0,2)
f.placeMachine(0,0,'conveyor'); f.placeMachine(0,1,'conveyor'); f.placeMachine(0,2,'assembly_gunner');
f.setTileItem(0,0,'plasticScrap'); tick(); assert.equal(f.getTileItem(0,1),'plasticScrap');
tick(); assert.equal(f.getTileItem(0,1),null); assert.equal(f.getMachineAt(0,2).heldMaterial,'plasticScrap','fed into bench');
// full bench: next item waits on belt
f.setTileItem(0,1,'plasticScrap'); tick(); assert.equal(f.getTileItem(0,1),'plasticScrap','waits while bench full');
// worker assembles → slot frees → belt feeds next
f.markWalking('0,2',0); assert(f.startWorkAt('0,2',0)); assert.equal(f.workers[0].stationAction,'assemble');
f.update(5000); assert.deepStrictEqual(f.workers[0].inventory,['towerComponent']);
tick(); assert.equal(f.getMachineAt(0,2).heldMaterial,'plasticScrap','fed after slot cleared');
// ── Wrong item jams and is reported
f.getMachineAt(0,2).heldMaterial=null; f.setTileItem(0,1,'salvagedMetal'); tick();
assert.equal(f.getTileItem(0,1),'salvagedMetal'); assert.equal(f.getBenchJam(0,2),'salvagedMetal'); assert.equal(f.getMachineAt(0,2).heldMaterial,null);
// ── Belt waits while a worker is heading to deposit at the bench
f.setTileItem(0,1,'plasticScrap'); f.workers[1].unlocked=true; f.workers[1].inventory=['plasticScrap'];
f.markWalking('0,2',1); tick(); assert.equal(f.getTileItem(0,1),'plasticScrap','belt yields to incoming worker');
assert(f.startWorkAt('0,2',1)); f.update(1500); assert.equal(f.getMachineAt(0,2).heldMaterial,'plasticScrap'); assert.deepStrictEqual(f.workers[1].inventory,[]);
assert.equal(f.getTileItem(0,1),'plasticScrap','belt item still waiting, nothing lost');
// ── Since M6 a belt pointing at a smelter loads it
const g=new Factory(); g.placeMachine(1,0,'conveyor'); g.placeMachine(1,1,'smelter'); g.setTileItem(1,0,'plasticScrap'); g.update(600);
assert.equal(g.getTileItem(1,0),null); assert.equal(g.getMachineAt(1,1).heldMaterial,'plasticScrap');
// ── Two belts into one empty bench: exactly one item enters
const h=new Factory(); h.placeMachine(0,1,'conveyor'); h.rotateConveyor(0,1); h.rotateConveyor(0,1); // S
h.placeMachine(1,0,'conveyor'); h.placeMachine(1,1,'assembly_gunner');
h.setTileItem(0,1,'plasticScrap'); h.setTileItem(1,0,'plasticScrap'); h.update(600);
const left=[h.getTileItem(0,1),h.getTileItem(1,0)].filter(Boolean).length;
assert.equal(h.getMachineAt(1,1).heldMaterial,'plasticScrap'); assert.equal(left,1,'one waits, none lost');
// ── Factory.save goes through SaveManager and keeps unrelated fields
SaveManager.update(s=>{s.nuts=7;}); f.save(); assert.equal(SaveManager.load().nuts,7); assert(SaveManager.load().factory.grid);
console.log('M4 tests ok');
