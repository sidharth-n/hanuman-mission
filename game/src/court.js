// Ravana's court: a great hall of black stone and gold. Wide enough for an army to stand in, so high that its roof
// is lost in the dark, a row of colossal carved pillars down each side, fire burning in bronze bowls along the aisle,
// and at its head, behind the throne, the wall where Shiva sits: Ravana is the greatest of his devotees.
// Built a 24 m stretch at a time from the same sheet of pictures as the palace, darkened; its firelight is painted in.
import { Builder } from './build.js';
import { LEN, COURT_HALF, DOOR_HIGH, DOOR_HALF } from './palace.js';

export const HALL = { half: 13.5, px: 9.2, top: 19, pillars: [-4, -12, -20], bowls: [-8, -16], bowlX: 5.4, bowlTop: 1.5, wall: -23.4, shivaZ: -19.3, seat: 2.3 };      // seat: the height of the stone Shiva sits on
const TORCH = [2.3, 1.0, 0.3];
const lit = (lights, x, y, z, reach, k = 1) => lights.push({ at: [x, y, z], color: TORCH.map(c => c * k), reach });
const DARK = [0.13, 0.14, 0.2], STONE = [0.22, 0.23, 0.3], GOLD = [0.95, 0.7, 0.34];

// A colossal pillar: a stone foot, a dark carved shaft, a spreading capital of gold.
function pillar(b, cx, cz, top, w = 2.1) {
  const h = w / 2, o = { ground: false };
  b.box(cx - h * 1.3, cx + h * 1.3, 0, 1.3, cz - h * 1.3, cz + h * 1.3, 'stone', { ...o, faces: 'fblrt', tile: [1.6, 1.6], top: 'dark', color: STONE });
  b.box(cx - h * 1.14, cx + h * 1.14, 1.3, 1.75, cz - h * 1.14, cz + h * 1.14, 'lotus', { ...o, faces: 'fblrt', tile: [w * 1.2, 0.45], top: 'dark', color: GOLD });
  b.box(cx - h, cx + h, 1.75, top - 2.6, cz - h, cz + h, 'ppillar', { ...o, faces: 'fblr', tile: [w, w * 2], color: DARK });
  b.box(cx - h * 1.06, cx + h * 1.06, 7.2, 7.75, cz - h * 1.06, cz + h * 1.06, 'frieze', { ...o, faces: 'fblrtd', tile: [w * 2.1, 0.55], top: 'dark', color: GOLD, shade: 0.8 });      // a band of gold round its waist
  b.box(cx - h * 1.2, cx + h * 1.2, top - 2.6, top - 2.0, cz - h * 1.2, cz + h * 1.2, 'lotus', { ...o, faces: 'fblrd', tile: [w * 1.25, 0.6], color: GOLD });
  b.box(cx - h * 1.5, cx + h * 1.5, top - 2.0, top - 1.2, cz - h * 1.5, cz + h * 1.5, 'frieze', { ...o, faces: 'fblrd', tile: [w * 1.5, 0.8], color: GOLD, shade: 0.9 });
}

// A bronze bowl of fire on its stand. The flame itself is lit by the place that sets it.
export function fireBowl(b, x, z, s = 1) {
  b.lathe(x, z, 0, [[0.5 * s, 0], [0.55 * s, 0.1 * s], [0.18 * s, 0.34 * s], [0.13 * s, 0.9 * s], [0.34 * s, 1.04 * s], [1.02 * s, 1.26 * s], [1.16 * s, 1.5 * s], [1.06 * s, 1.52 * s]], 'bronze', 14, 0.55);
  b.lathe(x, z, 0, [[0.98 * s, 1.43 * s], [0, 1.47 * s]], 'ember', 14, 1.6);
}

