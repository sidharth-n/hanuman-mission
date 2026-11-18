// Lanka at night, laid out along his route in 24 m stretches that are built ahead of him and cleared behind:
// the city street, the moat bridge, the grand stairway, the palace court, the pillared halls.
import * as THREE from 'three';
import { LANES } from './hero.js';
import { rng } from './build.js';
import { kit, footpath, lampBeam, arrowVolley, greatArrow, streetGate, SLOT } from './buildings.js';
import * as palace from './palace.js';
import * as places from './places.js';
import ROUTE from './route.json';
import { speedAt, room, rollLead, REACT, MAX_SPEED } from './pace.js';

export const CHUNK = 24;
const GAP_AT = -12;      // where in a stretch of bridge the drawbridge is raised

// The route as a list of stretches: what kind of place each is, how high its floor starts, whether the city is burning yet.
function layout(route) {
  const list = [], marks = []; let base = 0;
  const add = (sec, kind, length, dir = 1, fire = false) => {
    const count = Math.round(length / CHUNK), from = list.length * CHUNK;
    for (let n = 0; n < count; n++) {
      const rise = kind === 'stairs' ? dir * palace.STAIR_RISE : 0, r = rng(list.length * 104729 + 7);
      // on the bridge the drawbridge is raised here and there: z of the middle of the gap, or null
      const gap = kind === 'bridge' && n > 0 && r() < 0.7 ? GAP_AT : null;
      list.push({ kind, sec: sec.id, n, of: count, from, base, rise, dir, fire, gap, rows: sec.rowGap > 0 }); base += rise;
    }
  };
  for (const sec of route.sections) {
    const from = list.length * CHUNK;
    if (sec.through) for (const t of sec.through) add(sec, t.kind, t.length, t.dir, true);
    else if (sec.kind) add(sec, sec.kind, sec.length);
    else continue;
    marks.push({ id: sec.id, name: sec.name, from, to: list.length * CHUNK, speed: sec.speed, fire: !!sec.through });
  }
  return { list, marks };
}
const { list: PLAN, marks: SECTIONS } = layout(ROUTE);
export { SECTIONS };
export const FIRE_AT = SECTIONS.find(s => s.fire).from, END_AT = PLAN.length * CHUNK;
// Where the grove and Ravana's court begin (metres along the route).
export const GROVE_AT = SECTIONS.find(s => s.id === 'grove').from, THRONE_AT = SECTIONS.find(s => s.id === 'throne').from;
// Where the run stops for the fight in the palace court, and the middle of the floor it is fought on (metres along the route).
export const FIGHT_AT = PLAN.findIndex(c => c.kind === 'court' && !c.fire && c.n === 3) * CHUNK + 4, FIGHT_MID = FIGHT_AT + 9;
const BEFORE = { kind: 'city', sec: 'gate', n: 0, of: 1, from: 0, base: 0, rise: 0, dir: 1, fire: false, gap: null, rows: false };
const last = PLAN[PLAN.length - 1], AFTER = { ...last, base: last.base + last.rise, rise: 0, n: 1, of: 3, rows: false };
const planAt = i => i < 0 ? BEFORE : PLAN[i] || AFTER;

// ── Where the rows of things in his way go ──
// Worked out once for the whole route from the pacing rule in pace.js, never by hand. Some rows cannot move (a raised
// drawbridge, the beam of a great doorway); the rest are laid down one after another, each as soon as the rule allows
// after the one before, and never so near a fixed row ahead that the rule would be broken there. On the stairway a row
// must stand on a landing. A row may hold things that roll toward him only if it has the extra road that costs.
const DOOR_EVERY = 5, ROLL = { vz: 5, from: 27 };
export const LANKINI_AT = 106, LANKINI_MID = 111;      // where Lankini stops him, a good run inside the gate (she is seen standing in the road from far off), and the middle of the floor they fight on
const FIGHT_N = 3;      // the stretch of the palace court where the guards make their stand
function placeRows() {
  // the speed the road is measured by: what he will have reached (in the grove too: he keeps his pace among the trees)
  const pace = d => speedAt(d);
  const rows = [], r = rng(977);
  const fixed = [];
  PLAN.forEach((c, i) => {
    if (c.fire || !c.rows) return;
    if (c.gap !== null) fixed.push({ d: i * CHUNK - c.gap, type: 'gap' });
    if (c.kind === 'hall' && c.n % DOOR_EVERY === 0) fixed.push({ d: i * CHUNK + 0.6, type: 'door' });
  });
  const allowed = d => {      // the first place at or after d where a free row may stand
    for (;;) {
      const i = Math.floor(d / CHUNK), c = planAt(i), s = d - i * CHUNK;
      if (i >= PLAN.length || c.fire) return Infinity;
      if (!c.rows) d = (i + 1) * CHUNK;
      else if (c.kind === 'stairs' && Math.abs(s - 13) > 0.01) d = s < 13 ? i * CHUNK + 13 : (i + 1) * CHUNK;      // the middle landing only
      else if (d < LANKINI_MID + 26) d = LANKINI_MID + 26;      // the street inside the gate is kept bare: Lankini bars the way there
      else if (c.kind === 'grove' && (c.n === 0 || (c.n >= places.HIDE.n && c.n <= places.SITA.n + 1) || (c.n === places.HIDE.n - 1 && s > 11) || c.n === c.of - 1 || (c.n === c.of - 2 && s > 12))) d = (i + 1) * CHUNK;      // none under the wall he comes in by, none from a little before the tree he hides behind to a little past Sita's seat, none where the snare takes him; beyond her seat the grove runs on, and he runs it with the guards behind him
      else if (c.kind === 'court' && c.n === 0 && s < 8) d = i * CHUNK + 8;      // clear of the bell gate
      else if (c.kind === 'court' && ((c.n === FIGHT_N - 1 && s > 14) || c.n === FIGHT_N)) d = (i + 1) * CHUNK + 10;      // the floor where the guards make their stand is kept bare, and the road they come in by
      else if (c.kind === 'court' && c.n === FIGHT_N + 1 && s < 10) d = i * CHUNK + 10;
      else return d;
    }
  };
  let prev = -Infinity, f = 0, n = 0;
  for (;;) {
    const next = fixed[f];
    // every other row on the stairway asks for the extra road that lets it roll
    let want = isFinite(prev) ? prev + room(pace(prev + 30)) : 0;      // at the speed he will have reached by then, not the speed he has now
    if (isFinite(prev) && planAt(Math.floor(want / CHUNK)).kind !== 'grove') want = prev + room(speedAt(prev + 30));      // (the grove's slower measure only for rows that stand in the grove)
    let d = allowed(want + (isFinite(prev) && planAt(Math.floor(want / CHUNK)).kind === 'city' ? r() * 3 : 0));
    const kind = d < Infinity ? planAt(Math.floor(d / CHUNK)).kind : null;
    let roll = false;
    if (kind === 'stairs' && n % 2 === 0) { const need = prev + room(pace(d)) + rollLead(pace(d), ROLL.vz, ROLL.from); roll = true; if (d < need) d = allowed(need); }
    if (next && d + room(pace(next.d)) > next.d) { rows.push({ d: next.d, type: next.type }); prev = next.d; f++; continue; }      // too near the fixed row ahead: that one comes next
    if (d === Infinity) { if (next) { rows.push({ d: next.d, type: next.type }); prev = next.d; f++; continue; } break; }
    rows.push({ d, type: 'free', roll: roll && planAt(Math.floor(d / CHUNK)).kind === 'stairs' }); prev = d; n++;
  }
  // the rule, checked: no row closer to the one before than the road he needs at that speed
  for (let k = 1; k < rows.length; k++) {
    const a = rows[k - 1], b = rows[k], need = room(pace(b.d)) + (b.roll ? rollLead(pace(b.d), ROLL.vz, ROLL.from) : 0);
    if (b.d - a.d < need - 0.01) console.error(`rows too close at ${b.d.toFixed(1)} m: ${(b.d - a.d).toFixed(1)} m, needs ${need.toFixed(1)} m`);
  }
  const by = new Map();
  for (const row of rows) { const i = Math.floor(row.d / CHUNK); if (!by.has(i)) by.set(i, []); by.get(i).push({ ...row, z: i * CHUNK - row.d }); }
  return { rows, by };
}
const { rows: ROW_LIST, by: ROWS_BY } = placeRows();
export { ROW_LIST };

