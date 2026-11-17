// The way up to Ravana's palace and the palace itself, made from plain geometry on the shared texture sheet:
// the moat bridge, the grand stairway, the court with its alarm bell, the pillared halls, and the things that guard them.
// Every stretch is 24 m long in the frame the street uses: he runs toward -z, x runs across the lanes, the floor is y = 0.
import { Builder } from './build.js';

export const LEN = 24;
export const STAIR_RISE = 6.4;          // one stretch of stairway climbs this much
const TORCH = [2.3, 1.0, 0.3];
const lit = (lights, x, y, z, reach = 3.2, k = 1) => lights.push({ at: [x, y, z], color: TORCH.map(c => c * k), reach });

// Height of the stairway s metres along a stretch: two flights of 8 m with landings before, between and after.
export function stairHeight(s) {
  const flight = x => Math.min(1, Math.max(0, x / 8));
  return 3.2 * (flight(s - 3) + flight(s - 15));
}

// A great carved column: stone foot, gilded shaft, spreading capital.
function column(b, cx, cz, y0, y1, w = 1.1) {
  const h = w / 2, o = { ground: false };
  b.box(cx - h * 1.35, cx + h * 1.35, y0, y0 + 0.7, cz - h * 1.35, cz + h * 1.35, 'stone', { faces: 'fblrt', tile: [1.5, 1.5], top: 'dark' });
  b.box(cx - h * 1.15, cx + h * 1.15, y0 + 0.7, y0 + 0.95, cz - h * 1.15, cz + h * 1.15, 'lotus', { ...o, faces: 'fblrt', tile: [w * 2.3, 0.25], top: 'dark' });
  b.box(cx - h, cx + h, y0 + 0.95, y1 - 0.95, cz - h, cz + h, 'ppillar', { faces: 'fblr', tile: [w, w * 2] });
  b.box(cx - h * 1.2, cx + h * 1.2, y1 - 0.95, y1 - 0.65, cz - h * 1.2, cz + h * 1.2, 'lotus', { ...o, faces: 'fblrd', tile: [w * 2.4, 0.3] });
  b.box(cx - h * 1.5, cx + h * 1.5, y1 - 0.65, y1, cz - h * 1.5, cz + h * 1.5, 'frieze', { ...o, faces: 'fblrd', tile: [w * 3, 0.65] });
}

// An oil lamp on a chain.
function hangLamp(b, x, z, yTop, y, s = 1) {
  b.box(x - 0.02, x + 0.02, y + 0.5 * s, yTop, z - 0.02, z + 0.02, 'dark', { faces: 'fblr', ground: false });
  b.lathe(x, z, y, [[0.04 * s, 0], [0.2 * s, 0.1 * s], [0.22 * s, 0.18 * s]], 'bronze', 8, 1.2);                       // the bowl
  b.lathe(x, z, y + 0.16 * s, [[0.09 * s, 0], [0.07 * s, 0.14 * s], [0, 0.34 * s]], 'lamp', 6);                       // its flame
  b.lathe(x, z, y + 0.48 * s, [[0.12 * s, 0], [0.02 * s, 0.08 * s]], 'bronze', 6, 1.2);
}

// A lamp on a small bracket, standing out from a wall or pillar toward dx.
function wallLamp(b, lights, x, y, z, dx, reach = 3.2, k = 1) {
  b.box(Math.min(x, x + dx * 0.3), Math.max(x, x + dx * 0.3), y - 0.05, y, z - 0.03, z + 0.03, 'dark', { faces: 'fblrtd', ground: false });
  b.lathe(x + dx * 0.3, z, y, [[0.03, 0], [0.14, 0.07], [0.15, 0.12]], 'bronze', 6, 1.2);
  b.lathe(x + dx * 0.3, z, y + 0.1, [[0.06, 0], [0.05, 0.1], [0, 0.24]], 'lamp', 5);
  lit(lights, x + dx * 0.55, y + 0.25, z, reach, k);
}

// A door set into a wall that faces across the hall (the wall is at x, facing the direction s looks away from).
function sideDoor(b, x, s, z, w = 2.6, h = 4.6) {
  b.face([[x, 0, z + w / 2], [x, 0, z - w / 2], [x, h, z - w / 2], [x, h, z + w / 2]], 'pdoor', [-s, 0, 0], { fit: true, ground: false, along: [0, 0, s], shade: 0.9 });
}

