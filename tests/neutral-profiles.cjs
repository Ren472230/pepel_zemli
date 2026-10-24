const assert=require('node:assert/strict'),harness=require('./audit-harness.cjs');
const cases=[
 ['mob-raider',.12,1,false],['mob-wolf',.37,1,false],
 ['mob-spider',.62,2,false],['mob-golem',.87,0,false],
 ['mob-wraith',.12,3,true],['mob-gargoyle',.87,1,true]
];
const seen=[];
for(const [id,seed,expected,ruins] of cases){
 const h=harness(),r=h.run;
 h.setRandom(seed);
 r('globalThis.foe='+(ruins?'ruinEnemy()':'neutralEnemy()'));
 const u=JSON.parse(r('JSON.stringify(foe)'));
 assert.equal(u.id,id);
 assert.equal(u.neutral,true);
 assert.equal(u.category,expected,id+' combat class');
 assert(u.hp===u.max&&u.max>0&&u.max<=55,id+' early health');
 assert(u.atk>0&&u.atk<=14&&u.speed>0,id+' early damage/speed');
 seen.push(u);
 r('foe.level=10;stats(foe)');
 assert.equal(r('foe.category'),expected,id+' class after scaling');
}
assert(seen[1].speed>seen[0].speed,'wolf should be quicker than raider');
assert(seen[5].armor>seen[0].armor,'gargoyle should be armored');
assert(seen[3].armor>seen[0].armor,'golem should be armored');
assert.equal(seen[4].race,1,'ruin spirit remains undead');
assert.equal(new Set(seen.map(u=>[u.category,u.max,u.atk,u.armor,u.speed].join(':'))).size,6,'unique combat profiles');
console.log('PASS six distinctive neutral profiles: simulated Node factory and scaling');
