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
  };
}
