// Two places that are for the story rather than the run: the Ashoka grove where Sita is kept, moonlit and still,
// and Ravana's court, a hall of gold filled with the lords of Lanka. Each is built a 24 m stretch at a time, like
// the rest of the route (world.js), from plain shapes, a few painted pictures and the models made in Lux3D.
import * as THREE from 'three';
import * as palace from './palace.js';
import { Builder } from './build.js';
import { tree, treeMaterials } from './trees.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { HALL, greatHall, plinth } from './court.js';

const L = palace.LEN;
// where things stand, in the stretch they are in (x across the road, z along it from the stretch's near edge)
export const SITA = { n: 6, x: 4.7, z: -11, seat: 0.43, edge: 0.66, up: 0.22, yaw: -0.75 };      // her stone seat on its round platform under the great tree: how far forward of its middle she sits, how high the platform stands, which way the seat faces
export const TREE = { n: 6, x: 8.8, z: -14.6 };
export const HIDE = { n: 5, x: -5.4, z: -21 };                         // the old tree at the side of the path that Hanuman hides behind
export const GATE = { z: -0.8, half: 0.8 };                           // the wall across the way into the grove, and the low passage through it                      // the great tree Hanuman hides in
export const THRONE = { n: 1, z: -12.5, top: 1.05, seat: 0.92 };     // the dais and the seat of the throne; behind it, room for Shiva
export const STAND = { n: 1, z: -1.5 };                              // where Hanuman is made to stand before it

function canvas(size, draw, repeat) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
function rnd(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
function glow(inner, outer) {
  return canvas(128, (g, s) => { const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); r.addColorStop(0, inner); r.addColorStop(0.35, outer); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, s, s); });
}

