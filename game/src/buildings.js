// The buildings of Lanka, made from plain geometry: stone ground floors, plastered upper floors, tiled roofs,
// pillared verandas, balconies and temple-style towers. Each one fits a 6 m slot along the street.
// Local frame: front wall on z = 0, the street toward +z, the building runs back toward -z.
import { Builder, rng } from './build.js';

export const SLOT = 6;
const W = 5.9, H2 = W / 2;

const PLASTER = { red: [0.62, 0.6, 0.62], ochre: [0.72, 0.92, 0.6], dusk: [0.46, 0.6, 0.78], cream: [0.78, 1.25, 1.35], stone: [1, 1, 1] };

function windowAt(b, x, y, w = 1.0, z = 0, hood = true) {
  const h = w * 1.6;
  b.panel(x - w / 2, x + w / 2, y, y + h, z + 0.035, 'window');
  b.box(x - w / 2 - 0.1, x + w / 2 + 0.1, y - 0.13, y, z, z + 0.2, 'lotus', { faces: 'flrtd', ground: false, top: 'dark' });
  if (hood) b.lean(x - w / 2 - 0.16, x + w / 2 + 0.16, z, z + 0.48, y + h + 0.3, y + h + 0.06);
}

function doorAt(b, x, y, w = 1.6) {
  const h = w * 1.9, o = { ground: false };
  b.panel(x - w / 2, x + w / 2, y, y + h, 0.04, 'door');
  for (const s of [-1, 1]) {      // jambs stand proud of the wall
    const a = x + s * w / 2, c = x + s * (w / 2 + 0.24);
    b.box(Math.min(a, c), Math.max(a, c), y, y + h + 0.08, 0, 0.17, 'tower', { faces: 'flr', tile: [1, 3] });
  }
  b.box(x - w / 2 - 0.36, x + w / 2 + 0.36, y + h + 0.08, y + h + 0.44, 0, 0.26, 'frieze', { ...o, faces: 'flrtd', tile: [1.44, 0.36], top: 'dark' });
  // a lamp hung beside the door
  const lx = x + w / 2 + 0.62;
  b.box(lx - 0.02, lx + 0.02, y + 2.62, y + 2.66, 0, 0.24, 'dark', { ...o, faces: 'fblrtd' });
  b.lathe(lx, 0.22, y + 2.3, [[0.02, 0], [0.085, 0.07], [0.085, 0.2], [0.03, 0.26]], 'lamp', 6);
  b.lathe(lx, 0.22, y + 2.56, [[0.1, 0], [0.02, 0.07]], 'gold', 6);
  return y + h + 0.44;
}

function cornice(b, y, depth, half = 0.2, out = 0.16, cell = 'frieze', inset = 0) {
  const tile = cell === 'frieze' ? [half * 8, half * 2] : [half * 16, half * 2];
  b.box(-H2 + inset - 0.04, H2 - inset + 0.04, y - half, y + half, -depth + inset, out - inset, cell, { faces: 'flrtd', ground: false, tile, top: 'dark' });
}

function plinth(b, depth, front, doorX, h = 0.4) {
  b.box(-H2 - 0.03, H2 + 0.03, 0, h, -depth, front, 'stone', { faces: 'flrt', top: 'paving', shade: 0.92 });
  b.box(doorX - 1.05, doorX + 1.05, 0, h / 2, front, front + 0.34, 'stone', { faces: 'flrt', top: 'paving', shade: 0.92 });
  return h;
}