// ── The moat bridge ─────────────────────────────────────────────────────────────────────────────────────────────
export const BRIDGE_HALF = 4.4, GAP_HALF = 1.3, LEAF = 2.7, LEAF_UP = 0.7;
// Where the drawbridge is raised, its two leaves tilt up to the gap. Height of the way u metres from the middle of the gap.
export function leafHeight(u) {
  const a = Math.abs(u);
  return a <= GAP_HALF ? LEAF_UP : a < GAP_HALF + LEAF ? LEAF_UP * (1 - (a - GAP_HALF) / LEAF) : 0;
}
// gapAt: where the drawbridge has been raised (z of the middle of the gap), or null for an unbroken deck.
export function bridgeModule(gapAt = null) {
  const b = new Builder(), o = { ground: false }, HW = BRIDGE_HALF, lights = [];
  const mid = gapAt === null ? null : -gapAt, out = GAP_HALF + LEAF;
  const spans = mid === null ? [[0, LEN]] : [[0, mid - out], [mid + out, LEN]];
  for (const [s0, s1] of spans) {
    b.box(-HW, HW, -0.8, 0, -s1, -s0, 'stone', { ...o, faces: 'tlrfb', top: 'paving', shade: 0.9 });
    for (const s of [-1, 1]) {
      const a = Math.min(s * (HW - 0.4), s * HW), c = Math.max(s * (HW - 0.4), s * HW);
      b.box(a, c, 0, 0.8, -s1, -s0, 'stone', { faces: 'lrfb', tile: [1.6, 1.6] });
      b.box(a - 0.06, c + 0.06, 0.8, 0.96, -s1, -s0, 'lotus', { ...o, faces: 'lrtfb', tile: [1.6, 0.16], top: 'dark' });
    }
  }
  // lamp piers along the parapet
  for (const s of [3, 9, 15, 21]) if (mid === null || Math.abs(s - mid) > out + 0.8) for (const side of [-1, 1]) {
    const x = side * (HW - 0.2), z = -s;
    b.box(x - 0.36, x + 0.36, 0, 1.55, z - 0.36, z + 0.36, 'tower', { faces: 'fblr', tile: [0.72, 1.55] });
    b.box(x - 0.44, x + 0.44, 1.55, 1.7, z - 0.44, z + 0.44, 'lotus', { ...o, faces: 'fblrtd', tile: [0.88, 0.15], top: 'dark' });
    b.lathe(x, z, 1.7, [[0.1, 0], [0.3, 0.16], [0.34, 0.3]], 'bronze', 8, 1.2);
    b.lathe(x, z, 1.96, [[0.2, 0], [0.15, 0.2], [0, 0.55]], 'lamp', 6);
    lit(lights, x - side * 0.7, 2.0, z, 3.0);
  }
  if (mid !== null) for (const e of [-1, 1]) {
    // one leaf of the drawbridge, hauled up on its chains: he runs up the near one and must leap to the far one
    const hinge = mid + e * out, lip = mid + e * GAP_HALF, W = HW - 0.4, U = LEAF_UP, T = 0.45;
    const top = [[-W, 0, -hinge], [W, 0, -hinge], [W, U, -lip], [-W, U, -lip]];
    b.face(top, 'paving', [0, 1, 0], { ...o, along: [1, 0, 0], shade: 0.95 });
    b.face(top.map(([x, y, z]) => [x, y - T, z]), 'wood', [0, -1, 0], { ...o, along: [1, 0, 0], shade: 0.5 });
    b.face([[-W, U - T, -lip], [W, U - T, -lip], [W, U, -lip], [-W, U, -lip]], 'lotus', [0, 0, e], { ...o, along: [1, 0, 0], tile: [2, T], shade: 1.5 });      // its bright edge
    for (const side of [-1, 1]) {
      b.face([[side * W, -T, -hinge], [side * W, 0, -hinge], [side * W, U, -lip], [side * W, U - T, -lip]], 'wood', [side, 0, 0], { ...o, along: [0, 0, 1], shade: 0.8 });
      // the hinge tower, its fire, and the chain down to the lip of the leaf
      const x = side * (HW - 0.2), z = -hinge;
      b.box(x - 0.42, x + 0.42, 0, 4.3, z - 0.42, z + 0.42, 'tower', { faces: 'fblr', tile: [0.84, 2.15] });
      b.box(x - 0.52, x + 0.52, 4.3, 4.5, z - 0.52, z + 0.52, 'lotus', { ...o, faces: 'fblrtd', tile: [1.04, 0.2], top: 'dark' });
      b.lathe(x, z, 4.5, [[0.12, 0], [0.36, 0.18], [0.4, 0.34]], 'bronze', 8, 1.2);
      b.lathe(x, z, 4.8, [[0.24, 0], [0.18, 0.24], [0, 0.65]], 'lamp', 6);
      lit(lights, x - side * 0.8, 3.2, z, 3.4);
      const chain = [[x - 0.035, 4.2, z], [x + 0.035, 4.2, z], [side * W + 0.035, U, -lip], [side * W - 0.035, U, -lip]];
      for (const way of [-1, 1]) b.face(chain, 'iron', [0, way, 0], { ...o, shade: 1.6 });
    }
  }
  // the piers the bridge stands on, down into the water
  for (const s of [6, 18]) b.box(-HW + 0.4, HW - 0.4, -9, -0.8, -s - 1.1, -s + 1.1, 'stone', { ...o, faces: 'fblr', shade: 0.6 });
  return b.geometry(lights);
}

