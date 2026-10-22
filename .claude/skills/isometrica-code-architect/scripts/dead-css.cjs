// Detecta (y opcionalmente elimina) reglas CSS cuyos selectores usan clases o ids
// que no aparecen en index.html ni en ningún .js del juego.
// Uso desde la raíz del repo:
//   node .claude/skills/isometrica-code-architect/scripts/dead-css.cjs css/style.css          (solo lista)
//   node .claude/skills/isometrica-code-architect/scripts/dead-css.cjs css/style.css --apply  (elimina)
// Revisa la lista antes de aplicar: las clases que se arman con texto (no con `prefijo-${x}`) no se detectan.
const fs = require('fs');

const cssFile = process.argv[2];
const apply = process.argv.includes('--apply');
if (!cssFile) {
  console.error('Indica el archivo CSS');
  process.exit(1);
}

const sources = ['index.html', 'js/main.js',
  ...fs.readdirSync('js/game').map((f) => 'js/game/' + f),
  ...fs.readdirSync('js/engine').map((f) => 'js/engine/' + f)]
  .map((f) => fs.readFileSync(f, 'utf8')).join('\n');
const words = new Set(sources.match(/[A-Za-z0-9_-]+/g));
// Prefijos compuestos dinámicamente (p. ej. `qp-${zona}`) se consideran vivos
const dynamicPrefixes = [...sources.matchAll(/([a-z][\w-]*-)\$\{/g)].map((m) => m[1]);
const isLive = (token) => words.has(token) || dynamicPrefixes.some((p) => token.startsWith(p));
const selectorIsDead = (sel) => {
  const tokens = [...sel.matchAll(/[.#]([A-Za-z_][\w-]*)/g)].map((m) => m[1]);
  return tokens.length > 0 && tokens.some((t) => !isLive(t));
};

const css = fs.readFileSync(cssFile, 'utf8').replace(/\r\n/g, '\n');
const removed = [];

function prune(text) {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf('{', i);
    if (open < 0) { out += text.slice(i); break; }
    let depth = 0;
    let j = open;
    for (; j < text.length; j++) {
      if (text[j] === '{') depth++;
      else if (text[j] === '}') { depth--; if (depth === 0) break; }
    }
    const head = text.slice(i, open);
    const body = text.slice(open + 1, j);
    const lastComment = head.lastIndexOf('*/');
    const lead = lastComment >= 0 ? head.slice(0, lastComment + 2) : '';
    const selector = lastComment >= 0 ? head.slice(lastComment + 2) : head;
    const selTrim = selector.trim();

    if (selTrim.startsWith('@media') || selTrim.startsWith('@supports')) {
      const inner = prune(body);
      if (inner.trim() === '') { removed.push(selTrim); out += lead; } else out += head + '{' + inner + '}';
    } else if (selTrim.startsWith('@') || selTrim === '') {
      out += head + '{' + body + '}';
    } else {
      const parts = selTrim.split(',').map((x) => x.trim());
      const alive = parts.filter((x) => !selectorIsDead(x));
      if (alive.length === 0) {
        removed.push(selTrim.replace(/\s+/g, ' '));
        out += lead;
      } else if (alive.length < parts.length) {
        parts.filter((x) => selectorIsDead(x)).forEach((x) => removed.push('  (parcial) ' + x));
        const indent = selector.match(/^\s*/)[0];
        out += lead + indent + alive.join(',\n' + indent.replace(/^\n+/, '')) + ' {' + body + '}';
      } else {
        out += head + '{' + body + '}';
      }
    }
    i = j + 1;
  }
  return out;
}

const result = prune(css).replace(/\n{3,}/g, '\n\n');
console.log(removed.join('\n'));
console.log(`\n${removed.length} reglas/selectores sin uso · ${css.split('\n').length} → ${result.split('\n').length} líneas`);
if (apply) {
  let depth = 0;
  for (const c of result) { if (c === '{') depth++; if (c === '}') depth--; }
  if (depth !== 0) { console.error('Llaves desbalanceadas: no se escribe nada'); process.exit(1); }
  fs.writeFileSync(cssFile, result);
}