// One stretch of the hall. first: the stretch he comes in by (the wall round the palace doorway is carried up to this
// roof). throne: z of the throne, in the last stretch: there the carpet stops at the steps and the hall ends in the
// wall of Shiva, a tall niche of paler stone framed in gold.
export function greatHall({ first = false, throne = null } = {}) {
  const b = new Builder(), o = { ground: false }, { half: W, px: PX, top: TOP } = HALL, lights = [];
  const end = throne === null ? -LEN : throne + 5.4;      // where the carpet stops
  b.box(-W, W, -0.3, 0, -LEN, 0, 'pfloor', { ...o, faces: 't', color: [0.26, 0.26, 0.33] });
  b.box(-2.3, 2.3, 0, 0.022, end, 0, 'carpet', { ...o, faces: 't', shade: 0.62 });
  for (const s of [-1, 1]) b.box(Math.min(s * 2.3, s * 2.5), Math.max(s * 2.3, s * 2.5), 0, 0.03, end, 0, 'lotus', { ...o, faces: 't', along: [0, 0, 1], tile: [2, 0.2], color: GOLD });
  for (const s of [-1, 1]) {
    const x = s * W, inner = s > 0 ? 'l' : 'r';
    b.face([[x, 0, 0], [x, 0, -LEN], [x, TOP, -LEN], [x, TOP, 0]], 'stone', [-s, 0, 0], { ...o, along: [0, 0, s], tile: [3, 3], color: STONE });
    b.box(Math.min(x, x - s * 0.3), Math.max(x, x - s * 0.3), 0, 1.3, -LEN, 0, 'stone', { ...o, faces: inner + 't', tile: [1.8, 1.8], top: 'dark', color: STONE });
    b.box(Math.min(x, x - s * 0.2), Math.max(x, x - s * 0.2), 9.6, 10.5, -LEN, 0, 'frieze', { ...o, faces: inner + 'td', tile: [3.6, 0.9], top: 'dark', color: GOLD, shade: 0.7 });
    for (const z of HALL.pillars) {
      pillar(b, s * PX, z, TOP);
      b.box(Math.min(s * (PX + 1.4), x), Math.max(s * (PX + 1.4), x), TOP - 1.5, TOP, z - 0.5, z + 0.5, 'frieze', { ...o, faces: 'fbd', tile: [3.4, 1.5], color: STONE });      // a beam from pillar to wall
    }
    b.box(s * PX - 0.9, s * PX + 0.9, TOP - 1.2, TOP, -LEN, 0, 'frieze', { ...o, faces: 'lrd', tile: [4.8, 1.2], color: STONE });      // the beam that runs the length of the row
    for (const z of HALL.bowls) if (throne === null || z > throne + 6.5) { fireBowl(b, s * HALL.bowlX, z); lit(lights, s * HALL.bowlX, 2.6, z, 6, 0.75); }
  }
  for (const z of HALL.pillars) b.box(-PX + 1.4, PX - 1.4, TOP - 1.5, TOP, z - 0.5, z + 0.5, 'frieze', { ...o, faces: 'fbd', tile: [4.8, 1.5], color: STONE });      // and across the aisle
  b.face([[-W, TOP, 0], [W, TOP, 0], [W, TOP, -LEN], [-W, TOP, -LEN]], 'pceil', [0, -1, 0], { ...o, along: [1, 0, 0], color: [0.09, 0.09, 0.13] });
  if (first) {      // the palace front he came in by is lower and narrower than this hall: its wall is carried out and up
    for (const s of [-1, 1]) b.box(Math.min(s * COURT_HALF, s * W), Math.max(s * COURT_HALF, s * W), 0, TOP, -1.2, 0, 'stone', { ...o, faces: 'b', tile: [3, 3], color: STONE });
    b.box(-COURT_HALF, COURT_HALF, 14.4, TOP, -1.2, 0, 'stone', { ...o, faces: 'b', tile: [3, 3], color: STONE });
    b.box(-COURT_HALF, COURT_HALF, DOOR_HIGH + 0.9, 14.4, -1.22, -1.2, 'stone', { ...o, faces: 'b', tile: [3, 3], color: STONE });
    for (const s of [-1, 1]) b.box(Math.min(s * (DOOR_HALF + 0.8), s * COURT_HALF), Math.max(s * (DOOR_HALF + 0.8), s * COURT_HALF), 0, DOOR_HIGH + 0.9, -1.22, -1.2, 'stone', { ...o, faces: 'b', tile: [3, 3], color: STONE });
  }
  if (throne !== null) {
    const zw = HALL.wall, nw = 6.4, nh = 16.6, sz = HALL.shivaZ, sh = HALL.seat;
    // the stone he sits on, high enough that he is seen over the throne from anywhere in the hall
    b.box(-4.9, 4.9, 0, sh - 0.35, sz - 3.4, sz + 3.6, 'stone', { ...o, faces: 'flr', tile: [2.2, 2.2], color: [0.36, 0.36, 0.44] });
    b.box(-5.1, 5.1, sh - 0.35, sh, sz - 3.5, sz + 3.8, 'lotus', { ...o, faces: 'flrt', tile: [2.4, 0.35], top: 'dark', color: GOLD });
    b.face([[-W, 0, zw], [W, 0, zw], [W, TOP, zw], [-W, TOP, zw]], 'stone', [0, 0, 1], { ...o, tile: [3, 3], color: STONE });
    b.face([[-nw, 0, zw + 0.06], [nw, 0, zw + 0.06], [nw, nh, zw + 0.06], [-nw, nh, zw + 0.06]], 'stone', [0, 0, 1], { ...o, tile: [3, 3], color: [0.34, 0.34, 0.42] });      // the niche he sits in
    for (const s of [-1, 1]) b.box(Math.min(s * nw, s * (nw + 0.9)), Math.max(s * nw, s * (nw + 0.9)), 0, nh, zw, zw + 0.5, 'ppillar', { ...o, faces: 'f' + (s > 0 ? 'l' : 'r'), tile: [0.9, 1.8], color: GOLD, shade: 0.75 });
    b.box(-nw - 1.3, nw + 1.3, nh, nh + 1.3, zw, zw + 0.7, 'frieze', { ...o, faces: 'fd', tile: [5.2, 1.3], color: GOLD, shade: 0.85 });
    b.box(-nw - 0.5, nw + 0.5, nh + 1.3, nh + 1.8, zw, zw + 0.5, 'lotus', { ...o, faces: 'fd', tile: [3.6, 0.5], color: GOLD });
    // two great fires at his knees: they light him, the niche and the back of the throne
    for (const s of [-1, 1]) { fireBowl(b, s * 5, throne + 5.6); lit(lights, s * 5, 2.6, throne + 5.6, 6, 0.75); }      // a fire before the steps on each side
    for (const s of [-1, 1]) { fireBowl(b, s * 6.6, throne - 3.4, 1.35); lit(lights, s * 6.2, 3.4, throne - 3.6, 8, 1.0); lit(lights, s * 3, 8, zw + 3, 10, 0.35); }
  }
  return b.geometry(lights);
}

// The plinth a Nandi lies on, beside the steps of the dais.
export function plinth(w = 2.6, d = 4.6, h = 0.7) {
  const b = new Builder(), o = { ground: false };
  b.box(-w / 2, w / 2, 0, h - 0.18, -d / 2, d / 2, 'stone', { ...o, faces: 'fblr', tile: [1.6, 1.6], color: STONE });
  b.box(-w / 2 - 0.08, w / 2 + 0.08, h - 0.18, h, -d / 2 - 0.08, d / 2 + 0.08, 'lotus', { ...o, faces: 'fblrt', tile: [1.6, 0.18], top: 'dark', color: GOLD });
  return b.geometry();
}