// style: { floors, veranda, balcony, roof: 'hip' | 'tiered' | 'flat', upper: 'plaster' | 'stone', color, door: -1 | 0 | 1 }
export function house(seed, style) {
  const r = rng(seed), b = new Builder();
  const { floors = 2, veranda = false, balcony = false, roof = 'hip', upper = 'plaster', color = 'red' } = style;
  const depth = 4.6, doorX = veranda ? 0 : (style.door || 0) * 1.35;
  const g = 3.75 + r() * 0.35, storey = 2.85 + r() * 0.35;
  b.tint = [0.94 + r() * 0.12, 0.94 + r() * 0.1, 0.92 + r() * 0.12];
  const y0 = plinth(b, depth, veranda ? 1.8 : 0.62, doorX);

  // ground floor: stone, the door and small lit windows
  b.box(-H2, H2, y0, y0 + g, -depth, 0, 'stone', { faces: 'flr' });
  doorAt(b, doorX, y0);
  for (const x of [-1.95, 0, 1.95]) if (Math.abs(x - doorX) > 1.6 && Math.abs(x - doorX - 1.42) > 0.9) windowAt(b, x, y0 + 1.25, 0.82, 0, false);

  if (veranda) {
    const zp = 1.42, top = y0 + 3.0;
    for (const x of [-2.62, -0.98, 0.98, 2.62]) b.pillar(x, zp, y0, top, 0.3);
    b.box(-H2, H2, top, top + 0.24, zp - 0.19, zp + 0.19, 'wood', { faces: 'fbd', ground: false, along: [0, 1, 0] });
    b.lean(-H2, H2, 0, zp + 0.55, y0 + g + 0.3, top + 0.2);
  } else {
    b.lean(doorX - 1.25, doorX + 1.25, 0, 0.75, y0 + g - 0.05, y0 + g - 0.32);      // small tiled hood over the door
    cornice(b, y0 + g, depth);
  }

  // upper floors
  let y = y0 + g;
  const tintUp = PLASTER[upper === 'stone' ? 'stone' : color];
  for (let k = 1; k < floors; k++) {
    const inset = k === 2 ? 0.22 : 0, zf = -inset;
    b.box(-H2 + inset, H2 - inset, y, y + storey, -depth + inset, zf, upper, { faces: 'flr', color: tintUp, ground: false });
    if (k > 1) cornice(b, y, depth, 0.13, 0.14, 'lotus', inset - 0.02);
    const xs = k === 1 ? [-1.9, 0, 1.9] : [-1.55, 1.55];
    const deck = balcony && k === 1 && !veranda;
    for (const x of xs) windowAt(b, x, y + (deck && x === 0 ? 0.3 : 0.72), deck && x === 0 ? 1.15 : 0.98, zf);
    if (deck) {
      const o = { ground: false }, zr = 1.0;
      b.box(-2.35, 2.35, y - 0.04, y + 0.12, 0, zr, 'wood', { ...o, faces: 'flrtd', along: [0, 1, 0] });
      for (const x of [-2.1, 0, 2.1]) b.box(x - 0.09, x + 0.09, y - 0.55, y - 0.04, 0, 0.7, 'wood', { ...o, faces: 'flrd' });
      for (let x = -2.3; x <= 2.31; x += 0.46) b.box(x - 0.04, x + 0.04, y + 0.12, y + 0.92, zr - 0.09, zr - 0.01, 'wood', { ...o, faces: 'fblr' });
      for (const z of [0.3, 0.62]) for (const s of [-1, 1]) b.box(s * 2.3 - 0.04, s * 2.3 + 0.04, y + 0.12, y + 0.92, z - 0.04, z + 0.04, 'wood', { ...o, faces: 'fblr' });
      b.box(-2.35, 2.35, y + 0.92, y + 1.02, zr - 0.11, zr + 0.01, 'gold', { ...o, faces: 'fblrtd' });
      for (const s of [-1, 1]) b.box(s * 2.3 - 0.05, s * 2.3 + 0.05, y + 0.92, y + 1.02, 0, zr - 0.11, 'gold', { ...o, faces: 'fblrtd' });
    }
    y += storey;
  }

  // roof
  const back = -depth - 0.25;
  if (roof === 'hip') {
    cornice(b, y - 0.02, depth, 0.13, 0.14, 'lotus', floors === 3 ? 0.2 : 0);
    const top = b.hip(-H2, H2, back, 0.62, y + 0.1, 1.9 + r() * 0.5);
    const mid = (back + 0.62) / 2, half = (0.62 - back) / 2;
    if (H2 - half < 0.6) b.finial(0, mid, top - 0.05, 1.05);
    else { b.finial(-H2 + half, mid, top - 0.05, 0.9); b.finial(H2 - half, mid, top - 0.05, 0.9); }
    y = top + 0.8;
  } else if (roof === 'tiered') {
    const [X0, X1, Z0, Z1, t1] = b.skirt(-H2, H2, back, 0.62, y, 1.25, 0.85);
    b.box(X0, X1, t1 - 0.1, t1 + 1.25, Z0, Z1, upper, { faces: 'flr', color: tintUp, ground: false });
    for (const x of [-0.8, 0.8]) b.panel(x - 0.3, x + 0.3, t1 + 0.2, t1 + 1.05, Z1 + 0.03, 'window');
    const top = b.hip(X0 - 0.55, X1 + 0.55, Z0 - 0.5, Z1 + 0.5, t1 + 1.25, 1.5);
    b.finial(0, (Z0 + Z1) / 2, top - 0.05, 1.15);
    y = top + 1.1;
  } else {
    cornice(b, y, depth, 0.2, 0.18, 'frieze', floors === 3 ? 0.2 : 0);
    const i = floors === 3 ? 0.22 : 0, o = { ground: false, top: 'dark' };
    b.poly([[-H2 + i, y + 0.2, -i], [H2 - i, y + 0.2, -i], [H2 - i, y + 0.2, -depth + i], [-H2 + i, y + 0.2, -depth + i]], 'paving', { ground: false, shade: 0.6 });      // roof terrace
    b.box(-H2 + i, H2 - i, y + 0.2, y + 0.75, -0.24 - i, -i, 'stone', { ...o, faces: 'fblrt' });
    for (const s of [-1, 1]) b.box(s > 0 ? H2 - i - 0.24 : -H2 + i, s > 0 ? H2 - i : -H2 + i + 0.24, y + 0.2, y + 0.75, -depth + i, -0.24 - i, 'stone', { ...o, faces: 'lrt' });
    for (let x = -H2 + i + 0.25; x < H2 - i - 0.3; x += 0.92) b.box(x, x + 0.46, y + 0.75, y + 1.08, -0.24 - i, -i, 'stone', { ...o, faces: 'fblrt' });
    // a small pillared pavilion on each front corner
    for (const s of [-1, 1]) {
      const cx = s * (H2 - i - 0.85), cz = -i - 0.85, q = 0.55;
      for (const [px, pz] of [[-q, -q], [q, -q], [q, q], [-q, q]]) b.box(cx + px - 0.06, cx + px + 0.06, y + 0.2, y + 1.85, cz + pz - 0.06, cz + pz + 0.06, 'gold', { ground: false, faces: 'fblr' });
      const top = b.hip(cx - 0.85, cx + 0.85, cz - 0.85, cz + 0.85, y + 1.85, 0.75);
      b.finial(cx, cz, top - 0.03, 0.7);
    }
    y += 3.2;
  }
  return b.done(y, depth);
}

