const assert=require('assert/strict'),harness=require('./audit-harness.cjs');
const h=harness(),r=h.run;
assert(r('S.provisions>=30&&S.gold>=360'));
r("S.units=[unit('0-0'),unit('0-1'),unit('0-2')];var foodBefore=S.provisions;consumeFood()");assert.equal(r('foodBefore-S.provisions'),2);
r("S.day=12;S.pos=1;S.map[1]={type:1,enemyRace:-1};fight('patrol')");assert(r('B.enemies.every(u=>u.level===1)&&B.enemies.length===1'));
r('B.enemies.forEach(u=>u.hp=0);check()');assert(r('S.junk>0&&S.provisions>28&&S.bag.length>=2'));assert(r('isModalOpen()'));
r('modalClose();S.pos=0;var cash=S.gold;var trash=S.junk;sellJunk()');assert.equal(r('S.gold-cash'),r('trash*3'));assert.equal(r('S.junk'),0);
r('sellJunk()');assert.equal(r('S.gold-cash'),r('trash*3'));
r('var f=S.provisions;var g=S.gold;buy("supply")');assert.equal(r('S.provisions-f'),8);assert.equal(r('g-S.gold'),10);
r('S.version=9;delete S.economyVersion;S.provisions=0;S.gold=0;S.hunger=4;migrate()');assert(r('S.provisions===30&&S.gold===180&&S.hunger===0'));
r('S.provisions=1;S.gold=1;migrate()');assert(r('S.provisions===1&&S.gold===1'));
for(let race=0;race<4;race++){r(`start(${race});S.junk=4;var before=S.gold;sellJunk()`);assert.equal(r('S.gold-before'),12);}
console.log('PASS startup economy, calendar-independent enemies, guaranteed loot, sale, purchase and migration');

r("start(1);S.pos=1;S.map[1]={type:1};beginBattle([unit('0-0',true)],{site:1});B.enemies[0].escaped=true;check()");assert(r('S.victories===1&&S.junk>0&&S.hero.xp>0'));console.log('PASS fear victory grants loot and experience');
