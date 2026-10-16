const assert = require('node:assert/strict');
const harness = require('./audit-harness.cjs');
const h = harness();
h.setRandom(0.01);
assert.equal(h.run('neutralEnemy().category'), 1, 'Raider must use the melee combat class');
console.log('Neutral combat profile checked');
