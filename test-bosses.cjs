const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync('dist/index.html','utf8'),code=html.match(/<script>([\s\S]*?)<\/script>/)[1].split("fetch('units.json')")[0];
const nodes=new Map();const ctx=vm.createContext({console,crypto:require('crypto').webcrypto,Math,localStorage:{setItem(){}},document:{getElementById(id){if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',close(){},showModal(){}});return nodes.get(id)}},setTimeout(){},alert(){}});
vm.runInContext(code,ctx);const run=x=>vm.runInContext(x,ctx);
assert.equal(run('typeof ensureBosses'),'function','Boss encounters are missing');
run(`defs=${fs.readFileSync('dist/units.json','utf8')};start(0);S.units=[unit('0-0'),unit('0-1'),unit('0-2')];`);
assert.equal(run('S.map.filter(t=>t.boss).length'),3);
run('ensureBosses();ensureBosses()');assert.equal(run('S.map.filter(t=>t.boss).length'),3);
for(const key of ['knight','giant','dragon']){
 run(`B={enemies:[makeBoss('${key}')],round:1,queue:[],flee:null};`);
 const before=run('S.units.reduce((n,u)=>n+u.hp,0)');run('bossTurn(B.enemies[0])');assert.equal(run('S.units.reduce((n,u)=>n+u.hp,0)'),before,'First move must telegraph');
 assert(run('B.enemies[0].intent.targets.length')>0);run('bossTurn(B.enemies[0])');assert(run('S.units.reduce((n,u)=>n+u.hp,0)')<before);
 assert(fs.existsSync('dist/assets/boss-'+key+'.webp'));
 run(`S.units.forEach(u=>u.hp=u.max);B.enemies.forEach(u=>u.hp=0);B.bossKey='${key}';S.pos=${key==='knight'?27:key==='giant'?46:63};check()`);
 assert.equal(run(`S.defeatedBosses.includes('${key}')`),true);assert.equal(run('B'),null);
}
run(`B={enemies:[makeBoss('knight')],round:1,queue:[],flee:null};bossTurn(B.enemies[0]);bossTurn(B.enemies[0]);bossTurn(B.enemies[0]);bossTurn(B.enemies[0]);`);
assert.equal(run('B.enemies.filter(u=>u.bossSummon&&u.hp>0).length'),1);
run('B.enemies[0].hp=10;bossTurn(B.enemies[0])');assert(run('B.enemies[0].hp')>10);assert.equal(run('B.enemies.filter(u=>u.bossSummon&&u.hp>0).length'),0);
run(`B={enemies:[makeBoss('dragon')],round:1,queue:[],flee:null};bossTurn(B.enemies[0]);bossTurn(B.enemies[0]);`);assert(run('S.units.some(u=>u.burning>0)'));
run('S.units[0].hp=S.units[0].max;S.units[0].guarded=true;const oldHP=S.units[0].hp;damage(S.units[0],10);');assert.equal(run('oldHP-S.units[0].hp'),5);
run(`B=null;delete S.bossMapVersion;S.defeatedBosses=[];S.map.forEach(t=>delete t.boss);ensureBosses();S.pos=S.map.findIndex(t=>t.boss==='giant');beginBoss();flee();`);assert.equal(run('B.flee'),2);assert(run('S.map[S.pos].boss'));
console.log('Boss encounter, telegraph, damage, summon, phase, burning, guard, reward and asset checks passed');
