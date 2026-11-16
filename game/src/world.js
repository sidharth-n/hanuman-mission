// The street of Lanka at night: an endless row of chunks built from a small kit of models, recycled as he runs.
import * as THREE from 'three';
import { LANES } from './hero.js';
import { rng } from './build.js';
import { kit, footpath, lampBeam, arrowVolley, greatArrow, streetGate, SLOT } from './buildings.js';

export const CHUNK = 24;
const ROAD = 3.9;        // half width of the paved road (three lanes)
const FRONT = 6.2;       // distance from the centre line to the house fronts
const AHEAD = 4;

// name -> [height in metres, extra yaw so the front faces +Z]
const KIT = {
  'market-stall': [2.7, 0],
  'rakshasa-statue': [4.6, 0], 'brazier': [2.3, 0], 'cart': [1.75, 0], 'pots': [1.05, 0], 'barricade': [1.15, 0],
  'palace': [70, 0],
};

// rows of obstacles across the three lanes; every row leaves a way through
const ROWS = [
  ['pots', null, null], [null, 'pots', null], [null, null, 'pots'],
  ['cart', null, 'pots'], ['pots', null, 'cart'], ['cart', 'cart', null], [null, 'cart', 'cart'], ['cart', null, 'cart'],
  ['barricade', 'barricade', 'barricade'], ['beam', 'beam', 'beam'], ['barricade', 'cart', 'barricade'],
  ['beam', 'cart', 'beam'], [null, 'barricade', 'cart'], ['cart', 'beam', null],
  ['arrows', null, null], [null, null, 'arrows'], ['arrows', 'arrows', null], [null, 'arrows', 'arrows'], ['arrows', 'pots', 'arrows'], ['cart', 'arrows', null],
];
const KIND = { pots: 'low', barricade: 'low', cart: 'block', beam: 'high', arrows: 'block' };
const TOP = { pots: 1.0, barricade: 1.1, cart: 1.55, arrows: 1.25, beam: 0 };      // how high each stands
const HALF_DEPTH = { pots: 0.6, barricade: 0.55, cart: 1.25, beam: 0.35, arrows: 0.7 };
const ARROWS_FROM = 34, ARROW_SKY = 16;      // metres ahead of him at which a volley is loosed; height it falls from

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

