import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { installHelp, isStandalone } from '../js/game/install.js';

const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root));
/** Ancho y alto de un PNG (cabecera IHDR). */
const pngSize = (buf) => [buf.readUInt32BE(16), buf.readUInt32BE(20)];

test('instalable: manifiesto completo con iconos que existen y miden lo que dicen', () => {
  const m = JSON.parse(read('manifest.webmanifest'));
  assert.equal(m.short_name, 'ISOMETRICA');
  assert.equal(m.start_url, '/');
  assert.equal(m.scope, '/');
  assert.equal(m.display, 'fullscreen');
  assert.equal(m.orientation, 'landscape', 'se juega en horizontal');
  assert.equal(m.lang, 'es');
  assert.ok(m.icons.some((i) => i.sizes === '192x192') && m.icons.some((i) => i.sizes === '512x512'), 'iconos de 192 y 512');
  assert.ok(m.icons.some((i) => i.purpose === 'maskable'), 'icono adaptable para Android');
  for (const i of m.icons) {
    const file = i.src.replace(/^\//, '');
    assert.ok(existsSync(new URL(file, root)), file);
    assert.deepEqual(pngSize(read(file)), i.sizes.split('x').map(Number), file);
  }
  const html = read('index.html').toString();
  assert.ok(html.includes('rel="manifest"'));
  assert.ok(html.includes('apple-touch-icon'));
  assert.ok(html.includes('id="btn-title-install"'));
});

test('instalable: el service worker guarda archivos que existen y pide primero a la red', () => {
  const sw = read('sw.js').toString();
  const list = sw.match(/const PRECACHE = (\[[\s\S]*?\]);/);
  assert.ok(list, 'lista de archivos');
  const files = JSON.parse(list[1].replace(/'/g, '"'));
  assert.ok(files.includes('/') && files.includes('/js/main.js') && files.includes('/manifest.webmanifest'));
  for (const f of files) if (f !== '/') assert.ok(existsSync(new URL(f.slice(1), root)), f);
  assert.ok(/fetch\(req\)[\s\S]*catch/.test(sw), 'red primero, copia guardada si no hay conexión');
});

test('instalable: explica dónde instalar en cada navegador y detecta la aplicación instalada', () => {
  assert.match(installHelp('Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0'), /Firefox/);
  assert.match(installHelp('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit Safari'), /Safari/);
  assert.match(installHelp('Mozilla/5.0 (Linux; Android 14) SamsungBrowser/25.0 Chrome/121'), /Samsung/);
  assert.match(installHelp('Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile'), /Instalar aplicación/);
  assert.match(installHelp('Mozilla/5.0 (Windows NT 10.0) Chrome/130'), /ordenador/);
  const win = (q) => ({ matchMedia: (m) => ({ matches: m === q }), navigator: {} });
  assert.equal(isStandalone(win('(display-mode: fullscreen)')), true);
  assert.equal(isStandalone(win('(display-mode: standalone)')), true);
  assert.equal(isStandalone(win('(display-mode: browser)')), false);
  assert.equal(isStandalone({ navigator: { standalone: true } }), true);
});
