const assert=require('assert/strict'),harness=require('./audit-harness.cjs');
for(const id of ['1-2-1','1-2-1-0','1-2-1-1']){let h=harness(),run=h.run;h.setRandom(.9);run(`start(1);S.units=[unit('${id}'),unit('1-0')];beginBattle([unit('0-0',true)],{site:1});B.current=S.units[0].uid;let healer=S.units[0],ally=S.units[1],enemy=B.enemies[0];ally.hp=5;enemy.hp=enemy.max=500;let enemyHP=enemy.hp;`);assert.equal(run('healer.category'),4,id+' healer class');assert(run("battleControls().includes('Лечение')"));run('special();target(enemy.uid)');assert.equal(run('enemy.hp'),run('enemyHP'));assert.equal(run('battleAction'),'heal');run('target(ally.uid)');assert(run('ally.hp>5'));console.log('PASS '+id+' has healing button, rejects enemy as healing target and heals ally');}
console.log('PASS all three grave healer forms');
{
 const {run}=harness();run(`start(1);S.units=[unit('1-2-1')];let u=S.units[0];u.category=3;u.level=6;u.hp=11;u.xp=17;S.version=8;migrate()`);assert.equal(run('u.category'),4);assert.equal(run('u.level'),6);assert.equal(run('u.hp'),11);assert.equal(run('u.xp'),17);console.log('PASS existing grave healer is repaired in place with progress intact');
}