// ── the grove ──
function garden(world) {
  if (world.garden) return world.garden;
  const Solid = world.lite ? THREE.MeshLambertMaterial : THREE.MeshStandardMaterial, pbr = world.lite ? {} : { roughness: 0.95, metalness: 0 };
  const r = rnd(77);
  const grass = canvas(256, (g, s) => {      // night grass with small flowers in it
    g.fillStyle = '#1b3a2a'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 3200; i++) { g.fillStyle = `hsl(${118 + r() * 40}, ${30 + r() * 25}%, ${13 + r() * 16}%)`; g.fillRect(r() * s, r() * s, 1.5 + r() * 2, 3 + r() * 5); }
    for (let i = 0; i < 90; i++) { g.fillStyle = ['#ffd9e6', '#fff6c8', '#ff9fb4', '#e9f3ff'][Math.floor(r() * 4)]; g.beginPath(); g.arc(r() * s, r() * s, 1 + r() * 1.3, 0, 7); g.fill(); }
  }, [12, 5]);
  const beam = canvas(64, (g, s) => {      // a shaft of moonlight: bright at the top, gone at the foot and at both edges
    const v = g.createLinearGradient(0, 0, 0, s); v.addColorStop(0, 'rgba(210,228,255,0.9)'); v.addColorStop(1, 'rgba(210,228,255,0)');
    g.fillStyle = v; g.fillRect(0, 0, s, s);
    g.globalCompositeOperation = 'destination-in';
    const h = g.createLinearGradient(0, 0, s, 0); h.addColorStop(0, 'rgba(0,0,0,0)'); h.addColorStop(0.5, 'rgba(0,0,0,1)'); h.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = h; g.fillRect(0, 0, s, s);
  });
  const dot = glow('rgba(255,255,255,1)', 'rgba(255,255,255,0.5)');
  const common = { transparent: true, depthWrite: false, fog: false };
  world.garden = {
    grassMat: new Solid({ map: grass, color: 0xa9c6d4, ...pbr }), grassGeo: new THREE.PlaneGeometry(64, L).rotateX(-Math.PI / 2),
    pathMat: new Solid({ map: world.roadMat.map, color: 0x93a8bf, ...pbr }),
    beamMat: new THREE.MeshBasicMaterial({ map: beam, blending: THREE.AdditiveBlending, opacity: 0.2, side: THREE.DoubleSide, ...common }), beamGeo: new THREE.PlaneGeometry(5, 19),
    flyMat: new THREE.PointsMaterial({ map: dot, color: 0xd9ff9c, size: 0.17, blending: THREE.AdditiveBlending, ...common }),
    petalMat: new THREE.PointsMaterial({ map: dot, color: 0xff7d8f, size: 0.13, opacity: 0.9, transparent: true, depthWrite: false }),
    lotusMat: new THREE.SpriteMaterial({ map: glow('rgba(255,235,245,1)', 'rgba(255,120,170,0.75)'), blending: THREE.AdditiveBlending, ...common }),
    haloMat: new THREE.SpriteMaterial({ map: glow('rgba(235,242,255,0.34)', 'rgba(150,185,255,0.13)'), blending: THREE.AdditiveBlending, ...common }),
    mistMat: new THREE.SpriteMaterial({ map: glow('rgba(190,215,255,0.5)', 'rgba(140,180,255,0.16)'), blending: THREE.AdditiveBlending, opacity: 0.5, ...common }), pondGeo: new THREE.CircleGeometry(4.6, 28).rotateX(-Math.PI / 2),
    lanternGeo: palace.stoneLantern(), seatGeo: seat(), platformGeo: platform(), gateGeo: gateWall(),
    gateGlow: new THREE.SpriteMaterial({ map: glow('rgba(190,215,255,0.9)', 'rgba(120,165,255,0.35)'), blending: THREE.AdditiveBlending, ...common }),
    lampMat: new THREE.PointsMaterial({ map: dot, color: 0xffb45a, size: 0.5, blending: THREE.AdditiveBlending, ...common }),
    warmMat: new THREE.SpriteMaterial({ map: glow('rgba(255,190,110,0.5)', 'rgba(255,140,60,0.16)'), blending: THREE.AdditiveBlending, ...common }),
    trees: [0, 1, 2, 3].map(i => tree(311 + i * 97, 1, { lite: world.lite })),
    // the great tree she sits under: one low limb passes over the place where Hanuman crouches to watch (story.js: 1.7 across and 1.5 behind her, 4.3 up)
    great: tree(977, 1.45, { lite: world.lite, perch: [SITA.x + 1.7 - TREE.x, 4.3, SITA.z - 1.5 - TREE.z] }),
    ...treeMaterials(),
  };
  return world.garden;
}

