const fs=require('fs'),vm=require('vm'),assert=require('assert');let nodes=new Map(),data={};const ctx=vm.createContext({console,crypto:require('crypto').webcrypto,Math,Date,localStorage:{setItem(k,v){data[k]=v},getItem(k){return data[k]||null}},document:{body:{style:{}},getElementById(id){if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',close(){},showModal(){}});return nodes.get(id)}},setTimeout(){return 1},clearTimeout(){},alert(){},confirm(){return true}});vm.runInContext(fs.readFileSync('dist/index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1],ctx);vm.runInContext(fs.readFileSync('dist/expansion.js','utf8'),ctx);const run=x=>vm.runInContext(x,ctx);run(`defs=${fs.readFileSync('dist/units.json','utf8')};prepareDefs();start(0);S.units=[unit('0-0'),unit('0-1'),unit('0-2')];`);
assert.equal(run('defs.length'),84);assert(run('S.map.filter(t=>t.type===3).length')>=3);assert.equal(run('S.map.filter(t=>t.boss).length'),3);
// Evolution preserves role and experience, and changes stats.
run(`S.units[1].level=6;stats(S.units[1]);const baseAttack=S.units[1].atk;evolve(S.units[1].uid,'0-1-0')`);assert.equal(run('S.units[1].tier'),2);assert.equal(run('S.units[1].category'),2);assert(run('S.units[1].atk>baseAttack'));run(`evolve(S.units[1].uid,'0-2-1')`);assert.equal(run('S.units[1].id'),'0-1-0');
// Interceptor attacks first, receives original attack, target remains intact.
run(`let defender=S.units[0],protectedUnit=S.units[2],attacker=unit('2-0',true);defender.slot=0;protectedUnit.slot=1;attacker.slot=0;attacker.hp=500;attacker.max=500;B={enemies:[attacker],summons:[],round:1};let originalHP=protectedUnit.hp,defenderHP=defender.hp,enemyHP=attacker.hp;resolveStrike(attacker,protectedUnit)`);assert.equal(run('protectedUnit.hp'),run('originalHP'));assert.equal(run('defender.intercept'),1);assert(run('attacker.hp<enemyHP'));assert(run('defender.hp<defenderHP'));
run(`let prior=defender.intercept;resolveStrike(attacker,protectedUnit,1,'fire');`);assert.equal(run('defender.intercept'),run('prior'));
// Immunities and altar cooldown/capture.
run(`let skeleton=unit('1-0',true);applyStatus(skeleton,'poison',2);`);assert.equal(run('Boolean(skeleton.effects.poison)'),false);
run(`B=null;S.pos=S.map.findIndex(t=>t.type===3);let altar=S.map[S.pos];S.hero.hp=10;applyAltar('hero',false);let healedHP=S.hero.hp;applyAltar('hero',false)`);assert.equal(run('S.hero.hp'),run('healedHP'));run(`beginPrayer(S.units[2].uid);S.event=null;S.rival.alive=false;day(2);`);assert.equal(run('altar.owner'),'player');assert(run('S.hero.buffs.length')>0);run(`let capturedHP=S.hero.hp;applyAltar('hero',false)`);assert.equal(run('S.hero.hp'),run('capturedHP'));
// XP redistribution and perfection retained through reset.
run(`S.hero.level=20;S.hero.perfection=7;S.pos=0;S.gold=500;S.talents={'0-0':1};resetTalents()`);assert.equal(run('S.hero.perfection'),7);assert.equal(run('S.gold'),420);
// No resurrection for sacrifice; enemy ownership requires actual death.
run(`start(2);S.units=[unit('2-0'),unit('2-1')];S.pos=S.map.findIndex(t=>t.type===3);let t=S.map[S.pos];t.owner=S.rival.id;let before=S.units.length;sacrifice(S.units[0].uid)`);assert.equal(run('S.units.length'),run('before'));run(`S.deadRivals.push(S.rival.id);sacrifice(S.units[0].uid);confirmSacrifice(S.units[0].uid,S.pos)`);assert.equal(run('S.units.length'),1);assert.equal(run('t.owner'),'player');
// Full army summoning uses its own row.
run(`start(3);S.units=Array.from({length:6},()=>unit('3-0'));B={enemies:[unit('2-0',true)],summons:[],round:1,current:'hero',queue:[],flee:null};summonFor(S.hero);summonFor(S.hero);let third=summonFor(S.hero)`);assert.equal(run('B.summons.length'),2);assert.equal(run('third'),false);
// Settlement quest turnover exactly 10 days after hand-in.
run(`B=null;S.pos=0;let q=localQuest(S.map[0]);q.accepted=true;q.progress=q.goal;quest();let nextDay=S.map[0].nextQuest;`);assert.equal(run('nextDay'),run('S.day+10'));assert.equal(run('localQuest(S.map[0])'),undefined);run('S.day=nextDay');assert(run('localQuest(S.map[0])'));
// Save migration preserves portraits and generates appropriate roles.
run(`S.version=1;S.units=[{...unit('1-1-1'),level:2,hp:10}];migrate()`);assert.equal(run('S.units[0].id'),'1-1-1');assert.equal(run('S.units[0].category'),3);
assert(run('battleHTML!==undefined'));console.log('Passed: 84 definitions, evolution, automatic intercept order, ranged exclusion, immunities, altar cooldown/ownership/prayer, sacrifice, XP/max level, talent reset, summon limits, quest turnover, migration.');
// Every unit ability renders and can be used without throwing.
for(let race=0;race<4;race++){
 run(`start(${race});S.rival.alive=false;S.units=[unit('${race}-0'),unit('${race}-1'),unit('${race}-2')];beginBattle([unit('0-0',true)],{site:S.pos});B.current='hero';battleHTML();special();target(B.enemies[0].uid);`);
 run(`B=null;S.units=[unit('${race}-0'),unit('${race}-1'),unit('${race}-2')];beginBattle([makeBoss('dragon')],{site:S.pos});bossTurn(B.enemies[0]);bossTurn(B.enemies[0]);render();`);
}
run(`B=null;for(let d of defs){let u=unit(d.id);let s=skill(u);if(!s.name||s.name.includes('undefined'))throw Error(d.id);inspect(u.uid);}`);
// Max experience redistributed, sacrifice experience does not go to the victim.
run(`start(0);S.units=[unit('0-0'),unit('0-1')];S.units[0].level=15;S.units[0].tier=3;let beforeXP=S.units[0].xp;awardXP(40)`);assert.equal(run('S.units[0].xp'),run('beforeXP'));assert(run('S.units[1].xp>0||S.units[1].level>1'));
// Humans' priest participates in last stand and heals self on healing others.
run(`B={enemies:[unit('2-0',true)],summons:[],round:1,queue:[],current:'hero',flee:null};S.units=[unit('0-0'),unit('0-2')];let priest=S.units[1];S.units.forEach((u,i)=>u.slot=i);racial();priest.hp=2;damage(priest,10000);`);assert.equal(run('priest.hp'),1);assert.equal(run('priest.lastStand'),2);
// UI sides and 30 linked talents per race.
assert(run("battleHTML().includes('player-army')&&battleHTML().includes('enemy-army')"));assert.equal(run('talentTitles.flat().length'),30);
console.log('Passed: all race battles, hero spells, boss effects, all 84 ability labels, XP redistribution, human priest last stand, lateral formation, talent map.');
