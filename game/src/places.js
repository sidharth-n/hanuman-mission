// Two places that are for the story rather than the run: the Ashoka grove where Sita is kept, moonlit and still,
// and Ravana's court, a hall of gold filled with the lords of Lanka. Each is built a 24 m stretch at a time, like
// the rest of the route (world.js), from plain shapes, a few painted pictures and the models made in Lux3D.
import * as THREE from 'three';
import * as palace from './palace.js';

const L = palace.LEN;
// where things stand, in the stretch they are in (x across the road, z along it from the stretch's near edge)
export const SITA = { n: 2, x: 3.4, z: -11, seat: 0.5 };            // her stone seat under the great tree
export const TREE = { n: 2, x: 6.4, z: -13.5 };                      // the great tree Hanuman hides in
export const THRONE = { n: 1, z: -17, top: 1.05, seat: 0.92 };       // the dais and the seat of the throne
export const STAND = { n: 1, z: -6 };                                // where Hanuman is made to stand before it

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
    haloMat: new THREE.SpriteMaterial({ map: glow('rgba(235,242,255,0.75)', 'rgba(150,185,255,0.28)'), blending: THREE.AdditiveBlending, ...common }),
    stoneMat: new Solid({ color: 0x8e98a6, ...pbr }), pondGeo: new THREE.CircleGeometry(4.6, 28).rotateX(-Math.PI / 2),
    seatGeo: new THREE.CylinderGeometry(1.25, 1.4, SITA.seat, 20), postGeo: new THREE.BoxGeometry(0.34, 1.05, 0.34), capGeo: new THREE.ConeGeometry(0.36, 0.3, 4),
  };
  return world.garden;
}

export function grove(world, chunk, c, r) {
  const g = chunk.group, k = garden(world); chunk.fx = [];
  const ground = new THREE.Mesh(k.grassGeo, k.grassMat); ground.position.z = -L / 2; g.add(ground);
  const path = new THREE.Mesh(world.roadGeo, k.pathMat); path.position.set(0, 0.012, -L / 2); g.add(path);
  if (c.n === 0) { const door = world.part(world.geo.front); door.rotation.y = Math.PI; g.add(door); }      // the palace door he comes out by
  const here = c.n === SITA.n;
  // Ashoka trees in flower along both sides, never two alike in size or turn
  for (const s of [-1, 1]) for (let j = 0; j < 3; j++) {
    const x = s * (6.4 + r() * 6), z = -3 - j * 7.6 - r() * 2.4;
    if (here && s > 0 && Math.abs(z - TREE.z) < 6) continue;      // room for the great tree
    const t = world.spawn('ashoka-tree'); t.position.set(x, 0, z); t.rotation.y = r() * 6.3; t.scale.setScalar(0.75 + r() * 0.55); g.add(t);
  }
  // shafts of moonlight between the trees
  for (let j = 0; j < 2; j++) {
    const s = j ? 1 : -1, b = new THREE.Mesh(k.beamGeo, k.beamMat); b.position.set(s * (2.5 + r() * 6), 8.4, -5 - r() * 14); b.rotation.z = -s * 0.32; g.add(b);
  }
  // fireflies that drift and wink, and petals coming down all the time
  const pts = (n, w, h, mat) => {
    const a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = (r() * 2 - 1) * w; a[i * 3 + 1] = r() * h; a[i * 3 + 2] = -r() * L; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(a, 3));
    const p = new THREE.Points(geo, mat); p.frustumCulled = false; g.add(p); return p;
  };
  chunk.fx.push({ type: 'fly', obj: pts(world.lite ? 40 : 70, 12, 3.6, k.flyMat), seed: r() * 10, y: 0.5 });
  chunk.fx.push({ type: 'fall', obj: pts(world.lite ? 50 : 90, 10, 18, k.petalMat), seed: r() * 9 });
  // low stone lanterns beside the path
  for (const s of [-1, 1]) for (const z of [-6, -18]) {
    const post = new THREE.Mesh(k.postGeo, k.stoneMat); post.position.set(s * 4.7, 0.52, z); g.add(post);
    const cap = new THREE.Mesh(k.capGeo, k.stoneMat); cap.position.set(s * 4.7, 1.5, z); cap.rotation.y = Math.PI / 4; g.add(cap);
    world.flame(chunk, s * 4.7, 1.22, z, 0.3, r() * 10);
    chunk.braziers.push(new THREE.Vector3(s * 4.7, g.position.y + 1.3, g.position.z + z));
  }
  if (c.n === 1) {      // a lotus pond that holds the sky
    const pond = new THREE.Mesh(k.pondGeo, world.waterMat); pond.position.set(-10, 0.03, -12); g.add(pond);
    for (let i = 0; i < 9; i++) { const a = r() * 6.3, d = r() * 3.6, l = new THREE.Sprite(k.lotusMat); l.position.set(-10 + Math.cos(a) * d, 0.28, -12 + Math.sin(a) * d); l.scale.setScalar(0.55 + r() * 0.4); g.add(l); }
  }
  if (here) {      // the great tree, her seat beneath it, and a soft light that seems to come from her
    const t = world.spawn('ashoka-tree'); t.position.set(TREE.x, 0, TREE.z); t.scale.setScalar(1.75); t.rotation.y = 2.2; g.add(t);
    const seat = new THREE.Mesh(k.seatGeo, k.stoneMat); seat.position.set(SITA.x, SITA.seat / 2, SITA.z); g.add(seat);
    const halo = new THREE.Sprite(k.haloMat); halo.position.set(SITA.x, 1.7, SITA.z); halo.scale.setScalar(8.5); g.add(halo); chunk.fx.push({ type: 'pulse', obj: halo, size: 8.5 });
    const b = new THREE.Mesh(k.beamGeo, k.beamMat); b.position.set(SITA.x - 1.2, 8.6, SITA.z + 0.4); b.rotation.z = 0.2; b.scale.set(1.5, 1, 1); g.add(b);
    for (let i = 0; i < 10; i++) { const a = i / 10 * 6.3, l = new THREE.Sprite(k.lotusMat); l.position.set(SITA.x + Math.cos(a) * 1.75, 0.16, SITA.z + Math.sin(a) * 1.75); l.scale.setScalar(0.42); g.add(l); }
  }
}