// What stands in his way in the grove (Sid: "let him explore that place a bit. only here the things that fall are not the
// same thing, different hurdles"): a great root arching out of the ground to leap, a low bough across the path to slide
// under, a standing stone to step round. Wood and stone a little paler than the trees, so the moon shows them in time.
export function hurdle(world, type, r) {
  const k = garden(world);
  if (!k.hurdleWood) {      // lit by the grove's own moon (the trees carry their light painted in, and a shape without that paint is black)
    k.hurdleWood = world.rockMat.clone(); k.hurdleWood.flatShading = false;
    if (k.wood.map) { k.hurdleWood.map = k.wood.map; k.hurdleWood.color.set(0xd8c2a4); } else k.hurdleWood.color.set(0x6a5540);      // the trees' own bark where there is a picture of it
    k.hurdleStone = world.rockMat.clone(); k.hurdleStone.color.set(0x414a48); k.hurdleLeaf = world.rockMat.clone(); k.hurdleLeaf.color.set(0x2c5a3c);
  }
  const g = new THREE.Group(), wood = (geo, x, y, z, rx = 0, ry = 0, rz = 0, s = [1, 1, 1]) => { const m = new THREE.Mesh(geo, k.hurdleWood); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(...s); g.add(m); return m; };
  if (type === 'root') {
    wood(new THREE.TorusGeometry(0.98, 0.21, 7, 14, Math.PI), 0, -0.08, 0, 0, 0.12, 0, [1, 0.84, 1.25]);      // a great root heaved up out of the ground, lesser ones twisted about it
    wood(new THREE.TorusGeometry(0.7, 0.13, 6, 10, Math.PI), 0.3, -0.05, 0.22, 0.1, -0.5, 0, [1, 0.7, 1]);
    wood(new THREE.TorusGeometry(0.5, 0.1, 6, 10, Math.PI), -0.42, -0.04, -0.2, -0.08, 0.7, 0, [1, 0.75, 1]);
    wood(new THREE.CylinderGeometry(0.1, 0.17, 1.3, 6), -1.0, 0.1, 0.25, 1.2, 0, 0.5);
  } else if (type === 'bough') {
    wood(new THREE.CylinderGeometry(0.15, 0.19, 3.0, 8), 0, 1.76, 0, 0, 0, Math.PI / 2 + 0.05);
    for (const s of [-1, 1]) wood(new THREE.CylinderGeometry(0.13, 0.22, 2.0, 7), s * 1.28, 0.93, 0, 0, 0, s * 0.16);
    const leaves = new THREE.Mesh(new THREE.SphereGeometry(0.34, 6, 5), k.hurdleLeaf); leaves.userData.soft = true; leaves.position.set(0.5 - r(), 1.98, 0); leaves.scale.set(2.2, 0.5, 1.1); g.add(leaves);
  } else {      // 'rock': a standing stone, taller than he can leap
    const m = new THREE.Mesh(world.rockGeo, k.hurdleStone); m.position.y = 1.15; m.scale.set(1.35, 2.3, 1.2); m.rotation.y = r() * 6.3; g.add(m);
    const foot = new THREE.Mesh(world.rockGeo, k.hurdleStone); foot.position.set(0.5, 0.2, 0.3); foot.scale.set(0.8, 0.6, 0.7); g.add(foot);
  }
  return g;
}
export function grove(world, chunk, c, r) {
  const g = chunk.group, k = garden(world); chunk.fx = [];
  const ground = new THREE.Mesh(k.grassGeo, k.grassMat); ground.position.z = -L / 2; g.add(ground);
  const path = new THREE.Mesh(world.roadGeo, k.pathMat); path.position.set(0, 0.012, -L / 2); g.add(path);
  if (c.n === 0) {      // the way in: a high wall across the end of the palace, and under it one low passage with moonlight in it. Nothing of the grove is seen until he is through.
    const wall = world.part(k.gateGeo); g.add(wall); const way = { type: 'tunnel', kind: 'high', lane: 1, x: 0, z: g.position.z + GATE.z, hd: GATE.half, top: 0, wall: true, sharp: false, mesh: new THREE.Object3D(), done: false, wide: true };
    chunk.obstacles.push(way); chunk.fx.push({ type: 'gate', obj: wall, z: way.z, way });
    const moon = new THREE.Sprite(k.gateGlow); moon.position.set(0, 0.6, GATE.z - GATE.half - 0.4); moon.scale.set(9, 1.7, 1); g.add(moon);
  }
  const here = c.n === SITA.n;
  // old Ashoka trees along both sides, close enough that their canopies meet over the path, and a second row behind
  // them that closes the grove in; never two alike in kind, size or turn
  // (all the trees of a stretch are drawn as two things, wood and leaf, not two for every tree: forty draws a stretch came to four hundred a frame on a phone)
  const woods = [], greens = [], _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
  const plant = (kind, x, z, turn, size) => {
    _m.compose(new THREE.Vector3(x, 0, z), _q.setFromEuler(_e.set(0, turn, 0)), new THREE.Vector3(size, size, size));
    woods.push(kind.wood.clone().applyMatrix4(_m)); greens.push(kind.green.clone().applyMatrix4(_m));
  };
  const planted = () => { if (!woods.length) return; const wood = new THREE.Mesh(mergeGeometries(woods), k.wood), green = new THREE.Mesh(mergeGeometries(greens), k.green);
    green.userData.soft = true; g.add(wood, green); for (const x of woods) x.dispose(); for (const x of greens) x.dispose(); woods.length = greens.length = 0; };
  for (const s of [-1, 1]) {
    for (let j = 0; j < 3; j++) {
      const x = s * (7.0 + r() * 1.5), z = -4 - j * 8 + (r() - 0.5) * 2, kind = k.trees[Math.floor(r() * k.trees.length)], turn = r() * 6.3, size = 0.92 + r() * 0.22;
      if (here && s > 0 && Math.abs(z - TREE.z) < 7.5) continue;      // room for the great tree
      if (c.n === HIDE.n && s < 0 && Math.abs(z - HIDE.z) < 6) continue;      // and for the one he hides behind, which stands nearer the path
      if (c.n === 0 && z > -5) continue;      // none against the wall he comes in under
      plant(kind, x, z, turn, size);
    }
    for (let j = 0; j < 2; j++) plant(k.trees[Math.floor(r() * k.trees.length)], s * (14 + r() * 4), -5 - j * 12 + (r() - 0.5) * 3, r() * 6.3, 1.05 + r() * 0.25);
  }
  // shafts of moonlight between the trees
  for (let j = 0; j < 2; j++) {
    const s = j ? 1 : -1, b = new THREE.Mesh(k.beamGeo, k.beamMat); b.position.set(s * (2.5 + r() * 6), 8.4, -5 - r() * 14); b.rotation.z = -s * 0.32; b.userData.veil = true; g.add(b);
  }
  // fireflies that drift and wink, and petals coming down all the time
  const pts = (n, w, h, mat) => {
    const a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = (r() * 2 - 1) * w; a[i * 3 + 1] = r() * h; a[i * 3 + 2] = -r() * L; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(a, 3));
    const p = new THREE.Points(geo, mat); p.frustumCulled = false; g.add(p); return p;
  };
  chunk.fx.push({ type: 'fly', obj: pts(world.lite ? 40 : 70, 12, 3.6, k.flyMat), seed: r() * 10, y: 0.5 });
  chunk.fx.push({ type: 'fall', obj: pts(world.lite ? 70 : 130, 10, 18, k.petalMat), seed: r() * 9 });
  // a low mist lying on the grass, catching the moon
  for (let j = 0; j < (world.lite ? 4 : 7); j++) { const m = new THREE.Sprite(k.mistMat); m.position.set((r() < 0.5 ? -1 : 1) * (4.5 + r() * 9), 0.7 + r() * 0.5, -r() * L); m.scale.set(9 + r() * 6, 2.2 + r() * 1.2, 1); m.userData.veil = true; g.add(m); }
  // low stone lanterns beside the path
  for (const s of [-1, 1]) for (const z of [-6, -18]) {
    if (c.n === HIDE.n && s < 0 && z === -18) continue;      // none by the tree he hides behind: it would stand in front of what he sees
    const lantern = world.part(k.lanternGeo); lantern.position.set(s * 4.7, 0, z); g.add(lantern);
    world.flame(chunk, s * 4.7, 1.22, z, 0.3, r() * 10);
    chunk.braziers.push(new THREE.Vector3(s * 4.7, g.position.y + 1.3, g.position.z + z));
  }
  if (c.n === HIDE.n || c.n === 2) {      // a lotus pond that holds the sky
    const pond = new THREE.Mesh(k.pondGeo, world.waterMat); pond.position.set(-10, 0.03, -12); g.add(pond);
    for (let i = 0; i < 9; i++) { const a = r() * 6.3, d = r() * 3.6, l = new THREE.Sprite(k.lotusMat); l.position.set(-10 + Math.cos(a) * d, 0.28, -12 + Math.sin(a) * d); l.scale.setScalar(0.55 + r() * 0.4); g.add(l); }
  }
  if (c.n === HIDE.n) plant(k.trees[1], HIDE.x, HIDE.z, 1.1, 1.0);
  if (here) {      // the great tree; beneath it a round carved platform ringed with lamps, her seat on it, and a soft light that seems to come from her
    plant(k.great, TREE.x, TREE.z, 0, 1);
    const U = SITA.up, base = world.part(k.platformGeo); base.position.set(SITA.x, 0, SITA.z); g.add(base);
    const chair = world.part(k.seatGeo); chair.position.set(SITA.x, U, SITA.z); chair.rotation.y = SITA.yaw; g.add(chair);
    const halo = new THREE.Sprite(k.haloMat); halo.position.set(SITA.x, 1.7 + U, SITA.z); halo.scale.setScalar(8.5); g.add(halo); chunk.fx.push({ type: 'pulse', obj: halo, size: 8.5 });
    const warm = new THREE.Sprite(k.warmMat); warm.position.set(SITA.x, 0.5, SITA.z); warm.scale.set(8, 2.6, 1); g.add(warm);
    const b = new THREE.Mesh(k.beamGeo, k.beamMat); b.position.set(SITA.x - 1.6, 8.6, SITA.z + 1.2); b.rotation.z = 0.2; b.userData.veil = true; g.add(b);
    // small clay lamps all round the rim, and lotuses between them
    const N = 18, a = new Float32Array(N * 3); for (let i = 0; i < N; i++) { const t = i / N * 6.283; a[i * 3] = SITA.x + Math.cos(t) * 2.2; a[i * 3 + 1] = 0.25; a[i * 3 + 2] = SITA.z + Math.sin(t) * 2.2; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(a, 3)); const lamps = new THREE.Points(geo, k.lampMat); lamps.frustumCulled = false; g.add(lamps); chunk.fx.push({ type: 'flicker', obj: lamps });
    for (let i = 0; i < 9; i++) { const t = (i + 0.5) / 9 * 6.283, l = new THREE.Sprite(k.lotusMat); l.position.set(SITA.x + Math.cos(t) * 2.2, 0.3, SITA.z + Math.sin(t) * 2.2); l.scale.setScalar(0.34); g.add(l); }
  }
  planted();
}

