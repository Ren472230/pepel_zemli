const assert = require('node:assert/strict');
const harness = require('./audit-harness.cjs');

// GAME-001: deterministic *generated-world* dangerous-patrol models.
// No HP edits, enemy-stat edits or constructed injuries. Deliberately risky
// player policy: hire one ranged fighter, let the hero guard while that
// fighter lives, then attack and use the starting health potions.
// Outcomes are observations, NOT evidence of universal fair balance or
// real-browser play. In particular, player-chosen under-preparation matters.
const seeds = [1, 7, 19, 42, 101, 2026];
const summaries = [];

function distance(index) {
  return index % 8 + Math.floor(index / 8);
}
function routeFromHome(index) {
  const path = [];
  let current = 0;
  while (Math.floor(current / 8) < Math.floor(index / 8)) {
    current += 8;
    path.push(current);
  }
  while (current % 8 < index % 8) {
    current += 1;
    path.push(current);
  }
  return path;
}
function closeInterruptions(run) {
  if (run('Boolean(S.event)')) run("eventChoice('leave')");
  if (run('isModalOpen()')) run('modalClose()');
}
function moveOne(run, index, label) {
  closeInterruptions(run);
  const oldDay = run('S.day');
  run('move(' + index + ')');
  assert.equal(run('S.day'), oldDay + 1, label + ': actual move advances day');
  assert.equal(run('S.pos'), index, label + ': actual destination reached');
  closeInterruptions(run);
  assert(run('S.provisions >= 0 && S.gold >= 0'), label + ': resources nonnegative');
}
function finishDangerousBattle(h, run, label) {
  let actions = 0;
  let naturallyDead = 0;
  while (run('Boolean(B)') && actions++ < 900) {
    naturallyDead = Math.max(naturallyDead, run('S.units.filter(u=>u.hp<=0).length'));
    if (run('isModalOpen()')) {
      run('modalClose()');
    } else if (run('Boolean(canAct())')) {
      run("var a=canAct(),foe=frontline(B.enemies)[0];" +
        "if(a.hero&&S.units.some(u=>u.hp>0)){guard();}" +
        "else if(a.hero&&a.hp<a.max*.55&&S.potions>0){potion(false);}" +
        "else if(foe){chooseAction('attack');target(foe.uid)}else guard();");
    } else {
      h.drain(1);
    }
  }
  naturallyDead = Math.max(naturallyDead, run('S.units.filter(u=>u.hp<=0).length'));
  assert(actions < 900 && !run('Boolean(B)'), label + ': combat resolves without deadlock');
  closeInterruptions(run);
  return { actions, naturallyDead };
}

