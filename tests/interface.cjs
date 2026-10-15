const assert=require('assert/strict'),fs=require('fs'),harness=require('./audit-harness.cjs');const h=harness(),run=h.run;
run(`start(1);S.units=[unit('1-0'),unit('1-2'),unit('1-1-1')];changeTab('army')`);
let html=h.nodes.get('app').innerHTML;
assert(html.includes('roster-list'));assert(html.includes('hero-strip'));assert(html.includes('resource-bar'));assert(!html.includes('Костяной арбалетчик'));assert(!html.includes('undefined'));
run(`start(0);B={id:'test',enemies:[unit('2-0',true)],summons:[],round:1,current:'hero',queue:[],flee:null,phase:'ready'};summonFor(S.hero);let summonName=B.summons[0].name;let summonClass=B.summons[0].category;save();loadGame()`);
assert.equal(run('B.summons[0].name'),run('summonName'));assert.equal(run('B.summons[0].category'),run('summonClass'));
run(`B=null;restart()`);assert(h.nodes.get('modal').innerHTML.includes('start(S.race)'));assert(h.nodes.get('modal').innerHTML.includes('modal-close'));
for(const d of JSON.parse(run('JSON.stringify(defs)'))){if(d.parent){let parent=JSON.parse(run(`JSON.stringify(defs.find(d=>d.id==='${d.parent}'))`));assert.equal(d.role,parent.role,d.id+' role transition');}assert(fs.existsSync('dist/assets/'+d.id+'.webp'));}
console.log('PASS campaign shell, compact roster, mage label, summon round-trip, in-app restart and every evolution role/portrait.');
