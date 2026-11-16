// The street of Lanka at night: an endless row of chunks built from a small kit of models, recycled as he runs.
import * as THREE from 'three';
import { LANES } from './hero.js';

export const CHUNK = 24;
const ROAD = 3.9;        // half width of the paved road (three lanes)
const FRONT = 5.5;       // distance from the centre line to the house fronts
const AHEAD = 4, BEHIND = 1;

// name -> [height in metres, extra yaw so the front faces +Z]
const KIT = {
  'house': [6.6, 0], 'tower-house': [11.5, 0], 'market-stall': [2.7, 0], 'street-arch': [12.5, 0],
  'rakshasa-statue': [4.6, 0], 'brazier': [2.3, 0], 'cart': [1.75, 0], 'pots': [1.05, 0], 'barricade': [1.15, 0],
  'palace': [70, 0],
};

// rows of obstacles across the three lanes; every row leaves a way through
const ROWS = [
  ['pots', null, null], [null, 'pots', null], [null, null, 'pots'],
  ['cart', null, 'pots'], ['pots', null, 'cart'], ['cart', 'cart', null], [null, 'cart', 'cart'], ['cart', null, 'cart'],
  ['barricade', 'barricade', 'barricade'], ['beam', 'beam', 'beam'], ['barricade', 'cart', 'barricade'],
  ['beam', 'cart', 'beam'], [null, 'barricade', 'cart'], ['cart', 'beam', null],
];
const KIND = { pots: 'low', barricade: 'low', cart: 'block', beam: 'high' };
const HALF_DEPTH = { pots: 0.6, barricade: 0.55, cart: 1.25, beam: 0.35 };

function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

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