// ── The grand stairway ──────────────────────────────────────────────────────────────────────────────────────────
export const STAIR_HALF = 5.2;
export function stairsModule(dir = 1) {
  const b = new Builder(), o = { ground: false }, HW = STAIR_HALF, lights = [];
  const level = s => dir * stairHeight(s);
  for (const [s0, s1] of [[0, 3], [11, 15], [23, 24]]) {
    const y = level((s0 + s1) / 2);
    b.box(-HW, HW, y - 0.7, y, -s1, -s0, 'stone', { ...o, faces: 'tfb', top: 'pfloor', shade: 0.95 });
  }
  for (const [s0, from] of [[3, 0], [15, 3.2]]) for (let k = 0; k < 16; k++) {
    const sa = s0 + 0.5 * k, y = dir * (from + 0.4 * (0.5 * k + 0.25)) - 0.03;
    // each step: a dark tread and a gilded riser
    b.box(-HW, HW, y - 0.22, y, -sa - 0.5, -sa, 'paving', { ...o, faces: 't', shade: 0.95 });
    b.box(-HW, HW, y - 0.22, y, -sa - 0.5, -sa, 'lotus', { ...o, faces: 'fb', tile: [2.08, 0.22] });
  }
  for (const s of [-1, 1]) {
    const x = s * HW;
    for (const [s0, s1] of [[0, 3], [3, 11], [11, 15], [15, 23], [23, 24]]) {
      const lo = Math.min(level(s0), level(s1)), hi = Math.max(level(s0), level(s1));
      // the carved wall of the terrace, stepping up with the stairs
      b.face([[x, lo - 1, -s0], [x, lo - 1, -s1], [x, hi + 6.2, -s1], [x, hi + 6.2, -s0]], 'tower', [-s, 0, 0], { ...o, along: [0, 0, s], tile: [4, 4], shade: 0.5 });
      b.face([[x, hi + 6.2, -s0], [x, hi + 6.2, -s1], [x - s * 0.35, hi + 6.2, -s1], [x - s * 0.35, hi + 6.2, -s0]], 'dark', [0, -1, 0], o);
      b.face([[x - s * 0.35, hi + 5.7, -s0], [x - s * 0.35, hi + 5.7, -s1], [x - s * 0.35, hi + 6.2, -s1], [x - s * 0.35, hi + 6.2, -s0]], 'lotus', [-s, 0, 0], { ...o, along: [0, 0, s], tile: [4, 0.5] });
      // a plain stone course along its foot, following the slope
      const xi = x - s * 0.28, a = level(s0), c = level(s1);
      b.face([[xi, a - 0.3, -s0], [xi, c - 0.3, -s1], [xi, c + 1.0, -s1], [xi, a + 1.0, -s0]], 'stone', [-s, 0, 0], { ...o, along: [0, 0, s], tile: [2, 2], shade: 0.75 });
      b.face([[xi, a + 1.0, -s0], [xi, c + 1.0, -s1], [x, c + 1.0, -s1], [x, a + 1.0, -s0]], 'lotus', [0, 1, 0], { ...o, along: [0, 0, s], tile: [2, 0.28] });
    }
    lit(lights, s * 4.45, level(13) + 2.9, -13, 3.2, 0.8);       // where the braziers stand
  }
  return b.geometry(lights);
}

// ── The palace court ────────────────────────────────────────────────────────────────────────────────────────────
export const COURT_HALF = 11.5, COURT_PILLARS = [-3, -9, -15, -21], COURT_PX = 8.2;
export function courtModule() {
  const b = new Builder(), o = { ground: false }, W = COURT_HALF, PX = COURT_PX, lights = [];
  b.box(-W, W, -0.3, 0, -LEN, 0, 'pfloor', { ...o, faces: 't' });
  for (const s of [-1, 1]) {
    const inner = s > 0 ? 'l' : 'r';
    b.face([[s * W, 0, 0], [s * W, 0, -LEN], [s * W, 9.6, -LEN], [s * W, 9.6, 0]], 'pwall', [-s, 0, 0], { along: [0, 0, s], tile: [4, 4] });
    b.box(Math.min(s * (W - 0.3), s * (W + 0.5)), Math.max(s * (W - 0.3), s * (W + 0.5)), 9.6, 10.1, -LEN, 0, 'lotus', { ...o, faces: inner + 'td', tile: [4, 0.5], top: 'dark' });
    // the covered walk: a raised floor, columns, a carved beam and a tiled roof leaning on the wall
    b.box(Math.min(s * (PX - 0.8), s * W), Math.max(s * (PX - 0.8), s * W), 0, 0.22, -LEN, 0, 'stone', { faces: inner + 't', top: 'paving', shade: 0.85 });
    for (const z of COURT_PILLARS) { column(b, s * PX, z, 0.22, 6.5, 0.85); wallLamp(b, lights, s * (PX - 0.45), 3.3, z, -s, 3.2, 0.7); }
    b.box(s * PX - 0.5, s * PX + 0.5, 6.5, 7.2, -LEN, 0, 'frieze', { ...o, faces: 'lrd', tile: [2.8, 0.7] });
    const e = s * (PX - 1.0);
    b.face([[e, 7.2, 0], [e, 7.2, -LEN], [s * W, 8.7, -LEN], [s * W, 8.7, 0]], 'roof', [-s * 0.3, 1, 0], { ...o, along: [0, 0, 1] });
    b.face([[e, 7.05, 0], [e, 7.05, -LEN], [e, 7.2, -LEN], [e, 7.2, 0]], 'lotus', [-s, 0, 0], { ...o, along: [0, 0, s], tile: [2, 0.15] });
    b.face([[e, 7.05, 0], [e, 7.05, -LEN], [s * W, 8.55, -LEN], [s * W, 8.55, 0]], 'wood', [0, -1, 0], { ...o, along: [0, 0, 1], shade: 0.4 });
    sideDoor(b, s * (W - 0.04), s, -12);
  }
  return b.geometry(lights);
}

