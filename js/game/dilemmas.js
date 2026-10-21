/**
 * SISTEMA DE DILEMAS Y EVENTOS EJECUTIVOS DE ALCALDÍA (V2.0)
 * Presenta eventos y decisiones de gobierno cada 6-8 días con impacto
 * real en el presupuesto, la felicidad, la producción y la demografía.
 */

export class DilemmaManager {
  constructor() {
    this.currentDilemma = null;
    this.activeEffects = []; // { id, name, daysLeft, onTick(), onExpire() }
    this.nextDilemmaDay = 5; // Primer dilema hacia el día 5
    this.history = [];
  }

  /**
   * Catálogo de dilemas de gobernanza
   */
  getDilemmas() {
    return [
      {
        id: 'dilemma_drought',
        icon: '🌊',
        title: 'Sequía en la Cuenca Ribereña',
        description: 'El caudal del río ha disminuido un 35% por la estación seca. Agricultores y vecinos demandan medidas inmediatas para proteger los cultivos y el agua corriente.',
        options: [
          {
            id: 'ration',
            label: 'Racionar el Riego Municipal',
            costText: 'Sin coste fiscal',
            consequenceText: '📉 Felicidad -8% y alimentos -20% durante 3 días.',
            apply(sim) {
              sim.dilemmas.addEffect({
                id: 'eff_drought_ration',
                name: 'Racionamiento de Riego',
                daysLeft: 3,
                happinessPenalty: 8,
                foodPenaltyFactor: 0.80,
              });
              return 'Has decretado racionamiento de agua. La población está molesta, pero se preservó el erario.';
            },
          },
          {
            id: 'buy_water',
            label: 'Comprar Caudal de Emergencia',
            payment: { from: 'state', to: 'external', amount: 450, concept: 'Compra de agua regional de emergencia' },
            costText: 'Cuesta $450 del Estado',
            consequenceText: '🌟 100% de agua garantizada, salud y felicidad +5% (3 días).',
            apply(sim) {
              sim.dilemmas.addEffect({
                id: 'eff_drought_water',
                name: 'Caudal Regional Comprado',
                daysLeft: 3,
                happinessBonus: 5,
              });
              return 'Compraste suministro hídrico regional. La ciudad se mantiene verde y los vecinos aplauden la gestión.';
            },
          },
        ],
      },
      {
        id: 'dilemma_fair',
        icon: '🎪',
        title: 'Feria Gastronómica y Comercial',
        description: 'La asociación de pequeños comerciantes y chefs solicita apoyo municipal para organizar un bulevar ferial en el centro de la ciudad.',
        options: [
          {
            id: 'subsidize_fair',
            label: 'Subvencionar el Festival ($350)',
            payment: { from: 'state', to: 'corporate', amount: 350, concept: 'Subvención a la feria comercial' },
            costText: 'Cuesta $350 del Estado',
            consequenceText: '🛍️ Ventas comerciales +30% y Felicidad +12% durante 3 días.',
            apply(sim) {
              sim.dilemmas.addEffect({
                id: 'eff_fair_subsidized',
                name: 'Festival Comercial Activo',
                daysLeft: 3,
                commSalesBoost: 0.30,
                happinessBonus: 12,
              });
              return 'La feria fue un éxito rotundo: los comercios incrementaron sus ingresos y subió el ánimo cívico.';
            },
          },
          {
            id: 'charge_fee',
            label: 'Cobrar Canon Municipal Extraordinario',
            payment: { from: 'households', to: 'state', amount: 500, concept: 'Canon ferial extraordinario' },
            costText: 'Ingreso fiscal: +$500',
            consequenceText: '💰 La Tesorería recauda $500. Felicidad ciudadana -4% (2 días).',
            apply(sim) {
              sim.dilemmas.addEffect({
                id: 'eff_fair_fee',
                name: 'Tasa Ferial Extraordinaria',
                daysLeft: 2,
                happinessPenalty: 4,
              });
              return 'Recaudaste $500 en tasas feriales para las arcas públicas, con leve queja de los comerciantes.';
            },
          },
        ],
      },
      {
        id: 'dilemma_education',
        icon: '🎓',
        title: 'Programa de Pasantías Técnicas',
        description: 'La industria y centros de servicio requieren operarios con formación calificada. Surge la oportunidad de formar una promoción acelerada de estudiantes.',
        options: [
          {
            id: 'public_scholarships',
            label: 'Beca Municipal de Estudios ($500)',
            payment: { from: 'state', to: 'households', amount: 500, concept: 'Becas municipales de estudio' },
            costText: 'Cuesta $500 del Estado',
            consequenceText: '📚 +15% Educación en la ciudad y +15 Puntos de Ciencia (RP).',
            apply(sim) {
              sim.education = Math.min(100, sim.education + 15);
              if (sim.research) sim.research.points += 15;
              return 'Se graduó una nueva camada de técnicos y operarios calificados con apoyo del municipio.';
            },
          },
          {
            id: 'corp_training',
            label: 'Financiamiento Privado del Holding',
            payment: { from: 'corporate', to: 'households', amount: 600, concept: 'Becas privadas de estudio' },
            costText: 'Cuesta $600 al Capital Privado',
            consequenceText: '💼 Sin coste para el Estado. +10% Educación calificada.',
            apply(sim) {
              sim.education = Math.min(100, sim.education + 10);
              return 'El Holding empresarial asumió la capacitación técnica de sus operarios sin gastar fondos públicos.';
            },
          },
        ],
      },
      {
        id: 'dilemma_seismic',
        icon: '📡',
        title: 'Alerta Geotécnica Preventiva',
        description: 'Los geólogos han registrado micro-sismos en el lecho rocoso. Proponen un plan de blindaje estructural urgente.',
        options: [
          {
            id: 'reinforce',
            label: 'Blindar Infraestructuras ($400)',
            payment: { from: 'state', to: 'external', amount: 400, concept: 'Refuerzo de infraestructuras' },
            costText: 'Cuesta $400 del Estado',
            consequenceText: '🛡️ Próximos desastres causarán un 50% menos de daño (durante 5 días).',
            apply(sim) {
              sim.dilemmas.addEffect({
                id: 'eff_seismic_shield',
                name: 'Infraestructura Blindada',
                daysLeft: 5,
                damageReduction: 0.50,
              });
              return 'Las cuadrillas municipales reforzaron vigas y tuberías. La ciudad es mucho más resiliente.';
            },
          },
          {
            id: 'defer',
            label: 'Aplazar Mantenimiento',
            costText: 'Sin coste inmediato',
            consequenceText: '⚠️ Ahorras fondos, pero las estructuras permanecen vulnerables.',
            apply(sim) {
              return 'Decidiste no intervenir por ahora. Las faenas continúan sin alteración presupuestaria.';
            },
          },
        ],
      },
      {
        id: 'dilemma_health',
        icon: '🏥',
        title: 'Jornada Sanitaria Comunitaria',
        description: 'El personal médico del hospital y centros cívicos propone un operativo de saneamiento ambiental y vacunación barrial preventiva.',
        options: [
          {
            id: 'fund_health',
            label: 'Financiar Jornada de Salud ($300)',
            payment: { from: 'state', to: 'external', amount: 300, concept: 'Jornada de salud pública' },
            costText: 'Cuesta $300 del Estado',
            consequenceText: '❤️ Salud pública +25% y Felicidad +8% por 3 días.',
            apply(sim) {
              sim.dilemmas.addEffect({
                id: 'eff_health_campaign',
                name: 'Campaña Sanitaria Activa',
                daysLeft: 3,
                healthBonus: 25,
                happinessBonus: 8,
              });
              return 'La campaña sanitaria redujo contagios y mejoró notablemente la moral ciudadana.';
            },
          },
          {
            id: 'pass_health',
            label: 'Campaña Informativa Sin Gasto',
            costText: 'Sin coste fiscal',
            consequenceText: 'ℹ️ Difusión pasiva. La salud y felicidad se mantienen igual.',
            apply(sim) {
              return 'Se publicaron afiches y recomendaciones cívicas sin comprometer el presupuesto.';
            },
          },
        ],
      },
      {
        id: 'dilemma_housing',
        icon: '🏠',
        title: 'Plan de Estabilidad Habitacional',
        description: 'Nuevas familias rurales se aglomeran en los accesos pidiendo facilidades para instalarse en el asentamiento.',
        options: [
          {
            id: 'subsidize_housing',
            label: 'Subsidio Municipal de Mudanza ($350)',
            payment: { from: 'state', to: 'households', amount: 350, concept: 'Subsidio de mudanza' },
            costText: 'Cuesta $350 del Estado',
            consequenceText: '🚀 Inmigración +30% y Felicidad +10% durante 2 días.',
            apply(sim) {
              sim.dilemmas.addEffect({
                id: 'eff_housing_incentive',
                name: 'Plan de Bienvenida Ciudadana',
                daysLeft: 2,
                immigrationBoost: 0.30,
                happinessBonus: 10,
              });
              return 'El subsidio facilitó la llegada de nuevas familias trabajadoras a las viviendas disponibles.';
            },
          },
          {
            id: 'free_market',
            label: 'Mantener Requisitos Estándar',
            costText: 'Sin coste fiscal',
            consequenceText: '⚖️ Crecimiento orgánico habitual según vacantes.',
            apply(sim) {
              return 'El crecimiento demográfico continuará su curso habitual al ritmo de la oferta privada.';
            },
          },
        ],
      },
    ];
  }