// How high the floor is at any point along the route.
export function groundAt(z) {
  const d = -z, i = Math.floor(d / CHUNK), c = planAt(i);
  const s = d - i * CHUNK;
  return c.kind === 'stairs' ? c.base + c.dir * palace.stairHeight(s) : c.gap !== null ? c.base + palace.leafHeight(s + c.gap) : c.base;
}
const ROAD = 3.9;        // half width of the paved road (three lanes)
const FRONT = 6.2;       // distance from the centre line to the house fronts
const AHEAD = 4;

// name -> [height in metres, extra yaw so the front faces +Z]
const KIT = {
  'market-stall': [2.7, 0],
  'rakshasa-statue': [4.6, 0], 'brazier': [2.3, 0], 'cart': [1.75, 0], 'pots': [1.05, 0], 'barricade': [1.15, 0],
  'palace': [70, 0], 'courtier': [1.95, 0], 'shiva': [12.5, 0], 'nandi': [2.7, 0],
};

// rows of obstacles across the three lanes; every row leaves a way through
const ROWS = [
  ['pots', null, null], [null, 'pots', null], [null, null, 'pots'],
  ['cart', null, 'pots'], ['pots', null, 'cart'], ['cart', 'cart', null], [null, 'cart', 'cart'], ['cart', null, 'cart'],
  ['barricade', 'barricade', 'barricade'], ['beam', 'beam', 'beam'], ['barricade', 'cart', 'barricade'],
  ['beam', 'cart', 'beam'], [null, 'barricade', 'cart'], ['cart', 'beam', null],
  ['arrows', null, null], [null, null, 'arrows'], ['arrows', 'arrows', null], [null, 'arrows', 'arrows'], ['arrows', 'pots', 'arrows'], ['cart', 'arrows', null],
];
// what each place puts in his way
const POOLS = {
  grove: [['root', null, null], [null, 'root', null], [null, null, 'root'], ['root', 'root', 'root'], ['bough', 'bough', 'bough'], ['rock', null, 'rock'], ['rock', 'root', null], [null, 'root', 'rock'],
    ['rock', null, null], [null, null, 'rock'], ['bough', 'rock', 'bough'], ['root', 'rock', 'root']],
  city: ROWS,
  bridge: [['stone', null, null], [null, 'stone', null], [null, null, 'stone'], ['stone', null, 'stone'], ['arrows', null, 'arrows'], ['arrows', 'arrows', null], [null, 'arrows', 'arrows'],
    ['cart', null, 'pots'], ['pots', null, 'cart'], ['barricade', 'barricade', 'barricade'], [null, 'cart', 'stone'], ['stone', 'cart', null], ['pots', 'stone', 'pots']],
  stairs: [['boulder', null, null], [null, 'boulder', null], [null, null, 'boulder'], ['boulder', null, 'boulder'], ['log', 'log', null], [null, 'log', 'log'], ['rack', null, 'rack'],
    ['rack', 'boulder', null], [null, 'boulder', 'rack'], ['barricade', 'barricade', 'barricade'], ['pots', null, 'pots'], ['log', 'log', 'log']],
  court: [['rack', null, null], [null, null, 'rack'], ['drum', null, 'rack'], ['rack', null, 'drum'], ['spikes', 'spikes', 'spikes'], ['spikes', 'drum', 'spikes'], ['arrows', 'arrows', null], [null, 'arrows', 'arrows'],
    ['beam', 'beam', 'beam'], ['drum', 'spikes', null], [null, 'spikes', 'drum'], ['pots', 'barricade', 'pots'], ['drum', null, 'drum']],
  hall: [['table', null, null], [null, 'table', null], ['table', 'table', 'table'], ['chain', 'chain', 'chain'], ['chain', 'drum', 'chain'], ['drum', null, 'drum'], ['drum', 'drum', null], [null, 'drum', 'drum'],
    ['spikes', 'spikes', 'spikes'], ['spikes', 'table', 'spikes'], ['rack', 'table', null], [null, 'table', 'rack'], ['arrows', 'table', 'arrows'], ['rack', 'chain', 'rack']],
};
const KIND = { root: 'low', bough: 'high', rock: 'block', pots: 'low', barricade: 'low', cart: 'block', beam: 'high', arrows: 'block', stone: 'block', boulder: 'low', log: 'low', rack: 'block', drum: 'block',
  spikes: 'low', table: 'low', chain: 'high', door: 'high', gap: 'gap' };
const TOP = { root: 0.95, bough: 0, rock: 2.5, pots: 1.0, barricade: 1.1, cart: 1.55, arrows: 1.25, beam: 0, stone: 1.45, boulder: 1.24, log: 1.3, rack: 2.7, drum: 1.6, spikes: 0.9, table: 0.95, chain: 0, door: 0, gap: 0 };      // how high each stands
const HALF_DEPTH = { root: 0.5, bough: 0.35, rock: 0.75, pots: 0.6, barricade: 0.55, cart: 1.25, beam: 0.35, arrows: 0.7, stone: 0.8, boulder: 0.6, log: 0.55, rack: 0.4, drum: 0.7, spikes: 0.65, table: 0.6, chain: 0.3, door: 0.4, gap: palace.GAP_HALF };
// speed toward him, how far ahead it starts, how high it rides. They start late, so that they meet him well past the row before.
const MOVING = { boulder: { ...ROLL, up: 0.62 }, log: { ...ROLL, vz: 4.5, up: 0.72 } };
const SHARP = { spikes: true, boulder: true, log: true };      // nothing to land on
const ARROWS_FROM = 34, ARROW_SKY = 16;      // metres ahead of him at which a volley is loosed; height it falls from
const SPIKES_FROM = MAX_SPEED * (REACT + 0.7), DOOR_FROM = 34, DOOR_UP = 7.4, DOOR_LOW = 1.35;      // when the floor spikes spring and the door beam drops; where the beam hangs before and after