// The gate into the court. The alarm bell hangs in it (a separate piece, so that it can swing).
export const BELL_AT = 9.3;
export function bellGate() {
  const b = new Builder(), o = { ground: false }, lights = [];
  for (const s of [-1, 1]) {
    const x0 = s > 0 ? 4.5 : -6.7, x1 = x0 + 2.2;
    b.box(x0 - 0.2, x1 + 0.2, 0, 0.8, -1.3, 1.3, 'stone', { faces: 'fblrt', top: 'dark', tile: [1.5, 1.5] });
    b.box(x0, x1, 0.8, 10.2, -1.1, 1.1, 'tower', { faces: 'fblr', tile: [2.2, 2.2] });
    b.box(x0 - 0.18, x1 + 0.18, 10.2, 10.6, -1.28, 1.28, 'lotus', { ...o, faces: 'fblrd', tile: [2.6, 0.4] });
    b.box(s > 0 ? x1 : -COURT_HALF, s > 0 ? COURT_HALF : x0, 0, 8.6, -0.5, 0.5, 'pwall', { faces: 'fb', tile: [4, 4] });
    b.box(s > 0 ? x1 : -COURT_HALF, s > 0 ? COURT_HALF : x0, 8.6, 9.0, -0.62, 0.62, 'lotus', { ...o, faces: 'fbtd', tile: [3.2, 0.4], top: 'dark' });
    for (const z of [1.1, -1.1]) wallLamp(b, lights, s * 4.5, 3.6, z * 0.7, -s, 3.6);
  }
  b.box(-6.9, 6.9, 10.6, 12.0, -1.0, 1.0, 'frieze', { ...o, faces: 'fblrd', tile: [5.6, 1.4] });
  b.box(-7.1, 7.1, 12.0, 12.3, -1.2, 1.2, 'lotus', { ...o, faces: 'fblrd', tile: [2.4, 0.3] });
  const top = b.hip(-7.5, 7.5, -1.7, 1.7, 12.3, 1.5);
  for (const x of [-4.6, 0, 4.6]) b.finial(x, 0, top - 0.05, 1.1);
  b.box(-4.5, 4.5, BELL_AT, BELL_AT + 0.45, -0.22, 0.22, 'wood', { ...o, faces: 'fbtd', along: [0, 1, 0] });      // the beam the bell hangs from
  return b.geometry(lights);
}

// The bell, hanging from its pivot at the origin.
export function bell() {
  const b = new Builder();
  b.box(-0.06, 0.06, -0.55, 0, -0.06, 0.06, 'dark', { faces: 'fblr', ground: false });
  b.lathe(0, 0, -2.45, [[1.0, 0], [0.93, 0.14], [0.72, 0.55], [0.6, 1.15], [0.52, 1.55], [0.3, 1.82], [0.1, 1.9]], 'bronze', 12, 1.25);
  b.lathe(0, 0, -2.47, [[1.02, 0], [1.02, 0.12]], 'gold', 12);
  b.lathe(0, 0, -1.4, [[0.61, 0], [0.61, 0.08]], 'gold', 12);
  b.lathe(0, 0, -2.75, [[0, 0], [0.16, 0.1], [0.16, 0.26], [0.03, 0.42]], 'iron', 6);
  return b.geometry();
}

// ── The pillared halls ──────────────────────────────────────────────────────────────────────────────────────────
// Wide and high, with little in them: a polished floor, one long carpet, a row of great columns down each side,
// tall doors between the columns, and rings of lamps hung from a coffered ceiling.
export const HALL_HALF = 9.6, HALL_PX = 6.3, HALL_TOP = 11.6, HALL_PILLARS = [-4, -12, -20], HALL_LAMPS = [-8, -16, -24], LAMP_AT = 7.4;
export function hallModule() {
  const b = new Builder(), o = { ground: false }, HW = HALL_HALF, PX = HALL_PX, TOP = HALL_TOP, lights = [];
  b.box(-HW, HW, -0.3, 0, -LEN, 0, 'pfloor', { ...o, faces: 't', shade: 1.05 });
  // the long carpet down the middle, edged in gold
  b.box(-3.72, 3.72, 0, 0.022, -LEN, 0, 'carpet', { ...o, faces: 't', shade: 0.42 });
  for (const s of [-1, 1]) b.box(Math.min(s * 3.72, s * 3.9), Math.max(s * 3.72, s * 3.9), 0, 0.03, -LEN, 0, 'lotus', { ...o, faces: 't', along: [0, 0, 1], tile: [2, 0.18] });
  for (const s of [-1, 1]) {
    const x = s * HW, inner = s > 0 ? 'l' : 'r';
    b.face([[x, 0, 0], [x, 0, -LEN], [x, TOP, -LEN], [x, TOP, 0]], 'pwall', [-s, 0, 0], { along: [0, 0, s], tile: [4, 4], shade: 0.8 });
    b.box(Math.min(x, x - s * 0.22), Math.max(x, x - s * 0.22), 0, 0.9, -LEN, 0, 'stone', { faces: inner + 't', tile: [1.8, 1.8], top: 'dark' });
    b.box(Math.min(x, x - s * 0.16), Math.max(x, x - s * 0.16), 7.4, 8.1, -LEN, 0, 'frieze', { ...o, faces: inner + 'td', tile: [2.8, 0.7], top: 'dark' });
    for (const z of HALL_LAMPS) if (z > -LEN + 1) { sideDoor(b, x - s * 0.05, s, z, 3.6, 6.4); lit(lights, x - s * 1.2, 3.4, z, 3.4, 0.35); }      // a great door in every bay
    for (const z of HALL_PILLARS) { column(b, s * PX, z, 0, 10.6, 1.3); wallLamp(b, lights, s * (PX - 0.66), 4.6, z, -s, 3.2, 0.5); }
    b.box(s * PX - 0.7, s * PX + 0.7, 10.6, TOP, -LEN, 0, 'frieze', { ...o, faces: 'lrd', tile: [4, 1] });
  }
  for (const z of HALL_PILLARS) b.box(-PX + 0.7, PX - 0.7, 10.75, TOP, z - 0.45, z + 0.45, 'frieze', { ...o, faces: 'fbd', tile: [3.4, 0.85] });
  // a ring of lamps over the middle of every bay
  for (const z of HALL_LAMPS) {
    const y = LAMP_AT, R = 1.5;
    b.lathe(0, z, y, [[R - 0.1, 0], [R + 0.1, 0.05], [R + 0.1, 0.2], [R - 0.1, 0.25]], 'gold', 16, 1.5);
    b.lathe(0, z, y - 0.5, [[0.05, 0], [0.4, 0.2], [0.45, 0.42]], 'bronze', 10, 1.3);
    b.lathe(0, z, y - 0.14, [[0.2, 0], [0.15, 0.25], [0, 0.7]], 'lamp', 6);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2, x = Math.cos(a) * R, zz = z + Math.sin(a) * R;
      b.lathe(x, zz, y + 0.22, [[0.1, 0], [0.08, 0.14], [0, 0.4]], 'lamp', 5);
      if (i % 2 === 0) for (const way of [-1, 1]) b.face([[x - 0.03, y + 0.2, zz], [x + 0.03, y + 0.2, zz], [0.03, TOP - 0.9, z], [-0.03, TOP - 0.9, z]], 'dark', [0, 0, way], o);
    }
    b.box(-0.04, 0.04, TOP - 0.9, TOP, z - 0.04, z + 0.04, 'dark', { ...o, faces: 'fblr' });
    lit(lights, 0, y - 1.2, z, 5.5, 0.55); lit(lights, 0, y + 1.6, z, 4.5, 0.5);
  }
  b.face([[-HW, TOP, 0], [HW, TOP, 0], [HW, TOP, -LEN], [-HW, TOP, -LEN]], 'pceil', [0, -1, 0], { ...o, along: [1, 0, 0], shade: 0.8 });
  return b.geometry(lights);
}