  /**
   * Agrega un efecto temporal activo
   */
  addEffect(effect) {
    this.activeEffects = this.activeEffects.filter((e) => e.id !== effect.id);
    this.activeEffects.push(effect);
  }

  /**
   * Obtiene la suma de modificadores de efectos activos
   */
  getActiveModifiers() {
    let happinessMod = 0;
    let foodMultiplier = 1.0;
    let commSalesMultiplier = 1.0;
    let immigrationMultiplier = 1.0;
    let healthMod = 0;
    let damageReduction = 0;

    for (const eff of this.activeEffects) {
      if (eff.happinessBonus) happinessMod += eff.happinessBonus;
      if (eff.happinessPenalty) happinessMod -= eff.happinessPenalty;
      if (eff.foodPenaltyFactor) foodMultiplier *= eff.foodPenaltyFactor;
      if (eff.commSalesBoost) commSalesMultiplier += eff.commSalesBoost;
      if (eff.immigrationBoost) immigrationMultiplier += eff.immigrationBoost;
      if (eff.healthBonus) healthMod += eff.healthBonus;
      if (eff.damageReduction) damageReduction = Math.max(damageReduction, eff.damageReduction);
    }

    return {
      happinessMod,
      foodMultiplier,
      commSalesMultiplier,
      immigrationMultiplier,
      healthMod,
      damageReduction,
    };
  }

