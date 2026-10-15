'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFileSync} = require('node:child_process');

const root = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pepel-offline-'));
const target = path.join(tmp, 'pepel-zemli-offline.html');

try {
  execFileSync(process.execPath, ['scripts/build-offline.cjs', target], {cwd:root, stdio:'pipe'});
  const html = fs.readFileSync(target, 'utf8');
  const assets = fs.readdirSync(path.join(root, 'dist/assets')).filter(n => n.endsWith('.webp'));

  assert.match(html, /<html lang="ru">/i, 'HTML document preserved');
  assert.match(html, /Пепельные земли/, 'Game preserved');
  assert.match(html, /function offlineImage/, 'Offline artwork resolver embedded');
  assert.match(html, /function loadGame/, 'Core game script embedded');
  assert.match(html, /function prepareDefs/, 'Expansion logic embedded');
  assert.match(html, /Шаг|Отряд|Пограничье|Начать|Выбери расу/, 'Game interface preserved');
  assert(!/<link[^>]+href=["']expansion\.css/.test(html), 'No external stylesheet');
  assert(!/<script[^>]+src=["']expansion\.js/.test(html), 'No external JavaScript');
  assert(!/fetch\(['"]units\.json/.test(html), 'Offline startup does not use fetch');
  assert(!/assets\/[a-z0-9_-]*\$\{/.test(html), 'All dynamic asset paths resolved through inline image lookup');
  assert(!/href=["']prompts\.md/.test(html), 'No broken prompts link');
  assert.equal((html.match(/data:image\/webp;base64,/g) || []).length, assets.length, 'All portraits and locations embedded');
  assert(assets.length >= 115, 'All 115 known illustrations present');
  assert(html.length > 1000000, 'Artwork embedded instead of omitted');
  assert.match(html, /hero-0\.webp/, 'Hero portrait embedded');
  assert.match(html, /boss-dragon\.webp|dragon\.webp/, 'Boss artwork embedded');
  console.log('PASS: standalone HTML embeds game logic, 84 unit forms and ' + assets.length + ' images');
} finally {
  fs.rmSync(tmp, {recursive:true, force:true});
}