function canvasTexture(size, draw) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function glowTexture(inner, outer) {
  return canvasTexture(128, (g, s) => {
    const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    r.addColorStop(0, inner); r.addColorStop(0.35, outer); r.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = r; g.fillRect(0, 0, s, s);
  });
}

const PANO_TURN = Math.PI / 2;      // how far the panorama is turned about the upright, so that what it shows ahead is ahead on the road
export class World {
  // opt.lite: plain shading and one torch, for phones. opt.bare: nothing in his way, for looking round the world.
  constructor(scene, models, tex, opt = {}) {
    this.scene = scene; this.lite = !!opt.lite; this.bare = !!opt.bare;
    const Solid = this.lite ? THREE.MeshLambertMaterial : THREE.MeshStandardMaterial, pbr = this.lite ? {} : { roughness: 0.9, metalness: 0 };
    // every building shares one material and one texture sheet
    for (const t of [tex.city, tex.glow, tex.paving]) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; }
    this.cityMat = new Solid({ map: tex.city, emissiveMap: tex.glow, emissive: 0xffffff, emissiveIntensity: 1.25, vertexColors: true, ...pbr });
    if (!this.lite) this.cityMat.envMapIntensity = 0.5;
    this.kit = kit();
    this.houses = this.kit.filter(k => k.type === 'house'); this.towers = this.kit.filter(k => k.type === 'tower');
    this.courtyard = this.kit.find(k => k.type === 'court');
    this.footGeo = footpath(CHUNK, ROAD, FRONT + 0.75);
    this.beamGeo = lampBeam(); this.arrowGeo = arrowVolley(); this.boltGeo = greatArrow(); this.gateGeo = streetGate();
    // the palace and the way up to it, built once and set down wherever the route calls for them
    this.geo = {
      bridge: { none: palace.bridgeModule(), gap: palace.bridgeModule(GAP_AT) },
      stairs: { 1: palace.stairsModule(1), [-1]: palace.stairsModule(-1) },
      court: palace.courtModule(), gate: palace.bellGate(), bell: palace.bell(), hall: palace.hallModule(), front: palace.hallFront(), frontShut: palace.hallFront(true),
      table: palace.table(), chain: palace.lampChain(), drum: palace.drum(), rack: palace.rack(), plate: palace.spikePlate(), spikes: palace.spikes(),
      log: palace.spikedLog(), door: palace.dropBeam(),
    };
    // a great rough stone, for rolling down the stairs and for the engines on the walls to hurl
    const rock = new THREE.IcosahedronGeometry(0.62, 1), at = rock.attributes.position, bump = rng(41), seen = new Map();
    for (let i = 0; i < at.count; i++) {
      const key = [at.getX(i), at.getY(i), at.getZ(i)].map(v => v.toFixed(3)).join();
      if (!seen.has(key)) seen.set(key, 0.86 + bump() * 0.26);      // the same push for every copy of a corner, so no cracks open
      const k = seen.get(key); at.setXYZ(i, at.getX(i) * k, at.getY(i) * k, at.getZ(i) * k);
    }
    rock.computeVertexNormals();
    this.rockGeo = rock; this.rockMat = new Solid({ color: 0x5b5148, flatShading: true, ...pbr });
    this.markMat = new THREE.MeshBasicMaterial({ map: glowTexture('rgba(255,90,40,0.55)', 'rgba(255,60,20,0.2)'), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
    this.markGeo = new THREE.CircleGeometry(1.15, 20).rotateX(-Math.PI / 2);
    this.prefabs = {};
    for (const [name, [height, yaw]] of Object.entries(KIT)) if (models[name]) this.prefabs[name] = this.prefab(models[name].scene, height, yaw);

    const map = tex.paving; map.wrapS = map.wrapT = THREE.MirroredRepeatWrapping; map.repeat.set(2 * ROAD / 4, CHUNK / 4);
    this.roadMat = new Solid({ map, color: 0xb9ad9f, ...pbr });
    this.sideMat = new Solid({ color: 0x14110e, ...pbr });
    this.roadGeo = new THREE.PlaneGeometry(2 * ROAD, CHUNK).rotateX(-Math.PI / 2);
    this.sideGeo = new THREE.PlaneGeometry(26, CHUNK).rotateX(-Math.PI / 2);
    // the moat: dark water that catches the sky, the far bank, and other bridges away to either side
    this.waterMat = this.lite ? new THREE.MeshLambertMaterial({ color: 0x0a1930 }) : new THREE.MeshStandardMaterial({ color: 0x0a1930, roughness: 0.22, metalness: 0.75, envMapIntensity: 2.4 });
    this.waterGeo = new THREE.PlaneGeometry(320, CHUNK).rotateX(-Math.PI / 2);
    this.farBridgeGeo = new THREE.BoxGeometry(3.2, 1.3, CHUNK);
    this.bankGeo = new THREE.PlaneGeometry(320, 26);

    this.flameTex = glowTexture('rgba(255,244,190,1)', 'rgba(255,130,30,0.85)');
    this.flameMat = new THREE.SpriteMaterial({ map: this.flameTex, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    this.poolMat = new THREE.MeshBasicMaterial({ map: glowTexture('rgba(255,150,60,0.32)', 'rgba(255,110,30,0.12)'), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
    this.poolGeo = new THREE.CircleGeometry(4.4, 20).rotateX(-Math.PI / 2);      // kept small: big see-through discs are what phones draw slowest
    // the wind to gather for flight: a pale spinning swirl
    this.windMat = new THREE.SpriteMaterial({ depthWrite: false, blending: THREE.AdditiveBlending, map: canvasTexture(128, (g, s) => {
      const glow = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      glow.addColorStop(0, 'rgba(210,245,255,0.9)'); glow.addColorStop(0.3, 'rgba(120,210,255,0.35)'); glow.addColorStop(1, 'rgba(80,160,255,0)');
      g.fillStyle = glow; g.fillRect(0, 0, s, s); g.strokeStyle = 'rgba(235,250,255,0.95)'; g.lineWidth = 5; g.lineCap = 'round';
      for (let arm = 0; arm < 3; arm++) { g.beginPath(); for (let t = 0; t <= 1.001; t += 0.05) { const a = arm * 2.094 + t * 3.6, rad = s * (0.07 + t * 0.33); g.lineTo(s / 2 + Math.cos(a) * rad, s / 2 + Math.sin(a) * rad); } g.stroke(); }
    }) });
    // what he collects: small oil lamps, each a single picture that always faces the camera
    this.lampMat = new THREE.SpriteMaterial({ depthWrite: false, map: canvasTexture(128, (g, s) => {
      const glow = g.createRadialGradient(s / 2, s * 0.42, 0, s / 2, s * 0.42, s * 0.5);
      glow.addColorStop(0, 'rgba(255,190,90,0.75)'); glow.addColorStop(0.45, 'rgba(255,130,30,0.28)'); glow.addColorStop(1, 'rgba(255,110,20,0)');
      g.fillStyle = glow; g.fillRect(0, 0, s, s);
      g.fillStyle = '#c9902e'; g.beginPath(); g.ellipse(s / 2, s * 0.66, s * 0.2, s * 0.11, 0, 0, Math.PI); g.fill();      // the bowl
      g.fillStyle = '#f2c35a'; g.fillRect(s * 0.3, s * 0.64, s * 0.4, s * 0.035);
      const flame = (w, h, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(s / 2, s * 0.64 - h); g.bezierCurveTo(s / 2 + w, s * 0.64 - h * 0.45, s / 2 + w * 0.8, s * 0.64, s / 2, s * 0.64); g.bezierCurveTo(s / 2 - w * 0.8, s * 0.64, s / 2 - w, s * 0.64 - h * 0.45, s / 2, s * 0.64 - h); g.fill(); };
      flame(s * 0.13, s * 0.4, '#ff9a2a'); flame(s * 0.08, s * 0.28, '#ffe08a'); flame(s * 0.04, s * 0.16, '#fffbe6');
    }) });

    this.torches = [new THREE.PointLight(0xff8a3c, 0, 26, 1.6)]; if (!this.lite) this.torches.push(new THREE.PointLight(0xff8a3c, 0, 26, 1.6));
    this.torches.forEach(l => scene.add(l));
    this.sky(models, tex.sky);
    // the far end of a hall: darkness, so that the night sky never shows through the palace
    this.cap = new THREE.Mesh(new THREE.PlaneGeometry(2 * palace.HALL_HALF, palace.HALL_TOP), new THREE.MeshBasicMaterial({ color: 0x000000, fog: false }));
    this.cap.visible = false; scene.add(this.cap);
    this.keep = new Set();      // stretches built and kept wherever he is (the grove, for a cut back to Sita from the far end of the route)
    this.behind = 3;      // how many stretches to keep behind him (more on the title screen, which looks back)
    this.chunks = new Map();
    this.ready = new Map();      // the heavy stretches (the grove, Ravana's court), built before the run and kept until he comes to them
    this.time = 0;
    this.onBell = null;      // called when the alarm bell starts to ring
    this.onSound = null;      // called with a name when something in the road makes itself heard: 'fireball' | 'spikes' | 'beam' | 'stone' | 'smash'
  }

  // Centre a model on its footprint, stand it on the ground and scale it to a real-world height.
  prefab(src, height, yaw) {
    src.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(src);
    const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    src.position.set(-c.x, -box.min.y, -c.z);
    const inner = new THREE.Group(); inner.add(src); inner.scale.setScalar(height / size.y); inner.rotation.y = yaw;
    src.traverse(o => {
      if (!o.isMesh) return;
      if (this.lite) o.material = new THREE.MeshLambertMaterial({ map: o.material.map });
      else { o.material.envMapIntensity = 0.5; o.material.metalness = Math.min(o.material.metalness, 0.45); }
    });
    const holder = new THREE.Group(); holder.add(inner);
    holder.userData.size = size.multiplyScalar(height / size.y);
    return holder;
  }

  // Everything the run will ever show is drawn once, out of sight, before it starts: its shaders are built and its
  // pictures handed to the graphics chip, so nothing has to be prepared in the middle of a jump.
  warm(renderer, camera) {
    const g = new THREE.Group();
    for (const name of Object.keys(this.prefabs)) g.add(this.spawn(name));
    for (const m of [this.cityMat, this.roadMat, this.sideMat, this.waterMat, this.rockMat, this.markMat, this.poolMat]) g.add(new THREE.Mesh(this.markGeo, m));
    for (const m of [this.flameMat, this.windMat, this.lampMat]) g.add(new THREE.Sprite(m));
    this.scene.add(g); renderer.compile(this.scene, camera);
    g.traverse(o => { const m = o.material; if (m) for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap']) if (m[k]) renderer.initTexture(m[k]); });
    this.gl = [renderer, camera]; this.settle(renderer, camera, true);
    this.scene.remove(g);
  }

  // The stretches built ahead are drawn once in a single dot of the picture, nothing left out for being out of view:
  // their shapes and pictures reach the graphics chip now and not as he comes to them. A surface is shaded by a
  // program made for the number of lamps burning, and Ravana's hall brings two of its own; so all of it is drawn
  // twice, once as the streets are lit and once as his hall is. Made in the middle of the run, those programs held
  // the game still a few steps inside the grove, where his hall first comes into range. Behind the loading screen
  // (`all`) everything put away for later is drawn with them: the cast, the wall that closes a hall, the burning city.
  settle(renderer, camera, all = false) {
    const halls = [...this.ready.values()].map(c => c.group), lamps = h => { let n = 0; h.traverse(o => { if (o.isLight) n++; }); return n; };
    const hid = [], cut = [];
    for (const root of all ? [...halls, this.scene] : halls) root.traverse(o => {
      if (o.isLight) return;
      if (!o.visible) { hid.push(o); o.visible = true; }
      if (o.frustumCulled) { cut.push(o); o.frustumCulled = false; }
    });
    renderer.setScissor(0, 0, 1, 1); renderer.setScissorTest(true);
    for (const h of halls) if (!lamps(h)) this.scene.add(h);
    renderer.render(this.scene, camera);
    for (const h of halls) if (lamps(h)) this.scene.add(h);
    renderer.render(this.scene, camera);
    renderer.setScissorTest(false);
    for (const h of halls) this.scene.remove(h);
    for (const o of hid) o.visible = false;
    for (const o of cut) o.frustumCulled = true;
  }

  spawn(name) { const o = this.prefabs[name].clone(); o.userData = this.prefabs[name].userData; o.spawned = name; return o; }
  part(geo) { return new THREE.Mesh(geo, this.cityMat); }

  sky(models, picture) {
    const far = new THREE.Group(); this.far = far; this.scene.add(far);
    // the galaxy: one picture spread over the half of the sky ahead and mirrored behind, from just below the horizon to high overhead
    // or a whole panorama (twice as wide as it is high: the night over Lanka, made with Aholo's world model, SpatialGen):
    // laid once round the whole sky, its horizon on ours, turned so that the palace on its hill stands ahead
    const pano = picture.image && picture.image.width / picture.image.height > 1.9;
    picture.colorSpace = THREE.SRGBColorSpace; picture.wrapS = pano ? THREE.RepeatWrapping : THREE.MirroredRepeatWrapping; picture.wrapT = THREE.ClampToEdgeWrapping;
    if (!pano) { picture.repeat.set(2, 2.4); picture.offset.set(0, -1.133); }
    this.skyMat = new THREE.MeshBasicMaterial({ map: picture, side: THREE.BackSide, fog: false, depthWrite: false });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(560, 48, 24), this.skyMat); dome.renderOrder = -2; dome.rotation.y = pano ? PANO_TURN : 0; this.dome = dome; this.pano = pano; this.panoDim = 0.32; far.add(dome);
    const lights = new THREE.Group(); this.heavens = lights; far.add(lights);      // moon and stars: put out while he is indoors
    const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,255,245,1)', 'rgba(190,205,255,0.35)'), fog: false, depthWrite: false }));
    moon.scale.setScalar(60); moon.position.set(46, 92, -260); lights.add(moon);
    const disc = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xf6f3e4, fog: false, depthWrite: false, map: canvasTexture(64, (g, s) => { g.fillStyle = '#fff'; g.beginPath(); g.arc(s / 2, s / 2, s / 2 - 2, 0, 7); g.fill(); }) }));
    disc.scale.setScalar(15); disc.position.copy(moon.position); lights.add(disc);
    if (pano) moon.visible = disc.visible = false;      // the panorama has its own moon, over its own sea
    if (this.prefabs.palace) {
      const hill = new THREE.Group(); this.hill = hill; far.add(hill);      // the palace on its hill, always ahead until he reaches it
      const p = this.spawn('palace');
      p.traverse(o => { if (o.isMesh) o.material = new THREE.MeshBasicMaterial({ map: o.material.map, color: 0x8f7a5c, fog: false }); });
      p.position.set(0, 6, -235); hill.add(p);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(150, 46, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0x0a0d18, fog: false }));
      cone.position.set(0, -15, -240); hill.add(cone);
    }
    const r = rng(5), pts = [];
    for (let i = 0; i < 160; i++) { const a = r() * Math.PI * 2, h = 0.08 + r() * 0.9, d = 380; pts.push(Math.cos(a) * d * Math.cos(h), d * Math.sin(h), Math.sin(a) * d * Math.cos(h)); }
    // a few bright stars that twinkle, in two sets out of step with each other
    this.twinkle = [0, 1].map(n => {
      const part = new THREE.BufferGeometry(); part.setAttribute('position', new THREE.Float32BufferAttribute(pts.filter((_, j) => Math.floor(j / 3) % 2 === n), 3));
      const m = new THREE.PointsMaterial({ color: n ? 0xfff0d8 : 0xd6e2ff, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8, depthWrite: false });
      lights.add(new THREE.Points(part, m)); return m;
    });
  }

