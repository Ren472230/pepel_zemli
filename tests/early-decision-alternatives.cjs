const assert = require('node:assert/strict');
const { attempt } = require('./paired-readiness.cjs');

// GAME-001 / cycle 14. Observational policies, not a balance verdict.
// Compare exactly the three flagged cases from cycle 13 on the same seeded
// generated map, patrol and initial enemy composition. No scripted wounds,
// altered enemy stats or modified game code. Node VM, NOT real browser play.
const flagged = [
  { race:0, seed:2026, previousHeroAlive:false }, // humans, full party
  { race:3, seed:2026, previousHeroAlive:false }, // elves, full party
  { race:3, seed:7, previousHeroAlive:true, previousGold:2 } // expensive return
];
const records = [];
const baselines = new Map();

function comparable(a,b,label) {
  assert.equal(a.patrol,b.patrol,label+': same patrol location');
  assert.equal(a.map,b.map,label+': same generated map');
  assert.deepEqual(a.enemies,b.enemies,label+': same initial enemies');
  assert.deepEqual(a.before,b.before,label+': same resources before battle');
}
function snapshot(x) {
  return { heroAlive:x.heroAlive, battleActions:x.actions,
    naturallyDead:x.naturallyDead, revived:x.revived, healed:x.healed,
    pendingDead:x.unaffordableDead, townSpendIncludingSupplies:x.townSpend,
    day15:x.day15, gold:x.final.gold, food:x.final.food,
    living:x.final.living, hunger:x.final.hunger };
}
for (const item of flagged) {
  const label='race '+item.race+', seed '+item.seed;
  const base=attempt(item.race,item.seed,true);
  const early=attempt(item.race,item.seed,true,{heroGuardRounds:2});
  const active=attempt(item.race,item.seed,true,{heroGuardRounds:0});
  comparable(base,early,label+' guard 2');
  comparable(base,active,label+' guard 0');
  assert.equal(base.heroAlive,item.previousHeroAlive,label+': reproduce cycle-13 survival');
  if(item.previousGold!==undefined) assert.equal(base.final.gold,item.previousGold,
    label+': reproduce cycle-13 end gold');
  // Stable acceptance fixtures: this is a seeded regression, not a promise
  // that every random world or every player policy will win.
  if (item.race===0 && item.seed===2026)
    assert(early.heroAlive && early.day15,
      label+': shorter hero defense rescues this seeded human scenario');
  if (item.race===3 && item.seed===7)
    assert(early.heroAlive && early.day15 && early.final.gold>=20 &&
      early.final.living===3,
      label+': elves survive with three fighters and cash reserve under two-round defense');
  baselines.set(label,base);
  records.push({race:item.race,seed:item.seed,patrol:base.patrol,
    enemyIds:base.enemies.map(e=>e.id),
    guardFirstFourRounds:snapshot(base),
    guardFirstTwoRounds:snapshot(early),
    heroAttacksImmediately:snapshot(active)});
}
// Separate decision: choose the closest generated patrol instead of the
// distant high-risk encounter. This deliberately changes the encounter,
// so only map and race/seed are compared, not the enemy composition.
for (const race of [0,3]) {
  const label='race '+race+', seed 2026';
  const far=baselines.get(label);
  const near=attempt(race,2026,true,{nearestPatrol:true,heroGuardRounds:2});
  assert.equal(near.map,far.map,label+': nearest alternative uses same generated map');
  const distance=i=>i%8+Math.floor(i/8);
  assert(distance(near.patrol)<=distance(far.patrol),
    label+': chosen encounter is at least as close');
  assert(near.heroAlive && near.day15 && near.final.living===3,
    label+': nearby patrol yields a viable 15-day continuation in this fixed seed');
  console.log('GAME-001 patrol distance choice',JSON.stringify({
    race,seed:2026,farPatrol:far.patrol,nearPatrol:near.patrol,
    farEnemies:far.enemies.map(e=>e.id),nearEnemies:near.enemies.map(e=>e.id),
    farDistance:distance(far.patrol),nearDistance:distance(near.patrol),
    farBaseline:snapshot(far),nearPolicy:snapshot(near),
    note:'enemy generation may differ with encounter; route/timing and RNG are not isolated'
  }));
}
// A small, player-controlled resource choice: preserve >=20 gold after
// discretionary spending when the survivor returns to the settlement.
// It may leave fighters unrevived or wounds untreated. Treat that as a cost.
const label='race 3, seed 7';
const normal=baselines.get(label);
const reserve=attempt(3,7,true,{minReserve:20});
comparable(normal,reserve,label+' savings policy');
assert.equal(reserve.heroAlive,normal.heroAlive,label+': pre-town combat unchanged');
assert(reserve.final.gold>=normal.final.gold,label+': saved gold not below baseline');
console.log('GAME-001 decision alternatives',JSON.stringify({
  cases:records,
  reserve20OnElvesSeed7:{standard:snapshot(normal),reserve:snapshot(reserve)},
  method:'Node VM with mocked DOM; identical initial map, patrol and enemy seed; simple tactical policies; actual game combat and settlement actions; no real-browser play. RNG rolls after initial composition can diverge with actions; no claims about universal fairness.'
}));
console.log('PASS controlled risk-policy and settlement-reserve probes; interpret losses and tradeoffs case by case.');
