/**
 * MERCADO LOCAL DE INSUMOS (CADENAS DE SUMINISTRO)
 *
 * Cada día se cruza la demanda de insumos de las empresas con lo que producen los proveedores
 * de la ciudad. El orden de prioridad es siempre:
 *   1. Comercio local (hasta donde llegue la capacidad logística de la ciudad).
 *   2. Importación del faltante, con recargo.
 *   3. Exportación del sobrante, con descuento por flete.
 *
 * Los valores se expresan a precio regional (antes de inflación local).
 */

export const COMMODITIES = {
  materials: {
    id: 'materials',
    name: 'Materias primas',
    icon: '🪨',
    producers: 'Cantera y Aserradero',
    consumers: 'Fábricas masivas y talleres de componentes',
  },
  components: {
    id: 'components',
    name: 'Componentes',
    icon: '⚙️',
    producers: 'Taller de Componentes',
    consumers: 'Complejos tecnológicos',
  },
  goods: {
    id: 'goods',
    name: 'Mercancía de consumo',
    icon: '📦',
    producers: 'Fábricas masivas',
    consumers: 'Tiendas, mercados y supermercados',
  },
};

export const SUPPLY_RULES = {
  BASE_LOGISTICS_CAPACITY: 500, // Venta directa entre vecinos sin centro de distribución ($/día)
  IMPORT_SURCHARGE: 0.10, // Comprar fuera cuesta un 10 % más
  EXPORT_DISCOUNT: 0.15, // Vender fuera rinde un 15 % menos (flete)
  COMPONENT_MATERIALS_RATIO: 0.40, // Materias primas que consume cada $ de componentes
};

/**
 * Resuelve el mercado de insumos del día.
 * @param {object} demand { materials, components, goods }
 * @param {object} supply { materials, components, goods }
 * @param {number} logisticsCapacity capacidad total de comercio local ($/día)
 */
export function clearSupplyMarket(demand, supply, logisticsCapacity) {
  const ids = Object.keys(COMMODITIES);
  const wanted = {};
  let totalWanted = 0;
  for (const id of ids) {
    wanted[id] = Math.min(demand[id] || 0, supply[id] || 0);
    totalWanted += wanted[id];
  }

  const logisticsRatio = totalWanted > 0 ? Math.min(1, logisticsCapacity / totalWanted) : 1;
  const result = { logisticsCapacity, logisticsUsed: 0, logisticsRatio, items: {} };

  for (const id of ids) {
    const d = demand[id] || 0;
    const s = supply[id] || 0;
    const local = wanted[id] * logisticsRatio;
    result.logisticsUsed += local;
    result.items[id] = {
      ...COMMODITIES[id],
      demand: d,
      supply: s,
      local,
      imported: Math.max(0, d - local),
      exported: Math.max(0, s - local),
      localShare: d > 0 ? local / d : 1,
    };
  }
  return result;
}