// A temple-style tower: tall stone base with a great door, then carved tiers stepping in to a barrel roof.
export function tower(seed, tiers = 4) {
  const r = rng(seed), b = new Builder(), depth = 4.8, zc = -depth / 2;
  b.tint = [0.95 + r() * 0.1, 0.95 + r() * 0.08, 0.93 + r() * 0.1];
  const y0 = plinth(b, depth, 0.75, 0, 0.5), base = 5.3 + r() * 0.5;
  b.box(-H2, H2, y0, y0 + base, -depth, 0, 'stone', { faces: 'flr' });
  for (const s of [-1, 1]) b.box(s > 0 ? H2 - 0.62 : -H2, s > 0 ? H2 : -H2 + 0.62, y0, y0 + base, 0, 0.2, 'tower', { faces: 'flr', tile: [1.6, 1.6] });
  doorAt(b, 0, y0, 2.0);
  for (const x of [-1.72, 1.72]) b.panel(x - 0.3, x + 0.3, y0 + 3.2, y0 + 4.16, 0.03, 'window');
  let y = y0 + base;
  cornice(b, y + 0.1, depth, 0.28, 0.26);
  y += 0.38;
  let hw = H2 - 0.3, hd = depth / 2 - 0.3;
  for (let k = 0; k < tiers; k++) {
    const h = 1.85 - k * 0.14;
    b.box(-hw, hw, y, y + h, zc - hd, zc + hd, 'tower', { faces: 'flr', ground: false, tile: [3.6, 3.6] });
    b.panel(-0.32, 0.32, y + 0.3, y + h - 0.25, zc + hd + 0.03, 'window');
    b.box(-hw - 0.26, hw + 0.26, y + h, y + h + 0.26, zc - hd - 0.26, zc + hd + 0.26, 'lotus', { faces: 'flrtd', ground: false, top: 'dark', tile: [2.08, 0.26] });
    y += h + 0.26; hw *= 0.84; hd *= 0.84;
  }
  // barrel roof along the street, with a row of finials on its ridge
  const R = hd * 0.95, L = hw * 0.98, N = 6, o = { ground: false };
  const at = a => [y + R * Math.sin(a), zc + R * Math.cos(a)];
  for (let i = 0; i < N; i++) {
    const [ya, za] = at(i / N * Math.PI), [yb, zb] = at((i + 1) / N * Math.PI);
    b.poly([[-L, ya, za], [L, ya, za], [L, yb, zb], [-L, yb, zb]], 'roof', { ...o, along: [1, 0, 0], tile: [2.2, 2.2] });
  }
  const arc = [...Array(N + 1)].map((_, i) => at(i / N * Math.PI));
  b.poly(arc.slice().reverse().map(([yy, zz]) => [L, yy, zz]), 'tower', { ...o, tile: [2.4, 2.4], along: [0, 0, -1], shade: 0.85 });
  b.poly(arc.map(([yy, zz]) => [-L, yy, zz]), 'tower', { ...o, tile: [2.4, 2.4], along: [0, 0, 1], shade: 0.85 });
  for (const x of [-L * 0.62, 0, L * 0.62]) b.finial(x, zc, y + R - 0.04, 0.8);
  return b.done(y + R + 0.8, depth);
}

