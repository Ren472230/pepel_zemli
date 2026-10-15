#!/usr/bin/env node
'use strict';

// Assemble the shipped game into one local, network-independent HTML document.
// Source game and approved artwork are read as-is; no gameplay rules are changed.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const read = relative => fs.readFileSync(path.join(dist, relative), 'utf8');
const assertReplacement = (source, pattern, replacement, label) => {
  if (!pattern.test(source)) throw Error('Offline packaging: source marker absent: ' + label);
  return source.replace(pattern, replacement);
};

const assetFolder = path.join(dist, 'assets');
const names = fs.readdirSync(assetFolder).filter(name => name.endsWith('.webp')).sort();
if (names.length < 115) throw Error('Expected 115 approved WebP images; got ' + names.length);

const images = Object.create(null);
for (const name of names) {
  const bytes = fs.readFileSync(path.join(assetFolder, name));
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' ||
      bytes.toString('ascii', 8, 12) !== 'WEBP')
    throw Error('Invalid WebP image: ' + name);
  images[name] = 'data:image/webp;base64,' + bytes.toString('base64');
}

let html = read('index.html');
const css = read('expansion.css');
const js = read('expansion.js');
const units = JSON.parse(read('units.json'));
if (!Array.isArray(units) || units.length !== 84)
  throw Error('Expected 84 canonical unit forms, got ' + units.length);

// Resolve game-generated image paths before DOM insertion, avoiding file://
// network requests and preserving the exact original art everywhere.
const dynamicImagePath = /assets\/([a-z0-9_-]*)\$\{([^}]+)\}([a-z0-9_-]*)\.webp/gi;
let dynamicPaths = 0;
html = html.replace(dynamicImagePath, (_, prefix, expression, suffix) => {
  dynamicPaths++;
  return '$' + '{offlineImage(' + JSON.stringify(prefix) +
    '+String(' + expression + ')+' + JSON.stringify(suffix + '.webp') + ')}';
});
if (dynamicPaths < 8) throw Error('Unexpected image resolver count: ' + dynamicPaths);
if (/assets\/[a-z0-9_-]*\$\{/.test(html))
  throw Error('Unresolved dynamic artwork path');

// The source has no literal asset paths today. Refuse a silently broken build
// if one appears in a subsequent game version.
if (/src=["']assets\//.test(html))
  throw Error('Literal image references need an offline mapping');

// An archive with a single HTML is meant to start from a double-click.
// The original fetch('units.json') fails under file://, so inline the data.
html = assertReplacement(
  html,
  /<link\s+rel="stylesheet"\s+href="expansion\.css\?v=\d+"\s*\/?>/,
  '<style>\n' + css + '\n</style>',
  'expansion stylesheet'
);
html = assertReplacement(
  html,
  /<script\s+src="expansion\.js\?v=\d+"><\/script>/,
  '<script>\n' + js.replace(/<\/script/gi, '<\\/script') + '\n</script>',
  'expansion script'
);
const unitInit = '<script>\ntry {\n' +
  'defs=' + JSON.stringify(units).replace(/</g, '\\u003c') + ';\n' +
  'prepareDefs();loadGame();\n' +
  '} catch (e) { console.error(e);' +
  'document.getElementById("app").textContent=' +
  '"Не удалось запустить игру. Попробуй открыть файл в Chrome или Edge."; }\n' +
  '</script>';
html = assertReplacement(
  html,
  /<script>fetch\('units\.json\?v=\d+'\)[\s\S]*?<\/script>/,
  unitInit,
  'unit data loader'
);
html = html.replace('<a href="prompts.md" download>Промпты изображений</a>', '');

// Put the artwork before any game scripts, including the original inline core.
const imageInit = '<script>\n' +
  'const offlineImages=' + JSON.stringify(images) + ';\n' +
  'function offlineImage(name){return offlineImages[name]||"";}\n' +
  '</script>\n';
html = assertReplacement(html, /<header>/, imageInit + '<header>', 'document header');

if (/fetch\(['"]units\.json/.test(html) ||
    /<script[^>]+src=/.test(html) ||
    /<link[^>]+href=/.test(html))
  throw Error('The offline build still references external game files');
if ((html.match(/data:image\/webp;base64,/g) || []).length !== names.length)
  throw Error('Embedded artwork count mismatch');

const output = path.resolve(process.argv[2] || path.join(root, 'offline', 'pepel-zemli-offline.html'));
fs.mkdirSync(path.dirname(output), {recursive:true});
fs.writeFileSync(output, html, 'utf8');
console.log('Built: ' + output);
console.log('Units: ' + units.length + ', images: ' + names.length + ', file bytes: ' + fs.statSync(output).size);
