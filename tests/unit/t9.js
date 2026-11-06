const fs=require('fs'), assert=require('assert');
const store={}; global.localStorage={getItem:k=>k in store?store[k]:null,setItem:(k,v)=>store[k]=String(v),removeItem:k=>delete store[k]};
eval(['src/data/skillTree.js','src/systems/SkillTreeEffects.js','src/systems/SaveManager.js','src/systems/Factory.js'].map(f=>fs.readFileSync(f,'utf8')).join('\n')+';Object.assign(global,{Factory});');
const order = (f, id, st) => {
  if (!f.canWorkerStartAt(st, id) && f.canStartIfEmpty(st, id)) f.dropToLostFound(id);
  assert(f.canWorkerStartAt(st, id), 'can start ' + st);
  const r = f.setJobFromAssignment(st, id); f.markWalking(st, id); assert(f.startWorkAt(st, id)); return r;
};
const run = (f, ms) => f.catchUp(ms, true);
const finish = (f, id) => { for (let i = 0; i < 100 && f.workers[id].state === 'working'; i++) f.update(250, {}); };

// 1. Base: A → B only. Hauler loads the bench, fetches more, then waits — never builds
let f = new Factory(); f.materials.plasticScrap = 10;
f.placeMachine(1, 1, 'assembly_gunner');
assert.equal(order(f, 0, 'store_scrap'), 'start'); finish(f, 0);
assert.equal(order(f, 0, '1,1'), 'loop'); finish(f, 0);
let built = run(f, 60000);
console.log('A→B hauler alone: towers', built, 'scrap', f.materials.plasticScrap, 'waiting', f.workers[0].waitingFor, 'holding', f.workers[0].inventory.join());
assert.equal(built, 0); assert.equal(f.materials.plasticScrap, 8); assert.equal(f.workers[0].waitingFor, '1,1');

// 2. Hauler + bench operator (posted on the empty bench)
f = new Factory(); f.materials.plasticScrap = 30; f.workers[1].unlocked = true;
f.placeMachine(1, 1, 'assembly_gunner');
assert.equal(order(f, 1, '1,1'), 'operate'); finish(f, 1);
order(f, 0, 'store_scrap'); finish(f, 0); order(f, 0, '1,1'); finish(f, 0);
built = run(f, 60000);
console.log('hauler + operator towers in 60s:', built);
assert(built >= 6);

// 3. Single worker, tutorial flow: A→B, then build (swap) + deliver → runs the bench
f = new Factory(); f.materials.plasticScrap = 10;
f.placeMachine(1, 1, 'assembly_gunner');
order(f, 0, 'store_scrap'); finish(f, 0); order(f, 0, '1,1'); finish(f, 0);
run(f, 15000);                                                    // fetches more, waits at loaded bench
assert.deepEqual(f.workers[0].inventory, ['plasticScrap']);
assert.equal(f.getWorkerAction('1,1', 0), 'assemble_swap');
assert.equal(order(f, 0, '1,1'), 'full');  finish(f, 0);          // route was full (2) → new route [build]
assert.deepEqual(f.workers[0].inventory, ['towerComponent']);
assert.equal(order(f, 0, 'depository'), 'loop'); finish(f, 0);   // [build, deliver] = runs the bench
built = run(f, 20000);
console.log('tutorial flow extra towers:', built + 1);
assert(built >= 1);

// 4. With Foreman (4 stops) one worker runs a bench alone
f = new Factory(); f.routeLength = 4; f.materials.plasticScrap = 10;
f.placeMachine(1, 1, 'assembly_gunner');
order(f, 0, 'store_scrap'); finish(f, 0); assert.equal(order(f, 0, '1,1'), 'loop'); finish(f, 0);
assert.equal(order(f, 0, '1,1'), 'extend'); finish(f, 0); assert.equal(order(f, 0, 'depository'), 'extend'); finish(f, 0);
assert.equal(f.workers[0].job.stops.length, 4);
built = run(f, 60000);
console.log('4-stop solo towers in 60s:', built + 1);
assert(built >= 4);

// 5. Smelter line: W1 hauls scrap → smelter; W2 (4 stops) collects refined → loads → builds → delivers
f = new Factory(); f.routeLength = 4; f.materials.plasticScrap = 10; f.workers[1].unlocked = true;
f.placeMachine(0, 0, 'smelter'); f.placeMachine(1, 0, 'assembly_bomber');
order(f, 0, 'store_scrap'); finish(f, 0); order(f, 0, '0,0'); finish(f, 0);
for (let i = 0; i < 40; i++) f.update(250, {});
order(f, 1, '0,0'); finish(f, 1); order(f, 1, '1,0'); finish(f, 1); order(f, 1, '1,0'); finish(f, 1); order(f, 1, 'depository'); finish(f, 1);
built = run(f, 120000);
console.log('smelter line bombers:', built + 1);
assert(built >= 3);

// 6. Conflict → Lost & Found; L&F pick-up is a one-off
f = new Factory(); f.materials.plasticScrap = 5; f.materials.salvagedMetal = 5;
f.workers[0].inventory = ['plasticScrap'];
assert(!f.canWorkerStartAt('store_metal', 0) && f.canStartIfEmpty('store_metal', 0));
order(f, 0, 'store_metal'); assert.equal(f.lostFound, 'plasticScrap'); finish(f, 0);
f = new Factory(); f.lostFound = 'plasticScrap'; f.placeMachine(0,0,'assembly_gunner');
order(f, 0, 'lostfound'); finish(f, 0); assert.equal(f.lostFound, null); assert.equal(f.workers[0].job, null);

// 7. Save/load, removed machine stops route, legacy migration
f = new Factory(); f.placeMachine(1,1,'assembly_gunner');
f.workers[0].job = { type: 'route', stops: [{ station: 'store_scrap', action: 'collect_scrap' }, { station: '1,1', action: 'deposit' }], pos: 1 };
const sv = {}; f.writeInto(sv); const g = new Factory(); g.loadFromSave(sv);
assert.deepEqual(g.workers[0].job, f.workers[0].job);
g.deleteMachine(1,1); assert.equal(g.workers[0].job, null);
const h = new Factory(); h.loadFromSave({ factory: { grid: f.grid, workers: [{ inventory: [], job: { type: 'haul', from: 'store_scrap', to: '1,1' } }, { inventory: [], job: { type: 'operate', at: '1,1' } }] } });
assert.deepEqual(h.workers[0].job.stops.map(s => s.action), ['collect_scrap', 'deposit']);
assert.deepEqual(h.workers[1].job.stops.map(s => s.action), ['assemble', 'deliver']);

// 8. Pick-up point: collects once, holds it
f = new Factory(); f.materials.plasticScrap = 20;
order(f, 0, 'store_scrap'); run(f, 20000);
assert.equal(f.materials.plasticScrap, 19); assert.equal(f.workers[0].waitingFor, 'destination');
console.log('route tests ok');
