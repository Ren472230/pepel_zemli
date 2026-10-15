const assert=require('assert/strict'),harness=require('./audit-harness.cjs');
for(let race=0;race<4;race++)for(let scenario of ['patrol','boss']){
 const h=harness(),run=h.run;h.setRandom(.65);
 run(`start(${race});S.rival.alive=false;S.units=[unit('${race}-0-0-0'),unit('${race}-0-1-0'),unit('${race}-1-0-0'),unit('${race}-1-1-0'),unit('${race}-2-0-0'),unit('${race}-2-1-0')];S.units.forEach(u=>{u.level=15;stats(u)});S.hero.level=20;S.hero.max=S.hero.hp=400;S.hero.points=0;S.hero.maxMana=S.hero.mana=100;S.potions=5;S.hearts=5;S.livers=5;`);
 run(scenario==='boss'?`beginBattle([makeBoss('giant')],{bossKey:'giant',site:S.pos})`:`beginBattle([unit('2-0-0-0',true),unit('2-0-1-0',true),unit('2-1-0-0',true),unit('2-2-0-0',true)],{site:S.pos});B.enemies.forEach(u=>{u.level=10;stats(u)});`);
 let actions=0;
 while(run('Boolean(B)')&&actions++<1500){
  if(run('isModalOpen()')){run('modalClose()');continue;}
  if(run('Boolean(canAct())')){
   run(`var acting=canAct();var foe=frontline(B.enemies)[0];
   if(acting.category===4){var injured=[S.hero,...allies()].filter(u=>u.hp<u.max).sort((a,b)=>a.hp/a.max-b.hp/b.max)[0];if(injured&&!abilityReason(acting,4,'heal')){special();target(injured.uid)}else focus();}
   else if(acting.category===5&&B.summons.filter(u=>u.hp>0).length<2&&!abilityReason(acting,10,'summon')){summon();}
   else if(foe){chooseAction('attack');target(foe.uid);}else guard();`);
  }else h.drain(1);
  assert(run('Number.isFinite(S.hero.hp)&&S.units.every(u=>Number.isFinite(u.hp))'),`finite HP race ${race}`);
 }
 if(run('Boolean(B)'))console.log(run('JSON.stringify({current:actor(B.current),phase:B.phase,log:S.log.slice(0,5)})'));assert(!run('Boolean(B)'),`battle stuck: race ${race}, ${scenario}, current ${run('B?.current')}`);
 console.log(`PASS race ${race}, ${scenario}, ${actions} steps, outcome ${run('S.ended||"victory"')}`);
}
console.log('Completed 8 multi-turn simulations without stuck turns or invalid health.');