export class World {
  constructor(scene, models, tex) {
    this.scene = scene;
    // every building shares one material and one texture sheet
    for (const t of [tex.city, tex.glow, tex.paving]) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; }
    this.cityMat = new THREE.MeshStandardMaterial({ map: tex.city, emissiveMap: tex.glow, emissive: 0xffffff, emissiveIntensity: 1.25, vertexColors: true, roughness: 0.9, metalness: 0, envMapIntensity: 0.5 });
    this.kit = kit();
    this.houses = this.kit.filter(k => k.type === 'house'); this.towers = this.kit.filter(k => k.type === 'tower');
    this.court = this.kit.find(k => k.type === 'court');
    this.footGeo = footpath(CHUNK, ROAD, FRONT + 0.75);
    this.beamGeo = lampBeam(); this.arrowGeo = arrowVolley(); this.boltGeo = greatArrow(); this.gateGeo = streetGate();
    this.markMat = new THREE.MeshBasicMaterial({ map: glowTexture('rgba(255,90,40,0.55)', 'rgba(255,60,20,0.2)'), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
    this.markGeo = new THREE.CircleGeometry(1.15, 20).rotateX(-Math.PI / 2);
    this.prefabs = {};
    for (const [name, [height, yaw]] of Object.entries(KIT)) if (models[name]) this.prefabs[name] = this.prefab(models[name].scene, height, yaw);

    const map = tex.paving; map.wrapS = map.wrapT = THREE.MirroredRepeatWrapping; map.repeat.set(2 * ROAD / 4, CHUNK / 4);
    this.roadMat = new THREE.MeshStandardMaterial({ map, color: 0xb9ad9f, roughness: 0.92, metalness: 0 });
    this.sideMat = new THREE.MeshStandardMaterial({ color: 0x14110e, roughness: 1, metalness: 0 });
    this.roadGeo = new THREE.PlaneGeometry(2 * ROAD, CHUNK).rotateX(-Math.PI / 2);
    this.sideGeo = new THREE.PlaneGeometry(26, CHUNK).rotateX(-Math.PI / 2);

    this.flameTex = glowTexture('rgba(255,244,190,1)', 'rgba(255,130,30,0.85)');
    this.flameMat = new THREE.SpriteMaterial({ map: this.flameTex, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    this.poolMat = new THREE.MeshBasicMaterial({ map: glowTexture('rgba(255,150,60,0.32)', 'rgba(255,110,30,0.12)'), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
    this.poolGeo = new THREE.CircleGeometry(6.5, 24).rotateX(-Math.PI / 2);
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

    this.torches = [new THREE.PointLight(0xff8a3c, 0, 26, 1.6), new THREE.PointLight(0xff8a3c, 0, 26, 1.6)];
    this.torches.forEach(l => scene.add(l));
    this.sky(models, tex.sky);
    this.behind = 3;      // how many stretches of street to keep behind him (more on the title screen, which looks back)
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

  sky(models, picture) {
    const far = new THREE.Group(); this.far = far; this.scene.add(far);
    // the galaxy: one picture spread over the half of the sky ahead and mirrored behind, from just below the horizon to high overhead
    picture.colorSpace = THREE.SRGBColorSpace; picture.wrapS = THREE.MirroredRepeatWrapping; picture.wrapT = THREE.ClampToEdgeWrapping;
    picture.repeat.set(2, 2.4); picture.offset.set(0, -1.133);
    this.skyMat = new THREE.MeshBasicMaterial({ map: picture, side: THREE.BackSide, fog: false, depthWrite: false });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(560, 32, 20), this.skyMat); dome.renderOrder = -2; far.add(dome);
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
    for (let i = 0; i < 160; i++) { const a = r() * Math.PI * 2, h = 0.08 + r() * 0.9, d = 380; pts.push(Math.cos(a) * d * Math.cos(h), d * Math.sin(h), Math.sin(a) * d * Math.cos(h)); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    // a few bright stars that twinkle, in two sets out of step with each other
    this.twinkle = [0, 1].map(n => {
      const part = new THREE.BufferGeometry(); part.setAttribute('position', new THREE.Float32BufferAttribute(pts.filter((_, j) => Math.floor(j / 3) % 2 === n), 3));
      const m = new THREE.PointsMaterial({ color: n ? 0xfff0d8 : 0xd6e2ff, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8, depthWrite: false });
      far.add(new THREE.Points(part, m)); return m;
    });
  }

  beam() { return new THREE.Mesh(this.beamGeo, this.cityMat); }

  // Burning arrows: a red mark on the lane first, then the volley drops from the sky as he comes near.
  arrows(g, x, z, big) {
    const o = new THREE.Mesh(big ? this.boltGeo : this.arrowGeo, this.cityMat); o.position.y = ARROW_SKY; o.visible = false;
    const mark = new THREE.Mesh(this.markGeo, this.markMat); mark.position.set(x, 0.03, z); g.add(mark);
    const fire = new THREE.Sprite(this.flameMat); fire.position.set(x, 0.75, z - 0.2); fire.visible = false; fire.userData.seed = x + z; fire.userData.base = big ? 1.5 : 0.8; if (big) fire.position.y = 1.3; g.add(fire);
    this.flames.push(fire); o.userData.volley = { fire, mark, t: -1, big };
    return o;
  }

  build(i) {
    const g = new THREE.Group(); g.position.z = -i * CHUNK;
    const r = rng(i * 7919 + 13);
    const chunk = { i, group: g, obstacles: [], coins: [], winds: [], braziers: [], buildings: [] };
    const road = new THREE.Mesh(this.roadGeo, this.roadMat); road.position.z = -CHUNK / 2; g.add(road);
    for (const s of [-1, 1]) { const side = new THREE.Mesh(this.sideGeo, this.sideMat); side.position.set(s * (ROAD + 13), -0.01, -CHUNK / 2); g.add(side); }
    g.add(new THREE.Mesh(this.footGeo, this.cityMat));

    for (const s of [-1, 1]) {
      const face = s < 0 ? Math.PI / 2 : -Math.PI / 2;      // fronts face the street
      const stall = r() < 0.55 ? Math.floor(r() * 4) : -1;
      let last = -1;
      for (let k = 0; k < CHUNK / SLOT; k++) {
        const z = -SLOT / 2 - k * SLOT, statue = i % 4 === 1 && k === 1;
        let b;
        do {
          b = statue ? this.court : r() < 0.2 ? this.towers[Math.floor(r() * this.towers.length)] : this.houses[Math.floor(r() * this.houses.length)];
        } while (!statue && (b.id === last || (k === stall && b.veranda)));
        last = b.id;
        // the brazier stands at one corner of every slot: use the version of the building lit from that corner
        const further = k % 2 === 0, lit = (s < 0) === further ? 1 : -1;
        const o = new THREE.Mesh(b.geo[lit], this.cityMat);
        o.position.set(s * FRONT, 0, z); o.rotation.y = face; g.add(o);
        chunk.buildings.push({ x: s * (FRONT + 1.5), z: g.position.z + z, lz: z, h: b.height - 1, lit: false });
        if (statue) { const st = this.spawn('rakshasa-statue'); st.position.set(s * (FRONT + 0.25), 0.16, z); st.rotation.y = face; g.add(st); }
        if (k === stall && !statue) { const st = this.spawn('market-stall'); st.position.set(s * (ROAD + 1.15), 0.14, z); st.rotation.y = face; g.add(st); }
      }
      // a taller tower one street back, so the city reads as deep
      const far = new THREE.Mesh(this.towers[Math.floor(r() * this.towers.length)].geo[1], this.cityMat);
      far.position.set(s * (FRONT + 12 + r() * 5), 0, -r() * CHUNK); far.rotation.y = face; far.scale.setScalar(1.5 + r() * 0.5); g.add(far);
      for (const z of [-6, -18]) {
        const b = this.spawn('brazier'); b.position.set(s * (ROAD + 0.55), 0.14, z); g.add(b);
        const f = new THREE.Sprite(this.flameMat); f.position.set(b.position.x, 2.89, z); f.scale.setScalar(1.9); g.add(f);
        this.flames.push(f); f.userData.seed = r() * 10; f.userData.base = 1;
        const pool = new THREE.Mesh(this.poolGeo, this.poolMat); pool.position.set(b.position.x * 0.8, 0.02, z); g.add(pool);
        chunk.braziers.push(new THREE.Vector3(b.position.x, 2.9, g.position.z + z));
      }
    }
    if (i % 3 === 2) { const a = new THREE.Mesh(this.gateGeo, this.cityMat); a.position.set(0, 0.14, -12); g.add(a); }

    if (i >= 2) for (const z of [-4, -16]) {
      const row = ROWS[Math.floor(r() * ROWS.length)];
      let coinLane = row.findIndex(x => x === null); if (coinLane < 0) coinLane = Math.floor(r() * 3);
      row.forEach((type, lane) => {
        if (!type) return;
        const o = type === 'beam' ? this.beam() : type === 'arrows' ? this.arrows(g, LANES[lane], z, r() < 0.35) : this.spawn(type);
        o.position.set(LANES[lane], 0, z);
        if (type === 'pots') o.rotation.y = r() * 6.3;
        g.add(o);
        chunk.obstacles.push({ type, kind: KIND[type], lane, x: LANES[lane], z: g.position.z + z, hd: HALF_DEPTH[type], top: TOP[type], wall: row.every(Boolean), mesh: o, done: false });
      });
      const arc = row[coinLane] && KIND[row[coinLane]] === 'low';
      if (r() < 0.8) for (let k = 0; k < 5; k++) {
        const c = new THREE.Sprite(this.lampMat), dz = (k - 2) * 1.5; c.scale.setScalar(0.85);
        c.position.set(LANES[coinLane], 1.0 + (arc ? Math.max(0, 1.5 - Math.abs(dz) * 0.5) : 0), z - dz); g.add(c);
        chunk.coins.push({ mesh: c, x: c.position.x, y: c.position.y, z: g.position.z + c.position.z, got: false });
      }
    }
    // now and then a gust of wind to gather: two of them charge his flight
    if (i >= 3 && r() < 0.38) {
      const w = new THREE.Sprite(this.windMat), lane = Math.floor(r() * 3); w.scale.setScalar(1.5); w.position.set(LANES[lane], 1.35, -10); g.add(w);
      chunk.winds.push({ mesh: w, x: LANES[lane], z: g.position.z - 10, got: false });
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
    for (let i = at - this.behind; i <= at + AHEAD; i++) if (!this.chunks.has(i)) this.chunks.set(i, this.build(i));
    for (const [i, c] of this.chunks) if (i < at - this.behind || i > at + AHEAD) { this.drop(c); this.chunks.delete(i); }
    this.twinkle[0].opacity = 0.55 + Math.sin(this.time * 2.3) * 0.35; this.twinkle[1].opacity = 0.55 + Math.sin(this.time * 1.7 + 2) * 0.35;

    for (const f of this.flames) { const s = 1.7 + Math.sin(this.time * 11 + f.userData.seed) * 0.22 + Math.sin(this.time * 23 + f.userData.seed * 3) * 0.12; const b = f.userData.base; f.scale.set(s * b, s * 1.25 * b, 1); }
    for (const c of this.chunks.values()) for (const ob of c.obstacles) {
      const v = ob.mesh.userData.volley; if (!v || v.t > 1) continue;
      if (v.t < 0) { if (ob.z > heroZ - ARROWS_FROM) { v.t = 0; ob.mesh.visible = true; v.z0 = ob.mesh.position.z; } else continue; }
      v.t += dt / 0.45; const k = Math.min(1, v.t);
      ob.mesh.position.y = ARROW_SKY * (1 - k * k);
      if (v.big) ob.mesh.position.z = v.z0 - (1 - k) * 26;      // the great bolt comes in low from the walls ahead
      if (k >= 1) { v.fire.visible = true; v.t = 2; }
    }
    for (const c of this.chunks.values()) for (const w of c.winds) if (!w.got) { w.mesh.material.rotation = this.time * 2.2; w.mesh.position.y = 1.35 + Math.sin(this.time * 2 + w.z) * 0.12; }
    for (const c of this.chunks.values()) for (const k of c.coins) if (!k.got) k.mesh.position.y = k.y + Math.sin(this.time * 3 + k.z) * 0.07;

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
      const inward = b.x < 0 ? 1.2 : -1.2;
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
