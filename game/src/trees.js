// The old Ashoka trees of the grove, grown in code: a thick twisted trunk on spreading roots, great limbs that arch
// up and out until the canopies of neighbours meet overhead, leaves in dense clusters, and blossom hanging in chains.
// A tree is two meshes that share one painted sheet: the wood, and the leaves and blossom (flat cards, cut out by
// the picture on them). Moonlight is painted into the colours once, so on a phone a tree costs nothing to light.
import * as THREE from 'three';
import { rng } from './build.js';

const S = 1024;      // the sheet: bark down the left half, a cluster of leaves top right, chains of blossom below it
const BARK = [4 / S, 508 / S, 0, 1], LEAF = [516 / S, 1020 / S, 0.5 + 4 / S, 1 - 4 / S], BLOOM = [516 / S, 764 / S, 4 / S, 0.5 - 4 / S];

function sheet() {
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), r = rng(4021);
  // bark: dark, fibrous, running up the trunk; drawn so that its left edge meets its right
  g.save(); g.beginPath(); g.rect(0, 0, 512, S); g.clip();      // nothing of the bark strays onto the leaves beside it
  g.fillStyle = '#41352c'; g.fillRect(0, 0, 512, S);
  for (let i = 0; i < 520; i++) {
    const x0 = r() * 512, w = 1 + r() * 5, light = r() < 0.45;
    g.strokeStyle = light ? `rgba(${150 + r() * 50},${125 + r() * 40},${98 + r() * 30},${0.1 + r() * 0.2})` : `rgba(12,9,7,${0.2 + r() * 0.35})`; g.lineWidth = w;
    for (const off of [-512, 0, 512]) {
      g.beginPath(); let x = x0 + off, y = -20; g.moveTo(x, y); const sway = 4 + r() * 16, f = 0.006 + r() * 0.012, ph = r() * 6;
      while (y < S + 20) { y += 24; x = x0 + off + Math.sin(y * f + ph) * sway; g.lineTo(x, y); }
      g.stroke();
    }
  }
  for (let i = 0; i < 26; i++) {      // knots, and moss where the damp lies
    const x = r() * 512, y = r() * S, rad = 10 + r() * 22, k = g.createRadialGradient(x, y, 1, x, y, rad);
    if (r() < 0.5) { k.addColorStop(0, 'rgba(10,7,5,0.75)'); k.addColorStop(1, 'rgba(10,7,5,0)'); } else { k.addColorStop(0, 'rgba(70,96,58,0.5)'); k.addColorStop(1, 'rgba(70,96,58,0)'); }
    g.fillStyle = k; g.beginPath(); g.ellipse(x, y, rad * 0.7, rad * 1.5, 0, 0, 7); g.fill();
  }
  g.restore();
  // one leaf: long, pointed, a paler rib down the middle
  const leaf = (x, y, len, wid, ang, hue, lum) => {
    g.save(); g.translate(x, y); g.rotate(ang);
    g.fillStyle = `hsl(${hue},${34 + r() * 18}%,${lum}%)`;
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * 0.38, -wid, len, 0); g.quadraticCurveTo(len * 0.38, wid, 0, 0); g.fill();
    g.strokeStyle = `hsla(${hue - 8},30%,${lum + 13}%,0.6)`; g.lineWidth = 1; g.beginPath(); g.moveTo(2, 0); g.lineTo(len - 3, 0); g.stroke();
    g.restore();
  };
  // a cluster of leaves: several sprays, ragged at the edge, the darkest laid first
  const cx = 768, cy = 256, sprays = [];
  for (let i = 0; i < 13; i++) { const a = r() * 6.283, d = Math.sqrt(r()) * 150; sprays.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d, 58 + r() * 44]); }
  for (let pass = 0; pass < 3; pass++) for (const [sx, sy, sr] of sprays) {
    g.strokeStyle = 'rgba(40,30,22,0.9)'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, cy); g.lineTo(sx, sy); g.stroke();
    for (let i = 0; i < 20; i++) {
      const a = r() * 6.283, d = Math.sqrt(r()) * sr, x = sx + Math.cos(a) * d, y = sy + Math.sin(a) * d;
      leaf(x, y, 34 + r() * 30, 7 + r() * 6, a * 0.5 + 1.2 + (r() - 0.5) * 1.6, 118 + r() * 42, 9 + pass * 6 + r() * 7);      // they droop
    }
  }
  // chains of blossom: orange and red florets thick along a hanging stem, thinning to its tip
  const reds = ['#ff5a14', '#ff7a1c', '#e8380f', '#ff9426', '#d42a0c', '#f2501e'];
  for (const [bx, len] of [[580, 380], [640, 480], [702, 330]]) {
    g.strokeStyle = '#3a2a1c'; g.lineWidth = 3; g.beginPath(); g.moveTo(bx, 520); g.lineTo(bx + 4, 520 + len); g.stroke();
    for (let i = 0; i < 6; i++) leaf(bx, 524 + r() * 20, 30 + r() * 22, 8, 0.5 + r() * 2.2, 125 + r() * 30, 14 + r() * 10);
    for (let i = 0; i < 150; i++) {
      const t = Math.pow(r(), 0.8), y = 536 + t * len, spread = (26 * Math.sin(Math.min(1, t * 1.5) * Math.PI * 0.5) + 6) * (1 - t * 0.72), x = bx + 4 * t + (r() * 2 - 1) * spread, rad = (8.5 - t * 4.5) * (0.7 + r() * 0.5);
      g.fillStyle = reds[Math.floor(r() * reds.length)]; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill();
      if (r() < 0.45) { g.fillStyle = 'rgba(255,224,150,0.9)'; g.beginPath(); g.arc(x - rad * 0.2, y - rad * 0.25, rad * 0.35, 0, 7); g.fill(); }
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

const MOON = new THREE.Vector3(-0.45, 0.8, 0.4).normalize();
const _t = new THREE.Vector3(), _n = new THREE.Vector3(), _b = new THREE.Vector3(), _p = new THREE.Vector3(), _q = new THREE.Vector3();

class Mesher {
  constructor() { this.pos = []; this.uv = []; this.col = []; this.idx = []; }
  // A limb: a tube along the points given, as thick at each as asked, its bark fluted and turning as it climbs.
  tube(pts, radii, segs, flute = 0, twist = 0, lobes = 3) {
    const base = this.pos.length / 3; let len = 0;
    _n.set(1, 0, 0);
    for (let i = 0; i < pts.length; i++) {
      _t.subVectors(pts[Math.min(pts.length - 1, i + 1)], pts[Math.max(0, i - 1)]).normalize();
      _n.addScaledVector(_t, -_n.dot(_t)); if (_n.lengthSq() < 1e-6) _n.set(0, 0, 1).addScaledVector(_t, -_t.z); _n.normalize();
      _b.crossVectors(_t, _n);
      if (i) len += pts[i].distanceTo(pts[i - 1]);
      const v = Math.abs(((len / 2.6) % 2) - 1);      // the bark runs on up the limb, turned over at every repeat so no seam shows
      for (let k = 0; k <= segs; k++) {
        const a = k / segs * Math.PI * 2, rad = radii[i] * (1 + flute * Math.sin(lobes * a + twist * len) + flute * 0.45 * Math.sin((lobes + 2) * a - twist * 0.7 * len + 1.3));
        _q.copy(_n).multiplyScalar(Math.cos(a)).addScaledVector(_b, Math.sin(a));
        _p.copy(pts[i]).addScaledVector(_q, rad);
        this.pos.push(_p.x, _p.y, _p.z);
        const u = Math.abs(((k / segs * 2) % 2) - 1);
        this.uv.push(BARK[0] + u * (BARK[1] - BARK[0]), BARK[2] + v * (BARK[3] - BARK[2]));
        // moonlight from one side, the blue of the night on the other, darker in the folds and at the foot
        const lit = Math.max(0, _q.dot(MOON)), fold = 1 - flute * 1.6 * Math.max(0, -Math.sin(lobes * a + twist * len)), foot = 0.62 + 0.38 * Math.min(1, Math.max(0, _p.y) / 1.6);
        const k0 = (0.62 + 1.25 * lit) * fold * foot;
        this.col.push(k0 * (0.8 + 0.25 * lit), k0 * (0.9 + 0.2 * lit), k0 * (1.12 + 0.2 * lit));
      }
      if (i) for (let k = 0; k < segs; k++) { const a = base + (i - 1) * (segs + 1) + k, b = a + segs + 1; this.idx.push(a, b, a + 1, a + 1, b, b + 1); }
    }
  }
  // A flat card facing along n, w wide and h tall about its middle (or hanging from it), carrying a part of the sheet.
  card(at, right, up, w, h, box, col, hang = false) {
    const base = this.pos.length / 3, y0 = hang ? -h : -h / 2, y1 = hang ? 0 : h / 2;
    for (const [sx, sy, u, v] of [[-0.5, y0, 0, 0], [0.5, y0, 1, 0], [0.5, y1, 1, 1], [-0.5, y1, 0, 1]]) {
      this.pos.push(at.x + right.x * sx * w + up.x * sy, at.y + right.y * sx * w + up.y * sy, at.z + right.z * sx * w + up.z * sy);
      this.uv.push(box[0] + u * (box[1] - box[0]), box[2] + v * (box[3] - box[2])); this.col.push(col[0], col[1], col[2]);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx); g.computeBoundingSphere(); return g;
  }
}

// Points along a bending line from a to b, lifted in the middle by `rise` and pushed about a little: the way a limb grows.
function limb(a, b, n, rise, r, wander) {
  const out = [], side = new THREE.Vector3(r() - 0.5, 0, r() - 0.5).normalize().multiplyScalar(wander);
  for (let i = 0; i <= n; i++) {
    const t = i / n, p = new THREE.Vector3().lerpVectors(a, b, t), bow = Math.sin(t * Math.PI);
    p.y += rise * bow; p.addScaledVector(side, bow * Math.sin(t * 5 + 1)); out.push(p);
  }
  return out;
}

// One tree. size: 1 for the trees of the grove, more for the great one. o.perch: [x, y, z] a limb must pass under, for
// someone to crouch on; o.lite: fewer cards. Nothing hangs lower than 5.6 m near the trunk or 7.2 m further out: the
// road and every camera of the game are under that.
export function tree(seed, size = 1, o = {}) {
  const r = rng(seed), wood = new Mesher(), green = new Mesher(), V = (x, y, z) => new THREE.Vector3(x, y, z);
  const R = (0.72 + r() * 0.22) * size, fork = (3.3 + r() * 1.1) * (0.8 + 0.2 * size), lean = V((r() - 0.5) * 0.9, 0, (r() - 0.5) * 0.9);
  // the trunk: wide at the foot, fluted, turning as it climbs
  const tp = [], tr = [];
  for (let i = 0; i <= 6; i++) { const t = i / 6; tp.push(V(lean.x * t * t, fork * t - 0.15, lean.z * t * t)); tr.push(R * (1 + 0.75 * Math.pow(1 - t, 3)) * (1 - 0.3 * t)); }
  wood.tube(tp, tr, 10, 0.16, 1.5 + r() * 0.8, 3 + Math.floor(r() * 2));
  const top = tp[6];
  // roots running out over the ground and down into it
  const nr = 6 + Math.floor(r() * 3);
  for (let i = 0; i < nr; i++) {
    const a = (i + r() * 0.7) / nr * 6.283, d = R * (2.4 + r() * 1.5), rp = limb(V(Math.cos(a) * R * 0.5, 0.75 * size, Math.sin(a) * R * 0.5), V(Math.cos(a) * d, -0.22, Math.sin(a) * d), 4, 0.1, r, 0.25);
    wood.tube(rp, [R * 0.42, R * 0.34, R * 0.26, R * 0.17, R * 0.07], 6, 0.1, 2);
  }
  // the great limbs, and the smaller ones that leave them; where leaves will hang is noted as they grow
  const tips = [], spread = 6.2 * (0.75 + 0.25 * size), nl = 4 + Math.floor(r() * 2), ends = [];
  for (let i = 0; i < nl; i++) { const a = (i + r() * 0.6) / nl * 6.283 + seed, d = spread * (0.75 + r() * 0.4); ends.push(V(top.x + Math.cos(a) * d, (9.6 + r() * 2.6) * (0.72 + 0.28 * size), top.z + Math.sin(a) * d)); }
  if (o.perch) ends.push(null);
  for (const end of ends) {
    let lp, rad;
    if (end) { lp = limb(top.clone().setY(top.y - 0.3), end, 8, 1.4 + r() * 1.2, r, 0.7); rad = lp.map((_, i) => R * (0.5 - 0.42 * Math.pow(i / 8, 0.8))); }
    else {      // the low limb someone can crouch on: out from the trunk, level where it is sat on, then up
      const p = V(...o.perch), out = p.clone().setY(0).normalize();
      lp = [V(out.x * R * 0.3, p.y - 0.95, out.z * R * 0.3), p.clone().multiplyScalar(0.55).setY(p.y - 0.5), p.clone().setY(p.y - 0.31), p.clone().multiplyScalar(1.5).setY(p.y - 0.1), p.clone().multiplyScalar(2.0).setY(p.y + 1.3), p.clone().multiplyScalar(2.4).setY(p.y + 3.4), p.clone().multiplyScalar(2.6).setY(p.y + 5.6)];
      rad = [0.5, 0.4, 0.31, 0.27, 0.22, 0.15, 0.07];
    }
    wood.tube(lp, rad, 7, 0.1, 1.2);
    const n = lp.length - 1;
    for (let i = Math.ceil(n * 0.45); i <= n; i++) if (lp[i].y > 5.2) tips.push(lp[i]);
    for (let j = 0; j < 3; j++) {
      const at = Math.floor(n * (0.4 + j * 0.2)), from = lp[at], away = _t.subVectors(lp[n], lp[0]).setY(0).normalize().clone(), turn = (r() - 0.5) * 2.4;
      const dir = V(away.x * Math.cos(turn) - away.z * Math.sin(turn), 0, away.x * Math.sin(turn) + away.z * Math.cos(turn)), l = (2.6 + r() * 2.2) * (0.8 + 0.2 * size);
      const sp = limb(from, V(from.x + dir.x * l, Math.max(from.y + 1.2 + r() * 1.8, 6.4), from.z + dir.z * l), 4, 0.5, r, 0.4);
      wood.tube(sp, [rad[at] * 0.5, rad[at] * 0.4, rad[at] * 0.3, rad[at] * 0.2, 0.03], 5, 0.06, 1);
      tips.push(sp[2], sp[3], sp[4]);
    }
  }
  // leaves: at every such place a few cards lying nearly flat and a few standing, so the canopy is full from below and from the side
  const far = p => Math.hypot(p.x, p.z) > 2.5 * size, keep = o.lite ? 0.62 : 1, crown = tips.reduce((m, p) => Math.max(m, p.y), 0);
  for (const p of tips) {
    for (let k = 0; k < 3; k++) {
      if (r() > keep) continue;
      const c = p.clone().add(V((r() - 0.5) * 2.4, r() * 1.4, (r() - 0.5) * 2.4)), flat = k < 2, size2 = (2.8 + r() * 1.6) * (0.85 + 0.15 * size);
      c.y = Math.max(c.y, far(c) ? 8.3 : 6.6);
      const yaw = r() * 6.283, tilt = flat ? (r() - 0.5) * 0.7 : Math.PI / 2 - (r() - 0.5) * 0.5;
      const right = V(Math.cos(yaw), 0, Math.sin(yaw)), up = V(-Math.sin(yaw) * Math.cos(tilt), Math.sin(tilt), Math.cos(yaw) * Math.cos(tilt));
      const high = Math.min(1, Math.max(0, (c.y - 6) / Math.max(1, crown - 5))), k0 = (0.5 + 0.75 * high) * (0.8 + r() * 0.4);      // the top of the canopy takes the moon, its underside the dark
      green.card(c, right, up.multiplyScalar(size2), size2, 1, LEAF, [k0 * 0.62, k0 * 0.86, k0 * 1.0]);
    }
    // blossom hanging under the leaves, in ones and twos
    const chains = r() < 0.75 * keep ? 1 + Math.floor(r() * 2) : 0;
    for (let k = 0; k < chains; k++) {
      const c = p.clone().add(V((r() - 0.5) * 2.2, 0.2, (r() - 0.5) * 2.2)), h = 1.5 + r() * 1.4, w = h * 0.5, yaw = r() * 6.283, low = far(c) ? 7.2 : 5.6;
      c.y = Math.max(c.y, low + h);
      const glow = 0.85 + r() * 0.4;
      for (const turn of [0, Math.PI / 2]) green.card(c, V(Math.cos(yaw + turn), 0, Math.sin(yaw + turn)), V(0, h, 0), w, 1, BLOOM, [glow * 1.1, glow * 0.8, glow * 0.66], true);
    }
  }
  return { wood: wood.geometry(), green: green.geometry() };
}

export function treeMaterials() {
  const map = sheet();
  return {
    wood: new THREE.MeshBasicMaterial({ map, vertexColors: true }),
    green: new THREE.MeshBasicMaterial({ map, vertexColors: true, alphaTest: 0.42, side: THREE.DoubleSide }),
  };
}