function paving() {
  const t = canvasTexture(512, (g, s) => {
    const r = rng(11);
    g.fillStyle = '#15120f'; g.fillRect(0, 0, s, s);
    const n = 8, cell = s / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const off = (y % 2) * cell / 2, l = 26 + r() * 16;
      g.fillStyle = `hsl(${28 + r() * 12}, ${8 + r() * 8}%, ${l}%)`;
      g.fillRect(((x * cell + off) % s) + 2, y * cell + 2, cell - 4, cell - 4);
      if (x * cell + off + cell > s) g.fillRect(-2, y * cell + 2, (x * cell + off + cell) - s - 2, cell - 4);
    }
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.25})`; g.fillRect(r() * s, r() * s, 2 + r() * 3, 2 + r() * 3); }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}

export class World {
  constructor(scene, models) {
    this.scene = scene;
    this.prefabs = {};
    for (const [name, [height, yaw]] of Object.entries(KIT)) if (models[name]) this.prefabs[name] = this.prefab(models[name].scene, height, yaw);

    const map = paving(); map.repeat.set(2 * ROAD / 3.2, CHUNK / 3.2);
    this.roadMat = new THREE.MeshStandardMaterial({ map, roughness: 0.92, metalness: 0 });
    this.sideMat = new THREE.MeshStandardMaterial({ color: 0x14110e, roughness: 1, metalness: 0 });
    this.roadGeo = new THREE.PlaneGeometry(2 * ROAD, CHUNK).rotateX(-Math.PI / 2);
    this.sideGeo = new THREE.PlaneGeometry(26, CHUNK).rotateX(-Math.PI / 2);

    this.flameTex = glowTexture('rgba(255,244,190,1)', 'rgba(255,130,30,0.85)');
    this.flameMat = new THREE.SpriteMaterial({ map: this.flameTex, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    this.poolMat = new THREE.MeshBasicMaterial({ map: glowTexture('rgba(255,150,60,0.32)', 'rgba(255,110,30,0.12)'), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
    this.poolGeo = new THREE.CircleGeometry(6.5, 24).rotateX(-Math.PI / 2);
    this.coinGeo = new THREE.IcosahedronGeometry(0.2, 0);
    this.coinMat = new THREE.MeshBasicMaterial({ color: 0xffc94a });
    this.woodMat = new THREE.MeshStandardMaterial({ color: 0x4a2f1c, roughness: 0.8 });
    this.lampMat = new THREE.MeshBasicMaterial({ color: 0xffb347 });
    this.postGeo = new THREE.CylinderGeometry(0.09, 0.11, 1.75, 6);
    this.barGeo = new THREE.BoxGeometry(2.3, 0.2, 0.22);
    this.lampGeo = new THREE.SphereGeometry(0.1, 8, 6);

    this.torches = [new THREE.PointLight(0xff8a3c, 0, 26, 1.6), new THREE.PointLight(0xff8a3c, 0, 26, 1.6)];
    this.torches.forEach(l => scene.add(l));
    this.sky(models);
    this.chunks = new Map();
    this.flames = [];
    this.time = 0;
  }

  // Centre a model on its footprint, stand it on the ground and scale it to a real-world height.
  prefab(src, height, yaw) {
    src.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(src);
    const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    src.position.set(-c.x, -box.min.y, -c.z);
    const inner = new THREE.Group(); inner.add(src); inner.scale.setScalar(height / size.y); inner.rotation.y = yaw;
    src.traverse(o => { if (o.isMesh) { o.material.envMapIntensity = 0.5; o.material.metalness = Math.min(o.material.metalness, 0.45); } });
    const holder = new THREE.Group(); holder.add(inner);
    holder.userData.size = size.multiplyScalar(height / size.y);
    return holder;
  }

  spawn(name) { const o = this.prefabs[name].clone(); o.userData = this.prefabs[name].userData; return o; }

  sky(models) {
    const far = new THREE.Group(); this.far = far; this.scene.add(far);
    const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,255,245,1)', 'rgba(190,205,255,0.35)'), fog: false, depthWrite: false }));
    moon.scale.setScalar(60); moon.position.set(46, 92, -260); far.add(moon);
    const disc = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xf6f3e4, fog: false, depthWrite: false, map: canvasTexture(64, (g, s) => { g.fillStyle = '#fff'; g.beginPath(); g.arc(s / 2, s / 2, s / 2 - 2, 0, 7); g.fill(); }) }));
    disc.scale.setScalar(15); disc.position.copy(moon.position); far.add(disc);
    if (this.prefabs.palace) {
      const p = this.spawn('palace');
      p.traverse(o => { if (o.isMesh) o.material = new THREE.MeshBasicMaterial({ map: o.material.map, color: 0x8f7a5c, fog: false }); });
      p.position.set(0, 6, -235); far.add(p);
      const hill = new THREE.Mesh(new THREE.ConeGeometry(150, 46, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0x0a0d18, fog: false }));
      hill.position.set(0, -15, -240); far.add(hill);
    }
    const r = rng(5), pts = [];
    for (let i = 0; i < 500; i++) { const a = r() * Math.PI * 2, h = 0.08 + r() * 0.9, d = 380; pts.push(Math.cos(a) * d * Math.cos(h), d * Math.sin(h), Math.sin(a) * d * Math.cos(h)); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    far.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xcfd8ff, size: 1.4, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 })));
  }

  beam() {
    const g = new THREE.Group();
    for (const x of [-1.1, 1.1]) { const p = new THREE.Mesh(this.postGeo, this.woodMat); p.position.set(x, 0.875, 0); g.add(p); }
    const bar = new THREE.Mesh(this.barGeo, this.woodMat); bar.position.y = 1.72; g.add(bar);
    for (const x of [-0.7, 0, 0.7]) { const l = new THREE.Mesh(this.lampGeo, this.lampMat); l.position.set(x, 1.5, 0); g.add(l); }
    return g;
  }

  build(i) {
    const g = new THREE.Group(); g.position.z = -i * CHUNK;
    const r = rng(i * 7919 + 13);
    const chunk = { i, group: g, obstacles: [], coins: [], braziers: [], buildings: [] };
    const road = new THREE.Mesh(this.roadGeo, this.roadMat); road.position.z = -CHUNK / 2; g.add(road);
    for (const s of [-1, 1]) { const side = new THREE.Mesh(this.sideGeo, this.sideMat); side.position.set(s * (ROAD + 13), -0.01, -CHUNK / 2); g.add(side); }

    for (const s of [-1, 1]) {
      for (let z = 0; z > -CHUNK; z -= 6) {
        const statue = i % 4 === 1 && z === -6;
        const name = statue ? 'rakshasa-statue' : (r() < 0.28 ? 'tower-house' : 'house');
        const o = this.spawn(name), depth = o.userData.size.z;
        o.position.set(s * (FRONT + (statue ? 0.4 : depth / 2)), 0, z - 3);
        o.rotation.y = s < 0 ? Math.PI / 2 : -Math.PI / 2;      // fronts face the street
        g.add(o);
        chunk.buildings.push({ x: o.position.x, z: g.position.z + o.position.z, lz: o.position.z, h: o.userData.size.y, lit: false });
      }
      if (r() < 0.55) { const st = this.spawn('market-stall'); st.position.set(s * (ROAD + 1.15), 0, -2 - Math.floor(r() * 3) * 6 - 3); st.rotation.y = s < 0 ? Math.PI / 2 : -Math.PI / 2; g.add(st); }
      for (const z of [-6, -18]) {
        const b = this.spawn('brazier'); b.position.set(s * (ROAD + 0.55), 0, z); g.add(b);
        const f = new THREE.Sprite(this.flameMat); f.position.set(b.position.x, 2.75, z); f.scale.setScalar(1.9); g.add(f);
        this.flames.push(f); f.userData.seed = r() * 10; f.userData.base = 1;
        const pool = new THREE.Mesh(this.poolGeo, this.poolMat); pool.position.set(b.position.x * 0.8, 0.02, z); g.add(pool);
        chunk.braziers.push(new THREE.Vector3(b.position.x, 2.9, g.position.z + z));
      }
    }
    if (i % 3 === 2) { const a = this.spawn('street-arch'); a.position.set(0, 0, -12); g.add(a); }

    if (i >= 2) for (const z of [-4, -16]) {
      const row = ROWS[Math.floor(r() * ROWS.length)];
      let coinLane = row.findIndex(x => x === null); if (coinLane < 0) coinLane = Math.floor(r() * 3);
      row.forEach((type, lane) => {
        if (!type) return;
        const o = type === 'beam' ? this.beam() : this.spawn(type);
        o.position.set(LANES[lane], 0, z);
        if (type === 'pots') o.rotation.y = r() * 6.3;
        g.add(o);
        chunk.obstacles.push({ type, kind: KIND[type], lane, x: LANES[lane], z: g.position.z + z, hd: HALF_DEPTH[type], mesh: o, done: false });
      });
      const arc = row[coinLane] && KIND[row[coinLane]] === 'low';
      if (r() < 0.8) for (let k = 0; k < 5; k++) {
        const c = new THREE.Mesh(this.coinGeo, this.coinMat), dz = (k - 2) * 1.5;
        c.position.set(LANES[coinLane], 1.0 + (arc ? Math.max(0, 1.5 - Math.abs(dz) * 0.5) : 0), z - dz); g.add(c);
        chunk.coins.push({ mesh: c, x: c.position.x, y: c.position.y, z: g.position.z + c.position.z, got: false });
      }
    }
    this.scene.add(g);
    return chunk;
  }

  drop(chunk) {
    this.scene.remove(chunk.group);
    this.flames = this.flames.filter(f => f.parent !== chunk.group);
  }

  reset() { for (const c of this.chunks.values()) this.drop(c); this.chunks.clear(); this.flames = []; }

  update(dt, heroZ) {
    this.time += dt;
    const at = Math.floor(-heroZ / CHUNK);
    for (let i = Math.max(0, at - BEHIND); i <= at + AHEAD; i++) if (!this.chunks.has(i)) this.chunks.set(i, this.build(i));
    for (const [i, c] of this.chunks) if (i < at - BEHIND || i > at + AHEAD) { this.drop(c); this.chunks.delete(i); }

    for (const f of this.flames) { const s = 1.7 + Math.sin(this.time * 11 + f.userData.seed) * 0.22 + Math.sin(this.time * 23 + f.userData.seed * 3) * 0.12; const b = f.userData.base; f.scale.set(s * b, s * 1.25 * b, 1); }
    for (const c of this.chunks.values()) for (const k of c.coins) if (!k.got) k.mesh.rotation.y += dt * 4;

    // two real lights ride on the nearest braziers ahead of him; the rest of the glow is painted on
    const near = [];
    for (const c of this.chunks.values()) for (const b of c.braziers) if (b.z < heroZ + 4 && b.z > heroZ - 30) near.push(b);
    near.sort((a, b) => b.z - a.z);
    const flick = 1 + Math.sin(this.time * 13) * 0.08;
    this.torches.forEach((l, n) => { const b = near[n]; if (b) { l.position.copy(b); l.intensity = 42 * flick; } else l.intensity = 0; });
    this.far.position.z = heroZ;
  }

  fire(group, x, y, z, size) {
    const f = new THREE.Sprite(this.flameMat); f.position.set(x, y, z);
    f.userData.seed = Math.random() * 10; f.userData.base = size; group.add(f); this.flames.push(f);
  }

  // Fire run: every building he has reached goes up in flames.
  igniteUpTo(heroZ) {
    let lit = 0;
    for (const c of this.chunks.values()) for (const b of c.buildings) {
      if (b.lit || b.z < heroZ - 18) continue;      // catches a little ahead of him so the player sees it spread
      b.lit = true; lit++;
      const inward = b.x < 0 ? 1.6 : -1.6;
      this.fire(c.group, b.x + inward, b.h * 0.95, b.lz, 1.7 + b.h * 0.14);
      this.fire(c.group, b.x + inward * 1.5, b.h * 0.5, b.lz + 1.4, 1.2);
    }
    return lit;
  }

  burn(o, chunk) { this.fire(chunk.group, o.x, 0.9, o.z - chunk.group.position.z, 1.3); }

  nearby(heroZ) {
    const at = Math.floor(-heroZ / CHUNK), out = [];
    for (const i of [at, at + 1]) { const c = this.chunks.get(i); if (c) out.push(c); }
    return out;
  }
}