  /**
   * Bucle diario que decrementa efectos y evalúa si dispara un nuevo dilema
   */
  tick(sim) {
    // 1. Decrementar efectos temporales activos
    for (let i = this.activeEffects.length - 1; i >= 0; i--) {
      const eff = this.activeEffects[i];
      eff.daysLeft--;
      if (eff.daysLeft <= 0) {
        this.activeEffects.splice(i, 1);
      }
    }

    // 2. Evaluar si corresponde un nuevo dilema
    if (!this.currentDilemma && sim.day >= this.nextDilemmaDay) {
      const dilemmas = this.getDilemmas();
      const available = dilemmas.filter((d) => !this.history.slice(-3).includes(d.id));
      const pool = available.length > 0 ? available : dilemmas;
      const chosen = pool[Math.floor(Math.random() * pool.length)];

      this.currentDilemma = chosen;
      this.nextDilemmaDay = sim.day + 6 + Math.floor(Math.random() * 3); // Cada 6-8 días
      this.history.push(chosen.id);

      return chosen;
    }

    return null;
  }

  /**
   * Resuelve el dilema con la opción elegida por el jugador
   */
  resolve(choiceId, sim) {
    if (!this.currentDilemma) return null;

    const opt = this.currentDilemma.options.find((o) => o.id === choiceId);
    if (!opt) return null;

    // Todo pago del dilema pasa por el libro contable y exige fondos suficientes
    if (opt.payment && sim.economy) {
      const { from, to, amount, concept } = opt.payment;
      const ledger = sim.economy.ledger;
      const citizens = Array.from(sim.citizens.citizens.values());
      if (from === 'households') {
        // Cobro a los vecinos: cada uno aporta según su ahorro (puede recaudarse menos)
        ledger.chargeHouseholds(citizens, amount, to, concept, 20);
      } else {
        const payer = from;
        if (ledger.balanceOf(payer) < amount) {
          return { rejected: true, message: `Fondos insuficientes: esta opción requiere $${amount} (${payer === 'state' ? 'Tesoro Público' : 'Capital Privado'}).` };
        }
        if (to === 'households' && citizens.length > 0) {
          const share = amount / citizens.length;
          citizens.forEach((c) => ledger.transfer(payer, c, share, concept));
        } else {
          ledger.transfer(payer, to === 'households' ? 'external' : to, amount, concept);
        }
      }
    }

    const message = opt.apply(sim);
    this.currentDilemma = null;
    return message;
  }

  serialize() {
    return {
      nextDilemmaDay: this.nextDilemmaDay,
      history: this.history,
      activeEffects: this.activeEffects,
      currentDilemma: this.currentDilemma,
    };
  }

  deserialize(data) {
    if (!data) return;
    this.nextDilemmaDay = data.nextDilemmaDay || 5;
    this.history = data.history || [];
    this.activeEffects = data.activeEffects || [];
    this.currentDilemma = data.currentDilemma || null;
  }
}
