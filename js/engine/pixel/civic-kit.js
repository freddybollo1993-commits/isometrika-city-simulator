/**
 * KIT CÍVICO: piezas comunes de los edificios públicos (comisaría, bomberos, hospital…).
 *
 * - Fachadas por plantas: ventanas sueltas, franja corrida, muro cortina o ventanales altos, con
 *   bandas de color, huecos propios (puertas, portones, rótulos) y ventanas que se encienden de noche
 *   una a una.
 * - Cubiertas planas con pretil, placas solares y helipuerto pintado.
 * - Equipos de cubierta (climatización, mástil de radio, sirena), mástil con bandera, hidrante,
 *   cargador eléctrico.
 * - Vehículos de emergencia (patrulla, autobomba, autoescala, ambulancia, helicóptero) con sus luces.
 */

import { PixelCanvas, hex, shade, ramp, hash01 } from './pixel-canvas.js';
import { WHITE, STEEL, SNOW } from './lot-kit.js';

export const TIRE = ramp('#1f2937');

/**
 * @param kit  createLotKit(...)
 * @param o    parámetros de dibujo del edificio
 * @param c    { body, ground, front, S, seed, look }
 */
export function createCivicKit(kit, o, c) {
  const { body, ground, front, S, seed, look } = c;
  const night = !!o.night;
  const lit = !o.suspended && !o.closed;
  const on = night && lit;
  const wear = o.wear || 0;
  const hd = S >= 2;
  const { sv, at, snowAt, box, frontBox, prop } = kit;
  const fOf = (u, v) => (front === 'u' ? u : v);
  const lOf = (u, v) => (front === 'u' ? v : u);
  const darkFace = (face) => (face === 'front') === (front === 'u');
  const glassDay = [hex('#c4e2f5'), hex('#82b3da')];
  const glassNight = [hex('#fde68a'), hex('#f5c96a')];
  const glassOff = [hex('#334155'), hex('#1e293b')];
  const glassAt = (k, litWin = true) => (o.closed || (night && !lit) ? glassOff[k] : night ? (litWin ? glassNight[k] : glassOff[k]) : glassDay[k]);
  const roofTop = (rp) => (u, v, z, x, y) => (snowAt(x, y, 1) ? SNOW.light : rp.light);
  const glowAt = (f, l, r, color, k) => {
    const [x, y] = ground.project(...kit.uv(f, l), 0);
    ground.glow(x, y, r, color, k);
  };

  // ---------------------------------------------------------------------------
  // Fachadas
  // ---------------------------------------------------------------------------

  const wallTex = (B, a, z, dk, x, y) => {
    const rp = B.wall;
    let col;
    if (B.tex === 'brick') {
      const row = Math.floor(z / 1.5);
      const off = row % 2 ? 1.5 : 0;
      if (z % 1.5 < (hd ? 0.25 : 0.4) || (a + off) % 3 < (hd ? 0.25 : 0.4)) col = shade(rp.light, 1.05);
      else {
        const n = hash01(Math.floor((a + off) / 3), row, seed + 63);
        col = n < 0.2 ? rp.light : n > 0.85 ? shade(rp.mid, 0.88) : rp.mid;
      }
    } else if (B.tex === 'stone') {
      const row = Math.floor(z / 2.2);
      const off = row % 2 ? 2 : 0;
      if (z % 2.2 < (hd ? 0.25 : 0.4) || (a + off) % 4 < (hd ? 0.25 : 0.4)) col = rp.dark;
      else col = hash01(Math.floor((a + off) / 4), row, seed + 64) < 0.25 ? rp.light : rp.mid;
    } else if (B.tex === 'concrete') {
      col = (z % 3 < (hd ? 0.2 : 0.35)) ? shade(rp.mid, 0.94) : hash01(x >> 1, y >> 1, seed + 65) < 0.06 ? shade(rp.mid, 0.97) : rp.mid;
    } else {
      col = a % 8 < (hd ? 0.3 : 0.5) ? shade(rp.mid, 0.94) : rp.mid; // paneles
    }
    return dk ? shade(col, 0.82) : col;
  };
  const windowAt = (B, a, zz, fl, dk) => {
    const pitch = B.pitch || 5;
    const m = a % pitch;
    const k = Math.floor(a / pitch);
    const fh = B.floorH || 4.5;
    const litWin = hash01(k + (B.key || 0) * 31, fl, seed + 90) < 0.68;
    const frame = B.frame || STEEL;
    const fcol = dk ? frame.dark : frame.mid;
    const glass = (upper) => {
      const g = glassAt(upper ? 0 : 1, litWin);
      if (!night && ((a + zz * 2) % 9) < (hd ? 0.5 : 0.8)) return hex('#ffffff');
      return dk ? shade(g, 0.9) : g;
    };
    if (B.win === 'curtain') {
      if (m < (hd ? 0.4 : 0.7) || zz < (hd ? 0.35 : 0.6)) return fcol;
      return glass(zz > fh / 2);
    }
    if (B.win === 'band') {
      if (zz < 1.3 || zz > fh - 0.9) return null;
      if (m < (hd ? 0.35 : 0.6)) return fcol;
      return glass(zz > fh / 2);
    }
    if (B.win === 'tall') {
      if (zz < 0.9 || zz > fh - 0.6 || m < 1.3 || m > pitch - 1.3) return null;
      if (m < 1.7 || m > pitch - 1.7 || zz < 1.3) return fcol;
      if (Math.abs(m - pitch / 2) < 0.3) return fcol;
      return glass(zz > fh / 2);
    }
    if (B.win === 'punched') {
      if (zz < 1.4 || zz > fh - 0.8 || m < 1.2 || m > pitch - 1.2) return null;
      if (hd && (zz < 1.8 || m < 1.55 || m > pitch - 1.55)) return fcol;
      return glass(zz > fh / 2);
    }
    return null;
  };
  /**
   * Sombreador de una cara. B = { F0, F1, L0, L1, h, wall (rampa), tex, floorH, win, pitch, frame,
   * bands: [[z0, z1, color]], feats: [{ face, p0, p1, z0, z1, draw(p, z, dk, ft) }], cornice (rampa), groundFloor }
   * `p` es l en la fachada a la calle y f en la lateral.
   */
  const facade = (B, side) => (u, v, z, x, y) => {
    const p = side === 'front' ? lOf(u, v) : fOf(u, v);
    const dk = darkFace(side);
    for (const ft of B.feats || []) {
      if (ft.face !== side || p < ft.p0 || p > ft.p1 || z < ft.z0 || z > ft.z1) continue;
      const col = ft.draw(p, z, dk, ft);
      if (col) return col;
    }
    const a = p * 16;
    const ends = side === 'front' ? [B.L0, B.L1] : [B.F0, B.F1];
    const fh = B.floorH || 4.5;
    const fl = Math.floor(z / fh);
    let col = wallTex(B, a, z, dk, x, y);
    if (z < B.h - 1.2 && Math.min(p - ends[0], ends[1] - p) * 16 > 1.2 && fl >= (B.groundFloor === false ? 1 : 0)) {
      const w = windowAt(B, a, z % fh, fl, dk);
      if (w) col = w;
    }
    for (const [z0, z1, bc] of B.bands || []) if (z >= z0 && z < z1) col = dk ? shade(bc, 0.82) : bc;
    if (B.cornice && z > B.h - 0.8) col = dk ? B.cornice.mid : B.cornice.light;
    if (z < 0.7) col = shade(col, 0.82);
    if (wear >= 50 && hash01(Math.floor(a / 2), Math.floor(z / 2), seed + 61) < (wear >= 75 ? 0.08 : 0.04)) col = shade(col, 0.72);
    return col;
  };
  /** Cubierta plana con pretil, placas solares (B.solar = [f0, f1, l0, l1]) y helipuerto (B.pad = [f, l, r, cruz]). */
  const roof = (B) => (u, v, z, x, y) => {
    if (snowAt(x, y, 1.15, 7)) return SNOW.light;
    const f = fOf(u, v);
    const l = lOf(u, v);
    if (Math.min(f - B.F0, B.F1 - f, l - B.L0, B.L1 - l) < 0.06) return B.cornice ? B.cornice.light : WHITE.light;
    if (B.pad) {
      const [pf, pl, pr, cross] = B.pad;
      const df = (f - pf) / pr;
      const dl = (l - pl) / pr;
      const r = Math.hypot(df, dl);
      if (r <= 1) {
        if (r > 0.8 && r < 0.92) return on ? hex('#fde047') : hex('#facc15');
        if (cross) {
          if ((Math.abs(df) < 0.12 && Math.abs(dl) < 0.45) || (Math.abs(dl) < 0.12 && Math.abs(df) < 0.45)) return hex('#ef4444');
        } else if (Math.abs(dl) < 0.32 && (Math.abs(df + 0.22) < 0.08 || Math.abs(df - 0.22) < 0.08 || (Math.abs(df) < 0.22 && Math.abs(dl) < 0.06))) {
          return WHITE.light;
        }
        return hex('#4b5563');
      }
    }
    if (B.green) {
      // cubierta ajardinada con matas
      const n = hash01(x >> 1, y >> 1, seed + 83);
      const g = kit.lawnShade(u, v, z, x, y);
      return n < 0.12 ? shade(g, 0.78) : n > 0.93 ? shade(g, 1.12) : g;
    }
    if (B.solar) {
      const [s0, s1, s2, s3] = B.solar;
      if (f > s0 && f < s1 && l > s2 && l < s3) {
        if ((f * 5) % 1 < 0.1 || (l * 4) % 1 < 0.1) return ramp('#1e3a8a').light;
        return (x + y) % 5 === 0 ? ramp('#3b5bdb').light : ramp('#1e3a8a').mid;
      }
    }
    const rc = B.roofColor || ramp('#cbd2da');
    return hash01(x, y, seed + 82) < 0.08 ? shade(rc.mid, 1.05) : rc.mid;
  };
  const block = (B) => frontBox(B.F0, B.F1, B.L0, B.L1, B.z0 || 0, B.h, B.wall, { front: facade(B, 'front'), side: facade(B, 'side'), top: roof(B) });

  // Huecos habituales
  const gdoor = (frameRp = STEEL) => (p, z, dk, ft) => {
    const e = Math.min(p - ft.p0, ft.p1 - p) * 16;
    if (e < 0.6 || z > ft.z1 - 0.5 || Math.abs(p - (ft.p0 + ft.p1) / 2) * 16 < 0.3) return dk ? frameRp.dark : frameRp.mid;
    return glassAt(z > 2.5 ? 0 : 1);
  };
  /** Portón de vehículos: abierto de día (se ve el interior iluminado), cerrado de noche o si está cerrado. */
  const garage = (rp, open) => (p, z, dk, ft) => {
    const e = Math.min(p - ft.p0, ft.p1 - p) * 16;
    if (e < 0.6 || z > ft.z1 - 0.5) return dk ? WHITE.mid : WHITE.light;
    if (open && lit) return z > ft.z1 - 1.8 ? hex('#fde68a') : z < 2.6 && (p * 16) % 6 < 4 ? shade(rp.mid, 0.8) : hex('#2f2b2b');
    const zz = z - ft.z0;
    if (zz > (ft.z1 - ft.z0) * 0.62 && zz < (ft.z1 - ft.z0) * 0.8 && (p * 16) % 3 > 0.8) return glassAt(1);
    return Math.floor(z * (hd ? 2 : 1.4)) % 2 ? (dk ? rp.mid : rp.light) : (dk ? rp.dark : rp.mid);
  };

  // ---------------------------------------------------------------------------
  // Equipos y mobiliario
  // ---------------------------------------------------------------------------

  const hvac = (f, l, z, s = 0.14) => {
    const g = ramp('#d5d9e0');
    box(f - s, f + s, l - s, l + s, z, z + 3.5, g, {
      left: (u, v, zz) => (zz > z + 0.8 && zz < z + 3 && Math.floor(zz * 2) % 2 ? g.dark : g.mid),
      right: (u, v, zz) => (zz > z + 0.8 && zz < z + 3 && Math.floor(zz * 2) % 2 ? shade(g.dark, 0.85) : g.dark),
      top: roofTop(g),
    });
    const [x, y] = at(f, l, z + 3.5);
    body.disk(x - 1, y - 1, 1, ramp('#64748b'));
  };
  /** Mástil de radio en celosía. */
  const radioMast = (f, l, z, h = 16) => {
    const [x, y] = at(f, l, z);
    body.line(x - 2, y, x, y - h, STEEL.mid);
    body.line(x + 2, y, x, y - h, STEEL.dark);
    for (let k = 3; k < h - 2; k += 3) body.line(x - Math.round((1 - k / h) * 2), y - k, x + Math.round((1 - k / h) * 2), y - k - 2, STEEL.mid);
    body.set(x, y - h - 1, on ? hex('#ef4444') : hex('#b91c1c'));
  };
  const flagpole = (f, l, color = '#2563eb') => prop(f, l, () => {
    const [x, y] = at(f, l);
    body.rect(x, y - 16, 1, 16, STEEL.light);
    const c1 = hex(color);
    for (let i = 0; i < 4; i++) body.rect(x + 1, y - 16 + i, 5 - (i === 3 ? 1 : 0), 1, i % 2 ? WHITE.light : c1);
  });
  const hydrant = (f, l) => prop(f, l, () => {
    const [x, y] = at(f, l);
    body.rect(x - 1, y - 3, 2, 3, hex('#dc2626'));
    body.set(x - 1, y - 4, hex('#ef4444'));
    body.set(x + 1, y - 2, hex('#b91c1c'));
  });
  const charger = (f, l) => prop(f, l, () => box(f - 0.04, f + 0.04, l - 0.06, l + 0.06, 0, 5, ramp('#16a34a'), {
    left: (u, v, z) => (z > 3 && z < 4.3 ? (on ? hex('#86efac') : hex('#bbf7d0')) : ramp('#16a34a').mid),
  }));
  /** Rayas de aparcamiento en batería a lo largo de l (plazas de 0,34 casillas). */
  const parking = (f0, f1, l0, l1, alongF = true) => {
    kit.fl(f0, f1, l0, l1, (u, v, z, x, y) => {
      if (snowAt(x, y, 0.7)) return SNOW.light;
      const q = alongF ? lOf(u, v) : fOf(u, v);
      if (Math.abs(((q - (alongF ? l0 : f0)) % 0.38) - 0.01) < 0.012) return WHITE.light;
      return hash01(x, y, seed + 3) < 0.06 ? ramp('#4b5563').light : ramp('#4b5563').mid;
    });
  };

  // ---------------------------------------------------------------------------
  // Vehículos
  // ---------------------------------------------------------------------------

  /** Vehículo: (a) a lo largo con el morro en +a hacia el espectador; (b) a lo ancho. */
  const vehicle = (f, l, alongL, draw) => prop(f, l, () => {
    const bx = (a0, a1, b0, b1, z0, z1, rp, fns) => (alongL
      ? box(f + b0, f + b1, l + a0, l + a1, z0, z1, rp, fns)
      : box(f + a0, f + a1, l + b0, l + b1, z0, z1, rp, fns));
    const P = (a, b, z) => (alongL ? at(f + b, l + a, z) : at(f + a, l + b, z));
    const endLeft = alongL === (front === 'u');
    const along = (u, v) => (alongL ? lOf(u, v) - l : fOf(u, v) - f);
    const faces = (endFn, sideFn, topFn) => ({ left: endLeft ? endFn(false) : sideFn(false), right: endLeft ? sideFn(true) : endFn(true), top: topFn });
    draw({ bx, P, along, faces });
  });
  const vglass = night ? glassOff : [hex('#a9cdec'), hex('#6f9cc9')];
  const wheels = (along, lo, hi) => (z, a) => z < 1.9 && (Math.abs(a - lo) < 0.055 || Math.abs(a - hi) < 0.055);
  /** Barra de luces de emergencia: azul y roja (o ámbar); de noche brilla e ilumina el suelo. */
  const lightBar = (P, a, z, colors = ['#3b82f6', '#ef4444']) => {
    const [x, y] = P(a, 0, z);
    body.set(x - 1, y - 1, on ? hex('#93c5fd') : hex(colors[0]));
    body.set(x, y - 1, on ? hex('#fca5a5') : hex(colors[1]));
  };
  const patrol = (f, l, alongL) => vehicle(f, l, alongL, ({ bx, P, along, faces }) => {
    const w = ramp('#f8fafc');
    const navy = ramp('#1e3a8a');
    const isWheel = wheels(along, -0.16, 0.16);
    const side = (dk) => (u, v, z) => {
      const a = along(u, v);
      if (isWheel(z, a)) return TIRE.mid;
      if (z < 2.4) return dk ? navy.dark : navy.mid;
      return dk ? w.dark : w.mid;
    };
    bx(-0.27, 0.27, -0.12, 0.12, 0.6, 3, w, faces((dk) => (u, v, z) => (z > 1.4 && z < 2 ? (on ? hex('#fef08a') : w.light) : dk ? navy.dark : navy.mid), side, roofTop(w)));
    bx(-0.12, 0.12, -0.1, 0.1, 3, 4.6, w, faces((dk) => () => vglass[dk ? 1 : 0], (dk) => (u, v, z) => (z > 3.3 ? vglass[dk ? 1 : 0] : dk ? w.dark : w.mid), roofTop(w)));
    lightBar(P, 0, 5);
    if (on) glowAt(f, l, 8, [96, 140, 255, 255], 0.2);
  });
  const ambulance = (f, l, alongL) => vehicle(f, l, alongL, ({ bx, P, along, faces }) => {
    const w = ramp('#f8fafc');
    const isWheel = wheels(along, -0.18, 0.18);
    const side = (dk) => (u, v, z) => {
      const a = along(u, v);
      if (isWheel(z, a)) return TIRE.mid;
      if (z > 2.4 && z < 3) return hex('#dc2626'); // franja
      if (Math.abs(a + 0.06) < 0.05 && z > 3.4 && z < 5) return hex('#dc2626'); // cruz
      if (Math.abs(a + 0.06) < 0.12 && z > 4 && z < 4.4) return hex('#dc2626');
      if (z > 4 && z < 5.2 && a > 0.12) return vglass[dk ? 1 : 0];
      return dk ? w.dark : w.mid;
    };
    bx(-0.3, 0.3, -0.14, 0.14, 0.8, 6, w, faces((dk) => (u, v, z) => (z > 4 && z < 5.4 ? vglass[dk ? 1 : 0] : z > 1.6 && z < 2.3 ? (on ? hex('#fef08a') : w.light) : dk ? w.dark : w.mid), side, roofTop(w)));
    lightBar(P, 0.2, 6.4, ['#ef4444', '#3b82f6']);
    if (on) glowAt(f, l, 9, [255, 110, 110, 255], 0.2);
  });
  /** Autobomba roja (con escalera en la autoescala). */
  const fireEngine = (f, l, alongL, ladder = false) => vehicle(f, l, alongL, ({ bx, P, along, faces }) => {
    const r = ramp('#dc2626');
    const len = ladder ? 0.4 : 0.32;
    const isWheel = (z, a) => z < 2.2 && (Math.abs(a - 0.2) < 0.06 || Math.abs(a + len - 0.1) < 0.06 || (ladder && Math.abs(a + len - 0.24) < 0.06));
    const side = (dk) => (u, v, z) => {
      const a = along(u, v);
      if (isWheel(z, a)) return TIRE.mid;
      if (z > 2.4 && z < 2.9) return hex('#f8fafc'); // franja reflectante
      if (a < 0.08 && z > 3.2 && z < 5.4 && ((a + 1) * 16) % 3 < 0.5) return dk ? r.dark : shade(r.mid, 0.85); // persianas de material
      if (a >= 0.12 && z > 3.8 && z < 5.4) return vglass[dk ? 1 : 0];
      return dk ? r.dark : r.mid;
    };
    bx(-len, 0.3, -0.14, 0.14, 0.8, 6, r, faces((dk) => (u, v, z) => (z > 3.8 && z < 5.4 ? vglass[dk ? 1 : 0] : z > 1.6 && z < 2.3 ? (on ? hex('#fef08a') : hex('#f8fafc')) : dk ? r.dark : r.mid), side, roofTop(r)));
    // escalera plegada sobre el techo
    const p0 = P(-len + 0.02, 0, 6.8);
    const p1 = P(ladder ? 0.26 : 0.08, 0, 6.8);
    body.line(p0[0], p0[1], p1[0], p1[1], STEEL.light);
    body.line(p0[0], p0[1] - 1, p1[0], p1[1] - 1, STEEL.mid);
    if (ladder) bx(-0.12, 0.0, -0.06, 0.06, 6, 7.2, STEEL);
    lightBar(P, 0.24, 6.3, ['#ef4444', '#f97316']);
    if (on) glowAt(f, l, 10, [255, 90, 90, 255], 0.22);
  });
  /** Helicóptero posado (vista lateral simplificada, centrado en x, y). */
  const helicopter = (x, y, color = '#f97316') => {
    const c1 = ramp(color);
    body.rect(x - 4, y - 4, 7, 3, c1.mid);
    body.rect(x - 3, y - 5, 4, 1, c1.light);
    body.rect(x + 1, y - 4, 2, 2, hex('#a9cdec'));
    body.line(x - 4, y - 3, x - 10, y - 5, c1.dark);
    body.rect(x - 11, y - 7, 1, 3, c1.dark);
    body.line(x - 9, y - 6, x + 7, y - 6, STEEL.dark);
    body.rect(x - 3, y - 1, 7, 1, STEEL.dark);
    if (on) body.set(x - 11, y - 7, hex('#ef4444'));
  };
  const drone = (x, y) => {
    body.rect(x - 1, y, 3, 1, STEEL.dark);
    body.rect(x - 3, y - 1, 2, 1, STEEL.light);
    body.rect(x + 2, y - 1, 2, 1, STEEL.light);
    body.set(x, y + 1, on ? hex('#ef4444') : hex('#22c55e'));
  };

  // ---------------------------------------------------------------------------
  // Arquitectura monumental y vida de campus
  // ---------------------------------------------------------------------------

  /**
   * Pórtico de columnas con escalinata, entablamento y frontón triangular delante de la fachada
   * (cara f = F1, entre l0 y l1). Con `clock`, un reloj en el tímpano.
   */
  const portico = (F1, l0, l1, depth, colH, stone, n = 4, clock = false) => prop(F1 + depth / 2, (l0 + l1) / 2, () => {
    const Ff = F1 + depth;
    for (let k = 0; k < 3; k++) box(F1, Ff + 0.14 - k * 0.05, l0 - 0.06, l1 + 0.06, k * 0.5, (k + 1) * 0.5, stone, { top: roofTop(stone) });
    const zb = 1.5;
    for (let i = 0; i < n; i++) {
      const l = l0 + 0.07 + ((l1 - l0 - 0.14) * i) / (n - 1);
      box(Ff - 0.09, Ff - 0.02, l - 0.035, l + 0.035, zb, zb + colH, stone, { left: () => stone.light, right: () => stone.mid, top: () => stone.light });
    }
    const zt = zb + colH;
    box(F1, Ff, l0 - 0.05, l1 + 0.05, zt, zt + 1.3, stone, { top: roofTop(stone) });
    const lc = (l0 + l1) / 2;
    const ze = zt + 1.3;
    const zp = ze + Math.max(3, (l1 - l0) * 5);
    const slope = (k) => (u, v, z, x, y) => (snowAt(x, y, 1.1, 7) ? SNOW.light : (lOf(u, v) * 16) % 2 < 0.6 ? stone.dark : stone[k]);
    body.surface([sv(Ff, l0 - 0.05, ze), sv(Ff, lc, zp), sv(F1, lc, zp), sv(F1, l0 - 0.05, ze)], slope('mid'));
    body.surface([sv(Ff, lc, zp), sv(Ff, l1 + 0.05, ze), sv(F1, l1 + 0.05, ze), sv(F1, lc, zp)], slope('dark'));
    body.surface([sv(Ff, l0 - 0.05, ze), sv(Ff, l1 + 0.05, ze), sv(Ff, lc, zp)], (u, v, z) => {
      const l = lOf(u, v);
      const dk = darkFace('front');
      if (z < ze + 0.5) return dk ? stone.mid : stone.light;
      if (clock) {
        const dx = (l - lc) * 16;
        const dz = (z - (ze + (zp - ze) * 0.4)) * 1.15;
        const r = Math.hypot(dx, dz);
        if (r < 1.6) return (Math.abs(dx) < 0.25 && dz > 0 && dz < 1.2) || (Math.abs(dz) < 0.25 && dx > 0 && dx < 0.9) ? hex('#1f2937') : on ? hex('#fef3c7') : WHITE.light;
        if (r < 2) return hex('#57534e');
      }
      return dk ? shade(stone.light, 0.85) : shade(stone.light, 0.95);
    });
  });
  /** Cúpula sobre tambor con ventanas y linterna; R es la mitad del ancho en píxeles. */
  const dome = (f, l, z, R, rp, drumRp, drumH = 4) => {
    const [cx, cy] = at(f, l, z);
    for (let px = Math.floor((cx - R) * S); px <= Math.ceil((cx + R) * S); px++) {
      const t = ((px + 0.5) / S - cx) / R;
      if (Math.abs(t) > 1) continue;
      const k = Math.sqrt(1 - t * t);
      const e = (R / 2) * k;
      const tone = t < -0.35 ? 'light' : t < 0.3 ? 'mid' : 'dark';
      const top = cy - drumH - e - R * 0.85 * k;
      for (let py = Math.floor(top * S); py <= Math.ceil((cy + e) * S); py++) {
        const y = (py + 0.5) / S;
        if (y < top) continue;
        let col;
        if (y > cy - drumH + e) {
          col = drumRp[tone];
          if (Math.floor(((px / S) - cx + 40) / 2.5) % 2 === 0 && y < cy + e - 1 && y > cy - drumH + e + 1) col = on ? hex('#fde68a') : hex('#64748b');
        } else {
          col = rp[tone];
          if (Math.floor(t * 6 + 6) % 2 === 0) col = shade(col, 0.94); // nervios
          if (snowAt(px, py, 1.1, 7)) col = SNOW.light;
        }
        body.setPhys(px, py, col);
      }
    }
    const lantY = Math.round(cy - drumH - R / 2 - R * 0.85) + 1; // en lo alto de la cúpula
    body.rect(cx - 1, lantY - 3, 3, 3, drumRp.light);
    body.rect(cx, lantY - 5, 1, 2, STEEL.light);
  };
  /** Personas paseando (solo de día y si el edificio funciona). */
  const people = (f0, f1, l0, l1, n, salt = 0) => {
    if (night || !lit) return;
    for (let i = 0; i < n; i++) {
      const f = f0 + hash01(i, 1, seed + 95 + salt) * (f1 - f0);
      const l = l0 + hash01(i, 2, seed + 95 + salt) * (l1 - l0);
      const shirt = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#f8fafc'][Math.floor(hash01(i, 3, seed + 96 + salt) * 6)];
      prop(f, l, () => {
        const [x, y] = at(f, l);
        body.set(x, y - 4, look.snow > 0.3 ? hex('#ef4444') : hex('#e9b48c'));
        body.rect(x, y - 3, 1, 2, hex(shirt));
        body.set(x, y - 1, hex('#334155'));
      });
    }
  };
  /**
   * Autobús: escolar (amarillo con morro) o urbano (`city`: frontal plano, ventanas corridas, puertas
   * y techo blanco; `electric` le pone las baterías en el techo).
   */
  const bus = (f, l, alongL, color = '#facc15', opts = {}) => vehicle(f, l, alongL, ({ bx, along, faces }) => {
    const y = ramp(color);
    const city = !!opts.city;
    const side = (dk) => (u, v, z) => {
      const a = along(u, v);
      if (z < 2.1 && (Math.abs(a - 0.28) < 0.06 || Math.abs(a + 0.3) < 0.06)) return TIRE.mid;
      if (city) {
        if ((Math.abs(a - 0.08) < 0.05 || Math.abs(a + 0.2) < 0.05) && z > 1 && z < 5.1) return hex('#1f2937'); // puertas
        if (z > 3.3 && z < 5.2) return ((a + 1) * 16) % 3 < 0.4 ? (dk ? y.dark : y.mid) : vglass[dk ? 1 : 0];
        if (z > 5.6) return dk ? WHITE.mid : WHITE.light;
        return dk ? y.dark : y.mid;
      }
      if (z > 2.4 && z < 2.8) return hex('#1f2937');
      if (z > 3.6 && z < 5.1 && ((a + 1) * 16) % 2.4 > 0.5) return vglass[dk ? 1 : 0];
      return dk ? y.dark : y.mid;
    };
    const endFn = (dk) => (u, v, z) => (z > (city ? 2.8 : 3.6) && z < 5.3 ? vglass[dk ? 1 : 0] : z > 1.4 && z < 2 ? (on ? hex('#fef08a') : WHITE.light) : dk ? y.dark : y.mid);
    bx(-0.42, city ? 0.46 : 0.4, -0.13, 0.13, 0.8, 6, y, faces(endFn, side, roofTop(city ? WHITE : y)));
    if (!city) bx(0.4, 0.5, -0.12, 0.12, 0.8, 3.4, y, faces((dk) => () => (dk ? y.dark : y.mid), side, roofTop(y)));
    if (opts.electric) bx(-0.25, 0.1, -0.09, 0.09, 6, 6.8, STEEL, { top: roofTop(STEEL) });
  });
  const schoolBus = (f, l, alongL) => bus(f, l, alongL, '#facc15');
  /** Cubierta a cuatro aguas (pizarra, cobre…) sobre un volumen; la cumbrera sigue el lado largo. */
  const hipRoof = (B, peak, rp, e = 0.07) => {
    const longL = (B.L1 - B.L0) >= (B.F1 - B.F0);
    const F0 = B.F0 - e;
    const F1 = B.F1 + e;
    const L0 = B.L0 - e;
    const L1 = B.L1 + e;
    const z0 = B.h;
    const zt = B.h + peak;
    const cf = (F0 + F1) / 2;
    const cl = (L0 + L1) / 2;
    const d = longL ? (F1 - F0) / 2 : (L1 - L0) / 2;
    const tex = (k) => (u, v, z, x, y) => {
      if (snowAt(x, y, 1.15, 7)) return SNOW.light;
      return Math.floor(z * 1.4) % 2 ? rp[k] : shade(rp[k], 0.9);
    };
    if (longL) {
      const r0 = [cf, L0 + d, zt];
      const r1 = [cf, L1 - d, zt];
      body.surface([sv(F0, L0, z0), sv(F0, L1, z0), sv(...r1), sv(...r0)], tex('light'));
      body.surface([sv(F0, L0, z0), sv(F1, L0, z0), sv(...r0)], tex('mid'));
      body.surface([sv(F1, L0, z0), sv(F1, L1, z0), sv(...r1), sv(...r0)], tex(front === 'u' ? 'mid' : 'light'));
      body.surface([sv(F0, L1, z0), sv(F1, L1, z0), sv(...r1)], tex(front === 'u' ? 'light' : 'mid'));
    } else {
      const r0 = [F0 + d, cl, zt];
      const r1 = [F1 - d, cl, zt];
      body.surface([sv(F0, L0, z0), sv(F1, L0, z0), sv(...r1), sv(...r0)], tex('light'));
      body.surface([sv(F0, L0, z0), sv(F0, L1, z0), sv(...r0)], tex('mid'));
      body.surface([sv(F0, L1, z0), sv(F1, L1, z0), sv(...r1), sv(...r0)], tex(front === 'u' ? 'light' : 'mid'));
      body.surface([sv(F1, L0, z0), sv(F1, L1, z0), sv(...r1)], tex(front === 'u' ? 'mid' : 'light'));
    }
  };
  /** Pista deportiva pintada en el suelo: baloncesto (terracota) o fútbol (césped). */
  const court = (f0, f1, l0, l1, type = 'basket') => {
    kit.fl(f0, f1, l0, l1, (u, v, z, x, y) => {
      if (snowAt(x, y, 0.9)) return SNOW.light;
      const f = fOf(u, v);
      const l = lOf(u, v);
      const lw = 0.022;
      const inset = Math.min(f - f0, f1 - f, l - l0, l1 - l);
      const cf = (f0 + f1) / 2;
      const cl = (l0 + l1) / 2;
      const long = (l1 - l0) > (f1 - f0);
      const line = Math.abs(inset - 0.06) < lw || (inset > 0.06 && Math.abs((long ? l : f) - (long ? cl : cf)) < lw)
        || Math.abs(Math.hypot(f - cf, l - cl) - Math.min(f1 - f0, l1 - l0) * 0.18) < lw;
      if (line && inset > 0.04) return WHITE.light;
      if (type === 'soccer') {
        const g = kit.lawnShade(u, v, z, x, y);
        return ((long ? l : f) * 3) % 1 < 0.5 ? shade(g, 0.92) : g;
      }
      return hash01(x, y, seed + 84) < 0.06 ? hex('#a65f42') : hex('#b06a4a');
    });
  };
  const hoop = (f, l) => prop(f, l, () => {
    const [x, y] = at(f, l);
    body.rect(x, y - 9, 1, 9, STEEL.mid);
    body.rect(x - 1, y - 12, 4, 3, WHITE.light);
    body.set(x + 1, y - 9, hex('#ef4444'));
  });
  const goal = (f, l) => prop(f, l, () => {
    const [x0, y0] = at(f, l - 0.15);
    const [x1, y1] = at(f, l + 0.15);
    body.line(x0, y0 - 4, x1, y1 - 4, WHITE.light);
    body.rect(x0, y0 - 4, 1, 4, WHITE.light);
    body.rect(x1, y1 - 4, 1, 4, WHITE.light);
  });
  /** Fuente: pilón de piedra en el suelo y surtidor en el volumen. */
  const fountain = (f, l, r = 0.3) => {
    kit.fl(f - r, f + r, l - r, l + r, (u, v, z, x, y) => {
      const d = Math.hypot(fOf(u, v) - f, lOf(u, v) - l) / r;
      if (d > 1) return null;
      if (d > 0.78) return snowAt(x, y, 0.8) ? SNOW.light : hex('#d6d3d1');
      if (look.snow > 0.55) return hex('#dbeafe');
      return hash01(x >> 1, y, seed + 50) < 0.08 ? hex('#bfdbfe') : hex('#60a5fa');
    });
    prop(f, l, () => {
      const [x, y] = at(f, l);
      body.rect(x - 1, y - 3, 3, 3, ramp('#d6d3d1').mid);
      if (!lit || look.snow > 0.5) return;
      body.rect(x, y - 8, 1, 5, hex('#bfdbfe'));
      for (let i = -3; i <= 3; i++) body.set(x + i, y - 8 + Math.round(Math.abs(i) * 1.2), hex('#dbeafe'));
    });
  };

  /** Cierra el dibujo: gris si no da servicio, contorno y composición final. */
  const finish = (W, H, ox, oy, emitters, wallH) => {
    if (o.suspended) {
      for (let i = 0; i < body.data.length; i += 4) {
        if (body.data[i + 3] === 0) continue;
        const g = (body.data[i] + body.data[i + 1] + body.data[i + 2]) / 3;
        for (let k = 0; k < 3; k++) body.data[i + k] = Math.round((body.data[i + k] * 0.45 + g * 0.55) * 0.82);
      }
    }
    body.outline(0.62);
    const comp = new PixelCanvas(W, H, ox, oy, S);
    comp.draw(ground);
    comp.draw(body);
    return { ground, body, comp, ox, oy, W, H, S, emitters, wallH };
  };

  return {
    night, lit, on, hd, fOf, lOf, darkFace, glassAt, roofTop, glowAt,
    facade, roof, block, gdoor, garage, hvac, radioMast, flagpole, hydrant, charger, parking,
    vehicle, patrol, ambulance, fireEngine, helicopter, drone, finish,
    portico, dome, people, schoolBus, bus, hipRoof, court, hoop, goal, fountain,
  };
}