  flame(chunk, x, y, z, base, seed = Math.random() * 10, parent = chunk.group) {
    const f = new THREE.Sprite(this.flameMat); f.position.set(x, y, z); f.scale.setScalar(1.9 * base);
    f.userData.seed = seed; f.userData.base = base; parent.add(f); chunk.flames.push(f);
    return f;
  }

  // A brazier with its flame and the pool of light at its foot. floor: the height it stands on; lift: a kerb under it.
  brazier(chunk, x, floor, z, seed, lift = 0) {
    const g = chunk.group, b = this.spawn('brazier'); b.position.set(x, floor + lift, z); g.add(b);
    this.flame(chunk, x, floor + lift + 2.75, z, 1, seed);
    const pool = new THREE.Mesh(this.poolGeo, this.poolMat); pool.position.set(x * 0.8, floor + 0.02, z); g.add(pool);
    chunk.braziers.push(new THREE.Vector3(x, g.position.y + floor + lift + 2.76, g.position.z + z));
  }

  // A volley from the walls: a red mark on the lane first, then it drops from the sky as he comes near.
  // shape: 'arrows' (a clutch of burning arrows), 'bolt' (one great burning bolt) or 'stone' (hurled by an engine).
  volley(chunk, x, y, z, shape) {
    const g = chunk.group, o = shape === 'stone' ? new THREE.Mesh(this.rockGeo, this.rockMat) : this.part(shape === 'bolt' ? this.boltGeo : this.arrowGeo);
    if (shape === 'stone') o.scale.set(1.25, 1.1, 1.2);
    o.visible = false;
    const mark = new THREE.Mesh(this.markGeo, this.markMat); mark.position.set(x, y + 0.03, z); g.add(mark);
    let fire = null;
    if (shape !== 'stone') { fire = this.flame(chunk, x, y + (shape === 'bolt' ? 1.3 : 0.75), z - 0.2, shape === 'bolt' ? 1.5 : 0.8, x + z); fire.visible = false; }
    return [o, { type: 'volley', mesh: o, fire, shape, rest: y + (shape === 'stone' ? 0.66 : 0), t: -1 }];
  }