// The round platform under the great tree: two low steps of carved stone, the upper one her floor.
function platform() {
  const b = new Builder(), N = 24, o = { ground: false, color: [0.74, 0.82, 1] }, at = (k, rr, y) => [Math.cos(k / N * Math.PI * 2) * rr, y, Math.sin(k / N * Math.PI * 2) * rr];
  for (const [rr, y0, y1] of [[2.45, 0, 0.1], [1.95, 0.1, SITA.up]]) {
    for (let k = 0; k < N; k++) { const m = (k + 0.5) / N * Math.PI * 2, out = [Math.cos(m), 0, Math.sin(m)]; b.face([at(k, rr, y0), at(k + 1, rr, y0), at(k + 1, rr, y1), at(k, rr, y1)], 'lotus', out, { ...o, fit: true, shade: 0.85 + 0.3 * Math.max(0, -out[0] * 0.6 + out[2] * 0.8) }); }
    b.face(Array.from({ length: N }, (_, k) => at(k, rr, y1)), 'paving', [0, 1, 0], { ...o, tile: [1.3, 1.3], shade: 1.05 });
  }
  return b.geometry();
}
// The wall across the way in: old stone, 14 m high, with one low passage under a carved lintel, the width of the path.
function gateWall() {
  const b = new Builder(), o = { ground: false, tile: [2.4, 2.4], color: [0.62, 0.66, 0.8] }, W = 17, H = 14, D = 3.75, L = 1.25, z0 = GATE.z - GATE.half, z1 = GATE.z + GATE.half;
  b.box(-W, -D, 0, H, z0, z1, 'stone', { ...o, faces: 'fbr' });
  b.box(D, W, 0, H, z0, z1, 'stone', { ...o, faces: 'fbl' });
  b.box(-D, D, L, H, z0, z1, 'stone', { ...o, faces: 'fbd' });
  for (const [za, zb, f] of [[z1, z1 + 0.14, 'f'], [z0 - 0.14, z0, 'b']]) b.box(-D - 0.5, D + 0.5, L, L + 0.5, za, zb, 'lotus', { ground: false, faces: f + 'd', tile: [2, 0.5], color: [1.1, 0.95, 0.7] });
  return b.geometry();
}
// Her seat: a low stone chair with a back and arms, facing +z until it is turned.
function seat() {
  const b = new Builder(), o = { ground: false, color: [1.0, 1.06, 1.22], faces: 'fblrt' }, h = SITA.seat;
  b.box(-0.62, 0.62, 0, h, 0.1, 0.84, 'pfloor', { ...o, tile: [4, 4] });                      // where she sits
  b.box(-0.7, 0.7, 0, 1.3, -0.08, 0.1, 'pfloor', { ...o, tile: [4, 4], shade: 0.92 });         // the back
  b.box(-0.7, 0.7, 1.3, 1.42, -0.1, 0.12, 'lotus', { ...o, fit: true });
  for (const s of [-1, 1]) b.box(s > 0 ? 0.62 : -0.78, s > 0 ? 0.78 : -0.62, 0, h + 0.22, 0.1, 0.8, 'pfloor', { ...o, tile: [4, 4], shade: 0.96 });      // arms
  return b.geometry();
}

