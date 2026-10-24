/**
 * Sella la versión que se publica: escribe la fecha y hora en js/version.js.
 * Se ejecuta antes de cada despliegue (npm run stamp). Ajustes muestra esta versión y avisa si hay una
 * más nueva en el servidor. También rellena en sw.js la versión y la lista de archivos que la
 * aplicación instalada guarda para abrirse sin conexión.
 */
import { writeFileSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const d = new Date();
const p = (n) => String(n).padStart(2, '0');
const build = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
const file = fileURLToPath(new URL('../js/version.js', import.meta.url));
writeFileSync(file, `// Generado por scripts/stamp-version.js antes de cada despliegue (no editar a mano)\nexport const APP_BUILD = '${build}';\n`);
console.log('Versión sellada:', build);

// Lista de archivos del juego para el service worker
const root = fileURLToPath(new URL('../', import.meta.url));
const walk = (dir) => readdirSync(root + dir).flatMap((f) => {
  const rel = `${dir}/${f}`;
  return statSync(root + rel).isDirectory() ? walk(rel) : [rel];
});
const files = ['/', '/manifest.webmanifest',
  ...['css', 'js', 'icons'].flatMap(walk).filter((f) => /\.(css|js|mjs|png)$/.test(f)).map((f) => `/${f}`)].sort();
const swFile = root + 'sw.js';
const sw = readFileSync(swFile, 'utf8').replace(/\r\n/g, '\n');
const block = `// <precache> (lo rellena scripts/stamp-version.js: no editar a mano)\nconst BUILD = '${build}';\nconst PRECACHE = ${JSON.stringify(files, null, 2).replace(/"/g, "'")};\n// </precache>`;
writeFileSync(swFile, sw.replace(/\/\/ <precache>[\s\S]*?\/\/ <\/precache>/, block));
console.log('Service worker:', files.length, 'archivos para jugar sin conexión');