  // One thing in his way. Returns the piece to place, and how it comes alive if it does.
  piece(chunk, type, x, y, z, r) {
    const g = chunk.group;
    switch (type) {
      case 'root': case 'bough': case 'rock': return [places.hurdle(this, type, r)];      // the grove's own
      case 'beam': return [this.part(this.beamGeo)];
      case 'arrows': return this.volley(chunk, x, y, z, r() < 0.35 ? 'bolt' : 'arrows');
      case 'stone': return this.volley(chunk, x, y, z, 'stone');
      case 'table': case 'drum': case 'rack': case 'chain': { const o = this.part(this.geo[type]); if (type === 'drum') o.rotation.y = Math.floor(r() * 4) * Math.PI / 2; return [o]; }
      case 'spikes': {      // hidden in the floor until he is almost on them
        const plate = this.part(this.geo.plate); plate.position.set(x, y, z); g.add(plate);
        return [this.part(this.geo.spikes), { type: 'rise', y, t: -1 }, true];
      }
      case 'boulder': return [new THREE.Mesh(this.rockGeo, this.rockMat), { type: 'roll', ...MOVING.boulder, t: -1 }];
      case 'log': return [this.part(this.geo.log), { type: 'roll', ...MOVING.log, t: -1 }];
      default: { const o = this.spawn(type); if (type === 'pots') o.rotation.y = r() * 6.3; return [o]; }
    }
  }

  build(i) {
    const c = planAt(i), g = new THREE.Group(); g.position.set(0, c.base, -i * CHUNK);
    const chunk = { i, plan: c, group: g, obstacles: [], coins: [], winds: [], braziers: [], buildings: [], flames: [], live: [], bell: null, gap: null };
    chunk.gy = z => groundAt(g.position.z + z) - c.base;      // height of the floor inside this stretch
    const r = rng(i * 7919 + 13);
    this[c.kind](chunk, c, r);
    if (c.rows) this.populate(chunk, c, r);
    this.scene.add(g);
    return chunk;
  }

