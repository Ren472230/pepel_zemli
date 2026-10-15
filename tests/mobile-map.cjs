const assert = require('node:assert/strict');
const fs = require('node:fs');

// Статический регрессионный контроль; настоящую проверку касаний в браузере
// фиксировать отдельно в UX-отчёте.
const css = fs.readFileSync('dist/expansion.css', 'utf8');
assert.match(css, /\.map\s*\{[^}]*grid-template-columns\s*:\s*repeat\(8,\s*minmax\(44px,\s*1fr\)\)/, 'Каждая из восьми колонок карты должна иметь минимум 44px');
assert.match(css, /\.map\s*\{[^}]*overflow-x\s*:\s*auto/, 'Карта должна прокручиваться на узком экране');
assert.match(css, /\.map\s+\.tile\s*\{[^}]*min-width\s*:\s*44px/, 'Каждая клетка имеет минимум 44 CSS px в ширину');
assert.match(css, /\.map\s+\.tile\s*\{[^}]*min-height\s*:\s*44px/, 'Каждая клетка имеет минимум 44 CSS px в высоту');
console.log('PASS mobile map has 44px tap targets and horizontal scrolling (CSS check).');