for (const race of [0, 1, 2, 3]) {
  for (const seed of seeds) {
    const h = harness(), run = h.run;
    const label = 'race ' + race + ', seed ' + seed;
    run('Math.random=(function(){let x=' + seed +
      '>>>0;return function(){x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;}})()');
    run('start(' + race + ')');
    assert(run('S.rival.alive'), label + ': rival enabled');
    run("hire('" + race + "-1')");
    assert.equal(run('S.units.length'), 1, label + ': one naturally fragile hire');
    run("buy('supply');modalClose()");
    const map = JSON.parse(run('JSON.stringify(S.map)'));
    const patrol = map.map((tile, index) => tile.type === 1 ? index : -1)
      .filter(index => index >= 0 && distance(index) >= 5 && distance(index) <= 7)
      .sort((a, b) => distance(a) - distance(b) || a - b)[0];
    if (patrol === undefined) {
      console.log('GAME-001 risk probe no suitable generated patrol ' + label);
      continue;
    }
    const outward = routeFromHome(patrol);
    for (const index of outward) moveOne(run, index, label + ' outward');
    assert.equal(run('S.map[S.pos].type'), 1, label + ': target still a natural patrol');
    const beforeCombat = JSON.parse(run(
      'JSON.stringify({day:S.day,heroHp:S.hero.hp,fighterHp:S.units[0].hp,gold:S.gold,food:S.provisions,won:S.victories})'));
    run('fight()');
    assert(run('Boolean(B)'), label + ': actual generated patrol battle begins');
    const enemies = JSON.parse(run('JSON.stringify(B.enemies.map(u=>({id:u.id,level:u.level,max:u.max})))'));
    assert(enemies.length >= 2, label + ': genuinely difficult multi-enemy patrol');
    const fight = finishDangerousBattle(h, run, label);
    const victory = run('S.victories') === beforeCombat.won + 1;
    const heroAlive = run('S.hero.hp > 0 && !S.ended');
    const naturallyDead = fight.naturallyDead;
    if (heroAlive) {
      assert(victory, label + ': alive hero must have finished the battle');
      for (const index of outward.slice(0, -1).reverse().concat(0)) {
        moveOne(run, index, label + ' homeward');
      }
      assert.equal(run('S.pos'), 0, label + ': arrived at a settlement');
      const beforeTown = JSON.parse(run('JSON.stringify({gold:S.gold,junk:S.junk,food:S.provisions,dead:S.units.filter(u=>u.hp<=0).length,hero:S.hero.hp})'));
      if (beforeTown.junk > 0) run('sellJunk();modalClose()');
      let revived = 0;
      while (run('S.units.some(u=>u.hp<=0)') && run('S.gold >= 60')) {
        const deadBefore = run('S.units.filter(u=>u.hp<=0).length');
        run('revive();modalClose()');
        assert.equal(run('S.units.filter(u=>u.hp<=0).length'), deadBefore - 1,
          label + ': genuine casualty revived via real town operation');
        revived++;
      }
      let healed = false;
      if (run('S.gold>=25&&(S.hero.hp<S.hero.max||S.units.some(u=>u.hp>0&&u.hp<u.max))')) {
        run('heal();modalClose()');
        healed = true;
      }
      const foodBeforePurchase = run('S.provisions');
      if (foodBeforePurchase < 24 && run('S.gold>=10')) run("buy('supply');modalClose()");
      const foodPurchased = run('S.provisions') > foodBeforePurchase;
      const expectedGold = beforeTown.gold + beforeTown.junk * 3 -
        revived * 60 - (healed ? 25 : 0) - (foodPurchased ? 10 : 0);
      assert.equal(run('S.gold'), expectedGold, label + ': actual recovery costs');
      if (naturallyDead > 0 && beforeTown.gold + beforeTown.junk * 3 >= 60) {
        assert(revived > 0, label + ': natural loss can be revived when affordable');
      }
      const moves = outward.length * 2;
      for (let n = moves; n < 14; n++) {
        moveOne(run, run('S.pos') === 0 ? 1 : 0, label + ' remaining travel');
      }
      run('rest()');
      closeInterruptions(run);
      assert.equal(run('S.day'), 16, label + ': 15 actual world transitions');
      assert(run('S.provisions >= 0 && S.gold >= 0'), label + ': final resources valid');
      summaries.push({race,seed,patrol,distance:distance(patrol),enemies,beforeCombat,
        heroAlive,victory,naturallyDead,revived,healed,
        final:{day:run('S.day'),gold:run('S.gold'),food:run('S.provisions'),
          living:run('S.units.filter(u=>u.hp>0).length'),hunger:run('S.hunger')}});
    } else {
      assert(run('Boolean(S.ended)'), label + ': hero death ends the game');
      summaries.push({race,seed,patrol,distance:distance(patrol),enemies,beforeCombat,
        heroAlive,victory,naturallyDead,revived:0,
        final:{day:run('S.day'),gold:run('S.gold'),food:run('S.provisions'),ended:run('S.ended')}});
    }
  }
}
assert(summaries.length >= 12, 'at least three genuine difficult battles per race in seeded worlds');
for (const race of [0, 1, 2, 3]) {
  assert(summaries.filter(s=>s.race===race).length >= 3, 'race ' + race + ': at least three battles');
}
for (const record of summaries) console.log('GAME-001 natural hard battle',JSON.stringify(record));
const genuine = summaries.filter(s=>s.naturallyDead>0);
const survivorRecoveries = genuine.filter(s=>s.heroAlive&&s.revived>0);
const defeats = summaries.filter(s=>!s.heroAlive);
console.log('GAME-001 risk summary',JSON.stringify({
  battles:summaries.length, naturallyInjuredBattles:genuine.length,
  actualRevivalScenarios:survivorRecoveries.length,
  actualHeroDefeats:defeats.length,
  method:'seeded Node VM, real generated patrols, one underprepared hire, no forced wounds; no real browser'
}));
console.log('PASS genuine difficult-battle sampling and settlement price checks; do not infer overall balance.');
