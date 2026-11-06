const fs=require('fs'), assert=require('assert');
const store={}; global.localStorage={getItem:k=>k in store?store[k]:null,setItem:(k,v)=>store[k]=String(v),removeItem:k=>delete store[k]};
eval(fs.readFileSync('src/systems/SaveManager.js','utf8')+fs.readFileSync('src/systems/Factory.js','utf8')+';Object.assign(global,{Factory,SaveManager});');
const turn = (f, r, c, dir) => { while (f.getMachineAt(r, c).direction !== dir) f.rotateConveyor(r, c); };
// Gunner line: (0,0) belt S ← scrap store feeds it; (1,0) gunner bench; (2,0) belt S → depository
let f = new Factory(); f.materials.plasticScrap = 4;
f.placeMachine(0,0,'conveyor'); turn(f,0,0,'S');
f.placeMachine(1,0,'assembly_gunner');
f.placeMachine(2,0,'conveyor'); turn(f,2,0,'S');
let got = [];
for (let i = 0; i < 400; i++) { f.update(100); got = got.concat(f.takeDeliveries()); }
assert.equal(f.materials.plasticScrap, 0); assert.deepStrictEqual(got, ['gunner','gunner','gunner','gunner'], 'auto line built ' + got.length);
// No output belt → bench loads but doesn't assemble
f = new Factory(); f.materials.plasticScrap = 2;
f.placeMachine(0,0,'conveyor'); turn(f,0,0,'S'); f.placeMachine(1,0,'assembly_gunner');
for (let i = 0; i < 200; i++) f.update(100);
assert.equal(f.getMachineAt(1,0).heldMaterial, 'plasticScrap', 'loaded, waiting for a worker or output belt');
// Smelter line → bomber: (0,0)S feed, (1,0) smelter, (1,1) belt E, (1,2) bomber bench, (2,2) belt S → depot
f = new Factory(); f.materials.plasticScrap = 3;
f.placeMachine(0,0,'conveyor'); turn(f,0,0,'S'); f.placeMachine(1,0,'smelter');
f.placeMachine(1,1,'conveyor'); turn(f,1,1,'E'); f.placeMachine(1,2,'assembly_bomber');
f.placeMachine(2,2,'conveyor'); turn(f,2,2,'S');
got = []; for (let i = 0; i < 1200; i++) { f.update(100); got = got.concat(f.takeDeliveries()); }
assert.deepStrictEqual(got, ['bomber','bomber','bomber'], 'smelter→bomber line, got ' + JSON.stringify(got));
// Raw scrap on the bottom belt does NOT enter the depository
f = new Factory(); f.placeMachine(2,1,'conveyor'); turn(f,2,1,'S'); f.setTileItem(2,1,'plasticScrap');
f.update(600); assert.equal(f.getTileItem(2,1), 'plasticScrap'); assert.equal(f.takeDeliveries().length, 0);
// Worker drops a finished tower on a belt → typed tower item
f = new Factory(); f.placeMachine(2,1,'conveyor'); turn(f,2,1,'S');
f.workers[0].inventory = ['towerComponent']; f.workers[0]._producedTowerType = 'barricade';
f.markWalking('2,1',0); assert(f.startWorkAt('2,1',0)); for (let i=0;i<20;i++) f.update(100);
assert.deepStrictEqual(f.takeDeliveries(), ['barricade']);
console.log('M6 auto-output tests ok');
