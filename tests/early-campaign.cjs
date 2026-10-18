const assert = require('node:assert/strict');
const harness = require('./audit-harness.cjs');

// GAME-001: controlled, deterministic Node model, NOT a real-browser playthrough.
// The map corridor is a fixture; the game itself handles hiring, trades, daily
// consumption, encounters, battles, loot and return to the starting settlement.
const route = [1, 2, 10, 9, 1, 0, 8, 16, 17, 18, 10, 9, 1, 0, 8];
const patrols = new Set([2, 9, 16]);

function resolveBattle(h, run, race, position) {
  let steps = 0;
  while (run('Boolean(B)') && steps++ < 500) {
    if (run('isModalOpen()')) {
      run('modalClose()');
      continue;
    }
    if (run('Boolean(canAct())')) {
      run(`var acting=canAct(), foe=frontline(B.enemies)[0];
        if(acting.category===4) {
          var hurt=[S.hero,...allies()].find(a=>a.hp<a.max);
          if(hurt&&!abilityReason(acting,4,'heal')) {
            special();target(hurt.uid);
          } else focus();
        } else if(foe) {
          chooseAction('attack');target(foe.uid);
        } else guard();`);
    } else h.drain(1);
  }
  assert(steps < 500 && !run('Boolean(B)'), `battle stuck for race ${race}, tile ${position}`);
  assert(run('!S.ended && S.hero.hp>0'), `hero defeated for race ${race}, tile ${position}`);
  run('modalClose()');
}

for (let race = 0; race < 4; race++) {
  const h = harness(), run = h.run;
  run(`start(${race});S.rival.alive=false;`);
  for (const tile of new Set(route)) {
    if (tile !== 0) run(`S.map[${tile}]={type:0,seen:false}`);
  }
  for (const tile of patrols) run(`S.map[${tile}]={type:1,enemyRace:-1,seen:false}`);
  for (let i = 0; i < 3; i++) run(`hire('${race}-${i}')`);
  assert.equal(run('S.units.length'), 3, `race ${race}: hiring`);
  assert.equal(run('S.gold'), 150, `race ${race}: hiring cost`);
  run("buy('supply');modalClose()");
  assert.equal(run('S.gold'), 140, `race ${race}: initial supply purchase`);
  assert(run('S.provisions>=38'), `race ${race}: reserve supplies`);

  const fought = new Set(), snapshots = [];
  for (const tile of route) {
    const day = run('S.day') + 1;
    run(`move(${tile})`);
    assert.equal(run('S.day'), day, `race ${race}: one day per move to ${tile}`);
    // Leave random world events without cost, exactly as a player may choose.
    run("if(S.event) eventChoice('leave')");
    if (patrols.has(tile) && !fought.has(tile)) {
      fought.add(tile);
      run('fight()');
      resolveBattle(h, run, race, tile);
    }
    run('modalClose()');
    if (tile === 0 && run('S.junk>0')) run('sellJunk();modalClose()');
    const state = JSON.parse(run('JSON.stringify({day:S.day,pos:S.pos,gold:S.gold,food:S.provisions,junk:S.junk,alive:S.units.filter(u=>u.hp>0).length,wins:S.victories,hunger:S.hunger})'));
    snapshots.push(state);
    assert(state.gold >= 0 && state.food >= 0 && state.alive > 0, `race ${race} day ${state.day}: viable state`);
  }
  assert.equal(run('S.day'), 16, `race ${race}: 15 actual world transitions`);
  assert.equal(run('S.victories'), 3, `race ${race}: three patrol victories`);
  assert.equal(run('S.hunger'), 0, `race ${race}: no starvation after resupply`);
  assert(run('S.provisions>0'), `race ${race}: food remains`);
  console.log('GAME-001 modeled route', JSON.stringify({race,days:15,battles:3,final:snapshots.at(-1),settlementReturns:2}));
}
console.log('PASS controlled 15-day routes for four races; no browser or subjective balance claims.');
