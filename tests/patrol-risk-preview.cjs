const assert = require('node:assert/strict');
const harness = require('./audit-harness.cjs');

// GAME-001 / cycle 15: player-facing, pre-combat patrol forecast.
// Runs the actual game code with a mocked document. This is not browser QA.
const h = harness(), run = h.run;

function check(race, pos, victories, heroLevel, expectedCount, expectedLevel) {
  run(`start(${race});S.pos=${pos};S.victories=${victories};S.hero.level=${heroLevel};S.map[S.pos].type=1;encounterMenu()`);
  const html = h.nodes.get('modal').innerHTML;
  const noun = expectedCount === 1 ? 'противник' : expectedCount < 5 ? 'противника' : 'противников';
  assert(html.includes(`Перед боем: ${expectedCount} ${noun}, уровень ${expectedLevel}`),
    `race ${race} patrol at ${pos} should reveal the deterministic group size and level before fighting`);
  assert(html.includes('Можно закрыть окно и уйти с клетки без боя'),
    'encounter must explain that combat is voluntary at this location');
  assert(!run('Boolean(B)'), 'preview must never start a battle');
  run('modalClose();fight()');
  assert.equal(run('B.enemies.length'), expectedCount,
    'visible count must equal the generated encounter');
  assert(run(`B.enemies.every(u=>u.level===${expectedLevel})`),
    'visible level must equal all generated enemy levels');
}

for (const race of [0, 1, 2, 3]) {
  check(race, 1, 0, 1, 1, 1); // nearest patrol, opening days
  check(race, 13, 0, 1, 2, 2); // farther early patrol
  check(race, 15, 6, 5, 3, 3); // wins and hero level increase the estimate
}

console.log('PASS patrol forewarning before combat, opt-out and real enemy count/level parity (Node VM).');
