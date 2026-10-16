'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const harness=require('./audit-harness.cjs');

// Factory coverage uses deterministic random, but is not a browser playthrough.
const cases=[
 ['mob-raider','neutralEnemy',0.01,1,0],
 ['mob-wolf','neutralEnemy',0.26,1,0],
 ['mob-spider','neutralEnemy',0.51,1,0],
 ['mob-golem','neutralEnemy',0.76,0,0],
 ['mob-wraith','ruinEnemy',0.01,3,1],
 ['mob-gargoyle','ruinEnemy',0.76,0,0]
];
const signatures=new Set();
for(const [id,factory,random,category,race] of cases){
 const h=harness();h.setRandom(random);
 h.run(`var neutralActor=${factory}();neutralActor.level=1;stats(neutralActor)`);
 const u=JSON.parse(h.run('JSON.stringify(neutralActor)'));
 assert.equal(u.id,id,'factory identity '+id);
 assert.equal(u.category,category,'combat role '+id);
 assert.equal(u.race,race,'spell and faction identity '+id);
 assert.equal(u.neutral,true,'neutral flag '+id);
 assert(u.neutralProfile,'explicit combat profile '+id);
 assert(u.max>=12&&u.atk>0&&u.speed>0,'usable level-one stats '+id);
 assert(fs.existsSync('dist/assets/'+id+'.webp'),'stable portrait '+id);
 signatures.add([u.category,u.max,u.atk,u.armor,u.speed].join(':'));
 if(id==='mob-spider')assert.equal(h.run('protection(neutralActor).res.poison'),.75);
 if(id==='mob-golem')assert.equal(h.run('protection(neutralActor).res.physical'),.5);
 if(id==='mob-wraith')assert.equal(h.run('protection(neutralActor).res.physical'),.5);
}
assert.equal(signatures.size,cases.length,'each neutral has a distinct numeric combat signature');

const battle=harness();battle.setRandom(.01);
battle.run("start(0);S.units=[unit('0-0')];S.rival.alive=false;var ghost=ruinEnemy();ghost.level=1;stats(ghost);beginBattle([ghost],{site:1})");
assert.equal(battle.run('B.enemies[0].category'),3,'ruin wraith uses a caster turn');
assert.equal(battle.run("Boolean(B.racial['true'])"),false,'neutral monsters cannot trigger playable-race finishers');

const patrol=harness();patrol.setRandom(.76);
patrol.run("start(0);S.rival.alive=false;S.units=[unit('0-0')];S.pos=1;S.map[1]={type:1,enemyRace:-1};fight()");
assert.equal(patrol.run('B.enemies[0].id'),'mob-golem');
assert.equal(patrol.run('B.enemies[0].neutralProfile!==undefined'),true,'main encounter factory must use profile');

// An old in-progress battle keeps its original health and role on resume.
const legacy=harness();
legacy.run("start(0);S.units=[unit('0-0')];var oldMob={...unit('0-0',true),id:'mob-wolf',name:'Пепельный волк',neutral:true};oldMob.level=2;stats(oldMob);oldMob.hp=7;beginBattle([oldMob],{site:1});B.current='hero';B.phase='ready';save();S=null;B=null;loadGame()");
assert.equal(legacy.run('B.enemies[0].hp'),7,'legacy battle hit points survive reload');
assert.equal(legacy.run('B.enemies[0].category'),0,'legacy battle role is not silently rewritten');
assert.equal(legacy.run('B.enemies[0].neutralProfile'),undefined,'legacy encounter remains unchanged');
console.log('PASS six distinct neutral profiles, factory encounters, resistance, saved battles and neutral finisher isolation');