// ── Ravana's court ──
function court(world) {
  if (world.courtKit) return world.courtKit;
  const Solid = world.lite ? THREE.MeshLambertMaterial : THREE.MeshStandardMaterial;
  const gold = world.lite ? { color: 0xe0a93e, emissive: 0x3a2406 } : { color: 0xe2ab45, metalness: 1, roughness: 0.28, envMapIntensity: 1.6, emissive: 0x241503 };
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
  world.courtKit = {
    gold: new Solid(gold), dark: new Solid({ color: 0x241a16, ...(world.lite ? {} : { roughness: 0.6, metalness: 0.2 }) }), red: new Solid({ color: 0x8a1418, ...(world.lite ? {} : { roughness: 0.85 }) }),
    carpetMat: new Solid({ map: carpet, ...(world.lite ? {} : { roughness: 0.95, metalness: 0 }) }), carpetGeo: new THREE.PlaneGeometry(4.4, L).rotateX(-Math.PI / 2),
    bannerMat: new THREE.MeshBasicMaterial({ map: banner, side: THREE.DoubleSide }), bannerGeo: new THREE.PlaneGeometry(1.5, 4.8),
    sunMat: new THREE.MeshBasicMaterial({ map: sun, fog: false }), sunGeo: new THREE.CircleGeometry(4.5, 48),
    rayMat: new THREE.SpriteMaterial({ map: glow('rgba(255,225,150,0.6)', 'rgba(255,170,60,0.22)'), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false }),
    black: new THREE.MeshBasicMaterial({ color: 0x050302, fog: false }),
  };
  return world.courtKit;
}

