// Lista los métodos de clase y las referencias this.elX al DOM que nadie usa.
// Uso desde la raíz del repo:
//   node .claude/skills/isometrica-code-architect/scripts/dead-methods.cjs [archivo.js ...]
// Sin argumentos revisa todos los .js del juego. Un método "muerto" es el que solo aparece
// en su propia definición; confirma siempre a mano (llamadas por nombre dinámico no se detectan).
const fs = require('fs');

const all = ['js/main.js',
  ...fs.readdirSync('js/game').map((f) => 'js/game/' + f),
  ...fs.readdirSync('js/engine').map((f) => 'js/engine/' + f)];
const targets = process.argv.slice(2).length ? process.argv.slice(2) : all;
const corpus = all.map((f) => fs.readFileSync(f, 'utf8')).join('\n') + fs.readFileSync('index.html', 'utf8');

const count = (name) => {
  let n = 0;
  const re = new RegExp(`(^|[^\\w$])${name.replace(/\$/g, '\\$')}(?![\\w$])`, 'g');
  while (re.exec(corpus)) n++;
  return n;
};

for (const file of targets) {
  const src = fs.readFileSync(file, 'utf8');
  const methods = [...src.matchAll(/^ {2}(?:async |static )?([_a-zA-Z][\w$]*)\(.*\) \{$/gm)]
    .map((m) => m[1])
    .filter((n) => !['constructor', 'if', 'for', 'switch', 'while', 'catch'].includes(n));
  const deadMethods = [...new Set(methods)].filter((n) => count(n) <= 1);
  const domRefs = [...src.matchAll(/^ {4}this\.(el\w+) = /gm)].map((m) => m[1]);
  const deadDom = [...new Set(domRefs)].filter((n) => count(n) <= 1);
  if (deadMethods.length || deadDom.length) {
    console.log(`\n${file}`);
    if (deadMethods.length) console.log('  métodos sin uso:', deadMethods.join(', '));
    if (deadDom.length) console.log('  referencias DOM sin uso:', deadDom.join(', '));
  }
}
