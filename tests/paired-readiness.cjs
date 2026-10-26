const assert = require('node:assert/strict');
const harness = require('./audit-harness.cjs');

// GAME-001 paired, observational Node VM probe. Same race, map seed,
// generated patrol tile, and separate fight seed. This is NOT browser play.
// The same simple tactical policy controls either one archer or three hires.
const seeds = [1, 7, 19, 42, 101, 2026];
const rows = [];
function reseed(run, seed) {
  run('Math.random=(function(){let x=' + (seed >>> 0) +
    '>>>0;return function(){x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;}})()');
}
function distance(i) { return i % 8 + Math.floor(i / 8); }
function route(i) {
  let at = 0, path = [];
  while (Math.floor(at / 8) < Math.floor(i / 8)) { at += 8; path.push(at); }
  while (at % 8 < i % 8) { at++; path.push(at); }
  return path;
}
function settleInterruptions(run) {
  if (run('Boolean(S.event)')) run("eventChoice('leave')");
  if (run('isModalOpen()')) run('modalClose()');
}
function step(run, i, label) {
  settleInterruptions(run);
  const day = run('S.day');
  run('move(' + i + ')');
  assert.equal(run('S.day'), day + 1, label + ' day advanced');
  assert.equal(run('S.pos'), i, label + ' reached expected tile');
  assert(!run('Boolean(B)'), label + ' no forced battle during controlled travel');
  settleInterruptions(run);
  assert(run('S.gold>=0 && S.provisions>=0'), label + ' nonnegative resources');
}
function battle(h, run, label, heroGuardRounds = 4) {
  let actions = 0, maxDead = 0;
  while (run('Boolean(B)') && actions++ < 1200) {
    maxDead = Math.max(maxDead, run('S.units.filter(u=>u.hp<=0).length'));
    if (run('isModalOpen()')) run('modalClose()');
    else if (run('Boolean(canAct())')) {
      run("var a=canAct(), foe=frontline(B.enemies)[0];" +
        "if(a.category===4){" +
          "var hurt=[S.hero,...allies()].find(u=>u.hp>0&&u.hp<u.max);" +
          "if(hurt&&!abilityReason(a,4,'heal')){special();target(hurt.uid)}else focus();" +
        "}else if(a.hero&&S.units.some(u=>u.hp>0)&&B.round<="+heroGuardRounds+"){guard();}" +
        "else if(a.hero&&a.hp<a.max*.55&&S.potions>0){potion(false);}" +
        "else if(foe){chooseAction('attack');target(foe.uid)}else guard();");
    } else h.drain(1);
  }
  if (run('Boolean(B)')) console.log('GAME-001 paired stalled', label, run('JSON.stringify({round:B.round,phase:B.phase,pending:B.queue.length,units:S.units.map(u=>({hp:u.hp,category:u.category})),enemies:B.enemies.map(u=>({hp:u.hp,category:u.category}))})'));
  assert(actions < 1200 && !run('Boolean(B)'), label + ' combat resolved');
  settleInterruptions(run);
  return {actions, dead: Math.max(maxDead,run('S.units.filter(u=>u.hp<=0).length'))};
}
function attempt(race, seed, prepared, options = {}) {
  const h = harness(), run = h.run, label = 'race '+race+' seed '+seed+' prepared '+prepared;
  reseed(run,seed);
  run('start('+race+')');
  assert(run('S.rival.alive'),label+' rival active');
  const world = JSON.parse(run('JSON.stringify(S.map.map(t=>({type:t.type,boss:t.boss||null})))'));
  const candidates = world.map((t,i)=>t.type===1?i:-1)
    .filter(i=>i>=0 && (options.nearestPatrol ? distance(i)>=1 : (distance(i)>=5&&distance(i)<=7)))
    .sort((a,b)=>distance(a)-distance(b)||a-b);
  assert(candidates.length,label+' selected patrol exists');
  const patrol = candidates[0], outward = route(patrol);
  if (prepared) {
    for(let i=0;i<3;i++)run("hire('"+race+"-"+i+"')");
  } else run("hire('"+race+"-1')");
  assert.equal(run('S.units.length'),prepared?3:1,label+' hire count');
  run("buy('supply');modalClose()");
  for (const i of outward) step(run,i,label+' outward');
  assert.equal(run('S.map[S.pos].type'),1,label+' natural patrol tile');
  const before = JSON.parse(run('JSON.stringify({day:S.day,gold:S.gold,food:S.provisions,hero:S.hero.hp,living:S.units.filter(u=>u.hp>0).length,victories:S.victories})'));
  // Equalise enemy generation between recruitment policies while keeping
  // terrain, route and game combat functions intact.
  reseed(run,seed*65537+race*8191+2301);
  run('fight()');
  assert(run('Boolean(B)'),label+' combat starts');
  const enemies = JSON.parse(run('JSON.stringify(B.enemies.map(u=>({id:u.id,race:u.race,category:u.category,level:u.level,max:u.max})))'));
  assert(enemies.length>=2,label+' generated multi-enemy patrol');
  assert(enemies.some(u=>u.category!==4||![0,3].includes(u.race)),label+' enemy has an attacker');
  const result = battle(h,run,label,options.heroGuardRounds ?? 4);
  const heroAlive = run('S.hero.hp>0 && !S.ended');
  const victory = run('S.victories') > before.victories;
  let revived = 0, healed = false, unaffordableDead = 0, townSpend = 0, day15 = false;
  if(heroAlive) {
    assert(victory,label+' surviving hero won');
    for(const i of outward.slice(0,-1).reverse().concat(0))step(run,i,label+' homeward');
    assert.equal(run('S.pos'),0,label+' returned home');
    const town = JSON.parse(run('JSON.stringify({gold:S.gold,junk:S.junk,food:S.provisions,dead:S.units.filter(u=>u.hp<=0).length})'));
    if(town.junk>0)run('sellJunk();modalClose()');
    while(run('S.units.some(u=>u.hp<=0)') && run('S.gold>='+(60+(options.minReserve ?? 0)))){
      const beforeDead = run('S.units.filter(u=>u.hp<=0).length');
      run('revive();modalClose()');
      assert.equal(run('S.units.filter(u=>u.hp<=0).length'),beforeDead-1,label+' genuine revive');
      revived++;
    }
    unaffordableDead = run('S.units.filter(u=>u.hp<=0).length');
    if(run('S.gold>='+(25+(options.minReserve ?? 0))+'&&(S.hero.hp<S.hero.max||S.units.some(u=>u.hp>0&&u.hp<u.max))')) {
      run('heal();modalClose()');healed=true;
    }
    const foodBefore = run('S.provisions');
    if(foodBefore<24&&run('S.gold>='+(10+(options.minReserve ?? 0))))run("buy('supply');modalClose()");
    const boughtFood = run('S.provisions')>foodBefore;
    townSpend=revived*60+(healed?25:0)+(boughtFood?10:0);
    assert.equal(run('S.gold'),town.gold+town.junk*3-townSpend,label+' exact recovery and supply costs');
    for(let n=outward.length*2;n<14;n++)step(run,run('S.pos')===0?1:0,label+' later travel');
    run('rest()');settleInterruptions(run);
    assert.equal(run('S.day'),16,label+' completed 15 day transitions');
    day15=true;
  } else assert(run('Boolean(S.ended)'),label+' defeated hero ends run');
  return {race,seed,prepared,patrol,map:JSON.stringify(world),enemies,before,
    actions:result.actions,naturallyDead:result.dead,heroAlive,victory,revived,healed,
    unaffordableDead,townSpend,day15,final:JSON.parse(run('JSON.stringify({day:S.day,gold:S.gold,food:S.provisions,hunger:S.hunger,living:S.units.filter(u=>u.hp>0).length,ended:S.ended})'))};
}
if (require.main === module) {
for(const race of [0,1,2,3]) {
  for(const seed of seeds) {
    const weak=attempt(race,seed,false),full=attempt(race,seed,true);
    assert.equal(weak.patrol,full.patrol,'paired same patrol');
    assert.equal(weak.map,full.map,'paired same generated world');
    assert.deepEqual(weak.enemies,full.enemies,'paired same generated threat');
    rows.push({race,seed,patrol:weak.patrol,enemies:weak.enemies.map(e=>e.id),
      weak:{heroAlive:weak.heroAlive,fallen:weak.naturallyDead,revived:weak.revived,
        townSpend:weak.townSpend,gold:weak.final.gold,food:weak.final.food,living:weak.final.living,unaffordableDead:weak.unaffordableDead,day15:weak.day15},
      full:{heroAlive:full.heroAlive,fallen:full.naturallyDead,revived:full.revived,
        townSpend:full.townSpend,gold:full.final.gold,food:full.final.food,living:full.final.living,unaffordableDead:full.unaffordableDead,day15:full.day15}});
  }
}
assert.equal(rows.length,24,'all 24 paired difficult encounters represented');
for(const row of rows)console.log('GAME-001 paired preparation',JSON.stringify(row));
const tally=policy=>({
  heroSurvived:rows.filter(x=>x[policy].heroAlive).length,
  failed:rows.filter(x=>!x[policy].heroAlive).length,
  naturalLossScenarios:rows.filter(x=>x[policy].fallen>0).length,
  revivalScenarios:rows.filter(x=>x[policy].revived>0).length,
  completed15Days:rows.filter(x=>x[policy].day15).length,
  settlementSpendIncludingSupplies:rows.reduce((sum,x)=>sum+x[policy].townSpend,0),
  survivingHeroesUnableToReviveAll:rows.filter(x=>x[policy].heroAlive&&x[policy].unaffordableDead>0).length
});
console.log('GAME-001 paired summary',JSON.stringify({
  races:4,seedsPerRace:6,pairedBattles:24,weak:tally('weak'),full:tally('full'),
  method:'same generated map/patrol/enemy seed; Node VM mocked DOM; no real browser; tactical policy fixed; observational only'
}));
console.log('PASS 24 paired readiness models; interpret differences as model outcomes, not player enjoyment.');

}
module.exports = { attempt };
