const assert=require('node:assert/strict'),harness=require('./audit-harness.cjs');
const kinds=[
 [.01,'neutralEnemy','mob-raider',1],
 [.30,'neutralEnemy','mob-wolf',1],
 [.55,'neutralEnemy','mob-spider',2],
 [.80,'neutralEnemy','mob-golem',0],
 [.01,'ruinEnemy','mob-wraith',3],
 [.90,'ruinEnemy','mob-gargoyle',1]
];
for(const [random,factory,id,category] of kinds){
 const h=harness(),run=h.run;h.setRandom(random);
 run('var creature='+factory+'()');
 assert.equal(run('creature.id'),id,id+' portrait identity');
 assert.equal(run('creature.category'),category,id+' tactical category');
 assert.equal(run('creature.neutralProfile'),1,id+' profile marker');
 assert.equal(run('creature.neutral'),true,id+' neutral flag');
 assert.equal(run('creature.enemy'),true,id+' enemy flag');
 assert.equal(run('creature.hp'),run('creature.max'),id+' spawn health');
 run('creature.level=4;stats(creature)');
 assert.equal(run('creature.hp'),run('creature.max'),id+' health at level 4');
 assert(Number.isFinite(run('creature.atk'))&&run('creature.atk')>0,id+' attack');
 console.log('PASS '+id);
}
const h=harness(),run=h.run;
h.setRandom(.01);run('var raider=neutralEnemy()');
h.setRandom(.30);run('var wolf=neutralEnemy()');
h.setRandom(.55);run('var spider=neutralEnemy()');
h.setRandom(.80);run('var golem=neutralEnemy()');
h.setRandom(.01);run('var wraith=ruinEnemy()');
assert(run('wolf.speed>raider.speed'),'wolf faster than raider');
assert(run('golem.max>raider.max'),'golem more durable');
assert(run('spider.speed>raider.speed'),'spider more mobile');
assert.equal(run('protection(spider).res.poison'),.75,'spider poison resistance');
assert.equal(run('protection(golem).res.physical'),.5,'golem physical resistance');
assert.equal(run('protection(wraith).res.physical'),.5,'wraith physical resistance');
assert.equal(run('basicDamageType(wraith)'),'dark','wraith magical attack');
console.log('PASS category, speed and resistance distinction');
const h2=harness(),s=h2.run;
s("start(1);S.rival.alive=false;S.units=[unit('1-0')]");
s("var go={...unit('0-0',true),id:'mob-golem',name:'Осколочный голем',neutral:true,category:0,max:43,hp:21,atk:8,speed:5,armor:2}");
s("var wr={...unit('1-0',true),id:'mob-wraith',name:'Дух руин',neutral:true,category:0,max:43,hp:21,atk:8,speed:5,armor:2}");
s("var oldUids=[go.uid,wr.uid];B={id:crypto.randomUUID(),enemies:[go,wr],summons:[],queue:[],current:'hero',flee:null,phase:'ready',round:1,site:S.pos};save();B=null;S=null;loadGame()");
const result=JSON.parse(s("JSON.stringify(B.enemies.map(e=>({id:e.id,uid:e.uid,category:e.category,profile:e.neutralProfile,hp:e.hp,max:e.max})))"));
assert.equal(result[0].category,0,'old golem defender');
assert.equal(result[1].category,3,'old wraith becomes caster');
for(const e of result){
 assert.equal(e.profile,1,e.id+' migrated profile');
 assert(Math.abs(e.hp/e.max-21/43)<.05,e.id+' remaining HP ratio');
 assert(e.hp>0&&e.hp<=e.max,e.id+' valid health');
}
assert.equal(s('B.enemies[0].uid'),s('oldUids[0]'));
assert.equal(s('B.enemies[1].uid'),s('oldUids[1]'));
s('save();loadGame()');
assert.equal(s('B.enemies[1].max'),result[1].max,'migration idempotent');
console.log('PASS legacy combat save profile migration');
