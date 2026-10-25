const assert = require('node:assert/strict');
const harness = require('./audit-harness.cjs');

// GAME-001: scripted Node model, not a player or real browser.
// Keep the generated world and rival active; seek real patrol tiles.
// Model a basic player policy, then measure the cost of recovery at home.
const seeds = [1, 19, 42];
const raceMapSignatures = [new Set(), new Set(), new Set(), new Set()];

function battle(h, run, label) {
  let steps = 0;
  while (run('Boolean(B)') && steps++ < 650) {
    if (run('isModalOpen()')) {
      run('modalClose()');
    } else if (run('Boolean(canAct())')) {
      run("var acting=canAct(),foe=frontline(B.enemies)[0];" +
        "if(acting.category===4){" +
          "var hurt=[S.hero,...allies()].find(a=>a.hp<a.max);" +
          "if(hurt&&!abilityReason(acting,4,'heal')){special();target(hurt.uid)}else focus();" +
        "}else if(foe){chooseAction('attack');target(foe.uid)}else guard();");
    } else {
      h.drain(1);
    }
  }
  assert(steps < 650 && !run('Boolean(B)'), label + ': battle must finish');
  assert(run('!S.ended && S.hero.hp > 0'), label + ': hero survives');
  run('if(isModalOpen())modalClose()');
}

function routeFromStart(index) {
  const path = [];
  let current = 0;
  while (Math.floor(current / 8) < Math.floor(index / 8)) {
    current += 8;
    path.push(current);
  }
  while (current % 8 < index % 8) {
    current++;
    path.push(current);
  }
  return path;
}

for (const race of [0, 1, 2, 3]) {
  for (const seed of seeds) {
    const h = harness(), run = h.run;
    const label = 'race ' + race + ', seed ' + seed;
    run('Math.random=(function(){let n=' + seed +
      '>>>0;return function(){n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;}})()');
    run('start(' + race + ')');
    assert(run('S.rival.alive'), label + ': opponent is active');
    for (let i = 0; i < 3; i++) run("hire('" + race + '-' + i + "')");
    assert.equal(run('S.units.length'), 3, label + ': three starting units');
    run("buy('supply');modalClose()");
    const map = JSON.parse(run('JSON.stringify(S.map)'));
    raceMapSignatures[race].add(map.map(t => [t.type,t.boss || ''].join(':')).join('|'));
    const targets = map.map((t, i) => t.type === 1 ? i : -1)
      .filter(i => i >= 0)
      .sort((a, b) => routeFromStart(a).length - routeFromStart(b).length || a - b);
    assert(targets.length && routeFromStart(targets[0]).length <= 5,
      label + ': at least one nearby generated patrol');
    const outward = routeFromStart(targets[0]);
    const homeward = outward.slice(0, -1).reverse().concat(0);
    let encounters = 0;
    let moves = 0;
    let peakHunger = 0;
    const initialWins = run('S.victories');

    function step(index) {
      if (run('Boolean(S.event)')) run("eventChoice('leave')");
      if (run('isModalOpen()')) run('modalClose()');
      const before = run('S.day');
      run('move(' + index + ')');
      moves++;
      assert.equal(run('S.day'), before + 1, label + ': adjacent world move');
      assert.equal(run('S.pos'), index, label + ': intended position');
      if (run('Boolean(B)')) battle(h, run, label + ' forced encounter');
      if (run('S.map[S.pos].type === 1')) {
        const previous = run('S.victories');
        run('fight()');
        assert(run('Boolean(B)'), label + ': a natural patrol begins a battle');
        battle(h, run, label + ' patrol');
        assert.equal(run('S.victories'), previous + 1, label + ': patrol win counted');
        encounters++;
      }
      if (run('Boolean(S.event)')) run("eventChoice('leave')");
      if (run('isModalOpen()')) run('modalClose()');
      peakHunger = Math.max(peakHunger, run('S.hunger'));
      assert(run('S.gold >= 0 && S.provisions >= 0'), label + ': nonnegative resources');
      assert(run('!S.ended && S.hero.hp > 0'), label + ': expedition continues');
    }

    for (const index of outward.concat(homeward)) step(index);
    assert.equal(run('S.pos'), 0, label + ': returned to first settlement');
    assert(encounters >= 1, label + ': fought a generated patrol');

    const beforeRecovery = JSON.parse(run('JSON.stringify({gold:S.gold,junk:S.junk,food:S.provisions,dead:S.units.filter(u=>u.hp<=0).length,wounded:S.units.filter(u=>u.hp>0&&u.hp<u.max).length,heroInjured:S.hero.hp<S.hero.max})'));
    if (beforeRecovery.junk > 0) run('sellJunk();modalClose()');
    let revivals = 0;
    while (run('S.units.some(u=>u.hp<=0)')) {
      assert(run('S.gold >= 60'), label + ': revival affordable');
      const before = run('S.units.filter(u=>u.hp<=0).length');
      run('revive()');
      assert.equal(run('S.units.filter(u=>u.hp<=0).length'), before - 1,
        label + ': one fighter revived');
      revivals++;
    }
    let healing = false;
    if (run('S.hero.hp<S.hero.max || S.units.some(u=>u.hp<u.max)')) {
      assert(run('S.gold >= 25'), label + ': healing affordable');
      run('heal()');
      healing = true;
      assert(run('S.hero.hp===S.hero.max && S.units.every(u=>u.hp===u.max)'),
        label + ': hospital recovery');
    }
    if (run('S.provisions < 24')) run("buy('supply');modalClose()");
    const afterRecovery = JSON.parse(run('JSON.stringify({gold:S.gold,food:S.provisions,alive:S.units.filter(u=>u.hp>0).length})'));
    assert(afterRecovery.alive === 3, label + ': all hired units available again');

    while (moves < 14) step(run('S.pos') === 0 ? 1 : 0);
    assert.equal(moves, 14, label + ': controlled travel limit');
    run('rest()');
    if (run('Boolean(S.event)')) run("eventChoice('leave')");
    if (run('isModalOpen()')) run('modalClose()');
    assert.equal(run('S.day'), 16, label + ': 15 campaign days (14 moves, 1 rest)');
    assert.equal(peakHunger, 0, label + ': no hunger during travel');
    assert(run('S.provisions > 0 && S.gold >= 0 && !S.ended'),
      label + ': campaign viable after recovery');
    console.log('GAME-001 generated patrol', JSON.stringify({
      race, seed, naturalEncounters: encounters,
      victories: run('S.victories') - initialWins, beforeRecovery,
      afterRecovery, revivals, healing, days: 15,
      hunger: run('S.hunger'), gold: run('S.gold'),
      food: run('S.provisions'), rivalAlive: run('S.rival.alive')
    }));
  }
  assert.equal(raceMapSignatures[race].size, seeds.length,
    'race ' + race + ': three distinct generated maps');
}
console.log('PASS 12 early generated-patrol simulations with supplies and settlement recovery; not a browser playtest.');