// The front of the palace, with its great doorway and the doors standing open. Also used for the walls that
// divide one hall from the next. It stands on z = 0 and is 1.2 m thick; the leaves open away from the court.
export const DOOR_HALF = 4.1, DOOR_HIGH = 8.2;
export function hallFront() {
  const b = new Builder(), o = { ground: false }, W = COURT_HALF, D = DOOR_HALF, H = DOOR_HIGH, T = 14.4, z0 = -1.2, lights = [];
  for (const s of [-1, 1]) {
    b.box(Math.min(s * D, s * W), Math.max(s * D, s * W), 0, T, z0, 0, 'pwall', { faces: 'fb' + (s > 0 ? 'l' : 'r'), tile: [4, 4] });
    for (const [za, zb, f] of [[0, 0.16, 'f'], [z0 - 0.16, z0, 'b']]) {
      b.box(Math.min(s * D, s * (D + 0.8)), Math.max(s * D, s * (D + 0.8)), 0, H + 0.9, za, zb, 'ppillar', { faces: f + 'lr', tile: [0.8, 1.6] });
      const lz = f === 'f' ? 0.3 : z0 - 0.3;
      b.lathe(s * (D + 1.9), lz, 3.4, [[0.03, 0], [0.16, 0.08], [0.17, 0.14]], 'bronze', 6, 1.2);
      b.lathe(s * (D + 1.9), lz, 3.52, [[0.07, 0], [0.055, 0.12], [0, 0.28]], 'lamp', 5);
      lit(lights, s * (D + 1.9), 3.7, f === 'f' ? 0.7 : z0 - 0.7, 3.4, 0.6);
    }
    // a door leaf, swung back against the passage, seen from both sides
    const leaf = [[s * D, 0, z0], [s * (D - 0.5), 0, z0 - 4.05], [s * (D - 0.5), H, z0 - 4.05], [s * D, H, z0]];
    for (const way of [-1, 1]) b.face(leaf, 'pdoor', [way * s, 0, 0], { ...o, fit: true, along: [0, 0, -way * s], shade: 0.9 });
  }
  b.box(-D, D, H, T, z0, 0, 'pwall', { ...o, faces: 'fbd', tile: [4, 4] });
  for (const [za, zb, f] of [[0, 0.2, 'f'], [z0 - 0.2, z0, 'b']]) b.box(-D - 0.8, D + 0.8, H, H + 0.9, za, zb, 'frieze', { ...o, faces: f + 'd', tile: [3.6, 0.9] });
  for (const x of [-9, -6, -3, 0, 3, 6, 9]) b.panel(x - 0.5, x + 0.5, 11.0, 12.6, 0.03, 'window');
  b.box(-W, W, T, T + 0.5, z0 - 0.2, 0.2, 'lotus', { ...o, faces: 'fbtd', tile: [4, 0.5], top: 'dark' });
  return b.geometry(lights);
}

// ── What stands in his way ──────────────────────────────────────────────────────────────────────────────────────
// A low banquet table laid with gold: leap it.
export function table() {
  const b = new Builder(), o = { ground: false };
  b.box(-1.05, 1.05, 0.72, 0.9, -0.55, 0.55, 'wood', { ...o, faces: 'fblrtd', tile: [1.6, 1.6] });
  for (const x of [-0.9, 0.9]) for (const z of [-0.42, 0.42]) b.box(x - 0.09, x + 0.09, 0, 0.72, z - 0.09, z + 0.09, 'gold', { faces: 'fblr' });
  b.box(-0.5, 0.5, 0.9, 0.915, -0.58, 0.58, 'crimson', { ...o, faces: 'tfb', shade: 1.3 });
  for (const z of [-0.58, 0.58]) b.box(-0.5, 0.5, 0.55, 0.915, z - 0.01, z + 0.01, 'crimson', { ...o, faces: 'fb', shade: 1.1 });
  b.lathe(-0.72, 0.1, 0.9, [[0.1, 0], [0.16, 0.12], [0.07, 0.3], [0.05, 0.42], [0.09, 0.46]], 'gold', 8, 1.5);           // a ewer
  b.lathe(0.7, -0.12, 0.9, [[0.06, 0], [0.22, 0.07], [0.24, 0.1]], 'gold', 8, 1.4);                                          // a dish
  b.lathe(0.05, 0.05, 0.915, [[0.07, 0], [0.03, 0.1], [0.11, 0.2], [0.12, 0.24]], 'gold', 8, 1.5);                           // a cup
  b.lathe(0.68, 0.22, 0.9, [[0.05, 0], [0.02, 0.08], [0.08, 0.16]], 'gold', 6, 1.3);
  return b.geometry();
}