// A walled court set back from the street: a carved niche for a statue, gate piers with lamps, a house behind.
export function court(seed) {
  const r = rng(seed), b = new Builder(), o = { ground: false };
  b.tint = [0.96 + r() * 0.08, 0.96 + r() * 0.06, 0.95 + r() * 0.08];
  b.box(-H2, H2, 0, 0.16, -1.5, 0.6, 'stone', { faces: 'flrt', top: 'paving', shade: 0.92 });
  b.box(-H2, H2, 0, 3.3, -1.75, -1.5, 'stone', { faces: 'flrt', top: 'dark' });
  b.box(-H2 - 0.04, H2 + 0.04, 3.3, 3.66, -1.85, -1.4, 'frieze', { ...o, faces: 'flrtd', tile: [1.44, 0.36], top: 'dark' });
  b.box(-1.7, 1.7, 0.16, 5.0, -1.5, -1.28, 'tower', { faces: 'flrt', tile: [3.4, 3.4], top: 'dark' });      // carved backdrop
  b.box(-1.85, 1.85, 5.0, 5.3, -1.6, -1.18, 'lotus', { ...o, faces: 'flrtd', tile: [2.4, 0.3], top: 'dark' });
  for (const s of [-1, 1]) {
    const x = s * (H2 - 0.42);
    b.box(x - 0.42, x + 0.42, 0, 4.0, -1.5, -0.66, 'stone', { faces: 'flr', tile: [1.6, 1.6] });
    b.box(x - 0.52, x + 0.52, 4.0, 4.26, -1.6, -0.56, 'lotus', { ...o, faces: 'flrtd', tile: [2.08, 0.26], top: 'dark' });
    b.box(x - 0.2, x + 0.2, 4.26, 4.72, -1.28, -0.88, 'lamp', { ...o, faces: 'fblrt' });
    const top = b.hip(x - 0.36, x + 0.36, -1.44, -0.72, 4.72, 0.4); b.finial(x, -1.08, top - 0.03, 0.5);
  }
  // the house behind the wall, so the gap never opens onto empty sky
  b.box(-H2, H2, 0, 7.6, -8.4, -3.4, 'plaster', { faces: 'flr', color: PLASTER.dusk, shade: 0.8 });
  for (const x of [-1.8, 0, 1.8]) b.panel(x - 0.45, x + 0.45, 4.6, 6.05, -3.36, 'window');
  const top = b.hip(-H2, H2, -8.7, -2.8, 7.6, 2.0);
  return b.done(top + 0.5, 8.4);
}

