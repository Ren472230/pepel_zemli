'use strict';
const assert=require('node:assert/strict');
const harness=require('./audit-harness.cjs');
const h=harness();
h.setRandom(.12);
const enemy=h.run('neutralEnemy()');
assert.equal(enemy.id,'mob-raider');
assert.equal(enemy.category,1,'COMBAT-001: raider should be melee attacker, not copied defender');
console.log('COMBAT-001 neutral profiles PASS');