// Lamps on a chain slung low across the lane: slide under.
export function lampChain() {
  const b = new Builder(), o = { ground: false }, lights = [];
  for (const x of [-1.1, 1.1]) b.box(x - 0.025, x + 0.025, 1.72, HALL_TOP - 0.7, -0.025, 0.025, 'dark', { ...o, faces: 'fblr' });
  b.box(-1.16, 1.16, 1.66, 1.74, -0.04, 0.04, 'gold', { ...o, faces: 'fbtd', shade: 1.3 });
  for (const x of [-0.7, 0, 0.7]) { hangLamp(b, x, 0, 1.66, 1.2, 0.62); lit(lights, x, 1.3, 0.4, 1.2, 0.6); }
  return b.geometry(lights);
}

// The stump of a broken column: go round.
export function drum() {
  const b = new Builder(), o = { ground: false };
  b.box(-0.72, 0.72, 0, 0.5, -0.72, 0.72, 'stone', { faces: 'fblrt', tile: [1.5, 1.5], top: 'dark' });
  b.box(-0.5, 0.5, 0.5, 1.2, -0.5, 0.5, 'ppillar', { faces: 'fblr', tile: [1, 2] });
  b.face([[-0.5, 1.2, 0.5], [0.5, 1.2, 0.5], [0.5, 1.6, -0.5], [-0.5, 1.6, -0.5]], 'dark', [0, 1, 0.2], { ...o, shade: 1.6 });      // the broken top
  b.face([[0.5, 1.2, 0.5], [0.5, 1.2, -0.5], [0.5, 1.6, -0.5]], 'ppillar', [1, 0, 0], { ...o, fit: true, shade: 0.8 });
  b.face([[-0.5, 1.2, -0.5], [-0.5, 1.2, 0.5], [-0.5, 1.6, -0.5]], 'ppillar', [-1, 0, 0], { ...o, fit: true, shade: 0.8 });
  b.face([[0.5, 1.2, -0.5], [-0.5, 1.2, -0.5], [-0.5, 1.6, -0.5], [0.5, 1.6, -0.5]], 'ppillar', [0, 0, -1], { ...o, fit: true });
  b.box(0.6, 1.05, 0, 0.4, 0.5, 0.95, 'ppillar', { faces: 'fblrt', tile: [0.5, 1], top: 'dark' });         // a fallen piece beside it
  return b.geometry();
}

// A rack of spears: go round.
export function rack() {
  const b = new Builder(), o = { ground: false };
  for (const x of [-0.95, 0.95]) { b.box(x - 0.07, x + 0.07, 0, 1.7, -0.07, 0.07, 'wood', { faces: 'fblrt' }); b.box(x - 0.1, x + 0.1, 0, 0.12, -0.45, 0.45, 'wood', { faces: 'fblrt' }); }
  for (const y of [0.5, 1.5]) b.box(-1.0, 1.0, y, y + 0.1, -0.05, 0.05, 'wood', { ...o, faces: 'fbtd', along: [0, 1, 0] });
  for (let i = 0; i < 6; i++) {
    const x = -0.75 + i * 0.3, lean = (i % 2 ? 0.12 : -0.12);
    b.face([[x - 0.022, 0, 0.14], [x + 0.022, 0, 0.14], [x + 0.022, 2.35, lean], [x - 0.022, 2.35, lean]], 'wood', [0, 0, 1], { ...o, fit: true, shade: 1.2 });
    b.face([[x - 0.022, 0, 0.14], [x + 0.022, 0, 0.14], [x + 0.022, 2.35, lean], [x - 0.022, 2.35, lean]], 'wood', [0, 0, -1], { ...o, fit: true, shade: 0.8 });
    b.spike([x, 2.33, lean], [0, 1, lean > 0 ? -0.06 : 0.06], 0.05, 0.36, 'gold', 1.5);
  }
  return b.geometry();
}

// The plate in the floor that hides the spikes, and the spikes that spring out of it.
export function spikePlate() {
  const b = new Builder(), o = { ground: false };
  b.box(-1.0, 1.0, 0, 0.025, -0.6, 0.6, 'iron', { ...o, faces: 't', shade: 1.2 });
  for (const [x0, x1, z0, z1] of [[-1.06, 1.06, 0.6, 0.67], [-1.06, 1.06, -0.67, -0.6], [-1.06, -1.0, -0.6, 0.6], [1.0, 1.06, -0.6, 0.6]]) b.box(x0, x1, 0, 0.035, z0, z1, 'gold', { ...o, faces: 't', shade: 1.2 });
  for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) b.box(-0.8 + i * 0.4 - 0.05, -0.8 + i * 0.4 + 0.05, 0.026, 0.03, -0.4 + j * 0.4 - 0.05, -0.4 + j * 0.4 + 0.05, 'dark', { ...o, faces: 't' });
  return b.geometry();
}
export function spikes() {
  const b = new Builder();
  for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) b.lathe(-0.8 + i * 0.4, -0.4 + j * 0.4, 0, [[0.085, 0], [0.05, 0.5], [0, 0.95]], (i + j) % 2 ? 'iron' : 'bronze', 5, (i + j) % 2 ? 1.5 : 0.9);
  return b.geometry();
}