// ── Ravana's court ──
function court(world) {
  if (world.courtKit) return world.courtKit;
  const Solid = world.lite ? THREE.MeshLambertMaterial : THREE.MeshStandardMaterial;
  const carpet = canvas(128, (g, s) => {
    g.fillStyle = '#6f0f14'; g.fillRect(0, 0, s, s); g.fillStyle = '#d7a23c'; g.fillRect(0, 0, 9, s); g.fillRect(s - 9, 0, 9, s);
    g.fillStyle = '#8f1a1c'; for (let y = 0; y < s; y += 32) { g.beginPath(); g.moveTo(s / 2, y + 4); g.lineTo(s / 2 + 22, y + 16); g.lineTo(s / 2, y + 28); g.lineTo(s / 2 - 22, y + 16); g.fill(); }
    g.strokeStyle = '#e8c064'; g.lineWidth = 2; g.strokeRect(13, 0, s - 26, s);
  }, [1, 6]);
  const banner = canvas(128, (g, s) => {
    g.fillStyle = '#7a1014'; g.fillRect(0, 0, s, s); g.strokeStyle = '#e6b64c'; g.lineWidth = 7; g.strokeRect(6, 6, s - 12, s - 12);
    g.fillStyle = '#e6b64c'; g.beginPath(); g.arc(s / 2, s * 0.42, 20, 0, 7); g.fill();      // a sun disc, the sign of the house
    for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; g.beginPath(); g.moveTo(s / 2 + Math.cos(a) * 25, s * 0.42 + Math.sin(a) * 25); g.lineTo(s / 2 + Math.cos(a + 0.12) * 38, s * 0.42 + Math.sin(a + 0.12) * 38); g.lineTo(s / 2 + Math.cos(a - 0.12) * 38, s * 0.42 + Math.sin(a - 0.12) * 38); g.fill(); }
  });
  const sun = canvas(256, (g, s) => {      // the great golden disc behind the throne
    const rg = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); rg.addColorStop(0, '#fff3c0'); rg.addColorStop(0.3, '#f2bd4c'); rg.addColorStop(0.75, '#a86a1a'); rg.addColorStop(1, '#5a3608');
    g.fillStyle = rg; g.beginPath(); g.arc(s / 2, s / 2, s / 2 - 1, 0, 7); g.fill();
    g.strokeStyle = 'rgba(90,50,8,0.75)'; g.lineWidth = 3;
    for (let i = 0; i < 36; i++) { const a = i / 36 * 6.283; g.beginPath(); g.moveTo(s / 2 + Math.cos(a) * s * 0.2, s / 2 + Math.sin(a) * s * 0.2); g.lineTo(s / 2 + Math.cos(a) * s * 0.49, s / 2 + Math.sin(a) * s * 0.49); g.stroke(); }
    for (const q of [0.2, 0.34, 0.47]) { g.beginPath(); g.arc(s / 2, s / 2, s * q, 0, 7); g.stroke(); }
  });
  const shaft = canvas(64, (g, s) => {      // light falling through the smoke from a high window
    const v = g.createLinearGradient(0, 0, 0, s); v.addColorStop(0, 'rgba(255,226,180,0.85)'); v.addColorStop(1, 'rgba(255,226,180,0)');
    g.fillStyle = v; g.fillRect(0, 0, s, s); g.globalCompositeOperation = 'destination-in';
    const h = g.createLinearGradient(0, 0, s, 0); h.addColorStop(0, 'rgba(0,0,0,0)'); h.addColorStop(0.5, 'rgba(0,0,0,1)'); h.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = h; g.fillRect(0, 0, s, s);
  });
  world.courtKit = {
    throneGeo: palace.throneModule(THRONE.z, THRONE.top, THRONE.seat, 2.9, [0.42, 0.36, 0.34], true),      // a low back: over it, Shiva is seen
    hallGeo: [greatHall({ first: true }), greatHall({ throne: THRONE.z })], plinthGeo: plinth(),
    bannerMat: new THREE.MeshBasicMaterial({ map: banner, side: THREE.DoubleSide, color: 0xb9b0a6 }), bannerGeo: new THREE.PlaneGeometry(2.0, 6.6),
    shaftMat: new THREE.MeshBasicMaterial({ map: shaft, blending: THREE.AdditiveBlending, opacity: 0.13, side: THREE.DoubleSide, transparent: true, depthWrite: false, fog: false }), shaftGeo: new THREE.PlaneGeometry(4.2, 21),
    glowMat: new THREE.SpriteMaterial({ map: glow('rgba(255,205,130,0.5)', 'rgba(255,140,50,0.16)'), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false }),
  };
  return world.courtKit;
}