export function throne(world, chunk, c, r) {
  const g = chunk.group, k = court(world); chunk.fx = [];
  const box = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); g.add(m); return m; };
  g.add(world.part(world.geo.hall));
  if (c.n === 0) g.add(world.part(world.geo.front));
  const carpet = new THREE.Mesh(k.carpetGeo, k.carpetMat); carpet.position.set(0, 0.02, -L / 2); g.add(carpet);
  for (const z of palace.HALL_LAMPS) {
    world.flame(chunk, 0, palace.LAMP_AT + 0.25, z, 0.55, r() * 10);
    chunk.braziers.push(new THREE.Vector3(0, g.position.y + palace.LAMP_AT - 1.5, g.position.z + z));
  }
  const last = c.n === THRONE.n;
  for (const s of [-1, 1]) {
    for (const z of palace.HALL_PILLARS) {      // the banners of Lanka on every pillar, facing the aisle
      const b = new THREE.Mesh(k.bannerGeo, k.bannerMat); b.position.set(s * (palace.HALL_PX - 0.62), 5.6, z); b.rotation.y = s < 0 ? Math.PI / 2 : -Math.PI / 2; g.add(b);
    }
    // the lords and warriors of Lanka, standing in ranks down both sides, turned toward the throne
    const rows = world.lite ? [3.3] : [3.2, 4.7], to = last ? -9 : -23.2;
    for (const x of rows) for (let z = -1.2 - (x > 4 ? 1 : 0); z > to; z -= 2.05) {
      const f = world.spawn('courtier'); f.position.set(s * (x + r() * 0.3), 0, z + r() * 0.5); f.scale.setScalar(0.94 + r() * 0.2);
      f.rotation.y = (s > 0 ? -2.2 : 2.2) + (r() - 0.5) * 0.5; g.add(f);
    }
  }
  if (!last) return;
  // the dais: three broad steps of dark stone edged with gold
  const Z = THRONE.z;
  [[12, 7.6, 0], [10, 6.2, 0.35], [8, 4.9, 0.7]].forEach(([w, d, y], i) => { box(w, 0.35, d, k.dark, 0, y + 0.175, Z + 1.6 - i * 0.2); box(w + 0.1, 0.07, d + 0.1, k.gold, 0, y + 0.35, Z + 1.6 - i * 0.2); });
  const T = THRONE.top;
  box(2.5, 0.22, 1.6, k.gold, 0, T + THRONE.seat - 0.11, Z);                         // the seat
  box(2.3, THRONE.seat - 0.22, 1.4, k.dark, 0, T + (THRONE.seat - 0.22) / 2, Z);     // its body
  box(2.3, 0.1, 1.45, k.red, 0, T + THRONE.seat + 0.05, Z + 0.02);                   // a red cushion
  box(2.9, 4.6, 0.36, k.gold, 0, T + 2.3, Z - 0.95);                                 // the high back
  const arch = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 0.36, 28, 1, false, 0, Math.PI), k.gold); arch.rotation.set(Math.PI / 2, Math.PI / 2, 0); arch.position.set(0, T + 4.6, Z - 0.95); g.add(arch);
  box(2.2, 3.4, 0.1, k.red, 0, T + 2.5, Z - 0.74);                                   // red cloth down the back
  for (const s of [-1, 1]) {
    box(0.4, 0.5, 1.6, k.gold, s * 1.42, T + THRONE.seat + 0.3, Z);                  // armrests, each ending in a golden ball
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), k.gold); ball.position.set(s * 1.42, T + THRONE.seat + 0.62, Z + 0.8); g.add(ball);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 6.6, 8), k.gold); pole.position.set(s * 2.4, T + 3.3, Z - 0.9); g.add(pole);
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.7, 8), k.gold); fin.position.set(s * 2.4, T + 6.95, Z - 0.9); g.add(fin);
    world.brazier(chunk, s * 5, 0, Z + 5.6, r() * 10);
    const guard = world.spawn('courtier'); guard.position.set(s * 3.3, T - 0.35, Z + 0.6); guard.rotation.y = s > 0 ? -0.5 : 0.5; guard.scale.setScalar(1.12); g.add(guard);
  }
  const shade = new THREE.Mesh(new THREE.ConeGeometry(2.7, 0.9, 20, 1, true), k.red); shade.position.set(0, T + 6.9, Z - 0.2); g.add(shade);      // the royal parasol
  const rim = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.07, 6, 28), k.gold); rim.rotation.x = Math.PI / 2; rim.position.set(0, T + 6.46, Z - 0.2); g.add(rim);
  // behind him the wall of the hall, and in its great doorway a disc of beaten gold that catches every flame
  const wall = world.part(world.geo.front); wall.rotation.y = Math.PI; wall.position.z = Z - 3.2; g.add(wall);
  const dark = new THREE.Mesh(new THREE.PlaneGeometry(2 * palace.HALL_HALF, palace.HALL_TOP), k.black); dark.position.set(0, palace.HALL_TOP / 2, Z - 4.6); g.add(dark);
  const sun = new THREE.Mesh(k.sunGeo, k.sunMat); sun.position.set(0, T + 4.3, Z - 2.4); g.add(sun);
  const rays = new THREE.Sprite(k.rayMat); rays.position.set(0, T + 4.3, Z - 2.2); rays.scale.setScalar(17); g.add(rays); chunk.fx.push({ type: 'pulse', obj: rays, size: 17 });
}

// The small living things of these places: fireflies drifting, petals falling, lights breathing.
export function animate(chunk, time) {
  for (const f of chunk.fx) {
    if (f.type === 'fly') { f.obj.position.set(Math.sin(time * 0.31 + f.seed) * 0.9, f.y + Math.sin(time * 0.53 + f.seed * 2) * 0.35, Math.cos(time * 0.27 + f.seed) * 0.7); f.obj.material.opacity = 0.55 + Math.sin(time * 2.1 + f.seed) * 0.4; }
    else if (f.type === 'fall') { f.obj.position.y = -((time * 0.55 + f.seed) % 9); f.obj.position.x = Math.sin(time * 0.4 + f.seed) * 0.6; }
    else if (f.type === 'pulse') f.obj.scale.setScalar(f.size * (1 + Math.sin(time * 1.3) * 0.05));
  }
}