  // ── the places ──
  city(chunk, c, r) {
    const g = chunk.group, i = chunk.i;
    const road = new THREE.Mesh(this.roadGeo, this.roadMat); road.position.z = -CHUNK / 2; g.add(road);
    for (const s of [-1, 1]) { const side = new THREE.Mesh(this.sideGeo, this.sideMat); side.position.set(s * (ROAD + 13), -0.01, -CHUNK / 2); g.add(side); }
    g.add(this.part(this.footGeo));
    for (const s of [-1, 1]) {
      const face = s < 0 ? Math.PI / 2 : -Math.PI / 2;      // fronts face the street
      const stall = r() < 0.55 ? Math.floor(r() * 4) : -1;
      let last = -1;
      for (let k = 0; k < CHUNK / SLOT; k++) {
        const z = -SLOT / 2 - k * SLOT, statue = i % 4 === 1 && k === 1;
        let b;
        do {
          b = statue ? this.courtyard : r() < 0.2 ? this.towers[Math.floor(r() * this.towers.length)] : this.houses[Math.floor(r() * this.houses.length)];
        } while (!statue && (b.id === last || (k === stall && b.veranda)));
        last = b.id;
        // the brazier stands at one corner of every slot: use the version of the building lit from that corner
        const further = k % 2 === 0, lit = (s < 0) === further ? 1 : -1;
        const o = this.part(b.geo[lit]);
        o.position.set(s * FRONT, 0, z); o.rotation.y = face; g.add(o);
        chunk.buildings.push({ x: s * (FRONT + 1.5), z: g.position.z + z, lz: z, h: b.height - 1, lit: false });
        if (statue) { const st = this.spawn('rakshasa-statue'); st.position.set(s * (FRONT + 0.25), 0.16, z); st.rotation.y = face; g.add(st); }
        if (k === stall && !statue) { const st = this.spawn('market-stall'); st.position.set(s * (ROAD + 1.15), 0.14, z); st.rotation.y = face; g.add(st); }
      }
      // a taller tower one street back, so the city reads as deep
      const far = this.part(this.towers[Math.floor(r() * this.towers.length)].geo[1]);
      far.position.set(s * (FRONT + 12 + r() * 5), 0, -r() * CHUNK); far.rotation.y = face; far.scale.setScalar(1.5 + r() * 0.5); g.add(far);
      for (const z of [-6, -18]) this.brazier(chunk, s * (ROAD + 0.55), 0, z, r() * 10, 0.14);
    }
    const leaving = c.sec === 'city' && c.n === c.of - 1;      // the last of the city before the moat: the gate stands at its very end
    if (i % 3 === 2 || leaving) { const a = this.part(this.gateGeo); a.position.set(0, 0.14, leaving ? -22.6 : -12); g.add(a); g.userData.gate = a; }
  }

  bridge(chunk, c, r) {
    const g = chunk.group;
    // where the drawbridge has been raised, if it has: the deck is built round the gap
    chunk.gap = c.gap;
    g.add(this.part(this.geo.bridge[chunk.gap === null ? 'none' : 'gap']));
    const water = new THREE.Mesh(this.waterGeo, this.waterMat); water.position.set(0, -8, -CHUNK / 2); g.add(water);
    for (const s of [-1, 1]) {
      const far = new THREE.Mesh(this.farBridgeGeo, this.sideMat); far.position.set(s * (40 + (s > 0 ? 9 : 0)), -0.65, -CHUNK / 2); g.add(far);
      for (const z of [-6, -18]) this.flame(chunk, far.position.x, 1.5, z, 0.42, r() * 10);
      for (const z of [-9, -21]) {
        if (chunk.gap !== null && Math.abs(z - chunk.gap) < palace.GAP_HALF + palace.LEAF + 0.8) continue;
        const x = s * (palace.BRIDGE_HALF - 0.2);
        this.flame(chunk, x, 2.55, z, 0.5, r() * 10);
        const pool = new THREE.Mesh(this.poolGeo, this.poolMat); pool.position.set(s * 6.5, -7.95, z); pool.scale.setScalar(1.3); g.add(pool);
        chunk.braziers.push(new THREE.Vector3(x, g.position.y + 2.5, g.position.z + z));
      }
    }
    if (chunk.gap !== null) for (const s of [-1, 1]) for (const e of [-1, 1]) {      // fires on the four hinge towers of the raised drawbridge
      const x = s * (palace.BRIDGE_HALF - 0.2), z = chunk.gap + e * (palace.GAP_HALF + palace.LEAF);
      this.flame(chunk, x, 5.45, z, 0.6, r() * 10);
      if (e > 0) chunk.braziers.push(new THREE.Vector3(x, g.position.y + 5.2, g.position.z + z));
    }
    // the banks: the city wall behind him, the ramparts of the palace hill ahead
    if (c.n === 0) { const bank = new THREE.Mesh(this.bankGeo, this.sideMat); bank.position.set(0, -13, 0.01); bank.rotation.y = Math.PI; g.add(bank); }
    if (c.n === c.of - 1) for (const s of [-1, 1]) {
      const bank = new THREE.Mesh(this.bankGeo, this.sideMat); bank.position.set(s * (160 + palace.BRIDGE_HALF - 0.1), -3, -CHUNK + 0.01); g.add(bank);
    }
  }

  stairs(chunk, c, r) {
    const g = chunk.group, gy = chunk.gy;
    g.add(this.part(this.geo.stairs[c.dir]));
    for (const s of [-1, 1]) {
      this.brazier(chunk, s * (ROAD + 0.55), gy(-13), -14.6, r() * 10);
      // towers of the upper city rising behind the terrace walls
      const far = this.part(this.towers[Math.floor(r() * this.towers.length)].geo[1]);
      far.position.set(s * (palace.STAIR_HALF + 5 + r() * 4), gy(-12) - 3, -r() * CHUNK); far.rotation.y = s < 0 ? Math.PI / 2 : -Math.PI / 2; far.scale.setScalar(1.7 + r() * 0.5); g.add(far);
      for (const z of [-7, -19]) chunk.buildings.push({ x: s * (palace.STAIR_HALF + 1.0), z: g.position.z + z, lz: z, h: 6, gy: gy(z), lit: false });
    }
  }

  court(chunk, c, r) {
    const g = chunk.group;
    g.add(this.part(this.geo.court));
    if (c.n === 0) {      // the gate into the court, and the alarm bell that wakes the palace
      const gate = this.part(this.geo.gate); gate.position.z = -3; g.add(gate);
      const bell = this.part(this.geo.bell); bell.position.set(0, palace.BELL_AT, -3); g.add(bell);
      chunk.bell = { mesh: bell, z: g.position.z - 3, t: -1 };
    }
    for (const s of [-1, 1]) {
      this.brazier(chunk, s * (ROAD + 0.55), 0, c.n % 2 ? -6 : -18, r() * 10);
      if (c.n % 2 === 1) { const st = this.spawn('rakshasa-statue'); st.position.set(s * 6.3, 0, -15); st.rotation.y = s < 0 ? Math.PI / 2 : -Math.PI / 2; g.add(st); }
      // the towers of the palace beyond the walls
      const far = this.part(this.towers[Math.floor(r() * this.towers.length)].geo[1]);
      far.position.set(s * (palace.COURT_HALF + 5 + r() * 5), -1, -r() * CHUNK); far.rotation.y = s < 0 ? Math.PI / 2 : -Math.PI / 2; far.scale.setScalar(2.1 + r() * 0.6); g.add(far);
    }
  }

