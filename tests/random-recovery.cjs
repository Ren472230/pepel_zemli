const assert = require('node:assert/strict');
const harness = require('./audit-harness.cjs');

// GAME-001: seeded Node model using the actual map generator and an active rival.
// A forced rival battle/capitulation models a setback; travelling and trading
// exercise the real game functions. This is NOT real-browser gameplay or proof
// that arbitrary combat losses are recoverable.
const route = [1, 2, 10, 9, 1, 0, 8, 16, 17, 18, 10, 9, 1, 0, 8];
const seeds = [1, 7, 19, 42, 101, 2026];

for (const race of [0, 1, 2, 3]) {
  for (const seed of seeds) {
    const h = harness();
    const run = h.run;
    run(`Math.random = (function () {
      let value = ${seed} >>> 0;
      return function () {
        value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
        return value / 4294967296;
      };
    })()`);
    run(`start(${race})`);

    const map = JSON.parse(run('JSON.stringify(S.map)'));
    assert.equal(map.length, 64, 'world size');
    assert.equal(map.filter(t => t.type === 5).length, 3, 'fixed settlements');
    assert.equal(map.filter(t => t.boss).length, 3, 'three bosses');
    assert(map.filter(t => t.type === 3).length >= 3, 'neutral altars');
    assert(run('S.rival.alive'), 'rival stays enabled');

    for (let i = 0; i < 3; i++) run(`hire('${race}-${i}')`);
    assert.equal(run('S.units.length'), 3, 'initial hires');
    run("buy('supply');modalClose()");
    const before = JSON.parse(run('JSON.stringify({gold:S.gold,food:S.provisions,hero:S.hero.hp})'));

    // Controlled setback: open a rival battle, then choose the actual
    // capitulation action. No fabricated battle victory or enemy defeat.
    run('rivalFight()');
    assert(run('Boolean(B && B.rival)'), 'rival battle begins');
    run('capitulate()');
    assert(run('!B && S.pos===0 && !S.ended'), 'returned to starting town');
    assert.equal(run('S.gold'), Math.floor(before.gold / 2), 'gold penalty');
    assert.equal(run('S.provisions'), Math.floor(before.food / 2), 'food penalty');
    assert.equal(run('S.hero.hp'), before.hero, 'hero survives capitulation');
    assert.equal(run('S.units.length'), 3, 'army persists');

    // Buy a small recovery ration and travel the *generated*, unedited map.
    run("buy('supply');modalClose()");
    let settlements = 0;
    for (const pos of route) {
      const oldDay = run('S.day');
      run(`move(${pos})`);
      assert.equal(run('S.day'), oldDay + 1, `race ${race} seed ${seed}: move`);
      if (run('Boolean(S.event)')) run("eventChoice('leave')");
      if (run('isModalOpen()')) run('modalClose()');
      if (pos === 0) {
        settlements++;
        if (run('S.provisions < 24')) {
          run("buy('supply');modalClose()");
        }
      }
      assert(run('!B && !S.ended && S.hero.hp > 0'), `race ${race} seed ${seed}: live state`);
      assert(run('S.provisions >= 0 && S.gold >= 0 && S.hunger === 0'), `race ${race} seed ${seed}: no starvation`);
    }
    assert.equal(run('S.day'), 16, '15 world transitions');
    assert.equal(settlements, 2, 'two settlement returns');
    assert(run('S.provisions > 0 && S.units.filter(u => u.hp > 0).length === 3'), 'expedition can continue');
    console.log('GAME-001 seeded recovery', JSON.stringify({
      race, seed, days: 15, setback: 'capitulation', randomMap: true,
      rivalEnabled: true, battlesWon: 0, gold: run('S.gold'),
      food: run('S.provisions'), hunger: run('S.hunger')
    }));
  }
}
console.log('PASS 24 generated-map capitulation recovery models; player strategy and real-browser play untested.');
