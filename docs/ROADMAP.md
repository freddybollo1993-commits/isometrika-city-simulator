# Ruta de desarrollo de ISOMETRICA

> Acordada el 21 de octubre de 2026. Cada fase se apoya en la anterior.
> Regla transversal: **todo dinero tiene origen y destino** (libro contable en `js/game/ledger.js`)
> y ninguna fase avanza si `npm test` falla.

## Fase 0 — Consolidar la economía interna ✅
- Libro contable de doble entrada: Estado, Empresa, Hogares y Exterior.
- Solo el Exterior crea o absorbe dinero, siempre con concepto.
- Pruebas automáticas de conservación y estabilidad (`npm test`).
- Pestaña **📒 Libro Contable** en Finanzas.
- Skills de arte para la fase visual: `isometrica-render-architect`, `isometrica-animator`, `isometrica-art-director`.

## Fase 1 — Un mundo vivo: estaciones, ciclo económico e inflación
- **Año de 120 días** con cuatro estaciones de 30 días:

| Estación | Agricultura | Energía / agua | Turismo | Riesgos y obras |
|---|---|---|---|---|
| 🌸 Primavera | Media | Normal | Medio | Más inundaciones |
| ☀️ Verano | Alta | Más demanda (refrigeración, riego) | Alto | Más olas de calor |
| 🍂 Otoño | Máxima (cosecha) | Normal | Medio | — |
| ❄️ Invierno | Baja | Más demanda eléctrica (calefacción) | Bajo | Construir cuesta un 10 % más |

- **Ciclo económico regional**: fases de auge, estabilidad, recesión y crisis (20–60 días), con aviso
  previo. Afecta a ventas industriales, exportaciones y visitantes. Protección de fundación: sin
  recesiones antes del día 60.
- **Inflación**: índice de precios que sube cuando la economía se recalienta (poco paro, auge,
  dinero creciendo más rápido que la producción) y baja en recesión. Encarece alquileres, comida,
  construcción y mantenimiento; los salarios la siguen con retraso. Los precios del mercado
  regional no dependen de la inflación local, así que una ciudad inflada pierde competitividad.

## Fase 1.5 — Cadenas de suministro locales ✅
- Nuevos proveedores: 🪨 Cantera y Aserradero (materias primas), ⚙️ Taller de Componentes
  (componentes, consume materias primas) y 🚚 Centro de Distribución Mayorista (capacidad logística).
- Las fábricas masivas abastecen de mercancía a tiendas, mercados y supermercados de la ciudad.
- Prioridad cada día: comercio local → importar el faltante (+10 %) → exportar el sobrante (−15 % flete).
- Pestaña **🏭 Suministros** en Finanzas con el porcentaje local de cada insumo y consejos.
- Pendiente para Fase 2: que la construcción (pública y privada) compre materiales a la cantera local.

## Fase 2 — Megaproyectos
- Obras de 3 a 5 fases: metro, puerto fluvial, presa, aeropuerto regional, parque tecnológico, estadio.
- Financiación pública, privada o mixta; constructora local (el dinero queda en la ciudad) o externa
  (más rápida, el dinero sale).
- El puerto y el aeropuerto serán las infraestructuras del comercio entre ciudades.

## Fase 3 — Elecciones municipales
- Cada 60 días; aprobación por grupos (obreros, profesionales, empresarios, jubilados).
- Promesas de campaña que dan o quitan aprobación según se cumplan.
- Perder implica 20 días de gobierno de la oposición con políticas que no eliges.

## Fase 4 — Expansión a distritos
- Comprar terrenos vecinos (costa, montaña, bosque) con recursos y biomas distintos.
- Ensayo técnico del multi-ciudad: varios mapas conectados.

## 🚦 Puerta de validación de la economía
Antes del multi-ciudad, verificado con simulaciones automáticas:
- Conservación del dinero en todo momento.
- Ninguna quiebra con gestión razonable durante 3 años (360 días).
- Sin acumulación ilimitada de dinero (la inflación la absorbe).
- Una crisis en invierno se puede superar sin trucos.

## Fase 5 — Región multi-ciudad
- **Desbloqueo**: una ciudad optimizada (armonía ≥ 80 durante 60 días, desempleo bajo, sin deuda,
  un megaproyecto completado) desbloquea la siguiente en el mapa regional.
- **Especialización**: al madurar, cada ciudad elige un rubro (agroalimentario, manufactura,
  tecnología, energía, logística, conocimiento, turismo o finanzas). Ese rubro tiene prima de precio
  y es lo que exporta a las ciudades adyacentes.
- **Referente regional**: con más del 40 % del mercado de su rubro, la ciudad fija precios y atrae
  inversión; una ciudad financiera presta y emite bonos regionales.
- **Comercio**: transferencias entre los libros contables de dos ciudades; la conservación se
  verifica a nivel regional (solo el mercado nacional crea o absorbe dinero).
- **Intercambio tecnológico**: licenciar investigaciones a otras ciudades.
- **Rendimiento**: solo la ciudad activa se simula en detalle; las demás usan un modelo agregado.