  hall(chunk, c, r) {
    const g = chunk.group;
    g.add(this.part(this.geo.hall));
    // the front of the palace on the way in, a wall with a great doorway between one hall and the next, the same on the way out
    if (!c.fire && c.n % DOOR_EVERY === 0) g.add(this.part(this.geo.front));
    if (c.fire && c.n === c.of - 1) { const out = this.part(this.geo.front); out.position.z = -CHUNK; out.rotation.y = Math.PI; g.add(out); }
    // each ring of lamps has a living flame at its heart, and the torchlight rides on the rings
    for (const z of palace.HALL_LAMPS) {
      this.flame(chunk, 0, palace.LAMP_AT + 0.25, z, 0.55, r() * 10);
      chunk.braziers.push(new THREE.Vector3(0, g.position.y + palace.LAMP_AT - 1.5, g.position.z + z));
    }
    for (const s of [-1, 1]) {
      // now and then a pair of stone guardians between the columns
      if (c.n % 2 === 1) { const st = this.spawn('rakshasa-statue'); st.scale.setScalar(0.9); st.position.set(s * 8.2, 0, -16); st.rotation.y = s < 0 ? Math.PI / 2 : -Math.PI / 2; g.add(st); }
      for (const z of palace.HALL_PILLARS) chunk.buildings.push({ x: s * (palace.HALL_PX + 1.2), z: g.position.z + z, lz: z, h: 9, lit: false });
    }
  }

  // ── what stands in his way, the lamps to gather and the wind ──
  populate(chunk, c, r) {
    const g = chunk.group, gy = chunk.gy, fire = c.fire, pool = POOLS[c.kind];
    // in the fire run he breaks through everything, so it can come thick; everywhere else the rows are where the pacing rule put them
    let list = fire ? [-4, -16].map(z => ({ z, type: 'free' })) : ROWS_BY.get(chunk.i) || [];
    if (this.bare) list = list.filter(row => row.type === 'gap');      // looking round: only the raised drawbridge is left, and he leaps it by himself
    for (const { z, type, roll } of list) {
      const y = gy(z);
      let row;
      if (type !== 'free') row = [type];
      else do row = pool[Math.floor(r() * pool.length)]; while (row.some(t => MOVING[t] ? !roll : fire && t === 'spikes') || (roll && !row.some(t => MOVING[t])));
      const add = (type, lane, x, mesh, extra = {}) => {
        const ob = { type, kind: KIND[type], lane, x, z: g.position.z + z, hd: HALF_DEPTH[type], top: TOP[type], wall: row.length === 1 || row.every(Boolean), sharp: !!SHARP[type], mesh, done: false, ...extra };
        chunk.obstacles.push(ob); return ob;
      };
      if (row[0] === 'gap') add('gap', 1, 0, null, { wide: true });
      else if (row[0] === 'door') {
        const m = this.part(this.geo.door); m.position.set(0, y + DOOR_UP, z); g.add(m);
        chunk.live.push({ type: 'drop', mesh: m, y, t: -1, obs: [add('door', 1, 0, m, { off: true, wide: true })] });      // one beam, the full width of the doorway
      } else row.forEach((type, lane) => {
        if (!type) return;
        const [o, live, off] = this.piece(chunk, type, LANES[lane], y, z, r);
        o.position.set(LANES[lane], y + (MOVING[type] ? MOVING[type].up : live && live.type === 'rise' ? -0.97 : 0), z); g.add(o);
        const ob = add(type, lane, LANES[lane], o, { ...(off ? { off: true } : {}), ...(MOVING[type] ? { vz: MOVING[type].vz } : {}) });
        if (live) chunk.live.push({ ...live, ob, mesh: o });
      });
      if (this.bare) continue;
      let coinLane = row.length === 3 ? row.findIndex(x => x === null) : -1; if (coinLane < 0) coinLane = Math.floor(r() * 3);
      const under = row.length === 3 ? row[coinLane] : row[0];
      const arc = under && (KIND[under] === 'low' || under === 'gap');
      if (r() < 0.8 && !(under && MOVING[under])) for (let k = 0; k < 5; k++) {
        const s = new THREE.Sprite(this.lampMat), dz = (k - 2) * 1.5, up = 1.0 + (arc ? Math.max(0, 1.5 - Math.abs(dz) * 0.5) : 0), floor = gy(z - dz); s.scale.setScalar(0.85);
        s.position.set(LANES[coinLane], floor + up, z - dz); g.add(s);
        chunk.coins.push({ mesh: s, x: s.position.x, y: up, floor, z: g.position.z + s.position.z, got: false });
      }
    }
    // now and then a gust of wind to gather: two of them charge his flight
    if (chunk.i >= 3 && !fire && !this.bare && r() < 0.22) {
      const w = new THREE.Sprite(this.windMat), lane = Math.floor(r() * 3), floor = gy(-10); w.scale.setScalar(1.5); w.position.set(LANES[lane], floor + 1.35, -10); g.add(w);
      chunk.winds.push({ mesh: w, x: LANES[lane], floor, z: g.position.z - 10, got: false });
    }
  }

  grove(chunk, c, r) { places.grove(this, chunk, c, r); }
  throne(chunk, c, r) { places.throne(this, chunk, c, r); }

  drop(chunk) { this.scene.remove(chunk.group); }

  // The grove's old trees and the great hall take long to build: built in the middle of a run they held a phone still
  // for a moment as he came into the grove. They are built ahead instead (behind the loading screen, and again
  // whenever a run begins), and handed over when he reaches them.
  prebuild() {
    for (let i = 0; i < PLAN.length; i++) {
      const c = PLAN[i]; if ((c.kind !== 'grove' && c.kind !== 'throne') || c.fire || this.ready.has(i) || this.chunks.has(i)) continue;
      const chunk = this.build(i); this.scene.remove(chunk.group); this.ready.set(i, chunk);
    }
  }
  take(i) { const c = this.ready.get(i); if (!c) return this.build(i); this.ready.delete(i); this.scene.add(c.group); return c; }

  reset() { for (const c of this.chunks.values()) this.drop(c); this.chunks.clear(); this.prebuild(); if (this.gl) this.settle(...this.gl); }

  kindAt(z) { return planAt(Math.floor(-z / CHUNK)).kind; }