export function throne(world, chunk, c, r) {
  const g = chunk.group, k = court(world); chunk.fx = [];
  const last = c.n === THRONE.n, Z = THRONE.z, T = THRONE.top;
  g.add(world.part(k.hallGeo[last ? 1 : 0]));
  if (c.n === 0) g.add(world.part(world.geo.frontShut));      // the doors of his hall are shut on the prisoner: he goes out through them
  // fire in every bowl along the aisle, and light slanting down through the smoke from windows too high to see
  for (const s of [-1, 1]) {
    for (const z of HALL.bowls) if (!last || z > Z + 6.5) {
      world.flame(chunk, s * HALL.bowlX, HALL.bowlTop + 0.25, z, 0.9, r() * 10);
      chunk.braziers.push(new THREE.Vector3(s * HALL.bowlX, g.position.y + HALL.bowlTop + 0.6, g.position.z + z));
    }
    for (const z of [-6, -18]) { const b = new THREE.Mesh(k.shaftGeo, k.shaftMat); b.position.set(s * 7.4, 9.6, z + r() * 2); b.rotation.z = s * 0.42; b.rotation.y = s * 0.35; g.add(b); }
    for (const z of HALL.pillars) {      // the banners of Lanka on every pillar, facing the aisle
      const b = new THREE.Mesh(k.bannerGeo, k.bannerMat); b.position.set(s * (HALL.px - 1.12), 11.6, z); b.rotation.y = s < 0 ? Math.PI / 2 : -Math.PI / 2; g.add(b);
    }
    // great stone guardians along the walls, between the pillars
    for (const z of HALL.bowls) if (world.prefabs['rakshasa-statue']) { const f = world.spawn('rakshasa-statue'); f.position.set(s * (HALL.half - 1.9), 0, z); f.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2; f.scale.setScalar(1.55); g.add(f); }
    // the lords and warriors of Lanka, standing in ranks down both sides, turned toward the throne
    const rows = world.lite ? [4.9] : [4.4, 6.9], to = last ? Z + 7.4 : -23.2;
    for (const x of rows) for (let z = -1.4 - (x > 5 ? 1.3 : 0); z > to; z -= 2.6) {
      if (HALL.bowls.some(q => Math.abs(q - z) < 1.6) && Math.abs(x - HALL.bowlX) < 1.9) continue;      // nobody stands in a fire
      const f = world.spawn('courtier'); f.position.set(s * (x + r() * 0.3), 0, z + r() * 0.5); f.scale.setScalar(0.94 + r() * 0.2);
      f.rotation.y = (s > 0 ? -2.2 : 2.2) + (r() - 0.5) * 0.5; g.add(f);
    }
  }
  if (!last) return;
  // the dais and the throne on it (palace.js)
  g.add(world.part(k.throneGeo));
  // Shiva, seated in meditation, fills the niche behind the throne; a great fire burns at each knee
  if (world.prefabs.shiva) { const f = world.spawn('shiva'); f.position.set(0, HALL.seat, HALL.shivaZ); f.scale.setScalar(1.08); g.add(f); }
  for (const s of [-1, 1]) {
    world.flame(chunk, s * 6.6, HALL.bowlTop * 1.35 + 0.3, Z - 3.4, 1.3, r() * 10);
    // and one before the steps on each side: these two are the light on Ravana and on whoever stands before him
    world.flame(chunk, s * 5, HALL.bowlTop + 0.25, Z + 5.6, 0.9, r() * 10);
    chunk.braziers.push(new THREE.Vector3(s * 5, g.position.y + HALL.bowlTop + 0.6, g.position.z + Z + 5.6));
    // a Nandi on his plinth at each side of the steps, turned in toward the aisle
    const base = world.part(k.plinthGeo); base.position.set(s * 8.1, 0, Z + 6.3); base.rotation.y = -s * 0.93; g.add(base);
    if (world.prefabs.nandi) { const f = world.spawn('nandi'); f.position.set(s * 8.1, 0.7, Z + 6.3); f.rotation.y = -s * 0.93; g.add(f); }
  }
  const key = new THREE.PointLight(0xffe6c4, 34, 9, 1.8); key.position.set(0.8, T + 3.0, Z + 3.4); g.add(key);      // the light Ravana sits in: on him, and spent before it reaches the wall
  const halo = new THREE.Sprite(k.glowMat); halo.position.set(0, 7.5, Z - 5); halo.scale.setScalar(26); g.add(halo); chunk.fx.push({ type: 'pulse', obj: halo, size: 26 });
  const lamp = new THREE.PointLight(0xffb060, 120, 30, 1.6); lamp.position.set(0, 4.6, Z - 3.0); g.add(lamp);      // the one real light of the hall: the fires at his knees, on the statue
}

// The small living things of these places: fireflies drifting, petals falling, lights breathing.
export function animate(chunk, time, heroZ = 0, shot = false) {
  for (const f of chunk.fx) {
    if (f.type === 'fly') { f.obj.position.set(Math.sin(time * 0.31 + f.seed) * 0.9, f.y + Math.sin(time * 0.53 + f.seed * 2) * 0.35, Math.cos(time * 0.27 + f.seed) * 0.7); f.obj.material.opacity = 0.55 + Math.sin(time * 2.1 + f.seed) * 0.4; }
    else if (f.type === 'fall') { f.obj.position.y = -((time * 0.55 + f.seed) % 9); f.obj.position.x = Math.sin(time * 0.4 + f.seed) * 0.6; }
    else if (f.type === 'pulse') f.obj.scale.setScalar(f.size * (1 + Math.sin(time * 1.3) * 0.05));
    else if (f.type === 'gate') f.obj.visible = !f.way.done && (shot || heroZ > f.z - 1);      // broken through, it is gone;      // once he is through and the view is behind him again, the wall is not left standing in front of it
    else if (f.type === 'flicker') f.obj.material.opacity = 0.8 + Math.sin(time * 9) * 0.1 + Math.sin(time * 23) * 0.06;
  }
}