// The spiked iron log dropped on those who storm the gates. It lies across one lane, centred on its own axis.
export function spikedLog() {
  const b = new Builder(), o = { ground: false }, R = 0.36, L = 1.2, N = 8;
  const at = a => [Math.cos(a) * R, Math.sin(a) * R];
  for (let i = 0; i < N; i++) {
    const [y0, z0] = at(i / N * Math.PI * 2), [y1, z1] = at((i + 1) / N * Math.PI * 2), my = (y0 + y1) / 2, mz = (z0 + z1) / 2;
    b.face([[-L, y0, z0], [L, y0, z0], [L, y1, z1], [-L, y1, z1]], 'iron', [0, my, mz], { ...o, shade: i % 2 ? 1.7 : 1.2 });
    for (const x of i % 2 ? [-0.9, -0.3, 0.3, 0.9] : [-0.6, 0, 0.6]) b.spike([x, my, mz], [0, my, mz], 0.07, 0.34, 'gold', 1.4);
  }
  for (const s of [-1, 1]) {
    b.face([...Array(N)].map((_, i) => [s * L, ...at(i / N * Math.PI * 2)]), 'bronze', [s, 0, 0], o);
    for (const x of [s * 0.55, s * 1.12]) for (let i = 0; i < N; i++) {      // bronze bands
      const [y0, z0] = at(i / N * Math.PI * 2).map(v => v * 1.06), [y1, z1] = at((i + 1) / N * Math.PI * 2).map(v => v * 1.06);
      b.face([[x - 0.06, y0, z0], [x + 0.06, y0, z0], [x + 0.06, y1, z1], [x - 0.06, y1, z1]], 'bronze', [0, y0 + y1, z0 + z1], { ...o, shade: 1.5 });
    }
  }
  return b.geometry();
}

// The locking beam of a great door, dropped across the doorway on its chains: slide under.
export function dropBeam() {
  const b = new Builder(), o = { ground: false }, D = DOOR_HALF - 0.05;
  b.box(-D, D, 0, 0.62, -0.3, 0.3, 'wood', { ...o, faces: 'fbtd', along: [0, 1, 0], tile: [1.6, 1.6], shade: 1.15 });
  for (const x of [-3.2, -1.2, 1.2, 3.2]) b.box(x - 0.14, x + 0.14, -0.03, 0.65, -0.33, 0.33, 'bronze', { ...o, faces: 'fbtd', shade: 1.5 });
  b.box(-D, D, -0.02, 0.0, -0.31, 0.31, 'gold', { ...o, faces: 'd', shade: 1.2 });
  for (const x of [-2.2, 2.2]) b.box(x - 0.035, x + 0.035, 0.62, 8.4, -0.035, 0.035, 'dark', { ...o, faces: 'fblr' });
  for (const x of [-2.4, 0, 2.4]) for (const z of [-0.31, 0.31]) b.lathe(x, z, 0.24, [[0.07, 0], [0.07, 0.14]], 'gold', 6, 1.6);
  return b.geometry();
}

// ── Places of the story ─────────────────────────────────────────────────────────────────────────────────────────
const ball = (r, n = 6) => Array.from({ length: n + 1 }, (_, i) => [Math.sin(i / n * Math.PI) * r, (1 - Math.cos(i / n * Math.PI)) * r]);