// Kerb and footpath for one side of a stretch of street, from the road edge to the house fronts.
export function footpath(length, x0, x1) {
  const b = new Builder(), o = { ground: false, shade: 0.8 };
  for (const s of [-1, 1]) {
    const a = s > 0 ? x0 : -x1, c = s > 0 ? x1 : -x0;
    b.box(a, c, 0, 0.14, -length, 0, 'paving', { ...o, faces: s > 0 ? 'lt' : 'rt', along: [0, 0, 1] });
  }
  return b.geometry();
}

// The low lamp beam that has to be slid under.
export function lampBeam() {
  const b = new Builder(), o = { ground: false };
  for (const x of [-1.06, 1.06]) {
    b.box(x - 0.17, x + 0.17, 0, 0.3, -0.17, 0.17, 'stone', { faces: 'fblrt', tile: [1.2, 1.2] });
    b.box(x - 0.1, x + 0.1, 0.3, 1.62, -0.1, 0.1, 'wood', { ...o, faces: 'fblr', tile: [0.8, 1.6] });
  }
  b.box(-1.3, 1.3, 1.62, 1.86, -0.13, 0.13, 'wood', { ...o, faces: 'fblrtd', along: [0, 1, 0] });
  b.box(-1.34, 1.34, 1.86, 1.92, -0.17, 0.17, 'gold', { ...o, faces: 'fblrtd' });
  for (const x of [-0.62, 0, 0.62]) {
    b.box(x - 0.015, x + 0.015, 1.46, 1.62, -0.015, 0.015, 'dark', { ...o, faces: 'fblr' });
    b.lathe(x, 0, 1.2, [[0.02, 0], [0.09, 0.07], [0.09, 0.2], [0.03, 0.26]], 'lamp', 6);
  }
  return b.geometry();
}

// A gate across the street: two carved piers, a heavy lintel with a tiled roof, lamps hanging in the opening.
export function streetGate() {
  const b = new Builder(), o = { ground: false };
  for (const s of [-1, 1]) {
    const x0 = s > 0 ? 4.3 : -5.5, x1 = x0 + 1.2;
    b.box(x0 - 0.15, x1 + 0.15, 0, 0.6, -0.75, 0.75, 'stone', { faces: 'fblrt', top: 'paving', tile: [1.5, 1.5] });
    b.box(x0, x1, 0.6, 7.2, -0.6, 0.6, 'tower', { faces: 'fblr', tile: [2.4, 2.4] });
    b.box(x0 - 0.14, x1 + 0.14, 7.2, 7.5, -0.74, 0.74, 'lotus', { ...o, faces: 'fblrd', tile: [2.4, 0.3] });
    b.box(s > 0 ? 3.7 : -4.3, s > 0 ? 4.3 : -3.7, 6.7, 7.5, -0.3, 0.3, 'frieze', { ...o, faces: 'fblrd', tile: [1.6, 0.8] });      // bracket
  }
  b.box(-5.75, 5.75, 7.5, 8.7, -0.58, 0.58, 'frieze', { ...o, faces: 'fblrd', tile: [4.8, 1.2] });
  b.box(-5.9, 5.9, 8.7, 8.96, -0.72, 0.72, 'lotus', { ...o, faces: 'fblrd', tile: [2.08, 0.26] });
  const top = b.hip(-6.2, 6.2, -1.05, 1.05, 8.96, 1.15);
  for (const x of [-3.6, 0, 3.6]) b.finial(x, 0, top - 0.04, 0.85);
  for (const x of [-2.4, 0, 2.4]) {
    b.box(x - 0.02, x + 0.02, 6.75, 7.5, -0.02, 0.02, 'dark', { ...o, faces: 'fblr' });
    b.lathe(x, 0, 6.3, [[0.03, 0], [0.17, 0.12], [0.17, 0.36], [0.05, 0.47]], 'lamp', 8);
    b.lathe(x, 0, 6.76, [[0.2, 0], [0.03, 0.1]], 'gold', 8);
  }
  return b.geometry();
}

