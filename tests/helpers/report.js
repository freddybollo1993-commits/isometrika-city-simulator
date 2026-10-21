// Uso: node tests/helpers/report.js [dias]
// Imprime la trayectoria de fondos de la ciudad inicial y de una ciudad en crecimiento.
import { createCity, growCity, autoPlayer, runDays } from './headless-city.js';

const days = Number(process.argv[2] || 120);

function show(title, log) {
  console.log(`\n== ${title} ==`);
  console.log('dia  pob  estado    empresa   ahorros  feliz');
  for (const r of log) {
    if (r.day % 10 === 0 || r.day <= 3) {
      console.log(`${String(r.day).padStart(3)}  ${String(r.pop).padStart(3)}  ${String(r.state).padStart(8)}  ${String(r.corp).padStart(8)}  ${String(r.savings).padStart(7)}  ${r.happiness}`);
    }
  }
}

{
  const { sim } = createCity();
  show('Ciudad inicial sin cambios', runDays(sim, days));
}
{
  const { sim, grid, center } = createCity();
  show('Ciudad en crecimiento', runDays(sim, days, (s) => growCity(s, grid, center, s.day)));
}
{
  const { sim, grid, center } = createCity();
  show('Jugador automático', runDays(sim, days, (s) => autoPlayer(s, grid, center)));
  const d = sim.economy.ledger.lastDay;
  console.log(`\nDiario del día ${d.day} (jugador automático):`);
  for (const e of d.entries) console.log(`  ${e.from.padEnd(10)} → ${e.to.padEnd(10)} ${String(e.amount).padStart(9)}  ${e.concept}`);
  const counts = {};
  for (const row of grid.tiles) for (const t of row) if (t.building && t.building.isRoot) counts[t.building.id] = (counts[t.building.id] || 0) + 1;
  console.log('Edificios:', JSON.stringify(counts));
}