  // The things that move: volleys falling, spikes springing, door beams dropping, stones rolling, fire flying.
  animate(c, a, dt, heroZ) {
    const ob = a.ob || a.obs[0];
    if (ob.done) { a.t = 2; return; }
    if (a.t < 0) {
      const from = a.type === 'volley' ? ARROWS_FROM : a.type === 'rise' ? SPIKES_FROM : a.type === 'drop' ? DOOR_FROM : a.from;
      if (ob.z < heroZ - from) return;
      a.t = 0; a.mesh.visible = true; a.z0 = a.mesh.position.z;
      // heard as it begins: a volley loosed, the spikes springing, a stone or log set rolling (the beam and a thrown stone are heard as they land)
      const heard = a.type === 'volley' ? (a.shape === 'stone' ? null : 'fireball') : a.type === 'rise' ? 'spikes' : a.type === 'roll' ? 'stone' : null;
      if (heard && this.onSound) this.onSound(heard);
    }
    if (a.type === 'volley') {
      a.t += dt / 0.45; const k = Math.min(1, a.t);
      a.mesh.position.y = a.rest + ARROW_SKY * (1 - k * k);
      if (a.shape === 'bolt') a.mesh.position.z = a.z0 - (1 - k) * 26;      // the great bolt comes in low from the walls ahead
      if (a.shape === 'stone') a.mesh.rotation.x = (1 - k) * 5;
      if (k >= 1) { if (a.fire) a.fire.visible = true; a.t = 2; if (a.shape === 'stone' && this.onSound) this.onSound('smash'); }
    } else if (a.type === 'rise') {
      a.t += dt / 0.13; const k = Math.min(1, a.t);
      a.mesh.position.y = a.y - 0.97 * (1 - k) * (1 - k);
      if (k > 0.4) ob.off = false;
      if (k >= 1) a.t = 2;
    } else if (a.type === 'drop') {
      a.t += dt / 0.42; const k = Math.min(1, a.t);
      a.mesh.position.y = a.y + DOOR_LOW + (DOOR_UP - DOOR_LOW) * (1 - k * k);
      if (k >= 1) { a.t = 2; for (const o of a.obs) o.off = false; if (this.onSound) this.onSound('beam'); }
    } else {
      ob.z += a.vz * dt;
      a.mesh.position.z = ob.z - c.group.position.z; a.mesh.position.y = groundAt(ob.z) - c.plan.base + a.up;
      a.mesh.rotation.x += a.vz * dt / a.up;
      if (ob.z > heroZ + 7) { a.mesh.visible = false; ob.done = true; a.t = 2; }
    }
  }

  update(dt, heroZ) {
    this.time += dt;
    const at = Math.floor(-heroZ / CHUNK);
    for (let i = at - this.behind; i <= at + AHEAD; i++) if (!this.chunks.has(i)) this.chunks.set(i, this.take(i));
    for (const i of this.keep) if (!this.chunks.has(i)) this.chunks.set(i, this.take(i));
    for (const [i, c] of this.chunks) if ((i < at - this.behind || i > at + AHEAD) && !this.keep.has(i)) { this.drop(c); this.chunks.delete(i); }
    // A stretch kept standing for the story (the grove, for a cut back to Sita) is drawn only when it is near or a scene
    // is playing: on the run through the grove its far end, 150 m off in the mist, was a third of every frame's work.
    for (const [i, c] of this.chunks) c.group.visible = this.sceneOn || (i >= at - this.behind - 1 && i <= at + AHEAD);
    this.twinkle[0].opacity = 0.55 + Math.sin(this.time * 2.3) * 0.35; this.twinkle[1].opacity = 0.55 + Math.sin(this.time * 1.7 + 2) * 0.35;

    const near = [];
    for (const c of this.chunks.values()) {
      if (c.fx) places.animate(c, this.time, heroZ, this.shotOn);
      for (const f of c.flames) { const s = 1.7 + Math.sin(this.time * 11 + f.userData.seed) * 0.22 + Math.sin(this.time * 23 + f.userData.seed * 3) * 0.12; const b = f.userData.base; f.scale.set(s * b, s * 1.25 * b, 1); }
      for (const a of c.live) if (a.t <= 1) this.animate(c, a, dt, heroZ);
      for (const w of c.winds) if (!w.got) { w.mesh.visible = !this.sceneOn;      // (the ring of wind is a thing of the run: in a scene it is not there. Sid: "behind Sita in that scene, not needed there")
        w.mesh.material.rotation = this.time * 2.2; w.mesh.position.y = w.floor + 1.35 + Math.sin(this.time * 2 + w.z) * 0.12; }
      for (const k of c.coins) if (!k.got) k.mesh.visible = !this.sceneOn, k.mesh.position.y = k.floor + k.y + Math.sin(this.time * 3 + k.z) * 0.07;
      for (const b of c.braziers) if (b.z < heroZ + 4 && b.z > heroZ - 30) near.push(b);
      const bell = c.bell;
      if (bell) {
        if (bell.t < 0 && bell.z > heroZ - 40) { bell.t = 0; if (this.onBell) this.onBell(); }
        if (bell.t >= 0) { bell.t += dt; bell.mesh.rotation.z = Math.sin(bell.t * 5.5) * 0.55 * Math.exp(-bell.t * 0.2); }
      }
    }
    // two real lights ride on the nearest flames ahead of him; the rest of the glow is painted on
    near.sort((a, b) => b.z - a.z);
    const flick = 1 + Math.sin(this.time * 13) * 0.08;
    this.torches.forEach((l, n) => { const b = near[n]; if (b) { l.position.copy(b); l.intensity = 42 * flick; } else l.intensity = 0; });
    this.far.position.z = heroZ;
    const here = planAt(at), end = planAt(at + AHEAD);
    if (this.hill) this.hill.visible = !this.pano && !(here.fire || ['court', 'hall', 'grove', 'throne'].includes(here.kind));      // (the panorama has its own palace on its hill)
    this.cap.visible = end.kind === 'hall' || end.kind === 'throne';
    if (this.cap.visible) this.cap.position.set(0, end.base + palace.HALL_TOP / 2, -(at + AHEAD + 1) * CHUNK + 0.2);
  }

  fire(chunk, x, y, z, size) { this.flame(chunk, x, y, z, size); }

  // Fire run: everything he has reached goes up in flames.
  igniteUpTo(heroZ) {
    let lit = 0;
    for (const c of this.chunks.values()) for (const b of c.buildings) {
      if (b.lit || b.z < heroZ - 18) continue;      // catches a little ahead of him so the player sees it spread
      b.lit = true; lit++;
      const inward = b.x < 0 ? 1.2 : -1.2, floor = b.gy || 0;
      this.fire(c, b.x + inward, floor + b.h * 0.95, b.lz, 1.7 + b.h * 0.14);
      this.fire(c, b.x + inward * 1.5, floor + b.h * 0.5, b.lz + 1.4, 1.2);
    }
    return lit;
  }

  burn(o, chunk) { const z = o.z - chunk.group.position.z; this.fire(chunk, o.x, chunk.gy(z) + 0.9, z, 1.3); }

  nearby(heroZ) {
    const at = Math.floor(-heroZ / CHUNK), out = [];
    for (const i of [at, at + 1, at + 2]) { const c = this.chunks.get(i); if (c) out.push(c); }      // fire launched two stretches ahead reaches him here
    return out;
  }
}
