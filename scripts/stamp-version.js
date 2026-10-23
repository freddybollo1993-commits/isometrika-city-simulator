/**
 * Sella la versión que se publica: escribe la fecha y hora en js/version.js.
 * Se ejecuta antes de cada despliegue (npm run stamp). Ajustes muestra esta versión y avisa si hay una
 * más nueva en el servidor.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const d = new Date();
const p = (n) => String(n).padStart(2, '0');
const build = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
const file = fileURLToPath(new URL('../js/version.js', import.meta.url));
writeFileSync(file, `// Generado por scripts/stamp-version.js antes de cada despliegue (no editar a mano)\nexport const APP_BUILD = '${build}';\n`);
console.log('Versión sellada:', build);
