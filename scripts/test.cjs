const {spawnSync}=require('node:child_process');
const suites=['--check dist/expansion.js','tests/economy.cjs','tests/startup-combat.cjs','tests/audit.cjs','tests/interface.cjs','tests/mobile-map.cjs','tests/healer.cjs','tests/ritual-and-identity.cjs','tests/combat-simulation.cjs','test-expansion.cjs','test-bosses.cjs','test-world-art.cjs'];
let failed=0;for(const suite of suites){console.log('\n'+suite);let result=spawnSync(process.execPath,suite.split(' '),{stdio:'inherit'});if(result.status!==0)failed++;}process.exitCode=failed?1:0;