// Ravana's throne on its dais: three broad steps of marble with a runner up the middle, the seat between two
// carved arms, and behind it a high back of beaten gold between two columns. z: where the seat stands in its
// stretch; top: the height of the dais; seat: the height of the seat above it.
export function throneModule(z, top, seat, back = 6.3, tint = null) {      // back: how high the back of the throne stands above the dais; tint: a darker gold, where real fires stand close
  const b = new Builder(), o = { ground: false }, lights = [], T = top, rise = top / 3;
  if (tint) b.tint = tint;
  [[12, 7.6], [10, 6.2], [8, 4.9]].forEach(([w, d], i) => {
    const c = z + 1.6 - i * 0.2, y = i * rise, front = c + d / 2;
    b.box(-w / 2, w / 2, y, y + rise, c - d / 2, front, 'lotus', { ...o, faces: 'flr', tile: [2.4, rise], shade: 1.05 });
    b.box(-w / 2, w / 2, y, y + rise, c - d / 2, front, 'pfloor', { ...o, faces: 't', tile: [2.5, 2.5], shade: 1.15 });
    // the runner climbs the steps with him
    b.box(-1.9, 1.9, y + rise, y + rise + 0.012, c - d / 2 + (i === 2 ? d / 2 - 0.7 : 0), front + 0.012, 'carpet', { ...o, faces: 't', tile: [1.9, 1.9], shade: 0.75 });
    b.panel(-1.9, 1.9, y, y + rise + 0.012, front + 0.012, 'carpet', { fit: false, tile: [1.9, 1.9], shade: 0.6 });
    for (const s of [-1, 1]) b.box(Math.min(s * 1.9, s * 2.02), Math.max(s * 1.9, s * 2.02), y, y + rise + 0.016, front - 0.02, front + 0.016, 'gold', { ...o, faces: 'f', shade: 1.3 });
  });
  // the seat: a carved body, a slab of gold, a cushion
  b.box(-1.26, 1.26, T, T + seat - 0.2, z - 0.72, z + 0.74, 'frieze', { ...o, faces: 'flr', tile: [2.52, seat - 0.2], shade: 1.05 });
  b.box(-1.32, 1.32, T + seat - 0.2, T + seat, z - 0.78, z + 0.82, 'lotus', { ...o, faces: 'flrt', tile: [1.32, 0.2], top: 'gold', shade: 1.1 });
  b.box(-1.1, 1.1, T + seat, T + seat + 0.1, z - 0.66, z + 0.74, 'carpet', { ...o, faces: 'flrt', tile: [1.1, 1.1], shade: 0.95 });
  // the arms, each ending in a golden ball
  for (const s of [-1, 1]) {
    const x0 = Math.min(s * 1.26, s * 1.66), x1 = Math.max(s * 1.26, s * 1.66), y1 = T + seat + 0.56;
    b.box(x0, x1, T, y1 - 0.14, z - 0.78, z + 0.86, 'ppillar', { ...o, faces: 'flr', tile: [0.9, 1.8], shade: 1.05 });
    b.box(x0 - 0.04, x1 + 0.04, y1 - 0.14, y1, z - 0.82, z + 0.9, 'lotus', { ...o, faces: 'flrt', tile: [0.9, 0.14], top: 'gold', shade: 1.1 });
    b.lathe(s * 1.46, z + 0.72, y1, ball(0.21), 'gold', 12, 1.15);
    // a column on each side of the back, crowned with a finial
    column(b, s * 2.42, z - 0.92, T, T + back + 0.2, 0.62);
    b.finial(s * 2.42, z - 0.92, T + back + 0.2, 1.5);
  }
  // the high back: an arch of beaten gold, and over it a crown
  b.box(-2.05, 2.05, T, T + back, z - 1.16, z - 0.8, 'ppillar', { ...o, faces: 'lrb', tile: [0.9, 1.8], shade: 1.1 });
  b.panel(-2.05, 2.05, T, T + back, z - 0.8, 'pdoor', { shade: 1.05 });
  b.box(-2.3, 2.3, T + back, T + back + 0.42, z - 1.2, z - 0.72, 'frieze', { ...o, faces: 'flrtd', tile: [2.3, 0.42], top: 'gold', shade: 1.1 });
  b.box(-1.5, 1.5, T + back + 0.42, T + back + 0.7, z - 1.14, z - 0.78, 'lotus', { ...o, faces: 'flrt', tile: [1.5, 0.28], top: 'gold', shade: 1.15 });
  b.finial(0, z - 0.96, T + back + 0.7, 1.9);
  for (const s of [-1, 1]) b.finial(s * 1.2, z - 0.96, T + back + 0.7, 1.1);
  // the flames before the throne are painted into the gold
  lit(lights, 0, T + 3.2, z + 2.6, 5.5, 0.6);
  for (const s of [-1, 1]) { lit(lights, s * 5, 1.9, z + 5.6, 5, 0.8); lit(lights, s * 3, T + 1.6, z + 1.6, 3, 0.3); }
  return b.geometry(lights);
}

// A round seat of old stone with a carved rim. r: its radius; h: its height.
export function stoneSeat(r, h) {
  const b = new Builder(), N = 14, at = (k, rr, y) => [Math.cos(k / N * Math.PI * 2) * rr, y, Math.sin(k / N * Math.PI * 2) * rr], o = { ground: false, color: [0.74, 0.82, 1] };
  for (let k = 0; k < N; k++) {
    const m = (k + 0.5) / N * Math.PI * 2, out = [Math.cos(m), 0, Math.sin(m)], shade = 0.8 + 0.3 * Math.max(0, -out[0] * 0.6 + out[2] * 0.8);
    b.face([at(k, r - 0.05, 0), at(k + 1, r - 0.05, 0), at(k + 1, r - 0.05, h - 0.13), at(k, r - 0.05, h - 0.13)], 'stone', out, { ...o, tile: [1.4, 1.4], shade });
    b.face([at(k, r, h - 0.13), at(k + 1, r, h - 0.13), at(k + 1, r, h), at(k, r, h)], 'lotus', out, { ...o, fit: true, shade: shade * 0.95 });
    b.face([at(k, r - 0.05, h - 0.13), at(k + 1, r - 0.05, h - 0.13), at(k + 1, r, h - 0.13), at(k, r, h - 0.13)], 'dark', [0, -1, 0], o);
  }
  b.face(Array.from({ length: N }, (_, k) => at(k, r, h)), 'stone', [0, 1, 0], { ...o, tile: [1.4, 1.4], shade: 1.1 });
  return b.geometry();
}

// A low stone lantern for a garden path: a carved post, an open lamp house on four rods, a pointed cap. Its flame is lit by the place that sets it.
export function stoneLantern() {
  const b = new Builder(), o = { ground: false }; b.tint = [0.74, 0.82, 1];
  b.pillar(0, 0, 0, 1.05, 0.3, 'stone');
  for (const x of [-0.14, 0.14]) for (const z of [-0.14, 0.14]) b.box(x - 0.018, x + 0.018, 1.05, 1.36, z - 0.018, z + 0.018, 'dark', { ...o, faces: 'fblr', shade: 1.6 });
  b.box(-0.25, 0.25, 1.36, 1.41, -0.25, 0.25, 'lotus', { ...o, faces: 'fblrd', tile: [0.5, 0.05] });
  b.lathe(0, 0, 1.41, [[0.34, 0], [0.12, 0.2], [0, 0.34]], 'iron', 4, 1.5);
  return b.geometry();
}