// A volley of arrows stuck in the paving, shot from the walls ahead.
export function arrowVolley() {
  const b = new Builder(), o = { ground: false }, r = rng(77);
  for (let i = 0; i < 6; i++) {
    const x = (r() - 0.5) * 1.5, z = (r() - 0.5) * 1.0, h = 1.15 + r() * 0.35, dx = (r() - 0.5) * 0.3, dz = -0.35 - r() * 0.3, w = 0.034;
    const foot = [[x - w, 0, z + w], [x + w, 0, z + w], [x + w, 0, z - w], [x - w, 0, z - w]], top = foot.map(([px, , pz]) => [px + dx, h, pz + dz]);
    for (let k = 0; k < 4; k++) { const n = (k + 1) % 4; b.poly([foot[k], foot[n], top[n], top[k]], 'wood', { ...o, fit: true, shade: 0.9 }); }
    // feathers at the tail
    const f = 0.09, tx = x + dx, tz = z + dz;
    b.poly([[tx - f, h - 0.28, tz + 0.07], [tx + f, h - 0.28, tz + 0.07], [tx + f, h, tz], [tx - f, h, tz]], 'ember', o);
    b.poly([[tx + f, h - 0.28, tz + 0.07], [tx - f, h - 0.28, tz + 0.07], [tx - f, h, tz], [tx + f, h, tz]], 'ember', o);
  }
  return b.geometry();
}

Builder.prototype.done = function (height, depth) { return { builder: this, height, depth, triangles: this.triangles }; };

// The set of buildings the street is dealt from. Each comes in two versions, lit by the brazier at its left or right corner.
export function kit() {
  const TORCH = { color: [2.3, 1.0, 0.3], reach: 2.7 };
  const plans = [
    ['house', () => house(11, { floors: 2, veranda: true, roof: 'hip', color: 'red' })],
    ['house', () => house(12, { floors: 3, roof: 'tiered', upper: 'stone', door: -1 })],
    ['house', () => house(13, { floors: 2, balcony: true, roof: 'flat', color: 'ochre', door: 1 })],
    ['house', () => house(14, { floors: 3, veranda: true, roof: 'hip', color: 'dusk' })],
    ['house', () => house(15, { floors: 2, balcony: true, roof: 'tiered', color: 'cream', door: -1 })],
    ['house', () => house(16, { floors: 3, balcony: true, roof: 'flat', upper: 'stone' })],
    ['house', () => house(17, { floors: 2, roof: 'hip', color: 'ochre', door: 1 })],
    ['tower', () => tower(21, 4)],
    ['tower', () => tower(22, 3)],
    ['court', () => court(31)],
  ];
  return plans.map(([type, make], id) => {
    const p = make();
    const lit = side => p.builder.geometry([{ at: [side * SLOT / 2, 2.9, 1.75], ...TORCH }]);
    return { id, type, height: p.height, depth: p.depth, triangles: p.triangles, veranda: id === 0 || id === 3, geo: { [-1]: lit(-1), 1: lit(1) } };
  });
}
