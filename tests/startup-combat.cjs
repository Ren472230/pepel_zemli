const assert=require('assert/strict'),harness=require('./audit-harness.cjs');
for(let race=0;race<4;race++){
 const h=harness(),r=h.run;r(`start(${race});S.units=[unit('${race}-0'),unit('${race}-1'),unit('${race}-2')];S.rival.alive=false;S.pos=1;S.map[1]={type:1,enemyRace:-1};`);
 for(let battle=0;battle<3;battle++){
  r("modalClose();fight('patrol')");let steps=0;
  while(r('!!B')&&steps++<400){if(r('isModalOpen()')){r('modalClose()');continue;}if(r('!!canAct()'))r(`var u=canAct(),foe=frontline(B.enemies)[0];if(u.category===4){var hurt=[S.hero,...allies()].find(a=>a.hp<a.max);if(hurt&&!abilityReason(u,4,'heal')){special();target(hurt.uid)}else focus();}else if(foe){chooseAction('attack');target(foe.uid)}else guard();`);else h.drain(1);}
  assert(r('!B&&!S.ended'),`race ${race} encounter ${battle}`);assert(r('S.units.every(u=>u.hp>0)'),`early casualties race ${race}`);r('consumeFood();consumeFood()');
 }
 assert(r('S.provisions>=24&&S.junk>=9'),`sustainable first expeditions race ${race}`);console.log(`PASS race ${race}: three early wins, no casualties, ${r('S.provisions')} provisions`);
}
